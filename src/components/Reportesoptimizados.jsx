import React, { useState, useEffect } from "react";
import { lazy, Suspense } from "react";
import {
  TrendingUp,
  AlertTriangle,
  DollarSign,
  ShoppingCart,
  RefreshCw,
  Zap,
} from "lucide-react";

const GraficoVentas = lazy(() => import("./GraficoVentas"));

const API_URL = import.meta.env.VITE_API_URL + "/api";

export default function ReportesOptimizados() {
  const [resumen, setResumen] = useState(null);
  const [masVendidos, setMasVendidos] = useState([]);
  const [stockBajo, setStockBajo] = useState({ stockBajo: [], agotados: [] });
  const [ventasPorDia, setVentasPorDia] = useState([]);
  const [estadisticasPedidos, setEstadisticasPedidos] = useState(null);
  
  const [loadingResumen, setLoadingResumen] = useState(true);
  const [loadingDetalles, setLoadingDetalles] = useState(true);
  const [error, setError] = useState(null);
  const [tiemposCarga, setTiemposCarga] = useState({});

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setError(null);

      // FASE 1: Cargar resumen primero (CON TIMER)
      // ⚠️ NOTA: Resumen sigue usando /reports porque necesita inventario y pedidos
      setLoadingResumen(true);
      const inicioResumen = performance.now();
      const resumenRes = await fetch(`${API_URL}/reports/resumen`);
      if (!resumenRes.ok) throw new Error("Error al cargar resumen");
      const resumenData = await resumenRes.json();
      const finResumen = performance.now();
      setResumen(resumenData);
      setLoadingResumen(false);

      // FASE 2: Cargar detalles en paralelo (CON TIMERS)
      // ⚡ ESTOS SÍ usan /daily-aggregates (sistema optimizado)
      setLoadingDetalles(true);
      const inicioDetalles = performance.now();
      
      const hoy = new Date();
      const hace30Dias = new Date();
      hace30Dias.setDate(hace30Dias.getDate() - 30);
      
      const formatDate = (date) => date.toISOString().split('T')[0];
      
      const [
        masVendidosRes,
        stockBajoRes,
        ventasRes,
        pedidosRes,
      ] = await Promise.all([
        fetch(`${API_URL}/daily-aggregates/top-products?startDate=${formatDate(hace30Dias)}&endDate=${formatDate(hoy)}&limit=10`),
        fetch(`${API_URL}/reports/stock-bajo`), // Este sigue en reports
        fetch(`${API_URL}/daily-aggregates/range?startDate=${formatDate(hace30Dias)}&endDate=${formatDate(hoy)}`),
        fetch(`${API_URL}/reports/pedidos-stats`), // Este sigue en reports
      ]);
      
      const finDetalles = performance.now();

      if (masVendidosRes.ok) {
        const data = await masVendidosRes.json();
        setMasVendidos(data.topProductos || []); // ⚠️ Cambió de 'productos' a 'topProductos'
      }
      
      if (stockBajoRes.ok) {
        const data = await stockBajoRes.json();
        setStockBajo(data);
      }
      
      if (ventasRes.ok) {
        const data = await ventasRes.json();
        // Procesar datos de DailyAggregate para la gráfica
        const ventasPorDia = data.agregados?.reduce((acc, item) => {
          const fechaStr = new Date(item.fecha).toISOString().split('T')[0];
          const existing = acc.find(v => v.fecha === fechaStr);
          
          if (existing) {
            existing.total += item.totalVentas || 0;
            existing.cantidad += item.numeroTransacciones || 0;
          } else {
            acc.push({
              fecha: fechaStr,
              total: item.totalVentas || 0,
              cantidad: item.numeroTransacciones || 0
            });
          }
          
          return acc;
        }, []) || [];
        
        setVentasPorDia(ventasPorDia);
      }
      
      if (pedidosRes.ok) {
        const data = await pedidosRes.json();
        setEstadisticasPedidos(data);
      }

      // Guardar tiempos de carga
      setTiemposCarga({
        resumen: Math.round(finResumen - inicioResumen),
        detalles: Math.round(finDetalles - inicioDetalles),
        total: Math.round(finDetalles - inicioResumen)
      });

      setLoadingDetalles(false);
    } catch (error) {
      console.error("Error al cargar datos:", error);
      setError("No se pudieron cargar los reportes. Intenta de nuevo.");
      setLoadingResumen(false);
      setLoadingDetalles(false);
    }
  };

  const formatearMoneda = (valor) => {
    return new Intl.NumberFormat("es-CR", {
      style: "currency",
      currency: "CRC",
      minimumFractionDigits: 0,
    }).format(valor);
  };

  if (loadingResumen) {
    return (
      <div className="reportes-loading-screen-small">
        <div className="reportes-loading-content">
          <div className="reportes-loading-spinner"></div>
          <p className="reportes-loading-text">Cargando resumen optimizado...</p>
          <p style={{ fontSize: "14px", color: "#666", marginTop: "8px" }}>
            ⚡ Usando DailyAggregate
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="reportes-error-screen">
        <AlertTriangle size={48} color="#ef4444" />
        <p>{error}</p>
        <button onClick={cargarDatos} className="reportes-retry-btn">
          <RefreshCw size={16} />
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="reportes-ventas-contenido">
      {/* Badge de Optimización */}
      <div style={{
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        padding: "16px 24px",
        borderRadius: "12px",
        marginBottom: "24px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        color: "white"
      }}>
        <Zap size={24} />
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "600" }}>
            ⚡ Reportes Optimizados - Modo Prueba
          </h3>
          <p style={{ margin: "4px 0 0 0", fontSize: "14px", opacity: 0.9 }}>
            Usando DailyAggregate para mejor rendimiento
          </p>
        </div>
        {tiemposCarga.total && (
          <div style={{
            background: "rgba(255,255,255,0.2)",
            padding: "8px 16px",
            borderRadius: "8px",
            textAlign: "center"
          }}>
            <div style={{ fontSize: "24px", fontWeight: "700" }}>
              {tiemposCarga.total}ms
            </div>
            <div style={{ fontSize: "12px", opacity: 0.9 }}>
              Tiempo total
            </div>
          </div>
        )}
      </div>

      {/* Tarjetas de Resumen */}
      <div className="reportes-resumen-grid">
        <div className="reportes-tarjeta-resumen reporte-verde">
          <div className="reportes-tarjeta-header">
            <h3 className="reportes-tarjeta-label">Ventas Hoy</h3>
            <DollarSign className="reportes-tarjeta-icon reporte-verde" size={24} />
          </div>
          <p className="reportes-tarjeta-valor">
            {formatearMoneda(resumen?.ventasHoy?.total || 0)}
          </p>
          <p className="reportes-tarjeta-detalle reporte-verde">
            Ganancia: {formatearMoneda(resumen?.ventasHoy?.ganancias || 0)}
          </p>
          <div className="reportes-tarjeta-emoji reporte-verde">💰</div>
        </div>

        <div className="reportes-tarjeta-resumen reporte-azul">
          <div className="reportes-tarjeta-header">
            <h3 className="reportes-tarjeta-label">Ventas del Mes</h3>
            <TrendingUp className="reportes-tarjeta-icon reporte-azul" size={24} />
          </div>
          <p className="reportes-tarjeta-valor">
            {formatearMoneda(resumen?.ventasMes?.total || 0)}
          </p>
          <p className="reportes-tarjeta-detalle reporte-verde">
            Ganancia: {formatearMoneda(resumen?.ventasMes?.ganancias || 0)}
          </p>
          <div className="reportes-tarjeta-emoji azul">📊</div>
        </div>

        <div className="reportes-tarjeta-resumen reporte-amarillo">
          <div className="reportes-tarjeta-header">
            <h3 className="reportes-tarjeta-label">Pedidos Pendientes</h3>
            <ShoppingCart className="reportes-tarjeta-icon amarillo" size={24} />
          </div>
          <p className="reportes-tarjeta-valor">{resumen?.pedidosPendientes || 0}</p>
          <p className="reportes-tarjeta-detalle">
            {resumen?.inventarioVenta?.stockBajo || 0} con stock bajo
          </p>
          <div className="reportes-tarjeta-emoji amarillo">⏳</div>
        </div>

        <div className="reportes-tarjeta-resumen reporte-rojo">
          <div className="reportes-tarjeta-header">
            <h3 className="reportes-tarjeta-label">Productos Agotados</h3>
            <AlertTriangle className="reportes-tarjeta-icon rojo" size={24} />
          </div>
          <p className="reportes-tarjeta-valor">
            {resumen?.inventarioVenta?.agotados || 0}
          </p>
          <p className="reportes-tarjeta-detalle">Requieren reabastecimiento</p>
          <div className="reportes-tarjeta-emoji rojo">❌</div>
        </div>
      </div>

      {/* Inventario */}
      <div className="reportes-inventario-grid">
        <div className="reportes-tarjeta-blanca">
          <h3 className="reportes-tarjeta-titulo">🏪 Inventario Total (Sala)</h3>
          <div className="reportes-inventario-info">
            <div className="reportes-inventario-row">
              <span className="reportes-inventario-label">Valor Total:</span>
              <span className="reportes-inventario-valor indigo">
                {formatearMoneda(resumen?.inventarioTotal?.valorTotal || 0)}
              </span>
            </div>
            <div className="reportes-inventario-secundario">
              <span>📦 {resumen?.inventarioTotal?.totalProductos || 0} productos</span>
              <span>{resumen?.inventarioTotal?.totalUnidades || 0} unidades</span>
            </div>
          </div>
          <p className="reportes-inventario-nota">Incluye todos los productos de la sala</p>
        </div>

        <div className="reportes-tarjeta-blanca">
          <h3 className="reportes-tarjeta-titulo">💵 Inventario de Venta</h3>
          <div className="reportes-inventario-info">
            <div className="reportes-inventario-row">
              <span className="reportes-inventario-label">Valor Total:</span>
              <span className="reportes-inventario-valor verde">
                {formatearMoneda(resumen?.inventarioVenta?.valorTotal || 0)}
              </span>
            </div>
            <div className="reportes-inventario-secundario">
              <span>🛒 {resumen?.inventarioVenta?.totalProductos || 0} productos</span>
              <span>{resumen?.inventarioVenta?.totalUnidades || 0} unidades</span>
            </div>
            <div className="reportes-inventario-porcentaje">
              {((resumen?.inventarioVenta?.valorTotal / resumen?.inventarioTotal?.valorTotal) * 100 || 0).toFixed(1)}%
              del inventario total
            </div>
          </div>
        </div>
      </div>

      {loadingDetalles ? (
        <div className="reportes-tarjeta-blanca">
          <div className="reportes-loading-content">
            <div className="reportes-loading-spinner"></div>
            <p className="reportes-loading-text">Cargando detalles...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Productos Más Vendidos */}
          <div className="reportes-tarjeta-blanca reportes-productos-mas-vendidos">
            <h3 className="reportes-tarjeta-titulo">🏆 Productos Más Vendidos</h3>
            <p className="reportes-tarjeta-subtitulo">
              Últimos 30 días (desde DailyAggregate)
            </p>
            <div>
              {masVendidos.length > 0 ? (
                masVendidos.map((producto, index) => (
                  <div key={index} className="reportes-producto-item">
                    <div className="reportes-producto-izquierda">
                      <div className="reportes-producto-numero">#{index + 1}</div>
                      <div className="reportes-producto-info">
                        <h4>{producto.nombreProducto}</h4>
                        <p>{producto.cantidadVendida} unidades</p>
                      </div>
                    </div>
                    <p className="reportes-producto-precio">
                      {formatearMoneda(producto.totalVentas)}
                    </p>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>
                  <p style={{ fontSize: "16px", marginBottom: "8px" }}>📊 Sin datos en DailyAggregate</p>
                  <p style={{ fontSize: "14px" }}>Haz una venta para ver datos aquí</p>
                </div>
              )}
            </div>
          </div>

          {/* Stock Bajo */}
          <div className="reportes-stock-grid">
            <div className="reportes-tarjeta-blanca">
              <h3 className="reportes-tarjeta-titulo">⚠️ Stock Bajo (Productos de Venta)</h3>
              <p className="reportes-tarjeta-subtitulo">Productos con inventario crítico</p>
              <div>
                {stockBajo.stockBajo?.length > 0 ? (
                  stockBajo.stockBajo.map((producto, index) => (
                    <div key={index} className="reportes-stock-item bajo">
                      <div className="reportes-stock-info">
                        <h4>{producto.nombre}</h4>
                        <p>Solo quedan {producto.cantidad} unidades</p>
                      </div>
                      <div className="reportes-stock-icono">⚠️</div>
                    </div>
                  ))
                ) : (
                  <p className="reportes-sin-datos">No hay productos con stock bajo</p>
                )}
              </div>
            </div>

            <div className="reportes-tarjeta-blanca">
              <h3 className="reportes-tarjeta-titulo">❌ Productos Agotados (Venta)</h3>
              <p className="reportes-tarjeta-subtitulo">Requieren reabastecimiento urgente</p>
              <div>
                {stockBajo.agotados?.length > 0 ? (
                  stockBajo.agotados.map((producto, index) => (
                    <div key={index} className="reportes-stock-item agotado">
                      <div className="reportes-stock-info">
                        <h4>{producto.nombre}</h4>
                        <p>Sin stock disponible</p>
                      </div>
                      <div className="reportes-stock-icono">❌</div>
                    </div>
                  ))
                ) : (
                  <p className="reportes-sin-datos">No hay productos agotados</p>
                )}
              </div>
            </div>
          </div>

          {/* Gráfica */}
          <div className="reportes-tarjeta-blanca">
            <h3 className="reportes-tarjeta-titulo">📈 Ventas por Día</h3>
            <p className="reportes-tarjeta-subtitulo">
              Últimos 30 días (desde DailyAggregate)
            </p>
            <Suspense
              fallback={
                <div style={{ height: "300px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div className="reportes-loading-spinner"></div>
                </div>
              }
            >
              <GraficoVentas ventasPorDia={ventasPorDia} formatearMoneda={formatearMoneda} />
            </Suspense>
          </div>

          {/* Estadísticas de Pedidos */}
          {estadisticasPedidos && (
            <div className="reportes-tarjeta-blanca">
              <h3 className="reportes-tarjeta-titulo">📦 Estadísticas de Pedidos</h3>
              <div className="reportes-pedidos-stats-grid">
                <div className="reportes-stat-pedido gris">
                  <p className="reportes-stat-numero gris">{estadisticasPedidos.estadisticas?.total || 0}</p>
                  <p className="reportes-stat-label">Total</p>
                </div>
                <div className="reportes-stat-pedido amarillo">
                  <p className="reportes-stat-numero amarillo">{estadisticasPedidos.estadisticas?.pendientes || 0}</p>
                  <p className="reportes-stat-label">Pendientes</p>
                </div>
                <div className="reportes-stat-pedido azul">
                  <p className="reportes-stat-numero azul">{estadisticasPedidos.estadisticas?.confirmados || 0}</p>
                  <p className="reportes-stat-label">Confirmados</p>
                </div>
                <div className="reportes-stat-pedido verde">
                  <p className="reportes-stat-numero verde">{estadisticasPedidos.estadisticas?.completados || 0}</p>
                  <p className="reportes-stat-label">Completados</p>
                </div>
                <div className="reportes-stat-pedido rojo">
                  <p className="reportes-stat-numero rojo">{estadisticasPedidos.estadisticas?.cancelados || 0}</p>
                  <p className="reportes-stat-label">Cancelados</p>
                </div>
              </div>

              <h4 className="reportes-pedidos-titulo">Pedidos Recientes</h4>
              <div>
                {estadisticasPedidos.recientes?.map((pedido, index) => (
                  <div key={index} className="reportes-pedido-reciente">
                    <div className="reportes-pedido-izquierda">
                      {pedido.productoId?.imagen && (
                        <img src={pedido.productoId.imagen} alt="" className="reportes-pedido-imagen" />
                      )}
                      <div className="reportes-pedido-info">
                        <h4>{pedido.productoId?.nombre || "Producto"}</h4>
                        <p>{pedido.nombreCliente} - {pedido.cantidad} unidades</p>
                      </div>
                    </div>
                    <span className={`reportes-pedido-estado ${pedido.estado}`}>{pedido.estado}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Información de Rendimiento */}
          <div className="reportes-tarjeta-blanca" style={{
            background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)"
          }}>
            <h3 className="reportes-tarjeta-titulo">⚡ Información de Rendimiento</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginTop: "16px" }}>
              <div style={{ background: "white", padding: "16px", borderRadius: "8px" }}>
                <div style={{ fontSize: "24px", fontWeight: "700", color: "#667eea" }}>
                  {tiemposCarga.resumen}ms
                </div>
                <div style={{ fontSize: "14px", color: "#666", marginTop: "4px" }}>
                  Resumen General
                </div>
              </div>
              <div style={{ background: "white", padding: "16px", borderRadius: "8px" }}>
                <div style={{ fontSize: "24px", fontWeight: "700", color: "#764ba2" }}>
                  {tiemposCarga.detalles}ms
                </div>
                <div style={{ fontSize: "14px", color: "#666", marginTop: "4px" }}>
                  Detalles y Gráficas
                </div>
              </div>
              <div style={{ background: "white", padding: "16px", borderRadius: "8px" }}>
                <div style={{ fontSize: "24px", fontWeight: "700", color: "#10b981" }}>
                  {tiemposCarga.total}ms
                </div>
                <div style={{ fontSize: "14px", color: "#666", marginTop: "4px" }}>
                  Carga Total
                </div>
              </div>
            </div>
            <p style={{ marginTop: "16px", fontSize: "14px", color: "#666" }}>
              💡 <strong>Tip:</strong> Compara estos tiempos con los reportes normales. 
              El sistema optimizado debería ser 10-100x más rápido.
            </p>
          </div>
        </>
      )}
    </div>
  );
}