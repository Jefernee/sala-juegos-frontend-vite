// Portada pública de la Sala de Juegos Ruiz.
//
// Todo el marcado va envuelto en .sjr y los estilos de Home.css están
// encapsulados bajo esa clase: Bootstrap se carga de forma global en main.jsx
// y sus reglas alcanzan a esta página, así que encapsular evita que nos pise
// —y que nosotros nos filtremos a las demás pantallas—.
//
// La página es OSCURA de principio a fin. Antes mezclaba una portada oscura
// con secciones gris claro, y esa mezcla es lo que la hacía ver casera; de
// paso resuelve el modo oscuro del teléfono, porque no queda nada claro que
// se rompa.
//
// Lo que se muestra sale del sistema, no de esta hoja:
//   · los juegos, del módulo 🎮 Juegos (los marcados con ⭐);
//   · los torneos, de /api/torneos/public;
//   · los productos, de /api/products/public, y solo los que tienen
//     existencias, igual que hace el catálogo.
import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { API_URL, formatFecha } from "../components/admin/adminUtils";
import { getToken } from "../utils/auth";
import { resolverDisponibilidad } from "../utils/stock";
import { fotoProducto } from "../utils/imagenes";
import "../App.css";
import "../styles/Global.css";
import "../styles/Home.css";

import CarruselJuegos from "../components/CarruselJuegos";
import LoadingSpinner from "../components/LoadingSpinner";
import { juegosData, ganadoresData, galeriaImagenes } from "../constants/homeData";

const MapComponent = lazy(() => import("../components/MapComponent"));

// ── Datos de la casa ────────────────────────────────────────────────────────
const WHATSAPP = "https://wa.me/50671603115";
const MAPS = "https://maps.google.com/?q=Sala+de+Juegos+Ruiz,+Batán,+Limón,+Costa+Rica";
// La novedad del momento. El afiche y el juego van juntos: cuando llegue el
// proximo estreno se cambian estas cuatro lineas y la portada entera se
// actualiza —el afiche de la seccion y la caratula grande del collage—.
const NOVEDAD = {
  juego: "EA FC 27",
  afiche: "/afiche-fc27.jpg",
  titulo: "EA Sports FC 27",
  bajada: "El fútbol como nunca antes lo has vivido. Vení a estrenarlo con tus amigos.",
};

const PS_PLUS =
  "https://www.playstation.com/es-es/ps-plus/games/?category=GAME_CATALOG#plus-container";

// El logo de la marca. La página lo pedía a 160 px y por eso se veía blando
// al agrandarlo; el original es de 500×500 y se pide entero.
const LOGO =
  "https://res.cloudinary.com/drjsg8j92/image/upload/c_scale,w_500,q_auto,f_auto/" +
  "v1737318752/Imagen_de_WhatsApp_2025-01-11_a_las_21.53.16_f15972d6_h3rx20.jpg";

// Horario de atención. Domingo = 0, como lo numera JavaScript.
const HORARIO = [
  { d: "Domingo", a: 12, c: 20 },
  { d: "Lunes", a: 8, c: 20 },
  { d: "Martes", a: 8, c: 20 },
  { d: "Miércoles", a: 8, c: 20 },
  { d: "Jueves", a: 8, c: 20 },
  { d: "Viernes", a: 8, c: 20 },
  { d: "Sábado", a: 8, c: 20 },
];

// Los precios son los que cobra el sistema (ver precioPorHora en
// PlaysManagement): Play 5 ₡1.000, Play 4 ₡800, Ping Pong ₡800.
const TARIFAS = [
  { icono: "🎮", nombre: "PlayStation 4", precio: "₡800", nota: "La hora. Hay tres disponibles." },
  { icono: "🕹️", nombre: "PlayStation 5", precio: "₡1.000", nota: "La hora. Hay tres, y elegís el juego.", destacada: true },
  { icono: "🏓", nombre: "Ping Pong", precio: "₡800", nota: "La hora. Para jugar de pie y en grupo." },
];

