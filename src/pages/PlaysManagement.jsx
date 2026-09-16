// src/pages/PlaysManagement.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import "../styles/PlaysManagement.css";
import Navbar from "../components/NavBar2";

const API_URL = import.meta.env.VITE_API_URL;

let axiosModule = null;
const getAxios = async () => {
  if (!axiosModule) axiosModule = await import("axios");
  return axiosModule.default;
};

const LUGARES_JUEGO = [
  "Play 4 número 1",
  "Play 4 número 2",
  "Play 4 número 3",
  "Play 5 número 1",
  "Play 5 número 2",
  "Play 5 número 3",
  "Ping Pong",
];

const JUEGOS_DISPONIBLES = [
  "Dragon Ball Sparking Zero",
  "FIFA 26",
  "Call of Duty 3",
  "Call of Duty 4",
  "Call of Duty 6",
  "Mortal Kombat 1",
  "Mortal Kombat 11",
  "Mortal Kombat XL",
  "Gran turismo Sport",
  "Gran turismo 7",
  "Kimetsu no Yaiba",
  "Naruto Shippuden",
  "NBA 2K24",
  "GTA V",
  "Minecraft",
  "Fortnite",
  "Rocket League",
  "EA Sports FC",
  "Resident Evil",
  "Spider-Man 2",
  "God of War Ragnarök",
  "Days Gone",
  "Dead Cells",
  "Crash",
  "Stick Fight",
  "Oddballers",
  "Call of Duty Modern Warfare 3",
  "Spider-Man Miles Morales",
  "Naruto to Boruto",
  "FIFA 25",
  "Jurassic World 2",
  "Roblox",
  "World War Z Aftermath",
  "Assetto Corsa",
  "Call of Duty Warzone",
  "Overcooked",
  "Efootball",
  "Minecraft Dungeons",
  "Rayman Legends",
  "Assassin's Creed Valhalla",
  "The Last of Us",
  "God of War",
  "Fall Guys",
  "Sackboy",
  "Need for Speed Heat",
  "Star Wars Jedi",
  "Minecraft Legends",
  "Uncharted 4",
  "Call of Duty 2",
];

// Estados de pago. Se quitó "En Proceso": ahora es obligatorio elegir
// Completado o Pendiente (arranca vacío para que se seleccione a propósito).
const ESTADOS_PAGO = ["Completado", "Pendiente"];

// Orden visual de los campos obligatorios (para saltar al primero que falte).
const CAMPOS_ORDEN = [
  "cliente", "lugarDeJuego", "juegosJugados", "tiempo",
  "horaInicio", "totalControles", "estadoPago",
];

// Punto como separador de miles (estándar de Costa Rica): 1.234
const fmtMiles = (n) => Math.round(n || 0).toLocaleString("es-CR").replace(/\s/g, ".");

// En Ping Pong no hay consola: no se elige juego jugado ni controles.
const esPingPong = (lugar) => lugar === "Ping Pong";

// Precio por hora según el lugar de juego
const precioPorHora = (lugar) => {
  if (!lugar) return 0;
  if (lugar.includes("Play 5")) return 1000;
  if (lugar.includes("Play 4")) return 800;
  if (lugar === "Ping Pong") return 800;
  return 0;
};

// ✅ Constante fuera del componente para que useEffect no la detecte como cambio
const FILTROS_VACIOS = {
  soloPendiente: false,
  minPendienteHoras: "",
  minPendienteMinutos: "",
};

const obtenerUsuarioLogueado = () => {
  try {
    const userString = localStorage.getItem("user");
    if (userString) {
      const user = JSON.parse(userString);
      return user.nombre || user.name || "";
    }
    return "";
  } catch {
    return "";
  }
};

const sumarMinutosAHora = (horaInicio, minutosASumar) => {
  if (!horaInicio) return "";
  const [h, m] = horaInicio.split(":").map(Number);
  const total = h * 60 + m + minutosASumar;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

const obtenerHoraActual12h = () => {
  const ahora = new Date();
  let h = ahora.getHours();
  const m = ahora.getMinutes();
  const p = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} ${p}`;
};

// El turno de tiempo pendiente de un play, SOLO si todavia no vencio.
//
// Quien lo cierra de verdad es el backend, al leer la lista. Pero si la
// pantalla se queda abierta nadie vuelve a leer, y el registro seguiria
// diciendo "corriendo" con la hora de fin ya pasada. Con esto la pantalla deja
// de mostrarlo apenas vence, sin esperar la respuesta del servidor.
const turnoCorriendo = (play) => {
  const t = play?.pendienteEnCurso;
  if (!t?.fin) return null;
  return new Date(t.fin).getTime() > Date.now() ? t : null;
};

// Instante -> "4:55 PM". Lo usa el turno de tiempo pendiente, que guarda un
// Date real (no el string "HH:MM" del resto de la pantalla). El navegador del
// local esta en Costa Rica, asi que la hora local ya es la correcta.
const horaDeInstante = (fecha) => {
  if (!fecha) return "";
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("es-CR", { hour: "numeric", minute: "2-digit", hour12: true });
};

const convertirA12Horas = (hora24) => {
  if (!hora24) return "";
  const [h, m] = hora24.split(":").map(Number);
  const p = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${p}`;
};

