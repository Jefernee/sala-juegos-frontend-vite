// src/utils/auth.js
// Helpers de sesión y roles. La sesión se guarda en localStorage al hacer login
// ("token" + "user"). El objeto user incluye `rol` ("administrador" | "colaborador"
// | "vendedor"). La UI usa este `rol` para decidir qué módulos mostrar; la
// seguridad real la aplica el backend (403 { code: "ROL_NO_AUTORIZADO" }).

export const ROLES = {
  ADMIN: "administrador",
  COLABORADOR: "colaborador",
  VENDEDOR: "vendedor",
};

// Módulos que SÍ ve el vendedor. Cualquier otro módulo se le oculta.
export const MODULOS_VENDEDOR = ["sales", "plays"];

export const getUsuario = () => {
  try {
    return JSON.parse(localStorage.getItem("user")) || null;
  } catch {
    return null;
  }
};

export const getToken = () => localStorage.getItem("token");

// El rol se lee del user guardado. Si por algún motivo no viene (sesiones
// viejas), asumimos "colaborador" (ve todo) para no romper el acceso del
// personal de confianza; el backend igual bloquea lo que no corresponda.
export const getRol = () => getUsuario()?.rol || ROLES.COLABORADOR;

export const esAdministrador = () => getRol() === ROLES.ADMIN;
export const esVendedor = () => getRol() === ROLES.VENDEDOR;

// ¿El rol actual puede ver/entrar a un módulo del dashboard?
// administrador y colaborador ven todo; el vendedor solo su lista blanca.
export const puedeVerModulo = (modulo) => {
  if (esVendedor()) return MODULOS_VENDEDOR.includes(modulo);
  return true;
};

// Solo el administrador (dueño) gestiona usuarios/roles.
export const puedeGestionarUsuarios = () => esAdministrador();
