import React from "react";
import Desempenho from '../assets/performance.png'

export default function CardDesempenho() {
    
    const style = {
        cardInfo: {
            width: '260px',
            height: '420px',
            border: 'solid 4px blue',
            margin: '0 5rem ',
            borderRadius: '10px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center'
        },
        icon: {
            width: '60px',
            margin: '15px'
        },
        title: {
            margin: '15px'
        },
        text: {
            margin: '15px'
        }
    }
    return (
        <div style={style.cardInfo}>
            <img src={Desempenho} alt="" style={style.icon}/>
            <h2 style={style.title}>ANÁLISE DE DESEMPENHO</h2>
            <p style={style.text}>Avalie a performance de suas campanhas, produtos ou serviços com insights profundos. Descubra o que funciona, o que precisa melhorar e otimize resultados com inteligência.
            </p>
        </div>
    )
}