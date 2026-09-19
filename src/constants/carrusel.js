// src/constants/carrusel.js
// Las decisiones del carrusel de juegos, fuera del componente para poder
// probarlas: cuándo tiene sentido cada flecha y cuánto avanza un toque.

// Holgura en píxeles. El navegador redondea el desplazamiento, así que al
// llegar al final puede quedar en 1287.6 de 1288: sin esta holgura la flecha
// parpadea entre activa y apagada, y queda un botón que no hace nada.
export const MARGEN = 8;

// Cuánto de la pantalla avanza cada flecha. Menos de 1 a propósito: queda a la
// vista un pedacito de lo anterior, para no perder el hilo de dónde se estaba.
export const PASO = 0.85;

// Qué flechas tienen sentido según dónde esté la fila.
export const puntasVisibles = ({ scrollLeft = 0, clientWidth = 0, scrollWidth = 0 } = {}) => ({
  izquierda: scrollLeft > MARGEN,
  derecha: scrollLeft + clientWidth < scrollWidth - MARGEN,
});

// Cuánto mover la fila al tocar una flecha. `hacia` es -1 (izquierda) o 1.
export const pasoDeScroll = (clientWidth, hacia = 1) =>
  Math.round((clientWidth || 0) * PASO) * (hacia < 0 ? -1 : 1);

// Dónde está la fila y cuánto de ella se ve, para la barrita de posición.
// Con 50 juegos, las flechas solas no dicen si vas por el principio o por el
// final; la barra sí, y de un vistazo.
//
//   visible: qué proporción de la fila entra en pantalla (0 a 1)
//   avance:  cuánto se recorrió del total (0 al principio, 1 al final)
export const progresoDeScroll = ({ scrollLeft = 0, clientWidth = 0, scrollWidth = 0 } = {}) => {
  const recorrible = scrollWidth - clientWidth;
  return {
    visible: scrollWidth > 0 ? Math.min(1, clientWidth / scrollWidth) : 1,
    avance: recorrible > 0 ? Math.min(1, Math.max(0, scrollLeft / recorrible)) : 0,
  };
};
