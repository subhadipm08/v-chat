import { useContext, useEffect, useRef, useState } from 'react';
import { LogOut, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../../context/auth-context';
import MeetixBrand from './MeetixBrand';

export default function MeetixHeader({
  actionLabel,
  actionTo,
  actionIcon,
  actionClassName = 'meetix-header-action',
}) {
  const { user, logout } = useContext(AuthContext);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  return (
    <header className="meetix-header glass-panel">
      <MeetixBrand />

      <div className="meetix-header-right">
        {actionLabel && actionTo ? (
          <Link
            to={actionTo}
            className={`btn btn-secondary meetix-header-action ${actionClassName}`}
          >
            {actionIcon}
            <span>{actionLabel}</span>
          </Link>
        ) : null}

        {user ? (
          <div className="meetix-profile" ref={profileRef}>
            <button
              type="button"
              className="btn btn-secondary meetix-profile-toggle"
              aria-haspopup="menu"
              aria-expanded={profileOpen}
              aria-label={`Account menu for ${user.username}`}
              onClick={() => setProfileOpen((value) => !value)}
            >
              <User size={16} />
            </button>

            {profileOpen ? (
              <div className="meetix-profile-menu">
                <button
                  type="button"
                  className="meetix-profile-logout"
                  onClick={async () => {
                    setProfileOpen(false);
                    await logout();
                  }}
                >
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <Link to="/auth" className="btn btn-primary meetix-header-auth">
            Login
          </Link>
        )}
      </div>
    </header>
  );
}
