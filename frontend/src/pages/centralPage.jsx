import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from 'react-router-dom';
import style from '../styles/centralPage.module.css';
import logo from '../assets/Logo.png';
import Dashboard from "./dashboard";
import ComentariosSentimentos from "./videoCommentsAnalysis";
import { AnalysisProvider } from '../components/AnalysisContext';
import AnalysisNotification from '../components/AnalysisNotification';

function CentralPage() {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [showMenu, setShowMenu] = useState(false);
  const [userName, setUserName] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/');
    } else {
      const storedName = localStorage.getItem('nome');
      setUserName(storedName);
    }

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setDarkMode(true);
      document.documentElement.setAttribute('data-theme', 'dark');
    }

    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
 
      if (!mobile) {
        setSidebarOpen(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [navigate]);

  const handleSectionClick = (section) => {
    setActiveSection(section);
    if (isMobile) setSidebarOpen(false);
  };

  const toggleMenu = () => {
    setShowMenu(!showMenu);
  };

  const handleClickOutside = (event) => {
    if (menuRef.current && !menuRef.current.contains(event.target)) {
      setShowMenu(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('nome');
    localStorage.removeItem('theme');
    setShowMenu(false);
    navigate('/');
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    
    if (newDarkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.removeItem('theme');
    }
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <AnalysisProvider>
      <div className={style.container}>
        {/* Sidebar */}
        <div className={`${style.sideBar} ${sidebarOpen ? style.open : style.collapsed} ${isMobile ? style.mobile : ''}`}>
          <div className={style.logoContainer}>
            <img 
              src={logo} 
              alt="Logo" 
              className={style.logo}
            />
            <button 
              className={style.closeSidebar}
              onClick={toggleSidebar}
              aria-label="Fechar menu"
            >
              &times;
            </button>
          </div>
          
          <div className={style.navLinks}>
            <span 
              className={`${style.navLinksSpan} ${activeSection === 'dashboard' ? style.activeNavLink : ''}`}
              onClick={() => handleSectionClick('dashboard')}
            >
              <i className={`${style.icon} ${style.dashboardIcon}`}></i>
              DASHBOARD
            </span>
            <span 
              className={`${style.navLinksSpan} ${activeSection === 'analise' ? style.activeNavLink : ''}`}
              onClick={() => handleSectionClick('analise')}
            >
              <i className={`${style.icon} ${style.analysisIcon}`}></i>
              ANÁLISE DE SENTIMENTO
            </span>
            <span 
              className={`${style.navLinksSpan} ${activeSection === 'configuracoes' ? style.activeNavLink : ''}`}
              onClick={() => handleSectionClick('configuracoes')}
            >
              <i className={`${style.icon} ${style.settingsIcon}`}></i>
              CONFIGURAÇÕES
            </span>
          </div>
          
          <div className={style.sidebarFooter}>
            <div className={style.toggleContainer}>
              <span className={style.toggleLabel}>Modo Escuro</span>
              <label className={style.toggleSwitch}>
                <input 
                  type="checkbox" 
                  checked={darkMode} 
                  onChange={toggleDarkMode} 
                />
                <span className={style.toggleSlider}></span>
              </label>
            </div>
          </div>
        </div>

        {/* Container central */}
        <div className={`${style.mainPart} ${!sidebarOpen ? style.expanded : ''}`}>
          <div className={style.header}>
            <button 
              className={style.hamburgerButton}
              onClick={toggleSidebar}
              aria-label="Abrir menu"
            >
              <span className={style.hamburgerLine}></span>
              <span className={style.hamburgerLine}></span>
              <span className={style.hamburgerLine}></span>
            </button>
            
            <span className={style.wcmMsg}>
              {userName ? `Bem-vindo, ${userName.toUpperCase()}` : ''}
            </span>
            
            <div className={style.userControls}>
              <AnalysisNotification />
              <div className={style.userIcon} onClick={toggleMenu}>
                <div className={style.userInitial}>
                  {userName ? userName.charAt(0).toUpperCase() : ''}
                </div>
              </div>
            </div>
          </div>
          
          <div className={style.contentArea}>
            {activeSection === 'dashboard' && <Dashboard />}
            {activeSection === 'analise' && <ComentariosSentimentos />}
            
            {activeSection === 'configuracoes' && (
              <div className={style.settingsSection}>
                <h2>Configurações</h2>
                
                <div className={style.settingItem}>
                  <h3>Preferências de Tema</h3>
                  <div className={style.toggleContainer}>
                    <span className={style.toggleLabel}>Modo Escuro</span>
                    <label className={style.toggleSwitch}>
                      <input 
                        type="checkbox" 
                        checked={darkMode} 
                        onChange={toggleDarkMode} 
                      />
                      <span className={style.toggleSlider}></span>
                    </label>
                  </div>
                  <p className={style.settingDescription}>
                    Ative o modo escuro para reduzir o cansaço visual em ambientes com pouca luz.
                  </p>
                </div>

                <div className={style.settingItem}>
                  <h3>Conta</h3>
                  <button 
                    className={style.logoutButton}
                    onClick={handleLogout}
                  >
                    Sair da Conta
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Menu usuário */}
        {showMenu && (
          <div className={style.menu} ref={menuRef}>
            <p onClick={() => {
              handleSectionClick('configuracoes');
              setShowMenu(false);
            }}>Configurações</p>
            <p onClick={handleLogout}>Sair</p>
          </div>
        )}
      </div>
    </AnalysisProvider>
  );
}

export default CentralPage;