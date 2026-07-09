// Vista Activos de la Sala: equipo físico con historial de reparaciones.
// Búsqueda con debounce, filtros (con/sin reparación + categoría), grid paginado,
// detalle informativo con lightbox, y modales de producto y de reparaciones.
// El ESTADO lo calcula el backend (En uso / En reparación / Reparado); acá solo
// se controla el override manual (Fuera de servicio / Almacenado).
import { useState, useEffect, useCallback, useRef } from "react";
import ImageUploadWithCompression from "../ImageUploadWithCompression";
import {
  API_URL, getAxios, formatCRC, formatFecha, formatPlaca, getLocalDateString, fechaParaInput,
  ESTADO_CLASE, LIMITE_PAGINA,
} from "./adminUtils";
import { ModalOverlay, ConfirmarEliminar, Paginacion, ErrorRecarga, EstadoVacio, Cargando } from "./Comunes";

// Filtro de reparación: viaja como ?conReparacion=true|false (sin el parámetro = todos)
const FILTROS_REPARACION = [
  { valor: "Todos", label: "Todos" },
  { valor: "sin", label: "🛒 Sin reparación" },
  { valor: "con", label: "🔧 Con reparación" },
];

// Categorías de los activos. "Otros" cubre lo que no es control/consola/pantalla
// (refri, futbolín, cables, etc.). El valor viaja como ?categoria= al backend.
const CATEGORIAS = [
  "Control PS4",
  "Control PS5",
  "Consola PS4",
  "Consola PS5",
  "Pantalla",
  "Otros",
];

const CATEGORIA_ICONO = {
  "Control PS4": "🎮",
  "Control PS5": "🎮",
  "Consola PS4": "🕹️",
  "Consola PS5": "🕹️",
  Pantalla: "📺",
  Otros: "📦",
};

const FILTROS_CATEGORIA = [
  { valor: "Todas", label: "Todas" },
  ...CATEGORIAS.map((c) => ({ valor: c, label: `${CATEGORIA_ICONO[c]} ${c}` })),
];

// Override manual del estado. "" = automático (según reparaciones); los otros
// dos fuerzan un estado que el sistema no puede adivinar.
const ESTADO_OVERRIDE_OPCIONES = [
  { valor: "", label: "Automático (según reparaciones)" },
  { valor: "Fuera de servicio", label: "🔴 Fuera de servicio (dañado, no sirve)" },
  { valor: "Almacenado", label: "📦 Almacenado (sirve, guardado)" },
];

// ─── HELPERS DE FORMULARIO ──────────────────────────────────────────────────
const getProductoVacio = () => ({
  nombre: "",
  categoria: "Otros",
  costo: "",
  estadoOverride: "",
  descripcion: "",
  numeroFactura: "",
  notas: "",
  fechaCompra: getLocalDateString(),
});

const productoDesdeActivo = (a) => ({
  nombre: a.nombre || "",
  categoria: a.categoria || "Otros",
  costo: a.costo != null ? String(a.costo) : "",
  estadoOverride: a.estadoOverride || "",
  descripcion: a.descripcion || "",
  numeroFactura: a.numeroFactura || "",
  notas: a.notas || "",
  fechaCompra: fechaParaInput(a.fechaCompra),
});

const getReparacionVacia = () => ({
  costo: "",
  problemaTecnico: "",
  reparadoPor: "",
  fecha: getLocalDateString(),
  finalizada: false,
});

const reparacionDesde = (r) => ({
  costo: r.costo != null ? String(r.costo) : "",
  problemaTecnico: r.problemaTecnico || "",
  reparadoPor: r.reparadoPor || "",
  fecha: fechaParaInput(r.fecha),
  finalizada: !!r.finalizada,
});

// El activo puede venir directo o envuelto en { data } según el endpoint
const activoDeRespuesta = (res) => res?.data?.data ?? res?.data ?? null;

// ─── LIGHTBOX ────────────────────────────────────────────────────────────────
const Lightbox = ({ url, alt, onCerrar }) => (
  <div className="lightbox-overlay" onClick={onCerrar}>
    <button className="lightbox-cerrar" onClick={onCerrar} aria-label="Cerrar imagen">✕</button>
    <img src={url} alt={alt} className="lightbox-img" onClick={(e) => e.stopPropagation()} />
  </div>
);

