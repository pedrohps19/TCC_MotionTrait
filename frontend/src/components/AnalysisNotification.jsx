import React, { useEffect } from 'react';
import style from '../styles/analysisNotification.module.css';
import { useAnalysis } from './AnalysisContext';

const AnalysisNotification = () => {
  const { 
    showAnalysisNotification, 
    setShowAnalysisNotification,
    analysisError
  } = useAnalysis();

  useEffect(() => {
    if (showAnalysisNotification) {
      const timer = setTimeout(() => {
        setShowAnalysisNotification(false);
      }, 5000); // Esconde após 5 segundos

      return () => clearTimeout(timer);
    }
  }, [showAnalysisNotification, setShowAnalysisNotification]);

  if (!showAnalysisNotification) return null;

  return (
    <div className={`${style.notification} ${analysisError ? style.error : style.success}`}>
      {analysisError ? (
        <p>Erro na análise: {analysisError}</p>
      ) : (
        <p>Análise concluída com sucesso!</p>
      )}
    </div>
  );
};

export default AnalysisNotification;