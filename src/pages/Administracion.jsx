// Módulo de Administración: Resumen | Ahorro | Ganancias | Pagos | Activos
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/NavBar2";
import DashboardPanel from "../components/admin/DashboardPanel";
import AhorroPanel from "../components/admin/AhorroPanel";
import MovimientosPanel from "../components/admin/MovimientosPanel";
import ActivosPanel from "../components/admin/ActivosPanel";
import UsuariosPanel from "../components/admin/UsuariosPanel";
import TorneosPanel from "../components/admin/TorneosPanel";
import FinanzasPersonalesPanel from "../components/admin/FinanzasPersonalesPanel";
import { puedeGestionarUsuarios, esAdministrador } from "../utils/auth";
import "../styles/Administracion.css";

// Torneos lo ven administrador y colaborador (todos los que llegan a esta
// página; el vendedor ni siquiera puede entrar a Administración).
const TABS_BASE = [
  { id: "resumen", icono: "📊", label: "Resumen" },
  { id: "ahorro", icono: "🏦", label: "Ahorro" },
  { id: "ganancias", icono: "💰", label: "Ganancias" },
  { id: "pagos", icono: "🧾", label: "Pagos" },
  { id: "activos", icono: "🕹️", label: "Activos" },
  { id: "torneos", icono: "🏆", label: "Torneos" },
];

// Pestañas exclusivas del administrador (dueño): gestión de usuarios y su
// control de finanzas personales (entrada privada, aparte del negocio).
const TAB_USUARIOS = { id: "usuarios", icono: "👥", label: "Usuarios" };
const TAB_FINANZAS = { id: "finanzas", icono: "🔒", label: "Mis Finanzas" };

const Administracion = () => {
  const [vista, setVista] = useState("resumen");
  const [notificacion, setNotificacion] = useState(null);
  const toastTimer = useRef(null);
  const navigate = useNavigate();

  const gestionaUsuarios = puedeGestionarUsuarios();
  const esAdmin = esAdministrador();
  const tabs = [
    ...TABS_BASE,
    ...(gestionaUsuarios ? [TAB_USUARIOS] : []),
    ...(esAdmin ? [TAB_FINANZAS] : []),
  ];

  useEffect(() => {
    document.title = "Administración - Sala de Juegos Ruiz";
    if (!localStorage.getItem("token")) navigate("/login");
  }, [navigate]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem("token");
    return { headers: { Authorization: `Bearer ${token}` } };
  }, []);

  const mostrarNotif = useCallback((mensaje, tipo = "success") => {
    setNotificacion({ mensaje, tipo });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setNotificacion(null), 4000);
  }, []);

  // Manejo centralizado de errores: 401 → limpiar sesión y redirigir al login;
  // resto → toast con el message del backend (o mensaje genérico de conexión)
  const manejarError = useCallback(
    (error) => {
      if (error?.response?.status === 401) {
        localStorage.clear();
        sessionStorage.clear();
        navigate("/login");
        return;
      }
      mostrarNotif(
        error?.response?.data?.message || "Error de conexión, intenta nuevamente",
        "error",
      );
    },
    [navigate, mostrarNotif],
  );

  const propsComunes = { getAuthHeaders, mostrarNotif, manejarError };

  return (
    <div className="admin-container">
      <Navbar />

      <div className="admin-page-content">
        <div className="admin-page-header">
          <h2 className="admin-page-title">🏦 Administración</h2>
        </div>

        {/* Navegación interna del módulo */}
        <nav className="admin-tabs mb-4" aria-label="Secciones de administración">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`admin-tab ${vista === t.id ? "admin-tab--activo" : ""}`}
              onClick={() => setVista(t.id)}
              aria-current={vista === t.id ? "page" : undefined}
            >
              <span className="admin-tab__icono">{t.icono}</span>
              <span className="admin-tab__label">{t.label}</span>
            </button>
          ))}
        </nav>

        {vista === "resumen" && (
          <DashboardPanel
            getAuthHeaders={getAuthHeaders}
            manejarError={manejarError}
            irAVista={setVista}
          />
        )}
        {vista === "ahorro" && <AhorroPanel {...propsComunes} />}
        {vista === "ganancias" && <MovimientosPanel key="ganancias" tipo="ganancias" {...propsComunes} />}
        {vista === "pagos" && <MovimientosPanel key="pagos" tipo="pagos" {...propsComunes} />}
        {vista === "activos" && <ActivosPanel {...propsComunes} />}
        {vista === "torneos" && <TorneosPanel {...propsComunes} />}
        {vista === "usuarios" && gestionaUsuarios && <UsuariosPanel {...propsComunes} />}
        {vista === "finanzas" && esAdmin && <FinanzasPersonalesPanel {...propsComunes} />}
      </div>

      {/* Toast global */}
      {notificacion && (
        <div
          className={`admin-toast admin-toast--${notificacion.tipo}`}
          role="status"
          aria-live="polite"
        >
          {notificacion.tipo === "error" ? "❌" : notificacion.tipo === "warning" ? "⚠️" : "✅"}{" "}
          {notificacion.mensaje}
        </div>
      )}
    </div>
  );
};

export default Administracion;
