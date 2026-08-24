// src/pages/SalesDashboard.jsx
//
// Pantalla de ventas. Pensada para el mostrador, con una mano, en el celular.
//
// Por qué es así:
//
// · Se abre en lo que más se vende, no en el inventario completo. En una sala
//   así la mayoría de las ventas son las mismas diez cosas; esas van primero y
//   sin teclado. El resto se alcanza por categoría, y "Todos" queda de último.
//
// · Buscar no sale a internet. `/api/products/para-venta` devuelve el inventario
//   entero en la primera carga, así que filtrar es local: instantáneo, sin
//   borrar la lista mientras llega la respuesta. Antes cada tecla disparaba una
//   petición con 500 ms de espera, pidiendo datos que ya estaban en memoria.
//
// · La tarjeta entera es el botón. Antes el "+ Agregar" era el blanco más chico
//   de la pantalla, dentro de una lista de 200 px de alto donde caben dos
//   productos.
//
// · El pedido vive en una barra de 60 px con la cuenta, el total y Cobrar. El
//   detalle se abre solo para corregir. Antes el carrito ocupaba media pantalla
//   arriba, incluso vacío.
//
// · Cobrar pregunta cómo se paga y repasa la venta por nombres antes de
//   registrarla. `montoPagado` y `vuelto` ya existían en el POST pero se
//   mandaban en total/0 fijos: ahora se llenan de verdad y la pantalla calcula
//   el vuelto. `metodoPago` es campo nuevo — si el backend no lo guarda todavía,
//   lo ignora y el resto sigue funcionando igual.
//
// El carrito guarda { id: cantidad }, no copias de los productos. El producto
// siempre se lee de la lista que vino del backend, así que el stock del carrito
// no puede quedar desfasado del stock real.

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import "../styles/SalesDashboard.css";
import Navbar from "../components/NavBar2";
import { puedeVerModulo } from "../utils/auth";
import { mensajeDeError } from "../utils/sesion";
import FotoProducto from "../components/FotoProducto";
import { resolverDisponibilidad } from "../utils/stock";
import { formatearMonto } from "../constants/inventario";
import { categoriaDe, categoriasConProductos, categoriaInfo } from "../constants/categorias";

const API_URL = import.meta.env.VITE_API_URL;

// Lazy load de axios solo cuando se necesite. Los interceptores de
// src/utils/api.js (timeout, reintento, 401/403) aplican igual: axios es un
// singleton de módulo.
let axiosModule = null;
const getAxios = async () => {
  if (!axiosModule) axiosModule = await import("axios");
  return axiosModule.default;
};

// Cuántos productos se pintan por lote. Cambiar de categoría no cuesta red
// (todo está en memoria), pero pintar 60 tarjetas con 60 fotos sí cuesta.
const LOTE = 18;

// Cuántos entran en el Top. Diez caben en una pantalla de celular sin deslizar.
const TOPE_TOP = 10;

// Debajo de esto el stock se muestra en rojo: "quedan 3" avisa antes de que el
// cliente pida cuatro.
const STOCK_BAJO = 5;

// Con cuánto paga: además del monto exacto, se ofrece el total redondeado
// hacia arriba a cada uno de estos saltos. Una lista fija de billetes dejaba sin
// salida a un pedido grande — con ₡22.000 de total, ningún billete de la lista
// alcanzaba y el único botón posible era "Exacto".
const REDONDEOS = [1000, 2000, 5000, 10000, 20000];

// Marca de que en este aparato ya alguien armó un pedido. Solo sirve para dejar
// de mostrar la pista de abajo: es enseñanza, y a quien ya la aprendió le tapa
// tarjetas antes de cada venta. Va en localStorage y no en el backend porque lo
// que hay que recordar es "esta pantalla ya se usó", no algo de la cuenta: un
// celular nuevo, o uno del personal que entra por primera vez, tiene que recibir
// la explicación aunque el usuario sea el mismo de siempre.
const CLAVE_PISTA = "ventasPistaVista";

const VISTA_TOP = "top";
const VISTA_TODOS = "todos";

