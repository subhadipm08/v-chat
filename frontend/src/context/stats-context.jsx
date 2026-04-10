import { createContext, useContext, useEffect, useState } from 'react';
import { SocketContext } from './socket-context';

const StatsContext = createContext();

export const useStats = () => {
  const context = useContext(StatsContext);
  if (!context) {
    throw new Error('useStats must be used within a StatsProvider');
  }
  return context;
};

export const StatsProvider = ({ children }) => {
  const { socket } = useContext(SocketContext);
  const [stats, setStats] = useState({ online: 0, waiting: 0, active: 0 });

  useEffect(() => {
    if (!socket) return;

    const handleStats = (data) => {
      setStats(data);
    };

    socket.on('stats', handleStats);

    return () => {
      socket.off('stats', handleStats);
    };
  }, [socket]);

  return (
    <StatsContext.Provider value={stats}>
      {children}
    </StatsContext.Provider>
  );
};
