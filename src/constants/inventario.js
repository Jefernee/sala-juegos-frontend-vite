// src/constants/inventario.js
// Vocabulario cerrado del inventario.
//
// Antes la unidad y el nombre del envase eran texto libre, y por eso en la base
// conviven "Gramos" y "gramos", "Paquete" y "paquete". Eso rompe cualquier
// agrupación futura y confunde al leer una receta. Acá quedan definidos los
// valores válidos, y `normalizarUnidad` / `normalizarEnvase` traducen lo que ya
// está guardado para que los datos viejos sigan mostrándose bien.
//
// ⚠️  ESPEJO DE config/unidadesEnvases.js DEL BACKEND.
// Las dos listas TIENEN que decir lo mismo, porque el backend valida contra la
// suya. Ofrecer acá una opción que allá no existe hace que el usuario elija algo
// que se ve perfectamente bien en pantalla y el guardado se caiga con un 400.
// Eso pasaba con "Lata" y "Display". Al tocar cualquiera de las dos, tocá la otra.

// ── Unidades ─────────────────────────────────────────────────────────────────
// `presets` son los botones de cantidad que se ofrecen para esa unidad, y `paso`
// el salto de los botones −/+. Son la clave del rediseño sin teclado: la unidad
// decide qué botones tiene sentido mostrar.
// `abrev` es para razones apretadas ("₡3/g"); `sufijo` es lo que se pinta al
// lado de un número en la interfaz (vacío para unidades: "5 u" no se entiende,
// "5" sí); `singular` es para frases ("el precio por gramo"); `paso` es cuánto
// mueven los botones −/+; `inicial` es con cuánto arranca un ingrediente recién
// agregado a una receta.
export const UNIDADES = [
  {
    id: "unidades",
    label: "Unidades",
    singular: "unidad",
    abrev: "u",
    sufijo: "",
    // Cosas que se cuentan de una en una: vasos, conos, cucharas.
    inicial: 1,
    paso: 1,
    decimales: 0,
  },
  {
    id: "bolas",
    label: "Bolas",
    singular: "bola",
    abrev: "bolas",
    sufijo: "bolas",
    inicial: 1,
    paso: 1,
    decimales: 0,
  },
  {
    id: "gramos",
    label: "Gramos",
    singular: "gramo",
    abrev: "g",
    sufijo: "g",
    // Lo que se sirve con cuchara o se pesa: helado, gelatina, topping.
    inicial: 50,
    paso: 10,
    decimales: 0,
  },
  {
    id: "kilogramos",
    label: "Kilogramos",
    singular: "kilo",
    abrev: "kg",
    sufijo: "kg",
    inicial: 1,
    paso: 0.25,
    decimales: 2,
  },
  {
    id: "mililitros",
    label: "Mililitros",
    singular: "mililitro",
    abrev: "ml",
    sufijo: "ml",
    inicial: 100,
    paso: 10,
    decimales: 0,
  },
  {
    id: "litros",
    label: "Litros",
    singular: "litro",
    abrev: "L",
    sufijo: "L",
    inicial: 1,
    paso: 0.25,
    decimales: 2,
  },
];

// Sinónimos que hay que absorber. Incluye lo que ya está en la base.
const ALIAS_UNIDAD = {
  unidad: "unidades",
  unidades: "unidades",
  u: "unidades",
  und: "unidades",
  uds: "unidades",
  pieza: "unidades",
  piezas: "unidades",
  bola: "bolas",
  bolas: "bolas",
  g: "gramos",
  gr: "gramos",
  grs: "gramos",
  gramo: "gramos",
  gramos: "gramos",
  kg: "kilogramos",
  kilo: "kilogramos",
  kilos: "kilogramos",
  kilogramo: "kilogramos",
  kilogramos: "kilogramos",
  ml: "mililitros",
  mililitro: "mililitros",
  mililitros: "mililitros",
  l: "litros",
  lt: "litros",
  litro: "litros",
  litros: "litros",
};

