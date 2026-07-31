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

// ─── TIPOS DE MOVIMIENTO ─────────────────────────────────────────────────────
// El backend manda las claves crudas en `GET /categorias` (`tipos` y
// `categorias[tipo]`); las etiquetas visibles las pone el frontend.
//
// `retiro_ahorro` es sacar plata del ahorro: NO es un ingreso (si lo fuera, los
// porcentajes y la comparación mes a mes se romperían) y tampoco es un gasto
// (la plata no se fue, cambió de bolsillo). Suma a `disponible` y resta del
// `ahorroAcumulado`, así que se pinta en azul, aparte de verde/rojo.
export const TIPOS_MOV = [
  { id: "ingreso", label: "💰 Ingreso", color: "green", montoClase: "verde", signo: "+" },
  { id: "egreso", label: "💸 Egreso", color: "red", montoClase: "rojo", signo: "−" },
  { id: "retiro_ahorro", label: "🏧 Sacar del ahorro", color: "blue", montoClase: "azul", signo: "+" },
];

export const metaTipo = (tipo) => TIPOS_MOV.find((t) => t.id === tipo) || TIPOS_MOV[1];

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
  Regalos: "🎁", Cumpleaños: "🎂", Rifas: "🎟️",
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
