import { LogOut, User, Video } from 'lucide-react';

export default function DashboardHeader({ username, onLogout }) {
  return (
    <header className="page-header">
      <h2 className="brand-logo">
        <span className="brand-logo-icon"><Video size={20} /></span> V-Chat
      </h2>

      <div className="page-header-actions">
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
