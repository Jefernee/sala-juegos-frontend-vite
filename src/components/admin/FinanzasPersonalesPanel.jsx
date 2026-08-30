// Mis Finanzas Personales — control de gastos e ingresos personales del dueño.
// Es EXCLUSIVO del administrador y está totalmente aparte de la sala de juegos:
// no mezcla números con ventas, plays ni reportes del negocio. Toda la data
// vive en /api/finanzas-personales (el backend responde 403 si no es admin).
//
// La pantalla está armada sobre un modelo de DOS BOLSILLOS, no sobre un estado
// de resultados contable: toda la plata está en "Tu plata" (lo que puede usar
// hoy) o en "Tus ahorros" (lo que tiene apartado), y solo se pueden hacer tres
// cosas: entró plata, gasté, ahorré. Antes había doce tarjetas con nombres de
// contador (disponible, libreParaGastar, variacionSaldo, patrimonio, tasa de
// ahorro…) y el dueño no podía verificar si los números daban ni, cuando no
// daban, en cuál línea estaba el problema.
//
// Orden de la pantalla (lo pidió así): los dos totales → anotar → la escalera
// de la plata → la escalera de los ahorros → en qué se fue → qué dicen tus
// números → movimientos del mes.
//
// Las dos escaleras son el corazón: cada línea suma o resta la de arriba y
// cierra en el total, así que se pueden verificar a mano. Los números salen
// TODOS del backend, nunca se recalculan acá.
import { useState, useEffect, useCallback, useMemo } from "react";
import { getAxios, formatCRC, formatFecha, nombreMes, MESES } from "./adminUtils";
import {
  FIN_BASE as BASE, formatMontoInput, limpiarMontoInput,
  PALETA, iconoCat, esAhorro,
} from "./finanzasComunes";
import { Bolsas, Escalera } from "./FinanzasBolsas";
import MesSelector from "./MesSelector";
import FinanzasAperturaModal from "./FinanzasAperturaModal";
import FinanzasReporteAnual from "./FinanzasReporteAnual";
import { ModalOverlay, ConfirmarEliminar, Paginacion, ErrorRecarga, EstadoVacio, Cargando } from "./Comunes";

const LIMITE = 10;

// ─── LAS TRES COSAS QUE SE PUEDEN HACER ──────────────────────────────────────
// No son los `tipos` del backend: "Gasté" y "Ahorré" son los dos un `egreso`
// (apartar ahorro es sacar plata del bolsillo del mes y ponerla en el otro),
// y lo que los distingue es la categoría. Se traduce acá, en un solo lugar.
//
// `retiro_ahorro` era un cuarto tipo ("sacar del ahorro") y YA NO SE OFRECE:
// fue justo lo que rompió las cuentas —sacar ₡291.200 para un teléfono y
// anotarlo como retiro dejaba el saldo final inflado por ese monto, y anotar
// además el gasto bajaba "puedo gastar hasta" sin que el mes hubiera puesto un
// colón—. Hoy eso es un gasto pagado con el ahorro: un solo movimiento. El
// backend lo sigue aceptando por compatibilidad, así que los movimientos viejos
// se pueden ver y corregir (ver ACCION_RETIRO), pero no se puede crear uno nuevo.
const ACCIONES = [
  { id: "entro",  emoji: "💰", label: "Entró plata", labelCat: "¿De dónde vino?",  color: "verde" },
  { id: "gaste",  emoji: "🛒", label: "Gasté",       labelCat: "¿En qué?",         color: "rojo" },
  { id: "ahorre", emoji: "🐷", label: "Ahorré",      labelCat: "¿A cuál ahorro?",  color: "ambar" },
];

// Solo aparece al EDITAR un movimiento viejo que se anotó como retiro, para
// poder reclasificarlo. Nunca se ofrece para uno nuevo.
const ACCION_RETIRO = {
  id: "retiro", emoji: "🏧", label: "Sacaste del ahorro",
  labelCat: "¿De cuál ahorro?", color: "azul",
};

const metaAccion = (id) => [...ACCIONES, ACCION_RETIRO].find((a) => a.id === id) || ACCIONES[1];

// Qué `tipo` del backend le corresponde a cada acción.
const tipoDeAccion = (accion) =>
  accion === "entro" ? "ingreso" : accion === "retiro" ? "retiro_ahorro" : "egreso";

