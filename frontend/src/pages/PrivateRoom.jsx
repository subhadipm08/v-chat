import { useContext, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CallControls from '../components/call/CallControls';
import RoomHeader from '../components/call/RoomHeader';
import VideoTile from '../components/call/VideoTile';
import DraggableWrapper from '../components/call/DraggableWrapper';
import { SocketContext } from '../context/socket-context';
import { usePrivateRoomSession } from '../hooks/usePrivateRoomSession';
import PreJoinScreen from '../components/call/PreJoinScreen';
import { API_BASE_URL } from '../lib/config';
import '../styles/Room.css';
import '../styles/PrivateRoom.css';

export default function PrivateRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [isValidatingRoom, setIsValidatingRoom] = useState(true);
  const [roomError, setRoomError] = useState('');
  const { socket } = useContext(SocketContext);

  const {
    localStream,
    remoteStreams,
    toggleMedia,
    mediaError,
    localMediaState,
    remoteMediaStates,
    remoteUsernames,
    joinRoom,
    leaveRoom,
    hasJoined,
    sessionError
  } = usePrivateRoomSession(socket, roomId);

  const remoteParticipants = Object.entries(remoteStreams).slice(0, 3); // Max 3 remotes + 1 local = 4

  useEffect(() => {
    const checkRoomExists = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/rooms/verify/${roomId}`, {
          credentials: 'include'
        });
        if (!res.ok) {
          setRoomError(`Room with ID '${roomId}' does not exist.`);
          setTimeout(() => navigate('/dashboard'), 3000);
        }
    } catch {
      setRoomError('Unable to verify room.');
      setTimeout(() => navigate('/dashboard'), 3000);
      } finally {
        setIsValidatingRoom(false);
      }
    };
    checkRoomExists();
  }, [roomId, navigate]);

  if (roomError || sessionError) {
    return (
      <div className="room-page" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '1.5rem' }}>
        <div className="banner banner-error" style={{ fontSize: '1.2rem', padding: '1rem 2rem' }}>{roomError || sessionError}</div>
        <p style={{ color: 'var(--text-secondary)' }}>Redirecting to dashboard...</p>
      </div>
    );
  }

  if (!hasJoined) {
    if (isValidatingRoom) {
      return (
        <div className="room-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div className="loader"></div>
        </div>
      );
    }

    return (
      <PreJoinScreen
        localStream={localStream}
        localMediaState={localMediaState}
        toggleMedia={toggleMedia}
        onJoin={joinRoom}
        mediaError={mediaError}
      />
    );
  }

  return (
    <div className="room-page">
      <RoomHeader roomId={roomId} />

      {mediaError ? <div className="banner banner-error">{mediaError}</div> : null}

      <div className={`private-stage ${remoteParticipants.length === 0 ? 'empty-room' : ''}`}>

        {remoteParticipants.length > 0 && (
          <div className="remote-grid" data-remotes={remoteParticipants.length}>
            {remoteParticipants.map(([participantId, stream]) => (
              <VideoTile
                key={participantId}
                stream={stream}
                label={remoteUsernames[participantId] || "Participant"}
                isMicOn={remoteMediaStates[participantId]?.isMicOn ?? true}
                isCameraOn={remoteMediaStates[participantId]?.isCameraOn ?? true}
              />
            ))}
          </div>
        )}

        <DraggableWrapper
          className={remoteParticipants.length === 0 ? 'center-stage' : 'private-local-pip'}
          isDraggable={remoteParticipants.length > 0}
        >
          <VideoTile
            stream={localStream}
            label="You"
            muted
            isMicOn={localMediaState.isMicOn}
            isCameraOn={localMediaState.isCameraOn}
          />
        </DraggableWrapper>

      </div>

      <CallControls
        isMicOn={localMediaState.isMicOn}
        isCameraOn={localMediaState.isCameraOn}
        onToggleAudio={() => toggleMedia('audio')}
        onToggleVideo={() => toggleMedia('video')}
        onEnd={leaveRoom}
      />
    </div>
  );
}