// ── El collage de portadas que flotan en la portada ────────────────────────
// Se ARMA con las medidas reales de cada caratula (vienen de la base), no con
// posiciones escritas a mano. Si manana entra una caratula mas alta o mas
// ancha, el acomodo se rehace solo; con posiciones fijas se montarian unas
// sobre otras y nadie se enteraria hasta verlo publicado.
//
// Dos columnas: la izquierda lleva 0, 2 y 4 y la derecha 1, 3 y 5, apiladas
// con el alto real de cada una. El reparto es fijo a proposito — la primera
// va mas grande y solo cabe en la columna izquierda.
const COLUMNAS = [
  { x: 0, indices: [0, 2, 4], anchos: [238, 168, 160], desde: 20, sesgo: [0, 14, 4] },
  { x: 250, indices: [1, 3, 5], anchos: [150, 156, 148], desde: 0, sesgo: [0, -52, -8] },
];
const GIROS = [-5, 5, 4, -5, 6, -4];
const SEPARACION = 18;
// Aire por los cuatro lados: las caratulas van inclinadas y flotando, y al
// girar su esquina asoma unos pixeles. Sin este margen quedaban pegadas al
// borde de la pantalla en el telefono.
const MARGEN = 22;

const armarCollage = (portadas) => {
  const anchos = [];
  COLUMNAS.forEach((c) => c.indices.forEach((i, k) => { anchos[i] = c.anchos[k]; }));

  const altos = portadas.map((j, i) => {
    const forma = j.ancho && j.alto ? j.ancho / j.alto : 1;
    return Math.round(anchos[i] / forma);
  });

  const x = [];
  const y = [];
  let fondo = 0;
  COLUMNAS.forEach((c) => {
    let cursor = c.desde;
    c.indices.forEach((i, k) => {
      if (i >= portadas.length) return;
      x[i] = c.x + c.sesgo[k] + MARGEN;
      y[i] = cursor + MARGEN;
      cursor += altos[i] + SEPARACION;
    });
    fondo = Math.max(fondo, cursor - SEPARACION);
  });

  const alto = fondo + MARGEN * 2;
  const lienzo = Math.max(...portadas.map((_, i) => x[i] + anchos[i])) + MARGEN;
  const pc = (v, base) => `${Math.round((v / base) * 10000) / 100}%`;

  return {
    lienzo,
    alto,
    sitios: portadas.map((_, i) => ({
      top: pc(y[i], alto),
      left: pc(x[i], lienzo),
      ancho: pc(anchos[i], lienzo),
      giro: GIROS[i],
      z: i === 0 ? 2 : undefined,
    })),
  };
};