// ── Tipos de producto ────────────────────────────────────────────────────────
// El dueño no tiene que pensar en gramos ni mililitros: elige qué es la cosa y
// de ahí sale la unidad, el salto de los botones y el envase más probable.
// La unidad sigue existiendo por dentro (es lo que guarda el backend), pero ya
// no se pregunta.
export const TIPOS_PRODUCTO = [
  {
    id: "bebida",
    label: "Bebida",
    ejemplo: "Gaseosa, jugo, agua",
    unidad: "unidades",
    envaseSugerido: "caja",
  },
  {
    id: "golosina",
    label: "Golosina o snack",
    ejemplo: "Chicles, galletas, boli",
    unidad: "unidades",
    envaseSugerido: "paquete",
  },
  {
    id: "helado",
    label: "Helado a granel",
    ejemplo: "Se sirve con cuchara, se pesa",
    unidad: "gramos",
    envaseSugerido: "balde",
  },
  {
    id: "helado_empacado",
    label: "Helado empacado",
    ejemplo: "Bolis, conos, sandwich, paletas",
    unidad: "unidades",
    envaseSugerido: "caja",
  },
  {
    id: "polvo",
    label: "Polvo o topping",
    ejemplo: "Gelatina, chispas, cacao",
    unidad: "gramos",
    envaseSugerido: "paquete",
  },
  {
    id: "liquido",
    label: "Líquido a granel",
    ejemplo: "Sirope, leche, crema",
    unidad: "mililitros",
    envaseSugerido: "botella",
  },
  {
    id: "desechable",
    label: "Desechable",
    ejemplo: "Vasos, cucharas, servilletas",
    unidad: "unidades",
    envaseSugerido: "paquete",
  },
  {
    id: "otro",
    label: "Otra cosa",
    ejemplo: "Se cuenta de una en una",
    unidad: "unidades",
    envaseSugerido: "",
  },
];

/**
 * RESPALDO PARA DATOS VIEJOS. El tipo ahora se guarda en la base
 * (`producto.tipoProducto`) y es el que manda; esto solo se usa para
 * preseleccionar algo coherente en los productos creados antes de que el campo
 * existiera.
 *
 * No sirve para saber el tipo de verdad y nunca sirvió: devuelve el PRIMER tipo
 * que use esa unidad, y cuatro se cuentan en "unidades" (bebida, golosina,
 * desechable, otro) y dos en "gramos" (helado, polvo). Por eso elegir
 * "Golosina o snack" y volver a entrar mostraba "Bebida": el formulario
 * preguntaba el tipo, guardaba solo la unidad, y después intentaba deshacer esa
 * cuenta que no se puede deshacer.
 *
 * Devuelve null si la unidad no la cubre ningún tipo (datos viejos en bolas,
 * kilos o litros): en ese caso no se toca la unidad.
 */
export function tipoProductoDe(unidad) {
  const id = normalizarUnidad(unidad);
  return TIPOS_PRODUCTO.find((t) => t.unidad === id) || null;
}

// ── Tipos de envase ──────────────────────────────────────────────────────────
export const TIPOS_ENVASE = [
  { id: "paquete", label: "Paquete" },
  { id: "caja", label: "Caja" },
  { id: "balde", label: "Balde" },
  { id: "botella", label: "Botella" },
  { id: "bolsa", label: "Bolsa" },
  { id: "lata", label: "Lata" },
  { id: "saco", label: "Saco" },
  { id: "bandeja", label: "Bandeja" },
  { id: "display", label: "Display" },
  { id: "tarro", label: "Tarro" },
  { id: "sobre", label: "Sobre" },
];

const ALIAS_ENVASE = {
  paquete: "paquete",
  paquetes: "paquete",
  paq: "paquete",
  caja: "caja",
  cajas: "caja",
  balde: "balde",
  baldes: "balde",
  botella: "botella",
  botellas: "botella",
  bolsa: "bolsa",
  bolsas: "bolsa",
  lata: "lata",
  latas: "lata",
  saco: "saco",
  sacos: "saco",
  bandeja: "bandeja",
  bandejas: "bandeja",
  display: "display",
  displays: "display",
  tarro: "tarro",
  tarros: "tarro",
  sobre: "sobre",
  sobres: "sobre",
};

const limpiar = (valor) =>
  String(valor ?? "")
    .trim()
    .toLowerCase();

/**
 * Devuelve el id canónico de la unidad. Si es un valor que no conocemos, lo
 * devuelve en minúscula en vez de descartarlo: preferimos mostrar el dato viejo
 * tal como está antes que perderlo.
 */
