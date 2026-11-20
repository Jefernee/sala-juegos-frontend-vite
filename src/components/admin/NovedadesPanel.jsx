// Módulo de Novedades (Administración). Visible para administrador y colaborador.
// Lo que se publica acá sale en la sección Novedades de la página pública
// (hasta 3, en el orden de la lista: la primera va grande). El backend calcula
// `lugar` (1..3 o null) y `vencida`; acá solo se muestran y se reordena.
import { useState, useEffect, useCallback, useRef } from "react";
import ImageUploadWithCompression from "../ImageUploadWithCompression";
import { API_URL, getAxios } from "./adminUtils";
import { ModalOverlay, ConfirmarEliminar, EstadoVacio, ErrorRecarga, Cargando } from "./Comunes";

const ETIQUETAS = ["Recién llegado", "Nuevo juego", "Promoción"];
const MAX_TITULO = 80;
const MAX_TEXTO = 400;

const formVacio = () => ({
  titulo: "",
  texto: "",
  etiqueta: ETIQUETAS[0],
  juego: "",
  mostrarHasta: "",
  publicada: true,
});

const formDesde = (n) => ({
  titulo: n.titulo || "",
  texto: n.texto || "",
  etiqueta: n.etiqueta || ETIQUETAS[0],
  juego: n.juego || "",
  mostrarHasta: n.mostrarHasta ? String(n.mostrarHasta).slice(0, 10) : "",
  publicada: n.publicada !== false,
});

// "2026-12-05" → "05/12/2026"
const fechaCorta = (iso) => {
  const [a, m, d] = String(iso).slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
};

const estadoDe = (n) => {
  if (n.vencida) return { clase: "gris", texto: "Vencida" };
  if (n.lugar) return { clase: "verde", texto: `Publicada · ${n.lugar}.ª` };
  if (n.publicada !== false) return { clase: "gris", texto: "Publicada · en espera" };
  return { clase: "gris", texto: "No publicada" };
};

const detalleDe = (n) => {
  const partes = [n.etiqueta];
  if (n.juego) partes.push(`juego: ${n.juego}`);
  if (n.mostrarHasta) partes.push(`se oculta sola el ${fechaCorta(n.mostrarHasta)}`);
  else if (n.publicada === false) partes.push("guardada");
  return partes.join(" · ");
};

