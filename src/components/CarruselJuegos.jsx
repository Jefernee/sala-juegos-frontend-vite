// Carrusel horizontal de los juegos de la sala, para la página principal.
//
// GIRA SIN FIN: se puede deslizar para los dos lados todo lo que uno quiera y
// nunca se topa con el final. La lista se dibuja TRES veces seguidas y siempre
// se navega por la del medio; cuando el dedo se pasa a una de los costados, la
// fila se reubica una copia entera de golpe. Como las tres dibujan lo mismo,
// el salto no se ve.
//
// Sin librerías: el desplazamiento es el del navegador, así que en el teléfono
// conserva su inercia de siempre. En escritorio hay flechas y teclado.
//
// Las portadas van como una TIRA DE CINE: todas del mismo alto y el ancho lo
// pone cada foto. Las 50 vienen de todas las formas (carátulas verticales,
// capturas apaisadas, cuadradas), y obligarlas a un marco común dejaba a unas
// con franjas de relleno y a otras diminutas.
//
// Las tarjetas NO son enlaces: los 50 juegos apuntaban al mismo catálogo
// genérico de PS Plus, que ya está en el botón de abajo. Con el dedo, la gente
// toca lo que ve, y abrir una pestaña con una página que no habla de ese juego
// se siente roto. Acá el carrusel muestra; el botón lleva.
import { useCallback, useEffect, useRef, useState } from "react";
import { COPIAS, acomodarCiclo, pasoDeScroll, progresoCiclico } from "../constants/carrusel";
import "../styles/CarruselJuegos.css";

// Mueve la fila SIN animación. Hace falta para el salto entre copias: con el
// desplazamiento suave del CSS, ese salto se vería como un viaje relámpago
// por los 50 juegos.
const ubicarSinAnimar = (pista, left) => {
  const antes = pista.style.scrollBehavior;
  pista.style.scrollBehavior = "auto";
  pista.scrollLeft = left;
  pista.style.scrollBehavior = antes;
};

const CarruselJuegos = ({ juegos }) => {
  const pistaRef = useRef(null);
  const [barra, setBarra] = useState({ visible: 1, avance: 0 });

  const alDesplazar = useCallback(() => {
    const pista = pistaRef.current;
    if (!pista) return;
    const anchoCopia = pista.scrollWidth / COPIAS;

    const destino = acomodarCiclo({ scrollLeft: pista.scrollLeft, anchoCopia });
    if (destino !== null) ubicarSinAnimar(pista, destino);

    setBarra(progresoCiclico({
      scrollLeft: pista.scrollLeft,
      clientWidth: pista.clientWidth,
      anchoCopia,
    }));
  }, []);

  // Al entrar, la fila arranca en la copia del medio: el primer juego queda a
  // la izquierda como siempre, pero ya hay una vuelta entera de margen hacia
  // atrás para poder deslizar en ese sentido desde el primer momento.
  useEffect(() => {
    const pista = pistaRef.current;
    if (!pista || !juegos?.length) return;
    ubicarSinAnimar(pista, pista.scrollWidth / COPIAS);
    alDesplazar();
  }, [juegos, alDesplazar]);

  useEffect(() => {
    const alCambiarTamano = () => alDesplazar();
    window.addEventListener("resize", alCambiarTamano);
    return () => window.removeEventListener("resize", alCambiarTamano);
  }, [alDesplazar]);

  const mover = useCallback((hacia) => {
    const pista = pistaRef.current;
    if (!pista) return;
    // Sin topes: el salto entre copias se encarga de que siempre haya más.
    pista.scrollBy({ left: pasoDeScroll(pista.clientWidth, hacia), behavior: "smooth" });
  }, []);

  // Con el teclado, las flechas mueven una pantalla entera y no tres píxeles,
  // que es lo que hace el navegador por su cuenta.
  const alTeclado = (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); mover(1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); mover(-1); }
  };

  if (!juegos?.length) return null;

  // La barrita: por dónde va la vuelta. Es informativa y no se toca: un riel de
  // 4 px sería un blanco imposible para un dedo.
  const anchoBarra = Math.max(barra.visible * 100, 8);
  const izqBarra = (100 - anchoBarra) * barra.avance;
  const hayMas = barra.visible < 1;

  // Las tres copias. Solo la del medio se le lee a un lector de pantalla: las
  // otras dos son el truco del giro, y repetir 150 nombres sería puro ruido.
  const copias = Array.from({ length: COPIAS }, (_, i) => i);

  return (
    <div className="cj-wrap">
      {hayMas && (
        <button
          type="button"
          className="cj-flecha cj-flecha--izq"
          onClick={() => mover(-1)}
          aria-label="Ver juegos anteriores"
        >
          ‹
        </button>
      )}

      <div
        className="cj-pista"
        ref={pistaRef}
        onScroll={alDesplazar}
        onKeyDown={alTeclado}
        tabIndex={0}
        role="group"
        aria-label={`${juegos.length} juegos disponibles en la sala`}
      >
        {copias.map((copia) =>
          juegos.map((juego) => (
            <article
              className="cj-item"
              key={`${copia}-${juego.id}`}
              aria-hidden={copia !== 1 ? "true" : undefined}
            >
              <div className="cj-foto">
                {/* Una sola imagen, entera y a su forma: el alto lo pone la
                    fila y el ancho lo pone la foto. Ni recorte ni relleno. */}
                <img src={juego.imagen} alt={juego.nombre} className="cj-img" loading="lazy" />
              </div>
              <p className="cj-nombre">{juego.nombre}</p>
            </article>
          )),
        )}
      </div>

      {hayMas && (
        <button
          type="button"
          className="cj-flecha cj-flecha--der"
          onClick={() => mover(1)}
          aria-label="Ver más juegos"
        >
          ›
        </button>
      )}

      {hayMas && (
        <div className="cj-barra" aria-hidden="true">
          <span className="cj-barra__pulgar" style={{ width: `${anchoBarra}%`, left: `${izqBarra}%` }} />
        </div>
      )}

      <p className="cj-contador">
        {juegos.length} juegos{hayMas ? " · deslizá para verlos todos" : ""}
      </p>
    </div>
  );
};

export default CarruselJuegos;
