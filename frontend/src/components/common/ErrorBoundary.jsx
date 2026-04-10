import React from 'react';

/**
 * Global Error Boundary to catch render-cycle crashes in the frontend.
 * Provides a fallback UI with a recovery path (Reload).
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You could log the error to a service like Sentry or your own backend here
    console.error('Frontend Crash Caught by Boundary:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="auth-container">
          <div className="glass-panel" style={{ padding: '3rem', maxWidth: '500px', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
              Something went wrong
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: '1.6' }}>
              The application encountered an unexpected error. Don't worry, your session data is likely safe.
            </p>
            
            <div style={{ textAlign: 'left', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', marginBottom: '2rem', fontSize: '0.85rem', fontFamily: 'monospace', overflow: 'auto', maxHeight: '150px' }}>
              {this.state.error?.message || 'Unknown Error'}
            </div>

            <button 
              className="btn btn-primary" 
              style={{ width: '100%' }}
              onClick={this.handleReload}
            >
              Reload Application
            </button>
            <p style={{ marginTop: '1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              If the problem persists, please contact support.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
