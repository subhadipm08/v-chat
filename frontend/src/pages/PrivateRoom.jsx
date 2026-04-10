import { useContext } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CallControls from '../components/call/CallControls';
import RoomHeader from '../components/call/RoomHeader';
import VideoTile from '../components/call/VideoTile';
import DraggableWrapper from '../components/call/DraggableWrapper';
import { SocketContext } from '../context/socket-context';
import { usePrivateRoomSession } from '../hooks/usePrivateRoomSession';
import PreJoinScreen from '../components/call/PreJoinScreen';
import '../styles/Room.css';
import '../styles/PrivateRoom.css';

export default function PrivateRoom() {
  const { roomId } = useParams();
  // 'new' → creator mode: room is created on Join click, not before.
  // ':id' → joiner mode: room is validated on Join click, not on mount.
  const isCreator = roomId === 'new';
  useNavigate(); // kept for hook usage inside usePrivateRoomSession
  const { socket } = useContext(SocketContext);

  const webrtc = usePrivateRoomSession(socket, roomId, isCreator);
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
    exitPreJoin,
    hasJoined,
    sessionError,
  } = webrtc;

  const remoteParticipants = Object.entries(remoteStreams).slice(0, 3);

  if (sessionError) {
    return (
      <div className="room-page" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '1.5rem' }}>
        <div className="banner banner-error" style={{ fontSize: '1.2rem', padding: '1rem 2rem' }}>{sessionError}</div>
        <p style={{ color: 'var(--text-secondary)' }}>Redirecting to dashboard...</p>
      </div>
    );
  }

  if (!hasJoined) {
    return (
      <PreJoinScreen
        localStream={localStream}
        localMediaState={localMediaState}
        toggleMedia={toggleMedia}
        onJoin={joinRoom}
        onExit={exitPreJoin}
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

        {webrtc.connectionStatus === 'failed' && (
          <div className="room-overlay connection-failure-overlay">
            <div className="glass-panel overlay-content">
              <div className="overlay-icon">📡</div>
              <h3>Connection Failed</h3>
              <p>We couldn't establish a secure connection. This usually happens due to restrictive network firewalls. Try switching to a different Wi-fi or using mobile data.</p>
              <div className="overlay-actions">
                <button 
                  className="btn btn-primary" 
                  onClick={() => window.location.reload()}
                >
                  Reload to Retry
                </button>
                <button className="btn btn-danger" onClick={leaveRoom}>Leave Room</button>
              </div>
            </div>
          </div>
        )}
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