// Convierte texto libre a formato 24h "HH:MM". Devuelve "" si no es válido.
// Acepta: "2:10 PM", "2:10pm", "2:10 p.m.", "2:10 P. M." y también 24h "14:10".
const convertir12hA24h = (hora12) => {
  if (!hora12) return "";
  const txt = String(hora12).trim();
  // Formato 12h con meridiano (AM/PM, con o sin puntos/espacios)
  const m12 = txt.match(/^(\d{1,2}):(\d{2})\s*([ap])\.?\s*m\.?$/i);
  if (m12) {
    let h = parseInt(m12[1]);
    const m = m12[2];
    const esPM = m12[3].toLowerCase() === "p";
    if (h < 1 || h > 12 || parseInt(m) > 59) return "";
    if (esPM && h !== 12) h += 12;
    else if (!esPM && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${m}`;
  }
  // Formato 24h "HH:MM" — solo si es inequívoco (00 o 13-23). Para 1-12 sin
  // AM/PM es ambiguo, así que se rechaza y se obliga a indicar AM o PM.
  const m24 = txt.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    const h = parseInt(m24[1]);
    if (h > 23 || parseInt(m24[2]) > 59) return "";
    if (h === 0 || h >= 13) return `${String(h).padStart(2, "0")}:${m24[2]}`;
    return "";
  }
  return "";
};

// Distancia en minutos entre dos momentos del día (circular, considera medianoche)
const distanciaMinutos = (a, b) => {
  const d = Math.abs(a - b);
  return Math.min(d, 1440 - d);
};

// Cuando el usuario escribe una hora ambigua (1-12 sin AM/PM), el sistema
// decide AM o PM eligiendo la opción MÁS CERCANA a la hora actual.
const inferirMeridiano = (h12, min) => {
  const ahora = new Date();
  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
  const versionAM = (h12 % 12) * 60 + min;
  const versionPM = ((h12 % 12) + 12) * 60 + min;
  return distanciaMinutos(minutosAhora, versionPM) <=
    distanciaMinutos(minutosAhora, versionAM)
    ? "PM"
    : "AM";
};

// Resuelve el texto libre del campo a formato canónico "2:10 PM".
// Si falta AM/PM, el sistema lo decide solo. Devuelve "" solo si es basura.
const resolverHora12h = (texto) => {
  const hora24 = convertir12hA24h(texto);
  if (hora24) return convertirA12Horas(hora24);
  // Hora ambigua "H:MM" (1-12) sin meridiano → inferir AM/PM
  const m = String(texto || "")
    .trim()
    .match(/^(\d{1,2}):(\d{2})$/);
  if (m) {
    const h = parseInt(m[1]);
    const min = parseInt(m[2]);
    if (h >= 1 && h <= 12 && min <= 59) {
      return `${h}:${m[2]} ${inferirMeridiano(h, min)}`;
    }
  }
  return "";
};

const PlaysManagement = () => {
  const [plays, setPlays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const formularioRef = useRef(null);
  const [editando, setEditando] = useState(null);
  // Turno de tiempo pendiente: poner a correr tiempo que el cliente ya pago y no
  // uso. No cobra nada ni crea una sesion (ver el backend), asi que no toca
  // reportes. `turnoIniciar` es el modal de arrancar; `turnoDetener`, el de
  // cortarlo antes de tiempo.
  const [turnoIniciar, setTurnoIniciar] = useState(null);   // { play, horas, minutos }
  const [turnoDetener, setTurnoDetener] = useState(null);   // { play, jugados }
  const [turnoGuardando, setTurnoGuardando] = useState(false);
  // Doble toque en "Guardar": el boton no tenia ningun freno, y dos toques
  // seguidos creaban DOS registros.
  //
  // Van los dos juntos y no uno solo a proposito:
  //  - el REF es el cerrojo de verdad. Cambia en el acto, asi que el segundo
  //    toque lo ve puesto aunque llegue en el mismo tick. Con solo el estado no
  //    alcanza: setState no actualiza la variable al instante y dos toques
  //    rapidos pueden entrar los dos antes de que React vuelva a pintar.
  //  - el ESTADO es para que se vea: apaga el boton y le cambia el texto.
  const guardandoRef = useRef(false);
  // Foto del cobro tal como estaba al ABRIR una edición. Sirve para no
  // recalcular el monto cuando la edición no tocó nada que lo afecte: ver
  // `cobroIntacto`. null = no estamos editando.
  //
  // Es estado y no ref a propósito: el Resumen de Cobro tiene que mostrar este
  // monto, y un ref no vuelve a pintar. Con un ref, la pantalla mostraba el
  // monto recalculado (₡667) mientras se guardaba el conservado (₡700).
  const [cobroOriginal, setCobroOriginal] = useState(null);
  const [guardandoPlay, setGuardandoPlay] = useState(false);
  const [mostrarNotificacion, setMostrarNotificacion] = useState(false);
  const [notificacion, setNotificacion] = useState(null);
  // ✅ Marca si el usuario escribió la Hora Inicio a mano (para no sobrescribirla)
  const [horaInicioManual, setHoraInicioManual] = useState(false);

  // filtros: lo que el usuario está escribiendo en el panel (NO dispara fetch)
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  // filtrosAplicados: los que están realmente activos (se actualizan solo al hacer clic en Buscar)
  const [filtrosAplicados, setFiltrosAplicados] = useState(FILTROS_VACIOS);

  // Búsqueda por nombre de cliente. `busqueda` es lo que se está tecleando;
  // `busquedaAplicada` es la que ya viajó al servidor (se sincronizan con un
  // debounce de 300 ms). `busquedaServidor` es el texto que el backend dice
  // haber usado, para el cartel de "N resultados para «jose»".
  const [busqueda, setBusqueda] = useState("");
  const [busquedaAplicada, setBusquedaAplicada] = useState("");
  const [busquedaServidor, setBusquedaServidor] = useState(null);
  // La pantalla completa de carga solo se muestra la primera vez. Después, la
  // lista anterior se queda atenuada mientras llega la nueva.
  const [primeraCarga, setPrimeraCarga] = useState(true);
  // Los campos de "pendiente mínimo" viven plegados: se abren solo si se piden.
  const [mostrarMinimo, setMostrarMinimo] = useState(false);

  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split("T")[0],
    cliente: "",
    atendio: obtenerUsuarioLogueado(),
    tiempoPagado: 0,
    tiempoPendiente: 0,
    horaInicio: obtenerHoraActual12h(),
    horaFinal: "",
    lugarDeJuego: "",
    juegosJugados: [],
    totalControles: "",
    estadoPago: "",
  });

  // Errores de validación por campo (para marcar en rojo y mostrar dónde falta)
  const [errores, setErrores] = useState({});

  const [tiempoPagadoInput, setTiempoPagadoInput] = useState({
    horas: "",
    minutos: "",
  });
  const [tiempoPendienteInput, setTiempoPendienteInput] = useState({
    horas: "",
    minutos: "",
  });
  // Modo de registro: "tiempo" (calcula monto desde el tiempo) o
  // "monto" (calcula el tiempo desde el monto recibido, guardando el monto exacto)
  const [modoRegistro, setModoRegistro] = useState("tiempo");
  const [montoInput, setMontoInput] = useState("");
  const [paginacion, setPaginacion] = useState({
    page: 1,
    limit: 5,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });

  // Contador de peticiones: al teclear rápido pueden quedar dos consultas en
  // vuelo y contestar en desorden. Solo la última pintada manda.
  const peticionRef = useRef(0);

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem("token");
    return { headers: { Authorization: `Bearer ${token}` } };
  }, []);

  const calcularCostos = useCallback(
    (lugarDeJuego, tiempoPagado, totalControles) => {
      if (!lugarDeJuego || !tiempoPagado)
        return { subtotal: 0, costoControles: 0, total: 0 };
      const pph = precioPorHora(lugarDeJuego);
      const subtotal = Math.round((tiempoPagado / 60) * pph);
      // Los 2 primeros controles son gratis; del 3.º en adelante ₡200 c/u.
      const controlesPagados = Math.max(0, (totalControles || 0) - 2);
      const costoControles = controlesPagados * 200;
      return { subtotal, costoControles, total: subtotal + costoControles };
    },
    [],
  );

  // Controles totales de un play para mostrar en la lista
  // (compatibilidad con registros viejos que solo tenían controlAdicional)
  const controlesDe = (play) =>
    play.totalControles ??
    ((play.controlAdicional || 0) > 0 ? play.controlAdicional + 2 : 0);

  useEffect(() => {
    if (formData.horaInicio && formData.tiempoPagado > 0) {
      const hora24 = convertir12hA24h(resolverHora12h(formData.horaInicio));
      if (hora24) {
        setFormData((prev) => ({
          ...prev,
          horaFinal: convertirA12Horas(
            sumarMinutosAHora(hora24, formData.tiempoPagado),
          ),
        }));
      }
    }
  }, [formData.horaInicio, formData.tiempoPagado]);

  // En modo "monto": el monto ingresado es el pago por el TIEMPO. Los controles
  // se cobran aparte (se suman al total). Convertimos el monto a minutos según
  // ₡/hora del lugar, redondeando a múltiplos de 5 min.
  useEffect(() => {
    if (modoRegistro !== "monto") return;
    const monto = Number(montoInput) || 0;
    const pph = precioPorHora(formData.lugarDeJuego);
    if (!pph || !monto) {
      setTiempoPagadoInput({ horas: "", minutos: "" });
      setFormData((prev) => ({ ...prev, tiempoPagado: 0 }));
      return;
    }
    let min = Math.round((monto / pph) * 60);
    min = Math.round(min / 5) * 5; // múltiplos de 5 min
    setTiempoPagadoInput({ horas: Math.floor(min / 60) || "", minutos: min % 60 });
    setFormData((prev) => ({ ...prev, tiempoPagado: min }));
  }, [modoRegistro, montoInput, formData.lugarDeJuego]);

  // ✅ Mientras el formulario de NUEVO registro esté abierto, refresca la
  //    Hora Inicio cada 15s a la hora actual, salvo que el usuario la haya
  //    escrito a mano. Así nunca queda congelada aunque pase mucho rato.
  useEffect(() => {
    if (!mostrarFormulario || editando || horaInicioManual) return;
    const intervalo = setInterval(() => {
      setFormData((prev) => ({ ...prev, horaInicio: obtenerHoraActual12h() }));
    }, 15000);
    return () => clearInterval(intervalo);
  }, [mostrarFormulario, editando, horaInicioManual]);

  // ✅ Al abrir el formulario (nuevo o al editar) lo llevamos a la vista, para
  //    que el usuario no tenga que subir a mano cuando edita desde la lista.
  useEffect(() => {
    if (mostrarFormulario && formularioRef.current) {
      formularioRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [mostrarFormulario, editando]);

  // ✅ fetchPlays NO tiene filtros en sus dependencias
  //    Siempre recibe filtrosActuales como parámetro → tipear en el panel no recarga nada
  const fetchPlays = useCallback(
    async (page = 1, filtrosActuales = FILTROS_VACIOS, textoBusqueda = "") => {
      const idPeticion = ++peticionRef.current;
      setLoading(true);
      try {
        const axios = await getAxios();
        const params = new URLSearchParams({ page, limit: 5 });

        // Solo espacios equivale a no buscar: el backend ignora el filtro, así
        // que ni lo mandamos.
        const cliente = (textoBusqueda || "").trim();
        if (cliente) params.append("cliente", cliente);

        if (filtrosActuales.soloPendiente) {
          params.append("soloPendiente", "true");
        } else {
          const h = parseInt(filtrosActuales.minPendienteHoras) || 0;
          const m = parseInt(filtrosActuales.minPendienteMinutos) || 0;
          const totalMin = h * 60 + m;
          if (totalMin > 0) params.append("minPendiente", totalMin);
        }

        const response = await axios.get(
          `${API_URL}/api/plays?${params.toString()}`,
          getAuthHeaders(),
        );
        // Si mientras tanto salió otra consulta, esta ya no sirve.
        if (idPeticion !== peticionRef.current) return;
        setPlays(response.data.data || []);
        setBusquedaServidor(response.data.busqueda ?? null);
        setPaginacion(
          response.data.pagination || {
            page: 1,
            limit: 5,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
        );
      } catch (error) {
        if (idPeticion !== peticionRef.current) return;
        console.error("❌ Error al cargar plays:", error);
        let mensajeError = "Error al cargar los registros";
        let detalle = "";
        if (error.response) {
          mensajeError = error.response.data?.message || mensajeError;
          detalle = error.response.data?.error || "";
        } else if (error.request) {
          mensajeError = "No se pudo conectar con el servidor";
          detalle = "Verifica que el backend esté corriendo";
        } else {
          detalle = error.message;
        }
        mostrarNotif(mensajeError, "error", detalle);
      } finally {
        // La consulta vieja no apaga el "cargando" de la nueva.
        if (idPeticion === peticionRef.current) {
          setLoading(false);
          setPrimeraCarga(false);
        }
      }
    },
    [getAuthHeaders],
  ); // ✅ filtros NO está aquí

  // Carga inicial sin filtros
  useEffect(() => {
    fetchPlays(1, FILTROS_VACIOS);
    document.title = "Gestión de Plays - Sala de Juegos Ruiz";
  }, [fetchPlays]);

  // Debounce de la búsqueda: espera 300 ms sin teclas antes de consultar, para
  // no pegarle al servidor en cada letra. Siempre vuelve a la página 1: la
  // página en la que estaba puede no existir dentro del resultado filtrado.
  useEffect(() => {
    const temporizador = setTimeout(() => {
      const limpio = busqueda.trim();
      if (limpio === busquedaAplicada) return;
      setBusquedaAplicada(limpio);
      fetchPlays(1, filtrosAplicados, limpio);
    }, 300);
    return () => clearTimeout(temporizador);
  }, [busqueda, busquedaAplicada, filtrosAplicados, fetchPlays]);

  const mostrarNotif = (mensaje, tipo = "success", detalle = "") => {
    setNotificacion({ mensaje, tipo, detalle });
    setMostrarNotificacion(true);
    setTimeout(() => setMostrarNotificacion(false), 5000);
  };

  // ✅ Solo al hacer clic en Buscar se aplican los filtros
  const aplicarFiltros = () => {
    setFiltrosAplicados(filtros);
    fetchPlays(1, filtros, busquedaAplicada);
  };

  // ✅ Limpiar: resetea el panel de pendientes (la búsqueda por nombre tiene
  //    su propio botón ✕, así que no se toca acá)
  const limpiarFiltros = () => {
    setFiltros(FILTROS_VACIOS);
    setFiltrosAplicados(FILTROS_VACIOS);
    fetchPlays(1, FILTROS_VACIOS, busquedaAplicada);
  };

  // Limpiar la búsqueda por nombre: vuelve a la lista completa, página 1.
  const limpiarBusqueda = () => {
    setBusqueda("");
    setBusquedaAplicada("");
    fetchPlays(1, filtrosAplicados, "");
  };

  const hayFiltroActivo =
    filtrosAplicados.soloPendiente ||
    filtrosAplicados.minPendienteHoras !== "" ||
    filtrosAplicados.minPendienteMinutos !== "";

  const hayAlgoEscrito =
    filtros.soloPendiente ||
    filtros.minPendienteHoras !== "" ||
    filtros.minPendienteMinutos !== "";

  // Minutos del filtro de pendiente mínimo que están realmente aplicados
  // (0 si no hay ninguno). Sirve para el texto del chip y el de estado.
  const minimoAplicado =
    (parseInt(filtrosAplicados.minPendienteHoras) || 0) * 60 +
    (parseInt(filtrosAplicados.minPendienteMinutos) || 0);

  // Valores para el "Resumen de Cobro" (funciona en ambos modos: tiempo y monto).
  // El costo de controles es independiente del tiempo (los 2 primeros gratis) y
  // SIEMPRE se suma aparte. En modo monto el subtotal de tiempo es el monto
  // ingresado; en modo tiempo se calcula desde el tiempo.
  // Ping Pong no lleva juego jugado ni controles: esos campos se ocultan.
  const pingPong = esPingPong(formData.lugarDeJuego);

  // ¿La edición dejó intacto lo que se cobró por el TIEMPO?
  //
  // Si no se tocó ni el tiempo ni el lugar, lo cobrado por el tiempo se conserva
  // tal cual y sólo se le vuelven a sumar los controles (que sí pueden haber
  // cambiado). Recalcularlo desde el tiempo lo movería, porque un play cobrado
  // por monto guarda el tiempo redondeado a múltiplos de 5 min y volver atrás no
  // devuelve el mismo número (₡700 en un Play 5 → 40 min → ₡667).
  //
  // Se calcula acá, en el render, para que el Resumen de Cobro y el guardado
  // salgan del MISMO número. Si se calculara sólo al guardar, la pantalla
  // mostraría una cosa y se grabaría otra.
  //
  // Sólo aplica en modo "tiempo", que es como se abre toda edición. Si el
  // usuario cambió a modo monto a mano, quiso escribir un monto nuevo y ese
  // manda (cambiarModo ya limpió esta foto).
  const cobroIntacto = Boolean(
    editando &&
      modoRegistro === "tiempo" &&
      cobroOriginal &&
      cobroOriginal.tiempoPagado === formData.tiempoPagado &&
      cobroOriginal.lugarDeJuego === formData.lugarDeJuego,
  );

  const controlesPagadosUI = pingPong
    ? 0
    : Math.max(0, (Number(formData.totalControles) || 0) - 2);
  const costoControlesUI = controlesPagadosUI * 200;
  // Lo que se cobra por el TIEMPO (sin controles). Se calcula acá en el render,
  // no en un useEffect, para que nunca vaya un paso atrás de lo que se ve.
  const subtotalTiempoUI =
    modoRegistro === "monto"
      ? Number(montoInput) || 0
      : cobroIntacto
        ? cobroOriginal.montoTiempo
        : calcularCostos(
            formData.lugarDeJuego,
            formData.tiempoPagado,
            formData.totalControles,
          ).subtotal;

  // ESTE es el número que se muestra Y el que se guarda. Uno solo, para que no
  // puedan discrepar (antes la pantalla mostraba ₡667 y se grababa ₡700).
  const montoFinalUI = subtotalTiempoUI + costoControlesUI;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    // Si el usuario escribe la Hora Inicio, dejamos de refrescarla automáticamente
    if (name === "horaInicio") setHoraInicioManual(true);
    setFormData((prev) => {
      const sig = {
        ...prev,
        [name]:
          name === "totalControles" ? (value ? Number(value) : "") : value,
      };
      // Ping Pong no usa consola: se descartan juegos y controles elegidos antes.
      if (name === "lugarDeJuego" && esPingPong(value)) {
        sig.juegosJugados = [];
        sig.totalControles = "";
      }
      return sig;
    });
    setErrores((er) => {
      if (name === "lugarDeJuego" && esPingPong(value)) {
        return { ...er, [name]: "", juegosJugados: "", totalControles: "" };
      }
      return er[name] ? { ...er, [name]: "" } : er;
    });
  };

  // ✅ Al salir del campo Hora Inicio, lo dejamos en formato canónico "2:10 PM"
  //    si es interpretable (acepta 24h, con/sin puntos, minúsculas, etc.)
  const normalizarHoraInicio = () => {
    const canonica = resolverHora12h(formData.horaInicio);
    if (canonica) {
      setFormData((prev) => ({ ...prev, horaInicio: canonica }));
    }
  };

  // Cambiar de modo es cambiar CÓMO se escribe el cobro, no cuánto es. El total
  // tiene que quedar igual: se arrastra el valor de un modo al otro.
  //
  // Antes esto vaciaba el monto y ponía el tiempo en 0, así que apenas tocabas
  // el botón el cobro final caía a ₡0 y había que volver a escribir todo.
  const cambiarModo = (modo) => {
    if (modo === modoRegistro) return;
    if (modo === "monto") {
      // Lo que ya se cobra por el tiempo pasa al campo de monto. Vacío sólo si
      // todavía no hay nada que cobrar (formulario recién abierto).
      setMontoInput(subtotalTiempoUI > 0 ? String(subtotalTiempoUI) : "");
    } else {
      // Volviendo a tiempo: el tiempo ya está derivado del monto y se conserva,
      // así que el total se sostiene solo. El campo de monto deja de aplicar.
      setMontoInput("");
    }
    setModoRegistro(modo);
    // Ojo: NO se limpia cobroOriginal. Si la vuelta deja el tiempo y el lugar
    // como estaban, el monto original sigue valiendo y el total vuelve a ser el
    // mismo; y si el tiempo cambió, `cobroIntacto` da false solo y se recalcula.
  };

  const handleTiempoPagadoChange = (tipo, valor) => {
    const v = valor === "" ? "" : Math.max(0, parseInt(valor) || 0);
    const t = {
      ...tiempoPagadoInput,
      [tipo]:
        tipo === "horas"
          ? v === ""
            ? ""
            : Math.min(v, 12)
          : v === ""
            ? ""
            : Math.min(v, 59),
    };
    setTiempoPagadoInput(t);
    setFormData((prev) => ({
      ...prev,
      tiempoPagado:
        (t.horas === "" ? 0 : t.horas) * 60 +
        (t.minutos === "" ? 0 : t.minutos),
    }));
    setErrores((er) => (er.tiempo ? { ...er, tiempo: "" } : er));
  };

  const handleTiempoPendienteChange = (tipo, valor) => {
    if (!editando) return;
    const v = valor === "" ? "" : Math.max(0, parseInt(valor) || 0);
    const t = {
      ...tiempoPendienteInput,
      [tipo]:
        tipo === "horas"
          ? v === ""
            ? ""
            : Math.min(v, 12)
          : v === ""
            ? ""
            : Math.min(v, 59),
    };
    setTiempoPendienteInput(t);
    setFormData((prev) => ({
      ...prev,
      tiempoPendiente:
        (t.horas === "" ? 0 : t.horas) * 60 +
        (t.minutos === "" ? 0 : t.minutos),
    }));
  };

  const handleJuegoChange = (e) => {
    const sel = Array.from(e.target.selectedOptions, (o) => o.value);
    if (sel.length > 2) {
      mostrarNotif("Solo puedes seleccionar hasta 2 juegos", "warning");
      return;
    }
    setFormData((prev) => ({ ...prev, juegosJugados: sel }));
    setErrores((er) => (er.juegosJugados ? { ...er, juegosJugados: "" } : er));
  };

  // ✅ Abre el formulario de nuevo registro refrescando la hora de inicio
  //    a la hora ACTUAL (evita que quede congelada si la app estuvo inactiva)
  const abrirFormularioNuevo = () => {
    setHoraInicioManual(false);
    setFormData((prev) => ({
      ...prev,
      horaInicio: obtenerHoraActual12h(),
    }));
    setMostrarFormulario(true);
  };

  const limpiarFormulario = () => {
    setFormData({
      cliente: "",
      atendio: obtenerUsuarioLogueado(),
      tiempoPagado: 0,
      tiempoPendiente: 0,
      horaInicio: obtenerHoraActual12h(),
      horaFinal: "",
      lugarDeJuego: "",
      juegosJugados: [],
      totalControles: "",
      estadoPago: "",
    });
    setErrores({});
    setTiempoPagadoInput({ horas: "", minutos: "" });
    setTiempoPendienteInput({ horas: "", minutos: "" });
    setDesgloseCostos({ subtotal: 0, costoControles: 0, total: 0 });
    setCobroOriginal(null);   // formulario limpio: no hay cobro que conservar
    setModoRegistro("tiempo");
    setMontoInput("");
    setEditando(null);
    setHoraInicioManual(false);
    setMostrarFormulario(false);
  };

  // Valida los campos obligatorios y devuelve un objeto { campo: mensaje }.
  const validarFormulario = () => {
    const err = {};
    if (!formData.cliente?.trim()) err.cliente = "Escribí el nombre del cliente";
    if (!formData.lugarDeJuego) err.lugarDeJuego = "Elegí el lugar de juego";
    if (!esPingPong(formData.lugarDeJuego) && formData.juegosJugados.length === 0)
      err.juegosJugados = "Elegí al menos 1 juego";
    if (!formData.tiempoPagado) {
      err.tiempo = modoRegistro === "monto"
        ? "Ingresá el monto cobrado por el tiempo"
        : "Ingresá el tiempo pagado";
    }
    if (!formData.horaInicio) err.horaInicio = "Ingresá la hora de inicio";
    if (!esPingPong(formData.lugarDeJuego) && !formData.totalControles)
      err.totalControles = "Elegí la cantidad de controles";
    if (!formData.estadoPago) err.estadoPago = "Elegí el estado del pago";
    return err;
  };

  const handleSubmit = async (e) => {
    // Cerrojo contra el doble toque. Va ANTES que todo y sobre el ref, no
    // sobre el estado, porque el ref ya esta puesto cuando entra el segundo
    // toque. Sirve igual para crear y para actualizar: los dos pasan por aca.
    if (guardandoRef.current) return;
    e.preventDefault();
    const err = validarFormulario();
    if (Object.keys(err).length > 0) {
      setErrores(err);
      // Ir al primer campo que falta (en orden visual) y enfocarlo.
      const primero = CAMPOS_ORDEN.find((k) => err[k]);
      const cont = primero && document.getElementById(`campo-${primero}`);
      if (cont) {
        cont.scrollIntoView({ behavior: "smooth", block: "center" });
        cont.querySelector("input, select, textarea")?.focus({ preventScroll: true });
      }
      mostrarNotif(
        "Faltan datos por completar — te llevé al primero que falta",
        "warning",
      );
      return;
    }
    setErrores({});
    // ✅ Resolver la hora de inicio (el sistema infiere AM/PM si falta) y
    //    recalcular la hora final desde ahí, por si se guarda sin salir del campo.
    const horaInicio24 = convertir12hA24h(resolverHora12h(formData.horaInicio));
    if (!horaInicio24) {
      mostrarNotif(
        "La hora de inicio no es válida",
        "warning",
        "Escribí una hora como 2:10 (el sistema pone AM/PM) o 2:10 PM.",
      );
      return;
    }
    const horaFinal24 =
      formData.tiempoPagado > 0
        ? sumarMinutosAHora(horaInicio24, formData.tiempoPagado)
        : convertir12hA24h(formData.horaFinal);
    guardandoRef.current = true;
    setGuardandoPlay(true);
    try {
      const axios = await getAxios();
      // Ping Pong no usa controles: se guardan 0 (no se usó ninguno).
      const totalControlesAEnviar = esPingPong(formData.lugarDeJuego)
        ? 0
        : formData.totalControles;
      // Los 2 primeros controles son gratis; del 3.º en adelante ₡200 c/u.
      const controlesPagados = Math.max(0, totalControlesAEnviar - 2);
      // Se guarda EXACTAMENTE el número que el usuario está viendo en el
      // Resumen de Cobro. No se recalcula acá: cualquier cuenta paralela vuelve
      // a abrir la puerta a que la pantalla diga una cosa y se grabe otra.
      // `montoFinalUI` ya contempla los tres casos (monto escrito a mano, monto
      // conservado de la edición, y cálculo por tiempo) más los controles.
      const montoPagado = montoFinalUI;
      const datosAEnviar = {
        cliente: formData.cliente,
        atendio: formData.atendio,
        tiempoPagado: formData.tiempoPagado,
        tiempoPendiente: formData.tiempoPendiente,
        horaInicio: horaInicio24,
        horaFinal: horaFinal24,
        lugarDeJuego: formData.lugarDeJuego,
        juegosJugados: esPingPong(formData.lugarDeJuego)
          ? []
          : formData.juegosJugados,
        totalControles: totalControlesAEnviar, // total de controles usados (1-4)
        controlAdicional: controlesPagados,       // controles pagados (compat. costo/reportes)
        montoPagado,                              // monto real cobrado (fuente de verdad del ingreso)
        // Si la edición no tocó el cobro, el play sigue registrado como estaba:
        // se omite el campo para no pisar la marca original con "tiempo", que es
        // como se abre toda edición. El backend conserva la que ya tenía.
        ...(cobroIntacto ? {} : { modoRegistro }),
        estadoPago: formData.estadoPago,
      };
      if (editando) {
        await axios.put(
          `${API_URL}/api/plays/${editando}`,
          datosAEnviar,
          getAuthHeaders(),
        );
        mostrarNotif("Play actualizado exitosamente", "success");
      } else {
        await axios.post(
          `${API_URL}/api/plays`,
          datosAEnviar,
          getAuthHeaders(),
        );
        mostrarNotif("Play registrado exitosamente", "success");
      }
      limpiarFormulario();
      fetchPlays(paginacion.page, filtrosAplicados, busquedaAplicada);
    } catch (error) {
      console.error("❌ Error:", error);
      let mensajeError = "Error al guardar el play";
      let detalle = "";
      if (error.response) {
        mensajeError = error.response.data?.message || mensajeError;
        detalle = error.response.data?.errors
          ? Object.values(error.response.data.errors)
              .map((e) => e.message)
              .join(", ")
          : error.response.data?.error || "";
      } else if (error.request) {
        mensajeError = "No se pudo conectar con el servidor";
        detalle = "Verifica que el backend esté corriendo";
      } else {
        detalle = error.message;
      }
      mostrarNotif(mensajeError, "error", detalle);
    } finally {
      // Se suelta pase lo que pase: si fallo, hay que poder reintentar.
      guardandoRef.current = false;
      setGuardandoPlay(false);
    }
  };

  const handleEditar = (play) => {
    setTiempoPagadoInput({
      horas: Math.floor(play.tiempoPagado / 60),
      minutos: play.tiempoPagado % 60,
    });
    setTiempoPendienteInput({
      horas: Math.floor((play.tiempoPendiente || 0) / 60),
      minutos: (play.tiempoPendiente || 0) % 60,
    });
    setFormData({
      cliente: play.cliente,
      atendio: play.atendio,
      tiempoPagado: play.tiempoPagado,
      tiempoPendiente: play.tiempoPendiente || 0,
      horaInicio: convertirA12Horas(play.horaInicio),
      horaFinal: convertirA12Horas(play.horaFinal),
      lugarDeJuego: play.lugarDeJuego,
      juegosJugados: play.juegosJugados || [],
      totalControles:
        play.totalControles ??
        ((play.controlAdicional || 0) > 0 ? play.controlAdicional + 2 : 1),
      // Registros viejos con "En Proceso" (ya no válido) arrancan vacíos para
      // obligar a elegir Completado o Pendiente al guardar.
      estadoPago: ESTADOS_PAGO.includes(play.estadoPago) ? play.estadoPago : "",
    });
    setErrores({});
    // Editar SIEMPRE abre en modo tiempo: es el modo que muestra las horas y los
    // minutos, y el registro ya los tiene. Abrirlo en modo monto escondería el
    // tiempo (los dos modos se excluyen en el formulario) y parecería que se
    // borró.
    setModoRegistro("tiempo");
    setMontoInput("");

    // Foto del cobro tal como está guardado. Mientras la edición no toque el
    // tiempo, el lugar ni los controles, el monto se deja EXACTAMENTE como
    // estaba en vez de recalcularlo (ver `cobroIntacto` en handleSubmit).
    //
    // Sin esto, abrir y guardar sin tocar nada cambiaba el monto solo: un play
    // cobrado por monto guarda el tiempo redondeado a múltiplos de 5 min, así
    // que recalcularlo no devuelve lo que se cobró (₡700 en un Play 5 se guarda
    // como 40 min, y 40 min a ₡1000/hora son ₡667). Hasta ₡33 por edición, en el
    // 80% de los montos de Play 5, y se lo comía el reporte de ingresos.
    // Se guarda el monto SIN los controles. Así, si la edición sólo cambia los
    // controles, se conserva lo cobrado por el tiempo y se le suma el costo
    // nuevo de controles, en vez de recalcular el tiempo y perder el monto.
    const controlesPagadosOriginal = Math.max(
      0,
      play.controlAdicional ?? Math.max(0, (play.totalControles || 0) - 2),
    );
    setCobroOriginal({
      montoTiempo: Math.max(
        0,
        Math.round(play.montoPagado || 0) - controlesPagadosOriginal * 200,
      ),
      tiempoPagado: play.tiempoPagado,
      lugarDeJuego: play.lugarDeJuego,
    });
    setEditando(play._id);
    setMostrarFormulario(true);
  };

  const handleEliminar = async (id) => {
    if (!window.confirm("¿Estás seguro de eliminar este registro?")) return;
    try {
      const axios = await getAxios();
      await axios.delete(`${API_URL}/api/plays/${id}`, getAuthHeaders());
      mostrarNotif("Play eliminado exitosamente", "success");
      fetchPlays(
        plays.length === 1 && paginacion.page > 1
          ? paginacion.page - 1
          : paginacion.page,
        filtrosAplicados,
        busquedaAplicada,
      );
    } catch (error) {
      console.error("❌ Error:", error);
      let mensajeError = "Error al eliminar el play";
      let detalle = "";
      if (error.response) {
        mensajeError = error.response.data?.message || mensajeError;
        detalle = error.response.data?.error || "";
      } else if (error.request) {
        mensajeError = "No se pudo conectar con el servidor";
        detalle = "Verifica que el backend esté corriendo";
      } else {
        detalle = error.message;
      }
      mostrarNotif(mensajeError, "error", detalle);
    }
  };

  const irAPagina = (num) => {
    fetchPlays(num, filtrosAplicados, busquedaAplicada);
    document
      .querySelector(".tabla-panel")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ── TURNO DE TIEMPO PENDIENTE ──────────────────────────────────────────────
  // El pendiente NO baja al arrancar el turno: baja al cerrarlo, y con lo que
  // realmente se jugo. Por eso detener nunca pregunta "cuanto le queda" (una
  // resta) sino "cuanto jugo" (un dato que se vio), y ese numero viene ya
  // calculado desde la hora de arranque.

  const abrirTurno = (play) => {
    const pend = play.tiempoPendiente || 0;
    // Precargado con TODO el pendiente, que es el caso normal.
    setTurnoIniciar({ play, horas: Math.floor(pend / 60), minutos: pend % 60 });
  };

  const abrirDetener = (play) => {
    const turno = play.pendienteEnCurso;
    if (!turno) return;
    // Lo que marca el reloj desde que arranco, recortado a lo que se puso a
    // correr: detener tarde no puede descontar tiempo que nunca se jugo.
    const corridos = Math.round((Date.now() - new Date(turno.inicio).getTime()) / 60000);
    const jugados = Math.min(Math.max(corridos, 0), turno.minutos || 0);
    setTurnoDetener({ play, jugados });
  };

  const recargarLista = () =>
    fetchPlays(paginacion.page, filtrosAplicados, busquedaAplicada);

  // Cierre automatico del turno de tiempo pendiente.
  //
  // El backend lo cierra al LEER la lista (descuenta los minutos jugados y
  // borra el turno), pero si la pantalla se queda abierta nadie vuelve a leer:
  // el registro seguia diciendo "corriendo" y habia que detenerlo a mano.
  //
  // Esto programa UNA recarga para el instante en que vence el turno mas
  // proximo. Ahi el backend lo cierra y la lista vuelve con el tiempo pendiente
  // ya descontado, sin tocar nada.
  //
  // Solo se programa si el vencimiento esta en el FUTURO. Si ya paso, no se
  // recarga: el backend ya lo habria cerrado en esa misma lectura, y
  // `turnoCorriendo` lo deja de mostrar igual. Asi no queda un ciclo de
  // recargas si algo saliera mal del otro lado.
  useEffect(() => {
    const vencimientos = plays
      .filter((p) => p.pendienteEnCurso?.fin)
      .map((p) => new Date(p.pendienteEnCurso.fin).getTime())
      .filter((t) => t > Date.now());
    if (!vencimientos.length) return;

    // +2 s de colchon: pedir la lista justo en el limite podria llegar antes de
    // que el turno cuente como vencido del otro lado.
    const espera = Math.min(...vencimientos) - Date.now() + 2000;
    const t = setTimeout(() => {
      fetchPlays(paginacion.page, filtrosAplicados, busquedaAplicada);
    }, espera);
    return () => clearTimeout(t);
  }, [plays, paginacion.page, filtrosAplicados, busquedaAplicada, fetchPlays]);

  const errorDeTurno = (error, porDefecto) => {
    console.error("\u274c Error:", error);
    const msg = error.response?.data?.message || porDefecto;
    mostrarNotif(msg, "error");
  };

  const confirmarIniciarTurno = async () => {
    if (!turnoIniciar || turnoGuardando) return;
    const total = turnoIniciar.horas * 60 + turnoIniciar.minutos;
    if (total <= 0) {
      mostrarNotif("Pone cuantos minutos va a jugar", "warning");
      return;
    }
    setTurnoGuardando(true);
    try {
      const axios = await getAxios();
      const { data } = await axios.post(
        `${API_URL}/api/plays/${turnoIniciar.play._id}/pendiente/iniciar`,
        { minutos: total },
        getAuthHeaders(),
      );
      const fin = data?.data?.pendienteEnCurso?.fin;
      mostrarNotif(
        `Corriendo ${minutosATexto(total)} de tiempo pendiente`,
        "success",
        fin ? `Termina a las ${horaDeInstante(fin)} y avisa por WhatsApp.` : "",
      );
      setTurnoIniciar(null);
      recargarLista();
    } catch (error) {
      errorDeTurno(error, "No se pudo iniciar el tiempo pendiente");
    } finally {
      setTurnoGuardando(false);
    }
  };

  const confirmarDetenerTurno = async () => {
    if (!turnoDetener || turnoGuardando) return;
    setTurnoGuardando(true);
    try {
      const axios = await getAxios();
      const { data } = await axios.post(
        `${API_URL}/api/plays/${turnoDetener.play._id}/pendiente/detener`,
        { minutosJugados: turnoDetener.jugados },
        getAuthHeaders(),
      );
      mostrarNotif(data?.message || "Tiempo pendiente detenido", "success");
      setTurnoDetener(null);
      recargarLista();
    } catch (error) {
      errorDeTurno(error, "No se pudo detener el tiempo pendiente");
    } finally {
      setTurnoGuardando(false);
    }
  };

  const minutosATexto = (minutos) => {
    if (minutos === 0) return "0 min";
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}min`;
  };

  // Solo la primera carga tapa la pantalla. En las siguientes (buscar, paginar,
  // guardar) la lista anterior se queda visible pero atenuada, para que la
  // pantalla no parpadee en blanco mientras se teclea.
  if (loading && primeraCarga) {
    return (
      <div className="plays-container">
        <nav className="navbar navbar-expand-lg navbar-dark bg-dark w-100">
          <div className="container-fluid">
            <Link className="navbar-brand fw-bold" to="/">
              🎮 Sala de Juegos Ruiz
            </Link>
          </div>
        </nav>
        <div className="loading-container">
          <div className="spinner-border text-success" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="plays-container">
      <Navbar />
      <div className="plays-content">
        <div className="container-fluid py-4">
          {/* Header */}
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2 className="plays-title mb-0">🎮 Control de Plays</h2>
            <button
              className="btn btn-primary btn-lg"
              onClick={() =>
                mostrarFormulario ? limpiarFormulario() : abrirFormularioNuevo()
              }
            >
              {mostrarFormulario ? "❌ Cancelar" : "➕ Nuevo Registro"}
            </button>
          </div>

          {/* Formulario */}
          {mostrarFormulario && (
            <div ref={formularioRef} className="card formulario-panel mb-4 shadow-lg">
              <div className="card-header bg-gradient-primary">
                <h5 className="mb-0 text-white">
                  {editando
                    ? "✏️ Editar Registro"
                    : "➕ Nuevo Registro de Play"}
                </h5>
              </div>
              <div className="card-body p-4">
                <form onSubmit={handleSubmit}>
                  <div className="row g-3">
                    <div className="col-12">
                      <h6 className="border-bottom pb-2 mb-3 text-primary fw-bold">
                        📋 Información Básica
                      </h6>
                    </div>
                    <div className="col-12 col-md-6" id="campo-cliente">
                      <label className="form-label fw-bold">Cliente *</label>
                      <input
                        type="text"
                        className={`form-control form-control-lg ${errores.cliente ? "is-invalid" : ""}`}
                        name="cliente"
                        value={formData.cliente}
                        onChange={handleInputChange}
                        placeholder="Nombre del cliente"
                        required
                      />
                      {errores.cliente && (
                        <div className="invalid-feedback d-block">{errores.cliente}</div>
                      )}
                    </div>
                    <div className="col-12 mt-4">
                      <h6 className="border-bottom pb-2 mb-3 text-primary fw-bold">
                        🎮 Detalles del Juego
                      </h6>
                    </div>
                    <div className="col-12" id="campo-lugarDeJuego">
                      <label className="form-label fw-bold">
                        Lugar de Juego *
                      </label>
                      <select
                        className={`form-select form-select-lg custom-select-mobile ${errores.lugarDeJuego ? "is-invalid" : ""}`}
                        name="lugarDeJuego"
                        value={formData.lugarDeJuego}
                        onChange={handleInputChange}
                        required
                      >
                        <option value="">Seleccionar lugar...</option>
                        {LUGARES_JUEGO.map((l) => (
                          <option key={l} value={l}>
                            {l} - ₡{l.includes("Play 5") ? "1000" : "800"}/hora
                          </option>
                        ))}
                      </select>
                      {errores.lugarDeJuego && (
                        <div className="invalid-feedback d-block">{errores.lugarDeJuego}</div>
                      )}
                    </div>
                    {pingPong ? (
                      <div className="col-12">
                        <div className="aviso-formulario">
                          <span className="aviso-icono" aria-hidden="true">🏓</span>
                          <span>En Ping Pong no se registra juego jugado ni controles.</span>
                        </div>
                      </div>
                    ) : (
                    <div className="col-12" id="campo-juegosJugados">
                      <label className="form-label fw-bold">
                        Juegos Jugados agregar almenos 1 (máx. 2) *
                      </label>
                      <select
                        className={`form-select select-juegos-mejorado custom-select-mobile ${errores.juegosJugados ? "is-invalid" : ""}`}
                        multiple
                        value={formData.juegosJugados}
                        onChange={handleJuegoChange}
                        size="3"
                      >
                        {JUEGOS_DISPONIBLES.map((j) => (
                          <option key={j} value={j}>
                            {j}
                          </option>
                        ))}
                      </select>
                      {errores.juegosJugados ? (
                        <div className="invalid-feedback d-block">{errores.juegosJugados}</div>
                      ) : (
                        <small className="text-muted d-block mt-1">
                          💡 Mantén presionado para seleccionar múltiples
                        </small>
                      )}
                    </div>
                    )}
                    <div className="col-12 mt-4">
                      <h6 className="border-bottom pb-2 mb-3 text-primary fw-bold">
                        ⏰ Tiempos y Horarios
                      </h6>
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-bold d-block">
                        ¿Cómo registrar el cobro?
                      </label>
                      <div className="btn-group w-100" role="group">
                        <button
                          type="button"
                          className={`btn btn-lg ${modoRegistro === "tiempo" ? "btn-primary" : "btn-outline-primary"}`}
                          onClick={() => cambiarModo("tiempo")}
                        >
                          🕐 Por tiempo
                        </button>
                        <button
                          type="button"
                          className={`btn btn-lg ${modoRegistro === "monto" ? "btn-primary" : "btn-outline-primary"}`}
                          onClick={() => cambiarModo("monto")}
                        >
                          💵 Por monto
                        </button>
                      </div>
                    </div>
                    {modoRegistro === "tiempo" ? (
                      <div className="col-12" id="campo-tiempo">
                        <label className="form-label fw-bold">
                          Tiempo Pagado *
                        </label>
                        <div className="row g-2">
                          <div className="col-6">
                            <div className="input-group input-group-lg">
                              <input
                                type="number"
                                className="form-control"
                                min="0"
                                max="12"
                                value={tiempoPagadoInput.horas}
                                placeholder="0"
                                onChange={(e) =>
                                  handleTiempoPagadoChange("horas", e.target.value)
                                }
                              />
                              <span className="input-group-text">horas</span>
                            </div>
                          </div>
                          <div className="col-6">
                            <div className="input-group input-group-lg">
                              <input
                                type="number"
                                className="form-control"
                                min="0"
                                max="59"
                                value={tiempoPagadoInput.minutos}
                                placeholder="0"
                                onChange={(e) =>
                                  handleTiempoPagadoChange("minutos", e.target.value)
                                }
                              />
                              <span className="input-group-text">min</span>
                            </div>
                          </div>
                        </div>
                        {formData.tiempoPagado > 0 && (
                          <small className="text-success d-block mt-1 fw-semibold">
                            ✓ Total: {minutosATexto(formData.tiempoPagado)}
                          </small>
                        )}
                        {errores.tiempo && (
                          <div className="invalid-feedback d-block">{errores.tiempo}</div>
                        )}
                      </div>
                    ) : (
                      <div className="col-12" id="campo-tiempo">
                        <label className="form-label fw-bold">
                          Monto por el tiempo *
                        </label>
                        <div className="input-group input-group-lg">
                          <span className="input-group-text">₡</span>
                          <input
                            type="number"
                            className={`form-control ${errores.tiempo ? "is-invalid" : ""}`}
                            min="0"
                            step="5"
                            value={montoInput}
                            placeholder="425"
                            onChange={(e) => {
                              setMontoInput(e.target.value);
                              setErrores((er) => (er.tiempo ? { ...er, tiempo: "" } : er));
                            }}
                          />
                        </div>
                        {errores.tiempo && (
                          <div className="invalid-feedback d-block">{errores.tiempo}</div>
                        )}
                        {!formData.lugarDeJuego ? (
                          <small className="text-muted d-block mt-1">
                            ⚠️ Primero elegí el lugar de juego (para saber ₡/hora)
                          </small>
                        ) : formData.tiempoPagado > 0 ? (
                          <small className="text-success d-block mt-1 fw-semibold">
                            ✓ Tiempo equivalente: {minutosATexto(formData.tiempoPagado)}
                          </small>
                        ) : (
                          <small className="text-muted d-block mt-1">
                            Ingresá el monto para calcular el tiempo
                          </small>
                        )}
                        <small className="text-muted d-block mt-1">
                          💡 Es el pago por el tiempo (se calcula y redondea a 5 min). Los controles se suman aparte.
                        </small>
                      </div>
                    )}
                    <div className="col-12">
                      <label className="form-label fw-bold">
                        Tiempo Pendiente {editando && "*"}
                      </label>
                      <div className="row g-2">
                        <div className="col-6">
                          <div className="input-group input-group-lg">
                            <input
                              type="number"
                              className="form-control"
                              min="0"
                              max="12"
                              value={tiempoPendienteInput.horas}
                              placeholder="0"
                              disabled={!editando}
                              onChange={(e) =>
                                handleTiempoPendienteChange(
                                  "horas",
                                  e.target.value,
                                )
                              }
                            />
                            <span className="input-group-text">horas</span>
                          </div>
                        </div>
                        <div className="col-6">
                          <div className="input-group input-group-lg">
                            <input
                              type="number"
                              className="form-control"
                              min="0"
                              max="59"
                              value={tiempoPendienteInput.minutos}
                              placeholder="0"
                              disabled={!editando}
                              onChange={(e) =>
                                handleTiempoPendienteChange(
                                  "minutos",
                                  e.target.value,
                                )
                              }
                            />
                            <span className="input-group-text">min</span>
                          </div>
                        </div>
                      </div>
                      {formData.tiempoPendiente > 0 && (
                        <small className="text-warning d-block mt-1 fw-semibold">
                          ⏳ Total: {minutosATexto(formData.tiempoPendiente)}
                        </small>
                      )}
                      {!editando && (
                        <small className="text-muted d-block mt-1">
                          💡 Solo editable al modificar un registro existente
                        </small>
                      )}
                    </div>
                    <div className="col-12 col-md-6" id="campo-horaInicio">
                      <label className="form-label fw-bold">
                        Hora Inicio *
                      </label>
                      <input
                        type="text"
                        className={`form-control form-control-lg ${errores.horaInicio ? "is-invalid" : ""}`}
                        name="horaInicio"
                        value={formData.horaInicio}
                        onChange={handleInputChange}
                        onBlur={normalizarHoraInicio}
                        placeholder="2:10 PM"
                        required
                      />
                      {errores.horaInicio && (
                        <div className="invalid-feedback d-block">{errores.horaInicio}</div>
                      )}
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-bold">
                        Hora Final (calculada)
                      </label>
                      <input
                        type="text"
                        className="form-control form-control-lg bg-light"
                        value={formData.horaFinal}
                        readOnly
                        disabled
                        placeholder="4:10 PM"
                        style={{ cursor: "not-allowed" }}
                      />
                    </div>
                    <div className="col-12 mt-4">
                      <h6 className="border-bottom pb-2 mb-3 text-primary fw-bold">
                        💰 Costos y Estado
                      </h6>
                    </div>
                    {!pingPong && (
                    <div className="col-12 col-md-6" id="campo-totalControles">
                      <label className="form-label fw-bold">
                        Controles <span className="text-danger">*</span>
                      </label>
                      <select
                        className={`form-select form-select-lg custom-select-mobile ${errores.totalControles ? "is-invalid" : ""}`}
                        name="totalControles"
                        value={formData.totalControles}
                        onChange={handleInputChange}
                        required
                      >
                        <option value="" disabled>
                          Seleccioná los controles...
                        </option>
                        <option value={1}>1 control — Gratis</option>
                        <option value={2}>2 controles — Gratis</option>
                        <option value={3}>3 controles (+₡200)</option>
                        <option value={4}>4 controles (+₡400)</option>
                      </select>
                      {errores.totalControles ? (
                        <div className="invalid-feedback d-block">{errores.totalControles}</div>
                      ) : (
                        <small className="text-muted d-block mt-1">
                          Los 2 primeros controles son gratis. Del 3.º en adelante ₡200 c/u.
                        </small>
                      )}
                    </div>
                    )}
                    <div
                      className={`col-12 ${pingPong ? "" : "col-md-6"}`}
                      id="campo-estadoPago"
                    >
                      <label className="form-label fw-bold">
                        Estado del Pago <span className="text-danger">*</span>
                      </label>
                      <select
                        className={`form-select form-select-lg custom-select-mobile ${errores.estadoPago ? "is-invalid" : ""}`}
                        name="estadoPago"
                        value={formData.estadoPago}
                        onChange={handleInputChange}
                        required
                      >
                        <option value="" disabled>
                          Selecciona el estado...
                        </option>
                        {ESTADOS_PAGO.map((e) => (
                          <option key={e} value={e}>
                            {e}
                          </option>
                        ))}
                      </select>
                      {errores.estadoPago && (
                        <div className="invalid-feedback d-block">{errores.estadoPago}</div>
                      )}
                    </div>
                    <div className="col-12">
                      <div className="card bg-light border-success">
                        <div className="card-body">
                          <h6 className="text-success mb-3 fw-bold">
                            💵 Resumen de Cobro
                          </h6>
                          <div className="d-flex justify-content-between mb-2">
                            <span>Tiempo de juego:</span>
                            <strong>
                              ₡{subtotalTiempoUI.toLocaleString()}
                            </strong>
                          </div>
                          {!pingPong && (
                            <div className="d-flex justify-content-between mb-2">
                              <span>Controles ({formData.totalControles || "—"}):</span>
                              <strong>
                                {!formData.totalControles
                                  ? "—"
                                  : costoControlesUI > 0
                                    ? `₡${costoControlesUI.toLocaleString()}`
                                    : "Gratis"}
                              </strong>
                            </div>
                          )}
                          <hr className="my-2" />
                          <div className="d-flex justify-content-between">
                            <span className="fw-bold fs-5">TOTAL A COBRAR:</span>
                            <span className="fw-bold fs-4 text-success">
                              ₡{montoFinalUI.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="d-flex gap-3 mt-4 justify-content-end">
                    <button
                      type="button"
                      className="btn btn-secondary btn-lg px-4"
                      onClick={limpiarFormulario}
                    >
                      ❌ Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={guardandoPlay}
                      className="btn btn-primary btn-lg px-4"
                    >
                      {guardandoPlay
                        ? "Guardando..."
                        : editando
                          ? "💾 Actualizar"
                          : "✅ Guardar"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* 🔎 Barra de herramientas: buscar y filtrar en una sola tira.
              Antes eran dos tarjetas apiladas (buscador + panel de filtros con
              su encabezado) y se comían media pantalla del celular. */}
          <div className="pm-barra">
            <p className="pm-barra-titulo">🔍 Buscar y filtrar registros</p>
            <div className="pm-buscador">
              <span className="pm-buscador-icono" aria-hidden="true">🔍</span>
              <input
                type="search"
                className="pm-buscador-input"
                placeholder="Buscar cliente…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                aria-label="Buscar plays por nombre de cliente"
              />
              {busqueda && (
                <button
                  type="button"
                  className="pm-buscador-limpiar"
                  onClick={limpiarBusqueda}
                  aria-label="Limpiar búsqueda"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filtros como botones: se tocan, no se escriben */}
            <div className="pm-chips">
              <button
                type="button"
                className={`pm-chip pm-chip--filtro${filtros.soloPendiente ? " pm-chip--activo" : ""}`}
                aria-pressed={filtros.soloPendiente}
                onClick={() => {
                  const nuevosFiltros = {
                    ...filtros,
                    soloPendiente: !filtros.soloPendiente,
                    minPendienteHoras: "",
                    minPendienteMinutos: "",
                  };
                  setFiltros(nuevosFiltros);
                  // Al ser un toggle binario, aplica de una sin botón "Buscar"
                  setFiltrosAplicados(nuevosFiltros);
                  setMostrarMinimo(false);
                  fetchPlays(1, nuevosFiltros, busquedaAplicada);
                }}
              >
                ⏳ Solo con pendiente
              </button>
              <button
                type="button"
                className={`pm-chip pm-chip--filtro${mostrarMinimo ? " pm-chip--abierto" : ""}${minimoAplicado > 0 ? " pm-chip--activo" : ""}`}
                aria-expanded={mostrarMinimo}
                disabled={filtros.soloPendiente}
                onClick={() => setMostrarMinimo((v) => !v)}
              >
                ⏱️ {minimoAplicado > 0 ? `Mínimo ${minutosATexto(minimoAplicado)}` : "Pendiente mínimo"}
                <span className={`pm-flecha${mostrarMinimo ? " pm-flecha--abierta" : ""}`} aria-hidden="true">▾</span>
              </button>
              {(hayFiltroActivo || hayAlgoEscrito) && (
                <button
                  type="button"
                  className="pm-chip pm-chip--limpiar"
                  onClick={() => { setMostrarMinimo(false); limpiarFiltros(); }}
                >
                  ✕ Quitar filtros
                </button>
              )}
            </div>

            {/* Los campos de horas/minutos solo aparecen si se piden */}
            {mostrarMinimo && !filtros.soloPendiente && (
              <div className="pm-minimo">
                <div className="pm-minimo-campo">
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="12"
                    placeholder="0"
                    aria-label="Horas de pendiente mínimo"
                    value={filtros.minPendienteHoras}
                    onChange={(e) =>
                      setFiltros((prev) => ({ ...prev, minPendienteHoras: e.target.value }))
                    }
                  />
                  <span>h</span>
                </div>
                <div className="pm-minimo-campo">
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max="59"
                    placeholder="0"
                    aria-label="Minutos de pendiente mínimo"
                    value={filtros.minPendienteMinutos}
                    onChange={(e) =>
                      setFiltros((prev) => ({ ...prev, minPendienteMinutos: e.target.value }))
                    }
                  />
                  <span>min</span>
                </div>
                <button
                  type="button"
                  className="pm-chip pm-chip--aplicar"
                  onClick={() => { aplicarFiltros(); setMostrarMinimo(false); }}
                >
                  Aplicar
                </button>
              </div>
            )}

            {/* Una sola línea de estado: qué se buscó y qué filtro está puesto */}
            {(busquedaServidor || hayFiltroActivo) && (
              <p className="pm-estado">
                {fmtMiles(paginacion.total)} resultado{paginacion.total === 1 ? "" : "s"}
                {busquedaServidor && <> para «{busquedaServidor}»</>}
                {hayFiltroActivo && (
                  <>
                    {" · "}
                    {filtrosAplicados.soloPendiente
                      ? "solo con pendiente"
                      : `pendiente ≥ ${minutosATexto(minimoAplicado)}`}
                  </>
                )}
              </p>
            )}
          </div>

          {/* Tabla */}
          <div className="card tabla-panel shadow-lg">
            <div className="card-header bg-gradient-primary">
              <h5 className="mb-0 text-white">📋 Registros de Plays</h5>
            </div>
            <div className={`card-body p-0${loading ? " lista-cargando" : ""}`}>
              {plays.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <div className="mb-3">
                    <i className="fs-1">🎮</i>
                  </div>
                  <p className="fs-4 mb-2">
                    {busquedaAplicada
                      ? `No hay plays de «${busquedaAplicada}»`
                      : hayFiltroActivo
                        ? "No hay registros con ese tiempo pendiente"
                        : "No hay registros aún"}
                  </p>
                  {busquedaAplicada ? (
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm mt-2"
                      onClick={limpiarBusqueda}
                    >
                      ✕ Limpiar la búsqueda
                    </button>
                  ) : (
                    <small>
                      {hayFiltroActivo
                        ? "Prueba con otros valores o limpia el filtro"
                        : "Agrega tu primer registro usando el botón superior"}
                    </small>
                  )}
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover table-striped mb-0">
                    <thead className="table-dark">
                      <tr>
                        <th className="px-3 py-3">Fecha</th>
                        <th className="px-3 py-3">Cliente</th>
                        <th className="px-3 py-3">Atendió</th>
                        <th className="px-3 py-3">Tiempo</th>
                        <th className="px-3 py-3">Horario</th>
                        <th className="px-3 py-3">Lugar</th>
                        <th className="px-3 py-3">Juegos</th>
                        <th className="px-3 py-3">Total</th>
                        <th className="px-3 py-3">Estado</th>
                        <th className="px-3 py-3 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plays.map((play) => (
                        <tr key={play._id}>
                          <td className="px-3 py-3">
                            {new Date(play.fecha).toLocaleDateString("es-CR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })}
                          </td>
                          <td className="px-3 py-3 fw-semibold">
                            {play.cliente}
                          </td>
                          <td className="px-3 py-3">{play.atendio}</td>
                          <td className="px-3 py-3">
                            <div className="fw-bold text-primary">
                              ⏱️ {minutosATexto(play.tiempoPagado)}
                            </div>
                            {/* Turno de tiempo pendiente. Corriendo: lo que
                                importa es a que hora termina. Parado: el
                                pendiente es un boton, no un rotulo. */}
                            {turnoCorriendo(play) ? (
                              <button
                                type="button"
                                className="turno-chip turno-chip--corriendo"
                                onClick={() => abrirDetener(play)}
                                title="Detener el tiempo pendiente"
                              >
                                <span>
                                  ▶️ {minutosATexto(play.pendienteEnCurso.minutos)} corriendo
                                </span>
                                <small>
                                  termina {horaDeInstante(play.pendienteEnCurso.fin)} · detener
                                </small>
                              </button>
                            ) : play.tiempoPendiente > 0 ? (
                              <button
                                type="button"
                                className="turno-chip turno-chip--pendiente"
                                onClick={() => abrirTurno(play)}
                                title="Poner a correr el tiempo pendiente"
                              >
                                <span>⏳ {minutosATexto(play.tiempoPendiente)}</span>
                                <small>tocar para jugarlo</small>
                              </button>
                            ) : null}
                          </td>
                          <td className="px-3 py-3">
                            <small className="d-block">
                              {convertirA12Horas(play.horaInicio)}
                            </small>
                            <small className="text-muted">
                              {convertirA12Horas(play.horaFinal)}
                            </small>
                          </td>
                          <td className="px-3 py-3">
                            <span className="badge bg-info text-dark">
                              {play.lugarDeJuego}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            {play.juegosJugados?.length > 0 ? (
                              <div className="juegos-list">
                                {play.juegosJugados.map((j, i) => (
                                  <small
                                    key={i}
                                    className="d-block text-truncate"
                                    style={{ maxWidth: "150px" }}
                                  >
                                    🎮 {j}
                                  </small>
                                ))}
                              </div>
                            ) : (
                              <small className="text-muted">-</small>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <div className="fw-bold fs-5 text-success">
                              ₡{play.total.toLocaleString()}
                            </div>
                            {controlesDe(play) > 0 && (
                              <small className="text-muted d-block">
                                🎮 {controlesDe(play)} control(es)
                              </small>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={`badge px-3 py-2 ${
                                play.estadoPago === "Completado"
                                  ? "bg-success"
                                  : play.estadoPago === "En Proceso"
                                    ? "bg-warning text-dark"
                                    : "bg-danger"
                              }`}
                            >
                              {play.estadoPago}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <div
                              className="btn-group btn-group-sm"
                              role="group"
                            >
                              <button
                                className="btn btn-primary"
                                onClick={() => handleEditar(play)}
                                title="Editar"
                              >
                                ✏️
                              </button>
                              <button
                                className="btn btn-danger"
                                onClick={() => handleEliminar(play._id)}
                                title="Eliminar"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {paginacion.totalPages > 1 && (
              <div className="card-footer bg-light border-top">
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                  <div className="text-muted small">
                    Mostrando {plays.length} de {paginacion.total} registros
                    <span className="d-none d-sm-inline">
                      {" "}
                      (Página {paginacion.page} de {paginacion.totalPages})
                    </span>
                    {hayFiltroActivo && (
                      <span className="badge bg-warning text-dark ms-2">
                        Filtrado
                      </span>
                    )}
                  </div>
                  <nav aria-label="Paginación de plays">
                    <ul className="pagination pagination-sm mb-0">
                      <li
                        className={`page-item ${!paginacion.hasPrevPage ? "disabled" : ""}`}
                      >
                        <button
                          className="page-link"
                          onClick={() => irAPagina(1)}
                          disabled={!paginacion.hasPrevPage}
                          aria-label="Primera página"
                        >
                          <span aria-hidden="true">««</span>
                        </button>
                      </li>
                      <li
                        className={`page-item ${!paginacion.hasPrevPage ? "disabled" : ""}`}
                      >
                        <button
                          className="page-link"
                          onClick={() => irAPagina(paginacion.page - 1)}
                          disabled={!paginacion.hasPrevPage}
                          aria-label="Página anterior"
                        >
                          <span aria-hidden="true">‹</span>
                        </button>
                      </li>
                      {Array.from(
                        { length: paginacion.totalPages },
                        (_, i) => i + 1,
                      )
                        .filter((num) => {
                          const c = paginacion.page;
                          return (
                            num === 1 ||
                            num === paginacion.totalPages ||
                            (num >= c - 1 && num <= c + 1)
                          );
                        })
                        .map((num, index, array) => {
                          const prev = array[index - 1];
                          return (
                            <React.Fragment key={num}>
                              {prev && num - prev > 1 && (
                                <li className="page-item disabled d-none d-sm-block">
                                  <span className="page-link">...</span>
                                </li>
                              )}
                              <li
                                className={`page-item ${paginacion.page === num ? "active" : ""}`}
                              >
                                <button
                                  className="page-link"
                                  onClick={() => irAPagina(num)}
                                >
                                  {num}
                                </button>
                              </li>
                            </React.Fragment>
                          );
                        })}
                      <li
                        className={`page-item ${!paginacion.hasNextPage ? "disabled" : ""}`}
                      >
                        <button
                          className="page-link"
                          onClick={() => irAPagina(paginacion.page + 1)}
                          disabled={!paginacion.hasNextPage}
                          aria-label="Página siguiente"
                        >
                          <span aria-hidden="true">›</span>
                        </button>
                      </li>
                      <li
                        className={`page-item ${!paginacion.hasNextPage ? "disabled" : ""}`}
                      >
                        <button
                          className="page-link"
                          onClick={() => irAPagina(paginacion.totalPages)}
                          disabled={!paginacion.hasNextPage}
                          aria-label="Última página"
                        >
                          <span aria-hidden="true">»»</span>
                        </button>
                      </li>
                    </ul>
                  </nav>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {mostrarNotificacion && notificacion && (
        <div className={`notificacion-exito ${notificacion.tipo}`}>
          <div className="notificacion-contenido">
            <div className="notificacion-icono">
              {notificacion.tipo === "warning"
                ? "⚠️"
                : notificacion.tipo === "error"
                  ? "❌"
                  : "✅"}
            </div>
            <div className="notificacion-texto">
              <h4>{notificacion.mensaje}</h4>
              {notificacion.detalle && <p>{notificacion.detalle}</p>}
            </div>
            <button
              className="notificacion-cerrar"
              onClick={() => setMostrarNotificacion(false)}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── ARRANCAR EL TIEMPO PENDIENTE ──────────────────────────────────────
          Los mismos selectores de horas/minutos del formulario de siempre, ya
          precargados con todo el pendiente, y la hora de fin calculada DESDE
          AHORA — que es justo lo que el formulario normal no sabe hacer. */}
      {turnoIniciar && (
        <div className="turno-overlay" onClick={() => !turnoGuardando && setTurnoIniciar(null)}>
          <div className="turno-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="turno-modal__titulo">⏳ Jugar tiempo pendiente</h3>
            <p className="turno-modal__sub">
              {turnoIniciar.play.cliente} tiene{" "}
              <strong>{minutosATexto(turnoIniciar.play.tiempoPendiente || 0)}</strong> pendientes.
              ¿Cuánto va a jugar ahora?
            </p>

            <div className="turno-modal__campos">
              <label>
                Horas
                <select
                  className="form-select"
                  value={turnoIniciar.horas}
                  disabled={turnoGuardando}
                  onChange={(e) =>
                    setTurnoIniciar((t) => ({ ...t, horas: Number(e.target.value) }))
                  }
                >
                  {[0, 1, 2, 3, 4, 5, 6].map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </label>
              <label>
                Minutos
                <select
                  className="form-select"
                  value={turnoIniciar.minutos}
                  disabled={turnoGuardando}
                  onChange={(e) =>
                    setTurnoIniciar((t) => ({ ...t, minutos: Number(e.target.value) }))
                  }
                >
                  {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </label>
            </div>

            {(() => {
              const total = turnoIniciar.horas * 60 + turnoIniciar.minutos;
              const disp = turnoIniciar.play.tiempoPendiente || 0;
              if (total <= 0) {
                return <p className="turno-modal__aviso">Poné cuánto va a jugar.</p>;
              }
              if (total > disp) {
                return (
                  <p className="turno-modal__aviso turno-modal__aviso--error">
                    Solo quedan {minutosATexto(disp)} pendientes.
                  </p>
                );
              }
              // El turno arranca cuando se toca "Arrancar", asi que el inicio
              // es ahora. Se muestran los dos extremos para poder ver de un
              // vistazo desde que hora y hasta cual va.
              const inicio = new Date();
              const fin = new Date(inicio.getTime() + total * 60000);
              return (
                <p className="turno-modal__fin">
                  De <strong>{horaDeInstante(inicio)}</strong> a{" "}
                  <strong>{horaDeInstante(fin)}</strong>
                  <small>Avisa por WhatsApp al grupo, igual que un tiempo nuevo.</small>
                </p>
              );
            })()}

            <div className="turno-modal__botones">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setTurnoIniciar(null)}
                disabled={turnoGuardando}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-success fw-bold"
                onClick={confirmarIniciarTurno}
                disabled={
                  turnoGuardando ||
                  turnoIniciar.horas * 60 + turnoIniciar.minutos <= 0 ||
                  turnoIniciar.horas * 60 + turnoIniciar.minutos >
                    (turnoIniciar.play.tiempoPendiente || 0)
                }
              >
                {turnoGuardando ? "Arrancando..." : "▶️ Arrancar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DETENER EL TIEMPO PENDIENTE ───────────────────────────────────────
          La pregunta es "cuánto jugó", no "cuánto le queda": el dato que se vio,
          no una resta. Viene calculado desde la hora de arranque y se puede
          corregir para el caso de tocar el botón tarde. */}
      {turnoDetener && (
        <div className="turno-overlay" onClick={() => !turnoGuardando && setTurnoDetener(null)}>
          <div className="turno-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="turno-modal__titulo">⏹️ Detener el tiempo pendiente</h3>
            <p className="turno-modal__sub">
              Arrancó a las{" "}
              <strong>{horaDeInstante(turnoDetener.play.pendienteEnCurso?.inicio)}</strong> con{" "}
              {minutosATexto(turnoDetener.play.pendienteEnCurso?.minutos || 0)}.
            </p>

            <label className="turno-modal__jugados">
              ¿Cuánto jugó?
              <div className="turno-modal__jugados-fila">
                <input
                  type="number"
                  className="form-control"
                  min={0}
                  max={turnoDetener.play.pendienteEnCurso?.minutos || 0}
                  value={turnoDetener.jugados}
                  disabled={turnoGuardando}
                  onChange={(e) =>
                    setTurnoDetener((t) => ({
                      ...t,
                      jugados: Math.max(
                        0,
                        Math.min(
                          Number(e.target.value) || 0,
                          t.play.pendienteEnCurso?.minutos || 0,
                        ),
                      ),
                    }))
                  }
                />
                <span>min</span>
              </div>
              <small>
                Es lo que marca el reloj. Corregilo si tocaste detener después de
                que se fue.
              </small>
            </label>

            <p className="turno-modal__fin">
              Le quedan{" "}
              <strong>
                {minutosATexto(
                  Math.max(
                    0,
                    (turnoDetener.play.tiempoPendiente || 0) - turnoDetener.jugados,
                  ),
                )}
              </strong>{" "}
              pendientes
              <small>El aviso de WhatsApp de este turno se cancela.</small>
            </p>

            <div className="turno-modal__botones">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setTurnoDetener(null)}
                disabled={turnoGuardando}
              >
                Seguir jugando
              </button>
              <button
                type="button"
                className="btn btn-warning fw-bold"
                onClick={confirmarDetenerTurno}
                disabled={turnoGuardando}
              >
                {turnoGuardando ? "Deteniendo..." : "⏹️ Detener"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlaysManagement;
