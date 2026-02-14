// src/pages/SalesDashboard.jsx
import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import "../styles/SalesDashboard.css";
import Navbar from "../components/NavBar2";

const API_URL = import.meta.env.VITE_API_URL;

// Lazy load de axios solo cuando se necesite
let axiosModule = null;
const getAxios = async () => {
  if (!axiosModule) {
    axiosModule = await import("axios");
  }
  return axiosModule.default;
};

const SalesDashboard = () => {
  const [productos, setProductos] = useState([]);
  const [productosVisibles, setProductosVisibles] = useState([]);
  const [carrito, setCarrito] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true); // Solo para carga inicial
  const [searching, setSearching] = useState(false); // ⭐ NUEVO: para búsquedas
  const [loadingMore, setLoadingMore] = useState(false);
  const [processingVenta, setProcessingVenta] = useState(false);
  const [mostrarResultado, setMostrarResultado] = useState(false);
  const [ventaExitosa, setVentaExitosa] = useState(null);
  const [mostrarNotificacion, setMostrarNotificacion] = useState(false);

  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const observerTarget = useRef(null);
  const searchInputRef = useRef(null); // ⭐ NUEVO: ref para mantener el foco
  const timeoutRef = useRef(null);

  const PRODUCTOS_POR_PAGINA = 10;

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem("token");
    return {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
  }, []);

  const fetchProductos = useCallback(
    async (searchTerm = "", isInitialLoad = false) => {
      // ⭐ Solo mostrar pantalla de carga completa en la primera carga
      if (isInitialLoad) {
        setLoading(true);
      } else {
        setSearching(true); // ⭐ Indicador pequeño para búsquedas
      }

      setCurrentPage(0);
      setProductos([]);
      setProductosVisibles([]);
      setHasMore(true);

      try {
        const axios = await getAxios();
        const url = searchTerm
          ? `${API_URL}/api/products/para-venta?search=${encodeURIComponent(searchTerm)}`
          : `${API_URL}/api/products/para-venta`;

        const response = await axios.get(url, getAuthHeaders());
        const productosData = response.data.productos || response.data;

        setProductos(productosData);

        const inicial = productosData.slice(0, PRODUCTOS_POR_PAGINA);
        setProductosVisibles(inicial);
        setHasMore(productosData.length > PRODUCTOS_POR_PAGINA);
        setCurrentPage(1);
      } catch (error) {
        console.error("❌ Error al cargar productos:", error);
        if (error.response?.status === 401 || error.response?.status === 403) {
          alert("⚠️ Sesión expirada. Por favor inicia sesión nuevamente.");
        } else {
          alert("Error al cargar productos.");
        }
      } finally {
        setLoading(false);
        setSearching(false); // ⭐ Quitar indicador de búsqueda
      }
    },
    [getAuthHeaders],
  );

  const cargarMasProductos = useCallback(() => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);

    const siguientePagina = currentPage + 1;
    const inicio = currentPage * PRODUCTOS_POR_PAGINA;
    const fin = siguientePagina * PRODUCTOS_POR_PAGINA;

    const nuevosProductos = productos.slice(inicio, fin);

    if (nuevosProductos.length > 0) {
      setProductosVisibles((prev) => [...prev, ...nuevosProductos]);
      setCurrentPage(siguientePagina);
      setHasMore(fin < productos.length);
    } else {
      setHasMore(false);
    }

    setLoadingMore(false);
  }, [currentPage, productos, hasMore, loadingMore]);

  useEffect(() => {
    const target = observerTarget.current; // 👈 CLAVE

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          cargarMasProductos();
        }
      },
      { threshold: 0.1 },
    );

    if (target) {
      observer.observe(target);
    }

    return () => {
      if (target) {
        observer.unobserve(target);
      }
    };
  }, [hasMore, loadingMore, cargarMasProductos]);

  useEffect(() => {
    fetchProductos("", true); // ⭐ true = carga inicial
    document.title = "Ventas - Sala de Juegos Ruiz";
  }, [fetchProductos]);

  // ✅ ELIMINADO: useEffect que restauraba el foco automáticamente
  // Esto causaba que el teclado se quedara activo en móviles

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearch(value);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // ⭐ NO establecer searching aquí para evitar pérdida de foco

    timeoutRef.current = setTimeout(() => {
      setSearching(true);
      fetchProductos(value, false);
      // setSearching(false) se maneja en fetchProductos
    }, 500);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setSearching(true);
    fetchProductos(search, false);
  };

  const limpiarBusqueda = () => {
    setSearch("");
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setSearching(true);
    fetchProductos("", false);
  };

  const agregarAlCarrito = (producto) => {
    // ✅ Quitar el foco del input de búsqueda al agregar productos
    if (searchInputRef.current) {
      searchInputRef.current.blur();
    }

    const existe = carrito.find((item) => item._id === producto._id);

    if (existe) {
      if (existe.cantidadVenta >= producto.cantidad) {
        setMostrarNotificacion(true);
        setVentaExitosa({
          esError: true,
          mensaje: `Stock insuficiente`,
          detalle: `Solo ${producto.cantidad === 1 ? "hay 1 unidad disponible" : `hay ${producto.cantidad} unidades disponibles`} de "${producto.nombre}"`,
          tipo: "warning",
        });
        setTimeout(() => setMostrarNotificacion(false), 3500);
        return;
      }
      setCarrito(
        carrito.map((item) =>
          item._id === producto._id
            ? { ...item, cantidadVenta: item.cantidadVenta + 1 }
            : item,
        ),
      );
    } else {
      setCarrito([...carrito, { ...producto, cantidadVenta: 1 }]);
      // ✅ Notificación de producto agregado ELIMINADA
    }
  };

  const cambiarCantidad = (id, nuevaCantidad) => {
    const producto = productos.find((p) => p._id === id);

    if (nuevaCantidad > producto.cantidad) {
      setMostrarNotificacion(true);
      setVentaExitosa({
        esError: true,
        mensaje: `Stock insuficiente`,
        detalle: `Solo ${producto.cantidad === 1 ? "hay 1 unidad disponible" : `hay ${producto.cantidad} unidades disponibles`}`,
        tipo: "warning",
      });
      setTimeout(() => setMostrarNotificacion(false), 3500);
      return;
    }

    if (nuevaCantidad <= 0) {
      eliminarDelCarrito(id);
      return;
    }

    setCarrito(
      carrito.map((item) =>
        item._id === id ? { ...item, cantidadVenta: nuevaCantidad } : item,
      ),
    );
  };

  const eliminarDelCarrito = (id) => {
    setCarrito(carrito.filter((item) => item._id !== id));
  };

  const calcularTotal = () => {
    return carrito.reduce(
      (total, item) => total + item.precioVenta * item.cantidadVenta,
      0,
    );
  };

  const vaciarCarrito = () => {
    if (window.confirm("¿Estás seguro de vaciar el carrito?")) {
      setCarrito([]);
      setMostrarResultado(false);
    }
  };

  const procesarVenta = async () => {
    const total = calcularTotal();

    if (carrito.length === 0) {
      alert("El carrito está vacío");
      return;
    }

    // ✅ Quitar el foco de TODOS los inputs antes de procesar
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }

    // ✅ Específicamente cerrar el teclado del input de búsqueda
    if (searchInputRef.current) {
      searchInputRef.current.blur();
    }

    setProcessingVenta(true);

    try {
      const axios = await getAxios();

      const ventaData = {
        productos: carrito.map((item) => ({
          productoId: item._id,
          nombre: item.nombre,
          cantidad: item.cantidadVenta,
          precioVenta: item.precioVenta,
          subtotal: item.precioVenta * item.cantidadVenta,
        })),
        total: total,
        montoPagado: total,
        vuelto: 0,
        fecha: new Date().toISOString(),
      };

      const ventaResponse = await axios.post(
        `${API_URL}/api/sales`,
        ventaData,
        getAuthHeaders(),
      );

      setVentaExitosa({
        total: total,
        productos: carrito,
        numeroVenta: ventaResponse.data.venta?._id || ventaResponse.data._id,
      });
      setMostrarResultado(true);

      setCarrito([]);

      // ✅ Forzar blur después de mostrar resultado
      setTimeout(() => {
        if (document.activeElement && document.activeElement.blur) {
          document.activeElement.blur();
        }
        if (searchInputRef.current) {
          searchInputRef.current.blur();
        }
      }, 100);

      fetchProductos(search, false); // ⭐ Recargar sin pantalla negra
    } catch (error) {
      console.error("❌ ERROR:", error);
      if (error.response?.status === 401) {
        alert("⚠️ Sesión expirada. Por favor inicia sesión nuevamente.");
        return;
      }
      if (error.response?.status === 403) {
        alert("⚠️ No tienes permisos para realizar esta acción.");
        return;
      }
      alert("Error al procesar la venta");
    } finally {
      setProcessingVenta(false);

      // ✅ Forzar blur adicional al finalizar
      setTimeout(() => {
        if (document.activeElement && document.activeElement.blur) {
          document.activeElement.blur();
        }
        if (searchInputRef.current) {
          searchInputRef.current.blur();
        }
      }, 200);
    }
  };

  // ⭐ Pantalla de carga SOLO para primera carga
  if (loading) {
    return (
      <div className="sales-container">
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
    <div className="sales-container">
      <Navbar />

      <div className="sales-content">
        <div className="container-fluid py-4">
          <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
            <h2 className="sales-title mb-0">💰 Sistema de Ventas</h2>
            <Link to="/sales-history" className="btn btn-outline-success">
              📊 Ver Historial
            </Link>
          </div>
          <div className="row g-4">
            <div className="col-lg-5 order-lg-2">
              <div className="card carrito-panel">
                <div className="card-header">
                  <h5 className="mb-0">📦 Productos Disponibles</h5>
                </div>
                <div className="card-body">
                  <form onSubmit={handleSearchSubmit} className="mb-3">
                    <div className="input-group">
                      <input
                        ref={searchInputRef}
                        type="text"
                        className="form-control"
                        placeholder="Buscar producto..."
                        value={search}
                        onChange={handleSearchChange}
                        inputMode="search"
                        autoComplete="off"
                        // ✅ NO auto-focus en móviles
                        autoFocus={false}
                        // ✅ Prevenir que el teclado se quede abierto
                        onFocus={(e) => {
                          // Permitir focus solo si el usuario hace clic explícitamente
                          if (processingVenta || mostrarResultado) {
                            e.target.blur();
                          }
                        }}
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
                          ></span>
                        ) : (
                          "🔍"
                        )}
                      </button>
                      {search && (
                        <button
                          className="btn btn-secondary"
                          type="button"
                          onClick={limpiarBusqueda}
                          disabled={searching}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </form>

                  <div className="productos-lista">
                    {/* ⭐ Mostrar indicador de búsqueda dentro de la lista */}
                    {searching ? (
                      <div className="text-center py-4">
                        <div
                          className="spinner-border text-primary"
                          role="status"
                        >
                          <span className="visually-hidden">Buscando...</span>
                        </div>
                        <p className="mt-2 text-muted">Buscando productos...</p>
                      </div>
                    ) : productosVisibles.length === 0 ? (
                      <div className="alert alert-info">
                        📦 No hay productos disponibles
                      </div>
                    ) : (
                      <>
                        {productosVisibles.map((producto) => (
                          <div key={producto._id} className="producto-item">
                            <img
                              src={
                                producto.imagenOptimizada ||
                                producto.imagen ||
                                "https://via.placeholder.com/60"
                              }
                              alt={producto.nombre}
                              className="producto-img"
                              loading="lazy"
                            />
                            <div className="producto-info">
                              <h6 className="producto-nombre">
                                {producto.nombre}
                              </h6>
                              <p className="producto-detalles">
                                <span className="precio">
                                  ₡{producto.precioVenta}
                                </span>
                                <span className="stock">
                                  Stock: {producto.cantidad}
                                </span>
                              </p>
                            </div>
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => agregarAlCarrito(producto)}
                              type="button"
                            >
                              + Agregar
                            </button>
                          </div>
                        ))}

                        {hasMore && (
                          <div
                            ref={observerTarget}
                            className="text-center py-3"
                          >
                            {loadingMore && (
                              <div
                                className="spinner-border spinner-border-sm text-primary"
                                role="status"
                              >
                                <span className="visually-hidden">
                                  Cargando más...
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Resto del código del carrito igual... */}
            <div className="col-lg-7 order-lg-1">
              <div className="card productos-panel">
                <div className="card-header d-flex justify-content-between align-items-center">
                  <h5 className="mb-0">🛒 Carrito de Venta</h5>
                  {carrito.length > 0 && (
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={vaciarCarrito}
                      type="button"
                    >
                      🗑️ Vaciar
                    </button>
                  )}
                </div>
                <div className="card-body">
                  {carrito.length === 0 ? (
                    <div className="carrito-vacio">
                      <p>🛒 Carrito vacío</p>
                      <small>Agrega productos para iniciar una venta</small>
                    </div>
                  ) : (
                    <>
                      <div className="carrito-items">
                        {carrito.map((item) => (
                          <div key={item._id} className="carrito-item">
                            <div className="item-info">
                              <h6>{item.nombre}</h6>
                              <p className="item-precio">
                                ₡{item.precioVenta} c/u
                              </p>
                            </div>
                            <div className="item-controls">
                              <div className="cantidad-controls">
                                <button
                                  className="btn btn-sm btn-outline-secondary"
                                  onClick={() =>
                                    cambiarCantidad(
                                      item._id,
                                      item.cantidadVenta - 1,
                                    )
                                  }
                                  type="button"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  className="form-control form-control-sm cantidad-input"
                                  value={item.cantidadVenta}
                                  onChange={(e) =>
                                    cambiarCantidad(
                                      item._id,
                                      parseInt(e.target.value) || 0,
                                    )
                                  }
                                  min="1"
                                  max={item.cantidad}
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                />
                                <button
                                  className="btn btn-sm btn-outline-secondary"
                                  onClick={() =>
                                    cambiarCantidad(
                                      item._id,
                                      item.cantidadVenta + 1,
                                    )
                                  }
                                  type="button"
                                >
                                  +
                                </button>
                              </div>
                              <div className="item-subtotal">
                                ₡
                                {(
                                  item.precioVenta * item.cantidadVenta
                                ).toFixed(2)}
                              </div>
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => eliminarDelCarrito(item._id)}
                                type="button"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="total-section">
                        <div className="total-row">
                          <span>Total a Pagar:</span>
                          <strong className="total-amount">
                            ₡{calcularTotal().toFixed(2)}
                          </strong>
                        </div>
                      </div>

                      <button
                        className="btn btn-success btn-lg w-100 mt-3"
                        onClick={procesarVenta}
                        disabled={processingVenta}
                        type="button"
                      >
                        {processingVenta ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2"></span>
                            Procesando...
                          </>
                        ) : (
                          <>✅ Procesar Venta</>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modales igual... */}
      {mostrarResultado && ventaExitosa && (
        <div
          className="modal-overlay"
          onClick={() => {
            setMostrarResultado(false);
            // ✅ Forzar blur al cerrar modal
            setTimeout(() => {
              if (document.activeElement && document.activeElement.blur) {
                document.activeElement.blur();
              }
              if (searchInputRef.current) {
                searchInputRef.current.blur();
              }
            }, 100);
          }}
        >
          <div className="modal-resultado" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-resultado">
              <h3>✅ Venta Exitosa</h3>
            </div>
            <div className="modal-body-resultado">
              <div className="resultado-row total-final">
                <span>Total:</span>
                <strong>₡{ventaExitosa.total.toFixed(2)}</strong>
              </div>

              <div className="productos-vendidos">
                <h6>Productos vendidos:</h6>
                <ul>
                  {ventaExitosa.productos.map((p, i) => (
                    <li key={i}>
                      {p.nombre} x{p.cantidadVenta} = ₡
                      {(p.precioVenta * p.cantidadVenta).toFixed(2)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="modal-footer-resultado">
              <button
                className="btn btn-primary"
                onClick={() => {
                  setMostrarResultado(false);
                  // ✅ Forzar blur al hacer clic en Aceptar
                  setTimeout(() => {
                    if (document.activeElement && document.activeElement.blur) {
                      document.activeElement.blur();
                    }
                    if (searchInputRef.current) {
                      searchInputRef.current.blur();
                    }
                  }, 100);
                }}
                type="button"
              >
                ✅ Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Solo mostrar notificaciones de ERROR o WARNING */}
      {mostrarNotificacion && ventaExitosa && ventaExitosa.esError && (
        <div className={`notificacion-exito ${ventaExitosa.tipo || "warning"}`}>
          <div className="notificacion-contenido">
            <div className="notificacion-icono">
              {ventaExitosa.tipo === "warning" ? "⚠️" : "❌"}
            </div>
            <div className="notificacion-texto">
              <h4>{ventaExitosa.mensaje}</h4>
              {ventaExitosa.detalle && <p>{ventaExitosa.detalle}</p>}
            </div>
            <button
              className="notificacion-cerrar"
              onClick={() => setMostrarNotificacion(false)}
              type="button"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesDashboard;
