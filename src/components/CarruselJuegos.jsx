// Cinta de juegos de la sala, para la página principal.
//
// ANDA SOLA Y ADEMÁS SE ARRASTRA. La lista se dibuja TRES veces seguidas y la
// tira se corre con una animación de CSS hasta justo un tercio: como las tres
// copias dibujan lo mismo, al volver al principio nadie nota la costura.
//
// Las dos cosas conviven: la animación mueve la tira, y por debajo la fila
// sigue siendo deslizable con el dedo. Al arrastrar de más, salta una copia
// entera, así que tampoco por ahí se topa con el final.
//
// SE ANIMA CON CSS, NO MOVIENDO LA BARRA DE DESPLAZAMIENTO.
// Hubo una versión que empujaba `scrollLeft` cuadro a cuadro y se veía
// "pegada": ese empujón pasa por el hilo principal y rehace el maquetado en
// cada paso. Una animación de `transform` la lleva el compositor, va siempre
// al ritmo de la pantalla y sale pareja. Y se pausa y se reanuda al instante
// con `animation-play-state`, sin temporizadores de por medio: quien la toca y
// suelta ve que sigue de una, no que se queda esperando un rato.
//
// La velocidad se fija en píxeles por segundo y la duración se calcula con el
// ancho real de una copia. Con una duración fija, una cinta de 50 juegos y una
// de 5 correrían a velocidades distintas.
//
// Cada foto lleva sus medidas puestas: el navegador le reserva su ancho exacto
// antes de bajarla, así la tira mide bien desde el primer dibujo aunque las
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
// se siente roto. Acá la cinta muestra; el botón lleva.
import { useCallback, useEffect, useRef, useState } from "react";
import { COPIAS, acomodarCiclo } from "../constants/carrusel";
import "../styles/CarruselJuegos.css";

// A qué velocidad corre la cinta. Se probó a 50 y a 90 y las dos se sentían
// detenidas; más allá de unos 180 ya no da tiempo de leer un nombre al pasar.
const PX_POR_SEGUNDO = 110;

// Cuánto se queda quieta después de que alguien la ARRASTRA. Lo suficiente
// para leer lo que fue a buscar, sin que parezca trabada.
const SEGUNDOS_DE_CALMA = 3;

