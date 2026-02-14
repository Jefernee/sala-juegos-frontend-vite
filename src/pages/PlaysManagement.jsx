// src/pages/PlaysManagement.jsx
import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import "../styles/PlaysManagement.css";
import Navbar from "../components/NavBar2";

const API_URL = import.meta.env.VITE_API_URL;

let axiosModule = null;
const getAxios = async () => {
  if (!axiosModule) {
    axiosModule = await import("axios");
  }
  return axiosModule.default;
};

// Constantes para los selects
const LUGARES_JUEGO = [
  'Play 4 número 1',
  'Play 4 número 2',
  'Play 4 número 3',
  'Play 5 número 1',
  'Play 5 número 2',
  'Ping Pong'
];

const JUEGOS_DISPONIBLES = [
  'Dragon Ball Sparking Zero',
  'FIFA 25',
  'Call of Duty',
  'Mortal Kombat 1',
  'NBA 2K24',
  'GTA V',
  'Minecraft',
  'Fortnite',
  'Rocket League',
  'EA Sports FC 25',
  'Resident Evil',
  'Spider-Man 2',
  'God of War Ragnarök'
];

const ESTADOS_PAGO = [
  'En Proceso',
  'Completado',
  'Pendiente'
];

// Función para obtener el usuario logueado
const obtenerUsuarioLogueado = () => {
  try {
    const userString = localStorage.getItem('user');
    if (userString) {
      const user = JSON.parse(userString);
      return user.nombre || user.name || '';
    }
    return '';
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    return '';
  }
};

// Función para sumar minutos a una hora
const sumarMinutosAHora = (horaInicio, minutosASumar) => {
  if (!horaInicio) return '';
  
  const [horas, minutos] = horaInicio.split(':').map(Number);
  const totalMinutos = horas * 60 + minutos + minutosASumar;
  
  const nuevasHoras = Math.floor(totalMinutos / 60) % 24;
  const nuevosMinutos = totalMinutos % 60;
  
  return `${String(nuevasHoras).padStart(2, '0')}:${String(nuevosMinutos).padStart(2, '0')}`;
};

// Función para obtener hora actual en formato 12h
const obtenerHoraActual12h = () => {
  const ahora = new Date();
  let horas = ahora.getHours();
  const minutos = ahora.getMinutes();
  const periodo = horas >= 12 ? 'PM' : 'AM';
  horas = horas % 12 || 12;
  return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')} ${periodo}`;
};

// Función para convertir formato 24h a 12h
const convertirA12Horas = (hora24) => {
  if (!hora24) return '';
  const [horas, minutos] = hora24.split(':').map(Number);
  const periodo = horas >= 12 ? 'PM' : 'AM';
  const horas12 = horas % 12 || 12;
  return `${horas12}:${String(minutos).padStart(2, '0')} ${periodo}`;
};

// Función para convertir formato 12h a 24h para guardar
const convertir12hA24h = (hora12) => {
  if (!hora12) return '';
  
  const match = hora12.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return '';
  
  let horas = parseInt(match[1]);
  const minutos = match[2];
  const periodo = match[3].toUpperCase();
  
  if (periodo === 'PM' && horas !== 12) {
    horas += 12;
  } else if (periodo === 'AM' && horas === 12) {
    horas = 0;
  }
  
  return `${String(horas).padStart(2, '0')}:${minutos}`;
};

