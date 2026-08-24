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
import { resolverDisponibilidad } from "../utils/stock";
import {
  conUnidad,
  sufijoUnidad,
  unidadSingular,
  labelEnvase,
  formatearMonto,
  formatearCantidad,
  formatearNumero,
} from "../constants/inventario";
import { fotoProducto, SIN_FOTO } from "../utils/imagenes";

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
        // Si el 401 fuera de los que cierran la sesión, el interceptor de
        // axios ya estaría yendo al login. Acá no se afirma "sesión expirada":
        // el token no vence, y decirlo mandaba al usuario a re-loguearse por
        // un error que era de otra cosa.
        alert(
          error.response?.status === 401
            ? "El servidor no autorizó la consulta de productos."
            : "Error al cargar productos.",
        );
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
      alert(
        error.response?.status === 401
          ? "El servidor no autorizó eliminar el producto."
          : "Error al eliminar el producto.",
      );
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
          {/* En escritorio los dos van en una sola fila: apilados desperdiciaban
              media pantalla de alto antes de llegar a los productos. */}
          <div className="manage-toolbar mb-4">
            <button
              className="btn btn-add-product"
              onClick={handleOpenAddForm}
              title="Agregar nuevo producto"
            >
              ➕ Agregar Producto
            </button>

            <form onSubmit={handleSearchSubmit} className="manage-toolbar__buscar">
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
                {productos.map((producto) => {
                  // El agotado se ve acá mismo, con la causa. Antes había que
                  // abrir la receta y hacer la división a mano para entender por
                  // qué un producto no aparecía en Ventas.
                  const disp = resolverDisponibilidad(producto);
                
                  return (
                  <div key={producto._id} className="product-item">
                    {/* IMAGEN */}
                    <div className="product-image-wrapper">
                      <img
                        src={
                          fotoProducto(producto.imagenOptimizada || producto.imagen, {
                            ancho: 160,
                            forma: "1:1",
                          }) || SIN_FOTO
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
                        {/* "Disponible" y "Agotado" al mismo tiempo se
                            contradicen, así que cuando no hay existencias manda
                            el de agotado. */}
                        {producto.seVende ? (
                          !disp.agotado && (
                            <span
                              className="badge bg-success ms-2"
                              style={{ fontSize: "0.7rem" }}
                            >
                              ✓ Disponible
                            </span>
                          )
                        ) : (
                          <span
                            className="badge bg-secondary ms-2"
                            style={{ fontSize: "0.7rem" }}
                          >
                            ✕ No disponible
                          </span>
                        )}
                        {disp.agotado && (
                          <span
                            className="badge bg-danger ms-2"
                            style={{ fontSize: "0.7rem" }}
                            title={disp.motivo || "Sin existencias"}
                          >
                            Agotado
                          </span>
                        )}
                      </h5>

                      {disp.agotado && disp.motivo && (
                        <p className="product-motivo">{disp.motivo}</p>
                      )}

                      <div className="product-meta">
                        {producto.tipo === "receta" ? (
                          <>
                            {/* Mismo rótulo que un producto simple: "Stock". El
                                ingrediente que pone el techo va en el tooltip, y
                                si de verdad se agotó ya se explica en rojo arriba. */}
                            <span
                              className="meta-item meta-stock"
                              title={
                                disp.limitante?.nombre
                                  ? `El ingrediente que pone el límite es ${disp.limitante.nombre}`
                                  : undefined
                              }
                            >
                              <strong>Stock:</strong>{" "}
                              {conUnidad(disp.stock, "unidades")}
                            </span>

                            <span className="meta-item meta-ingredientes">
                              <strong>Ingredientes:</strong>{" "}
                              {Array.isArray(producto.receta) ? producto.receta.length : "—"}
                            </span>
                            {Array.isArray(producto.receta) && producto.receta.length > 0 && (
                              <span className="meta-item meta-ingredientes-lista">
                                {producto.receta.map((ing) => {
                                  const esObjeto = ing.ingredienteId && typeof ing.ingredienteId === "object";
                                  const nombre = ing.nombre || (esObjeto ? ing.ingredienteId.nombre : "");
                                  const unidad = ing.unidad || (esObjeto ? ing.ingredienteId.unidad : "") || "";
                                  const suf = sufijoUnidad(unidad);
                                  return `${nombre} (${formatearCantidad(ing.cantidad)}${suf ? ` ${suf}` : ""})`;
                                }).join(" · ")}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="meta-item meta-stock">
                              <strong>Stock:</strong>{" "}
                              {conUnidad(producto.cantidad, producto.unidad)}
                              {producto.cantidadPorEnvase && producto.nombreEnvase && (
                                <span style={{ opacity: 0.75, marginLeft: "0.25rem" }}>
                                  ≈ {formatearNumero(producto.cantidad / producto.cantidadPorEnvase, 1)}{" "}
                                  {labelEnvase(producto.nombreEnvase).toLowerCase()}
                                </span>
                              )}
                            </span>

                            {producto.cantidadPorEnvase && producto.nombreEnvase && (
                              <span className="meta-item meta-envase">
                                <strong>Envase:</strong>{" "}
                                1 {labelEnvase(producto.nombreEnvase).toLowerCase()} ={" "}
                                {conUnidad(producto.cantidadPorEnvase, producto.unidad)}
                              </span>
                            )}

                            <span className="meta-item meta-compra">
                              <strong>Costo:</strong>{" "}
                              {formatearMonto(producto.precioCompra)}/{unidadSingular(producto.unidad)}
                              {producto.cantidadPorEnvase && producto.nombreEnvase && (
                                <span style={{ opacity: 0.75, marginLeft: "0.25rem" }}>
                                  ·{" "}
                                  {formatearMonto(
                                    producto.precioCompra * producto.cantidadPorEnvase,
                                  )}
                                  /{labelEnvase(producto.nombreEnvase).toLowerCase()}
                                </span>
                              )}
                            </span>
                          </>
                        )}

                        {producto.seVende && (
                          <span className="meta-item meta-venta">
                            <strong>Venta:</strong>{" "}
                            {formatearMonto(producto.precioVenta)}
                          </span>
                        )}

                        <span className="meta-item meta-info">
                          <strong>Compra:</strong>{" "}
                          {new Date(producto.fechaCompra).toLocaleDateString("es-ES")}
                        </span>

                        {producto.updatedAt && (
                          <span className="meta-item meta-info">
                            <strong>Editado:</strong>{" "}
                            {new Date(producto.updatedAt).toLocaleDateString("es-ES")}
                          </span>
                        )}

                        {producto.createdBy && (
                          <span className="meta-item meta-info">
                            <strong>Por:</strong>{" "}
                            {producto.createdBy.nombre || producto.createdBy.email}
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
                  );
                })}
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