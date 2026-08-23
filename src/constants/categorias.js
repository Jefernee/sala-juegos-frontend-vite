// src/constants/categorias.js
// Cómo se muestran las categorías de venta. Nada más.
//
// La categoría de un producto la decide el backend y viaja en
// `producto.categoria`. Acá NO se clasifica: no hay listas de palabras ni reglas
// que adivinen a partir del nombre. Este archivo solo pone la etiqueta, el ícono
// y el orden en pantalla, y cuenta cuántos productos hay en cada una.
//
// Por qué: la clasificación es lógica de negocio. Si viviera en el frontend,
// habría dos verdades — la del backend y la mía — y encima cada marca nueva del
// inventario ("Ranchitas", "Chokies", "Chao") obligaría a un despliegue del
// frontend para aparecer en su lugar. Con la decisión en el backend, se corrige
// una vez donde están los datos.
//
// Consecuencia buena: si el backend agrega una categoría nueva, acá aparece sola
// (con ícono genérico) sin tocar este archivo.

// Presentación de las categorías conocidas, en el orden en que se muestran los
// chips. No es alfabético a propósito: primero lo que más se vende en la sala.
export const CATEGORIAS = [
  { id: "bebidas", label: "Bebidas", icono: "🥤" },
  { id: "snacks", label: "Snacks", icono: "🍪" },
  { id: "helados", label: "Helados", icono: "🍦" },
  { id: "preparados", label: "Preparados", icono: "🍮" },
  { id: "otros", label: "Otros", icono: "📦" },
];

const POR_ID = new Map(CATEGORIAS.map((c) => [c.id, c]));

// "Otros" va siempre de último: es el cajón de lo que todavía no tiene lugar.
const ULTIMO = "otros";

const normalizar = (valor) =>
  String(valor ?? "")
    .trim()
    .toLowerCase();

/**
 * Ficha de presentación de una categoría. Para un id que no está en la lista
 * (categoría nueva del backend) arma una ficha decente en vez de descartarlo:
 * preferimos mostrar el dato tal como viene antes que perderlo.
 */
export function categoriaInfo(id) {
  const clave = normalizar(id);
  const conocida = POR_ID.get(clave);
  if (conocida) return conocida;
  if (!clave) return POR_ID.get(ULTIMO);
  return { id: clave, label: clave.charAt(0).toUpperCase() + clave.slice(1), icono: "📦" };
}

/** La categoría de un producto, tal como la mandó el backend. */
export function categoriaDe(producto) {
  return normalizar(producto?.categoria) || ULTIMO;
}

/**
 * Los chips que se muestran, con su conteo. Una categoría sin productos no
 * aparece: un chip que lleva a una pantalla vacía es una promesa incumplida.
 *
 * El orden es el de CATEGORIAS; una categoría que el backend inventó y que acá
 * no está listada se agrega al final, antes de "Otros".
 */
export function categoriasConProductos(productos) {
  const cuenta = new Map();
  (productos || []).forEach((p) => {
    const id = categoriaDe(p);
    cuenta.set(id, (cuenta.get(id) || 0) + 1);
  });

  const conocidas = CATEGORIAS.filter((c) => c.id !== ULTIMO && cuenta.get(c.id) > 0);
  const nuevas = [...cuenta.keys()]
    .filter((id) => !POR_ID.has(id))
    .sort()
    .map((id) => categoriaInfo(id));
  const ultimo = cuenta.get(ULTIMO) > 0 ? [POR_ID.get(ULTIMO)] : [];

  return [...conocidas, ...nuevas, ...ultimo].map((c) => ({
    ...c,
    total: cuenta.get(c.id),
  }));
}
