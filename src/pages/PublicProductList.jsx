import { useState, useEffect } from "react";
import axios from "axios";
import "../styles/PublicProductList.css";
import NavBar from "../components/NavBar";
import { resolverDisponibilidad } from "../utils/stock";
import { formatearMonto, formatearNumero } from "../constants/inventario";
import { fotoProducto, fotoProductoSrcSet, SIN_FOTO } from "../utils/imagenes";

const PublicProductsList = () => {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  // Solo la PRIMERA carga muestra la pantalla completa de "Cargando...".
  // Las búsquedas/paginación siguientes usan un indicador chico y NO desmontan
  // el buscador (si no, el input pierde el foco y la letra recién escrita).
  const [firstLoad, setFirstLoad] = useState(true);
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
      setFirstLoad(false);
    }
  };

  // Búsqueda en vivo: se dispara sola mientras el cliente escribe (con un
  // pequeño retardo para no pegarle al backend en cada tecla). Con el campo
  // vacío (carga inicial o "Limpiar") busca de inmediato, sin esperar.
  useEffect(() => {
    const termino = search.trim();
    const t = setTimeout(() => fetchProductos(1, termino), termino ? 400 : 0);
    return () => clearTimeout(t);
  }, [search]);

  // El submit del form (Enter o botón) solo evita recargar la página; la
  // búsqueda ya la maneja el efecto de arriba.
  const handleSearch = (e) => {
    e.preventDefault();
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
      alert("Indique su nombre para continuar.");
      return;
    }

    if (!pedidoForm.telefono.trim()) {
      alert("Indique un número de teléfono para poder contactarle.");
      return;
    }

    if (pedidoForm.cantidad < 1) {
      alert("La cantidad debe ser de al menos 1 unidad.");
      return;
    }

    const { stock } = resolverDisponibilidad(selectedProduct);
    if (pedidoForm.cantidad > stock) {
      alert(
        `La cantidad solicitada supera la disponibilidad actual (${formatearNumero(stock)} unidades).`,
      );
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
        "Su solicitud fue registrada. Le contactaremos para confirmar el pedido.",
      );
      handleCerrarModal();
    } catch (error) {
      console.error("Error al enviar pedido:", error);
      alert("No fue posible registrar la solicitud. Intente de nuevo.");
    } finally {
      setEnviandoPedido(false);
    }
  };

  // El catálogo público solo muestra lo que se puede pedir hoy: si algo se
  // agotó, no aparece. Ojo: esto vale SOLO acá, que es la vitrina del cliente.
  // En Ventas y en Inventario los agotados se siguen viendo, con el motivo a la
  // vista — ahí esconderlos es justo lo que hizo desaparecer un producto sin
  // dejar rastro.
  const disponibles = (productos || [])
    .map((producto) => ({ producto, ...resolverDisponibilidad(producto) }))
    .filter((p) => !p.agotado);

  const hayOcultos = (productos || []).length > disponibles.length;

  if (firstLoad) {
    return (
      <div className="public-products-container">
        <NavBar /> {/* 🎯 USA EL COMPONENTE en lugar de todo el <nav> */}
        <div className="loading-container">
          <div className="loading-content">
            <h2 className="loading-title">Cargando el catálogo</h2>
            <p className="loading-subtitle">Un momento, por favor.</p>
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
          <h2 className="public-products-title mb-4">Catálogo de productos</h2>

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
                Buscar
              </button>
              {search && (
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => setSearch("")}
                >
                  Limpiar
                </button>
              )}
            </div>
          </form>

          {/* Contador de resultados + indicador chico de búsqueda */}
          <p className="text-muted mb-3 d-flex align-items-center gap-2">
            {loading && (
              <span
                className="spinner-border spinner-border-sm text-secondary"
                role="status"
                aria-hidden="true"
              ></span>
            )}
            <span>
              {loading
                ? "Buscando…"
                : disponibles.length > 0
                  ? hayOcultos
                    ? `Mostrando ${disponibles.length} ${disponibles.length === 1 ? "producto disponible" : "productos disponibles"}${search ? ` para "${search}"` : ""}`
                    : `Mostrando ${disponibles.length} de ${pagination?.totalProducts ?? disponibles.length} productos${search ? ` para "${search}"` : ""}`
                  : ""}
            </span>
          </p>

          {/* Grid de productos */}
          {disponibles.length === 0 ? (
            <div className="alert alert-info">
              {hayOcultos
                ? "Por el momento no hay productos disponibles."
                : `No se encontraron productos${search ? ` para "${search}"` : ""}.`}
            </div>
          ) : (
            <div className="row g-4">
              {disponibles.map(({ producto, stock }) => (
                <div
                  key={producto._id}
                  className="col-12 col-sm-6 col-md-4 col-lg-3"
                >
                  <div className="card public-product-card h-100 shadow-sm">
                    {/* Imagen */}
                    <div className="public-product-image-container">
                      {/* La caja mide 320 px: pedir el original (hasta 215 KB
                          por foto) para pintarlo acá era el mayor peso de la
                          pantalla que ven los clientes. Al tocar sí se abre la
                          original, que para eso es "ver la imagen completa". */}
                      <img
                        src={fotoProducto(producto.imagen, { ancho: 400 }) || SIN_FOTO}
                        srcSet={producto.imagen ? fotoProductoSrcSet(producto.imagen, [400, 800]) : undefined}
                        sizes="(max-width: 600px) 90vw, 300px"
                        alt={producto.nombre}
                        className="card-img-top public-product-image"
                        loading="lazy"
                        onClick={() =>
                          window.open(producto.imagen, "_blank")
                        }
                        title="Ver la imagen completa"
                      />
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
                          <span className="info-label">Disponibilidad</span>
                          <span className="badge bg-secondary">
                            {formatearNumero(stock)}{" "}
                            {stock === 1 ? "unidad" : "unidades"}
                          </span>
                        </div>

                        <div className="info-row price-row">
                          <span className="info-label">Precio</span>
                          <span className="info-value text-success fw-bold">
                            {formatearMonto(producto.precioVenta)}
                          </span>
                        </div>
                      </div>

                      {/* Botón de pedido */}
                      <button
                        className="btn btn-primary w-100 mt-3"
                        onClick={() => handleAbrirPedido(producto)}
                      >
                        Solicitar pedido
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
              <h3>Solicitud de pedido</h3>
              <button className="btn-close" onClick={handleCerrarModal}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="producto-info-modal">
                <img
                  src={fotoProducto(selectedProduct.imagen, { ancho: 800 })}
                  alt={selectedProduct.nombre}
                  className="producto-imagen-modal"
                />
                <div>
                  <h5>{selectedProduct.nombre}</h5>
                  <p className="precio-modal">
                    {formatearMonto(selectedProduct.precioVenta)}
                  </p>
                  <p className="stock-modal">
                    Disponibles:{" "}
                    {formatearNumero(resolverDisponibilidad(selectedProduct).stock)}{" "}
                    unidades
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
                  <label className="form-label">
                    Correo electrónico (opcional)
                  </label>
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
                    max={resolverDisponibilidad(selectedProduct).stock}
                    value={pedidoForm.cantidad}
                    onChange={handleFormChange}
                    required
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Comentarios (opcional)</label>
                  <textarea
                    className="form-control"
                    name="notas"
                    rows="3"
                    value={pedidoForm.notas}
                    onChange={handleFormChange}
                    placeholder="Información adicional sobre el pedido"
                  ></textarea>
                </div>

                <div className="total-pedido">
                  <strong>
                    Total:{" "}
                    {formatearMonto(
                      selectedProduct.precioVenta * pedidoForm.cantidad,
                    )}
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
                    {enviandoPedido ? "Enviando…" : "Confirmar pedido"}
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
