import { useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SkipForward } from 'lucide-react';
import CallControls from '../components/call/CallControls';
import CallStatusPanel from '../components/call/CallStatusPanel';
import VideoTile from '../components/call/VideoTile';
import { SocketContext } from '../context/socket-context';
import { useWebRTC } from '../hooks/useWebRTC';

export default function MatchRoom() {
  const { socket } = useContext(SocketContext);
  const [status, setStatus] = useState('Joining queue...');
  const [activeRoomId, setActiveRoomId] = useState(null);
  const rematchTimerRef = useRef(null);
  const isSkippingRef = useRef(false);
  const navigate = useNavigate();

  const {
    localStream,
    remoteStreams,
    initializeMedia,
    stopMedia,
    initiateCall,
    toggleMedia,
    mediaError,
    qualityStats,
    localMediaState,
    remoteMediaStates,
    setInitialRemoteMediaStates,
    resetCallState,
  } = useWebRTC(socket, activeRoomId);

  const matchPartnerId = Object.keys(remoteStreams)[0];

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    const queueForAnotherMatch = (nextStatus) => {
      if (isSkippingRef.current) return;
      isSkippingRef.current = true;
      setStatus(nextStatus);
      setActiveRoomId(null);
      resetCallState();
      setInitialRemoteMediaStates({});
      socket.emit('skip-match');

      if (rematchTimerRef.current) {
        window.clearTimeout(rematchTimerRef.current);
      }

      rematchTimerRef.current = window.setTimeout(() => {
        socket.emit('join-random');
        isSkippingRef.current = false;
      }, 500);
    };

    const joinQueue = async () => {
      const stream = await initializeMedia();
      if (stream) {
        socket.emit('join-random');
      }
    };

    const handleWaitingMatch = () => {
      setStatus('Waiting for someone to join...');
    };

    const handleMatchFound = async ({
      roomId,
      partnerSocketId,
      partnerUserId,
      shouldInitiate,
      initialMediaStates,
    }) => {
      setActiveRoomId(roomId);
      setStatus('Connected!');
      setInitialRemoteMediaStates(initialMediaStates ?? {});

      if (shouldInitiate) {
        await initiateCall(partnerSocketId, partnerUserId);
      }
    };

    const handlePartnerSkipped = () => {
      queueForAnotherMatch('Partner skipped. Finding a new match...');
    };

    const handlePartnerDisconnected = () => {
      queueForAnotherMatch('Partner disconnected. Finding a new match...');
    };

    const handleSocketError = (payload) => {
      setStatus(payload?.message || 'Something went wrong');
    };

    joinQueue();
    socket.on('waiting-match', handleWaitingMatch);
    socket.on('match-found', handleMatchFound);
    socket.on('partner-skipped', handlePartnerSkipped);
    socket.on('partner-disconnected', handlePartnerDisconnected);
    socket.on('error', handleSocketError);

    return () => {
      if (rematchTimerRef.current) {
        window.clearTimeout(rematchTimerRef.current);
      }

      stopMedia();
      resetCallState();
      setActiveRoomId(null);
      socket.emit('skip-match');
      socket.off('waiting-match', handleWaitingMatch);
      socket.off('match-found', handleMatchFound);
      socket.off('partner-skipped', handlePartnerSkipped);
      socket.off('partner-disconnected', handlePartnerDisconnected);
      socket.off('error', handleSocketError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  const handleSkip = () => {
    if (!socket || isSkippingRef.current) {
      return;
    }

    isSkippingRef.current = true;
    setStatus('Skipping...');
    setActiveRoomId(null);
    resetCallState();
    setInitialRemoteMediaStates({});
    socket.emit('skip-match');

    if (rematchTimerRef.current) {
      window.clearTimeout(rematchTimerRef.current);
    }

    rematchTimerRef.current = window.setTimeout(() => {
      socket.emit('join-random');
      isSkippingRef.current = false;
    }, 500);
  };

  return (
    <div className="match-page">
      <CallStatusPanel
        title="Random Match"
        status={status}
        mediaError={mediaError}
        qualityStats={qualityStats}
      />

      <div className="match-stage">
        {matchPartnerId ? (
          <VideoTile
            stream={remoteStreams[matchPartnerId]}
            label="Partner"
            isMicOn={remoteMediaStates[matchPartnerId]?.isMicOn ?? true}
            isCameraOn={remoteMediaStates[matchPartnerId]?.isCameraOn ?? true}
            placeholderSize={64}
            className="match-stage-video"
          />
        ) : (
          <div className="match-loading">
            <div className="loader"></div>
          </div>
        )}

        <div className="pip-preview">
          <VideoTile
            stream={localStream}
            label="You"
            muted
            isMicOn={localMediaState.isMicOn}
            isCameraOn={localMediaState.isCameraOn}
            placeholderSize={32}
          />
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
        onEnd={() => navigate('/')}
      />
    </div>
  );
}
