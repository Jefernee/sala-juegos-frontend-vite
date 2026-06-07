// Vista Activos de la Sala: compras y reparaciones del equipo físico.
// Búsqueda con debounce, filtro por tipo, grid paginado, detalle con
// lightbox y CRUD con hasta 2 imágenes en base64.
import { useState, useEffect, useCallback, useRef } from "react";
import ImageUploadWithCompression from "../ImageUploadWithCompression";
import {
  API_URL, getAxios, formatCRC, formatFecha, getLocalDateString, fechaParaInput,
  ESTADOS_ACTIVO, ESTADO_CLASE, LIMITE_PAGINA,
} from "./adminUtils";
import { ModalOverlay, ConfirmarEliminar, Paginacion, ErrorRecarga, EstadoVacio, Cargando } from "./Comunes";

// El valor viaja como ?tipoRegistro= al backend; la etiqueta refleja lo que
// significa hoy: tener o no una reparación registrada
const FILTROS_TIPO = [
  { valor: "Todos", label: "Todos" },
  { valor: "Nueva Compra", label: "🛒 Sin reparación" },
  { valor: "Reparación", label: "🔧 Con reparación" },
];

const getFormVacio = () => ({
  tipoRegistro: "Nueva Compra",
  nombre: "",
  costo: "",
  costoReparacion: "",
  estado: "En uso",
  descripcion: "",
  numeroFactura: "",
  notas: "",
  problemaTecnico: "",
  reparadoPor: "",
  fechaCompraReparacion: getLocalDateString(),
});

const formDesdeActivo = (a) => ({
  tipoRegistro: a.tipoRegistro || "Nueva Compra",
  nombre: a.nombre || "",
  costo: a.costo != null ? String(a.costo) : "",
  costoReparacion: a.costoReparacion != null ? String(a.costoReparacion) : "",
  estado: a.estado || "En uso",
  descripcion: a.descripcion || "",
  numeroFactura: a.numeroFactura || "",
  notas: a.notas || "",
  problemaTecnico: a.problemaTecnico || "",
  reparadoPor: a.reparadoPor || "",
  fechaCompraReparacion: fechaParaInput(a.fechaCompraReparacion),
});

// ─── LIGHTBOX ────────────────────────────────────────────────────────────────
const Lightbox = ({ url, alt, onCerrar }) => (
  <div className="lightbox-overlay" onClick={onCerrar}>
    <button className="lightbox-cerrar" onClick={onCerrar} aria-label="Cerrar imagen">✕</button>
    <img src={url} alt={alt} className="lightbox-img" onClick={(e) => e.stopPropagation()} />
  </div>
);

