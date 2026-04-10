import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { House, Shuffle } from 'lucide-react';
import ActionPanel from '../components/dashboard/ActionPanel';
import LiveStats from '../components/dashboard/LiveStats';
import MeetixHeader from '../components/common/MeetixHeader';
import '../styles/Dashboard.css';

export default function Dashboard() {
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState('');

  // No API call here — room is only created in MongoDB when the user
  // explicitly clicks "Join" on the PreJoin screen (lazy resource creation).
  const createRoom = () => navigate('/room/new');

  const joinRoom = (event) => {
    event.preventDefault();
    if (roomId.trim()) navigate(`/room/${roomId.trim()}`);
  };

  return (
    <div className="page-shell">
      <MeetixHeader actionLabel="Home" actionIcon={<House size={16} />} actionTo="/" />

      <div className="container" style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 1rem' }}>
        <LiveStats />
        
        <div className="dashboard-grid">
          <ActionPanel title="Private Rooms">
            <button className="btn btn-primary" onClick={createRoom}>
              Create New Room
            </button>

            <div className="section-divider" />

            <form onSubmit={joinRoom} className="room-form">
              <input
                type="text"
                className="input-field"
                placeholder="Enter Room Code"
                value={roomId}
                onChange={(event) => setRoomId(event.target.value)}
              />
              <button type="submit" className="btn btn-primary">
                Join
              </button>
            </form>
          </ActionPanel>

          <ActionPanel
            title="Random Video Chat"
            description="Meet random people globally for 1v1 video chats."
            centered
          >
            <button
              className="btn btn-primary"
              onClick={() => navigate('/random-match')}
              style={{ padding: '1rem 2rem', fontSize: '1.1rem', width: '100%', maxWidth: '360px' }}
            >
              <Shuffle /> Start Random Chat
            </button>
          </ActionPanel>
        </div>
      </div>
    </div>
  );
}