// ─── BLOQUE DE IMAGEN EN LOS FORMULARIOS ────────────────────────────────────
const CampoImagen = ({ etiqueta, urlActual, imagenData, quitar, onChange, onQuitar, uploadRef, disabled }) => {
  // En edición con imagen existente: mostrarla hasta que se pida cambiarla
  const [cambiando, setCambiando] = useState(!urlActual);

  const quitarNueva = () => {
    uploadRef.current?.reset();
    onChange(null);
  };

  // Se marcó quitar la imagen guardada: se eliminará (también de Cloudinary) al guardar
  if (quitar) {
    return (
      <div>
        <label className="admin-label">{etiqueta}</label>
        <div className="aviso-quitar fade-in">
          <p className="mb-2">🗑️ La imagen se eliminará al guardar.</p>
          <button type="button" className="admin-btn-ghost" onClick={() => onQuitar(false)} disabled={disabled}>
            ↩ Deshacer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="admin-label">{etiqueta}</label>
      {!cambiando && urlActual ? (
        <div className="imagen-actual">
          <img src={urlActual} alt={etiqueta} className="imagen-actual__img" />
          <div className="d-flex gap-2 mt-2 flex-wrap">
            <button type="button" className="admin-btn-ghost" onClick={() => setCambiando(true)} disabled={disabled}>
              🔄 Cambiar imagen
            </button>
            <button
              type="button"
              className="admin-btn-ghost admin-btn-ghost--rojo"
              onClick={() => onQuitar(true)}
              disabled={disabled}
            >
              🗑️ Quitar imagen
            </button>
          </div>
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

// ─── MODAL CREAR / EDITAR PRODUCTO ──────────────────────────────────────────
// Solo datos del producto. Las reparaciones se manejan aparte (botón 🔧).
// NUNCA se envía `estado`: lo calcula el backend. Acá solo se setea `estadoOverride`.
const ProductoFormModal = ({ activo, getAuthHeaders, mostrarNotif, manejarError, onCerrar, onExito }) => {
  const esEdicion = !!activo;

  const [form, setForm] = useState(() => (esEdicion ? productoDesdeActivo(activo) : getProductoVacio()));
  const [errores, setErrores] = useState({});
  const [imagenData, setImagenData] = useState(null);
  const [facturaData, setFacturaData] = useState(null);
  const [quitarImagen, setQuitarImagen] = useState(false);
  const [quitarFactura, setQuitarFactura] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [proximaPlaca, setProximaPlaca] = useState(null);
  const imageRef = useRef(null);
  const facturaRef = useRef(null);

  const setField = (field) => (e) => {
    const valor = e.target.value;
    setForm((f) => ({ ...f, [field]: valor }));
    setErrores((er) => ({ ...er, [field]: "" }));
  };

  // Vista previa de la placa que asignaría el backend (solo al crear).
  useEffect(() => {
    if (esEdicion) return undefined;
    let cancelado = false;
    (async () => {
      const axios = await getAxios();
      try {
        const res = await axios.get(`${API_URL}/api/activos-sala/proxima-placa`, getAuthHeaders());
        if (res.data?.proximaPlaca != null) {
          if (!cancelado) setProximaPlaca(res.data.proximaPlaca);
          return;
        }
      } catch {
        /* sin endpoint todavía: estimamos abajo */
      }
      try {
        const res = await axios.get(`${API_URL}/api/activos-sala`, {
          params: { page: 1, limit: 200 },
          ...getAuthHeaders(),
        });
        const data = res.data?.data || [];
        const maxPlaca = data.reduce((m, a) => Math.max(m, Number(a.numeroPlaca) || 0), 0);
        const total = res.data?.pagination?.totalItems ?? data.length;
        const estimada = maxPlaca > 0 ? maxPlaca + 1 : (total || 0) + 1;
        if (!cancelado) setProximaPlaca(estimada);
      } catch {
        /* La vista previa es opcional */
      }
    })();
    return () => { cancelado = true; };
  }, [esEdicion, getAuthHeaders]);

  const validar = () => {
    const e = {};
    if (!form.nombre.trim()) e.nombre = "El nombre es obligatorio";
    if (!form.costo || Number(form.costo) <= 0) e.costo = "Ingresá un costo mayor a 0";
    if (form.fechaCompra && form.fechaCompra > getLocalDateString()) {
      e.fechaCompra = "La fecha no puede ser futura";
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

    if (!esEdicion) {
      return {
        nombre: form.nombre.trim(),
        categoria: form.categoria,
        costo: Number(form.costo),
        ...(form.estadoOverride && { estadoOverride: form.estadoOverride }),
        ...(form.descripcion.trim() && { descripcion: form.descripcion.trim() }),
        ...(form.numeroFactura.trim() && { numeroFactura: form.numeroFactura.trim() }),
        ...(form.notas.trim() && { notas: form.notas.trim() }),
        ...(form.fechaCompra && { fechaCompra: form.fechaCompra }),
        ...camposImagen,
      };
    }

    // Edición: enviar solo lo que cambió
    const payload = { ...camposImagen };
    const original = productoDesdeActivo(activo);
    if (form.nombre.trim() !== original.nombre) payload.nombre = form.nombre.trim();
    if (form.categoria !== original.categoria) payload.categoria = form.categoria;
    if (Number(form.costo) !== Number(original.costo)) payload.costo = Number(form.costo);
    if (form.estadoOverride !== original.estadoOverride) payload.estadoOverride = form.estadoOverride || null;
    ["descripcion", "numeroFactura", "notas"].forEach((k) => {
      if (form[k].trim() !== original[k]) payload[k] = form[k].trim();
    });
    if (form.fechaCompra !== original.fechaCompra && form.fechaCompra) {
      payload.fechaCompra = form.fechaCompra;
    }
    if (quitarImagen && !imagenData) payload.eliminarImagen = true;
    if (quitarFactura && !facturaData) payload.eliminarImagenFactura = true;
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
      const res = esEdicion
        ? await axios.put(`${API_URL}/api/activos-sala/${activo._id}`, payload, getAuthHeaders())
        : await axios.post(`${API_URL}/api/activos-sala`, payload, getAuthHeaders());
      mostrarNotif(res.data?.message || (esEdicion ? "Producto actualizado" : "Activo registrado"));
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
        <span>🛒</span>
        {esEdicion ? "Editar producto" : "Registrar producto"}
        <button className="admin-modal__cerrar" onClick={onCerrar} disabled={guardando} aria-label="Cerrar">✕</button>
      </div>
      <form className="admin-modal__body" onSubmit={handleSubmit} noValidate>
        {!esEdicion && (
          <div className="aviso-mes mb-4">
            💡 Acá registrás solo <strong>el producto</strong>. Las reparaciones se agregan
            después, con el botón <strong>🔧 Reparaciones</strong> en la card de cada producto.
          </div>
        )}

        <div className="row g-3">
          {!esEdicion && (
            <div className="col-12">
              <label className="admin-label">Número de placa (vista previa)</label>
              <div className="placa-preview">
                <span className="placa-preview__label">Así va a quedar</span>
                <span className="placa-preview__chip">
                  {proximaPlaca != null ? formatPlaca(proximaPlaca) : "Calculando…"}
                </span>
                <small className="admin-hint">El número final se asigna automáticamente al guardar</small>
              </div>
            </div>
          )}

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
            <label className="admin-label">Costo de compra *</label>
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

          <div className="col-12 col-sm-6">
            <label className="admin-label">Categoría</label>
            <select
              className="form-select admin-select"
              value={form.categoria}
              disabled={guardando}
              onChange={setField("categoria")}
            >
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>{`${CATEGORIA_ICONO[c]} ${c}`}</option>
              ))}
            </select>
            <small className="admin-hint">Usá «Otros» para lo que no sea control/consola/pantalla</small>
          </div>

          <div className="col-12 col-sm-6">
            <label className="admin-label">Fecha de compra</label>
            <input
              type="date"
              className={`form-control admin-input ${errores.fechaCompra ? "admin-input--error" : ""}`}
              value={form.fechaCompra}
              max={getLocalDateString()}
              disabled={guardando}
              onChange={setField("fechaCompra")}
            />
            {errores.fechaCompra && <div className="campo-error">{errores.fechaCompra}</div>}
          </div>

          {/* Estado: automático (solo lectura) + override manual para casos especiales */}
          {esEdicion && (
            <div className="col-12 col-sm-6">
              <label className="admin-label">Estado actual</label>
              <div>
                <span className={`estado-badge estado-badge--${ESTADO_CLASE[activo.estado] || "gris"}`}>
                  {activo.estado}
                </span>
              </div>
              <small className="admin-hint">Se calcula solo según las reparaciones</small>
            </div>
          )}

          <div className="col-12 col-sm-6">
            <label className="admin-label">Marcar manualmente</label>
            <select
              className="form-select admin-select"
              value={form.estadoOverride}
              disabled={guardando}
              onChange={setField("estadoOverride")}
            >
              {ESTADO_OVERRIDE_OPCIONES.map((o) => (
                <option key={o.valor || "auto"} value={o.valor}>{o.label}</option>
              ))}
            </select>
            <small className="admin-hint">Solo para casos especiales: dañado o guardado</small>
          </div>

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
              placeholder="Descripción del artículo..."
              value={form.descripcion}
              disabled={guardando}
              onChange={setField("descripcion")}
            />
          </div>

          <div className="col-12 col-md-6">
            <CampoImagen
              etiqueta="📷 Foto del artículo"
              urlActual={esEdicion ? activo.imagenUrl : null}
              imagenData={imagenData}
              quitar={quitarImagen}
              onChange={(d) => { setImagenData(d); if (d) setQuitarImagen(false); }}
              onQuitar={(v) => { setQuitarImagen(v); if (v) { imageRef.current?.reset(); setImagenData(null); } }}
              uploadRef={imageRef}
              disabled={guardando}
            />
          </div>

          <div className="col-12 col-md-6">
            <CampoImagen
              etiqueta="🧾 Factura de compra"
              urlActual={esEdicion ? activo.imagenFacturaUrl : null}
              imagenData={facturaData}
              quitar={quitarFactura}
              onChange={(d) => { setFacturaData(d); if (d) setQuitarFactura(false); }}
              onQuitar={(v) => { setQuitarFactura(v); if (v) { facturaRef.current?.reset(); setFacturaData(null); } }}
              uploadRef={facturaRef}
              disabled={guardando}
            />
          </div>
        </div>

        <div className="d-flex gap-2 justify-content-end align-items-center mt-4 flex-wrap">
          <button type="button" className="admin-btn-ghost" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </button>
          <button type="submit" className="btn admin-btn admin-btn--orange px-4 fw-bold" disabled={guardando}>
            {guardando && <span className="btn-spinner" />}
            {guardando ? textoGuardando : esEdicion ? "Guardar cambios" : "Registrar producto"}
          </button>
        </div>
      </form>
    </ModalOverlay>
  );
};

// ─── MODAL DE REPARACIONES (historial: agregar / editar / eliminar) ─────────
// Se abre desde el botón 🔧 de la card. Dos vistas: la lista y el formulario.
// Cada operación pega a los endpoints /:id/reparaciones y el backend devuelve el
// activo completo con el estado ya recalculado.
const ReparacionesModal = ({ activo, getAuthHeaders, mostrarNotif, manejarError, onCerrar, onVerImagen }) => {
  const [reparaciones, setReparaciones] = useState(activo.reparaciones || []);
  const [vista, setVista] = useState("lista");     // "lista" | "form"
  const [editando, setEditando] = useState(null);  // reparación en edición, o null (nueva)
  const [aEliminar, setAEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);
  const [huboCambios, setHuboCambios] = useState(false);

  // Estado del formulario de reparación
  const [form, setForm] = useState(getReparacionVacia);
  const [errores, setErrores] = useState({});
  const [facturaData, setFacturaData] = useState(null);
  const [quitarFactura, setQuitarFactura] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const facturaRef = useRef(null);

  const total = reparaciones.reduce((s, r) => s + (Number(r.costo) || 0), 0);
  const bloqueado = guardando || eliminando;

  const aplicarActivo = (act) => {
    if (act && Array.isArray(act.reparaciones)) setReparaciones(act.reparaciones);
    setHuboCambios(true);
  };

  const setField = (field) => (e) => {
    const valor = e.target.value;
    setForm((f) => ({ ...f, [field]: valor }));
    setErrores((er) => ({ ...er, [field]: "" }));
  };

  const abrirNueva = () => {
    setEditando(null);
    setForm(getReparacionVacia());
    setFacturaData(null);
    setQuitarFactura(false);
    setErrores({});
    facturaRef.current?.reset?.();
    setVista("form");
  };

  const abrirEditar = (r) => {
    setEditando(r);
    setForm(reparacionDesde(r));
    setFacturaData(null);
    setQuitarFactura(false);
    setErrores({});
    facturaRef.current?.reset?.();
    setVista("form");
  };

  const validar = () => {
    const e = {};
    if (!form.costo || Number(form.costo) <= 0) e.costo = "Ingresá el costo (mayor a 0)";
    if (form.fecha && form.fecha > getLocalDateString()) e.fecha = "La fecha no puede ser futura";
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const guardar = async (ev) => {
    ev.preventDefault();
    if (!validar() || guardando) return;
    setGuardando(true);
    try {
      const axios = await getAxios();
      const payload = {
        costo: Number(form.costo),
        problemaTecnico: form.problemaTecnico.trim(),
        reparadoPor: form.reparadoPor.trim(),
        fecha: form.fecha,
        finalizada: form.finalizada,
        ...(facturaData?.base64 && {
          facturaBase64: facturaData.base64,
          facturaNombre: facturaData.file.name,
        }),
        ...(quitarFactura && !facturaData && editando?.facturaUrl && { eliminarFactura: true }),
      };
      const res = editando
        ? await axios.put(
            `${API_URL}/api/activos-sala/${activo._id}/reparaciones/${editando._id}`,
            payload,
            getAuthHeaders(),
          )
        : await axios.post(`${API_URL}/api/activos-sala/${activo._id}/reparaciones`, payload, getAuthHeaders());
      aplicarActivo(activoDeRespuesta(res));
      mostrarNotif(res.data?.message || (editando ? "Reparación actualizada" : "Reparación agregada"));
      setVista("lista");
    } catch (err) {
      manejarError(err);
    } finally {
      setGuardando(false);
    }
  };

  const confirmarEliminar = async () => {
    if (!aEliminar || eliminando) return;
    setEliminando(true);
    try {
      const axios = await getAxios();
      const res = await axios.delete(
        `${API_URL}/api/activos-sala/${activo._id}/reparaciones/${aEliminar._id}`,
        getAuthHeaders(),
      );
      const act = activoDeRespuesta(res);
      if (act && Array.isArray(act.reparaciones)) aplicarActivo(act);
      else { setReparaciones((prev) => prev.filter((r) => r._id !== aEliminar._id)); setHuboCambios(true); }
      mostrarNotif(res.data?.message || "Reparación eliminada");
      setAEliminar(null);
    } catch (err) {
      manejarError(err);
    } finally {
      setEliminando(false);
    }
  };

  const cerrar = () => { if (!bloqueado) onCerrar(huboCambios); };

  const textoGuardando = facturaData ? "Subiendo factura..." : "Guardando...";

  return (
    <ModalOverlay onCerrar={cerrar} bloqueado={bloqueado} className="admin-modal--grande">
      <div className="admin-modal__header admin-panel__header--orange">
        <span>🔧</span>
        {vista === "form"
          ? editando ? "Editar reparación" : "Nueva reparación"
          : `Reparaciones — ${activo.nombre}`}
        <button className="admin-modal__cerrar" onClick={cerrar} disabled={bloqueado} aria-label="Cerrar">✕</button>
      </div>

      <div className="admin-modal__body">
        {vista === "form" ? (
          <form onSubmit={guardar} noValidate>
            <div className="aviso-mes mb-4">
              🔧 Reparación de <strong>{activo.nombre}</strong>. El costo de compra
              ({formatCRC(activo.costo)}) <strong>no se modifica</strong>.
            </div>
            <div className="row g-3">
              <div className="col-12 col-sm-6">
                <label className="admin-label">Costo de la reparación *</label>
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
                  : <small className="admin-hint">No afecta el costo de compra</small>}
              </div>

              <div className="col-12 col-sm-6">
                <label className="admin-label">Fecha de la reparación</label>
                <input
                  type="date"
                  className={`form-control admin-input ${errores.fecha ? "admin-input--error" : ""}`}
                  value={form.fecha}
                  max={getLocalDateString()}
                  disabled={guardando}
                  onChange={setField("fecha")}
                />
                {errores.fecha && <div className="campo-error">{errores.fecha}</div>}
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

              <div className="col-12 col-sm-6">
                <label className="admin-label">¿La reparación ya está lista?</label>
                <select
                  className="form-select admin-select"
                  value={form.finalizada ? "si" : "no"}
                  disabled={guardando}
                  onChange={(e) => setForm((f) => ({ ...f, finalizada: e.target.value === "si" }))}
                >
                  <option value="no">🔧 En proceso (sigue en reparación)</option>
                  <option value="si">✅ Lista (ya reparado)</option>
                </select>
                <small className="admin-hint">Define el estado del activo automáticamente</small>
              </div>

              <div className="col-12 col-md-6">
                <CampoImagen
                  etiqueta="🧾 Factura de la reparación"
                  urlActual={editando?.facturaUrl || null}
                  imagenData={facturaData}
                  quitar={quitarFactura}
                  onChange={(d) => { setFacturaData(d); if (d) setQuitarFactura(false); }}
                  onQuitar={(v) => { setQuitarFactura(v); if (v) { facturaRef.current?.reset(); setFacturaData(null); } }}
                  uploadRef={facturaRef}
                  disabled={guardando}
                />
              </div>
            </div>

            <div className="d-flex gap-2 justify-content-end align-items-center mt-4 flex-wrap">
              <button
                type="button"
                className="admin-btn-ghost"
                onClick={() => setVista("lista")}
                disabled={guardando}
              >
                ← Volver
              </button>
              <button type="submit" className="btn admin-btn admin-btn--orange px-4 fw-bold" disabled={guardando}>
                {guardando && <span className="btn-spinner" />}
                {guardando ? textoGuardando : editando ? "Guardar reparación" : "Agregar reparación"}
              </button>
            </div>
          </form>
        ) : aEliminar ? (
          <div className="aviso-quitar fade-in">
            <p className="mb-2">
              ¿Eliminar la reparación de <strong>{formatCRC(aEliminar.costo)}</strong>
              {aEliminar.problemaTecnico ? <> · {aEliminar.problemaTecnico}</> : null}? También se
              borra su factura. Esta acción no se puede deshacer.
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
                {reparaciones.length} {reparaciones.length === 1 ? "reparación" : "reparaciones"} · total invertido
              </span>
              <span className="rep-total__monto">{formatCRC(total)}</span>
            </div>

            <button className="btn admin-btn admin-btn--orange fw-bold w-100 mb-3" onClick={abrirNueva}>
              ＋ Agregar reparación
            </button>

            {reparaciones.length === 0 ? (
              <EstadoVacio icono="🔧" mensaje="Este activo no tiene reparaciones todavía" />
            ) : (
              <div className="rep-lista">
                {reparaciones.map((r) => (
                  <div key={r._id} className="rep-item">
                    <div className="rep-item__top">
                      <span className="rep-item__monto">{formatCRC(r.costo)}</span>
                      <span
                        className={`estado-badge estado-badge--${r.finalizada ? "azul" : "amarillo"}`}
                      >
                        {r.finalizada ? "✅ Lista" : "🔧 En proceso"}
                      </span>
                    </div>
                    {r.fecha && <div className="rep-item__fecha">📅 {formatFecha(r.fecha)}</div>}
                    {r.problemaTecnico && (
                      <div className="rep-item__dato"><strong>Problema:</strong> {r.problemaTecnico}</div>
                    )}
                    {r.reparadoPor && (
                      <div className="rep-item__dato"><strong>Reparado por:</strong> {r.reparadoPor}</div>
                    )}
                    {r.facturaUrl && (
                      <button
                        type="button"
                        className="rep-item__factura"
                        onClick={() => onVerImagen(r.facturaUrl, `Factura de reparación de ${activo.nombre}`)}
                        title="Ver factura"
                      >
                        <img src={r.facturaUrl} alt="Factura de la reparación" loading="lazy" />
                      </button>
                    )}
                    <div className="rep-item__acciones">
                      <button className="accion-btn accion-btn--texto" onClick={() => abrirEditar(r)}>
                        ✏️ Editar
                      </button>
                      <button className="accion-btn accion-btn--rojo" onClick={() => setAEliminar(r)} title="Eliminar">
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

// ─── MODAL DE DETALLE (solo información) ─────────────────────────────────────
const ActivoDetalleModal = ({ activo, cargando, onCerrar, onVerImagen }) => {
  const reparaciones = Array.isArray(activo.reparaciones) ? activo.reparaciones : [];
  const numRep = reparaciones.length;
  const totalRep = reparaciones.reduce((s, r) => s + (Number(r.costo) || 0), 0);

  return (
    <ModalOverlay onCerrar={onCerrar} className="admin-modal--grande">
      <div className="admin-modal__header admin-panel__header--orange">
        <span>{numRep > 0 ? "🔧" : "🛒"}</span>
        {activo.nombre}
        <button className="admin-modal__cerrar" onClick={onCerrar} aria-label="Cerrar">✕</button>
      </div>
      <div className="admin-modal__body">
        {cargando && (
          <div className="text-center py-2">
            <small className="admin-hint">Actualizando información...</small>
          </div>
        )}

        {/* Imágenes del producto: foto + factura de compra (las de reparación van en el historial) */}
        {(() => {
          const imagenes = [
            activo.imagenUrl && {
              url: activo.imagenUrl, alt: activo.nombre,
              etiqueta: "📷 Artículo · tocá para ampliar",
            },
            activo.imagenFacturaUrl && {
              url: activo.imagenFacturaUrl, alt: `Factura de compra de ${activo.nombre}`,
              etiqueta: "🧾 Factura de compra · tocá para ampliar",
            },
          ].filter(Boolean);
          if (!imagenes.length) return null;
          const colClase = imagenes.length === 1 ? "col-12" : "col-12 col-sm-6";
          return (
            <div className="row g-3 mb-3">
              {imagenes.map((img, i) => (
                <div key={i} className={colClase}>
                  <button type="button" className="detalle-img-btn" onClick={() => onVerImagen(img.url, img.alt)}>
                    <img src={img.url} alt={img.alt} className="detalle-img" />
                    <span className="detalle-img__etiqueta">{img.etiqueta}</span>
                  </button>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Badges */}
        <div className="d-flex gap-2 flex-wrap mb-3 align-items-center">
          <span className="activo-card__placa activo-card__placa--detalle">{formatPlaca(activo)}</span>
          <span className={`estado-badge estado-badge--${ESTADO_CLASE[activo.estado] || "gris"}`}>
            {activo.estado}
          </span>
          {activo.estadoOverride && (
            <span className="activo-card__tipo-chip">✋ Estado manual</span>
          )}
          {numRep > 0 && (
            <span className="activo-card__tipo-chip activo-card__tipo-chip--orange">
              🔧 {numRep} {numRep === 1 ? "reparación" : "reparaciones"}
            </span>
          )}
        </div>

        {/* Datos del producto */}
        <div className="detalle-datos">
          <div className="detalle-dato">
            <span className="detalle-dato__label">Categoría</span>
            <span className="detalle-dato__valor">
              {CATEGORIA_ICONO[activo.categoria] || "📦"} {activo.categoria || "Otros"}
            </span>
          </div>
          <div className="detalle-dato">
            <span className="detalle-dato__label">Costo de compra</span>
            <span className="detalle-dato__valor detalle-dato__valor--monto">{formatCRC(activo.costo)}</span>
          </div>
          {numRep > 0 && (
            <div className="detalle-dato">
              <span className="detalle-dato__label">🔧 Total en reparaciones</span>
              <span className="detalle-dato__valor detalle-dato__valor--monto-rep">{formatCRC(totalRep)}</span>
            </div>
          )}
          {activo.fechaCompra && (
            <div className="detalle-dato">
              <span className="detalle-dato__label">Fecha de compra</span>
              <span className="detalle-dato__valor">{formatFecha(activo.fechaCompra)}</span>
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
          {activo.notas && (
            <div className="detalle-dato">
              <span className="detalle-dato__label">Notas</span>
              <span className="detalle-dato__valor">{activo.notas}</span>
            </div>
          )}
        </div>

        {/* Historial de reparaciones (solo lectura; se gestiona con el botón 🔧 de la card) */}
        {numRep > 0 && (
          <div className="mt-4">
            <div className="seccion-reparacion__titulo mb-2">🔧 Historial de reparaciones</div>
            <div className="rep-lista">
              {reparaciones.map((r) => (
                <div key={r._id} className="rep-item">
                  <div className="rep-item__top">
                    <span className="rep-item__monto">{formatCRC(r.costo)}</span>
                    <span className={`estado-badge estado-badge--${r.finalizada ? "azul" : "amarillo"}`}>
                      {r.finalizada ? "✅ Lista" : "🔧 En proceso"}
                    </span>
                  </div>
                  {r.fecha && <div className="rep-item__fecha">📅 {formatFecha(r.fecha)}</div>}
                  {r.problemaTecnico && (
                    <div className="rep-item__dato"><strong>Problema:</strong> {r.problemaTecnico}</div>
                  )}
                  {r.reparadoPor && (
                    <div className="rep-item__dato"><strong>Reparado por:</strong> {r.reparadoPor}</div>
                  )}
                  {r.facturaUrl && (
                    <button
                      type="button"
                      className="rep-item__factura"
                      onClick={() => onVerImagen(r.facturaUrl, `Factura de reparación de ${activo.nombre}`)}
                      title="Ver factura"
                    >
                      <img src={r.facturaUrl} alt="Factura de la reparación" loading="lazy" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
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
  const [filtroReparacion, setFiltroReparacion] = useState("Todos");
  const [filtroCategoria, setFiltroCategoria] = useState("Todas");

  const [modalForm, setModalForm] = useState(null);        // null | { activo: null | obj }
  const [reparacionesDe, setReparacionesDe] = useState(null); // null | activo
  const [detalle, setDetalle] = useState(null);            // null | activo
  const [detalleCargando, setDetalleCargando] = useState(false);
  const [aEliminar, setAEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);
  const [lightbox, setLightbox] = useState(null);          // null | { url, alt }

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
      if (filtroReparacion === "con") params.conReparacion = true;
      else if (filtroReparacion === "sin") params.conReparacion = false;
      if (filtroCategoria !== "Todas") params.categoria = filtroCategoria;
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
  }, [page, busquedaDebounced, filtroReparacion, filtroCategoria, getAuthHeaders, manejarError]);

  useEffect(() => { fetchActivos(); }, [fetchActivos]);

  const cambiarFiltroReparacion = (f) => {
    setFiltroReparacion(f);
    setPage(1);
  };

  const cambiarFiltroCategoria = (c) => {
    setFiltroCategoria(c);
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

  const cerrarReparaciones = (huboCambios) => {
    setReparacionesDe(null);
    if (huboCambios) fetchActivos();
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

  const hayFiltros = busquedaDebounced || filtroReparacion !== "Todos" || filtroCategoria !== "Todas";

  return (
    <div className="fade-in">
      {/* Encabezado: búsqueda + botón */}
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

      {/* Filtros: chips en desktop / desplegables nativos en móvil (mismo estado) */}
      <div className="activos-filtros-titulo">🔎 Filtros</div>
      <div className="activos-filtros activos-filtros--desktop mb-4">
        <div className="filtro-grupo">
          <span className="filtro-grupo__label">Reparación</span>
          <div className="filtro-chips">
            {FILTROS_REPARACION.map((f) => (
              <button
                key={f.valor}
                className={`filtro-chip ${filtroReparacion === f.valor ? "filtro-chip--activo" : ""}`}
                onClick={() => cambiarFiltroReparacion(f.valor)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="filtro-grupo">
          <span className="filtro-grupo__label">Categoría</span>
          <div className="filtro-chips">
            {FILTROS_CATEGORIA.map((f) => (
              <button
                key={f.valor}
                className={`filtro-chip ${filtroCategoria === f.valor ? "filtro-chip--activo" : ""}`}
                onClick={() => cambiarFiltroCategoria(f.valor)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="activos-filtros-movil mb-4">
        <div className="filtro-grupo">
          <label className="filtro-grupo__label" htmlFor="filtro-reparacion">Reparación</label>
          <select
            id="filtro-reparacion"
            className="form-select admin-select"
            value={filtroReparacion}
            onChange={(e) => cambiarFiltroReparacion(e.target.value)}
          >
            {FILTROS_REPARACION.map((f) => (
              <option key={f.valor} value={f.valor}>{f.label}</option>
            ))}
          </select>
        </div>

        <div className="filtro-grupo">
          <label className="filtro-grupo__label" htmlFor="filtro-categoria">Categoría</label>
          <select
            id="filtro-categoria"
            className="form-select admin-select"
            value={filtroCategoria}
            onChange={(e) => cambiarFiltroCategoria(e.target.value)}
          >
            {FILTROS_CATEGORIA.map((f) => (
              <option key={f.valor} value={f.valor}>{f.label}</option>
            ))}
          </select>
        </div>
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
              const reps = Array.isArray(a.reparaciones) ? a.reparaciones : [];
              const numRep = reps.length;
              const esRep = numRep > 0;
              const costoReparaciones = reps.reduce((s, r) => s + (Number(r.costo) || 0), 0);
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
                      <div className="activo-card__placa-row">
                        <span className="activo-card__placa">{formatPlaca(a)}</span>
                        <h6 className="activo-card__nombre">{a.nombre}</h6>
                      </div>
                      <div className="d-flex align-items-center gap-2 flex-wrap mt-2">
                        <span className="activo-card__tipo-chip">
                          {CATEGORIA_ICONO[a.categoria] || "📦"} {a.categoria || "Otros"}
                        </span>
                        <span className={`estado-badge estado-badge--${ESTADO_CLASE[a.estado] || "gris"}`}>
                          {a.estado}
                        </span>
                        {numRep > 0 && (
                          <span className="activo-card__tipo-chip activo-card__tipo-chip--orange">
                            🔧 {numRep} {numRep === 1 ? "reparación" : "reparaciones"}
                          </span>
                        )}
                      </div>
                      {/* Costo de compra y, aparte, lo invertido en reparaciones */}
                      <div className="activo-card__costos mt-2">
                        <div className="activo-card__costo-fila">
                          <span className="activo-card__costo-label">🛒 Costo de compra</span>
                          <strong className="activo-card__costo">{formatCRC(a.costo)}</strong>
                        </div>
                        {numRep > 0 && (
                          <div className="activo-card__costo-fila">
                            <span className="activo-card__costo-label">🔧 Reparaciones</span>
                            <strong className="activo-card__costo activo-card__costo--rep">
                              {formatCRC(costoReparaciones)}
                            </strong>
                          </div>
                        )}
                      </div>
                      {/* Señal de que la card se abre para ver todo */}
                      <div className="activo-card__vermas">Ver detalle →</div>
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
                          onClick={() => setReparacionesDe(a)}
                          aria-label={`Reparaciones de ${a.nombre}`}
                        >
                          {esRep ? "🔧 Reparaciones" : "🔧 Reparar"}
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
        <ProductoFormModal
          activo={modalForm.activo}
          getAuthHeaders={getAuthHeaders}
          mostrarNotif={mostrarNotif}
          manejarError={manejarError}
          onCerrar={() => setModalForm(null)}
          onExito={() => handleExitoForm(!!modalForm.activo)}
        />
      )}

      {reparacionesDe && (
        <ReparacionesModal
          activo={reparacionesDe}
          getAuthHeaders={getAuthHeaders}
          mostrarNotif={mostrarNotif}
          manejarError={manejarError}
          onCerrar={cerrarReparaciones}
          onVerImagen={(url, alt) => setLightbox({ url, alt })}
        />
      )}

      {detalle && !modalForm && !reparacionesDe && !aEliminar && (
        <ActivoDetalleModal
          activo={detalle}
          cargando={detalleCargando}
          onCerrar={() => setDetalle(null)}
          onVerImagen={(url, alt) => setLightbox({ url, alt })}
        />
      )}

      {aEliminar && (
        <ConfirmarEliminar
          detalle={`${aEliminar.nombre} · ${formatCRC(aEliminar.costo)}. También se eliminarán sus imágenes y reparaciones.`}
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
