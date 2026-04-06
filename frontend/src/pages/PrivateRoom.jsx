import { useContext, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CallControls from '../components/call/CallControls';
import RoomHeader from '../components/call/RoomHeader';
import VideoTile from '../components/call/VideoTile';
import { AuthContext } from '../context/auth-context';
import { SocketContext } from '../context/socket-context';
import { useWebRTC } from '../hooks/useWebRTC';

export default function PrivateRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { socket } = useContext(SocketContext);
  const { user } = useContext(AuthContext);

  const {
    localStream,
    remoteStreams,
    initializeMedia,
    stopMedia,
    initiateCall,
    toggleMedia,
    mediaError,
    localMediaState,
    remoteMediaStates,
    setInitialRemoteMediaStates,
    resetCallState,
  } = useWebRTC(socket, roomId);

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    const joinRoom = async () => {
      const stream = await initializeMedia();
      if (stream) {
        socket.emit('join-room', { roomId });
      }
    };

    const handleRoomJoined = async ({ existingUsers, initialMediaStates }) => {
      if (initialMediaStates) {
        setInitialRemoteMediaStates(initialMediaStates);
      }

      for (const existingUser of existingUsers) {
        if (existingUser.userId !== user.id) {
          await initiateCall(existingUser.socketId, existingUser.userId);
        }
      }
    };

    const handleRoomFull = () => {
      navigate('/');
    };

    joinRoom();
    socket.on('room-joined', handleRoomJoined);
    socket.on('room-full', handleRoomFull);

    return () => {
      stopMedia();
      resetCallState();
      socket.emit('leave-room', { roomId });
      socket.off('room-joined', handleRoomJoined);
      socket.off('room-full', handleRoomFull);
    };
  }, [
    initializeMedia,
    initiateCall,
    navigate,
    resetCallState,
    roomId,
    setInitialRemoteMediaStates,
    socket,
    stopMedia,
    user.id,
  ]);

  const remoteParticipants = Object.entries(remoteStreams);

  return (
    <div className="room-page">
      <RoomHeader roomId={roomId} />

      {mediaError ? <div className="banner banner-error">{mediaError}</div> : null}

      <div className="video-grid room-stage">
        <VideoTile
          stream={localStream}
          label="You"
          muted
          isMicOn={localMediaState.isMicOn}
          isCameraOn={localMediaState.isCameraOn}
        />

        {remoteParticipants.map(([participantId, stream]) => (
          <VideoTile
            key={participantId}
            stream={stream}
            label="Participant"
            isMicOn={remoteMediaStates[participantId]?.isMicOn ?? true}
            isCameraOn={remoteMediaStates[participantId]?.isCameraOn ?? true}
          />
        ))}

        {!remoteParticipants.length ? (
          <div className="glass-panel empty-state">Waiting for someone to join...</div>
        ) : null}
      </div>

      <CallControls
        isMicOn={localMediaState.isMicOn}
        isCameraOn={localMediaState.isCameraOn}
        onToggleAudio={() => toggleMedia('audio')}
        onToggleVideo={() => toggleMedia('video')}
        onEnd={() => navigate('/')}
      />
    </div>
  );
}
