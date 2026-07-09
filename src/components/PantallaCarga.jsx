// src/components/PantallaCarga.jsx
// Pantalla de carga a pantalla completa con el tema de la sala de juegos.
// Se usa como fallback de las rutas lazy para que, mientras baja cada sección,
// se vea la misma animación bonita y nunca un "blanco + Cargando...".
import React from "react";

const PantallaCarga = () => (
  <div className="pc-wrap">
    <style>{`
      .pc-wrap {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 22px;
        background: radial-gradient(circle at 30% 20%, #1e3a8a 0%, #0f172a 55%, #020617 100%);
        font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      }
      .pc-icono {
        font-size: 68px;
        line-height: 1;
        filter: drop-shadow(0 8px 22px rgba(29, 78, 216, 0.55));
        animation: pc-bounce 1.4s ease-in-out infinite;
      }
      @keyframes pc-bounce {
        0%, 100% { transform: translateY(0) rotate(-4deg); }
        50%      { transform: translateY(-14px) rotate(4deg); }
      }
      .pc-titulo {
        margin: 0;
        font-size: 26px;
        font-weight: 800;
        text-align: center;
        background: linear-gradient(90deg, #60a5fa, #34d399, #fbbf24, #f472b6);
        background-size: 250% auto;
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        animation: pc-shine 3s linear infinite;
      }
      @keyframes pc-shine { to { background-position: 250% center; } }
      .pc-dots { display: flex; gap: 10px; }
      .pc-dots i {
        width: 11px; height: 11px; border-radius: 50%;
        animation: pc-dot 1.2s ease-in-out infinite;
      }
      .pc-dots i:nth-child(1) { background: #60a5fa; animation-delay: 0s;    }
      .pc-dots i:nth-child(2) { background: #34d399; animation-delay: 0.15s; }
      .pc-dots i:nth-child(3) { background: #fbbf24; animation-delay: 0.3s;  }
      .pc-dots i:nth-child(4) { background: #f472b6; animation-delay: 0.45s; }
      @keyframes pc-dot {
        0%, 100% { transform: scale(0.6); opacity: 0.4; }
        40%      { transform: scale(1);   opacity: 1;   }
      }
    `}</style>
    <div className="pc-icono">🎮</div>
    <h1 className="pc-titulo">Sala de Juegos Ruiz</h1>
    <div className="pc-dots"><i /><i /><i /><i /></div>
  </div>
);

export default PantallaCarga;
