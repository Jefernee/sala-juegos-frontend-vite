// src/utils/imagenes.js
// Cómo se pide una foto de producto. Una sola implementación para todas las
// pantallas que las muestran (ventas, catálogo público, productos, gestionar).
//
// Dos problemas que resuelve, los dos por el mismo lado:
//
// · Las URLs guardadas traen a veces un recorte escrito (`c_fill` y compañía),
//   y eso corta la foto por los lados para todo el que la consuma. Como la
//   transformación vive en la URL y no en el archivo —el original sigue entero
//   en Cloudinary—, la URL se rearma desde la versión (`v123.../`) descartando
//   el tramo anterior, y la foto vuelve completa.
//
// · Se pedía el original para pintarlo en cajas de 80 a 320 px. Había fotos de
//   750×1000 y un PNG de 215 KB por producto; el catálogo público, que es el
//   que ven los clientes, era el más pesado de todos.
//
// Nada de esto recorta: `c_pad` rellena. Si alguna pantalla necesita una forma
// fija, la foto se completa con un color sacado de la propia imagen (`b_auto`)
// en vez de dejar ver el fondo de la caja.

const ES_CLOUDINARY = "res.cloudinary.com";

// Marca dónde terminan las transformaciones y empieza el archivo. Sin versión no
// hay forma de distinguir una transformación de una carpeta, así que ahí la
// nuestra se antepone y se conserva lo que hubiera: mejor una foto con el
// recorte de ellos que una URL rota.
const CON_VERSION = /(\/upload\/(?:.*?\/)?)(v\d+\/)/;

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

  return CON_VERSION.test(url)
    ? url.replace(CON_VERSION, `/upload/${pasos}/$2`)
    : url.replace("/upload/", `/upload/${pasos}/`);
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