// Al pagar en dólares, el tipo de cambio del día se trae automáticamente (API
// de Hacienda) y solo se muestra —no se edita—; el monto se convierte a colones
// (el backend guarda todo en ₡) y el detalle en dólares queda en la descripción.

// "$1,250.50" — formato de dólares (permite decimales)
const formatUSD = (monto) =>
  "$" + (Number(monto) || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

// formatMontoInput y limpiarMontoInput viven en finanzasComunes.js: los
// comparte con el modal de apertura y el reporte anual.

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
// (versión vieja), queda con listas vacías y "De mis ahorros" no se ofrece.
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


// ─── DETALLE DE LOS AHORROS ──────────────────────────────────────────────────
// La escalera de arriba dice CUÁNTO se movió el ahorro; esto dice EN QUÉ y DE
// CUÁL bolsa. Tres listas, cada una solo si tiene algo:
//   • lo que se apartó, por bolsa (sale de desglose.egreso: apartar es un egreso
//     del mes con categoría de ahorro, aunque no sea consumo);
//   • lo que se pagó con los ahorros, en qué se fue (desglose.gastoAhorro) y de
//     cuál bolsa salió (desglose.gastoAhorroPorBolsa), que el backend manda ya
//     separados de desglose.egreso para que la dona del mes no cuente plata que
//     no salió del mes;
//   • los retiros viejos (desglose.retiro), que con datos nuevos siempre va vacío.
const AhorroDetalle = ({ apartado, pagado, pagadoPorBolsa, retiros }) => {
  const orden = (xs) => [...(xs || [])].sort((a, b) => (b.total || 0) - (a.total || 0));
  const apartados = orden(apartado);
  const pagados = orden(pagado);
  const bolsasPago = orden(pagadoPorBolsa);
  const retirados = orden(retiros);
  if (!apartados.length && !pagados.length && !retirados.length) return null;

  const fila = (it, clase) => (
    <div key={`${clase}-${it.categoria}`} className="fin-ahorro__item">
      <span className="fin-ahorro__item-nombre">
        {iconoCat(it.categoria, "egreso")} {it.categoria}
        <span className="fin-cat__cantidad">
          ({it.cantidad} {it.cantidad === 1 ? "mov." : "movs."})
        </span>
      </span>
      <span className={`fin-ahorro__item-monto fin-ahorro__item-monto--${clase}`}>
        {clase === "apartado" ? "+" : "−"}{formatCRC(it.total)}
      </span>
    </div>
  );

  return (
    <div className="fin-ahorro">
      <div className="fin-ahorro__lista">
        {apartados.length > 0 && (
          <>
            <div className="fin-ahorro__subtitulo">🐷 Lo que apartaste</div>
            {apartados.map((it) => fila(it, "apartado"))}
          </>
        )}
        {pagados.length > 0 && (
          <>
            <div className="fin-ahorro__subtitulo">🛒 Lo que pagaste con tus ahorros</div>
            {pagados.map((it) => fila(it, "pagado"))}
            {bolsasPago.length > 0 && (
              <p className="fin-ahorro__bolsas">
                Salió de: {bolsasPago.map((b) => `${b.categoria} (${formatCRC(b.total)})`).join(" · ")}
              </p>
            )}
          </>
        )}
        {retirados.length > 0 && (
          <>
            <div className="fin-ahorro__subtitulo">🏧 Lo que sacaste del ahorro</div>
            {retirados.map((it) => fila(it, "pagado"))}
          </>
        )}
      </div>
    </div>
  );
};

// ─── FORMULARIO DE MOVIMIENTO ────────────────────────────────────────────────
// Uno solo para las dos cosas: anotar (va inline, arriba de todo, porque es lo
// que más se usa) y editar (el mismo formulario dentro del modal). Antes eran
// cuatro tipos con nombres del backend; ahora son tres botones en lenguaje
// llano y, si es un gasto, UNA sola pregunta más: ¿de dónde salió la plata?
const FormMovimiento = ({
  registro, categorias, ahorroCfg, mes, anio, enModal,
  getAuthHeaders, mostrarNotif, manejarError, onCancelar, onExito, onGuardando,
}) => {
  const esEdicion = !!registro;

  // Las bolsas de ahorro y las categorías que NO admiten "pagado con ahorro"
  // (que son las de ahorro mismo) las manda el backend en GET /categorias.
  const bolsas = useMemo(() => ahorroCfg?.bolsas || [], [ahorroCfg]);
  const catsAhorro = useMemo(
    () => (ahorroCfg?.sinFondoAhorro?.length ? ahorroCfg.sinFondoAhorro : bolsas),
    [ahorroCfg, bolsas],
  );
  // Una categoría es "de ahorro" si el backend la marcó como tal. `esAhorro` es
  // el respaldo por nombre para un backend viejo que no mande esas listas.
  const esCatAhorro = useCallback(
    (c) => !!c && (catsAhorro.includes(c) || esAhorro(c)),
    [catsAhorro],
  );

  // De un movimiento guardado a la acción que lo representa. Un egreso con
  // categoría de ahorro es "Ahorré"; el resto de egresos, "Gasté".
  const accionInicial = !registro
    ? "gaste"
    : registro.tipo === "ingreso"
      ? "entro"
      : registro.tipo === "retiro_ahorro"
        ? "retiro"
        : (catsAhorro.includes(registro.categoria) || esAhorro(registro.categoria))
          ? "ahorre"
          : "gaste";

  const [accion, setAccion] = useState(accionInicial);
  // Solo para "Gasté": "mano" (el bolsillo del mes) o "ahorro" (sale del ahorro
  // y se consume en el acto → fondo: "ahorro" + bolsaAhorro).
  const [origen, setOrigen] = useState(registro?.fondo === "ahorro" ? "ahorro" : "mano");
  const [bolsaAhorro, setBolsaAhorro] = useState(registro?.bolsaAhorro || "");
  const [categoria, setCategoria] = useState(registro?.categoria || "");

  // Al editar un movimiento en dólares, se arranca en USD mostrando el monto
  // original en dólares y el tipo de cambio con el que se guardó (no el de hoy),
  // para no re-convertir un gasto pasado a la tasa actual.
  const editandoUSD = registro?.moneda === "USD";
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
  const [topeAhorro, setTopeAhorro] = useState(null); // tope que devolvió el 400

  const hoy = new Date();
  const esMesActual = mes === hoy.getMonth() + 1 && anio === hoy.getFullYear();

  const meta = metaAccion(accion);
  const tipo = tipoDeAccion(accion);
  const esGasto = accion === "gaste";
  const desdeAhorro = esGasto && origen === "ahorro";
  // "De mis ahorros" necesita las bolsas del backend para poder mandarlas.
  const hayBolsas = bolsas.length > 0;

  // Las categorías que se ofrecen dependen del botón: entrar plata trae las de
  // ingreso; "Ahorré" solo las bolsas; "Gasté" los egresos SIN las de ahorro
  // (para eso están los tres botones: apartar ahorro se hace con 🐷 Ahorré).
  const catsDe = useCallback((acc) => {
    if (acc === "entro") return categorias?.ingreso || [];
    if (acc === "retiro") return categorias?.retiro_ahorro || bolsas;
    const egresos = categorias?.egreso || [];
    const deAhorro = (c) => catsAhorro.includes(c) || esAhorro(c);
    if (acc === "ahorre") {
      const soloAhorro = egresos.filter(deAhorro);
      return soloAhorro.length ? soloAhorro : bolsas;
    }
    return egresos.filter((c) => !deAhorro(c));
  }, [categorias, catsAhorro, bolsas]);

  const opcionesBase = useMemo(() => catsDe(accion), [catsDe, accion]);

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

  // Al cambiar de botón la categoría elegida casi nunca sirve para el nuevo (las
  // listas no se solapan), así que se limpia si no está en la lista nueva. Va
  // acá y no en un efecto sobre `accion`: un efecto también corría al montar, y
  // al abrir la edición de un movimiento con una categoría que el backend ya no
  // ofrece la borraba sin que nadie tocara nada.
  const cambiarAccion = (nueva) => {
    setAccion(nueva);
    setErrores({});
    setTopeAhorro(null);
    if (nueva !== "gaste") setOrigen("mano");
    const nuevas = catsDe(nueva);
    setCategoria((actual) => (actual && nuevas.includes(actual) ? actual : ""));
  };

  const validar = () => {
    const e = {};
    if (!categoria) e.categoria = "Elegí una opción";
    // La trampa: un movimiento viejo que se reclasifica a "Gasté" se queda con
    // una categoría de ahorro (ej. Ahorro MEP) y se guardaría como "aparté más
    // ahorro" — exactamente el error que rompió las cuentas de agosto.
    if (esGasto && esCatAhorro(categoria)) {
      e.categoria = "Esa categoría es de ahorro. Si guardaste plata, usá el botón 🐷 Ahorré.";
    }
    if (!monto || montoNum <= 0) e.monto = "Escribí cuánto fue";
    if (esUSD && !tcListo) e.monto = "Esperá el tipo de cambio del día (o registralo en colones)";
    if (desdeAhorro && !bolsaAhorro) e.bolsaAhorro = "Elegí de cuál ahorro salió";
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  // Qué le pasó a la plata, en una línea. Reemplaza al "Movimiento registrado"
  // del backend: dice cuál bolsillo se movió, que es lo único que hace falta
  // confirmar de un vistazo.
  const confirmacion = () => {
    const m = formatCRC(montoCRC);
    if (accion === "entro") return `Guardado. Tu plata subió ${m}.`;
    if (accion === "ahorre") return `Guardado. Pasaron ${m} de tu plata a tus ahorros.`;
    if (accion === "retiro") return `Guardado. Pasaron ${m} de tus ahorros a tu plata.`;
    return desdeAhorro
      ? `Guardado. Bajaron tus ahorros ${m}; tu plata queda igual.`
      : `Guardado. Tu plata bajó ${m}.`;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!validar() || guardando) return;
    setGuardando(true);
    onGuardando?.(true);
    try {
      const axios = await getAxios();
      // El frontend NUNCA manda fecha, solo mes y año del período seleccionado.
      // `monto` siempre va en colones (valor canónico). Si se pagó en dólares se
      // guardan además la moneda, el monto original en dólares y el tipo de
      // cambio usado, como campos estructurados.
      const body = { tipo, categoria, monto: montoCRC, mes, anio };
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
      // pagado con ahorro (pasa a ingreso, a ahorro o a retiro), el backend
      // exige el "mes" explícito o responde 400.
      body.fondo = desdeAhorro ? "ahorro" : "mes";
      if (desdeAhorro) body.bolsaAhorro = bolsaAhorro;

      const desc = descripcion.trim();
      if (esEdicion) body.descripcion = desc; // permite limpiar la descripción
      else if (desc) body.descripcion = desc;

      const res = esEdicion
        ? await axios.put(`${BASE}/${registro._id}`, body, getAuthHeaders())
        : await axios.post(BASE, body, getAuthHeaders());
      mostrarNotif(esEdicion ? (res.data?.message || "Movimiento actualizado") : confirmacion());
      if (!esEdicion) {
        // Se limpia el monto y el detalle, pero se deja el botón y la categoría:
        // los movimientos se anotan de a varios y casi siempre del mismo tipo.
        setMonto("");
        setDescripcion("");
        setErrores({});
        setTopeAhorro(null);
      }
      onExito();
    } catch (err) {
      // Al gastar más ahorro del que hay, el backend responde 400 con un
      // `message` ya redactado para el usuario y `disponible` = el tope en
      // colones. Eso es un error DEL CAMPO monto (no de conexión), así que se
      // muestra debajo del input en vez de en un toast que se va solo.
      const data = err?.response?.data;
      if (err?.response?.status === 400 && data?.disponible != null) {
        setErrores((er) => ({ ...er, monto: data.message || "No tenés tanto ahorro acumulado" }));
        setTopeAhorro(Number(data.disponible) || 0);
      } else {
        manejarError(err);
      }
    } finally {
      setGuardando(false);
      onGuardando?.(false);
    }
  };

  // Los tres botones de siempre; el de retiro solo aparece si se está editando
  // un movimiento viejo que se anotó así, para poder corregirlo.
  const botones = accionInicial === "retiro" ? [...ACCIONES, ACCION_RETIRO] : ACCIONES;

  return (
    <form className="fin-anotar" onSubmit={handleSubmit} noValidate>
      {!esMesActual && (
        <div className="aviso-mes mb-3">
          📅 Se {esEdicion ? "guardará" : "registrará"} en <strong>{nombreMes(mes, anio)}</strong>
        </div>
      )}

      {/* ¿Qué hiciste? — las tres únicas cosas que se pueden hacer */}
      <p className="fin-pregunta">¿Qué hiciste?</p>
      <div className={`fin-acciones-grid ${botones.length > 3 ? "fin-acciones-grid--4" : ""}`}>
        {botones.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`fin-accion ${accion === a.id ? `fin-accion--activa fin-accion--${a.color}` : ""}`}
            onClick={() => cambiarAccion(a.id)}
            disabled={guardando}
            aria-pressed={accion === a.id}
          >
            <span className="fin-accion__emoji">{a.emoji}</span>
            <span>{a.label}</span>
          </button>
        ))}
      </div>

      <div className="fin-campos">
        {/* ¿De dónde salió la plata? — la única pregunta extra, y solo si gastó */}
        {esGasto && hayBolsas && (
          <div className="fin-campo">
            <label className="fin-campo__label">¿De dónde salió la plata?</label>
            <div className="fin-radios">
              <label className={`fin-radio ${origen === "mano" ? "fin-radio--activo" : ""}`}>
                <input
                  type="radio"
                  name={`origen-${registro?._id || "nuevo"}`}
                  checked={origen === "mano"}
                  disabled={guardando}
                  onChange={() => { setOrigen("mano"); setErrores((er) => ({ ...er, bolsaAhorro: "" })); }}
                />
                <span>De mi plata</span>
              </label>
              <label className={`fin-radio ${origen === "ahorro" ? "fin-radio--activo" : ""}`}>
                <input
                  type="radio"
                  name={`origen-${registro?._id || "nuevo"}`}
                  checked={origen === "ahorro"}
                  disabled={guardando}
                  onChange={() => setOrigen("ahorro")}
                />
                <span>De mis ahorros</span>
              </label>
            </div>
            {desdeAhorro && (
              <p className="fin-campo__ayuda">
                Esta plata sale del ahorro, no del dinero del mes: no cambia tu plata,
                solo baja tus ahorros.
              </p>
            )}
          </div>
        )}

        {/* ¿De cuál ahorro? — solo si eligió pagarlo con los ahorros */}
        {desdeAhorro && (
          <div className="fin-campo">
            <label className="fin-campo__label">¿De cuál ahorro?</label>
            <select
              className={`form-select admin-select ${errores.bolsaAhorro ? "admin-input--error" : ""}`}
              value={bolsaAhorro}
              disabled={guardando}
              onChange={(e) => { setBolsaAhorro(e.target.value); setErrores((er) => ({ ...er, bolsaAhorro: "" })); }}
            >
              <option value="">Elegí la bolsa...</option>
              {bolsas.map((b) => (
                <option key={b} value={b}>{iconoCat(b, "egreso")} {b}</option>
              ))}
            </select>
            {errores.bolsaAhorro && <div className="campo-error">{errores.bolsaAhorro}</div>}
          </div>
        )}

        {/* Categoría — la etiqueta cambia según el botón */}
        <div className="fin-campo">
          <label className="fin-campo__label">{meta.labelCat}</label>
          <select
            className={`form-select admin-select ${errores.categoria ? "admin-input--error" : ""}`}
            value={categoria}
            disabled={guardando || opciones.length === 0}
            onChange={(e) => { setCategoria(e.target.value); setErrores((er) => ({ ...er, categoria: "" })); }}
          >
            <option value="">Elegí una opción...</option>
            {opciones.map((op) => (
              <option key={op} value={op}>{iconoCat(op, tipo)} {op}</option>
            ))}
          </select>
          {errores.categoria && <div className="campo-error">{errores.categoria}</div>}
        </div>

        {/* ¿Cuánto? — con el selector de moneda (colones o dólares) */}
        <div className="fin-campo">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <label className="fin-campo__label mb-0">¿Cuánto?</label>
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

          {/* Tope que devolvió el backend al rechazar el pago con ahorro: se
              ofrece para rellenar el campo con el máximo en un click. */}
          {topeAhorro != null && (desdeAhorro || accion === "retiro") && (
            <div className="fin-retiro-tope">
              Máximo disponible: <strong>{formatCRC(topeAhorro)}</strong>
              <button
                type="button"
                className="moneda-tc-reintentar"
                onClick={() => {
                  cambiarMoneda("CRC");
                  setMonto(String(topeAhorro));
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
                        : `Tipo de cambio de hoy · ${tipo === "egreso" ? "venta" : "compra"}`}
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
                    : "Ingreso en dólares: se usa la tasa de compra (lo que te dan al cambiarlos a colones)."}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Detalle (opcional) */}
        <div className="fin-campo">
          <label className="fin-campo__label">
            Detalle <span className="fin-campo__opcional">(opcional)</span>
          </label>
          <input
            type="text"
            className="form-control admin-input"
            maxLength={200}
            placeholder="Para acordarte después"
            value={descripcion}
            disabled={guardando}
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </div>

        <div className={enModal ? "d-flex gap-2 justify-content-end" : ""}>
          {onCancelar && (
            <button type="button" className="admin-btn-ghost" onClick={onCancelar} disabled={guardando}>
              Cancelar
            </button>
          )}
          <button
            type="submit"
            className={`btn admin-btn admin-btn--green fw-bold ${enModal ? "px-4" : "w-100"}`}
            disabled={guardando || (esUSD && !tcListo)}
          >
            {guardando && <span className="btn-spinner" />}
            {guardando ? "Guardando..." : esEdicion ? "Guardar cambios" : "Guardar"}
          </button>
        </div>
      </div>
    </form>
  );
};

