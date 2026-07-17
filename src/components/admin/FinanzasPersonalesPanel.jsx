// Mis Finanzas Personales — control de gastos e ingresos personales del dueño.
// Es EXCLUSIVO del administrador y está totalmente aparte de la sala de juegos:
// no mezcla números con ventas, plays ni reportes del negocio. Toda la data
// vive en /api/finanzas-personales (el backend responde 403 si no es admin).
//
// Estructura: selector de mes/año → estado de resultados (ingresos, egresos,
// balance) → desglose por categoría con dona de gastos → lista de movimientos
// del mes con alta/edición/eliminación (modal).
import { useState, useEffect, useCallback } from "react";
import { API_URL, getAxios, formatCRC, formatFecha, nombreMes } from "./adminUtils";
import MesSelector from "./MesSelector";
import { ModalOverlay, ConfirmarEliminar, Paginacion, ErrorRecarga, EstadoVacio, Cargando } from "./Comunes";

const BASE = `${API_URL}/api/finanzas-personales`;
const LIMITE = 10;

// Orden de importancia de las recomendaciones: primero lo que hay que atender.
const ORDEN_NIVEL = { critico: 0, advertencia: 1, bien: 2, consejo: 3, info: 4 };

// Al pagar en dólares, el tipo de cambio del día se trae automáticamente (API
// de Hacienda) y solo se muestra —no se edita—; el monto se convierte a colones
// (el backend guarda todo en ₡) y el detalle en dólares queda en la descripción.

// "$1,250.50" — formato de dólares (permite decimales)
const formatUSD = (monto) =>
  "$" + (Number(monto) || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

// Formatea el monto MIENTRAS se escribe, con separador de miles para leerlo
// fácil. CRC: enteros con punto ("1.000.000"). USD: miles con coma y hasta 2
// decimales ("1,250.50"). Recibe el valor crudo (solo dígitos y punto decimal).
const formatMontoInput = (valor, esUSD) => {
  if (valor == null || valor === "") return "";
  const sepMiles = esUSD ? "," : ".";
  const partes = String(valor).split(".");
  let ent = partes[0].replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, sepMiles);
  const dec = partes[1];
  if (ent === "" && dec != null) ent = "0";
  if (esUSD && dec != null) return `${ent}.${dec.slice(0, 2)}`;
  return ent;
};

// Limpia lo tecleado dejando solo el número canónico (sin separadores de miles).
const limpiarMontoInput = (texto, esUSD) => {
  let raw = String(texto).replace(/[^\d.]/g, "");
  if (!esUSD) return raw.replace(/\./g, "");        // colones: sin decimales
  const [ent, ...rest] = raw.split(".");            // USD: un punto, máx 2 decimales
  return rest.length ? `${ent}.${rest.join("").slice(0, 2)}` : ent;
};

// "₡452,18" — tipo de cambio con 2 decimales (coma decimal de Costa Rica)
const formatTC = (valor) =>
  "₡" + (Number(valor) || 0).toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Tipo de cambio del dólar. Lo sirve NUESTRO backend (`GET /tipo-cambio`), que
// consulta al Ministerio de Hacienda del lado del servidor y lo cachea — así no
// depende del navegador/red/extensiones del usuario ni de CORS. Se traen AMBAS
// tasas y se elige según el tipo de movimiento: un GASTO en dólares se paga
// comprando dólares (tasa de VENTA del banco), mientras que un INGRESO en
// dólares se cambia a colones vendiéndoselos al banco (tasa de COMPRA).
// Se cachea también en el front por día para no repetir la llamada.
let tcCache = null; // { fecha: "YYYY-MM-DD", venta: number, compra: number }
const fetchTipoCambio = async (getAuthHeaders, forzar = false) => {
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Costa_Rica" });
  if (!forzar && tcCache && tcCache.fecha === hoy) return tcCache;
  const axios = await getAxios();
  const res = await axios.get(`${BASE}/tipo-cambio`, getAuthHeaders());
  const data = res.data || {};
  // Tolera respuesta plana { venta, compra } o anidada { venta: { valor } }.
  const venta = Number(data?.venta?.valor ?? data?.venta);
  const compra = Number(data?.compra?.valor ?? data?.compra);
  if (!venta || !compra) throw new Error("TC inválido");
  // `stale` = el backend devolvió una tasa previa porque Hacienda no respondió.
  tcCache = { fecha: data?.fecha || data?.venta?.fecha || hoy, venta, compra, stale: !!data?.stale };
  return tcCache;
};

