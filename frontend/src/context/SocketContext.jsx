import { useContext, useEffect, useMemo } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../lib/config';
import { AuthContext } from './auth-context';
import { SocketContext } from './socket-context';
import { useNotifications } from './NotificationContext';

export const SocketProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const { showError, showInfo, showSuccess, removeNotification } = useNotifications();
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

    let reconnectToastId = null;

    const handleConnectError = (err) => {
      console.error('Socket connection error:', err);
    };

    const handleDisconnect = (reason) => {
      if (reason === 'io server disconnect' || reason === 'transport close') {
        showError('Connection lost. Attempting to reconnect...', null);
      }
    };

    const handleReconnectAttempt = () => {
      if (!reconnectToastId) {
        reconnectToastId = showInfo('Reconnecting to server...', Infinity);
      }
    };

    const handleReconnect = () => {
      if (reconnectToastId) {
        removeNotification(reconnectToastId);
        reconnectToastId = null;
      }
      showSuccess('Back online!');
    };

    const handleGenericError = ({ message, reference_id }) => {
      showError(message, reference_id);
    };

    socket.on('connect_error', handleConnectError);
    socket.on('disconnect', handleDisconnect);
    socket.on('reconnect_attempt', handleReconnectAttempt);
    socket.on('reconnect', handleReconnect);
    socket.on('error', handleGenericError);

    socket.connect();

    return () => {
      socket.off('connect_error', handleConnectError);
      socket.off('disconnect', handleDisconnect);
      socket.off('reconnect_attempt', handleReconnectAttempt);
      socket.off('reconnect', handleReconnect);
      socket.off('error', handleGenericError);
      socket.disconnect();
    };
  }, [socket, showError, showInfo, showSuccess, removeNotification]);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
};
