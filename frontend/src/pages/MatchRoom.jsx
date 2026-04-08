import { useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SkipForward, Smartphone, Monitor, Maximize } from 'lucide-react';
import CallControls from '../components/call/CallControls';
import CallStatusPanel from '../components/call/CallStatusPanel';
import VideoTile from '../components/call/VideoTile';
import DraggableWrapper from '../components/call/DraggableWrapper';
import PreJoinScreen from '../components/call/PreJoinScreen';
import { SocketContext } from '../context/socket-context';
import { useMatchmakingRoom } from '../hooks/useMatchmakingRoom';
import '../styles/Room.css';
import '../styles/MatchRoom.css';

export default function MatchRoom() {
  const { socket } = useContext(SocketContext);
  const [remoteAspect, setRemoteAspect] = useState('full');
  const {
    localStream,
    remoteStreams,
    toggleMedia,
    mediaError,
    qualityStats,
    localMediaState,
    remoteMediaStates,
    status,
    activeRoomId,
    joinQueue,
    leaveRoom,
    handleSkip,
    hasJoined,
    partnerUsername,
    initializeMedia
  } = useMatchmakingRoom(socket);

  const matchPartnerId = Object.keys(remoteStreams)[0];
  const totalUsers = matchPartnerId ? 2 : 1;

  if (!hasJoined) {
    return (
      <PreJoinScreen
        localStream={localStream}
        localMediaState={localMediaState}
        toggleMedia={toggleMedia}
        onJoin={joinQueue}
        mediaError={mediaError}
      />
    );
  }



  return (
    <div className={`room-page match-page-context ${matchPartnerId ? 'is-connected' : 'is-waiting'}`}>
      <CallStatusPanel
        title="Random Match"
        status={matchPartnerId ? 'Connected ●' : 'Finding user...'}
        mediaError={mediaError}
        qualityStats={qualityStats}
        className="match-header-context"
      />

      <div className={`match-root ${matchPartnerId ? 'connected' : 'waiting'}`}>
        
        {/* Local Container (You) */}
        <DraggableWrapper 
          className="match-local-container"
          isDraggable={!!matchPartnerId}
        >
          <VideoTile
            stream={localStream}
            label="You"
            muted
            isMicOn={localMediaState.isMicOn}
            isCameraOn={localMediaState.isCameraOn}
          />
        </DraggableWrapper>

        {/* Remote Container (Stranger or Loader) */}
        <div className={`match-remote-container aspect-${remoteAspect}`}>
          {matchPartnerId ? (
            <VideoTile
              stream={remoteStreams[matchPartnerId]}
              label={partnerUsername || "Stranger"}
              isMicOn={remoteMediaStates[matchPartnerId]?.isMicOn ?? true}
              isCameraOn={remoteMediaStates[matchPartnerId]?.isCameraOn ?? true}
            />
          ) : (
            <div className="match-loading-panel">
              <div className="loader"></div>
              <div style={{ color: 'var(--text-secondary)' }}>Finding a match...</div>
            </div>
          )}
        </div>

        {/* Aspect Ratio Floating Controls (Only active when connected) */}
        {matchPartnerId && (
          <div className="aspect-toggles glass-panel">
            <button onClick={() => setRemoteAspect('portrait')} className={remoteAspect === 'portrait' ? 'active' : ''} title="Portrait"> <Smartphone size={16} /> </button>
            <button onClick={() => setRemoteAspect('landscape')} className={remoteAspect === 'landscape' ? 'active' : ''} title="Landscape"> <Monitor size={16} /> </button>
            <button onClick={() => setRemoteAspect('full')} className={remoteAspect === 'full' ? 'active' : ''} title="Full Screen"> <Maximize size={16} /> </button>
          </div>
        )}

        {/* Mobile Specific Overlay */}
        <div className="match-mobile-overlay">
           <div className="loader"></div>
           <div>Finding a match...</div>
        </div>
      </div>

      <CallControls
        isMicOn={localMediaState.isMicOn}
        isCameraOn={localMediaState.isCameraOn}
        onToggleAudio={() => toggleMedia('audio')}
        onToggleVideo={() => toggleMedia('video')}
        extraAction={{
          label: 'Skip',
          icon: <SkipForward />,
          onClick: handleSkip,
        }}
        onEnd={leaveRoom}
      />
    </div>
  );
}
