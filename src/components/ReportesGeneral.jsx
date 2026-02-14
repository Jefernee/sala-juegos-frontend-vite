import React, { useState, useEffect } from "react";
import { FileText, Database, TrendingUp, PieChart, Clock } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL + "/api";

export default function ReportesGeneral() {
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
          <p className="reportes-loading-text">Cargando reporte general...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="reportes-general-contenido">
      {/* Tarjetas de Resumen */}
      <div className="reportes-resumen-grid">
        <div className="reportes-tarjeta-resumen reporte-azul">
          <div className="reportes-tarjeta-header">
            <h3 className="reportes-tarjeta-label">Ingresos Totales</h3>
            <TrendingUp className="reportes-tarjeta-icon azul" size={24} />
          </div>
          <p className="reportes-tarjeta-valor">₡0</p>
          <p className="reportes-tarjeta-detalle">Ventas + Servicios</p>
          <div className="reportes-tarjeta-emoji azul">💎</div>
        </div>

        <div className="reportes-tarjeta-resumen reporte-morado">
          <div className="reportes-tarjeta-header">
            <h3 className="reportes-tarjeta-label">Registros Totales</h3>
            <Database className="reportes-tarjeta-icon morado" size={24} />
          </div>
          <p className="reportes-tarjeta-valor">0</p>
          <p className="reportes-tarjeta-detalle">En la base de datos</p>
          <div className="reportes-tarjeta-emoji morado">📚</div>
        </div>

        <div className="reportes-tarjeta-resumen reporte-verde">
          <div className="reportes-tarjeta-header">
            <h3 className="reportes-tarjeta-label">Crecimiento</h3>
            <PieChart className="reportes-tarjeta-icon verde" size={24} />
          </div>
          <p className="reportes-tarjeta-valor">0%</p>
          <p className="reportes-tarjeta-detalle">vs mes anterior</p>
          <div className="reportes-tarjeta-emoji verde">📈</div>
        </div>

        <div className="reportes-tarjeta-resumen reporte-amarillo">
          <div className="reportes-tarjeta-header">
            <h3 className="reportes-tarjeta-label">Eficiencia</h3>
            <FileText className="reportes-tarjeta-icon amarillo" size={24} />
          </div>
          <p className="reportes-tarjeta-valor">0%</p>
          <p className="reportes-tarjeta-detalle">Operativa general</p>
          <div className="reportes-tarjeta-emoji amarillo">⚡</div>
        </div>
      </div>

      {/* Mensaje de Próximamente */}
      <div className="reportes-tarjeta-blanca reportes-proximamente">
        <div className="reportes-proximamente-icono">
          <FileText size={64} color="#0ea5e9" />
        </div>
        <h3 className="reportes-proximamente-titulo">
          Reporte General del Negocio
        </h3>
        <p className="reportes-proximamente-texto">
          Este reporte consolidará todos los aspectos del negocio en un solo
          lugar, incluyendo:
        </p>
        <ul className="reportes-proximamente-lista">
          <li>🏪 Estado general de la sala de juegos</li>
          <li>💰 Resumen financiero completo</li>
          <li>📊 KPIs del negocio</li>
          <li>👥 Análisis de clientes</li>
          <li>📈 Proyecciones y tendencias</li>
          <li>🎯 Metas y objetivos</li>
          <li>📋 Inventario consolidado</li>
          <li>🎭 Resumen de obras y eventos</li>
        </ul>
        <div className="reportes-info-box">
          <h4>📌 Próximas Funcionalidades:</h4>
          <p>
            Este reporte se alimentará de una nueva colección en la base de
            datos que consolidará toda la información del negocio de forma
            oficial y estructurada.
          </p>
        </div>
        <div className="reportes-proximamente-badge">
          <Clock size={16} />
          <span>En Desarrollo</span>
        </div>
      </div>
    </div>
  );
}