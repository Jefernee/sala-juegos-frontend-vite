// Mis Finanzas Personales — control de gastos e ingresos personales del dueño.
// Es EXCLUSIVO del administrador y está totalmente aparte de la sala de juegos:
// no mezcla números con ventas, plays ni reportes del negocio. Toda la data
// vive en /api/finanzas-personales (el backend responde 403 si no es admin).
//
// Estructura: selector de mes/año → estado de resultados (ingresos, egresos,
// balance) → desglose por categoría con dona de gastos → lista de movimientos
// del mes con alta/edición/eliminación (modal).
//
// Desde acá se llega también al saldo de apertura (modal) y al reporte anual,
// que reemplaza esta vista sin salir de la pestaña de Administración.
import { useState, useEffect, useCallback } from "react";
import { getAxios, formatCRC, formatFecha, nombreMes, MESES } from "./adminUtils";
import {
  FIN_BASE as BASE, formatCRCsigned, formatMontoInput, limpiarMontoInput,
  PALETA, iconoCat, esAhorro, TIPOS_MOV, metaTipo,
} from "./finanzasComunes";
import MesSelector from "./MesSelector";
import FinanzasAperturaModal from "./FinanzasAperturaModal";
import FinanzasReporteAnual from "./FinanzasReporteAnual";
import { ModalOverlay, ConfirmarEliminar, Paginacion, ErrorRecarga, EstadoVacio, Cargando } from "./Comunes";

const LIMITE = 10;

// Al pagar en dólares, el tipo de cambio del día se trae automáticamente (API
// de Hacienda) y solo se muestra —no se edita—; el monto se convierte a colones
// (el backend guarda todo en ₡) y el detalle en dólares queda en la descripción.