// ─── BLOQUE DE IMAGEN EN EL FORMULARIO (crear/editar) ───────────────────────
const CampoImagen = ({ etiqueta, urlActual, imagenData, onChange, uploadRef, disabled }) => {
  // En edición con imagen existente: mostrarla hasta que se pida cambiarla
  const [cambiando, setCambiando] = useState(!urlActual);

  const quitarNueva = () => {
    uploadRef.current?.reset();
    onChange(null);
  };

  return (
    <div>
      <label className="admin-label">{etiqueta}</label>
      {!cambiando && urlActual ? (
        <div className="imagen-actual">
          <img src={urlActual} alt={etiqueta} className="imagen-actual__img" />
          <button
            type="button"
            className="admin-btn-ghost mt-2"
            onClick={() => setCambiando(true)}
            disabled={disabled}
          >
            🔄 Cambiar imagen
          </button>
        </div>
      ) : (
        <>
          <ImageUploadWithCompression
            ref={uploadRef}
            onChange={onChange}
            showPreview
            alwaysCompress
            maxWidthOrHeight={1000}
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
                ↩ Mantener imagen actual
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// ─── MODAL CREAR / EDITAR ────────────────────────────────────────────────────
// `reparacionDe`: activo existente al que se le registra una reparación.
// Se hace PUT sobre el MISMO registro enviando solo los campos de reparación
// (costoReparacion, problemaTecnico, etc.) — el costo del producto NO se envía
// y queda intacto.
const ActivoFormModal = ({ activo, reparacionDe, getAuthHeaders, mostrarNotif, manejarError, onCerrar, onExito }) => {
  // Tres modos, cada uno muestra SOLO sus campos:
  // - crear:    nuevo producto (siempre Nueva Compra)
  // - producto: editar datos del producto (sin nada de reparación)
  // - reparacion: registrar o editar la reparación (sin datos del producto)
  const esEdicion = !!activo;
  const esModoReparacion = !esEdicion && !!reparacionDe;
  const yaReparado = esModoReparacion && reparacionDe.tipoRegistro === "Reparación";

  const [form, setForm] = useState(() => {
    if (esEdicion) return formDesdeActivo(activo);
    if (reparacionDe) {
      const base = formDesdeActivo(reparacionDe);
      // Editar reparación existente: ya trae sus valores precargados
      if (reparacionDe.tipoRegistro === "Reparación") return base;
      // Registrar reparación nueva sobre una compra
      return {
        ...base,
        tipoRegistro: "Reparación",
        estado: "En reparación",
        costoReparacion: "",
        fechaCompraReparacion: getLocalDateString(),
      };
    }
    return getFormVacio();
  });
  const [errores, setErrores] = useState({});
  const [imagenData, setImagenData] = useState(null);
  const [facturaData, setFacturaData] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [confirmandoQuitar, setConfirmandoQuitar] = useState(false);
  const imageRef = useRef(null);
  const facturaRef = useRef(null);

  const esReparacion = form.tipoRegistro === "Reparación";
  const setField = (field) => (e) => {
    const valor = e.target.value;
    setForm((f) => ({ ...f, [field]: valor }));
    setErrores((er) => ({ ...er, [field]: "" }));
  };

  const validar = () => {
    const e = {};
    if (esModoReparacion) {
      if (!form.costoReparacion || Number(form.costoReparacion) <= 0) {
        e.costoReparacion = "Ingresa el costo de la reparación (mayor a 0)";
      }
    } else {
      if (!form.nombre.trim()) e.nombre = "El nombre es obligatorio";
      if (!form.costo || Number(form.costo) <= 0) e.costo = "Ingresa un costo mayor a 0";
    }
    if (form.fechaCompraReparacion && form.fechaCompraReparacion > getLocalDateString()) {
      e.fechaCompraReparacion = "La fecha no puede ser futura";
    }
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const construirPayload = () => {
    const camposImagen = {
      ...(imagenData?.base64 && {
        imagenBase64: imagenData.base64,
        imagenNombre: imagenData.file.name,
        imagenMimeType: imagenData.file.type,
      }),
      ...(facturaData?.base64 && {
        imagenFacturaBase64: facturaData.base64,
        imagenFacturaNombre: facturaData.file.name,
        imagenFacturaMimeType: facturaData.file.type,
      }),
    };

    if (esModoReparacion) {
      // PUT sobre el mismo activo: SOLO campos de reparación.
      // NO se envía `costo` ni datos del producto — quedan intactos.
      // Al registrar, el estado pasa a "En reparación" automáticamente;
      // al editar la reparación no se toca (se maneja desde el producto).
      const original = formDesdeActivo(reparacionDe);
      const payload = {
        tipoRegistro: "Reparación",
        ...(!yaReparado && { estado: "En reparación" }),
        costoReparacion: Number(form.costoReparacion),
        ...(facturaData?.base64 && {
          imagenFacturaBase64: facturaData.base64,
          imagenFacturaNombre: facturaData.file.name,
          imagenFacturaMimeType: facturaData.file.type,
        }),
      };
      ["problemaTecnico", "reparadoPor"].forEach((k) => {
        if (form[k].trim() !== original[k]) payload[k] = form[k].trim();
      });
      if (form.fechaCompraReparacion && form.fechaCompraReparacion !== original.fechaCompraReparacion) {
        payload.fechaCompraReparacion = form.fechaCompraReparacion;
      }
      return payload;
    }

    if (!esEdicion) {
      // Registrar producto nuevo (siempre Nueva Compra)
      return {
        tipoRegistro: "Nueva Compra",
        nombre: form.nombre.trim(),
        costo: Number(form.costo),
        estado: form.estado,
        ...(form.descripcion.trim() && { descripcion: form.descripcion.trim() }),
        ...(form.numeroFactura.trim() && { numeroFactura: form.numeroFactura.trim() }),
        ...(form.notas.trim() && { notas: form.notas.trim() }),
        ...(form.fechaCompraReparacion && { fechaCompraReparacion: form.fechaCompraReparacion }),
        ...camposImagen,
      };
    }

    // Edición del producto: enviar solo lo que cambió
    // (sin tipoRegistro ni campos de reparación — eso se maneja con 🔧)
    const payload = { ...camposImagen };
    const original = formDesdeActivo(activo);
    if (form.nombre.trim() !== original.nombre) payload.nombre = form.nombre.trim();
    if (Number(form.costo) !== Number(original.costo)) payload.costo = Number(form.costo);
    if (form.estado !== original.estado) payload.estado = form.estado;
    ["descripcion", "numeroFactura", "notas"].forEach((k) => {
      if (form[k].trim() !== original[k]) payload[k] = form[k].trim();
    });
    if (form.fechaCompraReparacion !== original.fechaCompraReparacion && form.fechaCompraReparacion) {
      payload.fechaCompraReparacion = form.fechaCompraReparacion;
    }
    return payload;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!validar() || guardando) return;

    const payload = construirPayload();
    if (esEdicion && Object.keys(payload).length === 0) {
      mostrarNotif("No hay cambios para guardar", "warning");
      return;
    }

    setGuardando(true);
    try {
      const axios = await getAxios();
      // Editar producto y reparación actualizan el mismo registro vía PUT
      const idDestino = esEdicion ? activo._id : esModoReparacion ? reparacionDe._id : null;
      const res = idDestino
        ? await axios.put(`${API_URL}/api/activos-sala/${idDestino}`, payload, getAuthHeaders())
        : await axios.post(`${API_URL}/api/activos-sala`, payload, getAuthHeaders());
      mostrarNotif(
        res.data?.message ||
          (esModoReparacion
            ? yaReparado ? "Reparación actualizada" : "Reparación registrada"
            : esEdicion ? "Producto actualizado" : "Activo registrado"),
      );
      onExito();
    } catch (err) {
      manejarError(err);
    } finally {
      setGuardando(false);
    }
  };

  // Quitar la reparación: el backend borra costoReparacion, problemaTecnico
  // y reparadoPor al volver el tipo a "Nueva Compra"
  const handleQuitarReparacion = async () => {
    if (guardando) return;
    setGuardando(true);
    try {
      const axios = await getAxios();
      const res = await axios.put(
        `${API_URL}/api/activos-sala/${reparacionDe._id}`,
        { tipoRegistro: "Nueva Compra", estado: "En uso" },
        getAuthHeaders(),
      );
      mostrarNotif(res.data?.message || "Reparación quitada");
      onExito();
    } catch (err) {
      manejarError(err);
    } finally {
      setGuardando(false);
    }
  };

  const haySubidaImagenes = !!(imagenData || facturaData);
  const textoGuardando = haySubidaImagenes ? "Subiendo imágenes..." : "Guardando...";

  return (
    <ModalOverlay onCerrar={onCerrar} bloqueado={guardando} className="admin-modal--grande">
      <div className="admin-modal__header admin-panel__header--orange">
        <span>{esModoReparacion ? "🔧" : "🛒"}</span>
        {esModoReparacion
          ? yaReparado ? `Editar reparación — ${reparacionDe.nombre}` : `Registrar reparación — ${reparacionDe.nombre}`
          : esEdicion ? "Editar producto" : "Registrar producto"}
        <button className="admin-modal__cerrar" onClick={onCerrar} disabled={guardando} aria-label="Cerrar">✕</button>
      </div>
      <form className="admin-modal__body" onSubmit={handleSubmit} noValidate>
        {esModoReparacion ? (
          <div className="aviso-mes mb-4">
            🔧 {yaReparado ? "Estás editando la reparación de" : "Vas a registrar una reparación de"}{" "}
            <strong>{reparacionDe.nombre}</strong>. El costo del producto ({formatCRC(reparacionDe.costo)}){" "}
            <strong>no se modifica</strong>.
            {!yaReparado && <> El estado pasará a <strong>«En reparación»</strong> automáticamente.</>}
          </div>
        ) : esEdicion && esReparacion ? (
          <small className="admin-hint d-block mb-4">
            🔧 Este producto tiene una reparación — sus datos se editan con el botón 🔧 de la card.
            Cuando ya esté lista, cambiá aquí el estado a «Reparado».
          </small>
        ) : !esEdicion ? (
          <small className="admin-hint d-block mb-4">
            💡 Las reparaciones se registran después, con el botón 🔧 Reparar en la card de cada producto
          </small>
        ) : null}

        <div className="row g-3">
          {!esModoReparacion && (
            <>
              <div className="col-12 col-sm-6">
                <label className="admin-label">Artículo / Equipo *</label>
                <input
                  type="text"
                  className={`form-control admin-input ${errores.nombre ? "admin-input--error" : ""}`}
                  placeholder="Ej: Máquina de Futbolín"
                  value={form.nombre}
                  disabled={guardando}
                  onChange={setField("nombre")}
                />
                {errores.nombre && <div className="campo-error">{errores.nombre}</div>}
              </div>

              <div className="col-12 col-sm-6">
                <label className="admin-label">Costo del producto *</label>
                <div className="input-group">
                  <span className="input-group-text admin-input-prefix">₡</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    className={`form-control admin-input ${errores.costo ? "admin-input--error" : ""}`}
                    placeholder="0"
                    min="1"
                    value={form.costo}
                    disabled={guardando}
                    onChange={setField("costo")}
                  />
                </div>
                {errores.costo
                  ? <div className="campo-error">{errores.costo}</div>
                  : <small className="admin-hint">Lo que costó comprarlo</small>}
              </div>
            </>
          )}

          {/* Estado: solo se maneja desde el producto (al reparar se pone
              "En reparación" automáticamente) */}
          {!esModoReparacion && (
            <div className="col-12 col-sm-6">
              <label className="admin-label">Estado actual</label>
              <select className="form-select admin-select" value={form.estado} disabled={guardando} onChange={setField("estado")}>
                {ESTADOS_ACTIVO.map((e) => <option key={e}>{e}</option>)}
              </select>
            </div>
          )}

          {/* Fecha: de compra en el producto, de reparación en la reparación.
              Si el producto ya está reparado, la fecha guardada es la de la
              reparación y se edita desde el formulario de reparación */}
          {(esModoReparacion || !esReparacion) && (
            <div className="col-12 col-sm-6">
              <label className="admin-label">
                {esModoReparacion ? "Fecha de reparación" : "Fecha de compra"}
              </label>
              <input
                type="date"
                className={`form-control admin-input ${errores.fechaCompraReparacion ? "admin-input--error" : ""}`}
                value={form.fechaCompraReparacion}
                max={getLocalDateString()}
                disabled={guardando}
                onChange={setField("fechaCompraReparacion")}
              />
              {errores.fechaCompraReparacion && <div className="campo-error">{errores.fechaCompraReparacion}</div>}
            </div>
          )}

          {!esModoReparacion && (
            <>
              <div className="col-12 col-sm-6">
                <label className="admin-label">N° Factura</label>
                <input
                  type="text"
                  className="form-control admin-input"
                  placeholder="Opcional"
                  value={form.numeroFactura}
                  disabled={guardando}
                  onChange={setField("numeroFactura")}
                />
              </div>

              <div className="col-12 col-sm-6">
                <label className="admin-label">Notas adicionales</label>
                <input
                  type="text"
                  className="form-control admin-input"
                  placeholder="Observaciones..."
                  value={form.notas}
                  disabled={guardando}
                  onChange={setField("notas")}
                />
              </div>

              <div className="col-12">
                <label className="admin-label">Descripción</label>
                <textarea
                  className="form-control admin-input"
                  rows={2}
                  placeholder="Descripción del artículo o la reparación..."
                  value={form.descripcion}
                  disabled={guardando}
                  onChange={setField("descripcion")}
                />
              </div>
            </>
          )}

          {esModoReparacion && (
            <div className="col-12 fade-in">
              <div className="seccion-reparacion">
                <div className="seccion-reparacion__titulo">🔧 Datos de la reparación</div>
                <div className="row g-3">
                  <div className="col-12 col-sm-6">
                    <label className="admin-label">Costo de la reparación *</label>
                    <div className="input-group">
                      <span className="input-group-text admin-input-prefix">₡</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        className={`form-control admin-input ${errores.costoReparacion ? "admin-input--error" : ""}`}
                        placeholder="0"
                        min="1"
                        value={form.costoReparacion}
                        disabled={guardando}
                        onChange={setField("costoReparacion")}
                      />
                    </div>
                    {errores.costoReparacion
                      ? <div className="campo-error">{errores.costoReparacion}</div>
                      : <small className="admin-hint">Lo que costó repararlo — no afecta el costo del producto</small>}
                  </div>
                  <div className="col-12 col-sm-6">
                    <label className="admin-label">Problema técnico detectado</label>
                    <input
                      type="text"
                      className="form-control admin-input"
                      placeholder="¿Qué falla tenía?"
                      value={form.problemaTecnico}
                      disabled={guardando}
                      onChange={setField("problemaTecnico")}
                    />
                  </div>
                  <div className="col-12 col-sm-6">
                    <label className="admin-label">Reparado por</label>
                    <input
                      type="text"
                      className="form-control admin-input"
                      placeholder="Técnico o taller"
                      value={form.reparadoPor}
                      disabled={guardando}
                      onChange={setField("reparadoPor")}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* En modo "Reparar" no se pide foto del artículo (ya la tiene el producto):
              solo la factura de la reparación */}
          {!esModoReparacion && (
            <div className="col-12 col-md-6">
              <CampoImagen
                etiqueta="📷 Foto del artículo"
                urlActual={esEdicion ? activo.imagenUrl : null}
                imagenData={imagenData}
                onChange={setImagenData}
                uploadRef={imageRef}
                disabled={guardando}
              />
            </div>
          )}

          <div className="col-12 col-md-6">
            <CampoImagen
              etiqueta={esModoReparacion ? "🧾 Factura de la reparación" : "🧾 Foto de la factura"}
              urlActual={
                esModoReparacion
                  ? (yaReparado ? reparacionDe.imagenFacturaUrl : null)
                  : esEdicion ? activo.imagenFacturaUrl : null
              }
              imagenData={facturaData}
              onChange={setFacturaData}
              uploadRef={facturaRef}
              disabled={guardando}
            />
          </div>
        </div>

        {confirmandoQuitar ? (
          <div className="aviso-quitar mt-4 fade-in">
            <p className="mb-2">
              ¿Quitar la reparación de <strong>{reparacionDe?.nombre}</strong>? Se borran el costo
              de reparación, el problema técnico y quién reparó. El estado vuelve a «En uso».
            </p>
            <div className="d-flex gap-2 justify-content-end">
              <button
                type="button"
                className="admin-btn-ghost"
                onClick={() => setConfirmandoQuitar(false)}
                disabled={guardando}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn admin-btn admin-btn--red px-3 fw-bold"
                onClick={handleQuitarReparacion}
                disabled={guardando}
              >
                {guardando && <span className="btn-spinner" />}
                {guardando ? "Quitando..." : "Sí, quitar reparación"}
              </button>
            </div>
          </div>
        ) : (
          <div className="d-flex gap-2 justify-content-end align-items-center mt-4 flex-wrap">
            {yaReparado && (
              <button
                type="button"
                className="admin-btn-ghost admin-btn-ghost--rojo me-auto"
                onClick={() => setConfirmandoQuitar(true)}
                disabled={guardando}
              >
                🗑️ Quitar reparación
              </button>
            )}
            <button type="button" className="admin-btn-ghost" onClick={onCerrar} disabled={guardando}>
              Cancelar
            </button>
            <button type="submit" className="btn admin-btn admin-btn--orange px-4 fw-bold" disabled={guardando}>
              {guardando && <span className="btn-spinner" />}
              {guardando
                ? textoGuardando
                : esModoReparacion ? (yaReparado ? "Guardar reparación" : "Registrar reparación")
                : esEdicion ? "Guardar cambios"
                : "Registrar producto"}
            </button>
          </div>
        )}
      </form>
    </ModalOverlay>
  );
};

// ─── MODAL DE DETALLE (solo información; las acciones viven en las cards) ───
const ActivoDetalleModal = ({ activo, cargando, onCerrar, onVerImagen }) => {
  const esReparacion = activo.tipoRegistro === "Reparación";
  return (
    <ModalOverlay onCerrar={onCerrar} className="admin-modal--grande">
      <div className="admin-modal__header admin-panel__header--orange">
        <span>{esReparacion ? "🔧" : "🛒"}</span>
        {activo.nombre}
        <button className="admin-modal__cerrar" onClick={onCerrar} aria-label="Cerrar">✕</button>
      </div>
      <div className="admin-modal__body">
        {cargando && (
          <div className="text-center py-2">
            <small className="admin-hint">Actualizando información...</small>
          </div>
        )}

        {/* Imágenes */}
        {(activo.imagenUrl || activo.imagenFacturaUrl) && (
          <div className="row g-3 mb-3">
            {activo.imagenUrl && (
              <div className={activo.imagenFacturaUrl ? "col-12 col-sm-6" : "col-12"}>
                <button
                  type="button"
                  className="detalle-img-btn"
                  onClick={() => onVerImagen(activo.imagenUrl, activo.nombre)}
                >
                  <img src={activo.imagenUrl} alt={activo.nombre} className="detalle-img" />
                  <span className="detalle-img__etiqueta">📷 Artículo · tocá para ampliar</span>
                </button>
              </div>
            )}
            {activo.imagenFacturaUrl && (
              <div className={activo.imagenUrl ? "col-12 col-sm-6" : "col-12"}>
                <button
                  type="button"
                  className="detalle-img-btn"
                  onClick={() => onVerImagen(activo.imagenFacturaUrl, `Factura de ${activo.nombre}`)}
                >
                  <img src={activo.imagenFacturaUrl} alt={`Factura de ${activo.nombre}`} className="detalle-img" />
                  <span className="detalle-img__etiqueta">🧾 Factura · tocá para ampliar</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Badges */}
        <div className="d-flex gap-2 flex-wrap mb-3">
          <span className={`estado-badge estado-badge--${ESTADO_CLASE[activo.estado] || "gris"}`}>
            {activo.estado}
          </span>
          {esReparacion && (
            <span className="activo-card__tipo-chip activo-card__tipo-chip--orange">
              🔧 Con reparación
            </span>
          )}
        </div>

        {/* Datos */}
        <div className="detalle-datos">
          <div className="detalle-dato">
            <span className="detalle-dato__label">Costo del producto</span>
            <span className="detalle-dato__valor detalle-dato__valor--monto">{formatCRC(activo.costo)}</span>
          </div>
          {activo.costoReparacion != null && (
            <div className="detalle-dato">
              <span className="detalle-dato__label">🔧 Costo de la reparación</span>
              <span className="detalle-dato__valor detalle-dato__valor--monto-rep">
                {formatCRC(activo.costoReparacion)}
              </span>
            </div>
          )}
          {activo.fechaCompraReparacion && (
            <div className="detalle-dato">
              <span className="detalle-dato__label">{esReparacion ? "Fecha de reparación" : "Fecha de compra"}</span>
              <span className="detalle-dato__valor">{formatFecha(activo.fechaCompraReparacion)}</span>
            </div>
          )}
          {activo.numeroFactura && (
            <div className="detalle-dato">
              <span className="detalle-dato__label">N° Factura</span>
              <span className="detalle-dato__valor">{activo.numeroFactura}</span>
            </div>
          )}
          {activo.descripcion && (
            <div className="detalle-dato">
              <span className="detalle-dato__label">Descripción</span>
              <span className="detalle-dato__valor">{activo.descripcion}</span>
            </div>
          )}
          {esReparacion && activo.problemaTecnico && (
            <div className="detalle-dato">
              <span className="detalle-dato__label">Problema técnico</span>
              <span className="detalle-dato__valor">{activo.problemaTecnico}</span>
            </div>
          )}
          {esReparacion && activo.reparadoPor && (
            <div className="detalle-dato">
              <span className="detalle-dato__label">Reparado por</span>
              <span className="detalle-dato__valor">{activo.reparadoPor}</span>
            </div>
          )}
          {activo.notas && (
            <div className="detalle-dato">
              <span className="detalle-dato__label">Notas</span>
              <span className="detalle-dato__valor">{activo.notas}</span>
            </div>
          )}
        </div>

      </div>
    </ModalOverlay>
  );
};

// ─── PANEL PRINCIPAL ─────────────────────────────────────────────────────────
const ActivosPanel = ({ getAuthHeaders, mostrarNotif, manejarError }) => {
  const [activos, setActivos] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const [busquedaDebounced, setBusquedaDebounced] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("Todos");

  const [modalForm, setModalForm] = useState(null);   // null | { activo: null | obj }
  const [detalle, setDetalle] = useState(null);        // null | activo
  const [detalleCargando, setDetalleCargando] = useState(false);
  const [aEliminar, setAEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);
  const [lightbox, setLightbox] = useState(null);      // null | { url, alt }

  // Debounce de búsqueda (400ms)
  useEffect(() => {
    const t = setTimeout(() => {
      setBusquedaDebounced(busqueda.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [busqueda]);

  const fetchActivos = useCallback(async () => {
    setLoading(true);
    setErrorCarga(false);
    try {
      const axios = await getAxios();
      const params = { page, limit: LIMITE_PAGINA };
      if (busquedaDebounced) params.search = busquedaDebounced;
      if (filtroTipo !== "Todos") params.tipoRegistro = filtroTipo;
      const res = await axios.get(`${API_URL}/api/activos-sala`, { params, ...getAuthHeaders() });
      const data = res.data.data || [];
      setActivos(data);
      setPagination(
        res.data.pagination ||
          (data.length > 0 ? { currentPage: page, totalPages: page, totalItems: data.length } : null),
      );
    } catch (err) {
      setErrorCarga(true);
      manejarError(err);
    } finally {
      setLoading(false);
    }
  }, [page, busquedaDebounced, filtroTipo, getAuthHeaders, manejarError]);

  useEffect(() => { fetchActivos(); }, [fetchActivos]);

  const cambiarFiltro = (f) => {
    setFiltroTipo(f);
    setPage(1);
  };

  const abrirDetalle = async (activo) => {
    setDetalle(activo);
    setDetalleCargando(true);
    try {
      const axios = await getAxios();
      const res = await axios.get(`${API_URL}/api/activos-sala/${activo._id}`, getAuthHeaders());
      if (res.data?.data) setDetalle(res.data.data);
    } catch (err) {
      manejarError(err);
    } finally {
      setDetalleCargando(false);
    }
  };

  const handleExitoForm = (eraEdicion) => {
    setModalForm(null);
    if (!eraEdicion && page !== 1) setPage(1);
    else fetchActivos();
  };

  const confirmarEliminar = async () => {
    if (!aEliminar || eliminando) return;
    setEliminando(true);
    try {
      const axios = await getAxios();
      const res = await axios.delete(`${API_URL}/api/activos-sala/${aEliminar._id}`, getAuthHeaders());
      mostrarNotif(res.data?.message || "Activo eliminado");
      setAEliminar(null);
      setDetalle(null);
      if (activos.length === 1 && page > 1) setPage((p) => p - 1);
      else fetchActivos();
    } catch (err) {
      manejarError(err);
    } finally {
      setEliminando(false);
    }
  };

  const hayFiltros = busquedaDebounced || filtroTipo !== "Todos";

  return (
    <div className="fade-in">
      {/* Encabezado: búsqueda + filtros + botón */}
      <div className="activos-header mb-3">
        <div className="activos-header__busqueda">
          <span className="activos-header__lupa">🔍</span>
          <input
            type="search"
            className="form-control admin-input activos-header__input"
            placeholder="Buscar por nombre..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Buscar activos por nombre"
          />
        </div>
        <button
          className="btn admin-btn admin-btn--orange fw-bold activos-header__nuevo"
          onClick={() => setModalForm({ activo: null })}
        >
          ＋ Registrar activo
        </button>
      </div>

      <div className="filtro-chips mb-4">
        {FILTROS_TIPO.map((f) => (
          <button
            key={f.valor}
            className={`filtro-chip ${filtroTipo === f.valor ? "filtro-chip--activo" : ""}`}
            onClick={() => cambiarFiltro(f.valor)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {errorCarga ? (
        <ErrorRecarga onReintentar={fetchActivos} />
      ) : loading ? (
        <Cargando variante="orange" />
      ) : activos.length === 0 ? (
        <EstadoVacio
          icono="🕹️"
          mensaje={hayFiltros ? "No se encontraron activos con esos filtros" : "No hay activos registrados aún"}
        />
      ) : (
        <>
          <div className="row g-3">
            {activos.map((a) => {
              const esRep = a.tipoRegistro === "Reparación";
              return (
                <div key={a._id} className="col-12 col-sm-6 col-lg-4">
                  <div
                    className={`activo-card activo-card--btn ${esRep ? "activo-card--rep" : "activo-card--new"} w-100`}
                    onClick={() => abrirDetalle(a)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        abrirDetalle(a);
                      }
                    }}
                  >
                    {a.imagenUrl ? (
                      <div className="activo-card__img-wrap">
                        <img src={a.imagenUrl} alt={a.nombre} className="activo-card__img" loading="lazy" />
                      </div>
                    ) : (
                      <div className="activo-card__no-img">
                        <span>🖼️</span>
                      </div>
                    )}
                    <div className="activo-card__body">
                      <h6 className="fw-bold text-white mb-1 text-start">{a.nombre}</h6>
                      {a.descripcion && (
                        <small className="text-white-50 d-block mb-2 text-start activo-card__desc">
                          {a.descripcion}
                        </small>
                      )}
                      <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap mt-2">
                        <span className={`estado-badge estado-badge--${ESTADO_CLASE[a.estado] || "gris"}`}>
                          {a.estado}
                        </span>
                        {a.fechaCompraReparacion && (
                          <small className="text-white-50">📅 {formatFecha(a.fechaCompraReparacion)}</small>
                        )}
                      </div>
                      {/* Montos con etiqueta para que se sepa qué es cada uno */}
                      <div className="activo-card__costos mt-2">
                        <div className="activo-card__costo-fila">
                          <span className="activo-card__costo-label">🛒 Producto</span>
                          <strong className="activo-card__costo">{formatCRC(a.costo)}</strong>
                        </div>
                        {a.costoReparacion != null && (
                          <div className="activo-card__costo-fila">
                            <span className="activo-card__costo-label">🔧 Reparación</span>
                            <strong className="activo-card__costo activo-card__costo--rep">
                              {formatCRC(a.costoReparacion)}
                            </strong>
                          </div>
                        )}
                      </div>
                      {esRep && a.problemaTecnico && (
                        <small className="activo-card__problema d-block mt-2 text-start">
                          🔧 {a.problemaTecnico}
                        </small>
                      )}
                      {/* Acciones visibles desde la card */}
                      <div className="activo-card__acciones" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="accion-btn accion-btn--texto"
                          onClick={() => setModalForm({ activo: a })}
                          aria-label={`Editar ${a.nombre}`}
                        >
                          ✏️ Editar
                        </button>
                        <button
                          className="accion-btn accion-btn--texto accion-btn--naranja"
                          onClick={() => setModalForm({ activo: null, reparacionDe: a })}
                          aria-label={esRep ? `Editar reparación de ${a.nombre}` : `Registrar reparación de ${a.nombre}`}
                        >
                          {esRep ? "🔧 Reparación" : "🔧 Reparar"}
                        </button>
                        <button
                          className="accion-btn accion-btn--rojo"
                          onClick={() => setAEliminar(a)}
                          title="Eliminar"
                          aria-label={`Eliminar ${a.nombre}`}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <Paginacion pagination={pagination} onPage={setPage} loading={loading} />
        </>
      )}

      {/* Modales */}
      {modalForm && (
        <ActivoFormModal
          activo={modalForm.activo}
          reparacionDe={modalForm.reparacionDe || null}
          getAuthHeaders={getAuthHeaders}
          mostrarNotif={mostrarNotif}
          manejarError={manejarError}
          onCerrar={() => setModalForm(null)}
          onExito={() => handleExitoForm(!!(modalForm.activo || modalForm.reparacionDe))}
        />
      )}

      {detalle && !modalForm && !aEliminar && (
        <ActivoDetalleModal
          activo={detalle}
          cargando={detalleCargando}
          onCerrar={() => setDetalle(null)}
          onVerImagen={(url, alt) => setLightbox({ url, alt })}
        />
      )}

      {aEliminar && (
        <ConfirmarEliminar
          detalle={`${aEliminar.nombre} · ${formatCRC(aEliminar.costo)}. También se eliminarán sus imágenes.`}
          eliminando={eliminando}
          onCancelar={() => setAEliminar(null)}
          onConfirmar={confirmarEliminar}
        />
      )}

      {lightbox && (
        <Lightbox url={lightbox.url} alt={lightbox.alt} onCerrar={() => setLightbox(null)} />
      )}
    </div>
  );
};

export default ActivosPanel;