const hora12 = (h) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "am" : "pm"}`;

// Los miles con punto. toLocaleString("es-CR") los separa con un ESPACIO y
// salía "4 800", que se lee como un texto partido a la mitad. Es el mismo
// arreglo que ya hace fmtMiles en PlaysManagement.
const miles = (n) => {
  const t = String(Math.round(n));
  let salida = "";
  for (let i = 0; i < t.length; i += 1) {
    if (i > 0 && (t.length - i) % 3 === 0) salida += ".";
    salida += t[i];
  }
  return salida;
};

function Home2() {
  // ── Juegos ────────────────────────────────────────────────────────────────
  // Salen del módulo 🎮 Juegos: se marcan con ⭐ y aparecen solos, sin tocar
  // código. La lista escrita a mano queda de respaldo: si el servidor está
  // dormido o falla, la página nunca se ve vacía delante de un cliente.
  const [juegos, setJuegos] = useState(juegosData);
  const [juegosReales, setJuegosReales] = useState(false);

  useEffect(() => {
    let vigente = true;
    axios
      .get(`${API_URL}/api/juegos/vitrina`)
      .then(({ data }) => {
        const vitrina = data?.data || [];
        if (vigente && vitrina.length) {
          setJuegosReales(true);
          setJuegos(
            vitrina.map((j) => ({
              id: j._id,
              nombre: j.nombre,
              imagen: j.imagenUrl,
              // Las medidas viajan para que el navegador le reserve a cada
              // foto su espacio exacto antes de bajarla (ver CarruselJuegos).
              ancho: j.imagenAncho,
              alto: j.imagenAlto,
            })),
          );
        }
      })
      .catch(() => {
        /* se queda la lista de respaldo */
      });
    return () => {
      vigente = false;
    };
  }, []);

  // ── Torneos ───────────────────────────────────────────────────────────────
  const [torneos, setTorneos] = useState([]);
  const [torneosLoading, setTorneosLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const res = await axios.get(`${API_URL}/api/torneos/public`);
        if (!cancelado) setTorneos(Array.isArray(res.data?.data) ? res.data.data : []);
      } catch {
        if (!cancelado) setTorneos([]);
      } finally {
        if (!cancelado) setTorneosLoading(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  // ── Productos ─────────────────────────────────────────────────────────────
  // Una muestra, no el catálogo: para eso está el botón. Solo los que tienen
  // existencias — no tiene sentido lucir algo que el cliente va a pedir y no
  // hay, que es justo lo que filtra la página de productos.
  const [productos, setProductos] = useState([]);

  useEffect(() => {
    let cancelado = false;
    axios
      .get(`${API_URL}/api/products/public`, { params: { page: 1, limit: 24 } })
      .then(({ data }) => {
        if (cancelado) return;
        const lista = (data?.productos || [])
          .filter((p) => p.imagen && !resolverDisponibilidad(p).agotado)
          .slice(0, 10);
        setProductos(lista);
      })
      .catch(() => {
        if (!cancelado) setProductos([]);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  // ── Sesión ────────────────────────────────────────────────────────────────
  // Se mira una sola vez al montar: si el token cambia, es porque el usuario
  // entró o salió, y en los dos casos esta pantalla se vuelve a montar.
  //
  // Al panel SOLO entra quien tiene usuario y contraseña. Este botón es la
  // puerta del personal, no del cliente: al cliente le tocan el catálogo, los
  // torneos y el WhatsApp. Con sesión abierta no se manda a nadie al
  // formulario —ofrecerle "Entrar" a quien ya entró es lo que hacía parecer
  // que la sesión se perdía—, así que cambia el texto porque cambia el
  // destino.
  const haySesion = !!getToken();

  // ── Horario de hoy ────────────────────────────────────────────────────────
  // Se calcula, no se escribe: el cartel dice si está abierto AHORA.
  const estado = useMemo(() => {
    const ahora = new Date();
    const hoy = ahora.getDay();
    const h = ahora.getHours() + ahora.getMinutes() / 60;
    const dia = HORARIO[hoy];
    const abierto = h >= dia.a && h < dia.c;
    const proximo = h >= dia.c ? HORARIO[(hoy + 1) % 7] : dia;
    return {
      hoy,
      abierto,
      texto: abierto
        ? `cierra a las ${hora12(dia.c)}`
        : `abre ${h >= dia.c ? "mañana" : "hoy"} a las ${hora12(proximo.a)}`,
    };
  }, []);

  const semana = useMemo(
    () => HORARIO.map((_, i) => ({ ...HORARIO[(estado.hoy + i) % 7], esHoy: i === 0 })),
    [estado.hoy],
  );

  // ── Animaciones ───────────────────────────────────────────────────────────
  const navRef = useRef(null);
  const avanceRef = useRef(null);

  // La barra de arriba se vuelve vidrio esmerilado al bajar, y una línea fina
  // marca cuánto queda de página.
  useEffect(() => {
    const alScroll = () => {
      if (navRef.current) navRef.current.classList.toggle("barra--solida", window.scrollY > 24);
      if (avanceRef.current) {
        const alto = document.documentElement.scrollHeight - window.innerHeight;
        avanceRef.current.style.width = `${alto > 0 ? (window.scrollY / alto) * 100 : 0}%`;
      }
    };
    alScroll();
    window.addEventListener("scroll", alScroll, { passive: true });
    return () => window.removeEventListener("scroll", alScroll);
  }, []);

  // Cada bloque entra al aparecer. El retraso sale de la POSICIÓN dentro de su
  // grupo y no del orden en que el navegador los fue viendo: así una rejilla
  // siempre entra de izquierda a derecha, pase lo que pase con el scroll.
  useEffect(() => {
    const ojo = new IntersectionObserver(
      (filas) => {
        filas.forEach((f) => {
          if (!f.isIntersecting) return;
          const el = f.target;
          const hermanos = el.parentElement ? Array.from(el.parentElement.children) : [el];
          const i = Math.min(hermanos.indexOf(el), 11);
          window.setTimeout(() => el.classList.add("a-la-vista"), i * 80);
          ojo.unobserve(el);
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -60px" },
    );
    document.querySelectorAll(".sjr .revelar").forEach((el) => ojo.observe(el));
    return () => ojo.disconnect();
  }, [juegos, torneos, productos]);

  // Los números se cuentan solos al asomar.
  useEffect(() => {
    const contar = (el) => {
      const fin = Number(el.dataset.contar);
      const ini = performance.now();
      const paso = (t) => {
        const p = Math.min((t - ini) / 1200, 1);
        const v = Math.round(fin * (1 - (1 - p) ** 3));
        el.textContent = `${el.dataset.antes || ""}${el.dataset.miles ? miles(v) : v}`;
        if (p < 1) requestAnimationFrame(paso);
      };
      requestAnimationFrame(paso);
    };
    const ojo = new IntersectionObserver(
      (filas) => {
        filas.forEach((f) => {
          if (!f.isIntersecting) return;
          contar(f.target);
          ojo.unobserve(f.target);
        });
      },
      { threshold: 0.5 },
    );
    document.querySelectorAll(".sjr [data-contar]").forEach((el) => ojo.observe(el));
    return () => ojo.disconnect();
  }, [juegos]);

  // El resplandor que sigue al puntero dentro de cada tarjeta de vidrio.
  const alMover = (e) => {
    const caja = e.currentTarget;
    const r = caja.getBoundingClientRect();
    caja.style.setProperty("--mx", `${e.clientX - r.left}px`);
    caja.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  // Cuenta regresiva de los torneos: convierte "hay un torneo" en "faltan 84
  // días", que es lo que hace que alguien se anote.
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    if (!torneos.length) return undefined;
    const id = window.setInterval(() => setAhora(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [torneos.length]);

  const cuentaAtras = (fecha) => {
    const falta = new Date(fecha).getTime() - ahora;
    if (falta <= 0) return null;
    const s = Math.floor(falta / 1000);
    return [
      [Math.floor(s / 86400), "días"],
      [Math.floor(s / 3600) % 24, "horas"],
      [Math.floor(s / 60) % 60, "min"],
      [s % 60, "seg"],
    ];
  };

  const totalJuegos = juegosReales ? juegos.length : 50;

  // El juego de la novedad encabeza el collage, en el sitio grande. Va atado
  // al afiche de NOVEDAD: cuando llegue el proximo estreno se cambian los dos
  // juntos y no queda uno apuntando al otro.
  const portadas = useMemo(() => {
    const i = juegos.findIndex((j) => j.nombre === NOVEDAD.juego);
    const lista = i > 0 ? [juegos[i], ...juegos.filter((_, k) => k !== i)] : juegos;
    return lista.slice(0, 6);
  }, [juegos]);

  const collage = useMemo(() => armarCollage(portadas), [portadas]);

  return (
    <div className="sjr">
      <div className="avance" ref={avanceRef} />
      <div className="aurora" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      {/* ── Barra ── */}
      <header className="barra" ref={navRef}>
        <div className="env barra__int">
          <a className="marca" href="#inicio">
            <img className="marca__logo" src={LOGO} alt="Sala de Juegos Ruiz" width="46" height="46" />
            <span className="marca__txt">
              Sala de Juegos Ruiz
              <small>Entretenimiento</small>
            </span>
          </a>
          <nav className="barra__links">
            <a href="#novedad">Novedades</a>
            <a href="#juegos">Juegos</a>
            <a href="#torneos">Torneos</a>
            <a href="#productos">Productos</a>
            <a href="#campeones">Campeones</a>
            <a href="#visita">Visitanos</a>
          </nav>
          <div className="barra__acciones">
            <Link className="boton boton--vidrio boton--chico" to="/productos">
              🛒 Productos
            </Link>
            <Link
              className="boton boton--vivo boton--chico"
              to={haySesion ? "/dashboard/sales" : "/login"}
              title="Acceso al panel — pide usuario y contraseña"
            >
              {haySesion ? "Ir al panel" : "Entrar"}
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ── Portada ── */}
        <section className="hero" id="inicio">
          {/* El logo de fondo. No es un logo cualquiera: el archivo es un
              afiche cuadrado que ya trae adentro el monograma, el nombre y el
              eslogan. Puesto de escudo al lado del titular quedaban dos
              nombres peleándose; de fondo oscurecido, la marca está presente
              sin competir. */}
          <img className="hero__fondo" src={LOGO} alt="" aria-hidden="true" />
          <div className="env hero__grid">
            <div>
              <span className="chip revelar">
                <span className={`punto${estado.abierto ? "" : " punto--rojo"}`} />
                {estado.abierto ? "Abierto ahora · " : "Cerrado · "}
                <b>{estado.texto}</b>
              </span>
              <h1 className="revelar">
                Vení a jugar,
                <br />
                <span className="deg">quedate a ganar</span>
              </h1>
              <span className="hero__firma revelar">
                Un lugar seguro y confiable para divertirse sanamente
              </span>
              <p className="bajada revelar">
                PlayStation 4 y 5, ping pong, futbolín y tragamonedas. Siempre vas a
                encontrar los juegos top y más actuales, con amigos o con la familia.
              </p>
              <div className="hero__botones revelar">
                <a className="boton boton--vivo boton--grande" href="#juegos">
                  Ver los +{totalJuegos} juegos →
                </a>
                <a className="boton boton--vidrio boton--grande" href="#visita">
                  📍 Cómo llegar
                </a>
              </div>
              <div className="datos">
                <div className="dato revelar">
                  <div className="dato__n" data-contar={totalJuegos} data-antes="+">0</div>
                  <div className="dato__t">Juegos para elegir</div>
                </div>
                <div className="dato revelar">
                  <div className="dato__n" data-contar="6">0</div>
                  <div className="dato__t">Consolas para jugar</div>
                </div>
                {/* Salen de la base: 291.343 minutos cobrados = 4.856 horas, y
                    419 clientes distintos en 4.363 tiempos de juego. Van
                    redondeados hacia abajo para que nunca queden de más. */}
                <div className="dato revelar">
                  <div className="dato__n" data-contar="4800" data-antes="+" data-miles="1">0</div>
                  <div className="dato__t">Horas de diversión</div>
                </div>
                <div className="dato revelar">
                  <div className="dato__n" data-contar="400" data-antes="+">0</div>
                  <div className="dato__t">Clientes atendidos</div>
                </div>
                {/* Abrio en 2021. Va con "+" porque el dueno recuerda que el
                    ano pasado ya llevaban cinco, y en ese caso serian seis:
                    "+5" es cierto en los dos casos y nunca queda de mas. */}
                <div className="dato revelar">
                  <div className="dato__n" data-contar="5" data-antes="+">0</div>
                  <div className="dato__t">Años dando diversión</div>
                </div>
              </div>
            </div>

            {/* Las portadas flotando. Van en PORCENTAJES sobre un lienzo, no en
                píxeles, para que el conjunto se encoja solo y también sirva en
                el teléfono. El margen de cada lado es para que la inclinación
                y el vaivén no las peguen al borde de la pantalla. */}
            <div
              className="collage revelar"
              style={{ aspectRatio: `${collage.lienzo} / ${collage.alto}` }}
            >
              {portadas.map((j, i) => {
                const s = collage.sitios[i];
                return (
                  <img
                    key={j.id}
                    src={j.imagen}
                    alt={j.nombre}
                    loading={i < 2 ? undefined : "lazy"}
                    style={{
                      top: s.top,
                      left: s.left,
                      width: s.ancho,
                      "--g": `${s.giro}deg`,
                      animationDelay: `${-1.6 * i}s`,
                      zIndex: s.z,
                      boxShadow: s.z
                        ? "0 30px 70px -18px rgba(34,211,238,.6), 0 20px 50px -20px rgba(0,0,0,.9)"
                        : undefined,
                    }}
                  />
                );
              })}
            </div>
          </div>
        </section>

        {/* ── La novedad: el afiche de la casa, completo ── */}
        <section id="novedad">
          <div className="env novedad">
            {/* El afiche va ENTERO, con su marca y su eslogan: es una pieza de
                publicidad terminada, no una imagen de relleno. Solo se le fija
                el ancho; el alto sale de la imagen. */}
            <figure className="afiche revelar">
              <img
                src={NOVEDAD.afiche}
                alt={`${NOVEDAD.titulo} ya disponible en Sala de Juegos Ruiz`}
                loading="lazy"
              />
            </figure>
            <div className="revelar">
              <span className="chip">
                <span className="punto" /> Recién llegado
              </span>
              <h2>
                {NOVEDAD.titulo}
                <br />
                <span className="deg">ya está en la sala</span>
              </h2>
              <p style={{ color: "var(--txt-2)", fontSize: "1.05rem", margin: 0 }}>
                {NOVEDAD.bajada}
              </p>
              <div className="insignias">
                <span className="pastilla">🎮 <b>PlayStation 5</b></span>
                <span className="pastilla">🎮 <b>PlayStation 4</b></span>
                <span className="pastilla">Desde <b>₡800</b> la hora</span>
              </div>
              <a className="boton boton--vivo boton--grande" href="#juegos">
                Ver todos los juegos →
              </a>
            </div>
          </div>
        </section>

        {/* ── Juegos ── */}
        <section id="juegos">
          <div className="env titulo revelar">
            <div className="sobre">Nuestros juegos</div>
            <h2>{juegosReales ? `+${juegos.length} juegos para elegir` : "Todos nuestros juegos"}</h2>
            <p>
              Los más jugados del momento van primero, y cada mes entran títulos nuevos.
              Vení y elegí el tuyo.
            </p>
          </div>
          <div className="env">
            <CarruselJuegos juegos={juegos} />
          </div>
          <div className="env" style={{ textAlign: "center", marginTop: 32 }}>
            <a
              className="boton boton--vidrio revelar"
              href={PS_PLUS}
              target="_blank"
              rel="noopener noreferrer"
            >
              Y todo el catálogo de PS Plus incluido
            </a>
          </div>
        </section>

        {/* ── Torneos ── */}
        <section id="torneos">
          <div className="env">
            <div className="titulo revelar">
              <div className="sobre">Competí</div>
              <h2>Inscripción a torneos</h2>
              <p>
                Acá no se juega solo por jugar. Anotate, medíte con los mejores de la zona
                y quedate en el salón de la fama.
              </p>
            </div>

            {torneosLoading ? (
              <LoadingSpinner text="Cargando torneos..." />
            ) : torneos.length === 0 ? (
              <p style={{ textAlign: "center", color: "var(--txt-2)" }}>
                No hay torneos abiertos por el momento. Los próximos se anuncian acá.
              </p>
            ) : (
              torneos.map((t) => {
                const abierto = t.estado === "abierto";
                const reloj = cuentaAtras(t.fecha);
                return (
                  <div className="torneo revelar" key={t._id}>
                    {t.imagenUrl && (
                      /* El afiche va entero: con recorte le cortaba el título.
                         Va CONTAIN sobre una copia de sí mismo desenfocada, que
                         rellena el sobrante con sus propios colores. */
                      <div className="torneo__afiche">
                        <img
                          className="torneo__afiche__fondo"
                          src={t.imagenUrl}
                          alt=""
                          aria-hidden="true"
                          loading="lazy"
                        />
                        <img
                          className="torneo__afiche__foto"
                          src={t.imagenUrl}
                          alt={`Afiche de ${t.nombre}`}
                          loading="lazy"
                        />
                      </div>
                    )}
                    <div className="torneo__cuerpo">
                      <span className={`torneo__estado${abierto ? "" : " torneo__estado--cerrado"}`}>
                        {abierto ? "● Inscripción abierta" : "Cerrado"}
                      </span>
                      <h3>{t.nombre}</h3>
                      {t.descripcion && <p style={{ color: "var(--txt-2)", margin: 0 }}>{t.descripcion}</p>}
                      <div className="torneo__meta">
                        <span className="pastilla">📅 <b>{formatFecha(t.fecha)}</b></span>
                        <span className="pastilla">
                          🎟️{" "}
                          <b>
                            {Number(t.costoInscripcion) > 0
                              ? `₡${miles(t.costoInscripcion)}`
                              : "Entrada gratuita"}
                          </b>
                        </span>
                        <span className="pastilla">
                          <b>{t.inscritosCount}</b>
                          {t.cupoMaximo ? ` de ${t.cupoMaximo} inscritos` : ` inscrito${t.inscritosCount === 1 ? "" : "s"}`}
                        </span>
                      </div>
                      {reloj && (
                        <div className="reloj">
                          {reloj.map(([v, u]) => (
                            <div key={u}>
                              <b>{String(v).padStart(2, "0")}</b>
                              <small>{u}</small>
                            </div>
                          ))}
                        </div>
                      )}
                      <Link className="boton boton--vivo boton--grande" to={`/torneos/${t._id}`}>
                        {abierto ? "Inscribirme al torneo →" : "Ver el torneo →"}
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* ── Productos ── */}
        {productos.length > 0 && (
          <section id="productos">
            <div className="env">
              <div className="titulo revelar">
                <div className="sobre">La tienda</div>
                <h2>Para acompañar la partida</h2>
                <p>
                  Snacks, helados y bebidas frías ahí mismo, para no tener que salir a
                  media partida.
                </p>
              </div>
              <div className="prod-grid">
                {productos.map((p) => (
                  <article className="prod revelar" key={p._id}>
                    {/* Caja cuadrada y a sangre, como las portadas de los
                        juegos. Se midieron las fotos del inventario: la
                        mediana es 1.00 y con caja cuadrada el recorte promedio
                        es del 9%, así que prácticamente no se pierde nada y a
                        cambio la foto llena el cuadro de borde a borde. */}
                    <div className="prod__foto">
                      <img src={fotoProducto(p.imagen, { ancho: 400 })} alt={p.nombre} loading="lazy" />
                    </div>
                    <div className="prod__pie">
                      <span className="prod__n">{p.nombre}</span>
                      <span className="prod__p">₡{miles(p.precioVenta)}</span>
                    </div>
                  </article>
                ))}
              </div>
              <div style={{ textAlign: "center", marginTop: 34 }}>
                <Link className="boton boton--vivo boton--grande revelar" to="/productos">
                  🛒 Ver el catálogo completo
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* ── Precios ── */}
        <section id="tarifas">
          <div className="env">
            <div className="titulo revelar">
              <div className="sobre">Precios</div>
              <h2>Cuánto cuesta jugar</h2>
              <p>Claro y sin sorpresas: pagás por hora y elegís cuánto querés quedarte.</p>
            </div>
            <div className="tarifas">
              {TARIFAS.map((t) => (
                <div
                  className={`caja tarifa${t.destacada ? " tarifa--destacada" : ""} revelar`}
                  key={t.nombre}
                  onPointerMove={alMover}
                >
                  {t.destacada && <span className="tarifa__etiqueta">La más pedida</span>}
                  <div className="caja__icono" style={{ margin: "0 auto 14px" }}>{t.icono}</div>
                  <h3>{t.nombre}</h3>
                  <div className="tarifa__precio">{t.precio}</div>
                  <p>{t.nota}</p>
                </div>
              ))}
            </div>
            <p
              className="revelar"
              style={{ textAlign: "center", color: "var(--txt-3)", fontSize: ".86rem", marginTop: 24 }}
            >
              También se puede por media hora o por el rato que quieras: se cobra proporcional.
            </p>
          </div>
        </section>

        {/* ── La sala ── */}
        <section id="sala">
          <div className="env">
            <div className="titulo revelar">
              <div className="sobre">La sala</div>
              <h2>Más que consolas</h2>
              <p>Vení con amigos, con la familia o a competir. Acá hay para los dos planes.</p>
            </div>
            <div className="bento">
              <div className="caja caja--ancha revelar" onPointerMove={alMover}>
                <div className="caja__icono">🎮</div>
                <h3>Sobre la sala de juegos</h3>
                <p>
                  Ofrecemos una amplia variedad de opciones de entretenimiento: desde
                  clásicos como ping pong, futbolín y máquinas tragamonedas, hasta consolas
                  de videojuegos como PlayStation. Un espacio pensado tanto para venir con
                  amigos y familia como para competir con otros jugadores.
                </p>
              </div>
              <div className="caja revelar" onPointerMove={alMover}>
                <div className="caja__icono">🎯</div>
                <h3>Visión</h3>
                <p>
                  Ser el centro de entretenimiento líder, proporcionando experiencias únicas
                  a nuestros jugadores, creando un espacio donde todos puedan disfrutar,
                  aprender y conectar con otros a través del juego.
                </p>
              </div>
              <div className="caja revelar" onPointerMove={alMover}>
                <div className="caja__icono">🤝</div>
                <h3>Misión</h3>
                <p>
                  Ofrecer un ambiente seguro, inclusivo y emocionante donde los jugadores
                  puedan disfrutar de una amplia gama de juegos de calidad, fomentando la
                  competencia sana y el trabajo en equipo.
                </p>
              </div>
              <div className="caja revelar" onPointerMove={alMover}>
                <div className="caja__icono">🏓</div>
                <h3>Ping pong, futbolín y tragamonedas</h3>
                <p>Para cuando se juega en grupo y nadie quiere soltar el control.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Galería ── */}
        <section id="galeria">
          <div className="env">
            <div className="titulo revelar">
              <div className="sobre">Por dentro</div>
              <h2>Así se vive la sala</h2>
              <p>Un lugar cómodo, limpio y seguro. Mirá cómo es antes de venir.</p>
            </div>
            {/* Cada foto entra con su alto real y la rejilla de columnas las
                acomoda: las fotos de la sala son panorámicas de hasta 2.17 y
                un marco común les cortaba los lados. */}
            <div className="galeria">
              {galeriaImagenes.map((src, i) => (
                <figure className="foto revelar" key={src}>
                  <img src={src} alt={`La sala de juegos ${i + 1}`} loading="lazy" />
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* ── Campeones ── */}
        <section id="campeones">
          <div className="env">
            <div className="titulo revelar">
              <div className="sobre">Salón de la fama</div>
              <h2>Campeones de la sala</h2>
              <p>Los que se llevaron el torneo. El próximo puede ser tuyo.</p>
            </div>
            <div className="campeones">
              {ganadoresData.map((g, i) => (
                <article className="campeon revelar" key={g.id}>
                  {/* La foto va ENTERA sobre una copia de sí misma
                      desenfocada. Las de los campeones son verticales de
                      celular (0.46): recortarlas a un círculo borraba tres
                      cuartas partes de la foto. */}
                  <div className="campeon__marco">
                    <img className="campeon__fondo" src={g.imagen} alt="" aria-hidden="true" loading="lazy" />
                    <img className="campeon__foto" src={g.imagen} alt={g.nombre} loading="lazy" />
                    <span className="medalla">{["🥇", "🥈", "🥉", "🏆"][i % 4]}</span>
                  </div>
                  <div className="campeon__texto">
                    <h4>{g.nombre}</h4>
                    <p>{g.titulo}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Visitanos ── */}
        <section id="visita">
          <div className="env">
            <div className="titulo revelar">
              <div className="sobre">Visitanos</div>
              <h2>Te esperamos</h2>
              <p>Estamos en Batán, Limón. Escribinos y te decimos cómo llegar.</p>
            </div>
            <div className="visita">
              <div className="caja revelar" onPointerMove={alMover}>
                <h3 style={{ marginBottom: 16 }}>Horario</h3>
                {semana.map((d) => (
                  <div className={`horario${d.esHoy ? " horario--hoy" : ""}`} key={d.d}>
                    <span>{d.esHoy ? `Hoy · ${d.d}` : d.d}</span>
                    <span>{`${hora12(d.a)} – ${hora12(d.c)}`}</span>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap" }}>
                  <a className="boton boton--vivo boton--chico" href={WHATSAPP} target="_blank" rel="noopener noreferrer">
                    💬 Escribinos
                  </a>
                  <a className="boton boton--vidrio boton--chico" href={MAPS} target="_blank" rel="noopener noreferrer">
                    📍 Abrir en Maps
                  </a>
                </div>
                <div style={{ marginTop: 22, color: "var(--txt-2)", fontSize: ".92rem" }}>
                  <p style={{ margin: "0 0 4px" }}>
                    📞 <a href="tel:86825481" style={{ color: "var(--txt)" }}>8682 5481</a>
                    {" · "}
                    <a href="tel:84237787" style={{ color: "var(--txt)" }}>8423 7787</a>
                  </p>
                  <p style={{ margin: 0 }}>
                    ✉️{" "}
                    <a href="mailto:salajuegosruiz@gmail.com" style={{ color: "var(--txt)" }}>
                      salajuegosruiz@gmail.com
                    </a>
                  </p>
                </div>
              </div>
              <div className="mapa revelar">
                <Suspense fallback={<LoadingSpinner text="Cargando mapa..." />}>
                  <MapComponent />
                </Suspense>
              </div>
            </div>
          </div>
        </section>
      </main>

      <a className="flotante" href={WHATSAPP} target="_blank" rel="noopener noreferrer" aria-label="Escribinos por WhatsApp">
        💬 <span>Escribinos</span>
      </a>

      <footer>
        <div className="env pie">
          <div className="pie__marca">
            <img className="pie__logo" src={LOGO} alt="Sala de Juegos Ruiz" loading="lazy" />
            <div>
              <strong style={{ fontSize: "1.1rem", letterSpacing: "-.02em" }}>Sala de Juegos Ruiz</strong>
              <small style={{ display: "block", marginTop: 4, color: "var(--cian)" }}>
                Un lugar seguro y confiable para divertirse sanamente
              </small>
              <small style={{ display: "block", marginTop: 2 }}>Batán, Limón · Costa Rica</small>
            </div>
          </div>
          <div className="pie__redes">
            <a className="red" href={WHATSAPP} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
              💬
            </a>
            <a className="red" href="tel:86825481" aria-label="Llamar">📞</a>
            <a className="red" href="mailto:salajuegosruiz@gmail.com" aria-label="Correo">✉️</a>
          </div>
          <small>© {new Date().getFullYear()} Sala de Juegos Ruiz</small>
        </div>
      </footer>
    </div>
  );
}

export default Home2;
