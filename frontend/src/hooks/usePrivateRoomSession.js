import { useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/auth-context';
import { useWebRTC } from './useWebRTC';

export function usePrivateRoomSession(socket, roomId) {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [hasJoined, setHasJoined] = useState(false);
  const [sessionError, setSessionError] = useState(null);
  
  const webrtc = useWebRTC(socket, roomId);
  const {
     initializeMedia,
     stopMedia,
     initiateCall,
     setInitialRemoteMediaStates,
     resetCallState,
     setRemoteUsernames
  } = webrtc;

  useEffect(() => {
    initializeMedia();
  }, [initializeMedia]);

  const joinRoom = useCallback(async () => {
    try {
      const stream = await initializeMedia();
      if (stream) {
        socket.emit('join-room', { roomId });
        setHasJoined(true);
      }
    } catch (err) {
      setSessionError('Failed to initialize media.');
    }
  }, [initializeMedia, roomId, socket]);

  useEffect(() => {
    if (!socket || !hasJoined) return;

    const handleRoomJoined = async ({ existingUsers, initialMediaStates }) => {
      if (initialMediaStates) {
        setInitialRemoteMediaStates(initialMediaStates);
      }
      const initialUsernames = {};
      for (const existingUser of existingUsers) {
        if (existingUser.username) {
          initialUsernames[existingUser.userId] = existingUser.username;
        }
        if (existingUser.userId !== user.id) {
          await initiateCall(existingUser.socketId, existingUser.userId);
        }
      }
      setRemoteUsernames(initialUsernames);
    };

    const handleRoomFull = () => {
      setSessionError('Room is full');
      setTimeout(() => navigate('/dashboard'), 3000);
    };

    const handleError = (data) => {
      if (data.message === 'Room not found') {
        setSessionError(`Room with ID '${roomId}' does not exist.`);
      } else {
        setSessionError(data?.message || 'An error occurred joining the room');
      }
      setTimeout(() => navigate('/dashboard'), 3000);
    };

    socket.on('room-joined', handleRoomJoined);
    socket.on('room-full', handleRoomFull);
    socket.on('error', handleError);

    return () => {
      socket.off('room-joined', handleRoomJoined);
      socket.off('room-full', handleRoomFull);
      socket.off('error', handleError);
    };
  }, [socket, hasJoined, user.id, initiateCall, setInitialRemoteMediaStates, navigate, roomId]);

  const leaveRoom = useCallback(() => {
    stopMedia();
    resetCallState();
    if (socket) {
      socket.emit('leave-room', { roomId });
    }
    navigate('/dashboard');
  }, [stopMedia, resetCallState, socket, roomId, navigate]);

  return {
    ...webrtc,
    joinRoom,
    leaveRoom,
    hasJoined,
    sessionError
  };
}
