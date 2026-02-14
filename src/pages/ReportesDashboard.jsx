import React, { useState, useEffect } from "react";
import "../styles/ReportesDashboard.css";
// ✅ AGREGA ESTO EN SU LUGAR:
import Navbar from "../components/NavBar2";
import { lazy, Suspense } from "react";
import {
  TrendingUp,
  AlertTriangle,
  DollarSign,
  ShoppingCart,
} from "lucide-react";
// ✅ Mueve el lazy fuera del archivo o usa esta estructura
let GraficoVentas;
const API_URL = import.meta.env.VITE_API_URL + "/api";

export default function ReportesDashboard() {
  const [resumen, setResumen] = useState(null);
  const [masVendidos, setMasVendidos] = useState([]);
  const [menosVendidos, setMenosVendidos] = useState([]);
  const [stockBajo, setStockBajo] = useState({ stockBajo: [], agotados: [] });
  const [ventasPorDia, setVentasPorDia] = useState([]);
  const [estadisticasPedidos, setEstadisticasPedidos] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ Inicializa el lazy component DENTRO del componente
  if (!GraficoVentas) {
    GraficoVentas = lazy(() => import("../components/GraficoVentas"));
  }
  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const [
        resumenRes,
        masVendidosRes,
        menosVendidosRes,
        stockBajoRes,
        ventasRes,
        pedidosRes,
      ] = await Promise.all([
        fetch(`${API_URL}/reports/resumen`),
        fetch(`${API_URL}/reports/mas-vendidos?limit=10`),
        fetch(`${API_URL}/reports/menos-vendidos?limit=10`),
        fetch(`${API_URL}/reports/stock-bajo`),
        fetch(`${API_URL}/reports/ventas-periodo?days=30`),
        fetch(`${API_URL}/reports/pedidos-stats`),
      ]);

      setResumen(await resumenRes.json());
      setMasVendidos((await masVendidosRes.json()).productos || []);
      setMenosVendidos((await menosVendidosRes.json()).productos || []);
      setStockBajo(await stockBajoRes.json());
      setVentasPorDia((await ventasRes.json()).datos || []);
      setEstadisticasPedidos(await pedidosRes.json());
    } catch (error) {
      console.error("Error al cargar datos:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatearMoneda = (valor) => {
    return new Intl.NumberFormat("es-CR", {
      style: "currency",
      currency: "CRC",
      minimumFractionDigits: 0,
    }).format(valor);
  };

  if (loading) {
    return (
      <div className="reportes-loading-screen">
        <div className="reportes-loading-content">
          <div className="reportes-loading-spinner"></div>
          <p className="reportes-loading-text">Cargando reportes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="reportes-dashboard">
      {/* ✅ NAVBAR AGREGADO */}
      <Navbar />

      {/* ✅ CONTENIDO ORIGINAL */}
      <div className="reportes-container">
        {/* Header */}
        <div className="reportes-header">
          <h1 className="reportes-title">Reportes y Estadísticas</h1>
          <p className="reportes-subtitle">Análisis completo de tu negocio</p>
        </div>

        {/* Tarjetas de Resumen */}
        <div className="reportes-resumen-grid">
          {/* Ventas Hoy */}
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

          {/* Ventas del Mes */}
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

          {/* Pedidos Pendientes */}
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

          {/* Productos Agotados */}
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
          {/* Inventario Total */}
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
                <span>
                  📦 {resumen?.inventarioTotal?.totalProductos || 0} productos
                </span>
                <span>
                  {resumen?.inventarioTotal?.totalUnidades || 0} unidades
                </span>
              </div>
            </div>
            <p className="reportes-inventario-nota">
              Incluye todos los productos de la sala
            </p>
          </div>

          {/* Inventario de Venta */}
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
                <span>
                  🛒 {resumen?.inventarioVenta?.totalProductos || 0} productos
                </span>
                <span>
                  {resumen?.inventarioVenta?.totalUnidades || 0} unidades
                </span>
              </div>
              <div className="reportes-inventario-porcentaje">
                {(
                  (resumen?.inventarioVenta?.valorTotal /
                    resumen?.inventarioTotal?.valorTotal) *
                    100 || 0
                ).toFixed(1)}
                % del inventario total
              </div>
            </div>
          </div>
        </div>

        {/* Productos Más Vendidos */}
        <div className="reportes-tarjeta-blanca reportes-productos-mas-vendidos">
          <h3 className="reportes-tarjeta-titulo">🏆 Productos Más Vendidos</h3>
          <p className="reportes-tarjeta-subtitulo">Últimos 30 días</p>
          <div>
            {masVendidos.map((producto, index) => (
              <div key={index} className="reportes-producto-item">
                <div className="reportes-producto-izquierda">
                  <div className="reportes-producto-numero">#{index + 1}</div>
                  <div className="reportes-producto-info">
                    <h4>{producto.nombre}</h4>
                    <p>{producto.cantidadVendida} unidades</p>
                  </div>
                </div>
                <p className="reportes-producto-precio">
                  {formatearMoneda(producto.totalVentas)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Productos Menos Vendidos */}
        <div className="reportes-tarjeta-blanca">
          <h3 className="reportes-tarjeta-titulo">📉 Productos Menos Vendidos</h3>
          <p className="reportes-tarjeta-subtitulo">
            Últimos 30 días (solo productos de venta)
          </p>
          <div className="reportes-menos-vendidos-grid">
            {menosVendidos.map((producto, index) => (
              <div key={index} className="reportes-producto-menos-vendido">
                <h4>{producto.nombre}</h4>
                <p>
                  {producto.cantidadVendida} vendidas | Stock:{" "}
                  {producto.stockActual}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Stock Bajo */}
        <div className="reportes-stock-grid">
          {/* Stock Bajo */}
          <div className="reportes-tarjeta-blanca">
            <h3 className="reportes-tarjeta-titulo">
              ⚠️ Stock Bajo (Productos de Venta)
            </h3>
            <p className="reportes-tarjeta-subtitulo">
              Productos con inventario crítico
            </p>
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

          {/* Productos Agotados */}
          <div className="reportes-tarjeta-blanca">
            <h3 className="reportes-tarjeta-titulo">❌ Productos Agotados (Venta)</h3>
            <p className="reportes-tarjeta-subtitulo">
              Requieren reabastecimiento urgente
            </p>
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

        {/* ✅ GRÁFICA CON LAZY LOADING */}
        <div className="reportes-tarjeta-blanca">
          <h3 className="reportes-tarjeta-titulo">📈 Ventas por Día</h3>
          <p className="reportes-tarjeta-subtitulo">Últimos 30 días</p>
          <Suspense
            fallback={
              <div
                style={{
                  height: "300px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div className="reportes-loading-spinner"></div>
              </div>
            }
          >
            <GraficoVentas
              ventasPorDia={ventasPorDia}
              formatearMoneda={formatearMoneda}
            />
          </Suspense>
        </div>

        {/* Estadísticas de Pedidos */}
        {estadisticasPedidos && (
          <div className="reportes-tarjeta-blanca">
            <h3 className="reportes-tarjeta-titulo">📦 Estadísticas de Pedidos</h3>
            <div className="reportes-pedidos-stats-grid">
              <div className="reportes-stat-pedido gris">
                <p className="reportes-stat-numero gris">
                  {estadisticasPedidos.estadisticas?.total || 0}
                </p>
                <p className="reportes-stat-label">Total</p>
              </div>
              <div className="reportes-stat-pedido amarillo">
                <p className="reportes-stat-numero amarillo">
                  {estadisticasPedidos.estadisticas?.pendientes || 0}
                </p>
                <p className="reportes-stat-label">Pendientes</p>
              </div>
              <div className="reportes-stat-pedido azul">
                <p className="reportes-stat-numero azul">
                  {estadisticasPedidos.estadisticas?.confirmados || 0}
                </p>
                <p className="reportes-stat-label">Confirmados</p>
              </div>
              <div className="reportes-stat-pedido verde">
                <p className="reportes-stat-numero verde">
                  {estadisticasPedidos.estadisticas?.completados || 0}
                </p>
                <p className="reportes-stat-label">Completados</p>
              </div>
              <div className="reportes-stat-pedido rojo">
                <p className="reportes-stat-numero rojo">
                  {estadisticasPedidos.estadisticas?.cancelados || 0}
                </p>
                <p className="reportes-stat-label">Cancelados</p>
              </div>
            </div>

            <h4 className="reportes-pedidos-titulo">Pedidos Recientes</h4>
            <div>
              {estadisticasPedidos.recientes?.map((pedido, index) => (
                <div key={index} className="reportes-pedido-reciente">
                  <div className="reportes-pedido-izquierda">
                    {pedido.productoId?.imagen && (
                      <img
                        src={pedido.productoId.imagen}
                        alt=""
                        className="reportes-pedido-imagen"
                      />
                    )}
                    <div className="reportes-pedido-info">
                      <h4>{pedido.productoId?.nombre || "Producto"}</h4>
                      <p>
                        {pedido.nombreCliente} - {pedido.cantidad} unidades
                      </p>
                    </div>
                  </div>
                  <span className={`reportes-pedido-estado ${pedido.estado}`}>
                    {pedido.estado}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
