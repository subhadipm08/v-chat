import { useContext, useState } from 'react';
import { AuthContext } from '../context/auth-context';
import { useNavigate } from 'react-router-dom';
import { Shuffle } from 'lucide-react';
import { API_BASE_URL } from '../lib/config';
import DashboardHeader from '../components/dashboard/DashboardHeader';
import ActionPanel from '../components/dashboard/ActionPanel';
import '../styles/Dashboard.css';

export default function Dashboard() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState('');

  const createRoom = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/rooms/create`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      const data = await res.json();
      if(data.room) {
          navigate(`/room/${data.room.roomId}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const joinRoom = (e) => {
    e.preventDefault();
    if(roomId.trim()) navigate(`/room/${roomId.trim()}`);
  };

  return (
    <div className="page-shell">
      <DashboardHeader username={user.username} onLogout={logout} />

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
            style={{ padding: '1rem 2rem', fontSize: '1.2rem' }}
          >
            <Shuffle /> Start Random Chat
          </button>
        </ActionPanel>
      </div>
    </div>
  );
}
