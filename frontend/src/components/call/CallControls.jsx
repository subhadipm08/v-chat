import { Mic, MicOff, PhoneOff, Video, VideoOff } from 'lucide-react';

export default function CallControls({
  isMicOn,
  isCameraOn,
  onToggleAudio,
  onToggleVideo,
  onEnd,
  extraAction = null,
}) {
  return (
    <div className="main-actions glass-panel" style={{ padding: '1rem', borderRadius: '50px' }}>
      <button className={`btn ${!isMicOn ? 'btn-danger' : ''}`} onClick={onToggleAudio}>
        {isMicOn ? <Mic /> : <MicOff />}
      </button>

      <button className={`btn ${!isCameraOn ? 'btn-danger' : ''}`} onClick={onToggleVideo}>
        {isCameraOn ? <Video /> : <VideoOff />}
      </button>

      {extraAction ? (
        <button
          className={`btn ${extraAction.variant === 'danger' ? 'btn-danger' : 'btn-primary'}`}
          onClick={extraAction.onClick}
        >
          {extraAction.icon}
          {extraAction.label}
        </button>
      ) : null}

      <button className="btn btn-danger" onClick={onEnd}>
        <PhoneOff />
      </button>
    </div>
  );
}
