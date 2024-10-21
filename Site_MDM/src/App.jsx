import React from 'react';
import { BrowserRouter as Router, Route, Routes, useNavigate } from 'react-router-dom';
import Logo from './assets/Logo.png';
import './App.css';
import CardAcessivel from './components/cardAcessivel';
import CardDesempenho from './components/cardDesempenho';
import CardAgilidade from './components/cardAgilidade';
import CentralPage from './pages/CentralPage';
import ImgSection from './assets/section2.jpg'

const Home = () => {
  const navigate = useNavigate();

  const handleButtonClick = () => {
    navigate('/central');
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
            <li><a href="#ferramentas">FERRAMENSTAS</a></li>
            <li><a href="#precisao">PRECISÃO</a></li>
          </ul>
        </div>
        <nav>
          <button className='sng-in' onClick={handleButtonClick}>CADASTRAR-SE</button>
          <button className='lg-in' onClick={handleButtonClick}>ENTRAR</button>
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
            <h1>MOTION TRAIT</h1>
            <p>Lorem ipsum dolor sit amet consectetur, adipisicing elit. Perspiciatis architecto quam quas distinctio, repellat, fugiat quidem amet modi maiores dicta exercitationem voluptate velit ea odit animi inventore cupiditate qui molestias.</p>
          </div>
        </div>
      </section>
      <section className='cards-info' id='ferramentas'>
        <CardAcessivel className='card'/>
        <CardDesempenho className='card'/>
        <CardAgilidade className='card'/>
      </section>

      <section className='second-section' id='precisao'>
        <div className="img-secn-secton">
        </div>

        <div className='text-second-section'>
          <h2>ANÁLISES MAIS PRECISAS</h2>
          <p>Lorem ipsum dolor sit amet consectetur adipisicing elit. Architecto natus aliquid provident sint qui quidem omnis unde ad nesciunt animi ipsam laudantium assumenda reprehenderit, rerum impedit aliquam corrupti, velit maxime?</p>
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
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/central" element={<CentralPage />} />
      </Routes>
    </Router>
  );
}

export default App;