// ─── MODAL CREAR / EDITAR ────────────────────────────────────────────────────
const NovedadFormModal = ({ novedad, juegos, imagenesJuegos, getAuthHeaders, mostrarNotif, manejarError, onCerrar, onExito }) => {
  const esEdicion = !!novedad;
  const [form, setForm] = useState(() => (esEdicion ? formDesde(novedad) : formVacio()));
  const [errores, setErrores] = useState({});
  const [imagenData, setImagenData] = useState(null);
  const [cambiandoImg, setCambiandoImg] = useState(!esEdicion);
  const [procesandoImg, setProcesandoImg] = useState(false);
  const [guardando, setGuardando] = useState(false);
  // Afiche tomado del catálogo de juegos: se guarda la URL, sin subir nada.
  const [aficheUrl, setAficheUrl] = useState(null);
  const [medidas, setMedidas] = useState(null); // { fuente, ancho, alto }
  const imageRef = useRef(null);

  const imagenJuego = form.juego ? imagenesJuegos[form.juego] : null;

  // Qué imagen se va a publicar: la del juego, la recién elegida o la actual.
  const fuenteImg = aficheUrl || imagenData?.base64 || (esEdicion && !cambiandoImg ? novedad.afiche : null);

  // Se mide en el navegador para avisar si no es horizontal.
  useEffect(() => {
    if (!fuenteImg) return undefined;
    let vigente = true;
    const img = new Image();
    img.onload = () => {
      if (vigente && img.naturalWidth && img.naturalHeight) {
        setMedidas({ fuente: fuenteImg, ancho: img.naturalWidth, alto: img.naturalHeight });
      }
    };
    img.src = fuenteImg;
    return () => { vigente = false; };
  }, [fuenteImg]);

  const noHorizontal = !!fuenteImg && medidas?.fuente === fuenteImg && medidas.ancho / medidas.alto < 1.5;

  const setField = (field) => (e) => {
    const valor = e.target.value;
    setForm((f) => ({ ...f, [field]: valor }));
    setErrores((er) => ({ ...er, [field]: "" }));
  };

  // El juego guardado puede haberse renombrado en el catálogo: se ofrece igual.
  const opcionesJuego = form.juego && !juegos.includes(form.juego) ? [form.juego, ...juegos] : juegos;

  const validar = () => {
    const e = {};
    if (!form.titulo.trim()) e.titulo = "El título es obligatorio";
    else if (form.titulo.trim().length > MAX_TITULO) e.titulo = `El título no puede pasar de ${MAX_TITULO} caracteres`;
    if (form.texto.length > MAX_TEXTO) e.texto = `El texto no puede pasar de ${MAX_TEXTO} caracteres`;
    if (!esEdicion && !imagenData?.base64 && !aficheUrl) e.afiche = "El afiche es obligatorio";
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const camposImagen = () => {
    if (imagenData?.base64) {
      return {
        imagenBase64: imagenData.base64,
        imagenNombre: imagenData.file.name,
        imagenMimeType: imagenData.file.type,
      };
    }
    if (aficheUrl && aficheUrl !== novedad?.afiche) return { afiche: aficheUrl };
    return {};
  };

  const construirPayload = () => {
    if (!esEdicion) {
      return {
        titulo: form.titulo.trim(),
        texto: form.texto.trim(),
        etiqueta: form.etiqueta,
        juego: form.juego || null,
        publicada: form.publicada,
        mostrarHasta: form.mostrarHasta,
        ...camposImagen(),
      };
    }
    const original = formDesde(novedad);
    const payload = { ...camposImagen() };
    if (form.titulo.trim() !== original.titulo) payload.titulo = form.titulo.trim();
    if (form.texto.trim() !== original.texto.trim()) payload.texto = form.texto.trim();
    if (form.etiqueta !== original.etiqueta) payload.etiqueta = form.etiqueta;
    if (form.juego !== original.juego) payload.juego = form.juego || null;
    if (form.publicada !== original.publicada) payload.publicada = form.publicada;
    if (form.mostrarHasta !== original.mostrarHasta) payload.mostrarHasta = form.mostrarHasta;
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
        ? await axios.put(`${API_URL}/api/novedades/${novedad._id}`, payload, getAuthHeaders())
        : await axios.post(`${API_URL}/api/novedades`, payload, getAuthHeaders());
      mostrarNotif(res.data?.message || (esEdicion ? "Novedad actualizada" : "Novedad creada"));
      onExito();
    } catch (err) {
      manejarError(err);
    } finally {
      setGuardando(false);
    }
  };

  const quitarNueva = () => {
    imageRef.current?.reset();
    setImagenData(null);
  };

  const usarImagenDelJuego = () => {
    if (!imagenJuego) return;
    quitarNueva();
    setAficheUrl(imagenJuego.imagenUrl);
    setCambiandoImg(true);
    setErrores((er) => ({ ...er, afiche: "" }));
  };

  return (
    <ModalOverlay onCerrar={onCerrar} bloqueado={guardando} className="admin-modal--grande">
      <div className="admin-modal__header admin-panel__header--orange">
        <span>{esEdicion ? "✏️" : "📣"}</span>
        {esEdicion ? "Editar novedad" : "Nueva novedad"}
        <button className="admin-modal__cerrar" onClick={onCerrar} disabled={guardando} aria-label="Cerrar">✕</button>
      </div>
      <form className="admin-modal__body" onSubmit={handleSubmit} noValidate>
        <div className="row g-3">
          <div className="col-12 col-sm-6">
            <label className="admin-label">Título *</label>
            <input
              type="text"
              className={`form-control admin-input ${errores.titulo ? "admin-input--error" : ""}`}
              maxLength={MAX_TITULO + 20}
              value={form.titulo}
              disabled={guardando}
              onChange={setField("titulo")}
            />
            {errores.titulo && <div className="campo-error">{errores.titulo}</div>}
          </div>

          <div className="col-12 col-sm-6">
            <label className="admin-label">Etiqueta</label>
            <select className="form-select admin-select" value={form.etiqueta} disabled={guardando} onChange={setField("etiqueta")}>
              {ETIQUETAS.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>

          <div className="col-12">
            <label className="admin-label">Texto corto</label>
            <textarea
              className={`form-control admin-input ${errores.texto ? "admin-input--error" : ""}`}
              rows={4}
              value={form.texto}
              disabled={guardando}
              onChange={setField("texto")}
            />
            {errores.texto
              ? <div className="campo-error">{errores.texto}</div>
              : <small className="admin-hint">{form.texto.length}/{MAX_TEXTO}</small>}
          </div>

          <div className="col-12 col-sm-6">
            <label className="admin-label">Afiche {esEdicion ? "" : "*"}</label>
            {aficheUrl ? (
              <div className="d-flex gap-2 align-items-start">
                <div className="novedad-miniatura"><img src={aficheUrl} alt="Imagen del juego" /></div>
                <div>
                  <div className="admin-hint mb-2">Imagen del juego: {form.juego || "catálogo"}</div>
                  <button type="button" className="admin-btn-ghost" onClick={() => setAficheUrl(null)} disabled={guardando}>
                    Quitar
                  </button>
                </div>
              </div>
            ) : !cambiandoImg && esEdicion ? (
              <div className="d-flex gap-2 align-items-start">
                <div className="novedad-miniatura"><img src={novedad.afiche} alt="Afiche actual" /></div>
                <button type="button" className="admin-btn-ghost" onClick={() => setCambiandoImg(true)} disabled={guardando}>
                  Cambiar imagen
                </button>
              </div>
            ) : (
              <>
                <ImageUploadWithCompression
                  ref={imageRef}
                  onChange={(d) => { setImagenData(d); setErrores((er) => ({ ...er, afiche: "" })); }}
                  onProcessingChange={setProcesandoImg}
                  showPreview
                  alwaysCompress
                  maxWidthOrHeight={1200}
                  disabled={guardando}
                />
                {esEdicion && (
                  <button
                    type="button"
                    className="admin-btn-ghost mt-2"
                    onClick={() => { quitarNueva(); setCambiandoImg(false); }}
                    disabled={guardando}
                  >
                    ↩ Mantener afiche actual
                  </button>
                )}
              </>
            )}
            {errores.afiche
              ? <div className="campo-error">{errores.afiche}</div>
              : <small className="admin-hint">
                  Usá una imagen horizontal, como las de los juegos del catálogo (por ejemplo 1280 × 720). La primera
                  novedad muestra el afiche entero; las otras dos llenan un marco horizontal.
                </small>}
            {noHorizontal && (
              <div className="aviso-mes mt-2">
                Esta imagen no es horizontal: en el 2.º y 3.er lugar se le van a recortar partes de arriba y abajo.
                <div className="novedad-recorte mt-2">
                  <img src={fuenteImg} alt="" />
                </div>
                <div className="mt-1">Así se ve en el 2.º y 3.er lugar</div>
              </div>
            )}
          </div>

          <div className="col-12 col-sm-6">
            <label className="admin-label">Juego del catálogo (opcional)</label>
            <select className="form-select admin-select" value={form.juego} disabled={guardando} onChange={setField("juego")}>
              <option value="">— Ninguno —</option>
              {opcionesJuego.map((j) => <option key={j} value={j}>{j}</option>)}
            </select>
            <div className="mt-2">
              <button
                type="button"
                className="admin-btn-ghost"
                onClick={usarImagenDelJuego}
                disabled={guardando || !imagenJuego}
                title={
                  !form.juego
                    ? "Elegí primero un juego del catálogo"
                    : !imagenJuego
                      ? "Este juego no tiene imagen en el catálogo"
                      : "Pone la imagen del juego como afiche, sin subir nada"
                }
              >
                Usar la imagen del juego
              </button>
            </div>
            <small className="admin-hint">Si elegís uno, su carátula encabeza el collage de la portada.</small>
          </div>

          <div className="col-12 col-sm-6">
            <label className="admin-label">Mostrar hasta (opcional)</label>
            <input
              type="date"
              className="form-control admin-input"
              value={form.mostrarHasta}
              disabled={guardando}
              onChange={setField("mostrarHasta")}
            />
            <small className="admin-hint">Para promociones con fecha. Después de esa fecha se oculta sola.</small>
          </div>

          <div className="col-12 col-sm-6 d-flex align-items-center">
            <div className="form-check form-switch mt-3">
              <input
                className="form-check-input"
                type="checkbox"
                id="novedad-publicada"
                checked={form.publicada}
                disabled={guardando}
                onChange={(e) => setForm((f) => ({ ...f, publicada: e.target.checked }))}
              />
              <label className="form-check-label fw-bold" htmlFor="novedad-publicada">
                Publicada (sale en la página)
              </label>
            </div>
          </div>
        </div>

        <div className="d-flex gap-2 justify-content-end align-items-center mt-4 flex-wrap">
          <button type="button" className="admin-btn-ghost" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </button>
          <button type="submit" className="btn admin-btn admin-btn--orange px-4 fw-bold" disabled={guardando || procesandoImg}>
            {guardando && <span className="btn-spinner" />}
            {guardando ? (imagenData ? "Subiendo afiche..." : "Guardando...") : procesandoImg ? "Procesando afiche…" : "Guardar"}
          </button>
        </div>
      </form>
    </ModalOverlay>
  );
};

// ─── PANEL PRINCIPAL ─────────────────────────────────────────────────────────
const NovedadesPanel = ({ getAuthHeaders, mostrarNotif, manejarError }) => {
  const [novedades, setNovedades] = useState([]);
  const [juegos, setJuegos] = useState([]);
  const [imagenesJuegos, setImagenesJuegos] = useState({}); // nombre → { imagenUrl }
  const [loading, setLoading] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);
  const [modalForm, setModalForm] = useState(null); // null | { novedad: null|obj }
  const [aEliminar, setAEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const fetchNovedades = useCallback(async () => {
    setLoading(true);
    setErrorCarga(false);
    try {
      const axios = await getAxios();
      const res = await axios.get(`${API_URL}/api/novedades`, getAuthHeaders());
      setNovedades(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err) {
      setErrorCarga(true);
      manejarError(err);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, manejarError]);

  useEffect(() => { fetchNovedades(); }, [fetchNovedades]);

  // Catálogo para el selector de juego (si falla, el selector queda solo con "Ninguno").
  useEffect(() => {
    let vigente = true;
    (async () => {
      try {
        const axios = await getAxios();
        const res = await axios.get(`${API_URL}/api/plays/juegos`, getAuthHeaders());
        if (vigente) setJuegos(Array.isArray(res.data?.data) ? res.data.data : []);
      } catch (err) {
        console.error("No se pudo cargar el catálogo de juegos:", err);
      }
    })();
    return () => { vigente = false; };
  }, [getAuthHeaders]);

  // Imágenes del catálogo (pública) para el botón "Usar la imagen del juego".
  useEffect(() => {
    let vigente = true;
    (async () => {
      try {
        const axios = await getAxios();
        const res = await axios.get(`${API_URL}/api/juegos/vitrina`);
        const mapa = {};
        (Array.isArray(res.data?.data) ? res.data.data : []).forEach((j) => {
          if (j.nombre && j.imagenUrl) mapa[j.nombre] = { imagenUrl: j.imagenUrl, ancho: j.imagenAncho, alto: j.imagenAlto };
        });
        if (vigente) setImagenesJuegos(mapa);
      } catch (err) {
        console.error("No se pudieron cargar las imágenes del catálogo:", err);
      }
    })();
    return () => { vigente = false; };
  }, []);

  // Las flechas mueven entre las que están publicadas y vigentes.
  const activas = novedades.filter((n) => n.publicada !== false && !n.vencida);

  const mover = async (n, delta) => {
    if (ocupado) return;
    const i = activas.findIndex((x) => x._id === n._id);
    const vecina = activas[i + delta];
    if (!vecina) return;
    const ids = novedades.map((x) => x._id);
    const a = ids.indexOf(n._id);
    const b = ids.indexOf(vecina._id);
    [ids[a], ids[b]] = [ids[b], ids[a]];
    setOcupado(true);
    try {
      const axios = await getAxios();
      const res = await axios.put(`${API_URL}/api/novedades/orden`, { ids }, getAuthHeaders());
      if (Array.isArray(res.data?.data)) setNovedades(res.data.data);
      else await fetchNovedades();
    } catch (err) {
      manejarError(err);
    } finally {
      setOcupado(false);
    }
  };

  const alternarPublicada = async (n) => {
    if (ocupado) return;
    setOcupado(true);
    try {
      const axios = await getAxios();
      const res = await axios.put(
        `${API_URL}/api/novedades/${n._id}`,
        { publicada: n.publicada === false },
        getAuthHeaders(),
      );
      mostrarNotif(res.data?.message || "Novedad actualizada");
      await fetchNovedades();
    } catch (err) {
      manejarError(err);
    } finally {
      setOcupado(false);
    }
  };

  const confirmarEliminar = async () => {
    if (!aEliminar || eliminando) return;
    setEliminando(true);
    try {
      const axios = await getAxios();
      const res = await axios.delete(`${API_URL}/api/novedades/${aEliminar._id}`, getAuthHeaders());
      mostrarNotif(res.data?.message || "Novedad eliminada");
      setAEliminar(null);
      fetchNovedades();
    } catch (err) {
      manejarError(err);
    } finally {
      setEliminando(false);
    }
  };

  return (
    <div className="fade-in">
      <div className="aviso-mes mb-4">
        Lo que publiques acá sale en la página, en la sección Novedades. Se muestran hasta <strong>3</strong>, en el
        orden de la lista: la primera va grande. Las que no estén publicadas quedan guardadas para usarlas otra vez.
        Los torneos se manejan en su pestaña, como siempre.
      </div>

      <div className="d-flex justify-content-end mb-3">
        <button className="btn admin-btn admin-btn--orange fw-bold" onClick={() => setModalForm({ novedad: null })}>
          ＋ Nueva novedad
        </button>
      </div>

      {errorCarga ? (
        <ErrorRecarga onReintentar={fetchNovedades} />
      ) : loading ? (
        <Cargando variante="orange" />
      ) : novedades.length === 0 ? (
        <EstadoVacio icono="📣" mensaje="No hay novedades creadas todavía" />
      ) : (
        <div className="row g-3">
          {novedades.map((n) => {
            const estado = estadoDe(n);
            const iActiva = activas.findIndex((x) => x._id === n._id);
            const oculta = n.publicada === false || n.vencida;
            return (
              <div key={n._id} className="col-12 col-sm-6 col-lg-3">
                <div className="activo-card w-100" style={oculta ? { opacity: 0.7 } : undefined}>
                  <div className={`activo-card__img-wrap${n.lugar >= 2 ? " activo-card__img-wrap--recorte" : ""}`}>
                    <img src={n.afiche} alt={n.titulo} className="activo-card__img" loading="lazy" />
                  </div>
                  <div className="activo-card__body">
                    <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
                      <h6 className="activo-card__nombre mb-0">{n.titulo}</h6>
                      <span className={`estado-badge estado-badge--${estado.clase}`}>{estado.texto}</span>
                    </div>
                    <div className="admin-hint mt-1">{detalleDe(n)}</div>
                    <div className="activo-card__acciones activo-card__acciones--wrap">
                      {iActiva >= 0 && (
                        <span className="orden-btns">
                          <button
                            className="accion-btn"
                            title="Subir"
                            aria-label={`Subir ${n.titulo}`}
                            disabled={ocupado || iActiva === 0}
                            onClick={() => mover(n, -1)}
                          >
                            ↑
                          </button>
                          <button
                            className="accion-btn"
                            title="Bajar"
                            aria-label={`Bajar ${n.titulo}`}
                            disabled={ocupado || iActiva === activas.length - 1}
                            onClick={() => mover(n, 1)}
                          >
                            ↓
                          </button>
                        </span>
                      )}
                      <button
                        className="accion-btn accion-btn--texto"
                        onClick={() => setModalForm({ novedad: n })}
                        aria-label={`Editar ${n.titulo}`}
                      >
                        ✏️ Editar
                      </button>
                      <button
                        className="accion-btn accion-btn--texto"
                        disabled={ocupado}
                        onClick={() => alternarPublicada(n)}
                      >
                        {n.publicada === false ? "Publicar" : "Ocultar"}
                      </button>
                      <button
                        className="accion-btn accion-btn--rojo"
                        onClick={() => setAEliminar(n)}
                        title="Eliminar"
                        aria-label={`Eliminar ${n.titulo}`}
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
      )}

      {modalForm && (
        <NovedadFormModal
          novedad={modalForm.novedad}
          juegos={juegos}
          imagenesJuegos={imagenesJuegos}
          getAuthHeaders={getAuthHeaders}
          mostrarNotif={mostrarNotif}
          manejarError={manejarError}
          onCerrar={() => setModalForm(null)}
          onExito={() => { setModalForm(null); fetchNovedades(); }}
        />
      )}

      {aEliminar && (
        <ConfirmarEliminar
          detalle={aEliminar.titulo}
          eliminando={eliminando}
          onCancelar={() => setAEliminar(null)}
          onConfirmar={confirmarEliminar}
        />
      )}
    </div>
  );
};

export default NovedadesPanel;
