import React, { useState, useEffect, useCallback } from "react";
import Navbar from "../components/NavBar2";
import "../styles/Administracion.css";

const API_URL = import.meta.env.VITE_API_URL;

let axiosModule = null;
const getAxios = async () => {
  if (!axiosModule) axiosModule = await import("axios");
  return axiosModule.default;
};

const Administracion = () => {
  const [ahorro, setAhorro] = useState(null);
  const [monto, setMonto] = useState("");
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [notificacion, setNotificacion] = useState(null);

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem("token");
    return { headers: { Authorization: `Bearer ${token}` } };
  }, []);

  const mostrarNotif = (mensaje, tipo = "success") => {
    setNotificacion({ mensaje, tipo });
    setTimeout(() => setNotificacion(null), 4000);
  };

  const fetchAhorro = useCallback(async () => {
    setLoading(true);
    try {
      const axios = await getAxios();
      const response = await axios.get(
        `${API_URL}/api/ahorro`,
        getAuthHeaders(),
      );
      setAhorro(response.data.data);
    } catch (error) {
      mostrarNotif("Error al cargar el ahorro", "error");
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchAhorro();
    document.title = "Administración - Sala de Juegos Ruiz";
  }, [fetchAhorro]);

  const handleAgregar = async () => {
    if (!monto || Number(monto) <= 0) {
      mostrarNotif("Ingresa un monto válido mayor a 0", "warning");
      return;
    }

    setGuardando(true);
    try {
      const axios = await getAxios();
      await axios.post(
        `${API_URL}/api/ahorro`,
        { monto: Number(monto) },
        getAuthHeaders(),
      );
      setMonto("");
      mostrarNotif("Ahorro agregado exitosamente ✅");
      fetchAhorro();
    } catch (error) {
      mostrarNotif("Error al agregar el ahorro", "error");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="admin-container">
      <Navbar />

      <div className="container py-5">
        <h2 className="fw-bold mb-4">🏦 Administración</h2>

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-success" role="status" />
          </div>
        ) : (
          <>
            {/* Total acumulado */}
            <div className="card shadow-lg mb-4 border-0">
              <div
                className="card-body text-center py-5"
                style={{
                  background: "linear-gradient(135deg, #1a1a2e, #16213e)",
                  borderRadius: "12px",
                }}
              >
                <p className="text-white-50 mb-1 fs-5">Total Ahorrado</p>
                <h1
                  className="fw-bold mb-2"
                  style={{ fontSize: "3.5rem", color: "#4ade80" }}
                >
                  ₡{ahorro?.totalAcumulado?.toLocaleString() || "0"}
                </h1>
                {ahorro?.ultimaActualizacion && (
                  <small className="text-white-50">
                    Última actualización:{" "}
                    {new Date(ahorro.ultimaActualizacion).toLocaleDateString(
                      "es-CR",
                      {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        timeZone: "America/Costa_Rica",
                      },
                    )}
                  </small>
                )}
              </div>
            </div>

            {/* Agregar monto */}
            <div className="card shadow border-0 mb-4">
              <div className="card-body p-4">
                <h5 className="fw-bold mb-3">➕ Agregar Ahorro</h5>
                <div className="input-group input-group-lg">
                  <span className="input-group-text fw-bold">₡</span>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="Ingresa el monto"
                    value={monto}
                    min="1"
                    onChange={(e) => setMonto(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAgregar()}
                  />
                  <button
                    className="btn btn-success px-4 fw-bold"
                    onClick={handleAgregar}
                    disabled={guardando}
                  >
                    {guardando ? "Guardando..." : "Agregar"}
                  </button>
                </div>
                <small className="text-muted mt-2 d-block">
                  💡 También puedes presionar Enter para agregar
                </small>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Notificación */}
      {notificacion && (
        <div
          className={`position-fixed bottom-0 end-0 m-4 alert ${
            notificacion.tipo === "error"
              ? "alert-danger"
              : notificacion.tipo === "warning"
                ? "alert-warning"
                : "alert-success"
          } shadow-lg`}
          style={{ zIndex: 9999, minWidth: "300px" }}
        >
          {notificacion.tipo === "error"
            ? "❌"
            : notificacion.tipo === "warning"
              ? "⚠️"
              : "✅"}{" "}
          {notificacion.mensaje}
        </div>
      )}
    </div>
  );
};

export default Administracion;
