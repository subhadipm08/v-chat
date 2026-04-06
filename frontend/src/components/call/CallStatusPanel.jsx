export default function CallStatusPanel({ title, status, mediaError, qualityStats }) {
  return (
    <div className="call-status-panel">
      <h3>{title}</h3>
      <p>{status}</p>
      {mediaError ? <p className="status-error">Camera Error: {mediaError}</p> : null}
      {Number(qualityStats.packetLoss) > 0 ? (
        <p className="status-warning">Packet Loss: {qualityStats.packetLoss}%</p>
      ) : null}
    </div>
  );
}
