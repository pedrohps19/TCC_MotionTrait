import React from "react";
import Alvo from '../assets/precisao.png'

export default function CardAcessivel() {
    
    const style = {
        cardInfo: {
            width: '260px',
            height: '420px',
            margin: '0 5rem ',
            border: 'solid 4px blue',
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
            <img src={Alvo} alt="" style={style.icon}/>
            <h2 style={style.title}>PRECISÃO NOS DADOS</h2>
            <p style={style.text}>Lorem ipsum dolor sit amet consectetur adipisicing elit. Aspernatur alias eos veritatis quaerat ullam iste excepturi reprehenderit fugit facilis rerum repudiandae quisquam</p>
        </div>
    )
}