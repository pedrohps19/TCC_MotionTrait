import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/cadastroPage_style.css';
import api from '../services/api';

const Cadastro = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    youtube_channel: '',
    password: '',
    confirmPassword: ''
  });
  
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const validateFields = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'O nome é obrigatório.';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'O email é obrigatório.';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Digite um email válido.';
    }

    if (!formData.youtube_channel.trim()) {
      newErrors.youtube_channel = 'O canal do YouTube é obrigatório.';
    }

    if (!formData.password.trim()) {
      newErrors.password = 'A senha é obrigatória.';
    } else if (formData.password.length < 6) {
      newErrors.password = 'A senha deve ter pelo menos 6 caracteres.';
    }

    if (!formData.confirmPassword.trim()) {
      newErrors.confirmPassword = 'A confirmação de senha é obrigatória.';
    } else if (formData.confirmPassword !== formData.password) {
      newErrors.confirmPassword = 'As senhas não coincidem.';
    }

    return newErrors;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validateFields();
    
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);
    setMessage('');

    try {
      const response = await api.post('/api/register', {
        name: formData.name,
        email: formData.email,
        youtube_channel: formData.youtube_channel,
        password: formData.password
      });

      setMessage('Cadastro realizado com sucesso! Redirecionando...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (error) {
      const errorData = error.response?.data;
      
      if (error.response?.status === 409) {
        setErrors({ email: errorData.message || 'Este email já está cadastrado.' });
      } else if (errorData?.errors) {
        const backendErrors = Object.entries(errorData.errors).reduce((acc, [field, msg]) => {
          acc[field] = typeof msg === 'string' ? msg : msg[0];
          return acc;
        }, {});
        setErrors(backendErrors);
      } else {
        setMessage(errorData?.message || 'Erro no servidor. Tente novamente mais tarde.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="main-container">
      <div className="cadastro-container">
        <h2>Criar conta</h2>
        
        <form onSubmit={handleSubmit} noValidate>
          <div className={`inputs-container_name ${errors.name ? 'error' : ''}`}>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder=" "
              disabled={isSubmitting}
            />
            <label>Nome:</label>
            {errors.name && <span className="error-message">{errors.name}</span>}
          </div>

          <div className={`inputs-container_email ${errors.email ? 'error' : ''}`}>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder=" "
              disabled={isSubmitting}
            />
            <label>Email:</label>
            {errors.email && <span className="error-message">{errors.email}</span>}
          </div>

          <div className={`inputs-container_channel ${errors.youtube_channel ? 'error' : ''}`}>
            <input
              type="text"
              name="youtube_channel"
              value={formData.youtube_channel}
              onChange={handleChange}
              placeholder=" "
              disabled={isSubmitting}
            />
            <label>Canal do YouTube:</label>
            {errors.youtube_channel && (
              <span className="error-message">{errors.youtube_channel}</span>
            )}
          </div>

          <div className={`inputs-container_pass ${errors.password ? 'error' : ''}`}>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder=" "
              disabled={isSubmitting}
            />
            <label>Senha:</label>
            {errors.password && <span className="error-message">{errors.password}</span>}
          </div>

          <div className={`inputs-container_pass ${errors.confirmPassword ? 'error' : ''}`}>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder=" "
              disabled={isSubmitting}
            />
            <label>Confirmar Senha:</label>
            {errors.confirmPassword && (
              <span className="error-message">{errors.confirmPassword}</span>
            )}
          </div>

          <button 
            type="submit" 
            className="btn-register"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Registrando...' : 'Registrar'}
          </button>
        </form>

        <div className={`msg-register ${message.includes('Erro') ? 'error' : 'success'}`}>
          {message && <span>{message}</span>}
        </div>
      </div>
    </div>
  );
};

export default Cadastro;