import React, { useState } from 'react';
import api from '../services/api';
import RedefinirSenha from './RedefinirSenha';
import '../styles/codigoVerificacao_style.css';

const CodigoVerificacao = () => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState({ email: '', code: '' });
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [isCodeConfirmed, setIsCodeConfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const validateFields = (fields) => {
    const newErrors = {};
    if (fields.email && !email) newErrors.email = 'O campo de e-mail é obrigatório.';
    if (fields.code && !code) newErrors.code = 'O código de verificação é obrigatório.';
    setErrors(prev => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  const handleSendEmail = async (e) => {
    e.preventDefault();
    setMessage('');
    if (!validateFields({ email: true })) return;

    setIsLoading(true);
    try {
      const response = await api.post('/api/send-verification', { email });
      setMessage('Código enviado com sucesso! Verifique seu email.');
      setShowCodeInput(true);
    } catch (error) {
      const errorData = error.response?.data;
      if (error.response?.status === 404) {
        setErrors({ email: errorData.message || 'Email não cadastrado' });
      } else {
        setMessage(errorData?.message || 'Erro ao enviar código. Tente novamente.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    if (!validateFields({ code: true })) return;

    try {
      await api.post('/api/verify-code', { email, code });
      setIsCodeConfirmed(true);
      setMessage('Código validado com sucesso!');
    } catch (error) {
      const errorData = error.response?.data;
      if (error.response?.status === 401) {
        setMessage(errorData.message || 'Código inválido ou expirado');
      } else {
        setMessage(errorData?.message || 'Erro na verificação do código');
      }
    }
  };

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    setErrors(prev => ({ ...prev, email: '' }));
  };

  const handleCodeChange = (e) => {
    setCode(e.target.value);
    setErrors(prev => ({ ...prev, code: '' }));
  };

  if (isCodeConfirmed) {
    return <RedefinirSenha email={email} />;
  }

  return (
    <div className="main-container">
      <div className="container-inputs">
        <h2 style={{ marginBottom: '30px' }}>Verificação de Código</h2>
        <form onSubmit={handleSendEmail} noValidate>
          <div className={`inputs-container_sendEmail ${errors.email ? 'error' : ''}`}>
            <input
              type="email"
              value={email}
              onChange={handleEmailChange}
              placeholder=" "
              disabled={isLoading}
            />
            <label>Digite seu e-mail:</label>
            {errors.email && <small className="error-message">{errors.email}</small>}
          </div>
          <button type="submit" className="cdg-btn" disabled={isLoading}>
            {isLoading ? 'Enviando...' : 'Enviar Código'}
          </button>
        </form>

        {showCodeInput && (
          <form onSubmit={handleVerifyCode} noValidate>
            <div className={`inputs-container_cod ${errors.code ? 'error' : ''}`}>
              <input
                type="text"
                value={code}
                onChange={handleCodeChange}
                placeholder=" "
                maxLength="6"
              />
              <label>Digite o código recebido:</label>
              {errors.code && <small className="error-message">{errors.code}</small>}
            </div>
            <button type="submit" className="cdg-btn cdg2-btn">
              Confirmar Código
            </button>
          </form>
        )}

        {message && <div className={`message ${message.includes('sucesso') ? 'success' : 'error'}`}>{message}</div>}
      </div>
    </div>
  );
};

export default CodigoVerificacao;