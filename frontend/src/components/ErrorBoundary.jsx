import { Component } from 'react';

/**
 * React Error Boundary — catches any unhandled JS error thrown inside
 * the component tree during render, lifecycle, or event handlers.
 *
 * Without this, a single component crash causes a blank white screen
 * in production with zero feedback to the user.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    // Update state so the next render shows the fallback UI.
    // Do NOT return error details — they may contain sensitive paths.
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Only log to console in development — never expose to production UI
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary] Caught error:', error, info.componentStack);
    }
  }

  handleReset = () => {
    // Try to recover by resetting error state first
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          textAlign: 'center',
          background: 'var(--bg-color, #0f172a)',
          color: 'var(--text-primary, #f8fafc)',
          gap: '1.5rem',
          fontFamily: "'Inter', system-ui, sans-serif",
        }}>
          {/* Icon */}
          <div style={{
            fontSize: '3rem',
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '50%',
            width: '80px',
            height: '80px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            ⚠️
          </div>

          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Something went wrong
            </h1>
            <p style={{ color: 'var(--text-secondary, #94a3b8)', maxWidth: '400px', lineHeight: 1.6 }}>
              An unexpected error occurred. Your session data is safe.
              You can try recovering the page or go back to the home screen.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={this.handleReset}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              Try Again
            </button>
            <button
              onClick={() => { window.location.href = '/'; }}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'rgba(255,255,255,0.07)',
                color: 'var(--text-secondary, #94a3b8)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              Go to Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