// Tasa aplicable según el tipo: ingreso → compra, egreso → venta.
// Tolera formas viejas del dato (ej. { valor }) cayendo a ese valor, para no
// quedar en 0 si en memoria persiste una versión previa (hot-reload/caché).
const tasaSegunTipo = (tcData, tipo) => {
  if (!tcData) return 0;
  if (tcData.guardado) return Number(tcData.valor) || 0;   // registro USD ya guardado
  const tasa = tipo === "ingreso" ? tcData.compra : tcData.venta;
  return Number(tasa) || Number(tcData.valor) || 0;
};

// Paleta para el desglose y la dona (mismo espíritu que el estado de resultados).
const PALETA = ["#f97316", "#ef4444", "#eab308", "#8b5cf6", "#ec4899", "#06b6d4", "#14b8a6", "#f59e0b", "#a3e635"];

// Iconos por defecto de las categorías que manda el backend. Si llega una
// categoría nueva que no está acá, cae en el ícono comodín según el tipo.
const ICONOS_CAT = {
  // Ingresos
  Salario: "💼", "Salario MEP": "🏫", "Salario CreAI": "🤖",
  Negocio: "🏪", "Ventas/Extras": "🛍️", Préstamos: "🤝",
  // Egresos
  Comida: "🍽️", Transporte: "🚗", "Vivienda/Alquiler": "🏠", Vivienda: "🏠",
  Servicios: "🧾", Salud: "💊", Entretenimiento: "🎬",
  "Compras personales": "🛒", Educación: "📚", "Deudas/Préstamos": "💳",
  Ahorro: "🐷",
  // Comodín
  Otros: "•",
};

const iconoCat = (categoria, tipo) =>
  ICONOS_CAT[categoria] || (tipo === "ingreso" ? "💰" : "💸");

// ─── DONA DE GASTOS POR CATEGORÍA (SVG puro, sin dependencias) ───────────────
const DonutGastos = ({ items }) => {
  const total = items.reduce((s, it) => s + (Number(it.total) || 0), 0);
  if (!total) return null;

  const size = 150;
  const stroke = 24;
  const radius = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * radius;

  // Precalculamos cada segmento (dash + desplazamiento acumulado) sin mutar
  // nada durante el render.
  const segmentos = items.reduce((acc, it, i) => {
    const dash = ((Number(it.total) || 0) / total) * circ;
    const offsetPrevio = acc.length ? acc[acc.length - 1].fin : 0;
    acc.push({ categoria: it.categoria, dash, offset: offsetPrevio, fin: offsetPrevio + dash, color: PALETA[i % PALETA.length] });
    return acc;
  }, []);

  return (
    <div className="fin-donut">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Gastos por categoría">
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        {segmentos.map((s) => (
          <circle
            key={s.categoria}
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={s.color}
            strokeWidth={stroke}
            strokeDasharray={`${s.dash} ${circ - s.dash}`}
            strokeDashoffset={-s.offset}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        ))}
      </svg>
      <div className="fin-donut__centro">
        <span className="fin-donut__centro-label">Gastos</span>
        <span className="fin-donut__centro-monto">{formatCRC(total)}</span>
      </div>
    </div>
  );
};

