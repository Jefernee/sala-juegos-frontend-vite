// Página pública (sin login) con la lista de torneos: /torneos
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import NavBar from "../components/NavBar";
import { API_URL, formatFecha, formatCRC } from "../components/admin/adminUtils";
import "../styles/TorneosPublic.css";

const formatCosto = (monto) => (Number(monto) > 0 ? formatCRC(monto) : "Gratis");

const TorneosPublic = () => {
  const [torneos, setTorneos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    document.title = "Torneos - Sala de Juegos Ruiz";
    let cancelado = false;
    (async () => {
      try {
        const res = await axios.get(`${API_URL}/api/torneos/public`);
        if (!cancelado) setTorneos(Array.isArray(res.data?.data) ? res.data.data : []);
      } catch {
        if (!cancelado) setError(true);
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, []);

  return (
    <div className="torneo-public">
      <NavBar />
      <div className="container py-4">
        <div className="torneo-public__volver">
          <Link to="/" className="btn btn-sm torneo-nav-btn">← Volver al inicio</Link>
        </div>
        <h2 className="torneo-public__titulo">🏆 Torneos y Competiciones</h2>

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Cargando...</span>
            </div>
          </div>
        ) : error ? (
          <div className="alert alert-danger">No se pudieron cargar los torneos. Intentá de nuevo.</div>
        ) : torneos.length === 0 ? (
          <div className="alert alert-info text-center">
            🎮 Por ahora no hay torneos publicados. ¡Volvé pronto!
          </div>
        ) : (
          <div className="row g-4">
            {torneos.map((t) => {
              const abierto = t.estado === "abierto";
              return (
                <div key={t._id} className="col-12 col-sm-6 col-lg-4">
                  <Link to={`/torneos/${t._id}`} className="torneo-card-link">
                    <div className="torneo-card">
                      <div className="afiche afiche--card">
                        {t.imagenUrl ? (
                          <>
                            <div
                              className="afiche__bg"
                              style={{ backgroundImage: `url(${t.imagenUrl})` }}
                            />
                            <img className="afiche__img" src={t.imagenUrl} alt={t.nombre} loading="lazy" />
                          </>
                        ) : (
                          <div className="afiche__placeholder">🏆</div>
                        )}
                      </div>
                      <div className="torneo-card__body">
                        <div className="d-flex align-items-start justify-content-between gap-2">
                          <h5 className="torneo-card__title">{t.nombre}</h5>
                          <span className={`torneo-badge ${abierto ? "torneo-badge--abierto" : "torneo-badge--cerrado"}`}>
                            {abierto ? "Abierto" : "Cerrado"}
                          </span>
                        </div>
                        <div className="torneo-pills">
                          <span className="torneo-pill">📅 {formatFecha(t.fecha)}</span>
                          <span className="torneo-pill">💰 {formatCosto(t.costoInscripcion)}</span>
                          <span className="torneo-pill">
                            👥 {t.cupoMaximo == null ? "Sin límite" : `${t.cupoDisponible} cupos`}
                          </span>
                        </div>
                        <span className="btn btn-primary w-100 mt-3">Ver e inscribirse →</span>
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TorneosPublic;
