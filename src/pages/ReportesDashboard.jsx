import React, { useState } from "react";
import "../styles/ReportesDashboard.css";
import Navbar from "../components/NavBar2";
import { BarChart3, Gamepad2, FileText, Zap } from "lucide-react";
import { lazy, Suspense } from "react";

// Lazy load de los componentes de reportes
const ReportesVentas = lazy(() => import("../components/ReportesVentas"));
const ReportesPlays = lazy(() => import("../components/ReportesPlays"));
const ReportesGeneral = lazy(() => import("../components/ReportesGeneral"));
const ReportesOptimizados = lazy(() => import("../components/ReportesOptimizados"));

export default function ReportesDashboard() {
  const [vistaActual, setVistaActual] = useState("ventas");

  const botones = [
    {
      id: "ventas",
      titulo: "Reportes de Ventas",
      icono: <BarChart3 size={24} />,
      descripcion: "Ventas, productos y pedidos",
      color: "verde",
    },
    {
      id: "plays",
      titulo: "Reportes de Plays",
      icono: <Gamepad2 size={24} />,
      descripcion: "Sesiones de juego e ingresos",
      color: "morado",
    },
    {
      id: "general",
      titulo: "Reporte General",
      icono: <FileText size={24} />,
      descripcion: "Resumen completo del negocio",
      color: "azul",
    },
    {
      id: "optimizado",
      titulo: "Reportes Optimizados",
      icono: <Zap size={24} />,
      descripcion: "⚡ PRUEBAS - DailyAggregate",
      color: "morado",
      badge: "BETA"
    },
  ];

  const renderContenido = () => {
    switch (vistaActual) {
      case "ventas":
        return <ReportesVentas />;
      case "plays":
        return <ReportesPlays />;
      case "general":
        return <ReportesGeneral />;
      case "optimizado":
        return <ReportesOptimizados />;
      default:
        return <ReportesVentas />;
    }
  };

  return (
    <div className="reportes-dashboard">
      <Navbar />

      <div className="reportes-container">
        {/* Header */}
        <div className="reportes-header">
          <h1 className="reportes-title">Reportes y Estadísticas</h1>
          <p className="reportes-subtitle">
            Selecciona el tipo de reporte que deseas consultar
          </p>
        </div>

        {/* Botones de Navegación */}
        <div className="reportes-nav-buttons">
          {botones.map((boton) => (
            <button
              key={boton.id}
              className={`reportes-nav-btn ${boton.color} ${
                vistaActual === boton.id ? "active" : ""
              }`}
              onClick={() => setVistaActual(boton.id)}
            >
              <div className="reportes-nav-btn-icon">{boton.icono}</div>
              <div className="reportes-nav-btn-content">
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <h3>{boton.titulo}</h3>
                  {boton.badge && (
                    <span style={{
                      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      color: "white",
                      padding: "2px 8px",
                      borderRadius: "12px",
                      fontSize: "11px",
                      fontWeight: "700",
                      letterSpacing: "0.5px"
                    }}>
                      {boton.badge}
                    </span>
                  )}
                </div>
                <p>{boton.descripcion}</p>
              </div>
              {vistaActual === boton.id && (
                <div className="reportes-nav-btn-indicator"></div>
              )}
            </button>
          ))}
        </div>

        {/* Contenido del Reporte Seleccionado */}
        <div className="reportes-contenido">
          <Suspense
            fallback={
              <div className="reportes-loading-screen">
                <div className="reportes-loading-content">
                  <div className="reportes-loading-spinner"></div>
                  <p className="reportes-loading-text">Cargando reporte...</p>
                </div>
              </div>
            }
          >
            {renderContenido()}
          </Suspense>
        </div>
      </div>
    </div>
  );
}