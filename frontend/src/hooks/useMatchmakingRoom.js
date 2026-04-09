import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWebRTC } from './useWebRTC';

export function useMatchmakingRoom(socket) {
  const navigate = useNavigate();
  const [status, setStatus] = useState('Joining queue...');
  const [activeRoomId, setActiveRoomId] = useState(null);
  const rematchTimerRef = useRef(null);
  const isSkippingRef = useRef(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [partnerUsername, setPartnerUsername] = useState(null);

  const webrtc = useWebRTC(socket, activeRoomId);
  const {
      initializeMedia,
      stopMedia,
      initiateCall,
      setInitialRemoteMediaStates,
      resetCallState
  } = webrtc;

  useEffect(() => {
    initializeMedia();
  }, [initializeMedia]);

  const queueForAnotherMatch = useCallback((nextStatus) => {
    if (isSkippingRef.current) return;
    isSkippingRef.current = true;
    setStatus(nextStatus);
    setActiveRoomId(null);
    resetCallState();
    setInitialRemoteMediaStates({});
    socket.emit('skip-match');

    if (rematchTimerRef.current) window.clearTimeout(rematchTimerRef.current);
    rematchTimerRef.current = window.setTimeout(() => {
      socket.emit('join-random');
      isSkippingRef.current = false;
    }, 500);
  }, [socket, resetCallState, setInitialRemoteMediaStates]);

  const joinQueue = useCallback(async () => {
    const stream = await initializeMedia();
    if (stream) {
      socket.emit('join-random');
      setHasJoined(true);
    }
  }, [initializeMedia, socket]);

  useEffect(() => {
    if (!socket || !hasJoined) return;

    const handleWaitingMatch = () => setStatus('Waiting for someone to join...');
    
    const handleMatchFound = async ({
      roomId, partnerSocketId, partnerUserId, partnerUsername, shouldInitiate, initialMediaStates
    }) => {
      setActiveRoomId(roomId);
      setStatus('Connected!');
      setPartnerUsername(partnerUsername);
      setInitialRemoteMediaStates(initialMediaStates ?? {});
      if (shouldInitiate) {
        await initiateCall(partnerSocketId, partnerUserId);
      }
    };

    const handlePartnerSkipped = () => queueForAnotherMatch('Partner skipped. Finding a new match...');
    const handlePartnerDisconnected = () => queueForAnotherMatch('Partner disconnected. Finding a new match...');
    const handleSocketError = (payload) => setStatus(payload?.message || 'Something went wrong');

    socket.on('waiting-match', handleWaitingMatch);
    socket.on('match-found', handleMatchFound);
    socket.on('partner-skipped', handlePartnerSkipped);
    socket.on('partner-disconnected', handlePartnerDisconnected);
    socket.on('error', handleSocketError);

    return () => {
      socket.off('waiting-match', handleWaitingMatch);
      socket.off('match-found', handleMatchFound);
      socket.off('partner-skipped', handlePartnerSkipped);
      socket.off('partner-disconnected', handlePartnerDisconnected);
      socket.off('error', handleSocketError);
    };
  }, [socket, hasJoined, queueForAnotherMatch, initiateCall, setInitialRemoteMediaStates]);

  const handleSkip = useCallback(() => {
    if (!socket || isSkippingRef.current) return;
    isSkippingRef.current = true;
    setStatus('Skipping...');
    setActiveRoomId(null);
    resetCallState();
    setInitialRemoteMediaStates({});
    socket.emit('skip-match');

    if (rematchTimerRef.current) window.clearTimeout(rematchTimerRef.current);
    rematchTimerRef.current = window.setTimeout(() => {
      socket.emit('join-random');
      isSkippingRef.current = false;
    }, 500);
  }, [socket, resetCallState, setInitialRemoteMediaStates]);

  const leaveRoom = useCallback(() => {
    if (rematchTimerRef.current) window.clearTimeout(rematchTimerRef.current);
    stopMedia();
    resetCallState();
    setActiveRoomId(null);
    if(socket) socket.emit('skip-match');
    navigate('/dashboard');
  }, [stopMedia, resetCallState, socket, navigate]);

  return {
    ...webrtc,
    status,
    activeRoomId,
    joinQueue,
    leaveRoom,
    handleSkip,
    hasJoined,
    partnerUsername
  };
}