const PlaysManagement = () => {
  const [plays, setPlays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [editando, setEditando] = useState(null);
  const [mostrarNotificacion, setMostrarNotificacion] = useState(false);
  const [notificacion, setNotificacion] = useState(null);

  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    cliente: "",
    atendio: obtenerUsuarioLogueado(),
    tiempoPagado: 0,
    tiempoPendiente: 0,
    horaInicio: obtenerHoraActual12h(),
    horaFinal: "",
    lugarDeJuego: "",
    juegosJugados: [],
    controlAdicional: 0,
    estadoPago: "En Proceso"
  });

  // Estado para los inputs de tiempo (horas y minutos separados)
  const [tiempoPagadoInput, setTiempoPagadoInput] = useState({ horas: '', minutos: '' });
  const [tiempoPendienteInput, setTiempoPendienteInput] = useState({ horas: '', minutos: '' });

  // Estado para mostrar el desglose de costos (SOLO PARA PREVIEW)
  const [desgloseCostos, setDesgloseCostos] = useState({
    subtotal: 0,
    costoControles: 0,
    total: 0
  });

  // Estado para paginación
  const [paginacion, setPaginacion] = useState({
    page: 1,
    limit: 5,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false
  });

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem("token");
    return {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
  }, []);

  // Función para calcular costos en tiempo real (SOLO PARA MOSTRAR AL USUARIO)
  const calcularCostos = useCallback((lugarDeJuego, tiempoPagado, controlAdicional) => {
    if (!lugarDeJuego || !tiempoPagado) {
      return { subtotal: 0, costoControles: 0, total: 0 };
    }

    let precioPorHora = 0;
    
    if (lugarDeJuego.includes('Play 5')) {
      precioPorHora = 1000;
    } else if (lugarDeJuego.includes('Play 4')) {
      precioPorHora = 800;
    } else if (lugarDeJuego === 'Ping Pong') {
      precioPorHora = 800;
    }
    
    const subtotal = Math.round((tiempoPagado / 60) * precioPorHora);
    const costoControles = controlAdicional * 200;
    const total = subtotal + costoControles;
    
    return { subtotal, costoControles, total };
  }, []);

  // Actualizar hora final cuando cambian hora inicio o tiempo pagado
  useEffect(() => {
    if (formData.horaInicio && formData.tiempoPagado > 0) {
      const hora24 = convertir12hA24h(formData.horaInicio);
      const nuevaHoraFinal24 = sumarMinutosAHora(hora24, formData.tiempoPagado);
      const nuevaHoraFinal12 = convertirA12Horas(nuevaHoraFinal24);
      setFormData(prev => ({
        ...prev,
        horaFinal: nuevaHoraFinal12
      }));
    }
  }, [formData.horaInicio, formData.tiempoPagado]);

  // Actualizar costos cuando cambian los campos relevantes (SOLO PARA PREVIEW)
  useEffect(() => {
    const costos = calcularCostos(
      formData.lugarDeJuego,
      formData.tiempoPagado,
      formData.controlAdicional
    );
    setDesgloseCostos(costos);
  }, [formData.lugarDeJuego, formData.tiempoPagado, formData.controlAdicional, calcularCostos]);

  const fetchPlays = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const axios = await getAxios();
      const response = await axios.get(
        `${API_URL}/api/plays?page=${page}&limit=5`,
        getAuthHeaders()
      );
      
      setPlays(response.data.data || []);
      setPaginacion(response.data.pagination || {
        page: 1,
        limit: 5,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false
      });
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
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchPlays();
    document.title = "Gestión de Plays - Sala de Juegos Ruiz";
  }, [fetchPlays]);

  const mostrarNotif = (mensaje, tipo = "success", detalle = "") => {
    setNotificacion({ mensaje, tipo, detalle });
    setMostrarNotificacion(true);
    setTimeout(() => setMostrarNotificacion(false), 5000);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'controlAdicional' ? Number(value) : value
    }));
  };

  // Manejador para cambios en tiempo pagado
  const handleTiempoPagadoChange = (tipo, valor) => {
    const nuevoValor = valor === '' ? '' : Math.max(0, parseInt(valor) || 0);
    
    const nuevosTiempos = {
      ...tiempoPagadoInput,
      [tipo]: tipo === 'horas' ? (nuevoValor === '' ? '' : Math.min(nuevoValor, 12)) : (nuevoValor === '' ? '' : Math.min(nuevoValor, 59))
    };
    
    setTiempoPagadoInput(nuevosTiempos);
    
    const horas = nuevosTiempos.horas === '' ? 0 : nuevosTiempos.horas;
    const minutos = nuevosTiempos.minutos === '' ? 0 : nuevosTiempos.minutos;
    const totalMinutos = (horas * 60) + minutos;
    
    setFormData(prev => ({
      ...prev,
      tiempoPagado: totalMinutos
    }));
  };

  // Manejador para cambios en tiempo pendiente
  const handleTiempoPendienteChange = (tipo, valor) => {
    if (!editando) return;
    
    const nuevoValor = valor === '' ? '' : Math.max(0, parseInt(valor) || 0);
    
    const nuevosTiempos = {
      ...tiempoPendienteInput,
      [tipo]: tipo === 'horas' ? (nuevoValor === '' ? '' : Math.min(nuevoValor, 12)) : (nuevoValor === '' ? '' : Math.min(nuevoValor, 59))
    };
    
    setTiempoPendienteInput(nuevosTiempos);
    
    const horas = nuevosTiempos.horas === '' ? 0 : nuevosTiempos.horas;
    const minutos = nuevosTiempos.minutos === '' ? 0 : nuevosTiempos.minutos;
    const totalMinutos = (horas * 60) + minutos;
    
    setFormData(prev => ({
      ...prev,
      tiempoPendiente: totalMinutos
    }));
  };

  const handleJuegoChange = (e) => {
    const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
    
    if (selectedOptions.length > 2) {
      mostrarNotif("Solo puedes seleccionar hasta 2 juegos", "warning");
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      juegosJugados: selectedOptions
    }));
  };

  const limpiarFormulario = () => {
    setFormData({
      fecha: new Date().toISOString().split('T')[0],
      cliente: "",
      atendio: obtenerUsuarioLogueado(),
      tiempoPagado: 0,
      tiempoPendiente: 0,
      horaInicio: obtenerHoraActual12h(),
      horaFinal: "",
      lugarDeJuego: "",
      juegosJugados: [],
      controlAdicional: 0,
      estadoPago: "En Proceso"
    });
    setTiempoPagadoInput({ horas: '', minutos: '' });
    setTiempoPendienteInput({ horas: '', minutos: '' });
    setDesgloseCostos({ subtotal: 0, costoControles: 0, total: 0 });
    setEditando(null);
    setMostrarFormulario(false);
  };

  const abrirFormularioNuevo = () => {
    limpiarFormulario();
    setMostrarFormulario(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.cliente || !formData.atendio || !formData.tiempoPagado || 
        !formData.horaInicio || !formData.horaFinal || !formData.lugarDeJuego) {
      mostrarNotif("Por favor completa todos los campos obligatorios", "warning");
      return;
    }

    try {
      const axios = await getAxios();
      
      // Convertir horas de 12h a 24h para guardar
      const horaInicio24 = convertir12hA24h(formData.horaInicio);
      const horaFinal24 = convertir12hA24h(formData.horaFinal);
      
      // ✅ Solo enviar datos básicos - el backend calcula todo lo demás
      const datosAEnviar = {
        fecha: formData.fecha,
        cliente: formData.cliente,
        atendio: formData.atendio,
        tiempoPagado: formData.tiempoPagado,
        tiempoPendiente: formData.tiempoPendiente,
        horaInicio: horaInicio24,
        horaFinal: horaFinal24,
        lugarDeJuego: formData.lugarDeJuego,
        juegosJugados: formData.juegosJugados,
        controlAdicional: formData.controlAdicional,
        estadoPago: formData.estadoPago
      };

      if (editando) {
        await axios.put(
          `${API_URL}/api/plays/${editando}`,
          datosAEnviar,
          getAuthHeaders()
        );
        mostrarNotif("Play actualizado exitosamente", "success");
      } else {
        await axios.post(
          `${API_URL}/api/plays`,
          datosAEnviar,
          getAuthHeaders()
        );
        mostrarNotif("Play registrado exitosamente", "success");
      }

      limpiarFormulario();
      fetchPlays(paginacion.page);
    } catch (error) {
      console.error("❌ Error:", error);
      
      let mensajeError = "Error al guardar el play";
      let detalle = "";
      
      if (error.response) {
        mensajeError = error.response.data?.message || mensajeError;
        detalle = error.response.data?.error || "";
        
        if (error.response.data?.errors) {
          const erroresValidacion = Object.values(error.response.data.errors)
            .map(err => err.message)
            .join(", ");
          detalle = erroresValidacion;
        }
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
    const horasPagado = Math.floor(play.tiempoPagado / 60);
    const minutosPagado = play.tiempoPagado % 60;
    
    const horasPendiente = Math.floor((play.tiempoPendiente || 0) / 60);
    const minutosPendiente = (play.tiempoPendiente || 0) % 60;
    
    setTiempoPagadoInput({ horas: horasPagado, minutos: minutosPagado });
    setTiempoPendienteInput({ horas: horasPendiente, minutos: minutosPendiente });
    
    setFormData({
      fecha: play.fecha.split('T')[0],
      cliente: play.cliente,
      atendio: play.atendio,
      tiempoPagado: play.tiempoPagado,
      tiempoPendiente: play.tiempoPendiente || 0,
      horaInicio: convertirA12Horas(play.horaInicio),
      horaFinal: convertirA12Horas(play.horaFinal),
      lugarDeJuego: play.lugarDeJuego,
      juegosJugados: play.juegosJugados || [],
      controlAdicional: play.controlAdicional || 0,
      estadoPago: play.estadoPago || "En Proceso"
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
      
      if (plays.length === 1 && paginacion.page > 1) {
        fetchPlays(paginacion.page - 1);
      } else {
        fetchPlays(paginacion.page);
      }
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

  // Funciones de paginación
  const irAPagina = (numeroPagina) => {
    fetchPlays(numeroPagina);
    document.querySelector('.tabla-panel')?.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'start' 
    });
  };

  const paginaAnterior = () => {
    if (paginacion.hasPrevPage) {
      irAPagina(paginacion.page - 1);
    }
  };

  const paginaSiguiente = () => {
    if (paginacion.hasNextPage) {
      irAPagina(paginacion.page + 1);
    }
  };

  // Función helper para convertir minutos a texto
  const minutosATexto = (minutos) => {
    if (minutos === 0) return "0 min";
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    
    if (horas === 0) return `${mins} min`;
    if (mins === 0) return `${horas}h`;
    return `${horas}h ${mins}min`;
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
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2 className="plays-title mb-0">🎮 Control de Plays</h2>
            <button
              className="btn btn-success btn-lg"
              onClick={() => {
                if (mostrarFormulario) {
                  limpiarFormulario();
                } else {
                  abrirFormularioNuevo();
                }
              }}
            >
              {mostrarFormulario ? "❌ Cancelar" : "➕ Nuevo Registro"}
            </button>
          </div>

          {mostrarFormulario && (
            <div className="card formulario-panel mb-4 shadow-lg">
              <div className="card-header bg-gradient-primary">
                <h5 className="mb-0 text-white">
                  {editando ? "✏️ Editar Registro" : "➕ Nuevo Registro de Play"}
                </h5>
              </div>
              <div className="card-body p-4">
                <form onSubmit={handleSubmit}>
                  <div className="row g-3">
                    {/* Información básica */}
                    <div className="col-12">
                      <h6 className="border-bottom pb-2 mb-3 text-primary fw-bold">
                        📋 Información Básica
                      </h6>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label fw-bold">Fecha *</label>
                      <input
                        type="date"
                        className="form-control form-control-lg"
                        name="fecha"
                        value={formData.fecha}
                        onChange={handleInputChange}
                        required
                      />
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

                    {/* Detalles del juego */}
                    <div className="col-12 mt-4">
                      <h6 className="border-bottom pb-2 mb-3 text-primary fw-bold">
                        🎮 Detalles del Juego
                      </h6>
                    </div>

                    <div className="col-12">
                      <label className="form-label fw-bold">Lugar de Juego *</label>
                      <select
                        className="form-select form-select-lg custom-select-mobile"
                        name="lugarDeJuego"
                        value={formData.lugarDeJuego}
                        onChange={handleInputChange}
                        required
                      >
                        <option value="">Seleccionar lugar...</option>
                        {LUGARES_JUEGO.map(lugar => (
                          <option key={lugar} value={lugar}>
                            {lugar} - ₡{lugar.includes('Play 5') ? '1000' : '800'}/hora
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-12">
                      <label className="form-label fw-bold">Juegos Jugados (máx. 2)</label>
                      <select
                        className="form-select select-juegos-mejorado custom-select-mobile"
                        multiple
                        value={formData.juegosJugados}
                        onChange={handleJuegoChange}
                        size="3"
                      >
                        {JUEGOS_DISPONIBLES.map(juego => (
                          <option key={juego} value={juego}>{juego}</option>
                        ))}
                      </select>
                      <small className="text-muted d-block mt-1">
                        💡 Mantén presionado para seleccionar múltiples
                      </small>
                    </div>

                    {/* Tiempos y horarios */}
                    <div className="col-12 mt-4">
                      <h6 className="border-bottom pb-2 mb-3 text-primary fw-bold">
                        ⏰ Tiempos y Horarios
                      </h6>
                    </div>

                    <div className="col-12">
                      <label className="form-label fw-bold">Tiempo Pagado *</label>
                      <div className="row g-2">
                        <div className="col-6">
                          <div className="input-group input-group-lg">
                            <input
                              type="number"
                              className="form-control"
                              min="0"
                              max="12"
                              value={tiempoPagadoInput.horas}
                              onChange={(e) => handleTiempoPagadoChange('horas', e.target.value)}
                              placeholder="0"
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
                              onChange={(e) => handleTiempoPagadoChange('minutos', e.target.value)}
                              placeholder="0"
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

                    <div className="col-12">
                      <label className="form-label fw-bold">
                        Tiempo Pendiente {editando && '*'}
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
                              onChange={(e) => handleTiempoPendienteChange('horas', e.target.value)}
                              placeholder="0"
                              disabled={!editando}
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
                              onChange={(e) => handleTiempoPendienteChange('minutos', e.target.value)}
                              placeholder="0"
                              disabled={!editando}
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
                      <label className="form-label fw-bold">Hora Inicio *</label>
                      <input
                        type="text"
                        className="form-control form-control-lg"
                        name="horaInicio"
                        value={formData.horaInicio}
                        onChange={handleInputChange}
                        placeholder="2:10 PM"
                        required
                      />
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label fw-bold">Hora Final (calculada)</label>
                      <input
                        type="text"
                        className="form-control form-control-lg bg-light"
                        value={formData.horaFinal}
                        readOnly
                        disabled
                        placeholder="4:10 PM"
                        style={{ cursor: 'not-allowed' }}
                      />
                    </div>

                    {/* Costos */}
                    <div className="col-12 mt-4">
                      <h6 className="border-bottom pb-2 mb-3 text-primary fw-bold">
                        💰 Costos y Estado
                      </h6>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label fw-bold">
                        Controles Adicionales (₡200 c/u)
                      </label>
                      <select
                        className="form-select form-select-lg custom-select-mobile"
                        name="controlAdicional"
                        value={formData.controlAdicional}
                        onChange={handleInputChange}
                      >
                        <option value={0}>Sin control adicional</option>
                        <option value={1}>1 control (+₡200)</option>
                        <option value={2}>2 controles (+₡400)</option>
                      </select>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label fw-bold">Estado del Pago</label>
                      <select
                        className="form-select form-select-lg custom-select-mobile"
                        name="estadoPago"
                        value={formData.estadoPago}
                        onChange={handleInputChange}
                      >
                        {ESTADOS_PAGO.map(estado => (
                          <option key={estado} value={estado}>{estado}</option>
                        ))}
                      </select>
                    </div>

                    {/* Desglose de costos */}
                    <div className="col-12">
                      <div className="card bg-light border-success">
                        <div className="card-body">
                          <h6 className="text-success mb-3 fw-bold">💵 Resumen de Cobro</h6>
                          <div className="d-flex justify-content-between mb-2">
                            <span>Tiempo de juego:</span>
                            <strong>₡{desgloseCostos.subtotal.toLocaleString()}</strong>
                          </div>
                          <div className="d-flex justify-content-between mb-2">
                            <span>Controles extra:</span>
                            <strong>₡{desgloseCostos.costoControles.toLocaleString()}</strong>
                          </div>
                          <hr className="my-2" />
                          <div className="d-flex justify-content-between">
                            <span className="fw-bold fs-5">TOTAL:</span>
                            <span className="fw-bold fs-4 text-success">
                              ₡{desgloseCostos.total.toLocaleString()}
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
                    <button type="submit" className="btn btn-success btn-lg px-4">
                      {editando ? "💾 Actualizar" : "✅ Guardar"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Tabla de registros */}
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
                  <p className="fs-4 mb-2">No hay registros aún</p>
                  <small>Agrega tu primer registro de play usando el botón superior</small>
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
                            {new Date(play.fecha).toLocaleDateString('es-CR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            })}
                          </td>
                          <td className="px-3 py-3 fw-semibold">{play.cliente}</td>
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
                            <small className="d-block">{convertirA12Horas(play.horaInicio)}</small>
                            <small className="text-muted">{convertirA12Horas(play.horaFinal)}</small>
                          </td>
                          <td className="px-3 py-3">
                            <span className="badge bg-info text-dark">
                              {play.lugarDeJuego}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            {play.juegosJugados && play.juegosJugados.length > 0 ? (
                              <div className="juegos-list">
                                {play.juegosJugados.map((juego, index) => (
                                  <small key={index} className="d-block text-truncate" style={{maxWidth: '150px'}}>
                                    🎮 {juego}
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
                            {play.controlAdicional > 0 && (
                              <small className="text-muted d-block">
                                +{play.controlAdicional} control(es)
                              </small>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <span className={`badge ${
                              play.estadoPago === 'Completado' ? 'bg-success' :
                              play.estadoPago === 'En Proceso' ? 'bg-warning text-dark' :
                              'bg-danger'
                            } px-3 py-2`}>
                              {play.estadoPago}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <div className="btn-group btn-group-sm" role="group">
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

            {/* Paginación */}
            {paginacion.totalPages > 1 && (
              <div className="card-footer bg-light border-top">
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                  <div className="text-muted small">
                    Mostrando {plays.length} de {paginacion.total} registros
                    <span className="d-none d-sm-inline"> (Página {paginacion.page} de {paginacion.totalPages})</span>
                  </div>
                  
                  <nav aria-label="Paginación de plays">
                    <ul className="pagination pagination-sm mb-0">
                      <li className={`page-item ${!paginacion.hasPrevPage ? 'disabled' : ''}`}>
                        <button
                          className="page-link"
                          onClick={() => irAPagina(1)}
                          disabled={!paginacion.hasPrevPage}
                          aria-label="Primera página"
                        >
                          <span aria-hidden="true">««</span>
                        </button>
                      </li>
                      
                      <li className={`page-item ${!paginacion.hasPrevPage ? 'disabled' : ''}`}>
                        <button
                          className="page-link"
                          onClick={paginaAnterior}
                          disabled={!paginacion.hasPrevPage}
                          aria-label="Página anterior"
                        >
                          <span aria-hidden="true">‹</span>
                        </button>
                      </li>
                      
                      {Array.from({ length: paginacion.totalPages }, (_, i) => i + 1)
                        .filter(num => {
                          const current = paginacion.page;
                          return (
                            num === 1 ||
                            num === paginacion.totalPages ||
                            (num >= current - 1 && num <= current + 1)
                          );
                        })
                        .map((num, index, array) => {
                          const prevNum = array[index - 1];
                          const showSeparator = prevNum && num - prevNum > 1;
                          
                          return (
                            <React.Fragment key={num}>
                              {showSeparator && (
                                <li className="page-item disabled d-none d-sm-block">
                                  <span className="page-link">...</span>
                                </li>
                              )}
                              <li className={`page-item ${paginacion.page === num ? 'active' : ''}`}>
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
                      
                      <li className={`page-item ${!paginacion.hasNextPage ? 'disabled' : ''}`}>
                        <button
                          className="page-link"
                          onClick={paginaSiguiente}
                          disabled={!paginacion.hasNextPage}
                          aria-label="Página siguiente"
                        >
                          <span aria-hidden="true">›</span>
                        </button>
                      </li>
                      
                      <li className={`page-item ${!paginacion.hasNextPage ? 'disabled' : ''}`}>
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