// ─── MODAL DE EDICIÓN ────────────────────────────────────────────────────────
// Anotar se hace arriba, en la pantalla; el modal es solo para editar uno que
// ya existe (desde la lista de movimientos). Es el mismo formulario.
const MovimientoModal = ({ registro, onCerrar, ...props }) => {
  const [guardando, setGuardando] = useState(false);
  return (
    <ModalOverlay onCerrar={onCerrar} bloqueado={guardando}>
      <div className="admin-modal__header admin-panel__header--orange">
        <span>✏️</span>
        Editar movimiento
        <button className="admin-modal__cerrar" onClick={onCerrar} disabled={guardando} aria-label="Cerrar">✕</button>
      </div>
      <div className="admin-modal__body">
        <FormMovimiento
          registro={registro}
          enModal
          onCancelar={onCerrar}
          onGuardando={setGuardando}
          {...props}
        />
      </div>
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

  const [editando, setEditando] = useState(null);   // null | movimiento
  const [aEliminar, setAEliminar] = useState(null); // null | registro
  const [eliminando, setEliminando] = useState(false);
  const [modalApertura, setModalApertura] = useState(false);
  const [vista, setVista] = useState("mes");       // "mes" | "anual"

  // Categorías: se cargan una sola vez (alimentan los selects del formulario) y
  // quedan cacheadas en memoria, así volver a la pestaña no repite la llamada.
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

  // Resumen del mes. No depende de la página.
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
    if (eraEdicion) setEditando(null);
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

  // ── Los números de las dos escaleras ──────────────────────────────────────
  // Todos vienen del backend; acá solo se ordenan en filas. Las dos identidades
  // que cierran (y que el dueño puede verificar a mano):
  //   saldoInicial  + totalIngresos − totalGastos − totalAhorro
  //                 + totalRetiroAhorro                        = saldoFinal
  //   ahorroInicial + totalAhorro − totalGastoDesdeAhorro
  //                 − totalRetiroAhorro                        = ahorroAcumulado
  const totalIngresos = resumen?.totalIngresos ?? 0;
  const totalGastos = resumen?.totalGastos ?? 0;        // consumo del mes, sin el ahorro
  const totalAhorro = resumen?.totalAhorro ?? 0;        // lo apartado (bruto)
  const totalRetiro = resumen?.totalRetiroAhorro ?? 0;  // solo datos viejos
  const pagadoConAhorro = resumen?.totalGastoDesdeAhorro ?? 0;
  const saldoInicial = resumen?.saldoInicial ?? 0;
  const saldoFinal = resumen?.saldoFinal ?? 0;
  const ahorroAcumulado = resumen?.ahorroAcumulado ?? 0;
  // `ahorroInicial` es lo que había ahorrado al EMPEZAR el mes. Si un backend
  // viejo no lo manda, se despeja de la identidad de arriba (no es un cálculo
  // inventado: es la misma ecuación, al revés).
  const ahorroInicial =
    resumen?.ahorroInicial ?? (ahorroAcumulado - totalAhorro + totalRetiro + pagadoConAhorro);

  const gastoAhorro = resumen?.desglose?.gastoAhorro || [];
  const cuantosPagos = gastoAhorro.reduce((s, it) => s + (Number(it.cantidad) || 0), 0);

  const filasPlata = [
    { clave: "arrastre", que: "Tenías del mes pasado", monto: saldoInicial },
    { clave: "entro", que: "Entró", monto: totalIngresos, signo: "+" },
    // Solo con datos viejos: un retiro devolvía plata al bolsillo del mes.
    ...(totalRetiro > 0
      ? [{ clave: "retiro", que: "Sacaste del ahorro", monto: totalRetiro, signo: "+" }]
      : []),
    { clave: "gasto", que: "Gastaste", monto: totalGastos, signo: "−" },
    { clave: "ahorro", que: "Ahorraste", monto: totalAhorro, signo: "−" },
  ];

  const filasAhorro = [
    { clave: "arrastre", que: "Tenías ahorrado", monto: ahorroInicial },
    { clave: "aparte", que: "Ahorraste", monto: totalAhorro, signo: "+" },
    ...(totalRetiro > 0
      ? [{ clave: "retiro", que: "Sacaste del ahorro", monto: totalRetiro, signo: "−" }]
      : []),
    // La fila se oculta si no se pagó nada con los ahorros (el caso normal).
    ...(pagadoConAhorro > 0
      ? [{
          clave: "pago",
          que: "Pagaste con tus ahorros",
          nota: `${cuantosPagos} ${cuantosPagos === 1 ? "compra" : "compras"}`,
          monto: pagadoConAhorro,
          signo: "−",
        }]
      : []),
  ];

  // El ahorro viene dentro de desglose.egreso pero no es consumo: se separa para
  // que la dona y "Gastos por categoría" reflejen el gasto real del mes, y lo
  // apartado se vea en el detalle de los ahorros. Lo pagado CON los ahorros ya
  // llega aparte (desglose.gastoAhorro), así que tampoco ensucia la dona.
  const egresoTodo = resumen?.desglose?.egreso || [];
  const gastosReales = egresoTodo.filter((it) => !esAhorro(it.categoria));
  const apartados = egresoTodo.filter((it) => esAhorro(it.categoria));
  const gastosOrdenados = [...gastosReales].sort((a, b) => (b.total || 0) - (a.total || 0));

  // Saldo de apertura: la plata que ya se tenía ANTES de empezar a registrar.
  // No es un movimiento, así que no aparece en ningún ingreso ni gasto: solo
  // alimenta el arrastre de las dos escaleras. El resumen del mes ya lo trae,
  // así que el chip no necesita una llamada aparte (el modal sí hace su propio
  // GET para precargar también la descripción).
  const apertura = resumen?.apertura || null;

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

      {/* Acciones del módulo: saldo de apertura y reporte anual. Anotar ya no
          es un botón: el formulario está en la pantalla, más abajo. */}
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
        <div className="fin-acciones__botones">
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
          {/* 1 · Los dos bolsillos: toda la plata está en uno de los dos */}
          <Bolsas plata={saldoFinal} ahorros={ahorroAcumulado} />

          {/* 2 · Anotar. Va ARRIBA, no al final: es lo que más se usa. */}
          <div className="fin-tarjeta mb-3">
            <p className="fin-tarjeta__titulo">✏️ Anotar</p>
            {categorias ? (
              <FormMovimiento
                registro={null}
                categorias={categorias}
                ahorroCfg={ahorroCfg}
                mes={mes}
                anio={anio}
                getAuthHeaders={getAuthHeaders}
                mostrarNotif={mostrarNotif}
                manejarError={manejarError}
                onExito={() => handleExito(false)}
              />
            ) : (
              <Cargando />
            )}
          </div>

          {/* 3 y 4 · Las dos escaleras. Cada línea suma o resta la de arriba y
              cierra en el total, para poder verificarlas a mano. */}
          <div className="fin-escaleras mb-3">
            <Escalera
              titulo={`💵 Tu plata en ${nombreMes(mes, anio)}`}
              filas={filasPlata}
              totalQue="Te queda"
              totalMonto={saldoFinal}
              totalClase={saldoFinal >= 0 ? "plata" : "rojo"}
            />
            <div>
              <Escalera
                titulo={`🏦 Tus ahorros en ${nombreMes(mes, anio)}`}
                filas={filasAhorro}
                totalQue="Ahora tenés"
                totalMonto={ahorroAcumulado}
                totalClase="ahorro"
              />
              {/* En qué se movió el ahorro: por bolsa y por gasto. */}
              <AhorroDetalle
                apartado={apartados}
                pagado={gastoAhorro}
                pagadoPorBolsa={resumen?.desglose?.gastoAhorroPorBolsa}
                retiros={resumen?.desglose?.retiro}
              />
            </div>
          </div>

          {/* 5 · En qué se fue: desglose por categoría + dona de gastos. No está
              en las escaleras a propósito — ellas dicen CUÁNTO, esto dice EN QUÉ. */}
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

          {/* 6 · Qué te dicen tus números. El backend ya manda los avisos
              ordenados por urgencia (crítico → advertencia → consejo → bien →
              info) y recortados a los más importantes: se pintan TAL CUAL
              llegan, sin reordenar ni recortar. El texto es largo a propósito
              (explica el porqué), así que no se trunca. Y nada se recalcula acá:
              los montos y porcentajes vienen ya formateados, y el ícono lo
              decide el backend. */}
          {recomendaciones.length > 0 && (
            <div className="fin-recom-panel mb-4">
              <p className="fin-recom-titulo">🧠 Qué te dicen tus números</p>
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

          {/* 7 · Movimientos del mes */}
          {loadingLista && movimientos.length === 0 ? (
            <Cargando />
          ) : movimientos.length === 0 ? (
            <EstadoVacio icono="💸" mensaje="No hay movimientos registrados este mes">
              <p className="text-muted mt-2 mb-0">Anotá el primero arriba, en «Anotar».</p>
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
                  // El color y el signo salen de la acción que representa, no
                  // del `tipo` crudo: un egreso pagado con el ahorro no baja la
                  // plata del mes, así que se pinta con el color del ahorro y
                  // se etiqueta con la bolsa de la que salió.
                  const pagadoDeAhorro = m.tipo === "egreso" && m.fondo === "ahorro";
                  const accion = m.tipo === "ingreso"
                    ? "entro"
                    : m.tipo === "retiro_ahorro"
                      ? "retiro"
                      : esAhorro(m.categoria) ? "ahorre" : "gaste";
                  const meta = metaAccion(accion);
                  const color = pagadoDeAhorro ? "ambar" : meta.color;
                  const signo = accion === "entro" || accion === "retiro" ? "+" : "−";
                  return (
                    <div key={m._id} className={`mov-row mov-row--${color}`}>
                      <span className="mov-row__tipo">
                        <span className={`registro-item__badge registro-item__badge--${color}`}>
                          {iconoCat(m.categoria, m.tipo)} {m.categoria}
                        </span>
                        {pagadoDeAhorro && (
                          <span className="mov-row__etiqueta">pagado con {m.bolsaAhorro || "el ahorro"}</span>
                        )}
                        {m.tipo === "retiro_ahorro" && (
                          <span className="mov-row__etiqueta">retiro (anotado a la vieja)</span>
                        )}
                      </span>
                      <span className={`mov-row__monto mov-row__monto--${color}`}>
                        {signo}{formatCRC(m.monto)}
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
                          onClick={() => setEditando(m)}
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

      {/* Modal de edición (anotar se hace arriba, en la pantalla) */}
      {editando && (
        <MovimientoModal
          registro={editando}
          categorias={categorias}
          ahorroCfg={ahorroCfg}
          mes={mes}
          anio={anio}
          getAuthHeaders={getAuthHeaders}
          mostrarNotif={mostrarNotif}
          manejarError={manejarError}
          onCerrar={() => setEditando(null)}
          onExito={() => handleExito(true)}
        />
      )}

      {/* Saldo de apertura: lo que ya tenía antes de empezar a registrar */}
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