// Texto comparable para buscar: sin acentos ni signos, así "cocacola" encuentra
// "Coca-Cola" y nadie pierde una venta por un tilde.
const plano = (valor) =>
  String(valor ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const SalesDashboard = () => {
  const [productos, setProductos] = useState([]);
  // Ids de los más vendidos del negocio, en orden, tal como los manda el
  // backend. Antes esto lo aprendía cada dispositivo en su localStorage; ahora
  // hay un endpoint que el vendedor también puede llamar, así que el Top es el
  // mismo en todos los equipos y no hay dos verdades.
  const [masVendidos, setMasVendidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [vista, setVista] = useState(VISTA_TOP);
  // El campo de búsqueda se quitó de la pantalla, pero la lógica se conserva
  // entera y funcionando: `busqueda` sigue filtrando la parrilla (ver `visibles`),
  // el rótulo sigue sabiendo decir "3 resultados para «coca»" y el estado vacío
  // sigue ofreciendo "Ver todo". Hoy nadie escribe acá, así que el valor es
  // siempre "".
  //
  // Para devolverlo hay que volver a montar el `<input>` que lo alimente y
  // encender de nuevo el bloque `.buscador` de SalesDashboard.css. Se dejó así a
  // propósito: quitar la fila era por espacio, no porque buscar estuviera mal.
  // ¿Ya se armó un pedido alguna vez en este aparato? Se lee una sola vez al
  // montar; si el navegador no deja leer (modo privado), se asume que no y la
  // pista aparece: enseñar de más es mejor que dejar a alguien sin saber tocar.
  const [pistaVista, setPistaVista] = useState(() => {
    try {
      return localStorage.getItem(CLAVE_PISTA) === "1";
    } catch {
      return false;
    }
  });

  const [busqueda, setBusqueda] = useState("");
  const [tope, setTope] = useState(LOTE);

  // { [productoId]: cantidad }
  const [carrito, setCarrito] = useState({});
  const [flash, setFlash] = useState(null);

  // null | "pedido" | "cobro" | "listo"
  const [paso, setPaso] = useState(null);
  const [metodo, setMetodo] = useState(null); // "efectivo" | "sinpe"
  const [pagado, setPagado] = useState(null);
  const [recibo, setRecibo] = useState(null);
  const [cobrando, setCobrando] = useState(false);

  const [aviso, setAviso] = useState(null);
  const avisoTimer = useRef(null);
  const chipsRef = useRef(null);
  const [chipsNav, setChipsNav] = useState({ desliza: false, izq: false, der: false, ancho: 0, pos: 0 });

  const getAuthHeaders = useCallback(() => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  }), []);

  // Aviso propio en vez de alert(). El alert nativo en móvil tapa la pantalla y
  // hay que confirmarlo con el dedo en medio de una venta.
  const avisar = useCallback((titulo, detalle, tono = "alerta") => {
    setAviso({ titulo, detalle, tono });
    clearTimeout(avisoTimer.current);
    avisoTimer.current = setTimeout(() => setAviso(null), 3200);
  }, []);

  useEffect(() => () => clearTimeout(avisoTimer.current), []);

  const cargarProductos = useCallback(async ({ inicial = false } = {}) => {
    if (inicial) setLoading(true);
    try {
      const axios = await getAxios();
      const res = await axios.get(`${API_URL}/api/products/para-venta`, getAuthHeaders());
      const lista = res.data.productos || res.data || [];
      setProductos(Array.isArray(lista) ? lista : []);
      setError(null);
    } catch (err) {
      console.error("❌ Error al cargar productos:", err);
      // `esSesion` = el interceptor global (sesion.js) ya está yendo al login;
      // pintar un error sobre una navegación en curso sería ruido. Un 403 de
      // rol NO viene marcado así: ese sí se muestra, con el texto del backend,
      // porque puede ser alguien a quien acaban de degradar.
      if (err?.esSesion) return;
      setError(
        err?.response?.status === 403
          ? mensajeDeError(err.response?.data, "No tenés permiso para esto.")
          : "No se pudieron cargar los productos. Revisá la conexión.",
      );
    } finally {
      if (inicial) setLoading(false);
    }
  }, [getAuthHeaders]);

  /**
   * El ranking del negocio. Si falla no se avisa nada: sin ranking el Top se
   * completa con el inventario y se puede seguir vendiendo igual. Un cartel de
   * error por esto sería ruido en medio de una venta.
   *
   * El backend lo tiene cacheado cinco minutos, así que pedirlo en cada carga y
   * después de cobrar es barato.
   */
  const cargarMasVendidos = useCallback(async () => {
    try {
      const axios = await getAxios();
      const res = await axios.get(
        `${API_URL}/api/products/mas-vendidos?limite=${TOPE_TOP}`,
        getAuthHeaders(),
      );
      const lista = Array.isArray(res.data) ? res.data : res.data?.productos || [];
      setMasVendidos(lista.map((x) => String(x?.productoId || "")).filter(Boolean));
    } catch (err) {
      console.warn("No se pudo cargar el ranking de más vendidos:", err?.message);
      setMasVendidos([]);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    cargarProductos({ inicial: true });
    cargarMasVendidos();
    document.title = "Ventas - Sala de Juegos Ruiz";
  }, [cargarProductos, cargarMasVendidos]);

  // ── Categorías y vista actual ──────────────────────────────────────────────

  const categorias = useMemo(() => categoriasConProductos(productos), [productos]);

  // El ranking cruzado con el inventario: el backend manda ids, y de acá sale el
  // producto con su precio y su stock de ahora. Un id que ya no está en el
  // inventario queda fuera solo.
  const aprendidos = useMemo(() => {
    if (!masVendidos.length) return [];
    const porId = new Map(productos.map((p) => [String(p._id), p]));
    return masVendidos.map((id) => porId.get(id)).filter(Boolean);
  }, [masVendidos, productos]);

  // La pantalla abre siempre en Top, así que Top nunca puede estar vacío: lo que
  // falta para llegar a diez se completa con el inventario, dejando los agotados
  // para el final. Con cada venta cobrada la lista se va acomodando sola hasta
  // ser de verdad la de los más vendidos.
  const top = useMemo(() => {
    if (aprendidos.length >= TOPE_TOP) return aprendidos;
    const ya = new Set(aprendidos.map((p) => p._id));
    const resto = productos.filter((p) => !ya.has(p._id));
    const relleno = [
      ...resto.filter((p) => !resolverDisponibilidad(p).agotado),
      ...resto.filter((p) => resolverDisponibilidad(p).agotado),
    ].slice(0, TOPE_TOP - aprendidos.length);
    return [...aprendidos, ...relleno];
  }, [aprendidos, productos]);

  const conTop = top.length > 0;

  const chips = useMemo(() => {
    const lista = [];
    if (conTop) lista.push({ id: VISTA_TOP, label: "Top", icono: "★", total: top.length });
    categorias.forEach((c) => lista.push(c));
    if (productos.length > 0) {
      lista.push({ id: VISTA_TODOS, label: "Todos", icono: "", total: productos.length });
    }
    return lista;
  }, [conTop, top.length, categorias, productos.length]);

  const visibles = useMemo(() => {
    const q = plano(busqueda);
    // Buscando se ignora la categoría: si el empleado escribe el nombre, lo
    // quiere encontrar aunque esté en otra pestaña.
    if (q) return productos.filter((p) => plano(p.nombre).includes(q));
    if (vista === VISTA_TOP) return top;
    if (vista === VISTA_TODOS) return productos;
    return productos.filter((p) => categoriaDe(p) === vista);
  }, [busqueda, productos, vista, top]);

  const mostrados = useMemo(() => visibles.slice(0, tope), [visibles, tope]);

  useEffect(() => { setTope(LOTE); }, [vista, busqueda]);

  // ── Aviso de que la fila de categorías sigue ───────────────────────────────
  // En móvil no hay barra de scroll: sin esto, las categorías de la derecha no
  // existen para quien usa la pantalla. El riel va debajo de los chips, en su
  // propia línea, para no taparle un píxel a ninguna categoría.

  const medirChips = useCallback(() => {
    const el = chipsRef.current;
    if (!el) return;
    const total = el.scrollWidth;
    const visible = el.clientWidth;
    const desliza = total - visible > 6;
    setChipsNav({
      desliza,
      izq: el.scrollLeft > 4,
      der: total - visible - el.scrollLeft > 4,
      ancho: desliza ? Math.max(18, (visible / total) * 100) : 100,
      pos: desliza ? (el.scrollLeft / total) * 100 : 0,
    });
  }, []);

  useEffect(() => {
    medirChips();
    window.addEventListener("resize", medirChips);
    return () => window.removeEventListener("resize", medirChips);
  }, [medirChips, chips]);

  // Un solo empujón al abrir: la fila se mueve y vuelve. Con eso se ve que se
  // desliza, sin cartel y sin nada encima de un chip.
  useEffect(() => {
    if (loading || chips.length === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = chipsRef.current;
    if (!el || el.scrollWidth - el.clientWidth < 10) return;

    const ida = setTimeout(() => el.scrollTo({ left: 30, behavior: "smooth" }), 700);
    const vuelta = setTimeout(() => el.scrollTo({ left: 0, behavior: "smooth" }), 1320);
    return () => { clearTimeout(ida); clearTimeout(vuelta); };
  }, [loading, chips.length]);

  // ── Carrito ────────────────────────────────────────────────────────────────

  const lineas = useMemo(() => {
    // Se arma desde la lista del backend: si un producto desapareció del
    // inventario, sale del pedido solo en vez de venderse fantasma.
    return Object.entries(carrito)
      .map(([id, cantidad]) => {
        const producto = productos.find((p) => p._id === id);
        return producto ? { producto, cantidad } : null;
      })
      .filter(Boolean);
  }, [carrito, productos]);

  const unidades = useMemo(() => lineas.reduce((a, l) => a + l.cantidad, 0), [lineas]);
  const total = useMemo(
    () => lineas.reduce((a, l) => a + (Number(l.producto.precioVenta) || 0) * l.cantidad, 0),
    [lineas],
  );

  /**
   * Saca el producto del pedido, sin importar la cantidad que llevara.
   *
   * Es la segunda mitad del interruptor de la tarjeta: un toque lo mete, otro lo
   * saca. Que la tarjeta sume de a uno con cada toque confundía — dos toques sin
   * querer y llevabas dos gaseosas sin haberlo pedido.
   */
  const cambiar = useCallback((producto, delta) => {
    const disp = resolverDisponibilidad(producto);
    const actual = carrito[producto._id] || 0;
    const nuevo = actual + delta;

    if (delta > 0) {
      if (disp.agotado) {
        avisar("Agotado", disp.motivo || `No queda "${producto.nombre}"`);
        return;
      }
      if (nuevo > disp.stock) {
        avisar(
          "Stock insuficiente",
          disp.stock === 1
            ? `Solo hay 1 unidad de "${producto.nombre}"`
            : `Solo hay ${disp.stock} unidades de "${producto.nombre}"`,
        );
        return;
      }
    }

    setCarrito((prev) => {
      const copia = { ...prev };
      if (nuevo <= 0) delete copia[producto._id];
      else copia[producto._id] = nuevo;
      return copia;
    });

    if (delta > 0) {
      setFlash(producto._id);
      setTimeout(() => setFlash((f) => (f === producto._id ? null : f)), 260);

      // Un golpecito corto al sumar. Es el acuse de recibo que reemplaza al
      // "tocar de nuevo para sacar": el vendedor sabe que entró sin mirar el
      // número, con el cliente enfrente y ruido alrededor.
      // `?.` porque no todos los navegadores la tienen — Safari de iPhone no
      // soporta la API de vibración, y ahí simplemente no pasa nada.
      navigator.vibrate?.(15);

      // Tocó un producto: ya sabe cómo se arma un pedido. La pista no vuelve.
      if (!pistaVista) {
        setPistaVista(true);
        try {
          localStorage.setItem(CLAVE_PISTA, "1");
        } catch {
          // Sin poder guardarlo la pista vuelve mañana. No es motivo para
          // romper una venta.
        }
      }
    }
    // Cambiar el pedido invalida el monto elegido: el vuelto de antes ya no vale.
    setPagado(null);
  }, [carrito, avisar, pistaVista]);

  const vaciar = useCallback(() => {
    setCarrito({});
    setPaso(null);
  }, []);

  // El pedido vacío no puede quedar con la hoja abierta mostrando nada.
  useEffect(() => {
    if (unidades === 0 && (paso === "pedido" || paso === "cobro")) setPaso(null);
  }, [unidades, paso]);

  // ── Cobro ──────────────────────────────────────────────────────────────────

  const opcionesPago = useMemo(() => {
    if (!total) return [];
    const arriba = REDONDEOS.map((salto) => Math.ceil(total / salto) * salto).filter((v) => v > total);
    return [...new Set([total, ...arriba])].sort((a, b) => a - b).slice(0, 5);
  }, [total]);

  // Con el método elegido ya se puede cobrar. Elegir con cuánto paga es opcional
  // y sirve para que la pantalla saque el vuelto; en la práctica muchas veces no
  // se toca, y quedarse con el botón apagado esperando ese toque frenaba la
  // venta. Sin monto, la venta se registra como pago justo.
  const listoParaCobrar = !!metodo;

  // Qué panel muestra la hoja. Con `paso` en null igual se arma el del pedido:
  // en móvil queda escondido, y en escritorio es la columna fija de la derecha,
  // que tiene que estar visible desde antes del primer toque.
  const vistaPaso = paso || "pedido";

  const abrirCobro = useCallback(() => {
    setMetodo(null);
    setPagado(null);
    setPaso("cobro");
  }, []);

  const procesarVenta = async () => {
    if (!lineas.length || !listoParaCobrar || cobrando) return;

    // Que el teclado no quede abierto tapando el resultado.
    document.activeElement?.blur?.();

    // Si no se eligió con cuánto paga, se registra como pago justo: es lo que
    // pasa en la mayoría de las ventas y es lo único que se puede afirmar sin
    // inventar. Nunca se manda `null`, que el backend rechaza por ser menor al
    // total.
    const montoPagado = metodo === "efectivo" ? pagado ?? total : total;
    const vuelto = Math.max(0, montoPagado - total);

    const productosVenta = lineas.map(({ producto, cantidad }) => ({
      productoId: producto._id,
      nombre: producto.nombre,
      cantidad,
      precioVenta: producto.precioVenta,
      subtotal: producto.precioVenta * cantidad,
    }));

    setCobrando(true);
    try {
      const axios = await getAxios();
      const res = await axios.post(
        `${API_URL}/api/sales`,
        {
          productos: productosVenta,
          total,
          montoPagado,
          vuelto,
          // Campo nuevo: mientras el backend no lo guarde, lo ignora en
          // silencio y la venta se registra igual que antes.
          metodoPago: metodo,
          fecha: new Date().toISOString(),
        },
        getAuthHeaders(),
      );

      setRecibo({
        numero: res.data.venta?._id || res.data._id || null,
        total,
        metodo,
        montoPagado,
        vuelto,
        lineas: productosVenta.map((p) => ({
          nombre: p.nombre,
          cantidad: p.cantidad,
          subtotal: p.subtotal,
        })),
      });
      setCarrito({});
      setPaso("listo");

      // Vender un cono baja el helado, y eso cambia cuántos helados con
      // gelatina se pueden preparar: el número nuevo solo lo sabe el backend.
      // Restar local daría un stock equivocado.
      cargarProductos();
      cargarMasVendidos();
    } catch (err) {
      console.error("❌ Error al procesar la venta:", err);
      if (err?.esSesion) return;
      const detalle = err?.response?.data?.mensaje || err?.response?.data?.error;
      avisar("No se pudo cobrar", detalle || "La venta no quedó registrada. Probá de nuevo.");
    } finally {
      setCobrando(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  // El historial va en la barra de arriba, al lado del nombre, en vez de tener
  // una fila propia acá abajo: esa fila era permanente y pegajosa, y en el
  // celular vale un cuarto de hilera de productos. Arriba no cuesta nada porque
  // la barra ya existía.
  //
  // En una variable porque la pantalla de carga monta la MISMA barra: si ahí
  // faltara el botón, la cabecera daría un salto al terminar de cargar.
  const controlesBarra = puedeVerModulo("salesHistory") ? (
    <Link
      to="/sales-history"
      className="sales-hist sales-hist--barra"
      title="Historial de ventas"
    >
      📊
    </Link>
  ) : null;

  if (loading) {
    return (
      <div className="sales-container">
        <Navbar>{controlesBarra}</Navbar>
        <div className="sales-cargando">
          <div className="spinner-border text-light" role="status">
            <span className="visually-hidden">Cargando productos…</span>
          </div>
        </div>
      </div>
    );
  }

  const tarjeta = (producto) => {
    const disp = resolverDisponibilidad(producto);
    const cantidad = carrito[producto._id] || 0;
    const cat = categoriaInfo(categoriaDe(producto));
    const foto = producto.imagenOptimizada || producto.imagen;

    return (
      <div
        key={producto._id}
        className={
          "prod" +
          (disp.agotado ? " prod--agotado" : "") +
          (cantidad ? " prod--en-pedido" : "") +
          (flash === producto._id ? " prod--pop" : "")
        }
      >
        {/* Cada toque suma uno. La tarjeta era un interruptor —tocar de nuevo
            sacaba el producto— para evitar que un toque de más metiera dos
            gaseosas sin querer. Con tres columnas eso dejó de convenir: para
            vender dos hay que acertarle al "+" de la insignia, y a ese tamaño
            cuesta. Vale más que el blanco grande (la tarjeta entera) haga lo
            que se hace todo el día, que es sumar.
            Lo que protege del toque accidental ahora es el aviso: el número
            cambia a la vista y el teléfono vibra. Para bajar están el − y el
            basurerito, que por eso se agrandaron en el celular. */}
        <button
          type="button"
          className="prod__toque"
          onClick={() => cambiar(producto, 1)}
          disabled={disp.agotado}
          aria-label={
            cantidad === 0
              ? `Agregar ${producto.nombre}`
              : `Agregar otro ${producto.nombre}, van ${cantidad}`
          }
        >
          <span className="prod__foto" data-cat={cat.id}>
            <FotoProducto
              src={foto}
              ancho={320}
              forma="3:4"
              anchos={[320, 640]}
              sizes="(max-width: 640px) 33vw, 200px"
            />
            <span className="prod__inicial" aria-hidden="true">
              {(producto.nombre || "?").charAt(0).toUpperCase()}
            </span>
          </span>

          {/* El sello se calla mientras el producto está en el pedido: en una
              tarjeta de 116 px, "Receta" arranca a 7 px del borde izquierdo y la
              insignia de cantidad llega hasta los 44 px del otro lado, así que
              se pisan y la insignia le come la palabra por la mitad. Con el
              producto ya agregado el sello es lo prescindible: sirve para
              decidir si tocarlo, no después. */}
          {cantidad > 0 ? null : disp.agotado ? (
            <span className="prod__sello prod__sello--agotado">Agotado</span>
          ) : producto.tipo === "receta" ? (
            <span className="prod__sello">Receta</span>
          ) : null}


          <span className="prod__nombre">{producto.nombre}</span>

          <span className="prod__fila">
            <span className="prod__precio">{formatearMonto(producto.precioVenta)}</span>
            {!disp.agotado && (
              <span className={"prod__stock" + (disp.stock <= STOCK_BAJO ? " prod__stock--bajo" : "")}>
                {disp.stock <= STOCK_BAJO ? `quedan ${disp.stock}` : `${disp.stock} u`}
              </span>
            )}
          </span>

          {disp.agotado && disp.motivo && <span className="prod__motivo">{disp.motivo}</span>}
        </button>

        {/* Sin botón de "+": la tarjeta entera hace eso, y era el que más
            espacio ocupaba en la insignia. Todo ese ancho se lo queda el "−",
            que ahora es la única forma de bajar y necesita un blanco de toque
            de dedo, no de puntero.
            A cantidad 1 el "−" pasa a ser "quitar": son dos acciones distintas
            y tienen que verse distintas, o nadie sabe que ese botón también
            elimina. */}
        {cantidad > 0 && (
          <div className="prod__cuenta">
            <button
              type="button"
              className={cantidad === 1 ? "es-quitar" : undefined}
              onClick={() => cambiar(producto, -1)}
              aria-label={cantidad === 1 ? `Quitar ${producto.nombre} del pedido` : "Quitar uno"}
              title={cantidad === 1 ? "Quitar del pedido" : "Quitar uno"}
            >
              {cantidad === 1 ? "🗑" : "−"}
            </button>
            <span>{cantidad}</span>
          </div>
        )}
      </div>
    );
  };

  const renglon = ({ producto, cantidad }) => (
    <div className="reng" key={producto._id}>
      <div className="reng__info">
        <span className="reng__nombre">{producto.nombre}</span>
        <span className="reng__unit">{formatearMonto(producto.precioVenta)} c/u</span>
      </div>
      <div className="paso-cant">
        <button
          type="button"
          className={cantidad === 1 ? "es-quitar" : undefined}
          onClick={() => cambiar(producto, -1)}
          aria-label={cantidad === 1 ? "Quitar del pedido" : "Quitar uno"}
        >
          {cantidad === 1 ? "🗑" : "−"}
        </button>
        <span>{cantidad}</span>
        <button type="button" onClick={() => cambiar(producto, 1)} aria-label="Agregar uno">+</button>
      </div>
      <div className="reng__sub">{formatearMonto(producto.precioVenta * cantidad)}</div>
    </div>
  );

  // El rótulo dice la verdad sobre lo que se está viendo: mientras el Top se
  // esté aprendiendo, no puede anunciarse como "los que más se venden".
  const bandaTexto = busqueda
    ? `${visibles.length} ${visibles.length === 1 ? "resultado" : "resultados"} para «${busqueda}»`
    : vista === VISTA_TOP
      ? aprendidos.length === 0
        ? "Sin ventas del último mes todavía"
        : aprendidos.length >= TOPE_TOP
          ? "Los que más se venden acá"
          : "Los más vendidos del último mes"
      : vista === VISTA_TODOS
        ? "Todo el inventario que se vende"
        : categoriaInfo(vista).label;

  return (
    <div className="sales-container">
      <Navbar>{controlesBarra}</Navbar>

      <div className="sales-cuerpo">
        <header className="sales-head">
          {/* El título solo aparece en escritorio. En el celular gastaba una fila
              entera para decir algo que el menú de arriba ya dice, y esa fila es
              una hilera de productos menos. */}
          <h1 className="sales-titulo">Ventas</h1>

          <div className={"chips-wrap" + (chipsNav.izq ? " hay-izq" : "") + (chipsNav.der ? " hay-der" : "")}>
            <div className="chips" ref={chipsRef} onScroll={medirChips} role="group" aria-label="Categorías">
              {chips.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="chip"
                  aria-pressed={!busqueda && vista === c.id}
                  onClick={(e) => {
                    setVista(c.id);
                    setBusqueda("");
                    e.currentTarget.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
                  }}
                >
                  {c.icono && <span aria-hidden="true">{c.icono}</span>}
                  {c.label}
                  <span className="chip__cuenta">{c.total}</span>
                </button>
              ))}
            </div>
            {chipsNav.desliza && (
              <div className="chips-riel" aria-hidden="true">
                <i style={{ width: `${chipsNav.ancho}%`, left: `${chipsNav.pos}%` }} />
              </div>
            )}
          </div>
        </header>

        <div className="sales-lista">
          {error ? (
            <div className="sales-error">
              <p>{error}</p>
              <button type="button" className="btn-principal" onClick={() => cargarProductos({ inicial: true })}>
                Volver a intentar
              </button>
            </div>
          ) : (
            <>
              <p className="banda">{bandaTexto}</p>

              {visibles.length === 0 ? (
                <div className="sales-vacio">
                  {busqueda ? (
                    <>
                      <p>Nada con «{busqueda}».</p>
                      <button type="button" className="btn-secundario" onClick={() => setBusqueda("")}>
                        Ver todo
                      </button>
                    </>
                  ) : (
                    <p>No hay productos para vender en esta categoría.</p>
                  )}
                </div>
              ) : (
                <>
                  <div className="parrilla">{mostrados.map(tarjeta)}</div>
                  {visibles.length > mostrados.length && (
                    <button type="button" className="ver-mas" onClick={() => setTope((t) => t + LOTE)}>
                      Ver más productos
                      <small>{mostrados.length} de {visibles.length}</small>
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>

      {/* La pista vive hasta el primer producto que alguien agregue en este
          aparato, y no vuelve nunca más. Antes se mostraba con el pedido vacío,
          o sea ANTES DE CADA VENTA: como el carrito se limpia al cobrar,
          reaparecía todo el día tapando una franja de tarjetas justo cuando el
          vendedor busca el primer producto del pedido siguiente. Enseñar está
          bien; repetirlo a quien ya aprendió es quitarle pantalla.
          De una línea y no de dos por lo mismo: mientras vive, que ocupe lo
          menos posible. */}
      {unidades === 0 && !paso && !loading && !pistaVista && (
        <div className="pista-barra">
          <b>Tocá un producto</b> y el pedido se arma acá
        </div>
      )}

      {unidades > 0 && !paso && (
        <div className="barra-pedido">
          <button type="button" className="barra-pedido__peek" onClick={() => setPaso("pedido")}>
            <small>{unidades === 1 ? "1 producto" : `${unidades} productos`}</small>
            <b>{formatearMonto(total)}</b>
          </button>
          <button type="button" className="btn-principal" onClick={abrirCobro}>
            Cobrar
          </button>
        </div>
      )}

      {/* La hoja se renderiza siempre. En móvil el CSS la esconde hasta que se
          abre; en escritorio es la columna fija del pedido, que tiene que estar
          a la vista desde el primer momento para que se entienda qué hace la
          derecha de la pantalla. */}
      {/* El velo también en "listo", para que el comprobante quede solo en la
          pantalla. Pero ahí no cierra al tocarlo: la venta recién cobrada no se
          descarta con un toque al aire. */}
      {paso && (
        <div
          className="velo"
          onClick={paso === "listo" ? undefined : () => setPaso(null)}
          aria-hidden="true"
        />
      )}

      <div
        className={
          "hoja" +
          (paso ? " hoja--abierta" : "") +
          (vistaPaso === "pedido" ? "" : " hoja--alta")
        }
        role={paso ? "dialog" : undefined}
        aria-label="Pedido"
      >
        <div className="hoja__agarre" aria-hidden="true"><i /></div>

        {vistaPaso === "pedido" && (
          <>
            <div className="hoja__head">
              <strong>Pedido{unidades > 0 ? ` · ${unidades}` : ""}</strong>
              {unidades > 0 && (
                <button type="button" className="enlace enlace--peligro" onClick={vaciar}>
                  Vaciar
                </button>
              )}
            </div>

            {unidades === 0 ? (
              <div className="hoja__cuerpo">
                <div className="hoja__vacio">
                  <b>Todavía no hay nada</b>
                  <span>Tocá un producto del catálogo y aparece acá.</span>
                </div>
              </div>
            ) : (
              <>
                <div className="hoja__cuerpo">{lineas.map(renglon)}</div>
                <div className="hoja__pie">
                  <div className="tot">
                    <span>Total</span>
                    <b>{formatearMonto(total)}</b>
                  </div>
                  <button type="button" className="btn-principal btn-ancho" onClick={abrirCobro}>
                    Cobrar {formatearMonto(total)}
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {vistaPaso === "cobro" && (
          <>
                <div className="hoja__head">
                  <strong>Confirmar venta</strong>
                  <button type="button" className="enlace" onClick={() => setPaso("pedido")}>
                    ‹ Volver al pedido
                  </button>
                </div>

                <div className="hoja__cuerpo">
                  {/* Repaso solo con nombres: se lee de un vistazo, sin fotos
                      que distraigan de lo que se está cobrando. */}
                  <div className="repaso">
                    {lineas.map(({ producto, cantidad }) => (
                      <div className="repaso__fila" key={producto._id}>
                        <span className="repaso__cant">{cantidad}×</span>
                        <span className="repaso__nombre">{producto.nombre}</span>
                        <span className="repaso__sub">{formatearMonto(producto.precioVenta * cantidad)}</span>
                      </div>
                    ))}
                  </div>

                  <p className="rotulo">Cómo paga</p>
                  <div className="pagos">
                    {/* Nada preseleccionado a propósito: hay que decirlo, para
                        que ninguna venta quede mal registrada por inercia. */}
                    <button
                      type="button"
                      className="pago"
                      aria-pressed={metodo === "efectivo"}
                      onClick={() => { setMetodo("efectivo"); setPagado(null); }}
                    >
                      <i aria-hidden="true">💵</i>
                      <b>Efectivo</b>
                      <small>Con vuelto</small>
                    </button>
                    <button
                      type="button"
                      className="pago"
                      aria-pressed={metodo === "sinpe"}
                      onClick={() => { setMetodo("sinpe"); setPagado(total); }}
                    >
                      <i aria-hidden="true">📱</i>
                      <b>SINPE</b>
                      <small>Monto exacto</small>
                    </button>
                  </div>

                  {metodo === "efectivo" && (
                    <>
                      <p className="rotulo">Con cuánto paga (opcional)</p>
                      <div className="billetes">
                        {opcionesPago.map((v, i) => (
                          <button
                            key={v}
                            type="button"
                            className="billete"
                            aria-pressed={pagado === v}
                            onClick={() => setPagado(v)}
                          >
                            {i === 0 ? "Exacto" : formatearMonto(v)}
                          </button>
                        ))}
                      </div>
                      {pagado != null ? (
                        <div className="vuelto">
                          <span>Vuelto</span>
                          <b>{formatearMonto(pagado - total)}</b>
                        </div>
                      ) : (
                        // Se dice lo que va a quedar registrado si nadie toca un
                        // monto, en vez de que el reporte lo cuente distinto de
                        // lo que pasó en el mostrador.
                        <p className="nota">
                          Tocá un monto y la pantalla saca el vuelto. Si no, se
                          registra como pago justo.
                        </p>
                      )}
                    </>
                  )}

                  {metodo === "sinpe" && (
                    <p className="nota">
                      Se registra por el monto exacto, sin vuelto. Confirmá que llegó el
                      comprobante antes de cobrar.
                    </p>
                  )}
                </div>

                <div className="hoja__pie">
                  <div className="tot">
                    <span>{unidades === 1 ? "1 producto" : `${unidades} productos`}</span>
                    <b>{formatearMonto(total)}</b>
                  </div>
                  <button
                    type="button"
                    className="btn-principal btn-ancho"
                    onClick={procesarVenta}
                    disabled={!listoParaCobrar || cobrando}
                  >
                    {cobrando ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" />
                        Registrando…
                      </>
                    ) : metodo ? (
                      "Registrar venta"
                    ) : (
                      "Elegí cómo paga"
                    )}
                  </button>
                </div>
              </>
            )}

        {vistaPaso === "listo" && recibo && (
          <>
                <div className="hoja__cuerpo">
                  <div className="listo">
                    <div className="listo__marca" aria-hidden="true">✅</div>
                    <h2>Venta registrada</h2>
                    <p>{recibo.metodo === "sinpe" ? "SINPE Móvil" : "Efectivo"}</p>
                  </div>

                  <div className="listo__celdas">
                    <div className="celda celda--acento">
                      <small>Total</small>
                      <b>{formatearMonto(recibo.total)}</b>
                    </div>
                    {recibo.metodo === "efectivo" ? (
                      <div className="celda celda--vuelto">
                        <small>Vuelto</small>
                        <b>{formatearMonto(recibo.vuelto)}</b>
                      </div>
                    ) : (
                      <div className="celda">
                        <small>Recibido</small>
                        <b>{formatearMonto(recibo.montoPagado)}</b>
                      </div>
                    )}
                  </div>

                  <p className="rotulo">Se vendió</p>
                  <div className="repaso">
                    {recibo.lineas.map((l, i) => (
                      <div className="repaso__fila" key={i}>
                        <span className="repaso__cant">{l.cantidad}×</span>
                        <span className="repaso__nombre">{l.nombre}</span>
                        <span className="repaso__sub">{formatearMonto(l.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="hoja__pie">
                  <button
                    type="button"
                    className="btn-principal btn-ancho"
                    onClick={() => { setPaso(null); setRecibo(null); }}
                  >
                    Nueva venta
                  </button>
                </div>
              </>
            )}
        </div>
      </div>

      {aviso && (
        <div className={"aviso aviso--" + aviso.tono} role="status">
          <div className="aviso__texto">
            <strong>{aviso.titulo}</strong>
            {aviso.detalle && <p>{aviso.detalle}</p>}
          </div>
          <button type="button" className="aviso__cerrar" onClick={() => setAviso(null)} aria-label="Cerrar aviso">
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

export default SalesDashboard;
