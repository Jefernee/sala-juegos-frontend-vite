// Utilidades compartidas del Módulo de Administración

export const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

let axiosInstance = null;
export const getAxios = async () => {
  if (!axiosInstance) axiosInstance = (await import("axios")).default;
  return axiosInstance;
};

export const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// Registros por página en Ganancias, Pagos y Activos
export const LIMITE_PAGINA = 6;

// ₡45.000 — punto como separador de miles (estándar de Costa Rica).
// es-CR por defecto usa espacios; \s los captura todos y los pasa a punto.
export const formatCRC = (monto) =>
  "₡" + (Math.round(Number(monto) || 0)).toLocaleString("es-CR").replace(/\s/g, ".");

// "6 de junio de 2026"
export const formatFecha = (fecha) =>
  new Date(fecha).toLocaleDateString("es-CR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Costa_Rica",
  });

// "YYYY-MM-DD" (zona de Costa Rica) para precargar inputs type=date
export const fechaParaInput = (fecha) => {
  if (!fecha) return "";
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA", { timeZone: "America/Costa_Rica" });
};

// "PLACA-0007" — número de placa relleno a 4 dígitos. Es de solo lectura
// (lo asigna el backend); si no viniera ninguno mostramos "—".
// Acepta el número directo o el activo completo, y tolera nombres alternos
// del campo (numeroPlaca / placa / numero_placa) por si el backend cambia.
export const formatPlaca = (valor) => {
  const n =
    valor != null && typeof valor === "object"
      ? valor.numeroPlaca ?? valor.placa ?? valor.numeroDePlaca ?? valor.numero_placa
      : valor;
  return n != null && n !== "" ? `PLACA-${String(n).padStart(4, "0")}` : "—";
};

// "junio 2026" (para chips y avisos)
export const nombreMes = (mes, anio) => `${MESES[mes - 1].toLowerCase()} ${anio}`;

// "Junio 2026" (para títulos)
export const nombreMesCapital = (mes, anio) => `${MESES[mes - 1]} ${anio}`;

// "YYYY-MM-DD" local de hoy (para inputs date)
export const getLocalDateString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const ICONOS_GANANCIA = {
  "Maquinas Chinos": "🎰",
  "Maquinas Zapata": "🕹️",
  Futbolin: "⚽",
};

export const ICONOS_SERVICIO = {
  Luz: "💡",
  Agua: "💧",
  Internet: "🌐",
  Patente: "📋",
  "PlayStation Plus": "🎮",
  "Mantenimiento General": "🔧",
};

export const ESTADOS_ACTIVO = ["En uso", "En reparación", "Reparado", "Fuera de servicio", "Almacenado"];

// Clase de color por estado del activo
export const ESTADO_CLASE = {
  "En uso": "verde",
  "En reparación": "amarillo",
  Reparado: "azul",
  "Fuera de servicio": "rojo",
  Almacenado: "gris",
};
