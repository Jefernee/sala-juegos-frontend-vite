// src/constants/carrusel.js
// Las decisiones del carrusel de juegos, fuera del componente para poder
// probarlas: cómo gira sin fin, cuánto avanza una flecha y dónde está la fila.

// Holgura en píxeles, para el redondeo del navegador.
export const MARGEN = 8;

// Cuánto de la pantalla avanza cada flecha. Menos de 1 a propósito: queda a la
// vista un pedacito de lo anterior, para no perder el hilo de dónde se estaba.
export const PASO = 0.85;

// EL CARRUSEL GIRA SIN FIN, y el truco es este: la lista se dibuja TRES veces
// seguidas y siempre se navega por la del medio. Cuando el dedo se pasa a la
// copia de la izquierda o a la de la derecha, se reubica una copia entera de
// golpe. Como las tres dibujan exactamente lo mismo, el salto es invisible:
// la persona siente que puede seguir deslizando para siempre, en los dos
// sentidos, sin toparse nunca con el final.
//
// Tres y no dos: con dos, al reubicar quedaría media copia de margen y un
// deslizón fuerte se comería el borde antes de que diera tiempo a corregir.
export const COPIAS = 3;

// Cuánto mover la fila al tocar una flecha. `hacia` es -1 (izquierda) o 1.
export const pasoDeScroll = (clientWidth, hacia = 1) =>
  Math.round((clientWidth || 0) * PASO) * (hacia < 0 ? -1 : 1);

// ¿Hay que reubicar la fila para que siga girando?
//
// Devuelve la posición nueva, o `null` si está en la zona buena y no hay que
// tocar nada. Se corrige recién al salir del medio para no estar moviendo la
// fila bajo el dedo: queda una copia entera de margen hacia cada lado.
export const acomodarCiclo = ({ scrollLeft = 0, anchoCopia = 0 } = {}) => {
  if (!(anchoCopia > 0)) return null;
  const medio = anchoCopia * 0.5;
  if (scrollLeft >= medio && scrollLeft <= anchoCopia * 1.5) return null;

  // Se salta un número ENTERO de copias, nunca una fracción: como las tres
  // dibujan lo mismo, correr la fila un múltiplo exacto de una vuelta deja la
  // pantalla idéntica y el salto no se ve. Se calcula en un solo paso para que
  // un deslizón largo no necesite dos correcciones seguidas, que sí se notan.
  const dentro = ((scrollLeft % anchoCopia) + anchoCopia) % anchoCopia;
  return dentro > medio ? dentro : dentro + anchoCopia;
};

// Dónde está la fila DENTRO de una vuelta, para la barrita de posición.
// Como se gira sin fin, la posición se mide contra una sola copia: la barrita
// recorre de punta a punta y vuelve a empezar, igual que el carrusel.
//
//   visible: qué proporción de una vuelta entra en pantalla (0 a 1)
//   avance:  por dónde va esa vuelta (0 al principio, casi 1 al final)
export const progresoCiclico = ({ scrollLeft = 0, clientWidth = 0, anchoCopia = 0 } = {}) => {
  if (!(anchoCopia > 0)) return { visible: 1, avance: 0 };
  const dentro = ((scrollLeft % anchoCopia) + anchoCopia) % anchoCopia;
  return {
    visible: Math.min(1, clientWidth / anchoCopia),
    avance: dentro / anchoCopia,
  };
};
