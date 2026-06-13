import React, { useState, lazy, Suspense } from "react";
import "../styles/ReportesDashboard.css";
import Navbar from "../components/NavBar2";
import { BarChart3, Gamepad2, Boxes } from "lucide-react";

// Lazy load de los componentes de reportes
const ReportesVentas  = lazy(() => import("../components/ReportesVentas"));
const ReportesPlays   = lazy(() => import("../components/ReportesPlays"));
const ReportesActivos = lazy(() => import("../components/ReportesActivos"));

// Lista escalable de reportes: para sumar uno nuevo basta con agregar un ítem
// (id, título, ícono, descripción, color y su componente). El layout no cambia.
const REPORTES = [
  {
    id: "ventas",
    titulo: "Reporte de Ventas",
    icono: BarChart3,
    descripcion: "Análisis financiero de ventas",
    color: "verde",
    Componente: ReportesVentas,
  },
  {
    id: "plays",
    titulo: "Reporte de Plays",
    icono: Gamepad2,
    descripcion: "Sesiones de juego e ingresos",
    color: "morado",
    Componente: ReportesPlays,
  },
  {
    id: "activos",
    titulo: "Reporte de Activos",
    icono: Boxes,
    descripcion: "Inversión en equipo y reparaciones",
    color: "azul",
    Componente: ReportesActivos,
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

        {/* Grilla de botones (mismo estilo que Administración) */}
        <div className="reportes-nav-grid">
          {REPORTES.map((rep) => {
            const Icono = rep.icono;
            return (
              <button
                key={rep.id}
                className={`reportes-nav-card ${rep.color} ${vistaActual === rep.id ? "active" : ""}`}
                onClick={() => setVistaActual(rep.id)}
                aria-current={vistaActual === rep.id ? "page" : undefined}
              >
                <span className="reportes-nav-card__icono">
                  <Icono size={22} />
                </span>
                <span className="reportes-nav-card__texto">
                  <span className="reportes-nav-card__titulo">{rep.titulo}</span>
                  <span className="reportes-nav-card__desc">{rep.descripcion}</span>
                </span>
              </button>
            );
          })}
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
            <Contenido />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
