import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import '../styles/redefinirSenha_style.css';

const RedefinirSenha = ({ email }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const validateFields = () => {
    const newErrors = {};
    if (!password) newErrors.password = 'Senha obrigatória';
    else if (password.length < 6) newErrors.password = 'Mínimo 6 caracteres';
    
    if (!confirmPassword) newErrors.confirmPassword = 'Confirmação obrigatória';
    else if (password !== confirmPassword) newErrors.confirmPassword = 'Senhas não coincidem';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateFields()) return;

    setIsLoading(true);
    try {
      const response = await api.post('/api/reset-password', { 
        email,
        new_password: password
      });
      
      setMessage(response.data.message);
      setTimeout(() => navigate('/login'), 2000);
    } catch (error) {
      const errorData = error.response?.data;
      if (error.response?.status === 404) {
        setMessage('Usuário não encontrado');
      } else {
        setMessage(errorData?.message || 'Erro ao atualizar a senha');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="main-container">
      <div className='resetPass-container'>
        <h2>Redefinir Senha</h2>
        <form onSubmit={handleSubmit} noValidate>
          <div className={`input-container_newPass ${errors.password ? 'error' : ''}`}>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrors(prev => ({ ...prev, password: '' }));
              }}
              placeholder=" "
            />
            <label>Nova Senha:</label>
            {errors.password && <small className="error-message">{errors.password}</small>}
          </div>

          <div className={`input-container_confirmPass ${errors.confirmPassword ? 'error' : ''}`}>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setErrors(prev => ({ ...prev, confirmPassword: '' }));
              }}
              placeholder=" "
            />
            <label>Confirmar Senha:</label>
            {errors.confirmPassword && <small className="error-message">{errors.confirmPassword}</small>}
          </div>

          <button 
            type="submit" 
            className='newPass-btn'
            disabled={isLoading}
          >
            {isLoading ? 'Processando...' : 'Redefinir Senha'}
          </button>
        </form>

        {message && (
          <div className={`message ${message.includes('sucesso') ? 'success' : 'error'}`}>
            {message}
            {message.includes('sucesso') && (
              <button 
                onClick={() => navigate('/login')} 
                className='newPass-btn continue-btn'
              >
                Fazer Login
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RedefinirSenha;