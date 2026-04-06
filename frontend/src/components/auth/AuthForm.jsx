export default function AuthForm({
  isLogin,
  formData,
  error,
  onChange,
  onSubmit,
  onToggleMode,
}) {
  return (
    <div className="auth-container">
      <div className="glass-panel auth-card">
        <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>
          {isLogin ? 'Welcome Back' : 'Create Account'}
        </h2>

        {error ? <div className="banner banner-error">{error}</div> : null}

        <form onSubmit={onSubmit} className="stack">
          {!isLogin ? (
            <input
              type="text"
              className="input-field"
              placeholder="Username"
              value={formData.username}
              onChange={(event) => onChange('username', event.target.value)}
              required
            />
          ) : null}

          <input
            type="email"
            className="input-field"
            placeholder="Email Address"
            value={formData.email}
            onChange={(event) => onChange('email', event.target.value)}
            required
          />

          <input
            type="password"
            className="input-field"
            placeholder="Password"
            value={formData.password}
            onChange={(event) => onChange('password', event.target.value)}
            required
          />

          <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>
            {isLogin ? 'Login' : 'Sign Up'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-secondary)' }}>
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <span
            style={{ color: 'var(--accent)', cursor: 'pointer' }}
            onClick={onToggleMode}
          >
            {isLogin ? 'Sign up' : 'Login'}
          </span>
        </p>
      </div>
    </div>
  );
}
