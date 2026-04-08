import { useState, useContext } from 'react';
import { AuthContext } from '../context/auth-context';
import { useNavigate } from 'react-router-dom';
import AuthForm from '../components/auth/AuthForm';
import { API_BASE_URL } from '../lib/config';
import '../styles/Auth.css';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const url = isLogin
      ? `${API_BASE_URL}/api/auth/login`
      : `${API_BASE_URL}/api/auth/signup`;
    
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });
      
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      
      login(data.user);
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleFieldChange = (field, value) => {
    setFormData((currentData) => ({
      ...currentData,
      [field]: value,
    }));
  };

  return (
    <AuthForm
      isLogin={isLogin}
      formData={formData}
      error={error}
      onChange={handleFieldChange}
      onSubmit={handleSubmit}
      onToggleMode={() => setIsLogin((currentMode) => !currentMode)}
    />
  );
}
