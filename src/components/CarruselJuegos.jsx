// Carrusel horizontal de los juegos de la sala, para la página principal.
//
// Sin librerías: es una fila que se desplaza. En el teléfono se arrastra con
// el dedo —que es como la gente espera moverlo— y en escritorio hay flechas y
// teclado. Las flechas se apagan solas al llegar a las puntas, así nadie toca
// un botón que no hace nada.
//
// Las tarjetas NO son enlaces: los 50 juegos apuntaban al mismo catálogo
// genérico de PS Plus, que ya está en el botón de abajo. Con el dedo, la gente
// toca lo que ve, y abrir una pestaña con una página que no habla de ese juego
// se siente roto. Acá el carrusel muestra; el botón lleva.
import { useCallback, useEffect, useRef, useState } from "react";
import { puntasVisibles, pasoDeScroll, progresoDeScroll } from "../constants/carrusel";
import "../styles/CarruselJuegos.css";

const CarruselJuegos = ({ juegos }) => {
  const pistaRef = useRef(null);
  const [puedeIzq, setPuedeIzq] = useState(false);
  const [puedeDer, setPuedeDer] = useState(false);
  const [barra, setBarra] = useState({ visible: 1, avance: 0 });

  // Qué flechas tienen sentido y dónde está la fila.
  const revisarPuntas = useCallback(() => {
    const pista = pistaRef.current;
    if (!pista) return;
    const { izquierda, derecha } = puntasVisibles(pista);
    setPuedeIzq(izquierda);
    setPuedeDer(derecha);
    setBarra(progresoDeScroll(pista));
  }, []);

  useEffect(() => {
    revisarPuntas();
    const alCambiarTamano = () => revisarPuntas();
    window.addEventListener("resize", alCambiarTamano);
    return () => window.removeEventListener("resize", alCambiarTamano);
  }, [revisarPuntas, juegos]);

  const mover = useCallback((hacia) => {
    const pista = pistaRef.current;
    if (!pista) return;
    pista.scrollBy({ left: pasoDeScroll(pista.clientWidth, hacia), behavior: "smooth" });
  }, []);

  // Con el teclado, las flechas mueven una pantalla entera y no tres píxeles,
  // que es lo que hace el navegador por su cuenta.
  const alTeclado = (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); mover(1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); mover(-1); }
  };

  if (!juegos?.length) return null;

  // La barrita: qué parte del total se está viendo y dónde. Es informativa y no
  // se toca: un riel de 4 px sería un blanco imposible para un dedo.
  const anchoBarra = Math.max(barra.visible * 100, 8);
  const izqBarra = (100 - anchoBarra) * barra.avance;
  const hayMas = barra.visible < 1;

  return (
    <div className="cj-wrap">
      <button
        type="button"
        className="cj-flecha cj-flecha--izq"
        onClick={() => mover(-1)}
        disabled={!puedeIzq}
        aria-label="Ver juegos anteriores"
      >
        ‹
      </button>

      <div
        className="cj-pista"
        ref={pistaRef}
        onScroll={revisarPuntas}
        onKeyDown={alTeclado}
        tabIndex={0}
        role="group"
        aria-label={`${juegos.length} juegos disponibles en la sala`}
      >
        {juegos.map((juego) => (
          <article className="cj-item" key={juego.id}>
            <div className="cj-foto">
              {/* La misma foto detrás, borrosa: así la portada se ve completa
                  sin recortes, venga vertical del teléfono o acostada. */}
              <img src={juego.imagen} alt="" aria-hidden="true" className="cj-fondo" />
              <img src={juego.imagen} alt={juego.nombre} className="cj-img" loading="lazy" />
            </div>
            <p className="cj-nombre">{juego.nombre}</p>
          </article>
        ))}
      </div>

      <button
        type="button"
        className="cj-flecha cj-flecha--der"
        onClick={() => mover(1)}
        disabled={!puedeDer}
        aria-label="Ver más juegos"
      >
        ›
      </button>

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
