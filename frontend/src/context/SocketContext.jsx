import { useContext, useEffect, useMemo } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../lib/config';
import { AuthContext } from './auth-context';
import { SocketContext } from './socket-context';

export const SocketProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const socket = useMemo(() => {
    if (!user) {
      return null;
    }

    return io(SOCKET_URL, {
      autoConnect: false,
      withCredentials: true,
      path: '/socket.io',
      transports: ['websocket'],
    });
  }, [user]);

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    const handleConnectError = () => {
      // Avoid noisy development warnings for expected short-lived connection attempts.
    };

    socket.on('connect_error', handleConnectError);
    socket.connect();

    return () => {
      socket.off('connect_error', handleConnectError);
      socket.disconnect();
    };
  }, [socket]);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
};
