import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import AppRouter from "./components/AppRouter";
import Home2 from "./pages/Home2";
import Login from "./pages/Login";
import Inscripcion from "./pages/Inscripcion";
import PublicProductsList from "./pages/PublicProductList";

// Dashboard (lazy)
const SalesDashboard = lazy(() => import("./pages/SalesDashboard"));
const ProductsList = lazy(() => import("./pages/ProductsList"));
const ManageProducts = lazy(() => import("./pages/ManageProducts"));
const PedidosDashboard = lazy(() => import("./pages/PedidosDashboard"));
const ReportesDashboard = lazy(() => import("./pages/ReportesDashboard"));
const PlaysManagement = lazy(() => import("./pages/PlaysManagement"));
const SalesHistory = lazy(() => import("./pages/SalesHistory"));

const PageLoader = () => <div>Cargando...</div>;

function App() {
  return (
    <AppRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Rutas públicas */}
          <Route path="/" element={<Home2 />} />
          <Route path="/login" element={<Login />} />
          <Route path="/inscripcion" element={<Inscripcion />} />
          <Route path="/productos" element={<PublicProductsList />} />
          {/* Rutas del dashboard */}
          {/* ✅ CAMBIO: Ahora /dashboard apunta a ManageProducts */}
          <Route path="/dashboard" element={<ManageProducts />} />
          <Route path="/dashboard/sales" element={<SalesDashboard />} />
          {/* ✅ CAMBIO: /dashboard/add-product también apunta a ManageProducts */}
          <Route path="/dashboard/add-product" element={<ManageProducts />} />
          <Route path="/dashboard/products" element={<ProductsList />} />
          <Route path="/dashboard/manage-products" element={<ManageProducts />} />
          <Route path="/dashboard/pedidos" element={<PedidosDashboard />} />
          <Route path="/dashboard/reportes" element={<ReportesDashboard />} />
          <Route path="/dashboard/plays" element={<PlaysManagement />} />
          <Route path="/sales-history" element={<SalesHistory />} />
        </Routes>
      </Suspense>
    </AppRouter>
  );
}

export default App;
