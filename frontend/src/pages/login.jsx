import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import '../styles/loginPage_style.css';

const Login = ({ setAuth }) => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      navigate('/central');
    }
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (errors[name]) {
      setErrors({ ...errors, [name]: '' });
    }
  };

  const validateFields = () => {
    const validationErrors = {};
    if (!formData.email.trim()) {
      validationErrors.email = 'O email é obrigatório.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      validationErrors.email = 'Digite um email válido.';
    }
    if (!formData.password.trim()) {
      validationErrors.password = 'A senha é obrigatória.';
    }
    return validationErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validateFields();
    
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setIsLoading(true);
    setMessage('');

    try {
      const response = await api.post('/api/login', {
        email: formData.email,
        password: formData.password
      });

      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user_id', user.id);
      localStorage.setItem('user_name', user.name);
      localStorage.setItem('user_email', user.email);
      localStorage.setItem('youtube_channel', user.youtube_channel || '');

      api.defaults.headers.common['x-access-token'] = token;
      
      setAuth(true);
      setIsError(false);
      setMessage('Login realizado com sucesso!');
      navigate('/central');
    } catch (error) {
      const errorData = error.response?.data;
      
      if (error.response?.status === 401) {
        setErrors({ password: errorData.message || 'Credenciais inválidas' });
      } else if (error.response?.status === 404) {
        setErrors({ email: errorData.message || 'Usuário não encontrado' });
      } else {
        setIsError(true);
        setMessage(errorData?.message || 'Erro ao conectar com o servidor');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="main-container">
      <div className="login-container">
        <h2>Login</h2>
        <form onSubmit={handleSubmit} noValidate>
          <div className={`inputs-container_user ${errors.email ? 'error' : ''}`}>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder=" "
              disabled={isLoading}
            />
            <label>Email:</label>
            {errors.email && <span className="error-message">{errors.email}</span>}
          </div>
          
          <div className={`inputs-container_pass ${errors.password ? 'error' : ''}`}>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder=" "
              disabled={isLoading}
            />
            <label>Senha:</label>
            {errors.password && <span className="error-message">{errors.password}</span>}
          </div>
          
          <button 
            type="submit" 
            className="btn-entrar"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="loading-dots">Carregando</span>
            ) : 'Entrar'}
          </button>
        </form>

        <div className="forgot-password-link">
          <p><a href="/codigo-verificacao">Esqueci a senha</a></p>
        </div>

        <div className={`message ${isError ? 'error' : 'success'}`}>
          {message && <p>{message}</p>}
        </div>
      </div>
    </div>
  );
};

export default Login;