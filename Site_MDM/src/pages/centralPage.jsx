import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from 'react-router-dom';
import style from '../styles/centralPage.module.css';
import logo from '../assets/Logo.png'

function CentralPage() {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  const handleSectionClick = (section) => {
    setActiveSection(section);
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
    // Adicione a lógica de logout aqui, como limpar tokens, etc.
    setShowMenu(false);  // Fecha o menu
    navigate('/');       // Redireciona para a tela inicial
  };

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className={style.container}>
      <div className={style.sideBar}>
      <img src={logo} alt="" className={style.logo}/>
        <div className={style.navLinks}>
          <span 
            className={style.navLinksSpan} 
            onClick={() => handleSectionClick('dashboard')}
          >
            DASHBOARD
          </span>
          <span 
            className={style.navLinksSpan} 
            onClick={() => handleSectionClick('analise')}
          >
            ANALISE DE SENTIMENTO
          </span>
          <span 
            className={style.navLinksSpan} 
            onClick={() => handleSectionClick('configuracoes')}
          >
            CONFIGURAÇÕES
          </span>
        </div>
      </div>
      <div className={style.mainPart}>
        <div className={style.plotContainer}>
          {activeSection === 'dashboard' && <div className={style.plotSection}></div>}
          {activeSection === 'analise' && <div className={style.plotSection2}></div>}
          {activeSection === 'configuracoes' && <div className={style.plotSection3}></div>}
        </div>
      </div>
      <span className={style.userIcon} onClick={toggleMenu}></span>
      {showMenu && (
        <div className={style.menu} ref={menuRef}>
          <p>Perfil</p>
          <p>Configurações</p>
          <p onClick={handleLogout}>Logout</p>
        </div>
      )}


      
    </div>
  );
}

export default CentralPage;














