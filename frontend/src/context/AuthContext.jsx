import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../lib/config';
import { AuthContext } from './auth-context';

export const AuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState({
    user: null,
    loading: true,
  });

  const { user, loading } = authState;

  useEffect(() => {
    let isActive = true;

    const validateSession = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Invalid session');
        }

        const data = await response.json();

        if (!isActive) {
          return;
        }

        if (data.user) {
          setAuthState({
            user: data.user,
            loading: false,
          });
          return;
        }

        setAuthState({ user: null, loading: false });
      } catch {
        if (isActive) {
          setAuthState({ user: null, loading: false });
        }
      }
    };

    validateSession();

    return () => {
      isActive = false;
    };
  }, []);

  const login = (userData) => {
    setAuthState({ user: userData, loading: false });
  };

  const logout = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Clear client auth state even if the network request fails.
    }

    setAuthState({ user: null, loading: false });
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
