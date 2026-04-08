

export default function CallStatusPanel({ title, status, mediaError, qualityStats, className = '' }) {
  return (
    <header className={`room-header ${className}`} style={{ padding: '0 0 1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <span style={{ color: 'var(--text-secondary)' }}>|</span>
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{status}</p>
      </div>
      
      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
        {mediaError ? <span className="banner-error" style={{ padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.9rem' }}>Camera Error: {mediaError}</span> : null}
        {Number(qualityStats?.packetLoss) > 0 ? (
          <span className="status-warning" style={{ fontSize: '0.9rem' }}>Packet Loss: {qualityStats.packetLoss}%</span>
        ) : null}
      </div>
    </header>
  );
}
