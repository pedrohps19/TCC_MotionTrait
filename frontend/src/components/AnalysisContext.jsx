import { createContext, useState, useContext } from 'react';

const AnalysisContext = createContext();

export const AnalysisProvider = ({ children }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAnalysisNotification, setShowAnalysisNotification] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);

  return (
    <AnalysisContext.Provider value={{
      isAnalyzing,
      setIsAnalyzing,
      showAnalysisNotification,
      setShowAnalysisNotification,
      analysisError,
      setAnalysisError
    }}>
      {children}
    </AnalysisContext.Provider>
  );
};

export const useAnalysis = () => useContext(AnalysisContext);