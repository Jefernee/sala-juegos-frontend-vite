/**
 * ManageProducts Component
 *
 * Componente principal para la gestión de productos del inventario.
 * Permite visualizar, buscar, editar y eliminar productos desde una interfaz unificada.
 *
 * Características principales:
 * - Listado completo de productos con paginación
 * - Búsqueda en tiempo real por nombre de producto
 * - **NUEVO**: Formulario modal unificado para agregar y editar
 * - Edición de productos con opción de cambiar imagen
 * - Eliminación de productos con confirmación
 * - Visualización de imágenes con zoom
 * - Control de disponibilidad para venta
 * - Auditoría de cambios (quién modificó)
 * - Interfaz responsive y optimizada
 *
 * @component
 * @author jefernee
 * @version 3.0.0
 */

import { useState, useEffect } from "react";
import axios from "axios";
import { Helmet } from "react-helmet";
import "../styles/ManageProducts.css";
import Navbar from "../components/NavBar2";
import ProductForm from "../components/ProductForm";

const ManageProducts = () => {
  // ===================================
  // ESTADO DEL COMPONENTE
  // ===================================

  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [search, setSearch] = useState("");
  
  // ✅ NUEVO: Estado del formulario modal
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  // ===================================
  // FUNCIONES DE CARGA DE DATOS
  // ===================================

  /**
   * Obtiene la lista de productos del servidor
   * @async
   * @param {string} searchTerm - Término de búsqueda opcional
   */
  const fetchProductos = async (searchTerm = "") => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");

      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/products/list?page=1&limit=100&search=${searchTerm}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log("Productos cargados:", response.data);
      setProductos(response.data.productos);
    } catch (error) {
      console.error("Error al cargar productos:", error);
      if (error.response?.status === 401) {
        alert("Sesión expirada. Por favor inicia sesión nuevamente.");
      } else {
        alert("Error al cargar productos.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ===================================
  // EFECTOS (LIFECYCLE)
  // ===================================

  useEffect(() => {
    fetchProductos("");
  }, []);

  // ===================================
  // MANEJADORES DE EVENTOS
  // ===================================

  const handleSearch = (e) => {
    e.preventDefault();
    fetchProductos(search);
  };

  // ✅ NUEVO: Abrir formulario para agregar
  const handleOpenAddForm = () => {
    setEditingProduct(null);
    setShowForm(true);
  };

  // ✅ NUEVO: Abrir formulario para editar
  const handleOpenEditForm = (producto) => {
    setEditingProduct(producto);
    setShowForm(true);
  };

  // ✅ NUEVO: Cerrar formulario
  const handleCloseForm = () => {
    setShowForm(false);
    setEditingProduct(null);
  };

  // ✅ NUEVO: Callback de éxito al guardar
  const handleFormSuccess = () => {
    handleCloseForm();
    fetchProductos(search); // Recargar la lista
  };

  /**
   * Elimina un producto del inventario
   * @async
   * @param {string} id - ID del producto a eliminar
   * @param {string} nombre - Nombre del producto
   */
  const handleDelete = async (id, nombre) => {
    const confirmar = window.confirm(
      `¿Estás seguro de eliminar "${nombre}"?\n\nEsta acción eliminará el producto y todos sus datos relacionados (disponibilidad, auditoría, etc).\n\nEsta acción no se puede deshacer.`
    );

    if (!confirmar) return;

    setProcessing(id);

    try {
      const token = localStorage.getItem("token");

      await axios.delete(
        `${import.meta.env.VITE_API_URL}/api/products/${id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      // Filtra el producto eliminado del estado local
      setProductos(productos.filter((p) => p._id !== id));

      alert(
        `"${nombre}" y todos sus datos relacionados fueron eliminados correctamente.`
      );
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
  // RENDER CONDICIONAL - LOADING
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

      {/* ============= NAVBAR ============= */}
      <Navbar />

      {/* ✅ FORMULARIO MODAL */}
      {showForm && (
        <ProductForm
          producto={editingProduct}
          onClose={handleCloseForm}
          onSuccess={handleFormSuccess}
        />
      )}

      {/* ============= CONTENIDO PRINCIPAL ============= */}
      <div className="manage-content">
        <div className="container py-4">
          <div className="text-center mb-4">
            <h2 className="manage-title mb-3">🎮 Gestionar Productos</h2>
            <p className="subtitle">
              Ver, editar y eliminar productos desde un solo lugar
            </p>
          </div>

          {/* ===== BARRA DE BÚSQUEDA Y BOTÓN AGREGAR ===== */}
          <div className="mb-4">
            <div className="d-flex gap-2 mb-3">
              {/* ✅ BOTÓN AGREGAR PRODUCTO */}
              <button
                className="btn btn-add-product"
                onClick={handleOpenAddForm}
                title="Agregar nuevo producto"
              >
                ➕ Agregar Producto
              </button>
            </div>

            <form onSubmit={handleSearch}>
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
                      fetchProductos("");
                    }}
                  >
                    ✕ Limpiar
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* ===== CONTADOR DE RESULTADOS ===== */}
          {productos.length > 0 && (
            <p className="text-muted text-center mb-3">
              {productos.length} producto{productos.length !== 1 ? "s" : ""}
              encontrado{productos.length !== 1 ? "s" : ""}
              {search && ` para "${search}"`}
            </p>
          )}

          {/* ===== LISTA DE PRODUCTOS ===== */}
          {productos.length === 0 ? (
            <div className="alert alert-info text-center">
              📦 No se encontraron productos{" "}
              {search && `con el término "${search}"`}
            </div>
          ) : (
            <div className="products-list">
              {productos.map((producto) => (
                <div key={producto._id} className="product-item">
                  {/* ===== IMAGEN DEL PRODUCTO ===== */}
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

                  {/* ===== DETALLES DEL PRODUCTO ===== */}
                  <div className="product-details">
                    <h5 className="product-name">
                      {producto.nombre}
                      {/* Badge de disponibilidad */}
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
                      <span className="meta-item">
                        <strong>Cantidad:</strong> {producto.cantidad}
                      </span>
                      <span className="meta-item">
                        <strong>P. Compra:</strong> ₡{producto.precioCompra}
                      </span>
                      <span className="meta-item">
                        <strong>P. Venta:</strong> ₡{producto.precioVenta}
                      </span>
                      <span className="meta-item">
                        <strong>Fecha:</strong>{" "}
                        {new Date(producto.fechaCompra).toLocaleDateString(
                          "es-ES"
                        )}
                      </span>
                      {/* Información de auditoría */}
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

                  {/* ===== BOTONES DE ACCIÓN ===== */}
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
                          <span className="spinner-border spinner-border-sm me-1"></span>
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
          )}
        </div>
      </div>
    </div>
  );
};

export default ManageProducts;
