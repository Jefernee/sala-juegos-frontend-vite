/**
 * ManageProducts Component
 * @version 4.0.0
 * - Búsqueda en tiempo real con debounce (sin recargar la página completa)
 * - Paginación con botones anterior/siguiente
 * - Spinner localizado en la lista (no bloquea el resto de la UI)
 */

import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { Helmet } from "react-helmet";
import "../styles/ManageProducts.css";
import Navbar from "../components/NavBar2";
import ProductForm from "../components/ProductForm";

const PRODUCTOS_POR_PAGINA = 10;

const ManageProducts = () => {
  // ===================================
  // ESTADO DEL COMPONENTE
  // ===================================

  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);       // solo para la primera carga
  const [searching, setSearching] = useState(false);  // spinner localizado en búsquedas
  const [processing, setProcessing] = useState(null);
  const [search, setSearch] = useState("");

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);

  // Formulario modal
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const timeoutRef = useRef(null);

  // ===================================
  // FETCH DE PRODUCTOS
  // ===================================

  const fetchProductos = useCallback(
    async (searchTerm = "", page = 1, isInitialLoad = false) => {
      if (isInitialLoad) {
        setLoading(true);
      } else {
        setSearching(true);
      }

      try {
        const token = localStorage.getItem("token");

        const response = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/products/list`,
          {
            params: {
              page,
              limit: PRODUCTOS_POR_PAGINA,
              search: searchTerm,
            },
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const { productos: data, pagination } = response.data;

        setProductos(data);
        setCurrentPage(pagination.currentPage);
        setTotalPages(pagination.totalPages);
        setTotalProducts(pagination.totalProducts);
      } catch (error) {
        console.error("Error al cargar productos:", error);
        if (error.response?.status === 401) {
          alert("Sesión expirada. Por favor inicia sesión nuevamente.");
        } else {
          alert("Error al cargar productos.");
        }
      } finally {
        setLoading(false);
        setSearching(false);
      }
    },
    []
  );

  // ===================================
  // EFECTOS
  // ===================================

  useEffect(() => {
    fetchProductos("", 1, true); // primera carga
  }, [fetchProductos]);

  // ===================================
  // BÚSQUEDA EN TIEMPO REAL (DEBOUNCE)
  // ===================================

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearch(value);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      fetchProductos(value, 1, false);
    }, 500);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    fetchProductos(search, 1, false);
  };

  const limpiarBusqueda = () => {
    setSearch("");
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    fetchProductos("", 1, false);
  };

  // ===================================
  // PAGINACIÓN
  // ===================================

  const irAPagina = (page) => {
    if (page < 1 || page > totalPages) return;
    fetchProductos(search, page, false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ===================================
  // FORMULARIO MODAL
  // ===================================

  const handleOpenAddForm = () => {
    setEditingProduct(null);
    setShowForm(true);
  };

  const handleOpenEditForm = async (producto) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/products/${producto._id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const productoCompleto = response.data.producto || response.data;
      setEditingProduct(productoCompleto);
    } catch (error) {
      console.error("Error al cargar producto:", error);
      setEditingProduct(producto);
    }
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingProduct(null);
  };

  const handleFormSuccess = () => {
    handleCloseForm();
    fetchProductos(search, currentPage, false);
  };

  // ===================================
  // ELIMINAR PRODUCTO
  // ===================================

  const handleDelete = async (id, nombre) => {
    const confirmar = window.confirm(
      `¿Estás seguro de eliminar "${nombre}"?\n\nEsta acción eliminará el producto y todos sus datos relacionados.\n\nEsta acción no se puede deshacer.`
    );
    if (!confirmar) return;

    setProcessing(id);

    try {
      const token = localStorage.getItem("token");

      await axios.delete(
        `${import.meta.env.VITE_API_URL}/api/products/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Si era el único de la página y hay páginas anteriores, retroceder
      const nuevaPagina =
        productos.length === 1 && currentPage > 1
          ? currentPage - 1
          : currentPage;

      fetchProductos(search, nuevaPagina, false);
      alert(`"${nombre}" fue eliminado correctamente.`);
    } catch (error) {
      console.error("Error al eliminar:", error);
      if (error.response?.status === 401) {
        alert("Sesión expirada. Por favor inicia sesión nuevamente.");
      } else {
        alert("Error al eliminar el producto.");
      }
    } finally {
      setProcessing(null);
    }
  };

  // ===================================
  // RENDER - PRIMERA CARGA
  // ===================================

  if (loading) {
    return (
      <div className="manage-products-container">
        <Navbar />
        <div className="loading-container">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      </div>
    );
  }

  // ===================================
  // RENDER PRINCIPAL
  // ===================================

  return (
    <div className="manage-products-container">
      <Helmet>
        <title>Gestionar Productos - Sala de Juegos Ruiz</title>
      </Helmet>

      <Navbar />

      {/* FORMULARIO MODAL */}
      {showForm && (
        <ProductForm
          producto={editingProduct}
          onClose={handleCloseForm}
          onSuccess={handleFormSuccess}
        />
      )}

      <div className="manage-content">
        <div className="container py-4">
          <div className="text-center mb-4">
            <h2 className="manage-title mb-3">🎮 Gestionar Productos</h2>
            <p className="subtitle">
              Ver, editar y eliminar productos desde un solo lugar
            </p>
          </div>

          {/* ===== BOTÓN AGREGAR + BARRA DE BÚSQUEDA ===== */}
          <div className="mb-4">
            <div className="d-flex gap-2 mb-3">
              <button
                className="btn btn-add-product"
                onClick={handleOpenAddForm}
                title="Agregar nuevo producto"
              >
                ➕ Agregar Producto
              </button>
            </div>

            <form onSubmit={handleSearchSubmit}>
              <div className="input-group search-bar">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Buscar producto..."
                  value={search}
                  onChange={handleSearchChange}
                  autoComplete="off"
                />

                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={searching}
                >
                  {searching ? (
                    <span
                      className="spinner-border spinner-border-sm"
                      role="status"
                      aria-hidden="true"
                    />
                  ) : (
                    "🔍 Buscar"
                  )}
                </button>

                {search && (
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={limpiarBusqueda}
                    disabled={searching}
                  >
                    ✕ Limpiar
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* ===== CONTADOR DE RESULTADOS ===== */}
          {!searching && (
            <p className="text-muted text-center mb-3">
              {totalProducts} producto{totalProducts !== 1 ? "s" : ""}{" "}
              encontrado{totalProducts !== 1 ? "s" : ""}
              {search && ` para "${search}"`}
              {totalPages > 1 && ` · Página ${currentPage} de ${totalPages}`}
            </p>
          )}

          {/* ===== LISTA DE PRODUCTOS O SPINNER LOCALIZADO ===== */}
          {searching ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Buscando...</span>
              </div>
              <p className="mt-2 text-muted">Buscando productos...</p>
            </div>
          ) : productos.length === 0 ? (
            <div className="alert alert-info text-center">
              📦 No se encontraron productos
              {search && ` con el término "${search}"`}
            </div>
          ) : (
            <>
              <div className="products-list">
                {productos.map((producto) => (
                  <div key={producto._id} className="product-item">
                    {/* IMAGEN */}
                    <div className="product-image-wrapper">
                      <img
                        src={
                          producto.imagenOptimizada ||
                          producto.imagen ||
                          "https://via.placeholder.com/100"
                        }
                        alt={producto.nombre}
                        className="product-thumbnail"
                        onClick={() =>
                          window.open(
                            producto.imagenOriginal || producto.imagen,
                            "_blank"
                          )
                        }
                        title="Click para ver imagen completa"
                        style={{ cursor: "pointer" }}
                      />
                    </div>

                    {/* DETALLES */}
                    <div className="product-details">
                      <h5 className="product-name">
                        {producto.nombre}
                        {producto.tipo === "receta" && (
                          <span
                            className="badge bg-warning text-dark ms-2"
                            style={{ fontSize: "0.7rem" }}
                            title="Producto compuesto — el stock se calcula a partir de sus ingredientes"
                          >
                            🍽️ Receta
                          </span>
                        )}
                        {producto.seVende ? (
                          <span
                            className="badge bg-success ms-2"
                            style={{ fontSize: "0.7rem" }}
                          >
                            ✓ Disponible
                          </span>
                        ) : (
                          <span
                            className="badge bg-secondary ms-2"
                            style={{ fontSize: "0.7rem" }}
                          >
                            ✕ No disponible
                          </span>
                        )}
                      </h5>

                      <div className="product-meta">
                        {producto.tipo === "receta" ? (
                          <span className="meta-item">
                            <strong>Ingredientes:</strong>{" "}
                            {Array.isArray(producto.receta)
                              ? producto.receta.map((ing) => {
                                  const esObjeto = ing.ingredienteId && typeof ing.ingredienteId === "object";
                                  const nombre = ing.nombre || (esObjeto ? ing.ingredienteId.nombre : "");
                                  const unidad = ing.unidad || (esObjeto ? ing.ingredienteId.unidad : "") || "";
                                  return `${nombre}${unidad ? ` — ${ing.cantidad} ${unidad} por unidad` : ` — ${ing.cantidad}`}`;
                                }).join(", ")
                              : "—"}
                          </span>
                        ) : (
                          <span className="meta-item">
                            <strong>Cantidad:</strong>{" "}
                            {producto.cantidad}{producto.unidad ? ` ${producto.unidad}` : ""}
                            {producto.cantidadPorEnvase && producto.nombreEnvase && (
                              <span className="text-muted ms-1" style={{ fontSize: "0.85em" }}>
                                (≈ {(producto.cantidad / producto.cantidadPorEnvase).toFixed(1)} {producto.nombreEnvase}s)
                              </span>
                            )}
                          </span>
                        )}
                        {producto.tipo !== "receta" && (
                          <span className="meta-item">
                            <strong>P. Compra:</strong> ₡{producto.precioCompra}
                          </span>
                        )}
                        <span className="meta-item">
                          <strong>P. Venta:</strong> ₡{producto.precioVenta}
                        </span>
                        <span className="meta-item">
                          <strong>Fecha:</strong>{" "}
                          {new Date(producto.fechaCompra).toLocaleDateString(
                            "es-ES"
                          )}
                        </span>
                        {producto.createdBy && (
                          <span
                            className="meta-item text-muted"
                            style={{ fontSize: "0.85em" }}
                          >
                            <strong>Creado por:</strong>{" "}
                            {producto.createdBy.nombre ||
                              producto.createdBy.email}
                          </span>
                        )}
                        {producto.updatedAt && (
                          <span
                            className="meta-item text-muted"
                            style={{ fontSize: "0.85em" }}
                          >
                            <strong>Última edición:</strong>{" "}
                            {new Date(producto.updatedAt).toLocaleDateString(
                              "es-ES"
                            )}{" "}
                            {new Date(producto.updatedAt).toLocaleTimeString(
                              "es-ES"
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* BOTONES */}
                    <div className="product-actions">
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleOpenEditForm(producto)}
                        disabled={processing === producto._id}
                      >
                        ✏️ Editar
                      </button>

                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() =>
                          handleDelete(producto._id, producto.nombre)
                        }
                        disabled={processing === producto._id}
                      >
                        {processing === producto._id ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-1" />
                            Eliminando...
                          </>
                        ) : (
                          <>🗑️ Eliminar</>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* ===== PAGINACIÓN ===== */}
              {totalPages > 1 && (
                <nav className="d-flex justify-content-center align-items-center gap-2 mt-4 flex-wrap">
                  {/* Botón primera página */}
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => irAPagina(1)}
                    disabled={currentPage === 1}
                    title="Primera página"
                  >
                    «
                  </button>

                  {/* Botón anterior */}
                  <button
                    className="btn btn-outline-primary btn-sm"
                    onClick={() => irAPagina(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    ‹ Anterior
                  </button>

                  {/* Números de página */}
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(
                      (page) =>
                        page === 1 ||
                        page === totalPages ||
                        Math.abs(page - currentPage) <= 2
                    )
                    .reduce((acc, page, idx, arr) => {
                      // Insertar "..." cuando hay saltos
                      if (idx > 0 && page - arr[idx - 1] > 1) {
                        acc.push("...");
                      }
                      acc.push(page);
                      return acc;
                    }, [])
                    .map((item, idx) =>
                      item === "..." ? (
                        <span key={`dots-${idx}`} className="px-1 text-muted">
                          …
                        </span>
                      ) : (
                        <button
                          key={item}
                          className={`btn btn-sm ${
                            item === currentPage
                              ? "btn-primary"
                              : "btn-outline-secondary"
                          }`}
                          onClick={() => irAPagina(item)}
                          style={{ minWidth: "36px" }}
                        >
                          {item}
                        </button>
                      )
                    )}

                  {/* Botón siguiente */}
                  <button
                    className="btn btn-outline-primary btn-sm"
                    onClick={() => irAPagina(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Siguiente ›
                  </button>

                  {/* Botón última página */}
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => irAPagina(totalPages)}
                    disabled={currentPage === totalPages}
                    title="Última página"
                  >
                    »
                  </button>
                </nav>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManageProducts;