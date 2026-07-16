// Módulo de Torneos/competiciones (Administración). Visible para administrador
// y colaborador (el vendedor no llega acá; el backend igual bloquea con 403).
// Gestiona torneos (crear/editar/eliminar, con afiche opcional en base64), copia
// el link público para compartir, y administra las inscripciones de cada torneo.
import { useState, useEffect, useCallback, useRef } from "react";
import ImageUploadWithCompression from "../ImageUploadWithCompression";
import {
  API_URL, getAxios, formatCRC, formatFecha, fechaParaInput, getLocalDateString,
} from "./adminUtils";
import { ModalOverlay, ConfirmarEliminar, EstadoVacio, ErrorRecarga, Cargando } from "./Comunes";

const ESTADO_OPCIONES = [
  { valor: "abierto", label: "🟢 Abierto (acepta inscripciones)" },
  { valor: "cerrado", label: "🔴 Cerrado" },
];

const ESTADO_CLASE = { abierto: "verde", cerrado: "rojo" };
const ESTADO_LABEL = { abierto: "🟢 Abierto", cerrado: "🔴 Cerrado" };

const getTorneoVacio = () => ({
  nombre: "",
  fecha: getLocalDateString(),
  descripcion: "",
  cupoMaximo: "",
  costoInscripcion: "",
  estado: "abierto",
});

const torneoDesde = (t) => ({
  nombre: t.nombre || "",
  fecha: fechaParaInput(t.fecha),
  descripcion: t.descripcion || "",
  cupoMaximo: t.cupoMaximo != null ? String(t.cupoMaximo) : "",
  costoInscripcion: t.costoInscripcion != null ? String(t.costoInscripcion) : "",
  estado: t.estado || "abierto",
});

// Costo con "Gratis" cuando es 0.
const formatCosto = (monto) => (Number(monto) > 0 ? formatCRC(monto) : "Gratis");

// "5/16" · "5 · sin límite"
const textoCupo = (t) =>
  t.cupoMaximo == null
    ? `${t.inscritosCount ?? 0} · sin límite`
    : `${t.inscritosCount ?? 0}/${t.cupoMaximo}`;

