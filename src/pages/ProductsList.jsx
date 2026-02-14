import { useState, useEffect } from "react";
import axios from "axios";
import "../styles/ProductsList.css";
import Navbar from "../components/NavBar2";

const ProductsList = () => {
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

  // Cargar productos
  const fetchProductos = async (page = 1, searchTerm = "") => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/products/list?page=${page}&limit=12&search=${searchTerm}`
      );

      console.log("Respuesta del servidor:", response.data); // Para debugging

      setProductos(response.data.productos);
      setPagination(response.data.pagination);
      setCurrentPage(page);
    } catch (error) {
      console.error("Error al cargar productos:", error);
      // Mostrar mensaje de error al usuario
      alert(
        "Error al cargar productos. Verifica que el servidor esté corriendo."
      );
    } finally {
      setLoading(false);
    }
  };

  // Cargar productos al montar componente
  useEffect(() => {
    fetchProductos(1, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Manejar búsqueda
  const handleSearch = (e) => {
    e.preventDefault();
    fetchProductos(1, search);
  };

  // Cambiar página
  const handlePageChange = (newPage) => {
    fetchProductos(newPage, search);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className="products-list-container">
        <Navbar />

        <div className="loading-container">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="products-list-container">
      {/* Navbar */}
      <Navbar />

      {/* Contenido principal */}
      <div className="products-content">
        <div className="container py-4">
          <h2 className="products-title mb-4">Productos en Inventario</h2>

          {/* Buscador */}
          <form onSubmit={handleSearch} className="mb-4">
            <div className="input-group search-bar">
              <input
                type="text"
                className="form-control"
                placeholder="Buscar producto por nombre..."
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
                  <div className="card product-card h-100 shadow-sm">
                    {/* Imagen */}
                    <div className="product-image-container">
                      <img
                        src={
                          producto.imagenOptimizada ||
                          producto.imagen ||
                          "https://via.placeholder.com/300"
                        }
                        alt={producto.nombre}
                        className="card-img-top product-image"
                        loading="lazy"
                        onClick={() =>
                          window.open(
                            producto.imagenOriginal || producto.imagen,
                            "_blank"
                          )
                        }
                        title="Click para ver imagen completa"
                      />
                    </div>

                    <div className="card-body">
                      <h5
                        className="card-title text-truncate"
                        title={producto.nombre}
                      >
                        {producto.nombre}
                      </h5>

                      <div className="product-info">
                        <div className="info-row">
                          <span className="info-label">Cantidad:</span>
                          <span className="badge bg-secondary">
                            {producto.cantidad}
                          </span>
                        </div>

                        <div className="info-row">
                          <span className="info-label">P. Compra:</span>
                          <span className="info-value">
                            ₡{producto.precioCompra}
                          </span>
                        </div>

                        <div className="info-row">
                          <span className="info-label">P. Venta:</span>
                          <span className="info-value text-success fw-bold">
                            ₡{producto.precioVenta}
                          </span>
                        </div>

                        <div className="info-row">
                          <span className="info-label">Fecha:</span>
                          <span className="info-value">
                            {new Date(producto.fechaCompra).toLocaleDateString(
                              "es-ES"
                            )}
                          </span>
                        </div>
                      </div>
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
                {/* Botón Anterior */}
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

                {/* Números de página */}
                {pagination?.totalPages &&
                  [...Array(pagination.totalPages)].map((_, index) => {
                    const pageNum = index + 1;
                    // Solo mostrar algunas páginas alrededor de la actual
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

                {/* Botón Siguiente */}
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
    </div>
  );
};

export default ProductsList;
