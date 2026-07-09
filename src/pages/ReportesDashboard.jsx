import React, { useState, lazy, Suspense } from "react";
import "../styles/ReportesDashboard.css";
import Navbar from "../components/NavBar2";
import { BarChart3, Gamepad2, Boxes, Scale } from "lucide-react";

// Lazy load de los componentes de reportes
const ReportesVentas  = lazy(() => import("../components/ReportesVentas"));
const ReportesPlays   = lazy(() => import("../components/ReportesPlays"));
const ReportesActivos = lazy(() => import("../components/ReportesActivos"));
const ReportesEstadoResultados = lazy(() => import("../components/ReportesEstadoResultados"));

// Lista escalable de reportes: para sumar uno nuevo basta con agregar un ítem
// (id, título, ícono, descripción, color y su componente). El layout no cambia.
const REPORTES = [
  {
    id: "ventas",
    titulo: "Reporte de Ventas",
    corto: "Ventas",
    icono: BarChart3,
    descripcion: "Análisis financiero de ventas",
    color: "verde",
    Componente: ReportesVentas,
  },
  {
    id: "plays",
    titulo: "Reporte de Plays",
    corto: "Plays",
    icono: Gamepad2,
    descripcion: "Sesiones de juego e ingresos",
    color: "morado",
    Componente: ReportesPlays,
  },
  {
    id: "activos",
    titulo: "Reporte de Activos",
    corto: "Activos",
    icono: Boxes,
    descripcion: "Inversión en equipo y reparaciones",
    color: "azul",
    Componente: ReportesActivos,
  },
  {
    id: "estado-resultados",
    titulo: "Estado de Resultados",
    corto: "Resultados",
    icono: Scale,
    descripcion: "Ingresos, egresos y utilidades del mes",
    color: "amarillo",
    Componente: ReportesEstadoResultados,
  },
];

export default function ReportesDashboard() {
  const [vistaActual, setVistaActual] = useState(REPORTES[0].id);

  const reporteActivo =
    REPORTES.find((r) => r.id === vistaActual) || REPORTES[0];
  const Contenido = reporteActivo.Componente;

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

        {/* Tabs compactos (mismo estilo que Administración) */}
        <nav className="reportes-tabs" aria-label="Tipos de reporte">
          {REPORTES.map((rep) => {
            const Icono = rep.icono;
            return (
              <button
                key={rep.id}
                className={`reportes-tab ${rep.color} ${vistaActual === rep.id ? "reportes-tab--activo" : ""}`}
                onClick={() => setVistaActual(rep.id)}
                aria-current={vistaActual === rep.id ? "page" : undefined}
              >
                <span className="reportes-tab__icono"><Icono size={18} /></span>
                <span className="reportes-tab__label">{rep.corto}</span>
              </button>
            );
          })}
        </nav>

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
            <Contenido />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
