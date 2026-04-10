import { useState } from 'react';
import CallControls from './CallControls';
import VideoTile from './VideoTile';
import '../../styles/Auth.css';

export default function PreJoinScreen({
  localStream,
  localMediaState,
  toggleMedia,
  onJoin,
  onExit,
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

        {onExit && (
          <button
            style={{
              width: '100%',
              marginTop: '0.75rem',
              padding: '0.75rem',
              fontSize: '0.95rem',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'var(--text-secondary)',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'border-color 0.2s, color 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.35)'; e.currentTarget.style.color = 'var(--text-primary, #fff)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            onClick={onExit}
            disabled={isJoining}
          >
            ← Back
          </button>
        )}
      </div>
    </div>
  );
}
