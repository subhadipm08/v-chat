import { useState, useContext, useEffect, useRef, useCallback } from 'react';
import { AuthContext } from '../context/auth-context';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../lib/config';
import { Video } from 'lucide-react';
import OtpInput from '../components/auth/OtpInput';
import '../styles/Auth.css';

const EMPTY_OTP = ['', '', '', '', '', ''];
const OTP_LIFETIME = 60; // seconds — must match backend TTL

// ─── Helper ────────────────────────────────────────────────────────────────
async function apiPost(path, body) {
  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
  } catch {
    // Pure network failure (no internet, server unreachable, CORS preflight blocked)
    throw new Error('Network error. Please check your connection and try again.');
  }

  let data;
  try {
    data = await res.json();
  } catch {
    // Server returned non-JSON (e.g. Nginx 502/504 HTML error page)
    throw new Error('Server is temporarily unavailable. Please try again in a moment.');
  }

  if (!res.ok) {
    throw Object.assign(
      new Error(data.error || 'Something went wrong'),
      { status: res.status, data }
    );
  }
  return data;
}

// ─── OTP Expiry + Resend countdown hook ────────────────────────────────────
// Returns: { otpSecsLeft, resendSecsLeft, isOtpExpired, restartTimers }
function useOtpTimers() {
  const [otpSecsLeft, setOtpSecsLeft] = useState(OTP_LIFETIME);
  const [resendSecsLeft, setResendSecsLeft] = useState(OTP_LIFETIME);
  const otpRef = useRef(null);
  const resendRef = useRef(null);

  const clearTimers = useCallback(() => {
    clearInterval(otpRef.current);
    clearInterval(resendRef.current);
  }, []);

  const startTimers = useCallback(() => {
    clearTimers();
    setOtpSecsLeft(OTP_LIFETIME);
    setResendSecsLeft(OTP_LIFETIME);

    otpRef.current = setInterval(() => {
      setOtpSecsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(otpRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    resendRef.current = setInterval(() => {
      setResendSecsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(resendRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearTimers]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      startTimers();
    }, 0);

    return () => {
      window.clearTimeout(timer);
      clearTimers();
    };
  }, [startTimers, clearTimers]);

  return {
    otpSecsLeft,
    resendSecsLeft,
    isOtpExpired: otpSecsLeft === 0,
    restartTimers: startTimers,
  };
}

// ─── Shared card wrapper ───────────────────────────────────────────────────
function AuthCard({ children }) {
  return (
    <div className="auth-container">
      <div className="glass-panel auth-card">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <h2 className="brand-logo">
            <span className="brand-logo-icon"><Video size={20} /></span> V-Chat
          </h2>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Step: Login ──────────────────────────────────────────────────────────
function LoginStep({ onSuccess, onForgot, onSignup }) {
  const [form, setForm]     = useState({ email: '', password: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const { login }  = useContext(AuthContext);
  const navigate   = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiPost('/api/auth/login', form);
      login(data.user);
      navigate('/');
    } catch (err) {
      if (err.status === 403 && err.data?.pendingVerification) {
        onSuccess({ email: form.email, step: 'verify-email' });
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard>
      <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>Welcome Back</h2>
      {error && <div className="banner banner-error">{error}</div>}
      <form onSubmit={handleSubmit} className="stack">
        <input className="input-field" type="email" placeholder="Email Address"
          value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
        <input className="input-field" type="password" placeholder="Password"
          value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
        <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }} disabled={loading}>
          {loading ? 'Logging in…' : 'Login'}
        </button>
      </form>
      <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.875rem' }}>
        <span style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={onForgot}>
          Forgot password?
        </span>
      </p>
      <p style={{ textAlign: 'center', marginTop: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
        Don't have an account?{' '}
        <span style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={onSignup}>Sign up</span>
      </p>
    </AuthCard>
  );
}

// ─── Step: Signup ──────────────────────────────────────────────────────────
function SignupStep({ onSuccess, onLogin }) {
  const [form, setForm]     = useState({ username: '', email: '', password: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiPost('/api/auth/signup', form);
      onSuccess({ email: form.email });
    } catch (err) {
      // If signup found a truly existing account → redirect to login
      if (err.status === 400 && err.message.includes('already exists')) {
        setError(err.message + ' Try logging in instead.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard>
      <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>Create Account</h2>
      {error && <div className="banner banner-error">{error}</div>}
      <form onSubmit={handleSubmit} className="stack">
        <input className="input-field" type="text" placeholder="Username"
          value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required />
        <input className="input-field" type="email" placeholder="Email Address"
          value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
        <input className="input-field" type="password" placeholder="Password (min 6 chars)"
          value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
        <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }} disabled={loading}>
          {loading ? 'Creating account…' : 'Sign Up'}
        </button>
      </form>
      <p style={{ textAlign: 'center', marginTop: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
        Already have an account?{' '}
        <span style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={onLogin}>Login</span>
      </p>
    </AuthCard>
  );
}

// ─── Step: Verify Email OTP ────────────────────────────────────────────────
function VerifyEmailStep({ email, onBack, onSessionExpired }) {
  const [otp, setOtp]         = useState([...EMPTY_OTP]);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const { login }  = useContext(AuthContext);
  const navigate   = useNavigate();

  const { otpSecsLeft, resendSecsLeft, isOtpExpired, restartTimers } = useOtpTimers();

  const handleVerify = async (e) => {
    e.preventDefault();
    if (isOtpExpired) return; // extra safety guard
    const code = otp.join('');
    if (code.length < 6) { setError('Please enter all 6 digits.'); return; }
    setError(''); setLoading(true);
    try {
      const data = await apiPost('/api/auth/verify-email', { email, otp: code });
      login(data.user);
      navigate('/');
    } catch (err) {
      // Session expired = pending signup data also gone from Redis
      if (err.message.includes('expired') && err.message.includes('sign up again')) {
        onSessionExpired();
        return;
      }
      setError(err.message);
      setOtp([...EMPTY_OTP]);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendSecsLeft > 0) return;
    setResendMsg(''); setError('');
    try {
      await apiPost('/api/auth/resend-otp', { email, type: 'verify' });
      setResendMsg('✅ A new OTP has been sent to your email.');
      setOtp([...EMPTY_OTP]);
      restartTimers(); // reset both OTP expiry AND resend cooldown
    } catch (err) {
      // If pending signup expired from Redis, guide user to re-register
      if (err.message.includes('No pending registration')) {
        onSessionExpired();
        return;
      }
      setError(err.message);
    }
  };

  return (
    <AuthCard>
      <button className="auth-back-link" onClick={onBack}>← Back</button>
      <h2 style={{ textAlign: 'center', marginBottom: '0.75rem' }}>Verify Email</h2>
      <p className="auth-step-hint">
        We sent a 6-digit OTP to<br /><strong>{email}</strong>
      </p>

      {/* Expiry countdown / status */}
      {!isOtpExpired ? (
        <div className="otp-timer-bar">
          <span className={`otp-timer-text ${otpSecsLeft <= 15 ? 'otp-timer-urgent' : ''}`}>
            ⏱ OTP expires in <strong>{otpSecsLeft}s</strong>
          </span>
        </div>
      ) : (
        <div className="banner banner-warning">
          ⏰ OTP has expired. Please request a new one below.
        </div>
      )}

      {error && <div className="banner banner-error">{error}</div>}
      {resendMsg && <div className="banner banner-success">{resendMsg}</div>}

      <form onSubmit={handleVerify} className="stack">
        <OtpInput
          value={otp}
          onChange={(i, v) => setOtp(prev => { const n = [...prev]; n[i] = v; return n; })}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading || isOtpExpired}
          style={{ marginTop: '0.5rem', opacity: isOtpExpired ? 0.5 : 1 }}
        >
          {loading ? 'Verifying…' : 'Verify & Login'}
        </button>
      </form>

      <div className="resend-row" style={{ marginTop: '1rem' }}>
        Didn't receive it?{' '}
        <button className="resend-btn" onClick={handleResend} disabled={resendSecsLeft > 0}>
          {resendSecsLeft > 0 ? `Resend in ${resendSecsLeft}s` : 'Resend OTP'}
        </button>
      </div>
    </AuthCard>
  );
}

// ─── Step: Session Expired (signup pending data gone) ─────────────────────
function SessionExpiredStep({ onSignupAgain, onLogin }) {
  return (
    <AuthCard>
      <h2 style={{ textAlign: 'center', marginBottom: '0.75rem' }}>Session Expired</h2>
      <p className="auth-step-hint">
        ⏰ Your registration session expired (10 minutes).<br />
        Please sign up again to receive a new OTP.
      </p>
      <div className="stack" style={{ marginTop: '0.5rem' }}>
        <button className="btn btn-primary" onClick={onSignupAgain}>Sign Up Again</button>
        <button
          className="btn"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}
          onClick={onLogin}
        >
          Back to Login
        </button>
      </div>
    </AuthCard>
  );
}

// ─── Step: Forgot Password (enter email) ──────────────────────────────────
function ForgotPasswordStep({ onSent, onBack }) {
  const [email, setEmail]   = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await apiPost('/api/auth/forgot-password', { email });
      onSent({ email });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard>
      <button className="auth-back-link" onClick={onBack}>← Back to Login</button>
      <h2 style={{ textAlign: 'center', marginBottom: '0.75rem' }}>Forgot Password</h2>
      <p className="auth-step-hint">Enter your account email. We'll send a reset OTP.</p>
      {error && <div className="banner banner-error">{error}</div>}
      <form onSubmit={handleSubmit} className="stack">
        <input className="input-field" type="email" placeholder="Email Address"
          value={email} onChange={e => setEmail(e.target.value)} required />
        <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: '0.5rem' }}>
          {loading ? 'Sending…' : 'Send OTP'}
        </button>
      </form>
    </AuthCard>
  );
}

// ─── Step: Reset Password (OTP + new password) ────────────────────────────
function ResetPasswordStep({ email, onBack, onDone }) {
  const [otp, setOtp]             = useState([...EMPTY_OTP]);
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm]     = useState('');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [resendMsg, setResendMsg] = useState('');

  const { otpSecsLeft, resendSecsLeft, isOtpExpired, restartTimers } = useOtpTimers();

  const handleResend = async () => {
    if (resendSecsLeft > 0) return;
    setResendMsg(''); setError('');
    try {
      await apiPost('/api/auth/resend-otp', { email, type: 'reset' });
      setResendMsg('✅ A new OTP has been sent to your email.');
      setOtp([...EMPTY_OTP]);
      restartTimers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isOtpExpired) return;
    const code = otp.join('');
    if (code.length < 6) { setError('Please enter all 6 OTP digits.'); return; }
    if (newPassword !== confirm) { setError('Passwords do not match.'); return; }
    if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setError(''); setLoading(true);
    try {
      await apiPost('/api/auth/reset-password', { email, otp: code, newPassword });
      onDone();
    } catch (err) {
      setError(err.message);
      setOtp([...EMPTY_OTP]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard>
      <button className="auth-back-link" onClick={onBack}>← Back</button>
      <h2 style={{ textAlign: 'center', marginBottom: '0.75rem' }}>Reset Password</h2>
      <p className="auth-step-hint">
        Enter the OTP sent to <strong>{email}</strong>, then choose a new password.
      </p>

      {/* Expiry countdown / status */}
      {!isOtpExpired ? (
        <div className="otp-timer-bar">
          <span className={`otp-timer-text ${otpSecsLeft <= 15 ? 'otp-timer-urgent' : ''}`}>
            ⏱ OTP expires in <strong>{otpSecsLeft}s</strong>
          </span>
        </div>
      ) : (
        <div className="banner banner-warning">
          ⏰ OTP has expired. Please request a new one below.
        </div>
      )}

      {error && <div className="banner banner-error">{error}</div>}
      {resendMsg && <div className="banner banner-success">{resendMsg}</div>}

      <form onSubmit={handleSubmit} className="stack">
        <OtpInput
          value={otp}
          onChange={(i, v) => setOtp(prev => { const n = [...prev]; n[i] = v; return n; })}
        />
        <input className="input-field" type="password" placeholder="New password (min 6 chars)"
          value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
        <input className="input-field" type="password" placeholder="Confirm new password"
          value={confirm} onChange={e => setConfirm(e.target.value)} required />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading || isOtpExpired}
          style={{ marginTop: '0.25rem', opacity: isOtpExpired ? 0.5 : 1 }}
        >
          {loading ? 'Resetting…' : 'Reset Password'}
        </button>
      </form>

      <div className="resend-row" style={{ marginTop: '1rem' }}>
        Didn't receive it?{' '}
        <button className="resend-btn" onClick={handleResend} disabled={resendSecsLeft > 0}>
          {resendSecsLeft > 0 ? `Resend in ${resendSecsLeft}s` : 'Resend OTP'}
        </button>
      </div>
    </AuthCard>
  );
}

// ─── Step: Password Reset Success ─────────────────────────────────────────
function ResetSuccessStep({ onLogin }) {
  return (
    <AuthCard>
      <h2 style={{ textAlign: 'center', marginBottom: '0.75rem' }}>Password Reset!</h2>
      <p className="auth-step-hint">
        ✅ Your password has been updated successfully.<br />
        You can now log in with your new password.
      </p>
      <button className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} onClick={onLogin}>
        Go to Login
      </button>
    </AuthCard>
  );
}

// ─── Root Auth Page ────────────────────────────────────────────────────────
export default function Auth() {
  const [step, setStep] = useState('login');
  const [ctx, setCtx]   = useState({ email: '' });

  const go = (newStep, extra = {}) => {
    setCtx(prev => ({ ...prev, ...extra }));
    setStep(newStep);
  };

  if (step === 'signup') {
    return <SignupStep
      onSuccess={({ email }) => go('verify-email', { email })}
      onLogin={() => setStep('login')}
    />;
  }

  if (step === 'verify-email') {
    return <VerifyEmailStep
      email={ctx.email}
      onBack={() => setStep('login')}
      onSessionExpired={() => setStep('session-expired')}
    />;
  }

  if (step === 'session-expired') {
    return <SessionExpiredStep
      onSignupAgain={() => setStep('signup')}
      onLogin={() => setStep('login')}
    />;
  }

  if (step === 'forgot-password') {
    return <ForgotPasswordStep
      onSent={({ email }) => go('reset-password', { email })}
      onBack={() => setStep('login')}
    />;
  }

  if (step === 'reset-password') {
    return <ResetPasswordStep
      email={ctx.email}
      onBack={() => setStep('forgot-password')}
      onDone={() => setStep('reset-success')}
    />;
  }

  if (step === 'reset-success') {
    return <ResetSuccessStep onLogin={() => setStep('login')} />;
  }

  return <LoginStep
    onSuccess={({ email, step: nextStep }) => go(nextStep, { email })}
    onForgot={() => setStep('forgot-password')}
    onSignup={() => setStep('signup')}
  />;
}
