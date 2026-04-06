import { Copy } from 'lucide-react';

export default function RoomHeader({ roomId }) {
  const handleCopy = async () => {
    await navigator.clipboard.writeText(roomId);
  };

  return (
    <header className="room-header">
      <h3>
        Room:{' '}
        <button type="button" className="room-code-button" onClick={handleCopy}>
          {roomId} <Copy size={14} />
        </button>
      </h3>
    </header>
  );
}
