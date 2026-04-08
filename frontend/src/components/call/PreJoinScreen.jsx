import { useState } from 'react';
import CallControls from './CallControls';
import VideoTile from './VideoTile';
import '../../styles/Auth.css';

export default function PreJoinScreen({
  localStream,
  localMediaState,
  toggleMedia,
  onJoin,
  mediaError
}) {
  const [isJoining, setIsJoining] = useState(false);

  const handleJoinClick = () => {
    setIsJoining(true);
    onJoin();
  };

  return (
    <div className="auth-container">
      <div className="glass-panel" style={{ padding: '2rem', width: '100%', maxWidth: '600px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Ready to Join?</h2>
        
        {mediaError && <div className="banner banner-error">{mediaError}</div>}
        
        <div style={{ backgroundColor: '#000', borderRadius: '12px', overflow: 'hidden', aspectRatio: '16/9', position: 'relative', width: '100%', margin: '0 auto 1.5rem' }}>
          {localStream && localMediaState.isCameraOn ? (
            <VideoTile
              stream={localStream}
              label="You"
              muted
              isMicOn={localMediaState.isMicOn}
              isCameraOn={localMediaState.isCameraOn}
            />
          ) : (
             <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
               {mediaError 
                 ? 'Camera/Mic unavailable' 
                 : (!localStream ? 'Loading preview...' : 'Turn on video to see preview')}
             </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <CallControls
            isMicOn={localMediaState.isMicOn}
            isCameraOn={localMediaState.isCameraOn}
            onToggleAudio={() => toggleMedia('audio')}
            onToggleVideo={() => toggleMedia('video')}
            floating={false}
          />
        </div>

        <button 
          className="btn btn-primary"
          style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}
          onClick={handleJoinClick}
          disabled={isJoining}
        >
          {isJoining ? 'Joining...' : 'Join Room'}
        </button>
      </div>
    </div>
  );
}
