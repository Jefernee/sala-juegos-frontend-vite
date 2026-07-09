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
];

const ESTADOS_PAGO = ["En Proceso", "Completado", "Pendiente"];

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
  const [mostrarNotificacion, setMostrarNotificacion] = useState(false);
  const [notificacion, setNotificacion] = useState(null);
  // ✅ Marca si el usuario escribió la Hora Inicio a mano (para no sobrescribirla)
  const [horaInicioManual, setHoraInicioManual] = useState(false);

  // filtros: lo que el usuario está escribiendo en el panel (NO dispara fetch)
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  // filtrosAplicados: los que están realmente activos (se actualizan solo al hacer clic en Buscar)
  const [filtrosAplicados, setFiltrosAplicados] = useState(FILTROS_VACIOS);

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
    estadoPago: "En Proceso",
  });

  const [tiempoPagadoInput, setTiempoPagadoInput] = useState({
    horas: "",
    minutos: "",
  });
  const [tiempoPendienteInput, setTiempoPendienteInput] = useState({
    horas: "",
    minutos: "",
  });
  const [desgloseCostos, setDesgloseCostos] = useState({
    subtotal: 0,
    costoControles: 0,
    total: 0,
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

  useEffect(() => {
    setDesgloseCostos(
      calcularCostos(
        formData.lugarDeJuego,
        formData.tiempoPagado,
        formData.totalControles,
      ),
    );
  }, [
    formData.lugarDeJuego,
    formData.tiempoPagado,
    formData.totalControles,
    calcularCostos,
  ]);

  // En modo "monto": calcula el tiempo equivalente a partir del monto recibido.
  // Resta primero el costo de los controles (los 2 primeros gratis) y convierte
  // el resto a minutos según ₡/hora del lugar, redondeando a múltiplos de 5 min.
  useEffect(() => {
    if (modoRegistro !== "monto") return;
    const monto = Number(montoInput) || 0;
    const pph = precioPorHora(formData.lugarDeJuego);
    if (!pph || !monto) {
      setTiempoPagadoInput({ horas: "", minutos: "" });
      setFormData((prev) => ({ ...prev, tiempoPagado: 0 }));
      return;
    }
    const controlesPagados = Math.max(0, (Number(formData.totalControles) || 0) - 2);
    const montoTiempo = Math.max(0, monto - controlesPagados * 200);
    let min = Math.round((montoTiempo / pph) * 60);
    min = Math.round(min / 5) * 5; // múltiplos de 5 min
    setTiempoPagadoInput({ horas: Math.floor(min / 60) || "", minutos: min % 60 });
    setFormData((prev) => ({ ...prev, tiempoPagado: min }));
  }, [modoRegistro, montoInput, formData.lugarDeJuego, formData.totalControles]);

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
    async (page = 1, filtrosActuales = FILTROS_VACIOS) => {
      setLoading(true);
      try {
        const axios = await getAxios();
        const params = new URLSearchParams({ page, limit: 5 });

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
        setPlays(response.data.data || []);
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
        setLoading(false);
      }
    },
    [getAuthHeaders],
  ); // ✅ filtros NO está aquí

  // Carga inicial sin filtros
  useEffect(() => {
    fetchPlays(1, FILTROS_VACIOS);
    document.title = "Gestión de Plays - Sala de Juegos Ruiz";
  }, [fetchPlays]);

  const mostrarNotif = (mensaje, tipo = "success", detalle = "") => {
    setNotificacion({ mensaje, tipo, detalle });
    setMostrarNotificacion(true);
    setTimeout(() => setMostrarNotificacion(false), 5000);
  };

  // ✅ Solo al hacer clic en Buscar se aplican los filtros
  const aplicarFiltros = () => {
    setFiltrosAplicados(filtros);
    fetchPlays(1, filtros);
  };

  // ✅ Limpiar: resetea panel y búsqueda
  const limpiarFiltros = () => {
    setFiltros(FILTROS_VACIOS);
    setFiltrosAplicados(FILTROS_VACIOS);
    fetchPlays(1, FILTROS_VACIOS);
  };

  const hayFiltroActivo =
    filtrosAplicados.soloPendiente ||
    filtrosAplicados.minPendienteHoras !== "" ||
    filtrosAplicados.minPendienteMinutos !== "";

  const hayAlgoEscrito =
    filtros.soloPendiente ||
    filtros.minPendienteHoras !== "" ||
    filtros.minPendienteMinutos !== "";

  // Valores para el "Resumen de Cobro" (funciona en ambos modos: tiempo y monto).
  // El costo de controles es independiente del tiempo (los 2 primeros gratis).
  const controlesPagadosUI = Math.max(0, (Number(formData.totalControles) || 0) - 2);
  const costoControlesUI = controlesPagadosUI * 200;
  const montoFinalUI =
    modoRegistro === "monto"
      ? Number(montoInput) || 0
      : desgloseCostos.total;
  const subtotalTiempoUI = Math.max(0, montoFinalUI - costoControlesUI);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    // Si el usuario escribe la Hora Inicio, dejamos de refrescarla automáticamente
    if (name === "horaInicio") setHoraInicioManual(true);
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "totalControles" ? (value ? Number(value) : "") : value,
    }));
  };

  // ✅ Al salir del campo Hora Inicio, lo dejamos en formato canónico "2:10 PM"
  //    si es interpretable (acepta 24h, con/sin puntos, minúsculas, etc.)
  const normalizarHoraInicio = () => {
    const canonica = resolverHora12h(formData.horaInicio);
    if (canonica) {
      setFormData((prev) => ({ ...prev, horaInicio: canonica }));
    }
  };

  const cambiarModo = (modo) => {
    setModoRegistro(modo);
    setMontoInput("");
    if (modo === "monto") {
      // El tiempo se calculará desde el monto; limpiamos el tiempo manual.
      setTiempoPagadoInput({ horas: "", minutos: "" });
      setFormData((prev) => ({ ...prev, tiempoPagado: 0 }));
    }
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
      estadoPago: "En Proceso",
    });
    setTiempoPagadoInput({ horas: "", minutos: "" });
    setTiempoPendienteInput({ horas: "", minutos: "" });
    setDesgloseCostos({ subtotal: 0, costoControles: 0, total: 0 });
    setModoRegistro("tiempo");
    setMontoInput("");
    setEditando(null);
    setHoraInicioManual(false);
    setMostrarFormulario(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (
      !formData.cliente ||
      !formData.atendio ||
      !formData.tiempoPagado ||
      !formData.horaInicio ||
      !formData.horaFinal ||
      !formData.lugarDeJuego ||
      formData.juegosJugados.length === 0 ||
      !formData.totalControles
    ) {
      mostrarNotif(
        "Por favor completa todos los campos obligatorios. Tienen un asterisco",
        "warning",
      );
      return;
    }
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
    try {
      const axios = await getAxios();
      // Los 2 primeros controles son gratis; del 3.º en adelante ₡200 c/u.
      const controlesPagados = Math.max(0, formData.totalControles - 2);
      // Monto real cobrado: en modo "monto" es el exacto ingresado; en modo
      // "tiempo" es el total calculado (tiempo + controles).
      const montoPagado =
        modoRegistro === "monto"
          ? Number(montoInput) || 0
          : calcularCostos(
              formData.lugarDeJuego,
              formData.tiempoPagado,
              formData.totalControles,
            ).total;
      const datosAEnviar = {
        cliente: formData.cliente,
        atendio: formData.atendio,
        tiempoPagado: formData.tiempoPagado,
        tiempoPendiente: formData.tiempoPendiente,
        horaInicio: horaInicio24,
        horaFinal: horaFinal24,
        lugarDeJuego: formData.lugarDeJuego,
        juegosJugados: formData.juegosJugados,
        totalControles: formData.totalControles, // total de controles usados (1-4)
        controlAdicional: controlesPagados,       // controles pagados (compat. costo/reportes)
        montoPagado,                              // monto real cobrado (fuente de verdad del ingreso)
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
      fetchPlays(paginacion.page, filtrosAplicados);
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
      estadoPago: play.estadoPago || "En Proceso",
    });
    // Al editar siempre mostramos el modo por tiempo (el registro ya tiene tiempo)
    setModoRegistro("tiempo");
    setMontoInput("");
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
    fetchPlays(num, filtrosAplicados);
    document
      .querySelector(".tabla-panel")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const minutosATexto = (minutos) => {
    if (minutos === 0) return "0 min";
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}min`;
  };

  if (loading) {
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
              className="btn btn-success btn-lg"
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
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-bold">Cliente *</label>
                      <input
                        type="text"
                        className="form-control form-control-lg"
                        name="cliente"
                        value={formData.cliente}
                        onChange={handleInputChange}
                        placeholder="Nombre del cliente"
                        required
                      />
                    </div>
                    <div className="col-12 mt-4">
                      <h6 className="border-bottom pb-2 mb-3 text-primary fw-bold">
                        🎮 Detalles del Juego
                      </h6>
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-bold">
                        Lugar de Juego *
                      </label>
                      <select
                        className="form-select form-select-lg custom-select-mobile"
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
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-bold">
                        Juegos Jugados agregar almenos 1 (máx. 2) *
                      </label>
                      <select
                        className="form-select select-juegos-mejorado custom-select-mobile"
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
                      <small className="text-muted d-block mt-1">
                        💡 Mantén presionado para seleccionar múltiples
                      </small>
                    </div>
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
                      <div className="col-12">
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
                      </div>
                    ) : (
                      <div className="col-12">
                        <label className="form-label fw-bold">
                          Monto recibido *
                        </label>
                        <div className="input-group input-group-lg">
                          <span className="input-group-text">₡</span>
                          <input
                            type="number"
                            className="form-control"
                            min="0"
                            step="5"
                            value={montoInput}
                            placeholder="425"
                            onChange={(e) => setMontoInput(e.target.value)}
                          />
                        </div>
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
                          💡 Se guarda el monto exacto. El tiempo se calcula y redondea a 5 min.
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
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-bold">
                        Hora Inicio *
                      </label>
                      <input
                        type="text"
                        className="form-control form-control-lg"
                        name="horaInicio"
                        value={formData.horaInicio}
                        onChange={handleInputChange}
                        onBlur={normalizarHoraInicio}
                        placeholder="2:10 PM"
                        required
                      />
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
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-bold">
                        Controles <span className="text-danger">*</span>
                      </label>
                      <select
                        className="form-select form-select-lg custom-select-mobile"
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
                      <small className="text-muted d-block mt-1">
                        Los 2 primeros controles son gratis. Del 3.º en adelante ₡200 c/u.
                      </small>
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label fw-bold">
                        Estado del Pago
                      </label>
                      <select
                        className="form-select form-select-lg custom-select-mobile"
                        name="estadoPago"
                        value={formData.estadoPago}
                        onChange={handleInputChange}
                      >
                        {ESTADOS_PAGO.map((e) => (
                          <option key={e} value={e}>
                            {e}
                          </option>
                        ))}
                      </select>
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
                          <hr className="my-2" />
                          <div className="d-flex justify-content-between">
                            <span className="fw-bold fs-5">
                              {modoRegistro === "monto" ? "MONTO RECIBIDO:" : "TOTAL:"}
                            </span>
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
                      className="btn btn-success btn-lg px-4"
                    >
                      {editando ? "💾 Actualizar" : "✅ Guardar"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ✅ Panel de Filtros */}
          <div className="filtros-panel card mb-3">
            <div className="card-header">
              <span>🔍 Filtrar por Tiempo Pendiente</span>
            </div>
            <div className="card-body">
              <div className="filtros-body">
                {/* Switch */}
                <div className="filtro-switch-wrapper">
                  <div className="form-check form-switch mb-0">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="soloPendiente"
                      checked={filtros.soloPendiente}
                      onChange={(e) => {
                        const nuevosFiltros = {
                          ...filtros,
                          soloPendiente: e.target.checked,
                          minPendienteHoras: "",
                          minPendienteMinutos: "",
                        };
                        setFiltros(nuevosFiltros);
                        // Al ser un toggle binario, aplica inmediatamente sin necesitar "Buscar"
                        setFiltrosAplicados(nuevosFiltros);
                        fetchPlays(1, nuevosFiltros);
                      }}
                    />
                    <label className="form-check-label" htmlFor="soloPendiente">
                      ⏳ Solo con pendiente
                    </label>
                  </div>
                </div>

                {/* Inputs mínimo */}
                {!filtros.soloPendiente && (
                  <div className="filtro-minimo-wrapper">
                    <span className="filtro-label">Pendiente mínimo:</span>
                    <div className="filtro-inputs-row">
                      <div className="input-group filtro-input-group">
                        <input
                          type="number"
                          className="form-control"
                          min="0"
                          max="12"
                          placeholder="0"
                          value={filtros.minPendienteHoras}
                          onChange={(e) =>
                            setFiltros((prev) => ({
                              ...prev,
                              minPendienteHoras: e.target.value,
                            }))
                          }
                        />
                        <span className="input-group-text">h</span>
                      </div>
                      <div className="input-group filtro-input-group">
                        <input
                          type="number"
                          className="form-control"
                          min="0"
                          max="59"
                          placeholder="0"
                          value={filtros.minPendienteMinutos}
                          onChange={(e) =>
                            setFiltros((prev) => ({
                              ...prev,
                              minPendienteMinutos: e.target.value,
                            }))
                          }
                        />
                        <span className="input-group-text">min</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Botones */}
                <div className="filtro-botones">
                  <button
                    className="btn-filtro-buscar"
                    onClick={aplicarFiltros}
                  >
                    🔍 Buscar
                  </button>
                  <button
                    className="btn-filtro-limpiar"
                    onClick={limpiarFiltros}
                    disabled={!hayFiltroActivo && !hayAlgoEscrito}
                  >
                    ✕ Limpiar
                  </button>
                </div>
              </div>

              {/* Badge filtro activo */}
              {hayFiltroActivo && (
                <div className="filtro-activo-badge">
                  <span>
                    ⚠️ Filtro activo —{" "}
                    {filtrosAplicados.soloPendiente
                      ? "Solo con tiempo pendiente"
                      : `Pendiente ≥ ${minutosATexto(
                          (parseInt(filtrosAplicados.minPendienteHoras) || 0) *
                            60 +
                            (parseInt(filtrosAplicados.minPendienteMinutos) ||
                              0),
                        )}`}{" "}
                    · {paginacion.total} resultado(s)
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Tabla */}
          <div className="card tabla-panel shadow-lg">
            <div className="card-header bg-gradient-primary">
              <h5 className="mb-0 text-white">📋 Registros de Plays</h5>
            </div>
            <div className="card-body p-0">
              {plays.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <div className="mb-3">
                    <i className="fs-1">🎮</i>
                  </div>
                  <p className="fs-4 mb-2">
                    {hayFiltroActivo
                      ? "No hay registros con ese tiempo pendiente"
                      : "No hay registros aún"}
                  </p>
                  <small>
                    {hayFiltroActivo
                      ? "Prueba con otros valores o limpia el filtro"
                      : "Agrega tu primer registro usando el botón superior"}
                  </small>
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
                            {play.tiempoPendiente > 0 && (
                              <small className="text-warning d-block">
                                ⏳ {minutosATexto(play.tiempoPendiente)}
                              </small>
                            )}
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
    </div>
  );
};

export default PlaysManagement;
