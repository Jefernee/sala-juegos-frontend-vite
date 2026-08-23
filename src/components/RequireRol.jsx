// src/components/RequireRol.jsx
// Guarda de las rutas del dashboard. Verifica tres cosas antes de renderizar:
//  1) Que haya token guardado. Si no, al login.
//  2) Que la sesión siga valiendo según el backend (SesionProvider pregunta a
//     /api/auth/verify). Mientras la respuesta no llega se muestra la pantalla
//     de carga, NO el login: con sesión buena, mandar al login aunque sea un
//     instante es mentirle al usuario y le hace perder el lugar donde estaba.
//  3) Que el rol pueda ver ese módulo. Si no (el caso típico: el vendedor
//     entrando por URL a un módulo que no le toca), lo lleva a Ventas.
// La seguridad real la aplica el backend; esto es navegación.
import { Navigate } from "react-router-dom";
import { getToken, puedeVerModulo } from "../utils/auth";
import { useSesion, ESTADO } from "../hocks/useSesion";
import PantallaCarga from "./PantallaCarga";

const RequireRol = ({ modulo, children }) => {
  const { estado } = useSesion();

  if (!getToken()) return <Navigate to="/login" replace />;
  if (estado === ESTADO.VERIFICANDO) return <PantallaCarga />;
  if (estado === ESTADO.SIN_SESION) return <Navigate to="/login" replace />;
  if (!puedeVerModulo(modulo)) return <Navigate to="/dashboard/sales" replace />;

  return children;
};

export default RequireRol;