export function normalizarUnidad(valor) {
  const base = limpiar(valor);
  if (!base) return "unidades";
  return ALIAS_UNIDAD[base] || base;
}

export function normalizarEnvase(valor) {
  const base = limpiar(valor);
  if (!base) return "";
  return ALIAS_ENVASE[base] || base;
}

/**
 * Ficha completa de una unidad, con presets y paso. Para unidades desconocidas
 * (datos viejos) inventa una ficha de conteo para que la UI no se quede sin
 * botones.
 */
export function unidadInfo(valor) {
  const id = normalizarUnidad(valor);
  const conocida = UNIDADES.find((u) => u.id === id);
  if (conocida) return conocida;
  return {
    id,
    label: id.charAt(0).toUpperCase() + id.slice(1),
    singular: id,
    abrev: id,
    sufijo: id,
    inicial: 1,
    paso: 1,
    decimales: 0,
    desconocida: true,
  };
}

/** Abreviatura para razones apretadas: "₡3/g", "₡167/u". */
export function abrevUnidad(valor) {
  return unidadInfo(valor).abrev;
}

/**
 * Lo que se pinta al lado de un número en pantalla: "100 g", "2 bolas", "5".
 * Para unidades devuelve vacío a propósito: "5 u" no se entiende de un vistazo.
 */
export function sufijoUnidad(valor) {
  return unidadInfo(valor).sufijo;
}

/**
 * Nombre completo en minúscula: "44 unidades", "500 gramos".
 * Para textos donde la abreviatura queda criptica ("44 u" no se entiende).
 */
export function labelUnidad(valor) {
  return unidadInfo(valor).label.toLowerCase();
}

/** Singular para frases: "el precio por gramo", "cada unidad". */
export function unidadSingular(valor) {
  return unidadInfo(valor).singular;
}

/**
 * Cantidad con su unidad y el plural bien puesto: "1 unidad", "20 unidades",
 * "100 gramos". Sin esto salían cosas como "cada unidad usa 1 unidades".
 */
export function conUnidad(cantidad, unidad) {
  const info = unidadInfo(unidad);
  const n = Number(cantidad);
  const nombre = Math.abs(n) === 1 ? info.singular : info.label.toLowerCase();
  return `${formatearCantidad(n)} ${nombre}`;
}

/**
 * "Cuántas unidades" vs "Cuántos gramos". Sin esto las preguntas del formulario
 * salen mal escritas según la unidad que elija el usuario.
 */
export function cuantos(valor) {
  return FEMENINAS.has(normalizarUnidad(valor)) ? "Cuántas" : "Cuántos";
}

const FEMENINAS = new Set(["unidades", "bolas"]);

/** Nombre legible del envase, respetando los que no están en la lista. */
export function labelEnvase(valor) {
  const id = normalizarEnvase(valor);
  if (!id) return "";
  const conocido = TIPOS_ENVASE.find((e) => e.id === id);
  return conocido ? conocido.label : id.charAt(0).toUpperCase() + id.slice(1);
}

// ── Formato de números ───────────────────────────────────────────────────────
// Punto como separador de miles, sin decimales para colones.

/** 1234567 → "1.234.567" */
export function formatearNumero(valor, decimales = 0) {
  const n = Number(valor);
  if (!isFinite(n)) return "0";
  const fijo = Math.abs(n).toFixed(decimales);
  const [entero, dec] = fijo.split(".");
  const conPuntos = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const signo = n < 0 ? "-" : "";
  return dec ? `${signo}${conPuntos},${dec}` : `${signo}${conPuntos}`;
}

/** 1234567 → "₡1.234.567" */
export function formatearMonto(valor) {
  return `₡${formatearNumero(Math.round(Number(valor) || 0))}`;
}

/**
 * Cantidades: sin decimales cuando es entero, con los que haga falta cuando no
 * (150 g se ve "150", 0,5 kg se ve "0,5").
 */
export function formatearCantidad(valor) {
  const n = Number(valor);
  if (!isFinite(n)) return "0";
  if (Number.isInteger(n)) return formatearNumero(n, 0);
  return formatearNumero(n, 2).replace(/,?0+$/, "");
}
