// Módulo de Juegos: el catálogo de lo que se puede jugar en la sala.
//
// Es el ÚNICO lugar donde se administran los juegos. Lo que se anote acá
// aparece solo en el selector del play y, si se le pone portada y se marca,
// en la página principal.
//
// La plata no vive acá: un juego comprado se guarda como un activo normal
// —con su placa y su factura— y esta ficha solo lo apunta. Por eso un juego
// de PS Plus no toca ningún reporte, y por eso un juego con compras no se
// puede borrar: eso le sacaría plata a un mes ya cerrado. Para esos está
// "dejar de ofrecerlo".
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import ImageUploadWithCompression from "../ImageUploadWithCompression";
import { API_URL, getAxios, formatCRC, formatPlaca, getLocalDateString } from "./adminUtils";
import { ModalOverlay, ErrorRecarga, EstadoVacio, Cargando } from "./Comunes";

const FILTROS = [
  { id: "todos", label: "Todos" },
  { id: "vitrina", label: "⭐ En la página" },
  { id: "comprados", label: "🛒 Comprados" },
  { id: "extras", label: "🧩 Complementos" },
];

// Cómo se guarda la compra en Activos según lo que se esté comprando.
const TIPOS_COMPRA = [
  { id: "digital", label: "💾 Juego digital" },
  { id: "fisico", label: "💿 Juego físico" },
];

