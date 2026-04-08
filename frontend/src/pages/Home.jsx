import { Link, useNavigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../context/auth-context';
import { Video, Lock, Shield, Users, RefreshCw } from 'lucide-react';
import '../styles/Home.css';

export default function Home() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleCreateRoom = () => {
    if (user) navigate('/dashboard'); else navigate('/auth');
  };

  const handleRandomChat = () => {
    if (user) navigate('/random-match'); else navigate('/auth');
  };

  return (
    <div className="home-container">
      {/* Navbar */}
      <nav className="home-nav">
        <div className="brand-logo">
          <span className="brand-logo-icon"><Video size={20} /></span>
          <span>V-Chat</span>
        </div>
        <div className="nav-actions">
          {user ? (
            <Link to="/dashboard" className="btn-login">Dashboard</Link>
          ) : (
            <Link to="/auth" className="btn-login">Login</Link>
          )}
        </div>
      </nav>

      <main className="home-main">
        {/* Hero Section */}
        <section className="hero-section">
          <h1 className="hero-title">Meet Strangers. Talk Instantly.</h1>
          <p className="hero-subtitle">
            Real-time random video chat powered by WebRTC. No signup. No delay.
          </p>

          <div className="hero-cta">
            <button onClick={handleRandomChat} className="btn-primary-glow">
              <Video size={20} /> Start Chatting
            </button>
            <button onClick={handleCreateRoom} className="btn-secondary-dark">
              <Lock size={20} /> Create Private Room
            </button>
          </div>
        </section>

        {/* See How It Works / Mockup Frame */}
        <section className="how-it-works">
          <h2 className="section-title">See How It Works</h2>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
            <img 
              src="/hp-asset1.png" 
              alt="V-Chat Interface" 
              style={{ width: '100%', maxWidth: '800px', height: 'auto', borderRadius: '16px', display: 'block', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)' }} 
            />
          </div>
        </section>

        {/* Features Section */}
        <section className="features-section">
          <h2 className="section-title">Why Use V-Chat?</h2>
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
              <p className="feature-desc">Peer-to-peer encryption ensures your chats are private and latency is minimal.</p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="home-footer">
        <p>Built by Subhadip Mudi</p>
        <p style={{ marginTop: '0.5rem' }}>
          <a href="https://github.com/subhadipm08" target="_blank" rel="noreferrer">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display: 'inline', marginRight: '4px'}}><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path><path d="M9 18c-4.51 2-5-2-7-2"></path></svg>
            GitHub
          </a>
        </p>
        <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#475569' }}>
          © 2026 V-Chat. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
