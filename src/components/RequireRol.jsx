// src/components/RequireRol.jsx
// Guarda de rutas del dashboard. Verifica dos cosas antes de renderizar:
//  1) Que haya sesión (token). Si no, manda al login.
//  2) Que el rol pueda ver ese módulo. Si no (típico del vendedor entrando por
//     URL a un módulo que no le toca), lo redirige a Ventas.
// La seguridad real la aplica el backend; esto es UX/navegación.
import { Navigate } from "react-router-dom";
import { getToken, puedeVerModulo } from "../utils/auth";

const RequireRol = ({ modulo, children }) => {
  if (!getToken()) return <Navigate to="/login" replace />;
  if (!puedeVerModulo(modulo)) return <Navigate to="/dashboard/sales" replace />;
  return children;
};

export default RequireRol;