// "$1,250.50" — formato de dólares (permite decimales)
const formatUSD = (monto) =>
  "$" + (Number(monto) || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

// formatCRCsigned, formatMontoInput y limpiarMontoInput viven en
// finanzasComunes.js: los comparte con el modal de apertura y el reporte anual.

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

// Tasa aplicable según el tipo: egreso → venta, ingreso y retiro del ahorro →
// compra (en los dos casos entran dólares que se cambian a colones y el banco te
// los compra). Tolera formas viejas del dato (ej. { valor }) cayendo a ese valor,
// para no quedar en 0 si en memoria persiste una versión previa (hot-reload/caché).
const tasaSegunTipo = (tcData, tipo) => {
  if (!tcData) return 0;
  if (tcData.guardado) return Number(tcData.valor) || 0;   // registro USD ya guardado
  const tasa = tipo === "egreso" ? tcData.venta : tcData.compra;
  return Number(tasa) || Number(tcData.valor) || 0;
};

// PALETA, iconoCat y esAhorro viven en finanzasComunes.js (compartidos con el
// reporte anual).

// Categorías del backend cacheadas en memoria: { ingreso: [], egreso: [] }.
let catCache = null;
// Config del gasto pagado con el ahorro que viene en la misma llamada:
// { bolsas: ["Ahorro", …], sinFondoAhorro: [...] }. Si el backend no la manda
// (versión vieja), queda con listas vacías y el check simplemente no aparece.
let ahorroCfgCache = null;

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

// ─── BLOQUE DE AHORRO DEL MES ────────────────────────────────────────────────
// El ahorro viene dentro de desglose.egreso, pero no es gasto. Se muestra aparte
// con su total y, si hay varias metas de ahorro, un mini desglose de cada una.
// Los retiros (desglose.retiro, que el backend manda YA separado) se listan acá
// mismo: es el único lugar donde se ve el movimiento completo del ahorro del mes
// —lo que entró y lo que salió— y abajo el neto.
const AhorroBloque = ({ items, retiros, neto }) => {
  const ordenado = [...(items || [])].sort((a, b) => (b.total || 0) - (a.total || 0));
  const retirado = [...(retiros || [])].sort((a, b) => (b.total || 0) - (a.total || 0));
  if (ordenado.length === 0 && retirado.length === 0) return null;
  const total = ordenado.reduce((s, it) => s + (Number(it.total) || 0), 0);
  const totalRetirado = retirado.reduce((s, it) => s + (Number(it.total) || 0), 0);

  const fila = (it, tipo) => (
    <div key={`${tipo}-${it.categoria}`} className="fin-ahorro__item">
      <span className="fin-ahorro__item-nombre">
        {iconoCat(it.categoria, "egreso")} {it.categoria}
        <span className="fin-cat__cantidad">
          ({it.cantidad} {it.cantidad === 1 ? "mov." : "movs."})
        </span>
      </span>
      <span className={`fin-ahorro__item-monto ${tipo === "retiro" ? "fin-ahorro__item-monto--retiro" : ""}`}>
        {tipo === "retiro" ? "−" : ""}{formatCRC(it.total)}
      </span>
    </div>
  );

  return (
    <div className="fin-ahorro">
      <div className="fin-ahorro__head">
        <span className="fin-ahorro__titulo">🐷 Ahorro del mes</span>
        <span className="fin-ahorro__total">{formatCRC(total)}</span>
      </div>
      {(ordenado.length > 1 || retirado.length > 0) && (
        <div className="fin-ahorro__lista">
          {ordenado.map((it) => fila(it, "ahorro"))}
          {retirado.length > 0 && (
            <>
              <div className="fin-ahorro__subtitulo">🏧 Sacado del ahorro</div>
              {retirado.map((it) => fila(it, "retiro"))}
              <div className="fin-ahorro__item fin-ahorro__item--neto">
                <span className="fin-ahorro__item-nombre">Neto del mes</span>
                <span className="fin-ahorro__item-monto">{formatCRCsigned(neto ?? total - totalRetirado)}</span>
              </div>
            </>
          )}
        </div>
      )}
      <p className="fin-ahorro__nota">
        El ahorro no cuenta como gasto: queda fuera de la distribución de gastos.
        {retirado.length > 0 && " Lo que sacaste tampoco es un ingreso: es ahorro que volvió a estar a mano."}
      </p>
    </div>
  );
};

// ─── MODAL CREAR / EDITAR MOVIMIENTO ─────────────────────────────────────────
const MovimientoModal = ({
  registro, categorias, ahorroCfg, mes, anio,
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
  // "Lo pagué con el ahorro": el egreso sale del ahorro y se consume en el acto,
  // así que no toca el saldo ni "Puedo gastar hasta" del mes, solo baja el
  // ahorro acumulado. Se manda como `fondo: "ahorro"` + la bolsa de la que salió.
  const [pagadoConAhorro, setPagadoConAhorro] = useState(registro?.fondo === "ahorro");
  const [bolsaAhorro, setBolsaAhorro] = useState(registro?.bolsaAhorro || "");
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [topeRetiro, setTopeRetiro] = useState(null); // tope que devolvió el 400

  const hoy = new Date();
  const esMesActual = mes === hoy.getMonth() + 1 && anio === hoy.getFullYear();
  const esRetiro = tipo === "retiro_ahorro";
  // El botón de "Sacar del ahorro" depende de que el backend mande sus categorías.
  const hayRetiros = (categorias?.retiro_ahorro || []).length > 0;
  const opcionesBase = categorias?.[tipo] || [];
  // Si se edita un movimiento cuya categoría ya no está en la lista, se incluye
  // igual para que no quede en blanco el select.
  const opciones = categoria && !opcionesBase.includes(categoria)
    ? [categoria, ...opcionesBase]
    : opcionesBase;

  // El check de "pagado con el ahorro" solo tiene sentido en un egreso, y se
  // oculta si la categoría elegida es de ahorro (apartar ahorro pagándolo con
  // ahorro no significa nada: para mover plata entre bolsas van un retiro y un
  // ahorro nuevo). Depende de que el backend mande las bolsas en `/categorias`.
  // Si el backend no manda las bolsas (versión vieja) pero se está editando un
  // gasto que ya venía pagado con el ahorro, se usa la suya: así el check sigue
  // visible y no se convierte en un egreso normal sin querer al guardar.
  const bolsas = ahorroCfg?.bolsas?.length
    ? ahorroCfg.bolsas
    : (registro?.bolsaAhorro ? [registro.bolsaAhorro] : []);
  const catSinFondoAhorro = ahorroCfg?.sinFondoAhorro || [];
  const categoriaEsAhorro = !!categoria
    && (catSinFondoAhorro.includes(categoria) || esAhorro(categoria));
  const puedePagarConAhorro = tipo === "egreso" && bolsas.length > 0 && !categoriaEsAhorro;
  const conAhorro = puedePagarConAhorro && pagadoConAhorro;

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
    setErrores((er) => ({ ...er, tipo: "", categoria: "", bolsaAhorro: "" }));
    if (!(categorias?.[nuevoTipo] || []).includes(categoria)) setCategoria("");
    // Solo un egreso puede pagarse con el ahorro: al pasar a ingreso o retiro
    // se destilda (el backend lo rechazaría con 400).
    if (nuevoTipo !== "egreso") setPagadoConAhorro(false);
  };

  // Al elegir una categoría de ahorro el check desaparece; se destilda para no
  // dejar un `fondo: "ahorro"` colgado que el backend rechazaría.
  const cambiarCategoria = (nueva) => {
    setCategoria(nueva);
    setErrores((er) => ({ ...er, categoria: "", bolsaAhorro: "" }));
    if (catSinFondoAhorro.includes(nueva) || esAhorro(nueva)) setPagadoConAhorro(false);
  };

  const validar = () => {
    const e = {};
    if (!tipo) e.tipo = "Elegí el tipo";
    if (!categoria) e.categoria = "Elegí una categoría";
    if (!monto || montoNum <= 0) e.monto = "Ingresá un monto mayor a 0";
    if (esUSD && !tcListo) e.monto = "Esperá el tipo de cambio del día (o registralo en colones)";
    if (conAhorro && !bolsaAhorro) e.bolsaAhorro = "Elegí de cuál ahorro salió";
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
      // `fondo` viaja SIEMPRE: al editar, si el movimiento deja de ser un gasto
      // pagado con ahorro (pasa a ingreso, a retiro o a categoría de ahorro),
      // el backend exige el "mes" explícito o responde 400.
      body.fondo = conAhorro ? "ahorro" : "mes";
      if (conAhorro) body.bolsaAhorro = bolsaAhorro;

      const desc = descripcion.trim();
      if (esEdicion) body.descripcion = desc; // permite limpiar la descripción
      else if (desc) body.descripcion = desc;

      const res = esEdicion
        ? await axios.put(`${BASE}/${registro._id}`, body, getAuthHeaders())
        : await axios.post(BASE, body, getAuthHeaders());
      mostrarNotif(res.data?.message || (esEdicion ? "Movimiento actualizado" : "Movimiento registrado"));
      onExito();
    } catch (err) {
      // Al retirar más de lo acumulado el backend responde 400 con un `message`
      // ya redactado para el usuario y `disponible` = el tope en colones. Eso es
      // un error DEL CAMPO monto (no de conexión), así que se muestra debajo del
      // input en vez de en un toast que se va solo.
      const data = err?.response?.data;
      if (err?.response?.status === 400 && data?.disponible != null) {
        setErrores((er) => ({ ...er, monto: data.message || "No tenés tanto ahorro acumulado" }));
        setTopeRetiro(Number(data.disponible) || 0);
      } else {
        manejarError(err);
      }
    } finally {
      setGuardando(false);
    }
  };

  const color = metaTipo(tipo).color;

  return (
    <ModalOverlay onCerrar={onCerrar} bloqueado={guardando}>
      <div className={`admin-modal__header admin-panel__header--${tipo === "ingreso" ? "green" : esRetiro ? "blue" : "orange"}`}>
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

        {/* Tipo: ingreso / egreso / sacar del ahorro. El tercero solo se ofrece
            si el backend manda sus categorías (`categorias.retiro_ahorro`), así
            no aparece una opción que no se podría guardar. */}
        <div className="mb-3">
          <label className="admin-label">Tipo *</label>
          <div className="tipo-toggle">
            {TIPOS_MOV.filter((t) => t.id !== "retiro_ahorro" || hayRetiros).map((t) => (
              <button
                key={t.id}
                type="button"
                className={`tipo-toggle__btn ${tipo === t.id ? `tipo-toggle__btn--active-${t.color}` : ""}`}
                onClick={() => cambiarTipo(t.id)}
                disabled={guardando}
              >
                {t.label}
              </button>
            ))}
          </div>
          {errores.tipo && <div className="campo-error">{errores.tipo}</div>}
          {esRetiro && (
            <div className="fin-retiro-nota mt-2">
              🏧 Sacar del ahorro no es un ingreso del mes: la plata vuelve a estar a mano
              y se descuenta de tu ahorro acumulado.
            </div>
          )}
        </div>

        {/* Categoría (según el tipo) */}
        <div className="mb-3">
          <label className="admin-label">Categoría *</label>
          <select
            className={`form-select admin-select ${errores.categoria ? "admin-input--error" : ""}`}
            value={categoria}
            disabled={guardando || opciones.length === 0}
            onChange={(e) => cambiarCategoria(e.target.value)}
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

          {/* Tope que devolvió el backend al rechazar el retiro: se ofrece para
              rellenar el campo con el máximo en un click. */}
          {topeRetiro != null && (esRetiro || conAhorro) && (
            <div className="fin-retiro-tope">
              Máximo disponible: <strong>{formatCRC(topeRetiro)}</strong>
              <button
                type="button"
                className="moneda-tc-reintentar"
                onClick={() => {
                  cambiarMoneda("CRC");
                  setMonto(String(topeRetiro));
                  setErrores((er) => ({ ...er, monto: "" }));
                }}
                disabled={guardando}
              >
                Usar el máximo
              </button>
            </div>
          )}

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
                  {tipo === "egreso"
                    ? "Gasto en dólares: se usa la tasa de venta (lo que cuesta comprar los dólares)."
                    : esRetiro
                      ? "Retiro en dólares: se usa la tasa de compra (lo que te dan al cambiarlos a colones)."
                      : "Ingreso en dólares: se usa la tasa de compra (lo que te dan al cambiarlos a colones)."}
                </div>
              )}
            </div>
          )}
        </div>

        {/* "Lo pagué con el ahorro": egreso que sale del ahorro y se consume en
            el acto (el teléfono pagado con el Ahorro MEP). Un solo movimiento:
            no toca el saldo del mes, solo baja el ahorro acumulado. Se oculta si
            la categoría elegida ya es de ahorro. */}
        {puedePagarConAhorro && (
          <div className="mb-3">
            <label className="fin-fondo-check">
              <input
                type="checkbox"
                checked={pagadoConAhorro}
                disabled={guardando}
                onChange={(e) => {
                  setPagadoConAhorro(e.target.checked);
                  setErrores((er) => ({ ...er, bolsaAhorro: "" }));
                }}
              />
              <span>🏦 Lo pagué con el ahorro</span>
            </label>

            {conAhorro && (
              <>
                <select
                  className={`form-select admin-select mt-2 ${errores.bolsaAhorro ? "admin-input--error" : ""}`}
                  value={bolsaAhorro}
                  disabled={guardando}
                  onChange={(e) => {
                    setBolsaAhorro(e.target.value);
                    setErrores((er) => ({ ...er, bolsaAhorro: "" }));
                  }}
                >
                  <option value="">¿De cuál ahorro salió?</option>
                  {bolsas.map((b) => (
                    <option key={b} value={b}>{iconoCat(b, "egreso")} {b}</option>
                  ))}
                </select>
                {errores.bolsaAhorro && <div className="campo-error">{errores.bolsaAhorro}</div>}
                <div className="fin-retiro-nota mt-2">
                  Esta plata sale del ahorro, no del dinero del mes: no cambia tu saldo
                  ni “Puedo gastar hasta”, solo baja tu ahorro acumulado.
                </div>
              </>
            )}
          </div>
        )}

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
  const [ahorroCfg, setAhorroCfg] = useState(null);     // { bolsas:[], sinFondoAhorro:[] }
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
  const [modalApertura, setModalApertura] = useState(false);
  const [vista, setVista] = useState("mes");       // "mes" | "anual"

  // Categorías: se cargan una sola vez (alimentan el select del modal) y quedan
  // cacheadas en memoria, así volver a la pestaña no repite la llamada.
  useEffect(() => {
    if (catCache) { setCategorias(catCache); setAhorroCfg(ahorroCfgCache); return; }
    let vivo = true;
    (async () => {
      try {
        const axios = await getAxios();
        const res = await axios.get(`${BASE}/categorias`, getAuthHeaders());
        // Se usan tal cual las manda el backend (fuente de verdad, incluido el
        // ORDEN: viene agrupado por tema y no se reordena acá). Lo que se ve en
        // el select es exactamente lo que se envía y lo que el backend valida,
        // así que agregar categorías allá no requiere tocar el frontend.
        catCache = res.data?.categorias || { ingreso: [], egreso: [] };
        ahorroCfgCache = {
          bolsas: res.data?.bolsasAhorro || [],
          sinFondoAhorro: res.data?.categoriasSinFondoAhorro || [],
        };
        if (vivo) { setCategorias(catCache); setAhorroCfg(ahorroCfgCache); }
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

  // OJO con `balance`, que significa dos cosas según el endpoint:
  //   GET /resumen        → `balance` = saldoFinal (nombre viejo, compatibilidad)
  //                         `balanceMes` = ingresos − egresos
  //   GET /resumen-anual  → `totales.balance` = ingresos − egresos
  // Acá se usa `saldoFinal` directo para no caer en la trampa. Si algún día hace
  // falta "lo que generó el mes", es `balanceMes` — nunca `balance`.
  // Verde si queda dinero disponible, rojo si el mes cerró en déficit.
  const saldoFinalClase = (resumen?.saldoFinal ?? 0) >= 0 ? "verde" : "rojo";

  // Retiro del ahorro: plata que se sacó del ahorro este mes. NO es un ingreso
  // (no entra en totalIngresos ni en los porcentajes) y tampoco un gasto: suma a
  // `disponible` y se descuenta del ahorro acumulado. Solo se muestra si hubo.
  const totalRetiro = resumen?.totalRetiroAhorro ?? 0;
  const huboRetiro = totalRetiro > 0;

  // libreParaGastar = ingresos − egresos (lo calcula el backend; cambió de
  // fórmula al aparecer los retiros: antes era saldoFinal − saldoInicial). Es lo
  // que el mes generó por sí solo, así que sacar del ahorro NO lo infla — que era
  // justo el riesgo: la tarjeta habría premiado vaciar el ahorro.
  const libreParaGastar = resumen?.libreParaGastar ?? 0;
  const gastoMasDeLoQueEntro = libreParaGastar < 0;
  // Con saldo inicial negativo no hay nada "que traías" que cuidar: se venía
  // debiendo, así que el subtítulo lo dice tal cual.
  const arrancoDebiendo = (resumen?.saldoInicial ?? 0) < 0;
  const libreSubtitulo = gastoMasDeLoQueEntro
    ? huboRetiro
      ? `lo tapaste con ${formatCRC(totalRetiro)} que sacaste del ahorro`
      : arrancoDebiendo
        ? `y arrancaste el mes debiendo ${formatCRC(Math.abs(resumen?.saldoInicial ?? 0))}`
        : `le sacaste ${formatCRC(Math.abs(libreParaGastar))} a lo que traías`
    : arrancoDebiendo
      ? `arrancaste el mes debiendo ${formatCRC(Math.abs(resumen?.saldoInicial ?? 0))}`
      : `sin tocar tu saldo inicial (${formatCRC(resumen?.saldoInicial)})`;

  // El ahorro viene dentro de desglose.egreso pero no es consumo: se separa para
  // que la dona y el desglose de "Gastos por categoría" reflejen el gasto real,
  // y el ahorro se muestre en su propio bloque. (Los KPIs y el balance siguen
  // saliendo tal cual del backend, que sí incluye el ahorro en los egresos.)
  const egresoTodo = resumen?.desglose?.egreso || [];
  const gastosReales = egresoTodo.filter((it) => !esAhorro(it.categoria));
  const ahorros = egresoTodo.filter((it) => esAhorro(it.categoria));
  const gastosOrdenados = [...gastosReales].sort((a, b) => (b.total || 0) - (a.total || 0));

  // Saldo de apertura: la plata que ya se tenía ANTES de empezar a registrar.
  // No es un movimiento, así que no aparece en ningún ingreso ni gasto: solo
  // alimenta el ahorro acumulado y el colchón de emergencia. El resumen del mes
  // ya lo trae, así que el chip no necesita una llamada aparte (el modal sí hace
  // su propio GET para precargar también la descripción).
  const apertura = resumen?.apertura || null;

  // `ahorroAcumulado` y `patrimonio` llegan en el resumen del mes, pero NO se
  // muestran acá a propósito: la vista del mes se queda con el estado de
  // resultados del mes y el acumulado se ve en el reporte anual (ahí sí tiene
  // contexto: de cuánto arrancó el año y en cuánto cerró).

  // El reporte anual reemplaza esta vista sin salir de la pestaña: se vuelve con
  // "← Volver al mes" y el mes seleccionado queda intacto.
  if (vista === "anual") {
    return (
      <FinanzasReporteAnual
        anioInicial={anio}
        getAuthHeaders={getAuthHeaders}
        manejarError={manejarError}
        onVolver={() => setVista("mes")}
      />
    );
  }

  return (
    <div className="fade-in fin-ancho">
      {/* Aviso: sección privada, aparte del negocio */}
      <div className="fin-aviso mb-3">
        🔒 <strong>Mis Finanzas Personales</strong> — control privado de tus ingresos y gastos personales.
        Es aparte de la sala de juegos: acá no se mezclan ventas, plays ni reportes del negocio.
      </div>

      {/* Acciones del módulo: saldo de apertura y reporte anual */}
      <div className="fin-acciones mb-3">
        {apertura ? (
          <button
            className="fin-apertura-chip"
            onClick={() => setModalApertura(true)}
            title="Editar el saldo de apertura"
          >
            <span className="fin-apertura-chip__texto">
              ⭐ <strong>Saldo de apertura</strong> · {MESES[(apertura.mesCorte || 1) - 1]} {apertura.anioCorte} ·{" "}
              {formatCRC(apertura.montoAhorro)} apartados
              {(apertura.montoDisponible || 0) > 0 && ` · ${formatCRC(apertura.montoDisponible)} a mano`}
              {apertura.vigente === false && " · aún no aplica a este mes"}
            </span>
            <span className="fin-apertura-chip__editar">✏️ Editar</span>
          </button>
        ) : (
          <button className="admin-btn-ghost" onClick={() => setModalApertura(true)}>
            ⭐ Ya tenía ahorros de antes
          </button>
        )}
        {/* "Agregar movimiento" vive acá arriba a propósito: es lo que más se
            usa y antes obligaba a bajar hasta el final de la lista. El modal
            avisa en qué mes se va a guardar si no es el mes actual. */}
        <div className="fin-acciones__botones">
          <button
            className="btn admin-btn admin-btn--green px-4 fw-bold"
            onClick={() => setModal({ registro: null })}
            disabled={!categorias}
          >
            ＋ Agregar movimiento
          </button>
          <button className="btn admin-btn admin-btn--blue px-4 fw-bold" onClick={() => setVista("anual")}>
            📅 Reporte del año
          </button>
        </div>
      </div>

      {/* Selector de mes/año */}
      <MesSelector mes={mes} anio={anio} onChange={cambiarMes} />

      {errorCarga ? (
        <ErrorRecarga onReintentar={refrescar} mensaje="No se pudieron cargar tus finanzas" />
      ) : loadingResumen && !resumen ? (
        <Cargando />
      ) : (
        <>
          {/* Resumen del mes (estado de resultados personal). El orden es exacto:
              del saldo que se trae del mes anterior hasta el que queda al final.
              Todo viene calculado del backend; acá solo se pinta. */}
          <div className="fin-resumen mb-3">
            <div className="fin-resumen__fila">
              <span className="fin-resumen__label">💼 Saldo inicial</span>
              <span className="fin-resumen__monto fin-resumen__monto--neutro">
                {formatCRCsigned(resumen?.saldoInicial)}
              </span>
            </div>
            <div className="fin-resumen__fila">
              <span className="fin-resumen__label">📈 Ingresos del mes</span>
              <span className="fin-resumen__monto fin-resumen__monto--verde">
                {formatCRC(resumen?.totalIngresos)}
              </span>
            </div>
            {/* Va antes de "Disponible" porque disponible = saldo inicial +
                ingresos + retiro del ahorro. */}
            {huboRetiro && (
              <div className="fin-resumen__fila">
                <span className="fin-resumen__label">
                  🏧 Sacado del ahorro
                  <small className="fin-resumen__sublabel">
                    no es ingreso del mes: es ahorro que volvió a estar a mano
                  </small>
                </span>
                <span className="fin-resumen__monto fin-resumen__monto--azul">
                  {formatCRC(totalRetiro)}
                </span>
              </div>
            )}
            <div className="fin-resumen__fila fin-resumen__fila--destacada">
              <span className="fin-resumen__label">💵 Disponible para usar</span>
              <span className="fin-resumen__monto fin-resumen__monto--azul">
                {formatCRC(resumen?.disponible)}
              </span>
            </div>
            <div className="fin-resumen__fila">
              <span className="fin-resumen__label">📉 Egresos del mes</span>
              <span className="fin-resumen__monto fin-resumen__monto--rojo">
                {formatCRC(resumen?.totalGastos)}
              </span>
            </div>
            <div className="fin-resumen__fila">
              <span className="fin-resumen__label">
                🐷 Ahorro del mes
                {/* totalAhorro es lo APARTADO (bruto). Si hubo retiro, el neto
                    del mes puede ser negativo, y ese es el número que importa. */}
                {huboRetiro && (
                  <small className="fin-resumen__sublabel">
                    neto del mes {formatCRCsigned(resumen?.ahorroNetoMes)} (apartaste{" "}
                    {formatCRC(resumen?.totalAhorro)}, sacaste {formatCRC(totalRetiro)})
                  </small>
                )}
              </span>
              <span className="fin-resumen__monto fin-resumen__monto--ahorro">
                {formatCRC(resumen?.totalAhorro)}
              </span>
            </div>
            <div className="fin-resumen__fila fin-resumen__fila--total">
              <span className="fin-resumen__label">⚖️ Saldo final</span>
              <span className={`fin-resumen__monto fin-resumen__monto--${saldoFinalClase}`}>
                {formatCRCsigned(resumen?.saldoFinal)}
              </span>
            </div>
            <div className="fin-resumen__fila fin-resumen__fila--libre">
              <span className="fin-resumen__label">
                {gastoMasDeLoQueEntro ? "⚠️ Gastaste más de lo que entró" : "💸 Puedo gastar hasta"}
                <small className="fin-resumen__sublabel">{libreSubtitulo}</small>
              </span>
              <span
                className={`fin-resumen__monto fin-resumen__monto--${gastoMasDeLoQueEntro ? "rojo" : "verde"}`}
              >
                {formatCRC(Math.abs(libreParaGastar))}
              </span>
            </div>

          </div>

          {/* Resumen inteligente: recomendaciones automáticas del mes.
              El backend ya manda los avisos ordenados por urgencia (crítico →
              advertencia → consejo → bien → info) y recortados a los 4 más
              importantes: se pintan TAL CUAL llegan, sin reordenar ni recortar.
              El texto es largo a propósito (explica el porqué), así que no se
              trunca. Y nada se recalcula acá: los montos y porcentajes vienen
              ya formateados, y el ícono lo decide el backend. */}
          {recomendaciones.length > 0 && (
            <div className="fin-recom-panel mb-4">
              <p className="fin-recom-titulo">🧠 Resumen inteligente del mes</p>
              <div className="fin-recom-lista">
                {recomendaciones.map((rec, i) => (
                  <div key={i} className={`fin-recom fin-recom--${rec.nivel || "info"}`}>
                    {rec.icono && <span className="fin-recom__icono">{rec.icono}</span>}
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
                items={gastosReales}
                colorClase="rojo"
              />
            </div>
            {gastosOrdenados.length > 0 && (
              <div className="fin-donut-panel">
                <p className="fin-desglose__titulo">🍩 Distribución de gastos</p>
                <DonutGastos items={gastosOrdenados} />
                <div className="fin-donut-leyenda">
                  {gastosOrdenados.map((it, i) => (
                    <span key={it.categoria} className="fin-donut-leyenda__item">
                      <span className="fin-cat__dot" style={{ background: PALETA[i % PALETA.length] }} />
                      {it.categoria}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Ahorro del mes: aparte del gráfico de gastos (no es consumo).
              `desglose.retiro` ya viene separado del backend: no se filtra. */}
          <AhorroBloque
            items={ahorros}
            retiros={resumen?.desglose?.retiro}
            neto={resumen?.ahorroNetoMes}
          />

          {/* Lista de movimientos del mes. El botón de agregar no se repite acá:
              está arriba, en las acciones del módulo. */}
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
                  // Cada tipo tiene su color y su signo (el retiro del ahorro va
                  // en azul y con "+": la plata vuelve a estar a mano).
                  const meta = metaTipo(m.tipo);
                  return (
                    <div key={m._id} className={`mov-row mov-row--${meta.color}`}>
                      <span className="mov-row__tipo">
                        <span className={`registro-item__badge registro-item__badge--${meta.color}`}>
                          {iconoCat(m.categoria, m.tipo)} {m.categoria}
                          {m.tipo === "retiro_ahorro" && " (retiro)"}
                        </span>
                      </span>
                      <span className={`mov-row__monto mov-row__monto--${meta.montoClase}`}>
                        {meta.signo}{formatCRC(m.monto)}
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
          ahorroCfg={ahorroCfg}
          mes={mes}
          anio={anio}
          getAuthHeaders={getAuthHeaders}
          mostrarNotif={mostrarNotif}
          manejarError={manejarError}
          onCerrar={() => setModal(null)}
          onExito={() => handleExito(!!modal.registro)}
        />
      )}

      {/* Saldo de apertura (crear / editar / borrar). Al guardar se recarga el
          resumen para que el ahorro acumulado y el patrimonio se actualicen. */}
      {modalApertura && (
        <FinanzasAperturaModal
          getAuthHeaders={getAuthHeaders}
          mostrarNotif={mostrarNotif}
          manejarError={manejarError}
          onCerrar={() => setModalApertura(false)}
          onGuardado={() => {
            setModalApertura(false);
            fetchResumen();
            fetchRecomendaciones();
          }}
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
