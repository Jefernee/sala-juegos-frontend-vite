import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AppRouter from "./components/AppRouter";
import RequireRol from "./components/RequireRol";
import ErrorBoundary from "./components/ErrorBoundary";
import PantallaCarga from "./components/PantallaCarga";
import Home2 from "./pages/Home2";
import Login from "./pages/Login";
import PublicProductsList from "./pages/PublicProductList";
import TorneosPublic from "./pages/TorneosPublic";
import TorneoPublicDetalle from "./pages/TorneoPublicDetalle";

// Dashboard (lazy)
const SalesDashboard = lazy(() => import("./pages/SalesDashboard"));
const ProductsList = lazy(() => import("./pages/ProductsList"));
const ManageProducts = lazy(() => import("./pages/ManageProducts"));
const PedidosDashboard = lazy(() => import("./pages/PedidosDashboard"));
const ReportesDashboard = lazy(() => import("./pages/ReportesDashboard"));
const PlaysManagement = lazy(() => import("./pages/PlaysManagement"));
const SalesHistory = lazy(() => import("./pages/SalesHistory"));
const Administracion = lazy(() => import("./pages/Administracion"));

const PageLoader = () => <PantallaCarga />;

function App() {
  return (
    <AppRouter>
      <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Rutas públicas */}
          <Route path="/" element={<Home2 />} />
          <Route path="/login" element={<Login />} />
          <Route path="/productos" element={<PublicProductsList />} />
          {/* Torneos públicos (sin login) — el detalle coincide con urlPublica */}
          <Route path="/torneos" element={<TorneosPublic />} />
          <Route path="/torneos/:id" element={<TorneoPublicDetalle />} />
          {/* Rutas del dashboard (protegidas por rol) */}
          {/* Vendedor: solo "sales" y "plays". Los demás módulos lo redirigen a Ventas. */}
          <Route
            path="/dashboard"
            element={<RequireRol modulo="manageProducts"><ManageProducts /></RequireRol>}
          />
          <Route
            path="/dashboard/sales"
            element={<RequireRol modulo="sales"><SalesDashboard /></RequireRol>}
          />
          <Route
            path="/dashboard/add-product"
            element={<RequireRol modulo="manageProducts"><ManageProducts /></RequireRol>}
          />
          <Route
            path="/dashboard/products"
            element={<RequireRol modulo="products"><ProductsList /></RequireRol>}
          />
          <Route
            path="/dashboard/manage-products"
            element={<RequireRol modulo="manageProducts"><ManageProducts /></RequireRol>}
          />
          <Route
            path="/dashboard/pedidos"
            element={<RequireRol modulo="pedidos"><PedidosDashboard /></RequireRol>}
          />
          <Route
            path="/dashboard/reportes"
            element={<RequireRol modulo="reportes"><ReportesDashboard /></RequireRol>}
          />
          <Route
            path="/dashboard/plays"
            element={<RequireRol modulo="plays"><PlaysManagement /></RequireRol>}
          />
          <Route
            path="/sales-history"
            element={<RequireRol modulo="salesHistory"><SalesHistory /></RequireRol>}
          />
          <Route
            path="/dashboard/administracion"
            element={<RequireRol modulo="administracion"><Administracion /></RequireRol>}
          />
          {/* Cualquier ruta desconocida vuelve al inicio (evita pantallas en blanco) */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      </ErrorBoundary>
    </AppRouter>
  );
}

export default App;
