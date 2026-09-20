// Catálogo público de productos.
//
// Va envuelto en .sjr-cat y sus estilos (Productos.css) están encapsulados
// bajo esa clase: Bootstrap se carga de forma global en main.jsx y sus reglas
// alcanzan a esta página.
//
// SE TRAE TODO DE UNA VEZ Y SE FILTRA EN EL NAVEGADOR.
// Antes pedía de 12 en 12 y cada búsqueda era un viaje al servidor con su
// espera. Son 81 productos en total: caben de sobra en una sola petición, y a
// cambio el buscador y las categorías responden al instante, sin parpadeos ni
// perder el foco del teclado. El endpoint no tiene tope de página, así que se
// le pide un límite alto y ya.
//
// Acá solo se muestra lo que se puede pedir hoy: si algo se agotó, no
// aparece. Ojo, esto vale SOLO en esta pantalla, que es la vitrina del
// cliente; en el panel se siguen viendo todos.
import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { resolverDisponibilidad } from "../utils/stock";
import { formatearNumero } from "../constants/inventario";
import { fotoProducto } from "../utils/imagenes";
import "../styles/Productos.css";

const LOGO =
  "https://res.cloudinary.com/drjsg8j92/image/upload/c_scale,w_500,q_auto,f_auto/" +
  "v1737318752/Imagen_de_WhatsApp_2025-01-11_a_las_21.53.16_f15972d6_h3rx20.jpg";

const WHATSAPP = "https://wa.me/50671603115";

// Los miles con punto. toLocaleString("es-CR") los separa con un ESPACIO y
// sale "1 500", que se lee como un texto partido a la mitad.
const miles = (n) => {
  const t = String(Math.round(Number(n) || 0));
  let salida = "";
  for (let i = 0; i < t.length; i += 1) {
    if (i > 0 && (t.length - i) % 3 === 0) salida += ".";
    salida += t[i];
  }
  return salida;
};
const colones = (n) => `₡${miles(n)}`;

