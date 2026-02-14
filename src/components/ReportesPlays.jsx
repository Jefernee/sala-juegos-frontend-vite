import React, { useState, useEffect } from "react";
import { Gamepad2, DollarSign, Clock, TrendingUp, Users } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL + "/api";

export default function ReportesPlays() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulando carga
    setTimeout(() => setLoading(false), 500);
  }, []);

  if (loading) {
    return (
      <div className="reportes-loading-screen-small">
        <div className="reportes-loading-content">
          <div className="reportes-loading-spinner"></div>
          <p className="reportes-loading-text">Cargando reportes de plays...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="reportes-plays-contenido">
      {/* Tarjetas de Resumen */}
      <div className="reportes-resumen-grid">
        <div className="reportes-tarjeta-resumen reporte-morado">
          <div className="reportes-tarjeta-header">
            <h3 className="reportes-tarjeta-label">Ingresos Hoy</h3>
            <DollarSign className="reportes-tarjeta-icon morado" size={24} />
          </div>
          <p className="reportes-tarjeta-valor">₡0</p>
          <p className="reportes-tarjeta-detalle">De sesiones de juego</p>
          <div className="reportes-tarjeta-emoji morado">🎮</div>
        </div>

        <div className="reportes-tarjeta-resumen reporte-azul">
          <div className="reportes-tarjeta-header">
            <h3 className="reportes-tarjeta-label">Plays del Mes</h3>
            <Gamepad2 className="reportes-tarjeta-icon azul" size={24} />
          </div>
          <p className="reportes-tarjeta-valor">0</p>
          <p className="reportes-tarjeta-detalle">Sesiones completadas</p>
          <div className="reportes-tarjeta-emoji azul">🕹️</div>
        </div>

        <div className="reportes-tarjeta-resumen reporte-verde">
          <div className="reportes-tarjeta-header">
            <h3 className="reportes-tarjeta-label">Horas Jugadas</h3>
            <Clock className="reportes-tarjeta-icon verde" size={24} />
          </div>
          <p className="reportes-tarjeta-valor">0</p>
          <p className="reportes-tarjeta-detalle">Este mes</p>
          <div className="reportes-tarjeta-emoji verde">⏱️</div>
        </div>

        <div className="reportes-tarjeta-resumen reporte-amarillo">
          <div className="reportes-tarjeta-header">
            <h3 className="reportes-tarjeta-label">Consolas Activas</h3>
            <TrendingUp className="reportes-tarjeta-icon amarillo" size={24} />
          </div>
          <p className="reportes-tarjeta-valor">0/0</p>
          <p className="reportes-tarjeta-detalle">En uso / Total</p>
          <div className="reportes-tarjeta-emoji amarillo">🎯</div>
        </div>
      </div>

      {/* Mensaje de Próximamente */}
      <div className="reportes-tarjeta-blanca reportes-proximamente">
        <div className="reportes-proximamente-icono">
          <Gamepad2 size={64} color="#6366f1" />
        </div>
        <h3 className="reportes-proximamente-titulo">
          Reportes de Plays en Desarrollo
        </h3>
        <p className="reportes-proximamente-texto">
          Esta sección mostrará estadísticas detalladas de las sesiones de juego,
          incluyendo:
        </p>
        <ul className="reportes-proximamente-lista">
          <li>🎮 Consolas más utilizadas (PS5, Xbox, etc.)</li>
          <li>💰 Ingresos por sesión y por día</li>
          <li>⏱️ Duración promedio de las sesiones</li>
          <li>📊 Horarios pico de uso</li>
          <li>👥 Número de jugadores por día</li>
          <li>🎯 Juegos más populares</li>
          <li>📈 Tendencias de uso semanal/mensual</li>
          <li>💳 Métodos de pago utilizados</li>
        </ul>
        <div className="reportes-proximamente-badge">
          <Clock size={16} />
          <span>Próximamente</span>
        </div>
      </div>
    </div>
  );
}