import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../lib/config';

const DEFAULT_QUALITY_STATS = { packetLoss: 0, bitrate: 0 };
const DEFAULT_MEDIA_STATE = { isMicOn: true, isCameraOn: true };

export function useWebRTC(socket, roomId) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [qualityStats, setQualityStats] = useState(DEFAULT_QUALITY_STATS);
  const [mediaError, setMediaError] = useState(null);
  const [localMediaState, setLocalMediaState] = useState(DEFAULT_MEDIA_STATE);
  const [remoteMediaStates, setRemoteMediaStates] = useState({});

  const peerConnections = useRef({});
  const peerMetadata = useRef({});
  const statsIntervals = useRef({});
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
        peerConnection.close();
        delete peerConnections.current[socketId];
      }

      delete peerMetadata.current[socketId];
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
    try {
      const response = await fetch(`${API_BASE_URL}/api/rooms/ice-servers`, {
        credentials: 'include',
      });

      const data = await response.json();
      return data.iceServers;
    } catch {
      return [{ urls: 'stun:stun.l.google.com:19302' }];
    }
  }, []);

  const createPeerConnection = useCallback(
    async (targetSocketId, remoteUserId) => {
      if (peerConnections.current[targetSocketId]) {
        return peerConnections.current[targetSocketId];
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
            roomId,
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
    [cleanupPeerConnection, getIceServers, roomId, socket]
  );

  const handleOffer = useCallback(
    async (payload, callerId, callerSocketId, incomingRoomId) => {
      const peerConnection = await createPeerConnection(callerSocketId, callerId);
      await peerConnection.setRemoteDescription(new RTCSessionDescription(payload));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      socket.emit('answer', {
        payload: answer,
        target: callerSocketId,
        roomId: incomingRoomId ?? roomId,
      });
    },
    [createPeerConnection, roomId, socket]
  );

  const handleAnswer = useCallback(async (payload, answererSocketId) => {
    const peerConnection = peerConnections.current[answererSocketId];
    if (!peerConnection) {
      return;
    }

    await peerConnection.setRemoteDescription(new RTCSessionDescription(payload));
  }, []);

  const handleIceCandidate = useCallback(async (candidate, senderSocketId) => {
    const peerConnection = peerConnections.current[senderSocketId];
    if (peerConnection) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error('Error adding ice candidate', error);
      }
    }
  }, []);

  const initiateCall = useCallback(
    async (targetSocketId, remoteUserId) => {
      const peerConnection = await createPeerConnection(targetSocketId, remoteUserId);
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      socket.emit('offer', {
        payload: offer,
        target: targetSocketId,
        roomId,
      });
    },
    [createPeerConnection, roomId, socket]
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

      if (socket && roomId) {
        socket.emit('media-state-change', {
          roomId,
          isMicOn: nextMicOn,
          isCameraOn: nextCameraOn,
        });
      }
    },
    [localMediaState, roomId, socket, syncLocalStream]
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

    socket.on('offer', offerHandler);
    socket.on('answer', answerHandler);
    socket.on('ice-candidate', candidateHandler);
    socket.on('user-media-updated', mediaUpdateHandler);
    socket.on('user-left', userLeftHandler);

    return () => {
      socket.off('offer', offerHandler);
      socket.off('answer', answerHandler);
      socket.off('ice-candidate', candidateHandler);
      socket.off('user-media-updated', mediaUpdateHandler);
      socket.off('user-left', userLeftHandler);
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
    setInitialRemoteMediaStates,
    resetCallState,
  };
}
