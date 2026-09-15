// Piezas compartidas de Mis Finanzas Personales: las usan el panel del mes,
// el modal de saldo de apertura y el reporte anual. Salieron tal cual de
// FinanzasPersonalesPanel.jsx (donde vivían) para no tener tres copias.
import { API_URL, formatCRC } from "./adminUtils";

export const FIN_BASE = `${API_URL}/api/finanzas-personales`;

// Colones con signo: saldoInicial, saldoFinal y balance pueden ser negativos
// (déficit arrastrado). formatCRC antepone "₡", así que el "-" va delante de todo
// para no quedar "₡-73.089". "-₡73.089" para negativos, "₡73.089" para positivos.
export const formatCRCsigned = (monto) => {
  const n = Math.round(Number(monto) || 0);
  return (n < 0 ? "-" : "") + formatCRC(Math.abs(n));
};

// "9,4%" — porcentaje con hasta 1 decimal (coma decimal de Costa Rica). El valor
// lo calcula el backend; acá solo se formatea, nunca se recalcula.
// OJO: `tasaAhorro` es la tasa NETA (apartado − retirado) y PUEDE SER NEGATIVA
// (ej. -25 si se sacó más de lo que se apartó), así que el signo se respeta tal
// cual y nada asume un rango 0-100.
export const formatPct = (valor) =>
  (Number(valor) || 0).toLocaleString("es-CR", { minimumFractionDigits: 0, maximumFractionDigits: 1 }) + "%";

// El ahorro NO es un tipo aparte: apartar plata es un `egreso` con categoría de
// ahorro (sale del bolsillo del mes y entra al del ahorro). La pantalla lo
// traduce a tres botones —Entró plata / Gasté / Ahorré— en
// FinanzasPersonalesPanel.jsx, que es el único lugar que conoce esa traducción.

// Formatea el monto MIENTRAS se escribe, con separador de miles para leerlo
// fácil. CRC: enteros con punto ("1.000.000"). USD: miles con coma y hasta 2
// decimales ("1,250.50"). Recibe el valor crudo (solo dígitos y punto decimal).
export const formatMontoInput = (valor, esUSD) => {
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
export const limpiarMontoInput = (texto, esUSD) => {
  let raw = String(texto).replace(/[^\d.]/g, "");
  if (!esUSD) return raw.replace(/\./g, "");        // colones: sin decimales
  const [ent, ...rest] = raw.split(".");            // USD: un punto, máx 2 decimales
  return rest.length ? `${ent}.${rest.join("").slice(0, 2)}` : ent;
};

// ─── EL MARGEN DEL MES ───────────────────────────────────────────────────────
// El margen es "Te queda" − "Tenías del mes pasado" (el backend lo manda como
// `variacionSaldo`): lo que se puede gastar sin tocar el arrastre. Mientras sea
// positivo, lo que se gasta salió de lo que entró ESTE mes; cuando llega a 0, el
// siguiente colón ya sale de lo del mes pasado.
//
// El aviso NO se dispara con un monto fijo: ₡25.000 de margen es holgado en un
// mes en que entraron ₡200.000 y no es nada en uno de ₡835.000. Se avisa cuando
// el margen baja del 10% de lo que entró en el mes, con un piso de ₡25.000 para
// que en un mes de ingresos chicos —o con el salario todavía sin anotar— el
// aviso siga existiendo en vez de desaparecer.
export const MARGEN_PCT_AVISO = 0.1;
export const MARGEN_PISO_AVISO = 25000;

export const umbralMargen = (totalIngresos) =>
  Math.max(Math.round((Number(totalIngresos) || 0) * MARGEN_PCT_AVISO), MARGEN_PISO_AVISO);

// "bien" → hay aire · "ojo" → queda poco, avisar · "pasado" → ya se está
// gastando lo del mes pasado.
export const estadoMargen = (margen, totalIngresos) => {
  const m = Number(margen) || 0;
  if (m <= 0) return "pasado";
  return m <= umbralMargen(totalIngresos) ? "ojo" : "bien";
};

// El color que le toca a cada estado. Es el MISMO nombre que usan las clases de
// los montos (fin-escalon__cuanto--*), así que el aviso y el número siempre van
// del mismo color sin tener que acordarse de cambiar los dos.
export const COLOR_MARGEN = { bien: "plata", ojo: "ambar", pasado: "rojo" };

// Paleta para el desglose y la dona (mismo espíritu que el estado de resultados).
export const PALETA = ["#f97316", "#ef4444", "#eab308", "#8b5cf6", "#ec4899", "#06b6d4", "#14b8a6", "#f59e0b", "#a3e635"];

// Iconos por defecto de las categorías que manda el backend. Es SOLO cosmético:
// la lista de categorías (y su orden) sale de `GET /categorias`, no de acá. Si
// llega una categoría nueva que no está en el mapa, cae en el ícono comodín
// según el tipo y funciona igual.
export const ICONOS_CAT = {
  // Ingresos
  Salario: "💼", "Salario MEP": "🏫", "Salario CreAI": "🤖",
  Negocio: "🏪", "Ventas/Extras": "🛍️", Préstamos: "🤝",
  // Egresos · comida y hogar
  "Comida preparada": "🍔", "Comida de colegio": "🍱", "Comida en Batán": "🍗",
  "Snacks y antojos": "🍩", Supermercado: "🛒",
  "Vivienda/Alquiler": "🏠", Vivienda: "🏠",
  Servicios: "🧾", "Internet/Celular": "📶",
  // Egresos · transporte
  Transporte: "🚗", Combustible: "⛽", "Viajes a Batán": "🛣️",
  // Egresos · personales / día a día
  Salud: "💊", Peluqueada: "💇", "Ropa y calzado": "👕",
  "Compras personales": "🧺", Educación: "📚", Entretenimiento: "🎬",
  Suscripciones: "🔁", Mascotas: "🐾",
  // Egresos · ocasiones
  "Salidas y viajes": "🧳", Regalos: "🎁", Cumpleaños: "🎂", Rifas: "🎟️",
  // Egresos · compromisos financieros
  "Deudas/Préstamos": "💳", "Cuota banco (BCR)": "🏦", Seguros: "🛡️",
  // Egresos · ahorro
  Ahorro: "🐷", "Ahorro CreAI": "🪙", "Ahorro MEP": "💰",
  // Comodín
  Otros: "•",
};

export const iconoCat = (categoria, tipo) =>
  ICONOS_CAT[categoria] || (tipo === "ingreso" ? "💰" : tipo === "retiro_ahorro" ? "🏧" : "💸");

// El ahorro no es consumo: cualquier categoría que empiece con "Ahorro"
// (Ahorro, Ahorro CreAI, Ahorro MEP…) se saca del gráfico de gastos y se muestra
// aparte, para que la distribución de gastos refleje el gasto real del mes.
export const esAhorro = (categoria) => /^ahorro/i.test(String(categoria || "").trim());
