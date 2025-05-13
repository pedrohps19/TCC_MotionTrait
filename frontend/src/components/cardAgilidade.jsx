import React from "react";
import Agilidade from '../assets/emocoes.png'

export default function CardAgilidade() {
    
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
            width: '75px',
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
            <img src={Agilidade} alt="" style={style.icon}/>
            <h2 style={style.title}>ANÁLISE DE SENTIMENTO</h2>
            <p style={style.text}>Identifique emoções e opiniões em tempo real. Saiba se seus clientes estão satisfeitos, insatisfeitos ou neutros e aja rapidamente para melhorar a experiência e fidelizar.
            </p>
        </div>
    )
}