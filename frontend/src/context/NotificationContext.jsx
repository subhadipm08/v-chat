import React, { createContext, useState, useContext, useCallback } from 'react';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  const addNotification = useCallback((notification) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newNotification = {
      id,
      type: 'info', // 'info', 'success', 'error', 'warning'
      message: '',
      duration: 5000,
      ...notification,
    };

    setNotifications((prev) => [...prev, newNotification]);

    if (newNotification.duration !== Infinity) {
      setTimeout(() => {
        removeNotification(id);
      }, newNotification.duration);
    }

    return id;
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((notification) => notification.id !== id));
  }, []);

  const showError = useCallback((message, reference_id = null) => {
    const fullMessage = reference_id 
      ? `${message} (Reference ID: ${reference_id})`
      : message;
      
    return addNotification({
      type: 'error',
      message: fullMessage,
      duration: 8000
    });
  }, [addNotification]);

  const showSuccess = useCallback((message) => {
    return addNotification({
      type: 'success',
      message,
      duration: 3000
    });
  }, [addNotification]);

  const showInfo = useCallback((message, duration = 5000) => {
    return addNotification({
      type: 'info',
      message,
      duration
    });
  }, [addNotification]);

  return (
    <NotificationContext.Provider value={{ addNotification, removeNotification, showError, showSuccess, showInfo }}>
      {children}
      <div className="notification-container">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`toast toast-${notification.type}`}
            onClick={() => removeNotification(notification.id)}
          >
            <div className="toast-content">
              {notification.message}
            </div>
            <button className="toast-close">&times;</button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};
