// src/pages/SalesHistory.jsx
import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import "../styles/SalesHistory.css";
import Navbar from "../components/NavBar2";

const API_URL = import.meta.env.VITE_API_URL;

// Lazy load de axios
let axiosModule = null;
const getAxios = async () => {
  if (!axiosModule) {
    axiosModule = await import("axios");
  }
  return axiosModule.default;
};

const SalesHistory = () => {
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalVentas, setTotalVentas] = useState(0);

  // Filtros
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [buscando, setBuscando] = useState(false);

  // Modal de detalles
  const [ventaSeleccionada, setVentaSeleccionada] = useState(null);
  const [mostrarDetalles, setMostrarDetalles] = useState(false);

  const VENTAS_POR_PAGINA = 10;

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem("token");
    return {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
  }, []);

  const fetchVentas = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const axios = await getAxios();

        // Construir URL con parámetros
        let url = `${API_URL}/api/sales?page=${page}&limit=${VENTAS_POR_PAGINA}`;

        if (fechaInicio) {
          url += `&fechaInicio=${fechaInicio}`;
        }
        if (fechaFin) {
          url += `&fechaFin=${fechaFin}`;
        }

        const response = await axios.get(url, getAuthHeaders());

        console.log("📊 Respuesta de ventas:", response.data);

        // Ajustar según la respuesta de tu API
        const data = response.data;
        setVentas(data.ventas || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotalVentas(data.pagination?.totalVentas || 0);
        setCurrentPage(page);
      } catch (error) {
        console.error("❌ Error al cargar ventas:", error);
        if (error.response?.status === 401 || error.response?.status === 403) {
          alert("⚠️ Sesión expirada. Por favor inicia sesión nuevamente.");
        } else {
          alert("Error al cargar el historial de ventas.");
        }
      } finally {
        setLoading(false);
        setBuscando(false);
      }
    },
    [fechaInicio, fechaFin, getAuthHeaders],
  );

  useEffect(() => {
    document.title = "Historial de Ventas - Sala de Juegos Ruiz";
    fetchVentas(1);
  }, [fetchVentas]);

  const handleBuscarPorFecha = (e) => {
    e.preventDefault();
    setBuscando(true);
    fetchVentas(1);
  };

  const limpiarFiltros = () => {
    setFechaInicio("");
    setFechaFin("");
    setBuscando(true);
    setTimeout(() => fetchVentas(1), 100);
  };

  const cambiarPagina = (nuevaPagina) => {
    if (nuevaPagina >= 1 && nuevaPagina <= totalPages) {
      fetchVentas(nuevaPagina);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const verDetalles = (venta) => {
    setVentaSeleccionada(venta);
    setMostrarDetalles(true);
  };

  const cerrarDetalles = () => {
    setMostrarDetalles(false);
    setVentaSeleccionada(null);
  };

  const eliminarVenta = async (ventaId) => {
    if (
      !window.confirm(
        "¿Estás seguro de eliminar esta venta? Esta acción no se puede deshacer.",
      )
    ) {
      return;
    }

    try {
      const axios = await getAxios();
      await axios.delete(`${API_URL}/api/sales/${ventaId}`, getAuthHeaders());

      alert("✅ Venta eliminada exitosamente");
      fetchVentas(currentPage);
    } catch (error) {
      console.error("❌ Error al eliminar venta:", error);
      alert("Error al eliminar la venta. Por favor intenta nuevamente.");
    }
  };

  const formatearFecha = (fecha) => {
    return new Date(fecha).toLocaleString("es-CR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatearMoneda = (monto) => {
    return `₡${parseFloat(monto).toFixed(2)}`;
  };

  if (loading && ventas.length === 0) {
    return (
      <div className="sales-history-container">
        <Navbar />
        <div className="loading-container">
          <div className="spinner-border text-success" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sales-history-container">
      <Navbar />

      <div className="sales-history-content">
        <div className="container-fluid py-4">
          <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
            <h2 className="sales-history-title mb-0">📊 Historial de Ventas</h2>
            <Link to="/dashboard/sales" className="btn btn-outline-success">
              ← Volver a Ventas
            </Link>
          </div>

          <div className="row">
            <div className="col-12">
              <div className="card history-panel">
                <div className="card-header">
                  <h5 className="mb-0">📋 Ventas Registradas</h5>
                </div>
                <div className="card-body">
                  {/* Filtros de búsqueda */}
                  <div className="filters-section mb-4">
                    <form onSubmit={handleBuscarPorFecha}>
                      <div className="row g-3 align-items-end">
                        <div className="col-md-4">
                          <label className="form-label fw-semibold">
                            📅 Fecha Inicio
                          </label>
                          <input
                            type="date"
                            className="form-control"
                            value={fechaInicio}
                            onChange={(e) => setFechaInicio(e.target.value)}
                          />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label fw-semibold">
                            📅 Fecha Fin
                          </label>
                          <input
                            type="date"
                            className="form-control"
                            value={fechaFin}
                            onChange={(e) => setFechaFin(e.target.value)}
                          />
                        </div>
                        <div className="col-md-4">
                          <div className="d-flex gap-2">
                            <button
                              type="submit"
                              className="btn btn-success flex-fill"
                              disabled={buscando}
                            >
                              {buscando ? (
                                <>
                                  <span className="spinner-border spinner-border-sm me-2"></span>
                                  Buscando...
                                </>
                              ) : (
                                <>🔍 Buscar</>
                              )}
                            </button>
                            {(fechaInicio || fechaFin) && (
                              <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={limpiarFiltros}
                                disabled={buscando}
                              >
                                ✕ Limpiar
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </form>
                  </div>

                  {/* Información de resultados */}
                  {totalVentas > 0 && (
                    <div className="mb-3">
                      <small className="text-muted">
                        Mostrando {ventas.length} de {totalVentas} ventas
                        {(fechaInicio || fechaFin) && " (filtradas)"}
                      </small>
                    </div>
                  )}

                  {/* Tabla de ventas */}
                  {loading ? (
                    <div className="text-center py-5">
                      <div
                        className="spinner-border text-success"
                        role="status"
                      >
                        <span className="visually-hidden">Cargando...</span>
                      </div>
                    </div>
                  ) : ventas.length === 0 ? (
                    <div className="alert alert-info text-center">
                      📦 No hay ventas registradas
                      {(fechaInicio || fechaFin) &&
                        " en el rango de fechas seleccionado"}
                    </div>
                  ) : (
                    <>
                      <div className="table-responsive">
                        <table className="table table-ventas table-hover">
                          <thead>
                            <tr>
                              <th>ID</th>
                              <th>Fecha</th>
                              <th>Usuario</th>
                              <th>Productos</th>
                              <th>Total</th>
                              <th className="text-center">Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ventas.map((venta) => (
                              <tr key={venta._id}>
                                <td>
                                  <small className="text-muted">
                                    #{venta._id.slice(-8)}
                                  </small>
                                </td>
                                <td>{formatearFecha(venta.fecha)}</td>
                                <td>
                                  <small className="text-primary">
                                    {venta.nombreUsuario ||
                                      venta.usuario?.nombre ||
                                      "N/A"}
                                  </small>
                                </td>
                                <td>
                                  <div className="productos-list">
                                    {venta.productos
                                      ?.slice(0, 2)
                                      .map((p, i) => (
                                        <small key={i} className="d-block">
                                          • {p.nombre} x{p.cantidad}
                                        </small>
                                      ))}
                                    {venta.productos?.length > 2 && (
                                      <small className="text-muted">
                                        +{venta.productos.length - 2} más
                                      </small>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <strong className="text-success">
                                    {formatearMoneda(venta.total)}
                                  </strong>
                                </td>
                                <td className="text-center">
                                  <div className="btn-action-group justify-content-center">
                                    <button
                                      className="btn btn-sm btn-info btn-action"
                                      onClick={() => verDetalles(venta)}
                                      title="Ver detalles"
                                    >
                                      👁️
                                    </button>
                                    <button
                                      className="btn btn-sm btn-danger btn-action"
                                      onClick={() => eliminarVenta(venta._id)}
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

                      {/* Paginación */}
                      {totalPages > 1 && (
                        <div className="pagination-container">
                          <nav>
                            <ul className="pagination mb-0">
                              <li
                                className={`page-item ${currentPage === 1 ? "disabled" : ""}`}
                              >
                                <button
                                  className="page-link"
                                  onClick={() => cambiarPagina(currentPage - 1)}
                                  disabled={currentPage === 1}
                                >
                                  ← Anterior
                                </button>
                              </li>

                              {[...Array(totalPages)].map((_, index) => {
                                const pageNumber = index + 1;
                                // Mostrar solo 5 páginas alrededor de la actual
                                if (
                                  pageNumber === 1 ||
                                  pageNumber === totalPages ||
                                  (pageNumber >= currentPage - 2 &&
                                    pageNumber <= currentPage + 2)
                                ) {
                                  return (
                                    <li
                                      key={pageNumber}
                                      className={`page-item ${pageNumber === currentPage ? "active" : ""}`}
                                    >
                                      <button
                                        className="page-link"
                                        onClick={() =>
                                          cambiarPagina(pageNumber)
                                        }
                                      >
                                        {pageNumber}
                                      </button>
                                    </li>
                                  );
                                } else if (
                                  pageNumber === currentPage - 3 ||
                                  pageNumber === currentPage + 3
                                ) {
                                  return (
                                    <li
                                      key={pageNumber}
                                      className="page-item disabled"
                                    >
                                      <span className="page-link">...</span>
                                    </li>
                                  );
                                }
                                return null;
                              })}

                              <li
                                className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}
                              >
                                <button
                                  className="page-link"
                                  onClick={() => cambiarPagina(currentPage + 1)}
                                  disabled={currentPage === totalPages}
                                >
                                  Siguiente →
                                </button>
                              </li>
                            </ul>
                          </nav>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Detalles */}
      {mostrarDetalles && ventaSeleccionada && (
        <div className="modal-overlay" onClick={cerrarDetalles}>
          <div className="modal-detalles" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-detalles">
              <h3>📋 Detalle de Venta</h3>
              <button className="btn-close-modal" onClick={cerrarDetalles}>
                ✕
              </button>
            </div>
            <div className="modal-body-detalles">
              <div className="detalle-row">
                <span className="detalle-label">ID:</span>
                <span className="detalle-value">
                  #{ventaSeleccionada._id.slice(-12)}
                </span>
              </div>
              <div className="detalle-row">
                <span className="detalle-label">Fecha:</span>
                <span className="detalle-value">
                  {formatearFecha(ventaSeleccionada.fecha)}
                </span>
              </div>
              {/* ✅ AGREGAR USUARIO */}
              <div className="detalle-row">
                <span className="detalle-label">Vendedor:</span>
                <span className="detalle-value">
                  {ventaSeleccionada.nombreUsuario ||
                    ventaSeleccionada.usuario?.nombre ||
                    "N/A"}
                </span>
              </div>
              <div className="detalle-row">
                <span className="detalle-label">Monto Pagado:</span>
                <span className="detalle-value">
                  {formatearMoneda(ventaSeleccionada.montoPagado)}
                </span>
              </div>
              <div className="detalle-row">
                <span className="detalle-label">Vuelto:</span>
                <span className="detalle-value">
                  {formatearMoneda(ventaSeleccionada.vuelto)}
                </span>
              </div>

              <div className="productos-detalle">
                <h6>Productos:</h6>
                <div className="productos-detalle-list">
                  {ventaSeleccionada.productos.map((p, i) => (
                    <div key={i} className="producto-detalle-item">
                      <div className="producto-detalle-info">
                        <strong>{p.nombre}</strong>
                        <small>
                          {p.cantidad} x {formatearMoneda(p.precioVenta)}
                        </small>
                      </div>
                      <div className="producto-detalle-subtotal">
                        {formatearMoneda(p.subtotal)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="detalle-total">
                <span>Total:</span>
                <strong>{formatearMoneda(ventaSeleccionada.total)}</strong>
              </div>
            </div>
            <div className="modal-footer-detalles">
              <button className="btn btn-primary" onClick={cerrarDetalles}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesHistory;
