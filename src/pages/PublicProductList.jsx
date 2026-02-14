import { useState, useEffect } from "react";
import axios from "axios";
import "../styles/PublicProductList.css";
import NavBar from "../components/NavBar";

const PublicProductsList = () => {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    totalProducts: 0,
    totalPages: 0,
    currentPage: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");

  // Estado para el modal de pedido
  const [showModal, setShowModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [pedidoForm, setPedidoForm] = useState({
    nombreCliente: "",
    telefono: "",
    email: "",
    cantidad: 1,
    notas: "",
  });
  const [enviandoPedido, setEnviandoPedido] = useState(false);

  const fetchProductos = async (page = 1, searchTerm = "") => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/products/public`,
        {
          params: { page, limit: 12, search: searchTerm },
        },
      );

      setProductos(response.data.productos);
      setPagination(response.data.pagination);
      setCurrentPage(page);
    } catch (error) {
      console.error("Error al cargar productos:", error);
      alert("Error al cargar productos. Por favor, intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  // Hook al nivel superior del componente
  useEffect(() => {
    fetchProductos(1, "");
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchProductos(1, search);
  };

  const handlePageChange = (newPage) => {
    fetchProductos(newPage, search);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Abrir modal de pedido
  const handleAbrirPedido = (producto) => {
    setSelectedProduct(producto);
    setPedidoForm({
      nombreCliente: "",
      telefono: "",
      email: "",
      cantidad: 1,
      notas: "",
    });
    setShowModal(true);
  };

  // Cerrar modal
  const handleCerrarModal = () => {
    setShowModal(false);
    setSelectedProduct(null);
  };

  // Cambios en el formulario
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setPedidoForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Enviar pedido
  const handleEnviarPedido = async (e) => {
    e.preventDefault();

    // Validaciones básicas
    if (!pedidoForm.nombreCliente.trim()) {
      alert("Por favor ingresa tu nombre");
      return;
    }

    if (!pedidoForm.telefono.trim()) {
      alert("Por favor ingresa tu teléfono");
      return;
    }

    if (pedidoForm.cantidad < 1) {
      alert("La cantidad debe ser al menos 1");
      return;
    }

    if (pedidoForm.cantidad > selectedProduct.cantidad) {
      alert(`Solo hay ${selectedProduct.cantidad} unidades disponibles`);
      return;
    }

    setEnviandoPedido(true);

    try {
      const pedidoData = {
        productoId: selectedProduct._id,
        productoNombre: selectedProduct.nombre,
        precioVenta: selectedProduct.precioVenta,
        nombreCliente: pedidoForm.nombreCliente,
        telefono: pedidoForm.telefono,
        email: pedidoForm.email,
        cantidad: parseInt(pedidoForm.cantidad),
        notas: pedidoForm.notas,
        total: selectedProduct.precioVenta * parseInt(pedidoForm.cantidad),
      };

      await axios.post(
        `${import.meta.env.VITE_API_URL}/api/pedidos`,
        pedidoData,
      );

      alert(
        "¡Pedido enviado exitosamente! Nos pondremos en contacto contigo pronto.",
      );
      handleCerrarModal();
    } catch (error) {
      console.error("Error al enviar pedido:", error);
      alert("Error al enviar el pedido. Por favor, intenta de nuevo.");
    } finally {
      setEnviandoPedido(false);
    }
  };

  if (loading) {
    return (
      <div className="public-products-container">
        <NavBar /> {/* 🎯 USA EL COMPONENTE en lugar de todo el <nav> */}
        <div className="loading-container">
          <div className="loading-content">
            <div className="loading-icon">🎮</div>
            <h2 className="loading-title">Cargando productos...</h2>
            <p className="loading-subtitle">
              Preparando el mejor catálogo para ti
            </p>
            <div className="loading-spinner-custom"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="public-products-container">
      <NavBar /> {/* 🎯 USA EL COMPONENTE en lugar de todo el <nav> */}
      {/* Contenido principal */}
      <div className="public-products-content">
        <div className="container py-4">
          <h2 className="public-products-title mb-4">🎯 Nuestro Catálogo</h2>

          {/* Buscador */}
          <form onSubmit={handleSearch} className="mb-4">
            <div className="input-group search-bar">
              <input
                type="text"
                className="form-control"
                placeholder="Buscar producto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button className="btn btn-primary" type="submit">
                🔍 Buscar
              </button>
              {search && (
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => {
                    setSearch("");
                    fetchProductos(1, "");
                  }}
                >
                  ✕ Limpiar
                </button>
              )}
            </div>
          </form>

          {/* Contador de resultados */}
          {pagination?.totalProducts > 0 && (
            <p className="text-muted mb-3">
              Mostrando {productos?.length || 0} de {pagination.totalProducts}{" "}
              productos
              {search && ` para "${search}"`}
            </p>
          )}

          {/* Grid de productos */}
          {!productos || productos.length === 0 ? (
            <div className="alert alert-info">
              📦 No se encontraron productos{" "}
              {search && `con el término "${search}"`}
            </div>
          ) : (
            <div className="row g-4">
              {productos.map((producto) => (
                <div
                  key={producto._id}
                  className="col-12 col-sm-6 col-md-4 col-lg-3"
                >
                  <div className="card public-product-card h-100 shadow-sm">
                    {/* Imagen */}
                    <div className="public-product-image-container">
                      <img
                        src={
                          producto.imagenOptimizada ||
                          producto.imagen ||
                          "https://via.placeholder.com/300"
                        }
                        alt={producto.nombre}
                        className="card-img-top public-product-image"
                        loading="lazy"
                        onClick={() =>
                          window.open(
                            producto.imagenOriginal || producto.imagen,
                            "_blank",
                          )
                        }
                        title="Click para ver imagen completa"
                      />
                      {/* Badge de disponibilidad */}
                      <div className="availability-badge">
                        {producto.cantidad > 0 ? (
                          <span className="badge bg-success">Disponible</span>
                        ) : (
                          <span className="badge bg-danger">Agotado</span>
                        )}
                      </div>
                    </div>

                    <div className="card-body">
                      <h5
                        className="card-title text-truncate"
                        title={producto.nombre}
                      >
                        {producto.nombre}
                      </h5>

                      <div className="public-product-info">
                        <div className="info-row">
                          <span className="info-label">Stock:</span>
                          <span className="badge bg-secondary">
                            {producto.cantidad > 0
                              ? `${producto.cantidad} unidades`
                              : "Agotado"}
                          </span>
                        </div>

                        <div className="info-row price-row">
                          <span className="info-label">Precio:</span>
                          <span className="info-value text-success fw-bold">
                            ₡{producto.precioVenta.toLocaleString("es-CR")}
                          </span>
                        </div>
                      </div>

                      {/* Botón de pedido */}
                      <button
                        className={`btn ${producto.cantidad > 0 ? "btn-primary" : "btn-secondary"} w-100 mt-3`}
                        onClick={() => handleAbrirPedido(producto)}
                        disabled={producto.cantidad === 0}
                      >
                        {producto.cantidad > 0
                          ? "🛒 Hacer Pedido"
                          : "No disponible"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Paginación */}
          {pagination?.totalPages > 1 && (
            <nav className="mt-5">
              <ul className="pagination justify-content-center">
                <li
                  className={`page-item ${!pagination?.hasPrevPage ? "disabled" : ""}`}
                >
                  <button
                    className="page-link"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={!pagination?.hasPrevPage}
                  >
                    ‹ Anterior
                  </button>
                </li>

                {pagination?.totalPages &&
                  [...Array(pagination.totalPages)].map((_, index) => {
                    const pageNum = index + 1;
                    if (
                      pageNum === 1 ||
                      pageNum === pagination.totalPages ||
                      (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                    ) {
                      return (
                        <li
                          key={pageNum}
                          className={`page-item ${currentPage === pageNum ? "active" : ""}`}
                        >
                          <button
                            className="page-link"
                            onClick={() => handlePageChange(pageNum)}
                          >
                            {pageNum}
                          </button>
                        </li>
                      );
                    } else if (
                      pageNum === currentPage - 2 ||
                      pageNum === currentPage + 2
                    ) {
                      return (
                        <li key={pageNum} className="page-item disabled">
                          <span className="page-link">...</span>
                        </li>
                      );
                    }
                    return null;
                  })}

                <li
                  className={`page-item ${!pagination?.hasNextPage ? "disabled" : ""}`}
                >
                  <button
                    className="page-link"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={!pagination?.hasNextPage}
                  >
                    Siguiente ›
                  </button>
                </li>
              </ul>
            </nav>
          )}
        </div>
      </div>
      {/* Modal de pedido */}
      {showModal && selectedProduct && (
        <div className="modal-overlay" onClick={handleCerrarModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🛒 Hacer Pedido</h3>
              <button className="btn-close" onClick={handleCerrarModal}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="producto-info-modal">
                <img
                  src={
                    selectedProduct.imagenOptimizada || selectedProduct.imagen
                  }
                  alt={selectedProduct.nombre}
                  className="producto-imagen-modal"
                />
                <div>
                  <h5>{selectedProduct.nombre}</h5>
                  <p className="precio-modal">
                    ₡{selectedProduct.precioVenta.toLocaleString("es-CR")}
                  </p>
                  <p className="stock-modal">
                    Stock disponible: {selectedProduct.cantidad} unidades
                  </p>
                </div>
              </div>

              <form onSubmit={handleEnviarPedido}>
                <div className="mb-3">
                  <label className="form-label">Nombre completo *</label>
                  <input
                    type="text"
                    className="form-control"
                    name="nombreCliente"
                    value={pedidoForm.nombreCliente}
                    onChange={handleFormChange}
                    required
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Teléfono *</label>
                  <input
                    type="tel"
                    className="form-control"
                    name="telefono"
                    value={pedidoForm.telefono}
                    onChange={handleFormChange}
                    required
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Email (opcional)</label>
                  <input
                    type="email"
                    className="form-control"
                    name="email"
                    value={pedidoForm.email}
                    onChange={handleFormChange}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Cantidad *</label>
                  <input
                    type="number"
                    className="form-control"
                    name="cantidad"
                    min="1"
                    max={selectedProduct.cantidad}
                    value={pedidoForm.cantidad}
                    onChange={handleFormChange}
                    required
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">
                    Notas adicionales (opcional)
                  </label>
                  <textarea
                    className="form-control"
                    name="notas"
                    rows="3"
                    value={pedidoForm.notas}
                    onChange={handleFormChange}
                    placeholder="Alguna información adicional sobre tu pedido..."
                  ></textarea>
                </div>

                <div className="total-pedido">
                  <strong>
                    Total: ₡
                    {(
                      selectedProduct.precioVenta * pedidoForm.cantidad
                    ).toLocaleString("es-CR")}
                  </strong>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleCerrarModal}
                    disabled={enviandoPedido}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={enviandoPedido}
                  >
                    {enviandoPedido ? "Enviando..." : "✓ Confirmar Pedido"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default PublicProductsList;
