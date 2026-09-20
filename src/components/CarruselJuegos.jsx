// Carrusel horizontal de los juegos de la sala, para la página principal.
//
// GIRA SIN FIN: se puede deslizar para los dos lados todo lo que uno quiera y
// nunca se topa con el final. La lista se dibuja TRES veces seguidas y siempre
// se navega por la del medio; cuando el dedo se pasa a una de los costados, la
// fila se reubica una copia entera de golpe. Como las tres dibujan lo mismo,
// el salto no se ve.
//
// ANDA SOLA. La fila avanza despacio por su cuenta: es lo que le dice a la
// gente que ahí hay más de lo que se ve. Se aparta mientras alguien la toca y
// retoma sola un rato después; con el mouse encima se queda quieta para poder
// leer un nombre. No lleva flechas ni barrita: la que anda ya se explica.
//
// Sin librerías: el desplazamiento es el del navegador, así que en el teléfono
// conserva su inercia de siempre. Con el teclado, las flechas también mueven.
//
// Cada foto lleva sus medidas puestas: el navegador le reserva su ancho exacto
// antes de bajarla, así la fila mide bien desde el primer dibujo aunque las
// imágenes de más allá todavía no hayan llegado.
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
import { useCallback, useEffect, useRef } from "react";
import { COPIAS, acomodarCiclo, pasoDeScroll } from "../constants/carrusel";
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
  // Si la persona ya tocó el carrusel, no se le vuelve a mover la fila por
  // debajo aunque sigan llegando fotos.
  const tocado = useRef(false);
  // Se detiene mientras el mouse esta encima, para poder leer un nombre sin
  // que la fila se escape.
  const pausado = useRef(false);
  // Hasta cuando esperar antes de volver a andar sola. La fila NO se detiene
  // para siempre al tocarla: se aparta un momento y retoma. Quedarse quieta
  // despues del primer roce deja el resto del catalogo escondido, y la
  // persona no tiene como saber que ahi habia mas.
  const pausaHasta = useRef(0);
  const apartarse = useCallback(() => {
    tocado.current = true;
    pausaHasta.current = Date.now() + 2500;
  }, []);

  const alDesplazar = useCallback(() => {
    const pista = pistaRef.current;
    if (!pista) return;
    const anchoCopia = pista.scrollWidth / COPIAS;

    const destino = acomodarCiclo({ scrollLeft: pista.scrollLeft, anchoCopia });
    if (destino !== null) ubicarSinAnimar(pista, destino);

  }, []);

  // Vuelve a medir y, si nadie tocó todavía, recentra en la copia del medio.
  //
  // Hace falta llamarla CADA VEZ QUE CARGA UNA FOTO: el ancho de cada tarjeta
  // lo pone su imagen, así que antes de que bajen, la fila mide casi nada. Con
  // esas medidas el carrusel creía que todo cabía en pantalla y el centrado
  // inicial caía en cualquier lado, que rompía el giro desde el arranque.
  const remedir = useCallback(() => {
    const pista = pistaRef.current;
    if (!pista) return;
    if (!tocado.current) ubicarSinAnimar(pista, pista.scrollWidth / COPIAS);
    alDesplazar();
  }, [alDesplazar]);

  // Al entrar, la fila arranca en la copia del medio: el primer juego queda a
  // la izquierda como siempre, pero ya hay una vuelta entera de margen hacia
  // atrás para poder deslizar en ese sentido desde el primer momento.
  useEffect(() => {
    if (!juegos?.length) return;
    remedir();
  }, [juegos, remedir]);

  useEffect(() => {
    const alCambiarTamano = () => remedir();
    window.addEventListener("resize", alCambiarTamano);
    return () => window.removeEventListener("resize", alCambiarTamano);
  }, [remedir]);

  // ── SE MUEVE SOLA ──
  //
  // Si la fila se queda quieta, mucha gente no se entera de que hay 50 juegos
  // para deslizar y se pierde el catalogo entero. Avanza despacio y se aparta
  // en cuanto la persona la toca —pelearle el desplazamiento al dedo es lo
  // peor que puede hacer un carrusel—, pero RETOMA sola 2,5 s despues: si se
  // quedara quieta para siempre, el primer roce escondería el resto.
  //
  // Avanza 3 px cada 33 ms —unos 90 px por segundo— en numeros enteros: con
  // fracciones, algunos navegadores redondean a cero y no se mueve nada.
  // A 50 px/s se sentia lento; a este paso una caratula entra cada dos
  // segundos, que alcanza para leer el nombre sin que parezca detenido.
  //
  // Solo corre mientras se ve en pantalla. Si no, estaria gastando bateria y
  // repintando por una fila que nadie esta mirando.
  useEffect(() => {
    const pista = pistaRef.current;
    if (!juegos?.length || !pista) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    let aLaVista = true;
    const ojo = new IntersectionObserver(([e]) => { aLaVista = e.isIntersecting; });
    ojo.observe(pista);

    const reloj = window.setInterval(() => {
      if (pausado.current || !aLaVista || Date.now() < pausaHasta.current) return;
      // SIN animar. La fila tiene desplazamiento suave, asi que un
      // `scrollLeft += 3` arranca una animacion que el paso siguiente cancela
      // 33 ms despues: el neto es CERO y la fila se queda quieta. Con el
      // mismo ayudante del salto entre copias, el paso se aplica de una.
      ubicarSinAnimar(pista, pista.scrollLeft + 3);
    }, 33);

    return () => {
      window.clearInterval(reloj);
      ojo.disconnect();
    };
  }, [juegos]);


  const mover = useCallback((hacia) => {
    const pista = pistaRef.current;
    if (!pista) return;
    // Sin topes: el salto entre copias se encarga de que siempre haya mas.
    pista.scrollBy({ left: pasoDeScroll(pista.clientWidth, hacia), behavior: "smooth" });
  }, []);

  // Con el teclado, las flechas mueven una pantalla entera y no tres píxeles,
  // que es lo que hace el navegador por su cuenta.
  const alTeclado = (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); apartarse(); mover(1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); apartarse(); mover(-1); }
  };

  if (!juegos?.length) return null;

  // Las tres copias. Solo la del medio se le lee a un lector de pantalla: las
  // otras dos son el truco del giro, y repetir 150 nombres seria puro ruido.
  const copias = Array.from({ length: COPIAS }, (_, i) => i);

  return (
    <div className="cj-wrap">
      {/* NI FLECHAS NI BARRITA NI CONTADOR.
          La fila anda sola, asi que ya se ve que hay mas: no hace falta un
          cartel que lo diga ni botones para empujarla. Los dos recuadros
          negros de los costados tapaban caratulas y, en el telefono, competian
          con el dedo. Se mueve deslizando, que es lo natural, y en escritorio
          tambien con las flechas del teclado. */}
      <div
        className="cj-pista"
        ref={pistaRef}
        onScroll={alDesplazar}
        onKeyDown={alTeclado}
        onPointerDown={apartarse}
        onWheel={apartarse}
        onTouchStart={apartarse}
        onMouseEnter={() => { pausado.current = true; }}
        onMouseLeave={() => { pausado.current = false; }}
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
                <img
                  src={juego.imagen}
                  alt={juego.nombre}
                  className="cj-img"
                  loading="lazy"
                  // Con las medidas, el navegador le reserva a la foto su
                  // ancho exacto ANTES de bajarla. Sin esto, las que estan
                  // mas alla —que se bajan recien cuando hacen falta— miden
                  // cero, la fila entera mide mal y el carrusel cree que todo
                  // cabe en pantalla.
                  width={juego.ancho || undefined}
                  height={juego.alto || undefined}
                  onLoad={remedir}
                />
              </div>
              <p className="cj-nombre">{juego.nombre}</p>
            </article>
          )),
        )}
      </div>
    </div>
  );
};

export default CarruselJuegos;