// Sin tildes y en minúsculas: buscar "platanitos" tiene que encontrar
// "Plátanitos", que es como está escrito en el inventario.
const plano = (t) =>
  String(t || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const FORMULARIO_VACIO = {
  nombreCliente: "",
  telefono: "",
  email: "",
  cantidad: 1,
  notas: "",
};

const PublicProductsList = () => {
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("todo");

  const [elegido, setElegido] = useState(null);
  const [formulario, setFormulario] = useState(FORMULARIO_VACIO);
  const [enviando, setEnviando] = useState(false);

  const buscadorRef = useRef(null);

  useEffect(() => {
    let cancelado = false;
    axios
      .get(`${import.meta.env.VITE_API_URL}/api/products/public`, {
        params: { page: 1, limit: 300 },
      })
      .then(({ data }) => {
        if (cancelado) return;
        const lista = (data?.productos || []).filter(
          (p) => !resolverDisponibilidad(p).agotado,
        );
        setProductos(lista);
      })
      .catch(() => {
        if (!cancelado) setError(true);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  // Las categorías salen contadas de lo que hay, no escritas a mano: si
  // mañana aparece una nueva, se muestra sola.
  const categorias = useMemo(() => {
    const cuenta = {};
    productos.forEach((p) => {
      const c = p.categoria || "otros";
      cuenta[c] = (cuenta[c] || 0) + 1;
    });
    return Object.entries(cuenta).sort((a, b) => b[1] - a[1]);
  }, [productos]);

  const visibles = useMemo(() => {
    const texto = plano(busqueda.trim());
    return productos.filter(
      (p) =>
        (categoria === "todo" || (p.categoria || "otros") === categoria) &&
        (!texto || plano(p.nombre).includes(texto)),
    );
  }, [productos, busqueda, categoria]);

  // Los que entran se destapan en cascada.
  useEffect(() => {
    const ojo = new IntersectionObserver(
      (filas) => {
        filas.forEach((f) => {
          if (!f.isIntersecting) return;
          const el = f.target;
          const hermanos = el.parentElement ? Array.from(el.parentElement.children) : [el];
          window.setTimeout(() => el.classList.add("a-la-vista"), Math.min(hermanos.indexOf(el), 9) * 45);
          ojo.unobserve(el);
        });
      },
      { threshold: 0.05, rootMargin: "0px 0px -30px" },
    );
    document.querySelectorAll(".sjr-cat .revelar:not(.a-la-vista)").forEach((el) => ojo.observe(el));
    return () => ojo.disconnect();
  }, [visibles]);

  // ── Pedido ────────────────────────────────────────────────────────────────
  const abrirPedido = (producto) => {
    setElegido(producto);
    setFormulario(FORMULARIO_VACIO);
  };

  const cerrarPedido = () => {
    setElegido(null);
    setEnviando(false);
  };

  // Se cierra con Escape, como cualquier ventana.
  useEffect(() => {
    if (!elegido) return undefined;
    const alTeclado = (e) => {
      if (e.key === "Escape") cerrarPedido();
    };
    window.addEventListener("keydown", alTeclado);
    return () => window.removeEventListener("keydown", alTeclado);
  }, [elegido]);

  const cambiarCampo = (e) => {
    const { name, value } = e.target;
    setFormulario((prev) => ({ ...prev, [name]: value }));
  };

  const cantidadPedida = Math.max(1, parseInt(formulario.cantidad, 10) || 1);
  const totalPedido = elegido ? elegido.precioVenta * cantidadPedida : 0;

  const enviarPedido = async (e) => {
    e.preventDefault();

    if (!formulario.nombreCliente.trim()) {
      alert("Indique su nombre para continuar.");
      return;
    }
    if (!formulario.telefono.trim()) {
      alert("Indique un número de teléfono para poder contactarle.");
      return;
    }

    const { stock } = resolverDisponibilidad(elegido);
    if (cantidadPedida > stock) {
      alert(
        `La cantidad solicitada supera la disponibilidad actual (${formatearNumero(stock)} unidades).`,
      );
      return;
    }

    setEnviando(true);
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/api/pedidos`, {
        productoId: elegido._id,
        productoNombre: elegido.nombre,
        precioVenta: elegido.precioVenta,
        nombreCliente: formulario.nombreCliente,
        telefono: formulario.telefono,
        email: formulario.email,
        cantidad: cantidadPedida,
        notas: formulario.notas,
        total: totalPedido,
      });
      alert("Su solicitud fue registrada. Le contactaremos para confirmar el pedido.");
      cerrarPedido();
    } catch (err) {
      console.error("Error al enviar pedido:", err);
      alert("No fue posible registrar la solicitud. Intente de nuevo.");
      setEnviando(false);
    }
  };

  const conteo =
    visibles.length === 1
      ? "1 producto"
      : `Mostrando ${visibles.length} productos${categoria !== "todo" ? ` en ${categoria}` : ""}`;

  return (
    <div className="sjr-cat">
      <div className="aurora" aria-hidden="true">
        <span />
        <span />
      </div>

      <header className="barra">
        <div className="env barra__int">
          <Link className="marca" to="/">
            <img className="marca__logo" src={LOGO} alt="Sala de Juegos Ruiz" width="46" height="46" />
            <span className="marca__txt">
              Sala de Juegos Ruiz
              <small>Entretenimiento</small>
            </span>
          </Link>
          <Link className="boton boton--vidrio boton--chico" to="/">
            ← Volver al inicio
          </Link>
        </div>
      </header>

      <main>
        <div className="env cabecera">
          {/* De un solo color: "Catálogo de productos" es una sola cosa, y
              partida en dos tonos se leía como si fueran dos frases. En la
              portada sí van en dos tonos, porque ahí son dos frases. */}
          <h1>Catálogo de productos</h1>
          <p>Acá sale solo lo que hay en este momento: si aparece, está disponible.</p>
        </div>

        {/* Buscador y categorías quedan pegados arriba al desplazar: con
            decenas de productos, tener que volver al principio para cambiar de
            categoría es un castigo con el dedo. */}
        <div className="herramientas">
          <div className="env">
            <div className="barra-filtros">
              <div className="buscador">
                <span className="buscador__lupa" aria-hidden="true">🔍</span>
                <input
                  ref={buscadorRef}
                  type="search"
                  placeholder="Buscar producto…"
                  aria-label="Buscar producto"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
                {busqueda && (
                  <button
                    type="button"
                    className="buscador__borrar"
                    style={{ display: "block" }}
                    aria-label="Borrar búsqueda"
                    onClick={() => {
                      setBusqueda("");
                      buscadorRef.current?.focus();
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="filtros" role="group" aria-label="Filtrar por categoría">
                <button
                  type="button"
                  className="filtro"
                  aria-pressed={categoria === "todo"}
                  onClick={() => setCategoria("todo")}
                >
                  Todo <b>{productos.length}</b>
                </button>
                {categorias.map(([cat, n]) => (
                  <button
                    key={cat}
                    type="button"
                    className="filtro"
                    aria-pressed={categoria === cat}
                    onClick={() => setCategoria(cat)}
                  >
                    {cat.charAt(0).toUpperCase() + cat.slice(1)} <b>{n}</b>
                  </button>
                ))}
              </div>
            </div>
            {!cargando && !error && <p className="conteo">{conteo}</p>}
          </div>
        </div>

        <div className="env">
          {cargando ? (
            <p className="aviso">Cargando el catálogo…</p>
          ) : error ? (
            <div className="aviso">
              <b>No pudimos cargar el catálogo</b>
              Probá de nuevo en un momento, o escribinos y te decimos qué hay.
            </div>
          ) : visibles.length === 0 ? (
            <div className="aviso">
              <b>No encontramos nada con eso</b>
              Probá con otra palabra, o mirá todas las categorías.
            </div>
          ) : (
            <div className="rejilla">
              {visibles.map((p) => (
                <article className="prod revelar" key={p._id}>
                  {/* Caja cuadrada y a sangre. Se midieron las fotos del
                      inventario: la mediana es exactamente 1.00 y el recorte
                      promedio de una caja cuadrada es del 9%, así que casi no
                      se pierde nada y a cambio la foto llena el cuadro de
                      borde a borde, como las portadas de los juegos. */}
                  <div className="prod__foto">
                    <img
                      src={fotoProducto(p.imagen, { ancho: 500 })}
                      alt={p.nombre}
                      loading="lazy"
                    />
                  </div>
                  <div className="prod__cuerpo">
                    <span className="prod__cat">{p.categoria || "otros"}</span>
                    <h3 className="prod__n">{p.nombre}</h3>
                    <div className="prod__fila">
                      <span className="prod__p">{colones(p.precioVenta)}</span>
                      <button
                        type="button"
                        className="boton boton--vidrio boton--chico"
                        onClick={() => abrirPedido(p)}
                      >
                        Apartar
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>

      <footer>
        <div className="env">
          <img className="pie__logo" src={LOGO} alt="Sala de Juegos Ruiz" loading="lazy" />
          <small style={{ color: "var(--cian)", fontWeight: 600 }}>
            Un lugar seguro y confiable para divertirse sanamente
          </small>
          <small style={{ marginTop: 6 }}>© {new Date().getFullYear()} Sala de Juegos Ruiz</small>
          <small style={{ marginTop: 2, opacity: 0.3, fontSize: ".7rem", letterSpacing: ".04em" }}>
            Hecho por Jefernee Ruiz
          </small>
        </div>
      </footer>

      {/* Ventana de pedido: centrada y con margen. No ocupa toda la pantalla
          ni sube desde abajo. */}
      {elegido && (
        <div
          className="telon"
          open
          onClick={(e) => {
            if (e.target === e.currentTarget) cerrarPedido();
          }}
        >
          <div className="ventana" role="dialog" aria-modal="true" aria-labelledby="pedido-nombre">
            <div className="ventana__cab">
              <div className="ventana__foto">
                <img src={fotoProducto(elegido.imagen, { ancho: 200 })} alt="" />
              </div>
              <div>
                <h3 id="pedido-nombre">{elegido.nombre}</h3>
                <span className="ventana__precio">{colones(elegido.precioVenta)} c/u</span>
              </div>
              <button type="button" className="cerrar" onClick={cerrarPedido} aria-label="Cerrar">
                ✕
              </button>
            </div>

            <form onSubmit={enviarPedido}>
              <div className="campo">
                <label htmlFor="p-nombre">Nombre completo *</label>
                <input
                  id="p-nombre"
                  name="nombreCliente"
                  required
                  placeholder="Su nombre"
                  value={formulario.nombreCliente}
                  onChange={cambiarCampo}
                />
              </div>
              <div className="campo">
                <label htmlFor="p-tel">Teléfono *</label>
                <input
                  id="p-tel"
                  name="telefono"
                  type="tel"
                  required
                  placeholder="8888 8888"
                  value={formulario.telefono}
                  onChange={cambiarCampo}
                />
              </div>
              <div className="campo">
                <label htmlFor="p-mail">Correo (opcional)</label>
                <input
                  id="p-mail"
                  name="email"
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={formulario.email}
                  onChange={cambiarCampo}
                />
              </div>
              <div className="campo">
                <label htmlFor="p-cant">Cantidad *</label>
                <input
                  id="p-cant"
                  name="cantidad"
                  type="number"
                  min="1"
                  max={resolverDisponibilidad(elegido).stock || 1}
                  required
                  value={formulario.cantidad}
                  onChange={cambiarCampo}
                />
              </div>
              <div className="campo">
                <label htmlFor="p-notas">Comentarios (opcional)</label>
                <textarea
                  id="p-notas"
                  name="notas"
                  placeholder="Información adicional sobre el pedido"
                  value={formulario.notas}
                  onChange={cambiarCampo}
                />
              </div>

              <div className="total">
                <span>Total</span>
                <b>{colones(totalPedido)}</b>
              </div>

              <button className="boton boton--vivo boton--bloque" type="submit" disabled={enviando}>
                {enviando ? "Enviando…" : "Enviar solicitud"}
              </button>
              <p className="ventana__nota">
                Le contactamos para confirmar. No se paga nada por acá.
              </p>
            </form>
          </div>
        </div>
      )}

      <a
        className="flotante"
        href={WHATSAPP}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Escribinos por WhatsApp"
      >
        💬 <span>Escribinos</span>
      </a>
    </div>
  );
};

export default PublicProductsList;
