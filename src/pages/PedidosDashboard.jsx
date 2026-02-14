import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import "../styles/PedidosDashboard.css";
import Navbar from "../components/NavBar2";

const PedidosDashboard = () => {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const fetchPedidos = useCallback(async () => {
    setLoading(true);
    try {
      const url = filtroEstado
        ? `${import.meta.env.VITE_API_URL}/api/pedidos?estado=${filtroEstado}`
        : `${import.meta.env.VITE_API_URL}/api/pedidos`;

      const response = await axios.get(url);
      setPedidos(response.data.pedidos);
    } catch (error) {
      console.error("Error al cargar pedidos:", error);
      alert("Error al cargar pedidos");
    } finally {
      setLoading(false);
    }
  }, [filtroEstado]);

  // useEffect al nivel superior
  useEffect(() => {
    fetchPedidos();
  }, [fetchPedidos]);

  const handleVerDetalle = (pedido) => {
    setSelectedPedido(pedido);
    setShowModal(true);
  };

  const handleCambiarEstado = async (pedidoId, nuevoEstado) => {
    try {
      await axios.patch(
        `${import.meta.env.VITE_API_URL}/api/pedidos/${pedidoId}`,
        {
          estado: nuevoEstado,
        }
      );

      alert("Estado actualizado correctamente");
      fetchPedidos();
      setShowModal(false);
    } catch (error) {
      console.error("Error al cambiar estado:", error);
      alert("Error al cambiar estado");
    }
  };

  const getEstadoBadge = (estado) => {
    const badges = {
      pendiente: "badge-warning",
      confirmado: "badge-info",
      completado: "badge-success",
      cancelado: "badge-danger",
    };
    return badges[estado] || "badge-secondary";
  };

  const getEstadoEmoji = (estado) => {
    const emojis = {
      pendiente: "⏳",
      confirmado: "✅",
      completado: "🎉",
      cancelado: "❌",
    };
    return emojis[estado] || "📦";
  };

  if (loading) {
    return (
      <div className="pedidos-dashboard">
        <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
          <div className="container-fluid">
            <Link className="navbar-brand fw-bold" to="/">
              🎮 Sala de Juegos Ruiz
            </Link>
          </div>
        </nav>
        <div className="loading-container">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pedidos-dashboard">
      {/* Navbar */}
      <Navbar />

      {/* Contenido */}
      <div className="pedidos-content">
        <div className="container py-4">
          <h2 className="pedidos-title mb-4">📦 Gestión de Pedidos</h2>

          {/* Filtros */}
          <div className="filtros-section mb-4">
            <div className="btn-group" role="group">
              <button
                className={`btn ${filtroEstado === "" ? "btn-primary" : "btn-outline-primary"}`}
                onClick={() => setFiltroEstado("")}
              >
                Todos
              </button>
              <button
                className={`btn ${filtroEstado === "pendiente" ? "btn-warning" : "btn-outline-warning"}`}
                onClick={() => setFiltroEstado("pendiente")}
              >
                ⏳ Pendientes
              </button>
              <button
                className={`btn ${filtroEstado === "confirmado" ? "btn-info" : "btn-outline-info"}`}
                onClick={() => setFiltroEstado("confirmado")}
              >
                ✅ Confirmados
              </button>
              <button
                className={`btn ${filtroEstado === "completado" ? "btn-success" : "btn-outline-success"}`}
                onClick={() => setFiltroEstado("completado")}
              >
                🎉 Completados
              </button>
              <button
                className={`btn ${filtroEstado === "cancelado" ? "btn-danger" : "btn-outline-danger"}`}
                onClick={() => setFiltroEstado("cancelado")}
              >
                ❌ Cancelados
              </button>
            </div>
          </div>

          {/* Lista de pedidos */}
          {pedidos.length === 0 ? (
            <div className="alert alert-info">
              📭 No hay pedidos {filtroEstado && `con estado "${filtroEstado}"`}
            </div>
          ) : (
            <div className="pedidos-grid">
              {pedidos.map((pedido) => (
                <div key={pedido._id} className="pedido-card">
                  <div className="pedido-header">
                    <span className={`badge ${getEstadoBadge(pedido.estado)}`}>
                      {getEstadoEmoji(pedido.estado)}{" "}
                      {pedido.estado.toUpperCase()}
                    </span>
                    <span className="pedido-fecha">
                      {new Date(pedido.createdAt).toLocaleDateString("es-ES")}
                    </span>
                  </div>

                  <div className="pedido-body">
                    <h5 className="pedido-producto">{pedido.productoNombre}</h5>

                    <div className="pedido-info">
                      <div className="info-item">
                        <span className="label">Cliente:</span>
                        <span className="value">{pedido.nombreCliente}</span>
                      </div>
                      <div className="info-item">
                        <span className="label">Teléfono:</span>
                        <span className="value">{pedido.telefono}</span>
                      </div>
                      <div className="info-item">
                        <span className="label">Cantidad:</span>
                        <span className="value">
                          {pedido.cantidad} unidades
                        </span>
                      </div>
                      <div className="info-item">
                        <span className="label">Total:</span>
                        <span className="value total">
                          ₡{pedido.total.toLocaleString("es-CR")}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pedido-footer">
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => handleVerDetalle(pedido)}
                    >
                      Ver Detalle
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de detalle */}
      {showModal && selectedPedido && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📦 Detalle del Pedido</h3>
              <button className="btn-close" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="detalle-section">
                <h5>Cliente</h5>
                <p>
                  <strong>Nombre:</strong> {selectedPedido.nombreCliente}
                </p>
                <p>
                  <strong>Teléfono:</strong> {selectedPedido.telefono}
                </p>
                {selectedPedido.email && (
                  <p>
                    <strong>Email:</strong> {selectedPedido.email}
                  </p>
                )}
              </div>

              <div className="detalle-section">
                <h5>Producto</h5>
                <p>
                  <strong>Nombre:</strong> {selectedPedido.productoNombre}
                </p>
                <p>
                  <strong>Cantidad:</strong> {selectedPedido.cantidad} unidades
                </p>
                <p>
                  <strong>Precio unitario:</strong> ₡
                  {selectedPedido.precioVenta.toLocaleString("es-CR")}
                </p>
                <p>
                  <strong>Total:</strong> ₡
                  {selectedPedido.total.toLocaleString("es-CR")}
                </p>
              </div>

              {selectedPedido.notas && (
                <div className="detalle-section">
                  <h5>Notas</h5>
                  <p>{selectedPedido.notas}</p>
                </div>
              )}

              <div className="detalle-section">
                <h5>Estado Actual</h5>
                <span
                  className={`badge ${getEstadoBadge(selectedPedido.estado)}`}
                >
                  {selectedPedido.estado.toUpperCase()}
                </span>
              </div>

              <div className="detalle-section">
                <h5>Cambiar Estado</h5>
                <div className="btn-group-vertical w-100">
                  {selectedPedido.estado !== "pendiente" && (
                    <button
                      className="btn btn-warning mb-2"
                      onClick={() =>
                        handleCambiarEstado(selectedPedido._id, "pendiente")
                      }
                    >
                      ⏳ Marcar como Pendiente
                    </button>
                  )}
                  {selectedPedido.estado !== "confirmado" && (
                    <button
                      className="btn btn-info mb-2"
                      onClick={() =>
                        handleCambiarEstado(selectedPedido._id, "confirmado")
                      }
                    >
                      ✅ Marcar como Confirmado
                    </button>
                  )}
                  {selectedPedido.estado !== "completado" && (
                    <button
                      className="btn btn-success mb-2"
                      onClick={() =>
                        handleCambiarEstado(selectedPedido._id, "completado")
                      }
                    >
                      🎉 Marcar como Completado
                    </button>
                  )}
                  {selectedPedido.estado !== "cancelado" && (
                    <button
                      className="btn btn-danger mb-2"
                      onClick={() =>
                        handleCambiarEstado(selectedPedido._id, "cancelado")
                      }
                    >
                      ❌ Cancelar Pedido
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowModal(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PedidosDashboard;
