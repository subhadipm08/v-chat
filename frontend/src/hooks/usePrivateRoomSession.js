import { useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/auth-context';
import { useWebRTC } from './useWebRTC';
import { API_BASE_URL } from '../lib/config';

export function usePrivateRoomSession(socket, routeRoomId, isCreator) {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [hasJoined, setHasJoined] = useState(false);
  const [sessionError, setSessionError] = useState(null);

  // Creator starts with null roomId (room doesn't exist yet).
  // Joiner starts with the roomId from the URL.
  const [actualRoomId, setActualRoomId] = useState(isCreator ? null : routeRoomId);

  const webrtc = useWebRTC(socket, actualRoomId);
  const {
    initializeMedia,
    stopMedia,
    initiateCall,
    setInitialRemoteMediaStates,
    resetCallState,
    setRemoteUsernames,
  } = webrtc;

  // Start camera/mic immediately for the PreJoin preview — purely frontend, no backend calls.
  useEffect(() => {
    initializeMedia();
  }, [initializeMedia]);

  // ─── Join Action (commit phase) ─────────────────────────────────────────────
  const joinRoom = useCallback(async () => {
    try {
      const stream = await initializeMedia();
      if (!stream) return; // Media failed; mediaError state handles UI feedback.

      if (isCreator) {
        // CREATOR: create the room document only when Join is clicked.
        const res = await fetch(`${API_BASE_URL}/api/rooms/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });

        let data;
        try {
          data = await res.json();
        } catch {
          throw new Error('Server returned an unexpected response.');
        }

        if (!res.ok) throw new Error(data?.error || 'Failed to create room.');

        const newRoomId = data.room.roomId;

        // Commit: update local roomId state, sync URL, then join socket room.
        setActualRoomId(newRoomId);
        navigate(`/room/${newRoomId}`, { replace: true });
        socket.emit('join-room', { roomId: newRoomId });
      } else {
        // JOINER: validate room exists before committing to join.
        const res = await fetch(`${API_BASE_URL}/api/rooms/verify/${routeRoomId}`, {
          credentials: 'include',
        });

        if (!res.ok) {
          setSessionError(`Room '${routeRoomId}' does not exist.`);
          setTimeout(() => navigate('/dashboard'), 3000);
          return;
        }

        socket.emit('join-room', { roomId: routeRoomId });
      }

      setHasJoined(true);
    } catch (err) {
      setSessionError(err.message || 'Failed to join room. Please try again.');
    }
  }, [isCreator, initializeMedia, routeRoomId, socket, navigate]);

  // ─── Socket event listeners (active only after joining) ──────────────────────
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
      setSessionError('Room is full. Please try a different room.');
      setTimeout(() => navigate('/dashboard'), 3000);
    };

    const handleError = (data) => {
      setSessionError(data?.message || 'An error occurred joining the room.');
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
  }, [socket, hasJoined, user.id, initiateCall, setInitialRemoteMediaStates, setRemoteUsernames, navigate]);

  // ─── Exit PreJoin — pure frontend cleanup, zero backend calls ───────────────
  const exitPreJoin = useCallback(() => {
    stopMedia();
    navigate('/dashboard');
  }, [stopMedia, navigate]);

  // ─── Leave Room — full cleanup after being in a call ─────────────────────────
  const leaveRoom = useCallback(() => {
    stopMedia();
    resetCallState();
    if (socket && actualRoomId) {
      socket.emit('leave-room', { roomId: actualRoomId });
    }
    navigate('/dashboard');
  }, [stopMedia, resetCallState, socket, actualRoomId, navigate]);

  return {
    ...webrtc,
    joinRoom,
    leaveRoom,
    exitPreJoin,
    hasJoined,
    sessionError,
  };
}
