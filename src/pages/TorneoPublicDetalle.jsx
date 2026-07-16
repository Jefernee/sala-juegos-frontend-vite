// Página pública (sin login) de un torneo: /torneos/:id
// Coincide con el urlPublica que arma el backend. Muestra el torneo y el
// formulario de inscripción. Reemplaza el viejo flujo por correo (emailjs):
// ahora la inscripción se guarda con POST /api/torneos/:id/inscripciones.
import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import NavBar from "../components/NavBar";
import { API_URL, formatFecha, formatCRC } from "../components/admin/adminUtils";
import "../styles/TorneosPublic.css";

const FORM_VACIO = { nombre: "", telefono: "", correo: "", gamertag: "", nombreEquipo: "" };

const formatCosto = (monto) => (Number(monto) > 0 ? formatCRC(monto) : "Gratis");

const TorneoPublicDetalle = () => {
  const { id } = useParams();
  const [torneo, setTorneo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [noEncontrado, setNoEncontrado] = useState(false);

  const [form, setForm] = useState(FORM_VACIO);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null); // { tipo: "success"|"error", mensaje }
  const [inscrito, setInscrito] = useState(false);

  const fetchTorneo = useCallback(async () => {
    setLoading(true);
    setNoEncontrado(false);
    try {
      const res = await axios.get(`${API_URL}/api/torneos/public/${id}`);
      setTorneo(res.data?.data || null);
    } catch (err) {
      if (err?.response?.status === 404) setNoEncontrado(true);
      else setResultado({ tipo: "error", mensaje: "No se pudo cargar el torneo. Intentá de nuevo." });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    document.title = "Torneo - Sala de Juegos Ruiz";
    fetchTorneo();
  }, [fetchTorneo]);

  // Título de la pestaña según el torneo (los meta OG para compartir los pone
  // la Edge Function de Netlify; esto es solo para el navegador).
  useEffect(() => {
    if (torneo?.nombre) document.title = `${torneo.nombre} — Torneo · Sala de Juegos Ruiz`;
  }, [torneo]);

  const setField = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const abierto = torneo?.estado === "abierto";
  const lleno = torneo?.cupoDisponible === 0;
  const puedeInscribir = abierto && !lleno;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (enviando) return;
    if (!form.nombre.trim()) {
      setResultado({ tipo: "error", mensaje: "Tu nombre es obligatorio para inscribirte." });
      return;
    }
    setEnviando(true);
    setResultado(null);
    try {
      const payload = {
        nombre: form.nombre.trim(),
        ...(form.telefono.trim() && { telefono: form.telefono.trim() }),
        ...(form.correo.trim() && { correo: form.correo.trim() }),
        ...(form.gamertag.trim() && { gamertag: form.gamertag.trim() }),
        ...(form.nombreEquipo.trim() && { nombreEquipo: form.nombreEquipo.trim() }),
      };
      const res = await axios.post(`${API_URL}/api/torneos/${id}/inscripciones`, payload);
      setResultado({ tipo: "success", mensaje: res.data?.message || "¡Inscripción registrada!" });
      setForm(FORM_VACIO);
      setInscrito(true);
      fetchTorneo(); // refresca cupo disponible
    } catch (err) {
      // El backend manda el message a mostrar (cerrado, lleno, etc.)
      setResultado({
        tipo: "error",
        mensaje: err?.response?.data?.message || "No se pudo registrar la inscripción. Intentá de nuevo.",
      });
      // Si cambió el estado (cerró o se llenó), refrescamos para reflejarlo.
      if (err?.response?.status === 400) fetchTorneo();
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="torneo-public">
      <NavBar />
      <div className="container py-4">
        <div className="mb-3 d-flex gap-2 flex-wrap">
          <Link to="/" className="btn btn-sm torneo-nav-btn">← Inicio</Link>
          <Link to="/torneos" className="btn btn-sm torneo-nav-btn">🏆 Todos los torneos</Link>
        </div>
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Cargando...</span>
            </div>
          </div>
        ) : noEncontrado || !torneo ? (
          <div className="text-center py-5">
            <div style={{ fontSize: "3rem" }}>🏆</div>
            <h3 className="mt-3">Torneo no encontrado</h3>
            <p className="text-muted">Puede que el link sea incorrecto o que el torneo ya no exista.</p>
            <Link to="/torneos" className="btn btn-primary mt-2">Ver todos los torneos</Link>
          </div>
        ) : (
          <div className="row g-4 justify-content-center">
            <div className="col-lg-6">
              <div className="torneo-detalle-card">
                <div className="afiche afiche--hero">
                  {torneo.imagenUrl ? (
                    <>
                      <div className="afiche__bg" style={{ backgroundImage: `url(${torneo.imagenUrl})` }} />
                      <img className="afiche__img" src={torneo.imagenUrl} alt={torneo.nombre} />
                    </>
                  ) : (
                    <div className="afiche__placeholder">🏆</div>
                  )}
                </div>
                <div className="torneo-detalle-card__body">
                  <div className="d-flex align-items-start justify-content-between gap-2">
                    <h2 className="torneo-detalle-card__titulo">{torneo.nombre}</h2>
                    <span className={`torneo-badge ${abierto ? "torneo-badge--abierto" : "torneo-badge--cerrado"}`}>
                      {abierto ? "Abierto" : "Cerrado"}
                    </span>
                  </div>
                  {torneo.descripcion && <p className="torneo-detalle-desc">{torneo.descripcion}</p>}
                  <div className="torneo-pills">
                    <span className="torneo-pill">📅 {formatFecha(torneo.fecha)}</span>
                    <span className="torneo-pill">💰 {formatCosto(torneo.costoInscripcion)}</span>
                    <span className="torneo-pill">
                      👥 {torneo.cupoMaximo == null
                        ? "Cupos: sin límite"
                        : `${torneo.cupoDisponible} de ${torneo.cupoMaximo} cupos`}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-lg-6">
              <div className="torneo-detalle-card">
                <div className="torneo-detalle-card__body">
                  <h3 className="h5 mb-3">Inscribirse</h3>

                  {resultado && (
                    <div className={`alert ${resultado.tipo === "success" ? "alert-success" : "alert-danger"}`}>
                      {resultado.mensaje}
                    </div>
                  )}

                  {!puedeInscribir ? (
                    <div className="alert alert-warning mb-0">
                      {!abierto
                        ? "Las inscripciones para este torneo están cerradas."
                        : "El torneo ya alcanzó su cupo máximo."}
                    </div>
                  ) : inscrito ? (
                    <div className="text-center py-3">
                      <div style={{ fontSize: "2.5rem" }}>✅</div>
                      <p className="mb-3">¡Listo! Ya quedaste inscrito. Te contactaremos con los detalles.</p>
                      <button className="btn btn-outline-primary" onClick={() => setInscrito(false)}>
                        Inscribir a otra persona
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} noValidate>
                      <div className="mb-3">
                        <label className="form-label">Nombre *</label>
                        <input
                          type="text"
                          className="form-control"
                          value={form.nombre}
                          onChange={setField("nombre")}
                          disabled={enviando}
                          required
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Teléfono</label>
                        <input
                          type="tel"
                          className="form-control"
                          value={form.telefono}
                          onChange={setField("telefono")}
                          disabled={enviando}
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Correo electrónico</label>
                        <input
                          type="email"
                          className="form-control"
                          value={form.correo}
                          onChange={setField("correo")}
                          disabled={enviando}
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Gamertag</label>
                        <input
                          type="text"
                          className="form-control"
                          value={form.gamertag}
                          onChange={setField("gamertag")}
                          disabled={enviando}
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Nombre del equipo</label>
                        <input
                          type="text"
                          className="form-control"
                          value={form.nombreEquipo}
                          onChange={setField("nombreEquipo")}
                          disabled={enviando}
                        />
                      </div>
                      <button type="submit" className="btn btn-primary w-100" disabled={enviando}>
                        {enviando ? "Enviando..." : "Enviar inscripción"}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>

            <div className="col-12 text-center">
              <Link to="/torneos" className="btn btn-link">← Ver todos los torneos</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TorneoPublicDetalle;