const sinTildes = (s) =>
  (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const formVacio = () => ({
  nombre: "",
  seCompro: false,
  tipo: "digital",
  costo: "",
  fechaCompra: getLocalDateString(),
  numeroFactura: "",
  nombreInventario: "",
});

// ─── CAMPO DE PORTADA ────────────────────────────────────────────────────────
// Muestra la que ya tiene y permite cambiarla o quitarla, igual que el campo
// de imagen de Activos.
const CampoPortada = ({ urlActual, imagenData, onChange, onProcesando, onQuitar, quitada, disabled }) => {
  const [cambiando, setCambiando] = useState(false);
  const uploadRef = useRef(null);

  const mostrarActual = !cambiando && !quitada && urlActual && !imagenData;

  return (
    <div className="mb-3">
      <label className="form-label fw-bold">Portada (opcional)</label>
      {mostrarActual ? (
        <div className="imagen-actual">
          <img src={urlActual} alt="Portada" className="imagen-actual__img" />
          <div className="d-flex gap-2 mt-2 flex-wrap">
            <button type="button" className="admin-btn-ghost" onClick={() => setCambiando(true)} disabled={disabled}>
              🔄 Cambiar portada
            </button>
            <button
              type="button"
              className="admin-btn-ghost admin-btn-ghost--rojo"
              onClick={() => onQuitar(true)}
              disabled={disabled}
            >
              🗑️ Quitar portada
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
            maxWidthOrHeight={1000}
            disabled={disabled}
          />
          {(urlActual || imagenData) && (
            <button
              type="button"
              className="admin-btn-ghost mt-2"
              onClick={() => { onChange(null); onQuitar(false); setCambiando(false); }}
              disabled={disabled}
            >
              ↩ Dejar la portada como estaba
            </button>
          )}
        </>
      )}
      <small className="text-muted d-block mt-1">
        Solo hace falta para los que quieras mostrar en la página principal.
      </small>
    </div>
  );
};

// ─── MODAL: CREAR O EDITAR UN JUEGO ──────────────────────────────────────────
const JuegoFormModal = ({ juego, nombreSugerido, getAuthHeaders, mostrarNotif, manejarError, onCerrar, onExito }) => {
  const esEdicion = !!juego;
  const yaTieneCompra = esEdicion && (juego.compras?.length > 0);

  const [form, setForm] = useState(() =>
    esEdicion
      ? { ...formVacio(), nombre: juego.nombre }
      : { ...formVacio(), nombre: nombreSugerido || "" }
  );
  const [imagenData, setImagenData] = useState(null);
  const [quitarPortada, setQuitarPortada] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const set = (campo) => (e) => setForm((p) => ({ ...p, [campo]: e.target.value }));

  const guardar = async () => {
    if (!form.nombre.trim()) return mostrarNotif("Poné el nombre del juego", "warning");
    if (form.seCompro) {
      if (!(Number(form.costo) > 0)) return mostrarNotif("El costo tiene que ser mayor a 0", "warning");
      if (!form.fechaCompra) return mostrarNotif("Poné la fecha de compra", "warning");
    }

    setGuardando(true);
    try {
      const axios = await getAxios();
      const payload = { nombre: form.nombre.trim() };
      if (imagenData) {
        payload.portadaBase64 = imagenData.base64;
        payload.portadaNombre = imagenData.file.name;
        payload.portadaMimeType = imagenData.file.type;
      }

      if (esEdicion) {
        if (quitarPortada) payload.quitarPortada = true;
        await axios.put(`${API_URL}/api/juegos/${juego._id}`, payload, getAuthHeaders());
        mostrarNotif("Juego guardado");
      } else {
        if (form.seCompro) {
          payload.compra = {
            tipo: form.tipo,
            costo: Number(form.costo),
            fechaCompra: form.fechaCompra,
            numeroFactura: form.numeroFactura.trim() || undefined,
            nombreInventario: form.nombreInventario.trim() || undefined,
          };
        }
        const { data } = await axios.post(`${API_URL}/api/juegos`, payload, getAuthHeaders());
        mostrarNotif(data?.message || "Juego guardado");
      }
      onExito();
    } catch (error) {
      manejarError(error);
    } finally {
      setGuardando(false);
    }
  };

  const bloqueado = guardando || procesando;

  return (
    <ModalOverlay onCerrar={onCerrar} bloqueado={bloqueado}>
      <div className="admin-modal__header">
        <h5 className="mb-0">{esEdicion ? "✏️ Editar juego" : "🎮 Nuevo juego"}</h5>
        <button className="admin-modal__cerrar" onClick={onCerrar} disabled={bloqueado} aria-label="Cerrar">✕</button>
      </div>

      <div className="admin-modal__body">
        <div className="mb-3">
          <label className="form-label fw-bold">Nombre del juego *</label>
          <input
            className="form-control admin-input"
            value={form.nombre}
            onChange={set("nombre")}
            placeholder="Ej: Tekken 8"
            autoFocus
            disabled={bloqueado}
          />
          <small className="text-muted">Es el nombre que se ve al cobrar y en la página.</small>
        </div>

        <CampoPortada
          urlActual={juego?.imagenUrl}
          imagenData={imagenData}
          onChange={setImagenData}
          onProcesando={setProcesando}
          onQuitar={setQuitarPortada}
          quitada={quitarPortada}
          disabled={bloqueado}
        />

        {/* La compra solo se pregunta al crear: después se agrega desde el
            juego, para no tener dos formas de crear la misma plata. */}
        {!esEdicion && (
          <>
            <hr className="my-3" />
            <label className="form-label fw-bold">¿Se compró?</label>

            <button
              type="button"
              className={`jg-opcion ${!form.seCompro ? "jg-opcion--activa" : ""}`}
              onClick={() => setForm((p) => ({ ...p, seCompro: false }))}
              disabled={bloqueado}
            >
              <strong>No — PS Plus, gratuito o demo</strong>
              <small>No se crea ningún activo y no aparece en ningún reporte.</small>
            </button>

            <button
              type="button"
              className={`jg-opcion ${form.seCompro ? "jg-opcion--activa" : ""}`}
              onClick={() => setForm((p) => ({ ...p, seCompro: true }))}
              disabled={bloqueado}
            >
              <strong>Sí — es un activo de la sala</strong>
              <small>Se registra como activo, con su placa, y entra a los reportes.</small>
            </button>

            {form.seCompro && (
              <div className="jg-compra">
                <div className="row g-2">
                  <div className="col-12 col-sm-6">
                    <label className="form-label">Tipo</label>
                    <select className="form-select admin-select" value={form.tipo} onChange={set("tipo")} disabled={bloqueado}>
                      {TIPOS_COMPRA.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="col-12 col-sm-6">
                    <label className="form-label">Costo *</label>
                    <input
                      type="number" min="1"
                      className="form-control admin-input"
                      value={form.costo} onChange={set("costo")} placeholder="25000" disabled={bloqueado}
                    />
                  </div>
                  <div className="col-12 col-sm-6">
                    <label className="form-label">Fecha de compra *</label>
                    <input
                      type="date"
                      className="form-control admin-input"
                      value={form.fechaCompra} onChange={set("fechaCompra")} disabled={bloqueado}
                    />
                    <small className="text-muted">Define en qué mes cuenta el gasto.</small>
                  </div>
                  <div className="col-12 col-sm-6">
                    <label className="form-label">N° de factura</label>
                    <input
                      className="form-control admin-input"
                      value={form.numeroFactura} onChange={set("numeroFactura")} placeholder="opcional" disabled={bloqueado}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label">Nombre en el inventario</label>
                    <input
                      className="form-control admin-input"
                      value={form.nombreInventario} onChange={set("nombreInventario")}
                      placeholder="si lo dejás vacío se usa el mismo nombre" disabled={bloqueado}
                    />
                    <small className="text-muted">
                      Así el inventario puede decir "Juego: COD BO2" y el cliente ver el nombre lindo.
                    </small>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {esEdicion && yaTieneCompra && (
          <div className="jg-nota">
            🛒 Este juego tiene compras registradas. Para cambiar montos o agregar otra,
            usá la sección "Lo que costó" del juego.
          </div>
        )}
      </div>

      <div className="admin-modal__footer">
        <button className="admin-btn-ghost" onClick={onCerrar} disabled={bloqueado}>Cancelar</button>
        <button className="btn admin-btn admin-btn--orange fw-bold" onClick={guardar} disabled={bloqueado}>
          {guardando ? "Guardando..." : procesando ? "Procesando imagen..." : "Guardar"}
        </button>
      </div>
    </ModalOverlay>
  );
};

// ─── MODAL: AGREGAR UN COMPLEMENTO ───────────────────────────────────────────
const ComplementoFormModal = ({ juego, getAuthHeaders, mostrarNotif, manejarError, onCerrar, onExito }) => {
  const [form, setForm] = useState(() => ({ ...formVacio(), seCompro: true }));
  const [guardando, setGuardando] = useState(false);
  const set = (campo) => (e) => setForm((p) => ({ ...p, [campo]: e.target.value }));

  const guardar = async () => {
    if (!form.nombre.trim()) return mostrarNotif("Poné qué es", "warning");
    if (form.seCompro) {
      if (!(Number(form.costo) > 0)) return mostrarNotif("El costo tiene que ser mayor a 0", "warning");
      if (!form.fechaCompra) return mostrarNotif("Poné la fecha de compra", "warning");
    }
    setGuardando(true);
    try {
      const axios = await getAxios();
      const payload = { nombre: form.nombre.trim(), padre: juego._id };
      if (form.seCompro) {
        payload.compra = {
          tipo: "complemento",
          costo: Number(form.costo),
          fechaCompra: form.fechaCompra,
          numeroFactura: form.numeroFactura.trim() || undefined,
          nombreInventario: form.nombreInventario.trim() || undefined,
        };
      }
      const { data } = await axios.post(`${API_URL}/api/juegos`, payload, getAuthHeaders());
      mostrarNotif(data?.message || "Complemento agregado");
      onExito();
    } catch (error) {
      manejarError(error);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ModalOverlay onCerrar={onCerrar} bloqueado={guardando}>
      <div className="admin-modal__header">
        <h5 className="mb-0">🧩 Agregar a "{juego.nombre}"</h5>
        <button className="admin-modal__cerrar" onClick={onCerrar} disabled={guardando} aria-label="Cerrar">✕</button>
      </div>

      <div className="admin-modal__body">
        <div className="mb-3">
          <label className="form-label fw-bold">¿Qué es? *</label>
          <input
            className="form-control admin-input"
            value={form.nombre} onChange={set("nombre")}
            placeholder="Ej: Mapas temporada 1" autoFocus disabled={guardando}
          />
          <small className="text-muted">Mapas, pases, monedas: lo que se le suma al juego.</small>
        </div>

        <label className="form-label fw-bold">¿Se compró?</label>
        <button
          type="button"
          className={`jg-opcion ${!form.seCompro ? "jg-opcion--activa" : ""}`}
          onClick={() => setForm((p) => ({ ...p, seCompro: false }))}
          disabled={guardando}
        >
          <strong>No — vino con PS Plus o es gratis</strong>
          <small>Queda anotado en el juego, sin plata. No toca reportes.</small>
        </button>
        <button
          type="button"
          className={`jg-opcion ${form.seCompro ? "jg-opcion--activa" : ""}`}
          onClick={() => setForm((p) => ({ ...p, seCompro: true }))}
          disabled={guardando}
        >
          <strong>Sí — se pagó aparte</strong>
          <small>Se registra como activo en la categoría Complementos.</small>
        </button>

        {form.seCompro && (
          <div className="jg-compra">
            <div className="row g-2">
              <div className="col-12 col-sm-6">
                <label className="form-label">Costo *</label>
                <input
                  type="number" min="1" className="form-control admin-input"
                  value={form.costo} onChange={set("costo")} placeholder="8000" disabled={guardando}
                />
              </div>
              <div className="col-12 col-sm-6">
                <label className="form-label">Fecha de compra *</label>
                <input
                  type="date" className="form-control admin-input"
                  value={form.fechaCompra} onChange={set("fechaCompra")} disabled={guardando}
                />
              </div>
              <div className="col-12">
                <label className="form-label">Nombre en el inventario</label>
                <input
                  className="form-control admin-input"
                  value={form.nombreInventario} onChange={set("nombreInventario")}
                  placeholder="opcional" disabled={guardando}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="admin-modal__footer">
        <button className="admin-btn-ghost" onClick={onCerrar} disabled={guardando}>Cancelar</button>
        <button className="btn admin-btn admin-btn--orange fw-bold" onClick={guardar} disabled={guardando}>
          {guardando ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </ModalOverlay>
  );
};

// ─── TARJETA ─────────────────────────────────────────────────────────────────
// Solo información: la portada, el nombre y los números que se leen de un
// vistazo. Las acciones viven adentro del juego, que es donde se ven las
// consecuencias de cada una.
const TarjetaJuego = ({ juego, onAbrir }) => (
  <button className={`jg-card ${juego.noSeOfrece ? "jg-card--retirado" : ""}`} onClick={() => onAbrir(juego)}>
    <div className="jg-card__portada">
      {juego.imagenUrl ? (
        <img src={juego.imagenUrl} alt={juego.nombre} loading="lazy" />
      ) : (
        <span className="jg-card__sinfoto">🎮</span>
      )}
      {juego.enVitrina && <span className="jg-card__marca jg-card__marca--star" title="Se muestra en la página">⭐</span>}
      {juego.noSeOfrece && <span className="jg-card__marca jg-card__marca--off" title="No se está ofreciendo">🚫</span>}
    </div>
    <div className="jg-card__info">
      <span className="jg-card__nombre">{juego.nombre}</span>
      <span className="jg-card__meta">
        {juego.gastado > 0 ? <strong>{formatCRC(juego.gastado)}</strong> : <span className="jg-gris">Gratis</span>}
        {juego.complementos?.length > 0 && <span className="jg-morado"> · 🧩{juego.complementos.length}</span>}
        <span className="jg-gris"> · {juego.plays} plays</span>
      </span>
    </div>
  </button>
);

// ─── DETALLE DEL JUEGO ───────────────────────────────────────────────────────
const DetalleJuego = ({ juego, getAuthHeaders, mostrarNotif, manejarError, onVolver, onCambio }) => {
  const [trabajando, setTrabajando] = useState(false);
  const [modal, setModal] = useState(null);   // "editar" | "complemento"

  const compraPropia = juego.compras?.[0] || null;
  const tieneCompras = juego.gastado > 0;

  const llamar = async (fn, mensaje) => {
    setTrabajando(true);
    try {
      const axios = await getAxios();
      await fn(axios);
      if (mensaje) mostrarNotif(mensaje);
      onCambio();
    } catch (error) {
      // El 409 de "tiene compras" trae su propia explicación: se muestra tal cual.
      const data = error?.response?.data;
      if (data?.code === "TIENE_COMPRAS") mostrarNotif(data.message, "warning");
      else manejarError(error);
    } finally {
      setTrabajando(false);
    }
  };

  const cambiarVitrina = () => {
    if (!juego.imagenUrl && !juego.enVitrina) {
      return mostrarNotif("Para mostrarlo en la página primero necesita una portada", "warning");
    }
    llamar(
      (axios) => axios.put(`${API_URL}/api/juegos/${juego._id}`, { enVitrina: !juego.enVitrina }, getAuthHeaders()),
      juego.enVitrina ? "Ya no se muestra en la página" : "Ahora se muestra en la página"
    );
  };

  const cambiarOferta = () => {
    const texto = juego.noSeOfrece
      ? `Volver a ofrecer "${juego.nombre}" al cobrar y en la página.`
      : `Dejar de ofrecer "${juego.nombre}".\n\nNo va a aparecer al cobrar ni en la página, pero lo que costó sigue contando en los reportes.`;
    if (!window.confirm(texto)) return;
    llamar(
      (axios) => axios.put(`${API_URL}/api/juegos/${juego._id}`, { noSeOfrece: !juego.noSeOfrece }, getAuthHeaders()),
      juego.noSeOfrece ? "Vuelve a ofrecerse" : "Ya no se ofrece"
    );
  };

  const borrar = () => {
    const extras = juego.complementos?.length
      ? `\n\nSe borran también sus ${juego.complementos.length} complemento(s).`
      : "";
    if (!window.confirm(`Borrar "${juego.nombre}" del catálogo.${extras}\n\nLos plays ya registrados NO se tocan.`)) return;
    llamar(async (axios) => {
      await axios.delete(`${API_URL}/api/juegos/${juego._id}`, getAuthHeaders());
      onVolver();
    }, `"${juego.nombre}" borrado`);
  };

  const borrarComplemento = (extra) => {
    if (extra.gastado > 0) {
      return mostrarNotif(
        `"${extra.nombre}" costó ${formatCRC(extra.gastado)}. Para sacarlo hay que dar de baja su compra.`,
        "warning"
      );
    }
    if (!window.confirm(`Borrar el complemento "${extra.nombre}".`)) return;
    llamar((axios) => axios.delete(`${API_URL}/api/juegos/${extra._id}`, getAuthHeaders()), "Complemento borrado");
  };

  const darDeBaja = (compra) => {
    if (!window.confirm(
      `Dar de baja la compra ${formatPlaca({ numeroPlaca: compra.numeroPlaca })} de ${formatCRC(compra.costo)}.\n\n` +
      `OJO: esto SÍ cambia los reportes del mes de esa compra.`
    )) return;
    llamar(
      (axios) => axios.delete(`${API_URL}/api/juegos/${juego._id}/compra/${compra.numeroPlaca}`, getAuthHeaders()),
      "Compra dada de baja. El reporte del mes se actualizó."
    );
  };

  const filaCompra = (compra, etiqueta) => (
    <div className="jg-linea" key={compra.numeroPlaca}>
      <span className="jg-linea__izq">
        {etiqueta}
        <span className="jg-placa">{formatPlaca({ numeroPlaca: compra.numeroPlaca })}</span>
      </span>
      <span className="jg-linea__monto">{formatCRC(compra.costo)}</span>
      <button className="jg-baja" onClick={() => darDeBaja(compra)} disabled={trabajando} title="Dar de baja esta compra">
        🗑️
      </button>
    </div>
  );

  return (
    <div className="fade-in">
      <button className="admin-btn-ghost mb-3" onClick={onVolver}>← Volver a Juegos</button>

      {juego.noSeOfrece && (
        <div className="jg-nota jg-nota--aviso mb-3">
          🚫 <strong>No se está ofreciendo</strong>: no aparece al cobrar ni en la página.
          Lo que costó sigue contando en los reportes.
        </div>
      )}

      <div className="jg-detalle">
        <div className="jg-detalle__portada">
          {juego.imagenUrl
            ? <img src={juego.imagenUrl} alt={juego.nombre} />
            : <span className="jg-card__sinfoto">🎮</span>}
        </div>

        <div className="jg-detalle__datos">
          <h4 className="jg-detalle__titulo">{juego.nombre}</h4>
          <div className="jg-tags">
            {juego.gastado > 0
              ? <span className="jg-tag jg-tag--compra">🛒 {formatCRC(juego.gastado)}</span>
              : <span className="jg-tag">🎁 Gratis</span>}
            {juego.enVitrina && <span className="jg-tag jg-tag--star">⭐ En la página</span>}
            <span className="jg-tag">🎮 {juego.plays} plays</span>
          </div>

          <label className="jg-switch">
            <input type="checkbox" checked={!!juego.enVitrina} onChange={cambiarVitrina} disabled={trabajando} />
            <span>
              ⭐ Mostrarlo en la página principal
              {!juego.imagenUrl && <small className="d-block text-muted">Necesita una portada</small>}
            </span>
          </label>

          <div className="d-flex gap-2 flex-wrap mt-2">
            <button className="admin-btn-ghost" onClick={() => setModal("editar")} disabled={trabajando}>
              ✏️ Editar
            </button>
            <button className="admin-btn-ghost" onClick={cambiarOferta} disabled={trabajando}>
              {juego.noSeOfrece ? "♻️ Volver a ofrecerlo" : "🚫 Dejar de ofrecerlo"}
            </button>
            {!tieneCompras && (
              <button className="admin-btn-ghost admin-btn-ghost--rojo" onClick={borrar} disabled={trabajando}>
                🗑️ Eliminar
              </button>
            )}
          </div>
          {tieneCompras && (
            <small className="text-muted d-block mt-2">
              Se pagó por él: eliminarlo le sacaría plata a los reportes. Por eso solo se puede dejar de ofrecer.
            </small>
          )}
        </div>
      </div>

      <div className="jg-seccion">
        <div className="jg-seccion__titulo">
          <span>Lo que costó</span>
          <button className="jg-mas" onClick={() => setModal("complemento")} disabled={trabajando}>
            ＋ Complemento
          </button>
        </div>

        {!tieneCompras && !juego.complementos?.length ? (
          <p className="text-muted mb-0" style={{ fontSize: ".9rem" }}>
            No costó nada: es de PS Plus, gratuito o demo. Por eso no aparece en ningún reporte.
          </p>
        ) : (
          <>
            {compraPropia
              ? filaCompra(compraPropia, "Juego")
              : <div className="jg-linea"><span className="jg-linea__izq">Juego <span className="jg-tag">🎁 gratis</span></span><span className="jg-linea__monto">—</span></div>}

            {juego.complementos?.map((extra) => (
              extra.compras?.length
                ? filaCompra(extra.compras[0], extra.nombre)
                : (
                  <div className="jg-linea" key={extra._id}>
                    <span className="jg-linea__izq">{extra.nombre} <span className="jg-tag">🎁 gratis</span></span>
                    <span className="jg-linea__monto">—</span>
                    <button className="jg-baja" onClick={() => borrarComplemento(extra)} disabled={trabajando} title="Borrar">✕</button>
                  </div>
                )
            ))}

            <div className="jg-total">
              <span>Gastado en este juego</span>
              <strong>{formatCRC(juego.gastado)}</strong>
            </div>
          </>
        )}
      </div>

      {modal === "editar" && (
        <JuegoFormModal
          juego={juego}
          getAuthHeaders={getAuthHeaders}
          mostrarNotif={mostrarNotif}
          manejarError={manejarError}
          onCerrar={() => setModal(null)}
          onExito={() => { setModal(null); onCambio(); }}
        />
      )}
      {modal === "complemento" && (
        <ComplementoFormModal
          juego={juego}
          getAuthHeaders={getAuthHeaders}
          mostrarNotif={mostrarNotif}
          manejarError={manejarError}
          onCerrar={() => setModal(null)}
          onExito={() => { setModal(null); onCambio(); }}
        />
      )}
    </div>
  );
};

// ─── PANEL ───────────────────────────────────────────────────────────────────
const JuegosPanel = ({ getAuthHeaders, mostrarNotif, manejarError }) => {
  const [juegos, setJuegos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [abierto, setAbierto] = useState(null);      // id del juego abierto
  const [modalNuevo, setModalNuevo] = useState(null); // null | {nombre}

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const axios = await getAxios();
      const { data } = await axios.get(`${API_URL}/api/juegos`, getAuthHeaders());
      setJuegos(data?.data || []);
      setErrorCarga(false);
    } catch (error) {
      setErrorCarga(true);
      manejarError(error);
    } finally {
      setCargando(false);
    }
  }, [getAuthHeaders, manejarError]);

  useEffect(() => { cargar(); }, [cargar]);

  const conteos = useMemo(() => ({
    todos: juegos.length,
    vitrina: juegos.filter((j) => j.enVitrina).length,
    comprados: juegos.filter((j) => j.gastado > 0).length,
    extras: juegos.reduce((t, j) => t + (j.complementos?.length || 0), 0),
    retirados: juegos.filter((j) => j.noSeOfrece).length,
  }), [juegos]);

  const lista = useMemo(() => {
    const texto = sinTildes(busqueda.trim());
    let r = juegos.filter((j) => (filtro === "retirados" ? j.noSeOfrece : !j.noSeOfrece));
    if (texto) r = r.filter((j) => sinTildes(j.nombre).includes(texto));
    if (filtro === "vitrina") r = r.filter((j) => j.enVitrina);
    if (filtro === "comprados") r = r.filter((j) => j.gastado > 0);
    return r;
  }, [juegos, busqueda, filtro]);

  const complementos = useMemo(
    () => juegos.flatMap((j) => (j.complementos || []).map((c) => ({ ...c, juego: j }))),
    [juegos]
  );

  const juegoAbierto = juegos.find((j) => j._id === abierto);

  if (juegoAbierto) {
    return (
      <DetalleJuego
        juego={juegoAbierto}
        getAuthHeaders={getAuthHeaders}
        mostrarNotif={mostrarNotif}
        manejarError={manejarError}
        onVolver={() => setAbierto(null)}
        onCambio={cargar}
      />
    );
  }

  return (
    <div className="fade-in">
      <div className="activos-header mb-3">
        <div className="activos-header__busqueda">
          <span className="activos-header__lupa">🔍</span>
          <input
            type="search"
            className="form-control admin-input activos-header__input"
            placeholder="Buscar juego..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Buscar juegos por nombre"
          />
        </div>
        <button
          className="btn admin-btn admin-btn--orange fw-bold activos-header__nuevo"
          onClick={() => setModalNuevo({ nombre: "" })}
        >
          ＋ Agregar juego
        </button>
      </div>

      <div className="filtro-chips mb-4">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            className={`filtro-chip ${filtro === f.id ? "filtro-chip--activo" : ""}`}
            onClick={() => setFiltro(f.id)}
          >
            {f.label} <b>{conteos[f.id] ?? 0}</b>
          </button>
        ))}
        {conteos.retirados > 0 && (
          <button
            className={`filtro-chip ${filtro === "retirados" ? "filtro-chip--activo" : ""}`}
            onClick={() => setFiltro("retirados")}
          >
            🚫 No se ofrecen <b>{conteos.retirados}</b>
          </button>
        )}
      </div>

      {cargando ? (
        <Cargando />
      ) : errorCarga ? (
        <ErrorRecarga onReintentar={cargar} mensaje="No se pudo cargar el catálogo de juegos" />
      ) : filtro === "extras" ? (
        complementos.length === 0 ? (
          <EstadoVacio icono="🧩" mensaje="Ningún juego tiene complementos todavía." />
        ) : (
          <div className="jg-tabla-wrap">
            <p className="text-muted" style={{ fontSize: ".86rem" }}>
              Mapas, pases y monedas que se le suman a un juego. No se juegan solos: por eso no salen al cobrar.
            </p>
            <table className="jg-tabla">
              <thead>
                <tr><th>Complemento</th><th>Del juego</th><th className="jg-num">Costo</th></tr>
              </thead>
              <tbody>
                {complementos.map((c) => (
                  <tr key={c._id}>
                    <td>🧩 {c.nombre}</td>
                    <td>
                      <button className="jg-link" onClick={() => setAbierto(c.juego._id)}>{c.juego.nombre} →</button>
                    </td>
                    <td className="jg-num">
                      {c.gastado > 0
                        ? <>{formatCRC(c.gastado)} <span className="jg-placa">{formatPlaca({ numeroPlaca: c.compras[0].numeroPlaca })}</span></>
                        : <span className="jg-tag">🎁 gratis</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : lista.length === 0 ? (
        busqueda.trim() ? (
          <EstadoVacio icono="🔍" mensaje={`Ningún juego se llama «${busqueda.trim()}».`}>
            <button
              className="btn admin-btn admin-btn--orange fw-bold"
              onClick={() => setModalNuevo({ nombre: busqueda.trim() })}
            >
              ＋ Agregarlo
            </button>
          </EstadoVacio>
        ) : (
          <EstadoVacio icono="🎮" mensaje="Todavía no hay juegos acá." />
        )
      ) : (
        <div className="jg-grid">
          {lista.map((j) => <TarjetaJuego key={j._id} juego={j} onAbrir={(x) => setAbierto(x._id)} />)}
        </div>
      )}

      {modalNuevo && (
        <JuegoFormModal
          nombreSugerido={modalNuevo.nombre}
          getAuthHeaders={getAuthHeaders}
          mostrarNotif={mostrarNotif}
          manejarError={manejarError}
          onCerrar={() => setModalNuevo(null)}
          onExito={() => { setModalNuevo(null); setBusqueda(""); cargar(); }}
        />
      )}
    </div>
  );
};

export default JuegosPanel;
