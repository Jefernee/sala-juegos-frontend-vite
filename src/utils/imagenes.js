// src/utils/imagenes.js
// Cómo se pide una foto de producto. Una sola implementación para todas las
// pantallas que las muestran (ventas, catálogo público, productos, gestionar).
//
// Qué resuelve: se pedía el archivo tal como está guardado —hasta 1000 px de
// lado— para pintarlo en cajas de 80 a 320 px. El catálogo público, que es el
// que ven los clientes, era el más pesado de todos.
//
// Qué NO hace: tocar el encuadre. `c_pad` rellena, nunca recorta, y el relleno
// toma un color de la propia imagen (`b_auto`) en vez de dejar ver el fondo de
// la caja. Si una foto se ve cortada, el corte está en el archivo: las fotos
// del inventario tienen proporciones distintas (750×1000, 533×603, 321×474) y
// varias son tomas donde el producto ya sale partido por el borde. Eso se
// arregla volviendo a subir la foto, no acá.

const ES_CLOUDINARY = "res.cloudinary.com";

/**
 * La URL de una foto de producto, pedida al tamaño en que se va a ver.
 *
 * @param {string} url     la que guardó el backend
 * @param {object} opciones
 * @param {number} opciones.ancho  ancho en píxeles reales (contá la densidad de
 *                                 pantalla: una caja de 100 px a 3x son 300)
 * @param {string} [opciones.forma] proporción fija, "3:4" o "1:1". Sin esto la
 *                                 foto conserva la suya.
 * @returns {string} la URL lista, o la original si no es de Cloudinary
 */
export function fotoProducto(url, { ancho, forma } = {}) {
  if (typeof url !== "string") return url;
  if (!url.includes(ES_CLOUDINARY) || !url.includes("/upload/")) return url;

  const pasos = [
    ancho ? `w_${ancho}` : null,
    forma ? `ar_${forma},c_pad,b_auto` : null,
    "f_auto,q_auto",
  ].filter(Boolean).join(",");

  // Se antepone y ya. Las URLs que guarda el backend son canónicas —no llevan
  // nada entre `upload/` y la versión, verificado sobre los 81 productos— así
  // que no hay transformación previa que esquivar. Hubo una versión de esto que
  // recortaba la URL desde la versión para deshacer un recorte guardado que
  // resultó no existir; además, con una URL sin versión, ese corte devolvía una
  // dirección rota. Fuera.
  return url.replace("/upload/", `/upload/${pasos}/`);
}

/** `srcset` de dos anchos, para que cada pantalla elija según su densidad. */
export function fotoProductoSrcSet(url, anchos, forma) {
  return anchos
    .map((a) => `${fotoProducto(url, { ancho: a, forma })} ${a}w`)
    .join(", ");
}

// Respaldo para un producto sin foto. Antes acá había una URL de
// via.placeholder.com, servicio que dejó de responder: cada producto sin foto
// mostraba una imagen rota. Este dibujo viaja dentro del HTML, así que no puede
// fallar ni depende de nadie.
export const SIN_FOTO =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">' +
      '<rect width="120" height="120" fill="#e9edf3"/>' +
      '<path d="M30 78l18-22 14 17 10-12 18 17z" fill="#c2ccd9"/>' +
      '<circle cx="45" cy="42" r="8" fill="#c2ccd9"/>' +
      "</svg>",
  );
