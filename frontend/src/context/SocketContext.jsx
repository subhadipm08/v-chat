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
      transports: ['websocket'],
    });
  }, [user]);

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    socket.connect();

    return () => {
      socket.close();
    };
  }, [socket]);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
};
