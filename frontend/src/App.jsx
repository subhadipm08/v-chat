import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { StatsProvider } from './context/stats-context';
import { NotificationProvider } from './context/NotificationContext';
import ErrorBoundary from './components/common/ErrorBoundary';
import { AuthContext } from './context/auth-context';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Home from './pages/Home';
import PrivateRoom from './pages/PrivateRoom';
import MatchRoom from './pages/MatchRoom';
import './index.css';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);
  if (loading) return <div className="auth-container"><h2>Loading...</h2></div>;
  if (!user) return <Navigate to="/auth" />;
  return children;
};

function App() {
  return (
    <ErrorBoundary>
      <NotificationProvider>
        <AuthProvider>
          <SocketProvider>
            <StatsProvider>
              <BrowserRouter>
                <Routes>
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/" element={<Home />} />
                  <Route path="/dashboard" element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  } />
                  <Route path="/room/:roomId" element={
                    <ProtectedRoute>
                      <PrivateRoom />
                    </ProtectedRoute>
                  } />
                  <Route path="/random-match" element={
                    <ProtectedRoute>
                      <MatchRoom />
                    </ProtectedRoute>
                  } />
                </Routes>
              </BrowserRouter>
            </StatsProvider>
          </SocketProvider>
        </AuthProvider>
      </NotificationProvider>
    </ErrorBoundary>
  );
}

export default App;
