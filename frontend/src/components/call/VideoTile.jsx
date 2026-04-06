import { MicOff, VideoOff } from 'lucide-react';
import { useEffect, useRef } from 'react';

export default function VideoTile({
  stream,
  label,
  muted = false,
  isMicOn = true,
  isCameraOn = true,
  placeholderSize = 48,
  className = '',
  style,
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream ?? null;
    }
  }, [stream]);

  return (
    <div className={`video-wrapper ${className}`.trim()} style={style}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className="video-element"
        style={{ opacity: isCameraOn ? 1 : 0 }}
      />

      {!isCameraOn ? (
        <div className="video-fallback">
          <VideoOff size={placeholderSize} color="rgba(255,255,255,0.2)" />
        </div>
      ) : null}

      {label ? (
        <div className="video-label">
          <span>{label}</span>
          {!isMicOn ? <MicOff size={14} color="var(--danger)" /> : null}
        </div>
      ) : null}
    </div>
  );
}
