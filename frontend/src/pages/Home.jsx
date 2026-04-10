import { useEffect, useMemo, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/auth-context';
import { LayoutDashboard, Video, Lock, Shield, Users, LogIn } from 'lucide-react';
import MeetixHeader from '../components/common/MeetixHeader';
import '../styles/Home.css';

export default function Home() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState('');
  const heroPhrases = useMemo(() => ['Meet People.', 'Talk Instantly.'], []);
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setHeroIndex((value) => (value + 1) % heroPhrases.length);
    }, 2200);

    return () => window.clearInterval(timer);
  }, [heroPhrases.length]);

  const handleCreateRoom = () => {
    navigate('/room/new');
  };

  const handleRandomChat = () => {
    if (user) navigate('/random-match');
    else navigate('/auth');
  };

  const handleJoinRoom = (event) => {
    event.preventDefault();

    const nextRoomId = roomId.trim();
    if (!nextRoomId) {
      return;
    }

    navigate(`/room/${nextRoomId}`);
  };

  return (
    <div className="home-container">
      <div className="home-nav-shell">
        <MeetixHeader
          actionLabel={user ? 'Dashboard' : 'Login'}
          actionIcon={user ? <LayoutDashboard size={16} /> : <LogIn size={16} />}
          actionTo={user ? '/dashboard' : '/auth'}
        />
      </div>

      <main className="home-main">
        <section className="hero-section">
          <h1 className="hero-title hero-title-loop" aria-live="polite">
            {heroPhrases.map((phrase, index) => (
              <span
                key={phrase}
                className={`hero-title-phrase ${index === heroIndex ? 'is-active' : ''}`}
                aria-hidden={index !== heroIndex}
              >
                {phrase}
              </span>
            ))}
          </h1>
          <p className="hero-subtitle">
            Real-time random video chat powered by WebRTC. Sign in to start instantly.
          </p>

          <div className="hero-actions">
            <div className="hero-cta">
              <button onClick={handleRandomChat} className="btn-primary-glow">
                <Video size={20} /> Join Random Chat
              </button>
              <button onClick={handleCreateRoom} className="btn-secondary-dark">
                <Lock size={20} /> Create Private Room
              </button>
            </div>

            <form className="room-join-card glass-panel" onSubmit={handleJoinRoom}>
              <div>
                <h3>Join Private Room</h3>
                <p>Enter a room ID to jump straight into a private call.</p>
              </div>
              <div className="room-join-form">
                <input
                  type="text"
                  className="input-field"
                  placeholder="Enter Room ID"
                  value={roomId}
                  onChange={(event) => setRoomId(event.target.value)}
                />
                <button type="submit" className="btn btn-primary">
                  Join Room
                </button>
              </div>
            </form>
          </div>
        </section>

        <section className="how-it-works">
          <h2 className="section-title">See How It Works</h2>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
            <img
              src="/hp-asset1.png"
              alt="Meetix Interface"
              style={{
                width: '100%',
                maxWidth: '800px',
                height: 'auto',
                borderRadius: '16px',
                display: 'block',
                boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.05)',
              }}
            />
          </div>
        </section>

        <section className="features-section">
          <h2 className="section-title">Why Use Meetix?</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon"><Lock size={36} /></div>
              <h3 className="feature-title">Instant Rooms</h3>
              <p className="feature-desc">Generate private room codes and share with friends. No downloads required.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><Users size={36} /></div>
              <h3 className="feature-title">Random Matching</h3>
              <p className="feature-desc">Match and talk to strangers instantly with a single click. Skip anytime.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><Shield size={36} /></div>
              <h3 className="feature-title">Secure & Fast</h3>
              <p className="feature-desc">Peer-to-peer encryption keeps your chats private with minimal latency.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <p>Built by Subhadip Mudi</p>
        <p style={{ marginTop: '0.5rem' }}>
          <a href="https://github.com/subhadipm08" target="_blank" rel="noreferrer">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', marginRight: '4px' }}>
              <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
              <path d="M9 18c-4.51 2-5-2-7-2" />
            </svg>
            GitHub
          </a>
        </p>
        <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#475569' }}>
          {'\u00A9'} 2026 Meetix. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
