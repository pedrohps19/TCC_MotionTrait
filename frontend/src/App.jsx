import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import Logo from './assets/Logo.png';
import './App.css';
import CardAcessivel from './components/cardAcessivel';
import CardDesempenho from './components/cardDesempenho';
import CardAgilidade from './components/cardAgilidade';
import Login from './pages/login';
import Cadastro from './pages/cadastro';
import CentralPage from './pages/centralPage.jsx';
import CodigoVerificacao from './pages/codigoVerificacao'; 
import RedefinirSenha from './pages/RedefinirSenha'; 
// import ImgSection from './assets/section2.jpg';

const Home = () => {
  const [userName, setUserName] = useState(null); 
  const [menuVisible, setMenuVisible] = useState(false);
  const menuRef = useRef(null); 
  const navigate = useNavigate();

  
  useEffect(() => {
    const nome = localStorage.getItem('nome');
    if (nome) {
      setUserName(nome);
    }
  }, []);

  // Função de logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('nome');
    setUserName(null);
    setMenuVisible(false);
    navigate('/');
  };


  const toggleMenu = () => {
    setMenuVisible(!menuVisible);
  };

  const handleClickOutside = (event) => {
    if (menuRef.current && !menuRef.current.contains(event.target)) {
      setMenuVisible(false);
    }
  };

  useEffect(() => {
    if (menuVisible) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside); 
    };
  }, [menuVisible]);

  // Função para redirecionar para a CentralPage (Dashboard)
  const handleDashboardClick = () => {
    navigate('/central'); 
    setMenuVisible(false);
  };

  const handleButtonClick = (path) => {
    navigate(path);
  };

  return (
    <div className='container'>
      <header className='top-bar'>
        <div className="logo">
          <img src={Logo} alt="Logo do Site" />
        </div>
        <div className='links-nav'>
          <ul>
            <li><a href="#">INÍCIO</a></li>
            <li><a href="#ferramentas">FERRAMENTAS</a></li>
            <li><a href="#precisao">PRECISÃO</a></li>
          </ul>
        </div>
        <nav>
          {!userName ? (
            <>
              <button className='sng-in' onClick={() => handleButtonClick('/cadastro')}>CADASTRAR-SE</button>
              <button className='lg-in' onClick={() => handleButtonClick('/login')}>ENTRAR</button>
            </>
          ) : (
            <div className='user-info'>
              <span onClick={toggleMenu} style={{ cursor: 'pointer' }}>{userName.toUpperCase()}</span>
              {menuVisible && (
                <div className='dropdown-menu' ref={menuRef}>
                  <ul>
                    <li><a href="/perfil">Perfil</a></li>
                    <li><button onClick={handleDashboardClick}>Dashboard</button></li> {/* Novo item no menu */}
                    <li><button onClick={handleLogout}>Sair</button></li>
                  </ul>
                </div>
              )}
            </div>
          )}
        </nav>
      </header>
      <section className='first-section'>
        <div className="content-first-section">
          <div className="bns-model">
            <div className="span-animado">
              <span>M</span>
              <div className="borda top"></div>
              <div className="borda right"></div>
              <div className="borda bottom"></div>
              <div className="borda left"></div>
            </div>
          </div>
          <div className='bns-text'>
            <h1>BEM VINDO</h1>
            <p>Bem-vindo ao nosso site! Aqui, você encontra a solução ideal para entender o que seus clientes realmente pensam. Nosso analisador de sentimentos usa inteligência artificial para identificar emoções em textos, ajudando você a tomar decisões mais estratégicas, melhorar o atendimento e aumentar as vendas. Transforme feedbacks em oportunidades com agilidade e precisão. Experimente agora!</p>
          </div>
        </div>
      </section>
      <section className='cards-info' id='ferramentas'>
        <CardAcessivel className='card'/>
        <CardDesempenho className='card'/>
        <CardAgilidade className='card'/>
      </section>

      <section className='second-section' id='precisao'>
        <div className="img-secn-secton"></div>

        <div className='text-second-section'>
          <h2>ANÁLISES MAIS PRECISAS</h2>
          <p>Em um mercado competitivo, decisões baseadas em dados confiáveis fazem toda a diferença. Nossa solução de análise de sentimentos oferece alta precisão na interpretação de emoções, permitindo que você compreenda com clareza a percepção dos seus clientes. Com isso, é possível ajustar estratégias, melhorar produtos e otimizar campanhas com mais segurança e agilidade. Reduza erros, identifique padrões ocultos e aja com base em insights reais, não em suposições. Nossa tecnologia transforma feedbacks em oportunidades de crescimento, ajudando sua empresa a se destacar. Mais precisão nos dados, mais confiança nas suas decisões. Experimente o poder da análise inteligente.</p>
        </div>
      </section>

      <footer className='footer-part'>
        <div className='information'>
          <div className='more-info'>
            <img src={Logo} alt="" className='logo-footer'/>
            <ul>
              <li>Termos de Uso</li>
              <li>Política de Privacidade</li>
            </ul>
          </div>

          <div className='contact-info'>
            <span>Email para contato:</span>
            <span>motiontrait@gmail.com</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

function App() {
  const [auth, setAuth] = useState(false); 

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/central" element={<CentralPage />} />
        <Route path="/login" element={<Login setAuth={setAuth} />} /> {/* Passando setAuth como prop para Login */}
        <Route path="/cadastro" element={<Cadastro />} />
        <Route path="/codigo-verificacao" element={<CodigoVerificacao />} /> {/* Alterado para código-verificacao */}
        <Route path="/redefinir-senha" element={<RedefinirSenha />} /> {/* Alterado para redefinir-senha */}
      </Routes>
    </Router>
  );
}

export default App;