// Cuántos píxeles hay que mover para que cuente como arrastre y no como
// toque. Menos que esto es el temblor normal de un dedo apoyado.
const MINIMO_ARRASTRE = 10;

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
  const tiraRef = useRef(null);
  // Si la persona ya movió la fila, no se le vuelve a recentrar por debajo
  // aunque sigan llegando fotos.
  const tocado = useRef(false);
  const [duracion, setDuracion] = useState(null);
  // La cinta se queda quieta mientras alguien la tiene presionada. Y además,
  // SI LA ARRASTRÓ, un rato más después de soltar.
  //
  // La diferencia entre tocar y arrastrar es la que importa. Un toque suelto
  // que la deje parada varios segundos se siente rota: se soltó y no arranca.
  // Pero si alguien la arrastró fue para mirar algo, y si arranca en el acto,
  // eso que quería ver se le escapa y tiene que volver a presionar. Así que
  // el toque la suelta de una y el arrastre le da unos segundos de calma.
  const [presionando, setPresionando] = useState(false);
  const [enCalma, setEnCalma] = useState(false);
  const arrastro = useRef(false);
  const relojCalma = useRef(0);


  // Desde donde se empezó a arrastrar con el mouse. Con el dedo no hace falta:
  // el navegador ya desplaza solo. Con el mouse no, y agarrar la fila y
  // moverla es lo primero que intenta cualquiera en un escritorio.
  const arrastre = useRef(null);
  const inicioToque = useRef(0);

  // La duración sale del ancho REAL de una copia, y hay que recalcularla cada
  // vez que carga una foto: el ancho de cada tarjeta lo pone su imagen, así
  // que antes de que bajen la tira mide casi nada y la cinta saldría
  // disparada.
  const remedir = useCallback(() => {
    const tira = tiraRef.current;
    const pista = pistaRef.current;
    if (!tira || !pista) return;
    const anchoCopia = tira.scrollWidth / COPIAS;
    if (!(anchoCopia > 0)) return;
    setDuracion(anchoCopia / PX_POR_SEGUNDO);
    // Se arranca en la copia del medio: el primer juego queda a la izquierda
    // como siempre, pero ya hay una vuelta entera de margen hacia atrás para
    // poder arrastrar en ese sentido desde el primer momento.
    if (!tocado.current) ubicarSinAnimar(pista, anchoCopia);
  }, []);

  // EL GIRO SIN FIN, PARA CUANDO SE ARRASTRA. La animación se encarga del
  // movimiento propio; esto se encarga de que, además, se pueda deslizar con
  // el dedo todo lo que uno quiera sin toparse nunca con el final: al pasarse
  // a una copia del costado, la fila se reubica una copia entera de golpe.
  // Como las tres dibujan lo mismo, el salto no se ve.
  const alDesplazar = useCallback(() => {
    const pista = pistaRef.current;
    const tira = tiraRef.current;
    if (!pista || !tira) return;
    const destino = acomodarCiclo({
      scrollLeft: pista.scrollLeft,
      anchoCopia: tira.scrollWidth / COPIAS,
    });
    if (destino !== null) ubicarSinAnimar(pista, destino);
  }, []);

  const alPresionar = useCallback((e) => {
    tocado.current = true;
    arrastro.current = false;
    inicioToque.current = e.clientX;
    setPresionando(true);
    // Con el dedo el navegador ya desplaza solo; con el mouse no, y agarrar
    // la fila y moverla es lo primero que intenta cualquiera en escritorio.
    if (e.pointerType === "mouse" && pistaRef.current) {
      arrastre.current = { x: e.clientX, left: pistaRef.current.scrollLeft };
      pistaRef.current.setPointerCapture(e.pointerId);
    }
  }, []);

  const alMoverPuntero = useCallback((e) => {
    if (Math.abs(e.clientX - inicioToque.current) > MINIMO_ARRASTRE) arrastro.current = true;
    if (!arrastre.current || !pistaRef.current) return;
    ubicarSinAnimar(pistaRef.current, arrastre.current.left - (e.clientX - arrastre.current.x));
  }, []);

  // Con el dedo, el arrastre no llega por pointermove: lo hace el navegador
  // desplazando. Por eso se mira acá si la fila se movió mientras estaba
  // presionada.
  const alDesplazarUsuario = useCallback(() => {
    if (presionando) arrastro.current = true;
    alDesplazar();
  }, [presionando, alDesplazar]);

  useEffect(() => {
    remedir();
  }, [juegos, remedir]);

  useEffect(() => {
    const alCambiarTamano = () => remedir();
    window.addEventListener("resize", alCambiarTamano);
    return () => window.removeEventListener("resize", alCambiarTamano);
  }, [remedir]);

  const darCalma = useCallback(() => {
    window.clearTimeout(relojCalma.current);
    setEnCalma(true);
    relojCalma.current = window.setTimeout(() => setEnCalma(false), SEGUNDOS_DE_CALMA * 1000);
  }, []);

  const soltar = useCallback(() => {
    arrastre.current = null;
    setPresionando(false);
    if (arrastro.current) darCalma();
    arrastro.current = false;
  }, [darCalma]);

  // RED DE SEGURIDAD. Los avisos de "ya solte" se escuchan en la ventana
  // entera y no solo en la fila: si el dedo se levanta afuera —o el navegador
  // se queda el gesto para desplazar la página— el aviso no llega al
  // elemento, y la cinta se quedaría parada para siempre sin que nadie
  // entienda por qué.
  useEffect(() => {
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", soltar);
    window.addEventListener("touchend", soltar);
    window.addEventListener("blur", soltar);
    return () => {
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", soltar);
      window.removeEventListener("touchend", soltar);
      window.removeEventListener("blur", soltar);
      window.clearTimeout(relojCalma.current);
    };
  }, [soltar]);

  if (!juegos?.length) return null;

  // Las tres copias. Solo la del medio se le lee a un lector de pantalla: las
  // otras dos son el truco del giro, y repetir 150 nombres sería puro ruido.
  const copias = Array.from({ length: COPIAS }, (_, i) => i);

  return (
    <div className="cj-wrap">
      {/* Ni flechas ni barrita ni contador: la cinta anda sola, así que ya se
          ve que hay más. Los dos recuadros negros de los costados tapaban
          carátulas y en el teléfono competían con el dedo. */}
      <div
        className="cj-pista"
        ref={pistaRef}
        role="group"
        aria-label={`${juegos.length} juegos disponibles en la sala`}
        onScroll={alDesplazarUsuario}
        onPointerDown={alPresionar}
        onPointerMove={alMoverPuntero}
        onPointerUp={soltar}
        onPointerCancel={soltar}
      >
        <div
          className={`cj-tira${presionando || enCalma ? " cj-tira--quieta" : ""}`}
          ref={tiraRef}
          style={duracion ? { animationDuration: `${duracion}s` } : undefined}
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
                    // Sin esto, en escritorio el navegador arranca a arrastrar
                    // la imagen en vez de dejar mover la fila.
                    draggable={false}
                    // Con las medidas, el navegador le reserva a la foto su
                    // ancho exacto ANTES de bajarla. Sin esto, las que están
                    // más allá —que se bajan recién cuando hacen falta— miden
                    // cero, la tira entera mide mal y la cinta correría a una
                    // velocidad equivocada.
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
    </div>
  );
};

export default CarruselJuegos;