// ─── CAMPO DE AFICHE (imagen) ────────────────────────────────────────────────
const CampoAfiche = ({ urlActual, imagenData, quitar, onChange, onQuitar, onProcesando, uploadRef, disabled }) => {
  const [cambiando, setCambiando] = useState(!urlActual);

  const quitarNueva = () => {
    uploadRef.current?.reset();
    onChange(null);
  };

  if (quitar) {
    return (
      <div>
        <label className="admin-label">🖼️ Afiche del torneo</label>
        <div className="aviso-quitar fade-in">
          <p className="mb-2">🗑️ El afiche se eliminará al guardar.</p>
          <button type="button" className="admin-btn-ghost" onClick={() => onQuitar(false)} disabled={disabled}>
            ↩ Deshacer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="admin-label">🖼️ Afiche del torneo (opcional)</label>
      {!cambiando && urlActual ? (
        <div className="imagen-actual">
          <img src={urlActual} alt="Afiche del torneo" className="imagen-actual__img" />
          <div className="d-flex gap-2 mt-2 flex-wrap">
            <button type="button" className="admin-btn-ghost" onClick={() => setCambiando(true)} disabled={disabled}>
              🔄 Cambiar afiche
            </button>
            <button
              type="button"
              className="admin-btn-ghost admin-btn-ghost--rojo"
              onClick={() => onQuitar(true)}
              disabled={disabled}
            >
              🗑️ Quitar afiche
            </button>
          </div>
        </div>
      ) : (
        <>
          <ImageUploadWithCompression
            ref={uploadRef}
            onChange={onChange}
            onProcessingChange={onProcesando}
            showPreview
            alwaysCompress
            maxWidthOrHeight={1200}
            disabled={disabled}
          />
          <div className="d-flex gap-2 mt-2 flex-wrap">
            {imagenData && (
              <button type="button" className="admin-btn-ghost" onClick={quitarNueva} disabled={disabled}>
                ✕ Quitar imagen seleccionada
              </button>
            )}
            {urlActual && (
              <button
                type="button"
                className="admin-btn-ghost"
                onClick={() => { quitarNueva(); setCambiando(false); }}
                disabled={disabled}
              >
                ↩ Mantener afiche actual
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// ─── MODAL CREAR / EDITAR TORNEO ────────────────────────────────────────────
const TorneoFormModal = ({ torneo, getAuthHeaders, mostrarNotif, manejarError, onCerrar, onExito }) => {
  const esEdicion = !!torneo;
  const [form, setForm] = useState(() => (esEdicion ? torneoDesde(torneo) : getTorneoVacio()));
  const [errores, setErrores] = useState({});
  const [imagenData, setImagenData] = useState(null);
  const [quitarImagen, setQuitarImagen] = useState(false);
  const [procesandoImg, setProcesandoImg] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const imageRef = useRef(null);

  const setField = (field) => (e) => {
    const valor = e.target.value;
    setForm((f) => ({ ...f, [field]: valor }));
    setErrores((er) => ({ ...er, [field]: "" }));
  };

  const validar = () => {
    const e = {};
    if (!form.nombre.trim()) e.nombre = "El nombre es obligatorio";
    if (!form.fecha) e.fecha = "La fecha es obligatoria";
    if (form.cupoMaximo !== "" && (!Number.isInteger(Number(form.cupoMaximo)) || Number(form.cupoMaximo) < 1)) {
      e.cupoMaximo = "Dejalo vacío (sin límite) o poné un número entero mayor a 0";
    }
    if (form.costoInscripcion !== "" && Number(form.costoInscripcion) < 0) {
      e.costoInscripcion = "No puede ser negativo";
    }
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const camposImagen = () =>
    imagenData?.base64
      ? {
          imagenBase64: imagenData.base64,
          imagenNombre: imagenData.file.name,
          imagenMimeType: imagenData.file.type,
        }
      : {};

  const construirPayload = () => {
    if (!esEdicion) {
      return {
        nombre: form.nombre.trim(),
        fecha: form.fecha,
        ...(form.descripcion.trim() && { descripcion: form.descripcion.trim() }),
        cupoMaximo: form.cupoMaximo === "" ? null : Number(form.cupoMaximo),
        costoInscripcion: form.costoInscripcion === "" ? 0 : Number(form.costoInscripcion),
        estado: form.estado,
        ...camposImagen(),
      };
    }
    // Edición: solo lo que cambió
    const payload = { ...camposImagen() };
    const original = torneoDesde(torneo);
    if (form.nombre.trim() !== original.nombre) payload.nombre = form.nombre.trim();
    if (form.fecha !== original.fecha) payload.fecha = form.fecha;
    if (form.descripcion.trim() !== original.descripcion) payload.descripcion = form.descripcion.trim();
    if (form.estado !== original.estado) payload.estado = form.estado;
    if (form.cupoMaximo !== original.cupoMaximo) {
      payload.cupoMaximo = form.cupoMaximo === "" ? null : Number(form.cupoMaximo);
    }
    if (form.costoInscripcion !== original.costoInscripcion) {
      payload.costoInscripcion = form.costoInscripcion === "" ? 0 : Number(form.costoInscripcion);
    }
    if (quitarImagen && !imagenData) payload.eliminarImagen = true;
    return payload;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!validar() || guardando) return;
    if (procesandoImg) {
      mostrarNotif("Esperá a que termine de cargar el afiche antes de guardar", "warning");
      return;
    }
    const payload = construirPayload();
    if (esEdicion && Object.keys(payload).length === 0) {
      mostrarNotif("No hay cambios para guardar", "warning");
      return;
    }
    setGuardando(true);
    try {
      const axios = await getAxios();
      const res = esEdicion
        ? await axios.put(`${API_URL}/api/torneos/${torneo._id}`, payload, getAuthHeaders())
        : await axios.post(`${API_URL}/api/torneos`, payload, getAuthHeaders());
      mostrarNotif(res.data?.message || (esEdicion ? "Torneo actualizado" : "Torneo creado"));
      onExito();
    } catch (err) {
      manejarError(err);
    } finally {
      setGuardando(false);
    }
  };

  const textoGuardando = imagenData ? "Subiendo afiche..." : "Guardando...";

  return (
    <ModalOverlay onCerrar={onCerrar} bloqueado={guardando} className="admin-modal--grande">
      <div className="admin-modal__header admin-panel__header--orange">
        <span>🏆</span>
        {esEdicion ? "Editar torneo" : "Crear torneo"}
        <button className="admin-modal__cerrar" onClick={onCerrar} disabled={guardando} aria-label="Cerrar">✕</button>
      </div>
      <form className="admin-modal__body" onSubmit={handleSubmit} noValidate>
        <div className="row g-3">
          <div className="col-12 col-sm-6">
            <label className="admin-label">Nombre del torneo *</label>
            <input
              type="text"
              className={`form-control admin-input ${errores.nombre ? "admin-input--error" : ""}`}
              placeholder="Ej: FIFA 25 Cup"
              value={form.nombre}
              disabled={guardando}
              onChange={setField("nombre")}
            />
            {errores.nombre && <div className="campo-error">{errores.nombre}</div>}
          </div>

          <div className="col-12 col-sm-6">
            <label className="admin-label">Fecha *</label>
            <input
              type="date"
              className={`form-control admin-input ${errores.fecha ? "admin-input--error" : ""}`}
              value={form.fecha}
              disabled={guardando}
              onChange={setField("fecha")}
            />
            {errores.fecha && <div className="campo-error">{errores.fecha}</div>}
          </div>

          <div className="col-12 col-sm-6">
            <label className="admin-label">Cupo máximo</label>
            <input
              type="number"
              inputMode="numeric"
              className={`form-control admin-input ${errores.cupoMaximo ? "admin-input--error" : ""}`}
              placeholder="Vacío = sin límite"
              min="1"
              value={form.cupoMaximo}
              disabled={guardando}
              onChange={setField("cupoMaximo")}
            />
            {errores.cupoMaximo
              ? <div className="campo-error">{errores.cupoMaximo}</div>
              : <small className="admin-hint">Dejalo vacío para cupo ilimitado</small>}
          </div>

          <div className="col-12 col-sm-6">
            <label className="admin-label">Costo de inscripción</label>
            <div className="input-group">
              <span className="input-group-text admin-input-prefix">₡</span>
              <input
                type="number"
                inputMode="numeric"
                className={`form-control admin-input ${errores.costoInscripcion ? "admin-input--error" : ""}`}
                placeholder="0"
                min="0"
                value={form.costoInscripcion}
                disabled={guardando}
                onChange={setField("costoInscripcion")}
              />
            </div>
            {errores.costoInscripcion
              ? <div className="campo-error">{errores.costoInscripcion}</div>
              : <small className="admin-hint">0 = gratis</small>}
          </div>

          <div className="col-12 col-sm-6">
            <label className="admin-label">Estado</label>
            <select
              className="form-select admin-select"
              value={form.estado}
              disabled={guardando}
              onChange={setField("estado")}
            >
              {ESTADO_OPCIONES.map((o) => (
                <option key={o.valor} value={o.valor}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="col-12">
            <label className="admin-label">Descripción</label>
            <textarea
              className="form-control admin-input"
              rows={3}
              placeholder="Formato, premios, reglas..."
              value={form.descripcion}
              disabled={guardando}
              onChange={setField("descripcion")}
            />
          </div>

          <div className="col-12">
            <CampoAfiche
              urlActual={esEdicion ? torneo.imagenUrl : null}
              imagenData={imagenData}
              quitar={quitarImagen}
              onChange={(d) => { setImagenData(d); if (d) setQuitarImagen(false); }}
              onQuitar={(v) => { setQuitarImagen(v); if (v) { imageRef.current?.reset(); setImagenData(null); } }}
              onProcesando={setProcesandoImg}
              uploadRef={imageRef}
              disabled={guardando}
            />
          </div>
        </div>

        <div className="d-flex gap-2 justify-content-end align-items-center mt-4 flex-wrap">
          <button type="button" className="admin-btn-ghost" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </button>
          <button
            type="submit"
            className="btn admin-btn admin-btn--orange px-4 fw-bold"
            disabled={guardando || procesandoImg}
          >
            {guardando && <span className="btn-spinner" />}
            {guardando ? textoGuardando : procesandoImg ? "Procesando afiche…" : esEdicion ? "Guardar cambios" : "Crear torneo"}
          </button>
        </div>
      </form>
    </ModalOverlay>
  );
};

// ─── MODAL DE INSCRIPCIONES ─────────────────────────────────────────────────
const InscripcionesModal = ({ torneo, getAuthHeaders, mostrarNotif, manejarError, onCerrar }) => {
  const [inscripciones, setInscripciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);
  const [actualizandoId, setActualizandoId] = useState(null);
  const [aEliminar, setAEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  const fetchInscripciones = useCallback(async () => {
    setLoading(true);
    setErrorCarga(false);
    try {
      const axios = await getAxios();
      const res = await axios.get(`${API_URL}/api/torneos/${torneo._id}/inscripciones`, getAuthHeaders());
      setInscripciones(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      setErrorCarga(true);
      manejarError(err);
    } finally {
      setLoading(false);
    }
  }, [torneo._id, getAuthHeaders, manejarError]);

  useEffect(() => { fetchInscripciones(); }, [fetchInscripciones]);

  const toggleAtendida = async (ins) => {
    if (actualizandoId) return;
    setActualizandoId(ins._id);
    try {
      const axios = await getAxios();
      const res = await axios.patch(
        `${API_URL}/api/torneos/${torneo._id}/inscripciones/${ins._id}`,
        { atendida: !ins.atendida },
        getAuthHeaders(),
      );
      const nueva = res.data?.data?.atendida ?? !ins.atendida;
      setInscripciones((prev) => prev.map((x) => (x._id === ins._id ? { ...x, atendida: nueva } : x)));
    } catch (err) {
      manejarError(err);
    } finally {
      setActualizandoId(null);
    }
  };

  const confirmarEliminar = async () => {
    if (!aEliminar || eliminando) return;
    setEliminando(true);
    try {
      const axios = await getAxios();
      const res = await axios.delete(
        `${API_URL}/api/torneos/${torneo._id}/inscripciones/${aEliminar._id}`,
        getAuthHeaders(),
      );
      setInscripciones((prev) => prev.filter((x) => x._id !== aEliminar._id));
      mostrarNotif(res.data?.message || "Inscripción eliminada");
      setAEliminar(null);
    } catch (err) {
      manejarError(err);
    } finally {
      setEliminando(false);
    }
  };

  const bloqueado = eliminando || actualizandoId != null;

  return (
    <ModalOverlay onCerrar={() => !bloqueado && onCerrar()} bloqueado={bloqueado} className="admin-modal--grande">
      <div className="admin-modal__header admin-panel__header--orange">
        <span>👥</span>
        Inscripciones — {torneo.nombre}
        <button className="admin-modal__cerrar" onClick={onCerrar} disabled={bloqueado} aria-label="Cerrar">✕</button>
      </div>

      <div className="admin-modal__body">
        {errorCarga ? (
          <ErrorRecarga onReintentar={fetchInscripciones} />
        ) : loading ? (
          <Cargando variante="orange" />
        ) : aEliminar ? (
          <div className="aviso-quitar fade-in">
            <p className="mb-2">
              ¿Eliminar la inscripción de <strong>{aEliminar.nombre}</strong>? Esta acción no se puede deshacer.
            </p>
            <div className="d-flex gap-2 justify-content-end">
              <button className="admin-btn-ghost" onClick={() => setAEliminar(null)} disabled={eliminando}>
                Cancelar
              </button>
              <button
                className="btn admin-btn admin-btn--red px-3 fw-bold"
                onClick={confirmarEliminar}
                disabled={eliminando}
              >
                {eliminando && <span className="btn-spinner" />}
                {eliminando ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="rep-total">
              <span className="rep-total__label">
                {inscripciones.length} {inscripciones.length === 1 ? "inscrito" : "inscritos"}
              </span>
              <span className="rep-total__monto">{ESTADO_LABEL[torneo.estado] || torneo.estado}</span>
            </div>

            {inscripciones.length === 0 ? (
              <EstadoVacio icono="📝" mensaje="Este torneo no tiene inscripciones todavía" />
            ) : (
              <div className="rep-lista">
                {inscripciones.map((ins) => (
                  <div key={ins._id} className="rep-item">
                    <div className="rep-item__top">
                      <span className="rep-item__monto">{ins.nombre}</span>
                      <label className="d-flex align-items-center gap-2 mb-0" style={{ cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={!!ins.atendida}
                          disabled={actualizandoId === ins._id}
                          onChange={() => toggleAtendida(ins)}
                        />
                        <span className={`estado-badge estado-badge--${ins.atendida ? "azul" : "amarillo"}`}>
                          {ins.atendida ? "✅ Atendida" : "⏳ Pendiente"}
                        </span>
                      </label>
                    </div>
                    {ins.createdAt && <div className="rep-item__fecha">📅 {formatFecha(ins.createdAt)}</div>}
                    {ins.telefono && (
                      <div className="rep-item__dato"><strong>Teléfono:</strong> {ins.telefono}</div>
                    )}
                    {ins.correo && (
                      <div className="rep-item__dato"><strong>Correo:</strong> {ins.correo}</div>
                    )}
                    {ins.gamertag && (
                      <div className="rep-item__dato"><strong>Gamertag:</strong> {ins.gamertag}</div>
                    )}
                    {ins.nombreEquipo && (
                      <div className="rep-item__dato"><strong>Equipo:</strong> {ins.nombreEquipo}</div>
                    )}
                    <div className="rep-item__acciones">
                      <button className="accion-btn accion-btn--rojo" onClick={() => setAEliminar(ins)} title="Eliminar">
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </ModalOverlay>
  );
};

// ─── PANEL PRINCIPAL ─────────────────────────────────────────────────────────
const TorneosPanel = ({ getAuthHeaders, mostrarNotif, manejarError }) => {
  const [torneos, setTorneos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);
  const [modalForm, setModalForm] = useState(null);       // null | { torneo: null|obj }
  const [inscripcionesDe, setInscripcionesDe] = useState(null);
  const [aEliminar, setAEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  const fetchTorneos = useCallback(async () => {
    setLoading(true);
    setErrorCarga(false);
    try {
      const axios = await getAxios();
      const res = await axios.get(`${API_URL}/api/torneos`, getAuthHeaders());
      setTorneos(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      setErrorCarga(true);
      manejarError(err);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, manejarError]);

  useEffect(() => { fetchTorneos(); }, [fetchTorneos]);

  const copiarLink = async (url) => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      mostrarNotif("Link copiado — ya lo podés compartir (WhatsApp, redes, etc.)");
    } catch {
      // Fallback si el navegador no permite clipboard (ej. http sin permiso)
      window.prompt("Copiá el link del torneo para compartirlo:", url);
    }
  };

  const confirmarEliminar = async () => {
    if (!aEliminar || eliminando) return;
    setEliminando(true);
    try {
      const axios = await getAxios();
      const res = await axios.delete(`${API_URL}/api/torneos/${aEliminar._id}`, getAuthHeaders());
      mostrarNotif(res.data?.message || "Torneo eliminado");
      setAEliminar(null);
      fetchTorneos();
    } catch (err) {
      manejarError(err);
    } finally {
      setEliminando(false);
    }
  };

  // URL pública de PRODUCCIÓN (para compartir con la familia), no la del sitio
  // donde se abre el admin (que en local sería localhost). La tomamos del
  // urlPublica que arma el backend; si aún no hay torneos, usamos el dominio fijo.
  const baseBackend = torneos.find((t) => t.urlPublica)?.urlPublica?.replace(/\/torneos\/.*$/, "");
  const urlSitio = baseBackend || "https://salajuegosruiz.netlify.app";

  return (
    <div className="fade-in">
      {/* Todo en un renglón: texto/link a la izquierda, botones a la derecha. */}
      <div className="aviso-mes mb-4 d-flex align-items-center justify-content-between gap-3 flex-wrap">
        <div>
          <div className="mb-1">
            🏆 Creá torneos y competiciones. Cada uno tiene su <strong>link público</strong> (botón 🔗)
            y las inscripciones aparecen acá con 👥.
          </div>
          <span className="fw-bold">🌐 Página pública: </span>
          <code style={{ fontSize: "0.9rem", wordBreak: "break-all" }}>{urlSitio}</code>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <a
            href={urlSitio}
            target="_blank"
            rel="noopener noreferrer"
            className="btn admin-btn admin-btn--orange fw-bold"
          >
            🔗 Abrir
          </a>
          <button type="button" className="admin-btn-ghost" onClick={() => copiarLink(urlSitio)}>
            📋 Copiar link
          </button>
        </div>
      </div>

      <div className="d-flex justify-content-end mb-3">
        <button className="btn admin-btn admin-btn--orange fw-bold" onClick={() => setModalForm({ torneo: null })}>
          ＋ Crear torneo
        </button>
      </div>

      {errorCarga ? (
        <ErrorRecarga onReintentar={fetchTorneos} />
      ) : loading ? (
        <Cargando variante="orange" />
      ) : torneos.length === 0 ? (
        <EstadoVacio icono="🏆" mensaje="No hay torneos creados todavía" />
      ) : (
        <div className="row g-3">
          {torneos.map((t) => (
            <div key={t._id} className="col-12 col-sm-6 col-lg-4">
              <div className="activo-card w-100">
                {t.imagenUrl ? (
                  <div className="activo-card__img-wrap">
                    <img src={t.imagenUrl} alt={t.nombre} className="activo-card__img" loading="lazy" />
                  </div>
                ) : (
                  <div className="activo-card__no-img"><span>🏆</span></div>
                )}
                <div className="activo-card__body">
                  <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
                    <h6 className="activo-card__nombre mb-0">{t.nombre}</h6>
                    <span className={`estado-badge estado-badge--${ESTADO_CLASE[t.estado] || "gris"}`}>
                      {ESTADO_LABEL[t.estado] || t.estado}
                    </span>
                  </div>
                  <div className="admin-hint mt-1">📅 {formatFecha(t.fecha)}</div>

                  <div className="activo-card__costos mt-2">
                    <div className="activo-card__costo-fila">
                      <span className="activo-card__costo-label">💰 Inscripción</span>
                      <strong className="activo-card__costo">{formatCosto(t.costoInscripcion)}</strong>
                    </div>
                    <div className="activo-card__costo-fila">
                      <span className="activo-card__costo-label">👥 Inscritos</span>
                      <strong className="activo-card__costo">{textoCupo(t)}</strong>
                    </div>
                  </div>

                  <div className="activo-card__acciones activo-card__acciones--wrap">
                    <button
                      className="accion-btn accion-btn--texto accion-btn--naranja"
                      onClick={() => setInscripcionesDe(t)}
                      aria-label={`Inscripciones de ${t.nombre}`}
                    >
                      👥 Inscripciones ({t.inscritosCount ?? 0})
                    </button>
                    <button
                      className="accion-btn accion-btn--texto"
                      onClick={() => copiarLink(t.urlPublica)}
                      aria-label={`Compartir ${t.nombre}`}
                    >
                      🔗 Compartir link
                    </button>
                    <button
                      className="accion-btn accion-btn--texto"
                      onClick={() => setModalForm({ torneo: t })}
                      aria-label={`Editar ${t.nombre}`}
                    >
                      ✏️ Editar
                    </button>
                    <button
                      className="accion-btn accion-btn--rojo"
                      onClick={() => setAEliminar(t)}
                      title="Eliminar"
                      aria-label={`Eliminar ${t.nombre}`}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalForm && (
        <TorneoFormModal
          torneo={modalForm.torneo}
          getAuthHeaders={getAuthHeaders}
          mostrarNotif={mostrarNotif}
          manejarError={manejarError}
          onCerrar={() => setModalForm(null)}
          onExito={() => { setModalForm(null); fetchTorneos(); }}
        />
      )}

      {inscripcionesDe && (
        <InscripcionesModal
          torneo={inscripcionesDe}
          getAuthHeaders={getAuthHeaders}
          mostrarNotif={mostrarNotif}
          manejarError={manejarError}
          onCerrar={() => { setInscripcionesDe(null); fetchTorneos(); }}
        />
      )}

      {aEliminar && (
        <ConfirmarEliminar
          detalle={`${aEliminar.nombre}. También se eliminarán todas sus inscripciones.`}
          eliminando={eliminando}
          onCancelar={() => setAEliminar(null)}
          onConfirmar={confirmarEliminar}
        />
      )}
    </div>
  );
};

export default TorneosPanel;