// ─── BLOQUE DE DESGLOSE POR CATEGORÍA ────────────────────────────────────────
const DesgloseBloque = ({ titulo, icono, items, colorClase }) => {
  const ordenado = [...(items || [])].sort((a, b) => (b.total || 0) - (a.total || 0));
  const total = ordenado.reduce((s, it) => s + (Number(it.total) || 0), 0);
  const tipo = colorClase === "verde" ? "ingreso" : "egreso";

  return (
    <div className="fin-desglose">
      <p className="fin-desglose__titulo">{icono} {titulo}</p>
      {ordenado.length === 0 ? (
        <p className="fin-desglose__vacio">Sin movimientos este mes</p>
      ) : (
        <div className="fin-desglose__lista">
          {ordenado.map((it, i) => {
            const pct = total > 0 ? Math.round(((it.total || 0) / total) * 100) : 0;
            return (
              <div key={it.categoria} className="fin-cat">
                <div className="fin-cat__head">
                  <span className="fin-cat__nombre">
                    <span className="fin-cat__dot" style={{ background: PALETA[i % PALETA.length] }} />
                    {iconoCat(it.categoria, tipo)} {it.categoria}
                    <span className="fin-cat__cantidad">
                      ({it.cantidad} {it.cantidad === 1 ? "mov." : "movs."})
                    </span>
                  </span>
                  <span className={`fin-cat__monto fin-cat__monto--${colorClase}`}>{formatCRC(it.total)}</span>
                </div>
                <div className="fin-cat__barra">
                  <span
                    className={`fin-cat__barra-fill fin-cat__barra-fill--${colorClase}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── MODAL CREAR / EDITAR MOVIMIENTO ─────────────────────────────────────────
const MovimientoModal = ({
  registro, categorias, mes, anio,
  getAuthHeaders, mostrarNotif, manejarError, onCerrar, onExito,
}) => {
  const esEdicion = !!registro;
  // Al editar un movimiento en dólares, se arranca en USD mostrando el monto
  // original en dólares y el tipo de cambio con el que se guardó (no el de hoy),
  // para no re-convertir un gasto pasado a la tasa actual.
  const editandoUSD = registro?.moneda === "USD";
  const [tipo, setTipo] = useState(registro?.tipo || "egreso");
  const [categoria, setCategoria] = useState(registro?.categoria || "");
  const [monto, setMonto] = useState(() => {
    if (registro == null) return "";
    if (editandoUSD && registro.montoOriginal != null) return String(registro.montoOriginal);
    return String(registro.monto);
  });
  const [moneda, setMoneda] = useState(editandoUSD ? "USD" : "CRC");   // "CRC" | "USD"
  const [tcInfo, setTcInfo] = useState(
    editandoUSD && registro.tipoCambio
      ? { valor: Number(registro.tipoCambio), guardado: true }
      : tcCache,
  );                                                    // { fecha, venta, compra } | { valor, guardado } | null
  const [cargandoTC, setCargandoTC] = useState(false);
  const [errorTC, setErrorTC] = useState(false);
  const [descripcion, setDescripcion] = useState(registro?.descripcion || "");
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  const hoy = new Date();
  const esMesActual = mes === hoy.getMonth() + 1 && anio === hoy.getFullYear();
  const opcionesBase = categorias?.[tipo] || [];
  // Si se edita un movimiento cuya categoría ya no está en la lista, se incluye
  // igual para que no quede en blanco el select.
  const opciones = categoria && !opcionesBase.includes(categoria)
    ? [categoria, ...opcionesBase]
    : opcionesBase;

  // Monto en colones que realmente se guardará (si es dólares, convertido al
  // tipo de cambio del día, que se muestra pero no se edita).
  const esUSD = moneda === "USD";
  const montoNum = Number(monto) || 0;
  const tcNum = tasaSegunTipo(tcInfo, tipo);
  const montoCRC = Math.round(esUSD ? montoNum * tcNum : montoNum);
  const tcListo = tcNum > 0;

  // Trae el tipo de cambio del día (Hacienda). Cacheado por día; `forzar` refresca.
  const cargarTC = useCallback(async (forzar = false) => {
    setCargandoTC(true);
    setErrorTC(false);
    try {
      const info = await fetchTipoCambio(getAuthHeaders, forzar);
      setTcInfo(info);
    } catch (e) {
      console.error("[FinanzasPersonales] No se pudo obtener el tipo de cambio:", e);
      setErrorTC(true);
    } finally {
      setCargandoTC(false);
    }
  }, [getAuthHeaders]);

  // Al pasar a dólares, si aún no tenemos el tipo de cambio, se busca solo.
  useEffect(() => {
    if (esUSD && !tcInfo && !cargandoTC && !errorTC) cargarTC(false);
  }, [esUSD, tcInfo, cargandoTC, errorTC, cargarTC]);

  const cambiarMoneda = (nueva) => {
    setMoneda(nueva);
    // Colones no lleva decimales: si venía de dólares con decimales, se recortan.
    if (nueva === "CRC") setMonto((m) => m.split(".")[0]);
    setErrores((er) => ({ ...er, monto: "" }));
  };

  const handleMontoChange = (e) => {
    setMonto(limpiarMontoInput(e.target.value, esUSD));
    setErrores((er) => ({ ...er, monto: "" }));
  };

  // Al cambiar el tipo, si la categoría elegida no pertenece al nuevo tipo, se limpia.
  const cambiarTipo = (nuevoTipo) => {
    setTipo(nuevoTipo);
    setErrores((er) => ({ ...er, tipo: "", categoria: "" }));
    if (!(categorias?.[nuevoTipo] || []).includes(categoria)) setCategoria("");
  };

  const validar = () => {
    const e = {};
    if (!tipo) e.tipo = "Elegí el tipo";
    if (!categoria) e.categoria = "Elegí una categoría";
    if (!monto || montoNum <= 0) e.monto = "Ingresá un monto mayor a 0";
    if (esUSD && !tcListo) e.monto = "Esperá el tipo de cambio del día (o registralo en colones)";
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!validar() || guardando) return;
    setGuardando(true);
    try {
      const axios = await getAxios();
      // El frontend NUNCA manda fecha, solo mes y año del período seleccionado.
      // `monto` siempre va en colones (valor canónico). Si se pagó en dólares se
      // guardan además la moneda, el monto original en dólares y el tipo de
      // cambio usado, como campos estructurados.
      const body = {
        tipo,
        categoria,
        monto: montoCRC,
        mes,
        anio,
      };
      if (esUSD) {
        body.moneda = "USD";
        body.montoOriginal = montoNum;
        body.tipoCambio = tcNum;
      } else if (esEdicion) {
        // Si un movimiento pasó de dólares a colones, se limpian los campos USD.
        body.moneda = "CRC";
        body.montoOriginal = montoCRC;
        body.tipoCambio = null;
      }
      const desc = descripcion.trim();
      if (esEdicion) body.descripcion = desc; // permite limpiar la descripción
      else if (desc) body.descripcion = desc;

      const res = esEdicion
        ? await axios.put(`${BASE}/${registro._id}`, body, getAuthHeaders())
        : await axios.post(BASE, body, getAuthHeaders());
      mostrarNotif(res.data?.message || (esEdicion ? "Movimiento actualizado" : "Movimiento registrado"));
      onExito();
    } catch (err) {
      manejarError(err);
    } finally {
      setGuardando(false);
    }
  };

  const color = tipo === "ingreso" ? "green" : "red";

  return (
    <ModalOverlay onCerrar={onCerrar} bloqueado={guardando}>
      <div className={`admin-modal__header admin-panel__header--${tipo === "ingreso" ? "green" : "orange"}`}>
        <span>{esEdicion ? "✏️" : "➕"}</span>
        {esEdicion ? "Editar movimiento" : "Agregar movimiento"}
        <button className="admin-modal__cerrar" onClick={onCerrar} disabled={guardando} aria-label="Cerrar">✕</button>
      </div>
      <form className="admin-modal__body" onSubmit={handleSubmit} noValidate>
        {!esMesActual && (
          <div className="aviso-mes mb-3">
            📅 Se {esEdicion ? "guardará" : "registrará"} en <strong>{nombreMes(mes, anio)}</strong>
          </div>
        )}

        {/* Tipo: ingreso / egreso */}
        <div className="mb-3">
          <label className="admin-label">Tipo *</label>
          <div className="tipo-toggle">
            <button
              type="button"
              className={`tipo-toggle__btn ${tipo === "ingreso" ? "tipo-toggle__btn--active-green" : ""}`}
              onClick={() => cambiarTipo("ingreso")}
              disabled={guardando}
            >
              💰 Ingreso
            </button>
            <button
              type="button"
              className={`tipo-toggle__btn ${tipo === "egreso" ? "tipo-toggle__btn--active-red" : ""}`}
              onClick={() => cambiarTipo("egreso")}
              disabled={guardando}
            >
              💸 Egreso
            </button>
          </div>
          {errores.tipo && <div className="campo-error">{errores.tipo}</div>}
        </div>

        {/* Categoría (según el tipo) */}
        <div className="mb-3">
          <label className="admin-label">Categoría *</label>
          <select
            className={`form-select admin-select ${errores.categoria ? "admin-input--error" : ""}`}
            value={categoria}
            disabled={guardando || opciones.length === 0}
            onChange={(e) => { setCategoria(e.target.value); setErrores((er) => ({ ...er, categoria: "" })); }}
          >
            <option value="">Selecciona la categoría...</option>
            {opciones.map((op) => (
              <option key={op} value={op}>{iconoCat(op, tipo)} {op}</option>
            ))}
          </select>
          {errores.categoria && <div className="campo-error">{errores.categoria}</div>}
        </div>

        {/* Monto + moneda (colones o dólares) */}
        <div className="mb-3">
          <div className="d-flex justify-content-between align-items-center mb-1 flex-wrap gap-2">
            <label className="admin-label mb-0">Monto *</label>
            <div className="moneda-toggle">
              <button
                type="button"
                className={`moneda-toggle__btn ${!esUSD ? "moneda-toggle__btn--activo" : ""}`}
                onClick={() => cambiarMoneda("CRC")}
                disabled={guardando}
              >
                ₡ Colones
              </button>
              <button
                type="button"
                className={`moneda-toggle__btn ${esUSD ? "moneda-toggle__btn--activo" : ""}`}
                onClick={() => cambiarMoneda("USD")}
                disabled={guardando}
              >
                $ Dólares
              </button>
            </div>
          </div>
          <div className="input-group">
            <span className="input-group-text admin-input-prefix">{esUSD ? "$" : "₡"}</span>
            <input
              type="text"
              inputMode={esUSD ? "decimal" : "numeric"}
              className={`form-control admin-input ${errores.monto ? "admin-input--error" : ""}`}
              placeholder="0"
              value={formatMontoInput(monto, esUSD)}
              disabled={guardando}
              onChange={handleMontoChange}
            />
          </div>
          {errores.monto && <div className="campo-error">{errores.monto}</div>}

          {/* Tipo de cambio del día (solo se muestra, no se edita) + conversión */}
          {esUSD && (
            <div className="moneda-conversion mt-2">
              {cargandoTC ? (
                <div className="moneda-tc-fila moneda-tc-fila--cargando">
                  <span className="btn-spinner" /> Obteniendo el tipo de cambio de hoy…
                </div>
              ) : errorTC ? (
                <div className="moneda-tc-error">
                  ⚠️ No se pudo obtener el tipo de cambio automáticamente.
                  <button type="button" className="moneda-tc-reintentar" onClick={() => cargarTC(true)} disabled={guardando}>
                    🔄 Reintentar
                  </button>
                </div>
              ) : tcInfo ? (
                <div className="moneda-tc-fila">
                  <div className="moneda-tc-info">
                    <span className="moneda-tc-label">
                      {tcInfo.guardado
                        ? "Tipo de cambio del movimiento"
                        : `Tipo de cambio de hoy · ${tipo === "ingreso" ? "compra" : "venta"}`}
                    </span>
                    <span className="moneda-tc-fuente">
                      {tcInfo.guardado
                        ? "Guardado con el movimiento"
                        : `Ministerio de Hacienda · ${tcInfo.fecha}${tcInfo.stale ? " · última tasa disponible" : ""}`}
                    </span>
                  </div>
                  <div className="moneda-tc-derecha">
                    <strong className="moneda-tc-valor">{formatTC(tcNum)}</strong>
                    <button
                      type="button"
                      className="moneda-tc-reintentar"
                      onClick={() => cargarTC(true)}
                      disabled={guardando}
                      title="Actualizar tipo de cambio"
                      aria-label="Actualizar tipo de cambio"
                    >
                      🔄
                    </button>
                  </div>
                </div>
              ) : null}

              {tcListo && montoNum > 0 && (
                <div className="moneda-preview">
                  Se guardará como <strong>{formatCRC(montoCRC)}</strong>
                  {" · "}{formatUSD(montoNum)} × {formatTC(tcNum)}
                </div>
              )}

              {!tcInfo?.guardado && tcListo && (
                <div className="moneda-tc-nota">
                  {tipo === "ingreso"
                    ? "Ingreso en dólares: se usa la tasa de compra (lo que te dan al cambiarlos a colones)."
                    : "Gasto en dólares: se usa la tasa de venta (lo que cuesta comprar los dólares)."}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Descripción */}
        <div className="mb-3">
          <label className="admin-label">Descripción</label>
          <textarea
            className="form-control admin-input"
            rows={2}
            maxLength={200}
            placeholder="Opcional... (ej: Almuerzo)"
            value={descripcion}
            disabled={guardando}
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </div>

        <div className="d-flex gap-2 justify-content-end">
          <button type="button" className="admin-btn-ghost" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </button>
          <button
            type="submit"
            className={`btn admin-btn admin-btn--${color} px-4 fw-bold`}
            disabled={guardando || (esUSD && !tcListo)}
          >
            {guardando && <span className="btn-spinner" />}
            {guardando ? "Guardando..." : esEdicion ? "Guardar cambios" : "Registrar"}
          </button>
        </div>
      </form>
    </ModalOverlay>
  );
};

// ─── PANEL PRINCIPAL ─────────────────────────────────────────────────────────
const FinanzasPersonalesPanel = ({ getAuthHeaders, mostrarNotif, manejarError }) => {
  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [page, setPage] = useState(1);

  const [categorias, setCategorias] = useState(null);   // { ingreso:[], egreso:[] }
  const [resumen, setResumen] = useState(null);
  const [recomendaciones, setRecomendaciones] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [pagination, setPagination] = useState(null);

  const [loadingResumen, setLoadingResumen] = useState(true);
  const [loadingLista, setLoadingLista] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);

  const [modal, setModal] = useState(null);        // null | { registro: null | obj }
  const [aEliminar, setAEliminar] = useState(null); // null | registro
  const [eliminando, setEliminando] = useState(false);

  // Categorías: se cargan una sola vez (alimentan el select del modal).
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const axios = await getAxios();
        const res = await axios.get(`${BASE}/categorias`, getAuthHeaders());
        // Se usan tal cual las manda el backend (fuente de verdad): lo que se
        // muestra en el select es exactamente lo que se envía y lo que valida.
        if (vivo) setCategorias(res.data?.categorias || { ingreso: [], egreso: [] });
      } catch (err) {
        manejarError(err);
      }
    })();
    return () => { vivo = false; };
  }, [getAuthHeaders, manejarError]);

  // Resumen del mes (estado de resultados personal). No depende de la página.
  const fetchResumen = useCallback(async () => {
    setLoadingResumen(true);
    setErrorCarga(false);
    try {
      const axios = await getAxios();
      const res = await axios.get(`${BASE}/resumen?mes=${mes}&anio=${anio}`, getAuthHeaders());
      setResumen(res.data || null);
    } catch (err) {
      setErrorCarga(true);
      manejarError(err);
    } finally {
      setLoadingResumen(false);
    }
  }, [mes, anio, getAuthHeaders, manejarError]);

  // Lista paginada de movimientos del mes.
  const fetchLista = useCallback(async () => {
    setLoadingLista(true);
    try {
      const axios = await getAxios();
      const res = await axios.get(
        `${BASE}?mes=${mes}&anio=${anio}&page=${page}&limit=${LIMITE}`,
        getAuthHeaders(),
      );
      const data = res.data?.data || [];
      setMovimientos(data);
      setPagination(
        res.data?.pagination ||
          (data.length > 0 ? { currentPage: page, totalPages: page, totalItems: data.length } : null),
      );
    } catch (err) {
      manejarError(err);
    } finally {
      setLoadingLista(false);
    }
  }, [mes, anio, page, getAuthHeaders, manejarError]);

  // Recomendaciones automáticas del mes (las calcula el backend). Es un panel
  // complementario: si falla (o el endpoint aún no existe), no mostramos nada
  // y no molestamos con un error — el resumen principal ya maneja la sesión.
  const fetchRecomendaciones = useCallback(async () => {
    try {
      const axios = await getAxios();
      const res = await axios.get(`${BASE}/recomendaciones?mes=${mes}&anio=${anio}`, getAuthHeaders());
      setRecomendaciones(Array.isArray(res.data?.recomendaciones) ? res.data.recomendaciones : []);
    } catch (err) {
      setRecomendaciones([]);
      console.error("[FinanzasPersonales] No se pudieron cargar las recomendaciones:", err);
    }
  }, [mes, anio, getAuthHeaders]);

  useEffect(() => { fetchResumen(); }, [fetchResumen]);
  useEffect(() => { fetchLista(); }, [fetchLista]);
  useEffect(() => { fetchRecomendaciones(); }, [fetchRecomendaciones]);

  const cambiarMes = (nuevoMes, nuevoAnio) => {
    setMes(nuevoMes);
    setAnio(nuevoAnio);
    setPage(1);
  };

  const refrescar = () => {
    fetchResumen();
    fetchLista();
    fetchRecomendaciones();
  };

  const handleExito = (eraEdicion) => {
    setModal(null);
    fetchResumen();
    fetchRecomendaciones();
    if (!eraEdicion && page !== 1) setPage(1); // el nuevo queda de primero
    else fetchLista();
  };

  const confirmarEliminar = async () => {
    if (!aEliminar || eliminando) return;
    setEliminando(true);
    try {
      const axios = await getAxios();
      const res = await axios.delete(`${BASE}/${aEliminar._id}`, getAuthHeaders());
      mostrarNotif(res.data?.message || "Movimiento eliminado");
      setAEliminar(null);
      fetchResumen();
      fetchRecomendaciones();
      if (movimientos.length === 1 && page > 1) setPage((p) => p - 1);
      else fetchLista();
    } catch (err) {
      manejarError(err);
    } finally {
      setEliminando(false);
    }
  };

  const balance = resumen?.balance ?? 0;
  const balanceClase = balance >= 0 ? "verde" : "rojo";

  // Recomendaciones con lo importante primero (crítico → advertencia → resto).
  const recomOrdenadas = [...recomendaciones].sort(
    (a, b) => (ORDEN_NIVEL[a.nivel] ?? 9) - (ORDEN_NIVEL[b.nivel] ?? 9),
  );

  return (
    <div className="fade-in">
      {/* Aviso: sección privada, aparte del negocio */}
      <div className="fin-aviso mb-3">
        🔒 <strong>Mis Finanzas Personales</strong> — control privado de tus ingresos y gastos personales.
        Es aparte de la sala de juegos: acá no se mezclan ventas, plays ni reportes del negocio.
      </div>

      {/* Selector de mes/año */}
      <MesSelector mes={mes} anio={anio} onChange={cambiarMes} />

      {errorCarga ? (
        <ErrorRecarga onReintentar={refrescar} mensaje="No se pudieron cargar tus finanzas" />
      ) : loadingResumen && !resumen ? (
        <Cargando />
      ) : (
        <>
          {/* Tarjetas resumen (estado de resultados del mes) */}
          <div className="row g-3 mb-3">
            <div className="col-12 col-md-4">
              <div className="fin-kpi fin-kpi--verde">
                <span className="fin-kpi__label">📈 Ingresos del mes</span>
                <span className="fin-kpi__valor">{formatCRC(resumen?.totalIngresos)}</span>
              </div>
            </div>
            <div className="col-12 col-md-4">
              <div className="fin-kpi fin-kpi--rojo">
                <span className="fin-kpi__label">📉 Egresos del mes</span>
                <span className="fin-kpi__valor">{formatCRC(resumen?.totalEgresos)}</span>
              </div>
            </div>
            <div className="col-12 col-md-4">
              <div className={`fin-kpi fin-kpi--${balanceClase} fin-kpi--balance`}>
                <span className="fin-kpi__label">⚖️ Balance del mes</span>
                <span className="fin-kpi__valor">
                  {balance < 0 ? "-" : ""}{formatCRC(Math.abs(balance))}
                </span>
                <span className="fin-kpi__pie">{balance >= 0 ? "Te sobró este mes" : "Gastaste de más"}</span>
              </div>
            </div>
          </div>

          {/* Resumen inteligente: recomendaciones automáticas del mes */}
          {recomOrdenadas.length > 0 && (
            <div className="fin-recom-panel mb-4">
              <p className="fin-recom-titulo">🧠 Resumen inteligente del mes</p>
              <div className="fin-recom-lista">
                {recomOrdenadas.map((rec, i) => (
                  <div key={i} className={`fin-recom fin-recom--${rec.nivel || "info"}`}>
                    <span className="fin-recom__icono">{rec.icono}</span>
                    <span className="fin-recom__msg">{rec.mensaje}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Desglose por categoría + dona de gastos */}
          <div className="fin-desglose-wrap mb-4">
            <div className="fin-desglose-cols">
              <DesgloseBloque
                titulo="Ingresos por categoría"
                icono="📈"
                items={resumen?.desglose?.ingreso}
                colorClase="verde"
              />
              <DesgloseBloque
                titulo="Gastos por categoría"
                icono="📉"
                items={resumen?.desglose?.egreso}
                colorClase="rojo"
              />
            </div>
            {resumen?.desglose?.egreso?.length > 0 && (
              <div className="fin-donut-panel">
                <p className="fin-desglose__titulo">🍩 Distribución de gastos</p>
                <DonutGastos
                  items={[...resumen.desglose.egreso].sort((a, b) => (b.total || 0) - (a.total || 0))}
                />
                <div className="fin-donut-leyenda">
                  {[...resumen.desglose.egreso]
                    .sort((a, b) => (b.total || 0) - (a.total || 0))
                    .map((it, i) => (
                      <span key={it.categoria} className="fin-donut-leyenda__item">
                        <span className="fin-cat__dot" style={{ background: PALETA[i % PALETA.length] }} />
                        {it.categoria}
                      </span>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Botón agregar */}
          <div className="d-flex justify-content-end mb-3">
            <button
              className="btn admin-btn admin-btn--green px-4 fw-bold"
              onClick={() => setModal({ registro: null })}
              disabled={!categorias}
            >
              ＋ Agregar movimiento
            </button>
          </div>

          {/* Lista de movimientos del mes */}
          {loadingLista && movimientos.length === 0 ? (
            <Cargando />
          ) : movimientos.length === 0 ? (
            <EstadoVacio icono="💸" mensaje="No hay movimientos registrados este mes">
              <button
                className="btn admin-btn admin-btn--green px-4 fw-bold mt-3"
                onClick={() => setModal({ registro: null })}
                disabled={!categorias}
              >
                ＋ Agregar el primero
              </button>
            </EstadoVacio>
          ) : (
            <>
              <div className="mov-tabla">
                <div className="mov-tabla__head">
                  <span>Categoría</span>
                  <span>Monto</span>
                  <span>Descripción</span>
                  <span>Fecha</span>
                  <span className="text-end">Acciones</span>
                </div>
                {movimientos.map((m) => {
                  const esIngreso = m.tipo === "ingreso";
                  return (
                    <div key={m._id} className={`mov-row mov-row--${esIngreso ? "green" : "red"}`}>
                      <span className="mov-row__tipo">
                        <span className={`registro-item__badge registro-item__badge--${esIngreso ? "green" : "red"}`}>
                          {iconoCat(m.categoria, m.tipo)} {m.categoria}
                        </span>
                      </span>
                      <span className={`mov-row__monto mov-row__monto--${esIngreso ? "verde" : "rojo"}`}>
                        {esIngreso ? "+" : "−"}{formatCRC(m.monto)}
                        {m.moneda === "USD" && m.montoOriginal != null && (
                          <small className="mov-row__usd">
                            💵 {formatUSD(m.montoOriginal)}{m.tipoCambio ? ` × ${formatTC(m.tipoCambio)}` : ""}
                          </small>
                        )}
                      </span>
                      <span className="mov-row__desc">{m.descripcion || "—"}</span>
                      <span className="mov-row__fecha">{m.fecha ? formatFecha(m.fecha) : formatFecha(m.createdAt)}</span>
                      <span className="mov-row__acciones">
                        <button
                          className="accion-btn"
                          title="Editar"
                          aria-label="Editar movimiento"
                          onClick={() => setModal({ registro: m })}
                        >
                          ✏️
                        </button>
                        <button
                          className="accion-btn accion-btn--rojo"
                          title="Eliminar"
                          aria-label="Eliminar movimiento"
                          onClick={() => setAEliminar(m)}
                        >
                          🗑️
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
              <Paginacion pagination={pagination} onPage={setPage} loading={loadingLista} />
            </>
          )}
        </>
      )}

      {/* Modal crear / editar */}
      {modal && (
        <MovimientoModal
          registro={modal.registro}
          categorias={categorias}
          mes={mes}
          anio={anio}
          getAuthHeaders={getAuthHeaders}
          mostrarNotif={mostrarNotif}
          manejarError={manejarError}
          onCerrar={() => setModal(null)}
          onExito={() => handleExito(!!modal.registro)}
        />
      )}

      {/* Confirmación de eliminación */}
      {aEliminar && (
        <ConfirmarEliminar
          detalle={`${iconoCat(aEliminar.categoria, aEliminar.tipo)} ${aEliminar.categoria} · ${formatCRC(aEliminar.monto)}`}
          eliminando={eliminando}
          onCancelar={() => setAEliminar(null)}
          onConfirmar={confirmarEliminar}
        />
      )}
    </div>
  );
};

export default FinanzasPersonalesPanel;
