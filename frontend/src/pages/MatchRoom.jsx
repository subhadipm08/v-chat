import { useContext, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { SkipForward, Smartphone, Monitor, Maximize } from 'lucide-react';
import CallControls from '../components/call/CallControls';
import CallStatusPanel from '../components/call/CallStatusPanel';
import VideoTile from '../components/call/VideoTile';
import DraggableWrapper from '../components/call/DraggableWrapper';
import PreJoinScreen from '../components/call/PreJoinScreen';
import MeetixHeader from '../components/common/MeetixHeader';
import { SocketContext } from '../context/socket-context';
import { useMatchmakingRoom } from '../hooks/useMatchmakingRoom';
import '../styles/Room.css';
import '../styles/MatchRoom.css';

export default function MatchRoom() {
  const { socket } = useContext(SocketContext);
  const navigate = useNavigate();
  const [remoteAspect, setRemoteAspect] = useState('full');
  const webrtc = useMatchmakingRoom(socket);
  const {
    localStream,
    remoteStreams,
    toggleMedia,
    mediaError,
    qualityStats,
    localMediaState,
    remoteMediaStates,
    status,
    joinQueue,
    leaveRoom,
    handleSkip,
    hasJoined,
    partnerUsername,
    stopMedia,
  } = webrtc;

  // Pure-frontend exit from PreJoin: stop camera/mic, go back. No backend calls.
  const exitPreJoin = useCallback(() => {
    stopMedia();
    navigate('/dashboard');
  }, [stopMedia, navigate]);

  const matchPartnerId = Object.keys(remoteStreams)[0];

  if (!hasJoined) {
    return (
      <PreJoinScreen
        localStream={localStream}
        localMediaState={localMediaState}
        toggleMedia={toggleMedia}
        onJoin={joinQueue}
        onExit={exitPreJoin}
        mediaError={mediaError}
      />
    );
  }

  return (
    <div className={`room-page match-page-context ${matchPartnerId ? 'is-connected' : 'is-waiting'}`}>
      <MeetixHeader actionLabel="Dashboard" actionTo="/dashboard" />
      <CallStatusPanel
        title="Random Match"
        status={matchPartnerId ? 'Connected' : status}
        mediaError={mediaError}
        qualityStats={qualityStats}
        className="match-header-context"
      />

      <div className={`match-root ${matchPartnerId ? 'connected' : 'waiting'}`}>
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

        <div className={`match-remote-container aspect-${remoteAspect}`}>
          {matchPartnerId ? (
            <VideoTile
              stream={remoteStreams[matchPartnerId]}
              label={partnerUsername || 'Stranger'}
              isMicOn={remoteMediaStates[matchPartnerId]?.isMicOn ?? true}
              isCameraOn={remoteMediaStates[matchPartnerId]?.isCameraOn ?? true}
            />
          ) : (
            <div className="match-loading-panel">
              <div className="loader"></div>
              <div style={{ color: 'var(--text-secondary)' }}>Finding a match...</div>
            </div>
          )}

          {webrtc.connectionStatus === 'failed' && (
            <div className="room-overlay connection-failure-overlay">
              <div className="glass-panel overlay-content">
                <div className="overlay-icon">📡</div>
                <h3>Connection Failed</h3>
                <p>We couldn't establish a secure connection. This usually happens due to restrictive network firewalls. Try switching to a different Wi-fi or using mobile data.</p>
                <div className="overlay-actions">
                  <button 
                    className="btn btn-primary" 
                    onClick={() => webrtc.retryCall(matchPartnerId, Object.values(webrtc.remoteUsernames)[0])}
                  >
                    Retry Connection
                  </button>
                  <button className="btn" onClick={handleSkip}>Skip to Next</button>
                  <button className="btn btn-danger" onClick={leaveRoom}>Go Back</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {matchPartnerId && (
          <div className="aspect-toggles glass-panel">
            <button onClick={() => setRemoteAspect('portrait')} className={remoteAspect === 'portrait' ? 'active' : ''} title="Portrait">
              <Smartphone size={16} />
            </button>
            <button onClick={() => setRemoteAspect('landscape')} className={remoteAspect === 'landscape' ? 'active' : ''} title="Landscape">
              <Monitor size={16} />
            </button>
            <button onClick={() => setRemoteAspect('full')} className={remoteAspect === 'full' ? 'active' : ''} title="Full Screen">
              <Maximize size={16} />
            </button>
          </div>
        )}

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
