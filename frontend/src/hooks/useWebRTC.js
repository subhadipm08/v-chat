import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../lib/config';

const DEFAULT_QUALITY_STATS = { packetLoss: 0, bitrate: 0 };
const DEFAULT_MEDIA_STATE = { isMicOn: true, isCameraOn: true };

// Module-level cache for ICE servers
let cachedIceServers = null;
let iceFetchPromise = null;

export function useWebRTC(socket, roomIdProps) {
  const roomIdRef = useRef(roomIdProps);
  useEffect(() => {
    roomIdRef.current = roomIdProps;
  }, [roomIdProps]);

  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [qualityStats, setQualityStats] = useState(DEFAULT_QUALITY_STATS);
  const [mediaError, setMediaError] = useState(null);
  const [localMediaState, setLocalMediaState] = useState(DEFAULT_MEDIA_STATE);
  const [remoteMediaStates, setRemoteMediaStates] = useState({});
  const [remoteUsernames, setRemoteUsernames] = useState({});

  const peerConnections = useRef({});
  const peerMetadata = useRef({});
  const statsIntervals = useRef({});
  const iceCandidateQueues = useRef({});
  const makingOffers = useRef({});
  const localStreamRef = useRef(null);
  const hasInitialized = useRef(false);
  const mediaPromiseRef = useRef(null);

  const syncLocalStream = useCallback(() => {
    if (!localStreamRef.current) {
      setLocalStream(null);
      return;
    }

    setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
  }, []);

  const clearRemoteParticipant = useCallback((remoteUserId) => {
    if (!remoteUserId) {
      return;
    }

    setRemoteStreams((currentStreams) => {
      const nextStreams = { ...currentStreams };
      delete nextStreams[remoteUserId];
      return nextStreams;
    });

    setRemoteMediaStates((currentStates) => {
      const nextStates = { ...currentStates };
      delete nextStates[remoteUserId];
      return nextStates;
    });
  }, []);

  const cleanupPeerConnection = useCallback(
    (socketId, remoteUserId = peerMetadata.current[socketId]?.userId) => {
      if (statsIntervals.current[socketId]) {
        clearInterval(statsIntervals.current[socketId]);
        delete statsIntervals.current[socketId];
      }

      const peerConnection = peerConnections.current[socketId];
      if (peerConnection) {
        peerConnection.ontrack = null;
        peerConnection.onicecandidate = null;
        peerConnection.onconnectionstatechange = null;
        peerConnection.onnegotiationneeded = null;
        peerConnection.close();
      }
      
      delete peerConnections.current[socketId];
      delete peerMetadata.current[socketId];
      delete makingOffers.current[socketId];
      delete iceCandidateQueues.current[socketId];

      clearRemoteParticipant(remoteUserId);
    },
    [clearRemoteParticipant]
  );

  const resetCallState = useCallback(() => {
    Object.keys(peerConnections.current).forEach((socketId) => {
      cleanupPeerConnection(socketId);
    });

    setRemoteStreams({});
    setRemoteMediaStates({});
    setRemoteUsernames({});
    setQualityStats(DEFAULT_QUALITY_STATS);
  }, [cleanupPeerConnection]);

  const initializeMedia = useCallback(async () => {
    if (mediaPromiseRef.current) {
      return mediaPromiseRef.current;
    }

    mediaPromiseRef.current = navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        hasInitialized.current = true;
        localStreamRef.current = stream;
        setLocalStream(stream);
        setMediaError(null);
        setLocalMediaState(DEFAULT_MEDIA_STATE);
        return stream;
      })
      .catch(err => {
        mediaPromiseRef.current = null;
        console.error('Media devices error:', err);
        setMediaError(err.name);
        return null;
      });

    return mediaPromiseRef.current;
  }, []);

  const getIceServers = useCallback(async () => {
    if (cachedIceServers) return cachedIceServers;
    if (iceFetchPromise) return iceFetchPromise;

    iceFetchPromise = fetch(`${API_BASE_URL}/api/rooms/ice-servers`, {
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((data) => {
        cachedIceServers = data.iceServers;
        return cachedIceServers;
      })
      .catch(() => {
        return [{ urls: 'stun:stun.l.google.com:19302' }];
      })
      .finally(() => {
        iceFetchPromise = null;
      });

    return iceFetchPromise;
  }, []);

  const createPeerConnection = useCallback(
    async (targetSocketId, remoteUserId) => {
      if (peerConnections.current[targetSocketId]) {
        // Strict PC handling: Never reuse old connection.
        cleanupPeerConnection(targetSocketId, remoteUserId);
      }

      const iceServers = await getIceServers();
      const peerConnection = new RTCPeerConnection({ iceServers });

      peerConnections.current[targetSocketId] = peerConnection;
      peerMetadata.current[targetSocketId] = { userId: remoteUserId };

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          peerConnection.addTrack(track, localStreamRef.current);
        });
      }

      peerConnection.ontrack = (event) => {
        setRemoteStreams((currentStreams) => ({
          ...currentStreams,
          [remoteUserId || targetSocketId]: event.streams[0],
        }));
      };

      peerConnection.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('ice-candidate', {
            candidate: event.candidate,
            target: targetSocketId,
            roomId: roomIdRef.current,
          });
        }
      };

      statsIntervals.current[targetSocketId] = window.setInterval(async () => {
        if (peerConnection.connectionState !== 'connected') {
          return;
        }

        const stats = await peerConnection.getStats();
        stats.forEach((report) => {
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            const packetsLost = report.packetsLost || 0;
            const packetsReceived = report.packetsReceived || 0;
            const totalPackets = packetsLost + packetsReceived;
            const lossRate = totalPackets > 0 ? (packetsLost / totalPackets) * 100 : 0;

            setQualityStats({
              packetLoss: lossRate.toFixed(2),
              bitrate: report.bytesReceived,
            });
          }
        });
      }, 5000);

      peerConnection.onconnectionstatechange = () => {
        if (['disconnected', 'failed', 'closed'].includes(peerConnection.connectionState)) {
          cleanupPeerConnection(targetSocketId, remoteUserId);
        }
      };

      return peerConnection;
    },
    [cleanupPeerConnection, getIceServers, socket]
  );

  const handleOffer = useCallback(
    async (payload, callerId, callerSocketId, incomingRoomId) => {
      let peerConnection = peerConnections.current[callerSocketId];
      const offerCollision =
        peerConnection &&
        (makingOffers.current[callerSocketId] || peerConnection.signalingState !== 'stable');
      
      if (offerCollision) {
        return; // Ignore incoming offer based on perfect negotiation collision handling
      }

      if (!peerConnection) {
        peerConnection = await createPeerConnection(callerSocketId, callerId);
      }

      await peerConnection.setRemoteDescription(new RTCSessionDescription(payload));
      
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      socket.emit('answer', {
        payload: answer,
        target: callerSocketId,
        roomId: incomingRoomId ?? roomIdRef.current,
      });

      // Flush queued ICE candidates now that remote description is set
      const queuedCandidates = iceCandidateQueues.current[callerSocketId] || [];
      for (const candidate of queuedCandidates) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) { 
          console.error('Failed to add queued candidate', e);
        }
      }
      iceCandidateQueues.current[callerSocketId] = [];
    },
    [createPeerConnection, socket]
  );

  const handleAnswer = useCallback(async (payload, answererSocketId) => {
    const peerConnection = peerConnections.current[answererSocketId];
    if (!peerConnection) {
      return;
    }

    await peerConnection.setRemoteDescription(new RTCSessionDescription(payload));

    // Flush queued ICE candidates now that remote description is set
    const queuedCandidates = iceCandidateQueues.current[answererSocketId] || [];
    for (const candidate of queuedCandidates) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error('Failed to add queued candidate', e);
      }
    }
    iceCandidateQueues.current[answererSocketId] = [];
  }, []);

  const handleIceCandidate = useCallback(async (candidate, senderSocketId) => {
    const peerConnection = peerConnections.current[senderSocketId];
    if (!peerConnection) return;

    try {
      if (!peerConnection.remoteDescription) {
        if (!iceCandidateQueues.current[senderSocketId]) {
          iceCandidateQueues.current[senderSocketId] = [];
        }
        iceCandidateQueues.current[senderSocketId].push(candidate);
      } else {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (error) {
      console.error('Error adding ice candidate', error);
    }
  }, []);

  const initiateCall = useCallback(
    async (targetSocketId, remoteUserId) => {
      const peerConnection = await createPeerConnection(targetSocketId, remoteUserId);
      try {
        makingOffers.current[targetSocketId] = true;
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        socket.emit('offer', {
          payload: offer,
          target: targetSocketId,
          roomId: roomIdRef.current,
        });
      } catch (err) {
        console.error('Error initiating call:', err);
      } finally {
        makingOffers.current[targetSocketId] = false;
      }
    },
    [createPeerConnection, socket]
  );

  const toggleMedia = useCallback(
    (type) => {
      const stream = localStreamRef.current;
      if (!stream) {
        return;
      }

      let nextMicOn = localMediaState.isMicOn;
      let nextCameraOn = localMediaState.isCameraOn;

      if (type === 'video') {
        stream.getVideoTracks().forEach((track) => {
          track.enabled = !track.enabled;
          nextCameraOn = track.enabled;
        });
      } else {
        stream.getAudioTracks().forEach((track) => {
          track.enabled = !track.enabled;
          nextMicOn = track.enabled;
        });
      }

      setLocalMediaState({ isMicOn: nextMicOn, isCameraOn: nextCameraOn });
      syncLocalStream();

      if (socket && roomIdRef.current) {
        socket.emit('media-state-change', {
          roomId: roomIdRef.current,
          isMicOn: nextMicOn,
          isCameraOn: nextCameraOn,
        });
      }
    },
    [localMediaState, socket, syncLocalStream]
  );

  const setInitialRemoteMediaStates = useCallback((states = {}) => {
    setRemoteMediaStates(states);
  }, []);

  const stopMedia = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    localStreamRef.current = null;
    mediaPromiseRef.current = null;
    hasInitialized.current = false;
    setLocalStream(null);
    setRemoteStreams({}); // Triggers VideoTile.jsx srcObject = null for all
    setLocalMediaState(DEFAULT_MEDIA_STATE);
  }, []);

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    const offerHandler = ({ payload, caller, callerId, roomId: incomingRoomId }) =>
      handleOffer(payload, callerId, caller, incomingRoomId);
    const answerHandler = ({ payload, answerer }) => handleAnswer(payload, answerer);
    const candidateHandler = ({ candidate, sender }) => handleIceCandidate(candidate, sender);
    const mediaUpdateHandler = ({ userId, isMicOn, isCameraOn }) => {
      setRemoteMediaStates((currentStates) => ({
        ...currentStates,
        [userId]: { isMicOn, isCameraOn },
      }));
    };
    const userLeftHandler = ({ userId: remoteUserId, socketId }) => {
      cleanupPeerConnection(socketId, remoteUserId);
    };
    const userJoinedHandler = ({ userId, username }) => {
      if (username) {
        setRemoteUsernames((current) => ({ ...current, [userId]: username }));
      }
    };

    socket.on('offer', offerHandler);
    socket.on('answer', answerHandler);
    socket.on('ice-candidate', candidateHandler);
    socket.on('user-media-updated', mediaUpdateHandler);
    socket.on('user-left', userLeftHandler);
    socket.on('user-joined', userJoinedHandler);

    return () => {
      socket.off('offer', offerHandler);
      socket.off('answer', answerHandler);
      socket.off('ice-candidate', candidateHandler);
      socket.off('user-media-updated', mediaUpdateHandler);
      socket.off('user-left', userLeftHandler);
      socket.off('user-joined', userJoinedHandler);
    };
  }, [cleanupPeerConnection, handleAnswer, handleIceCandidate, handleOffer, socket]);

  return {
    localStream,
    remoteStreams,
    initializeMedia,
    stopMedia,
    initiateCall,
    toggleMedia,
    mediaError,
    qualityStats,
    localMediaState,
    remoteMediaStates,
    remoteUsernames,
    setInitialRemoteMediaStates,
    resetCallState,
    setRemoteUsernames
  };
}
