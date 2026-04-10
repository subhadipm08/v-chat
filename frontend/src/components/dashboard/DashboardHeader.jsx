import { LogOut, User, Video, Circle } from 'lucide-react';
import { useStats } from '../../context/stats-context';

export default function DashboardHeader({ username, onLogout }) {
  const { online } = useStats();

  return (
    <header className="page-header">
      <h2 className="brand-logo">
        <span className="brand-logo-icon"><Video size={20} /></span> V-Chat
      </h2>

      <div className="page-header-actions">
        <div className="stats-badge" style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.5rem', 
          fontSize: '0.85rem', 
          color: '#10b981', 
          backgroundColor: '#10b98115', 
          padding: '0.4rem 0.8rem', 
          borderRadius: '20px',
          fontWeight: '600',
          marginRight: '0.5rem'
        }}>
          <Circle size={8} fill="#10b981" />
          {online} Live
        </div>
        
        <span className="user-chip">
          <User size={18} /> {username}
        </span>
        <button className="btn btn-danger" onClick={onLogout}>
          <LogOut size={16} /> Logout
        </button>
      </div>
    </header>
  );
}
