// src/utils/authFetch.js
// fetch con el token de sesión, para los módulos que NO usan axios.
//
// Los reportes se escribieron cuando el backend los tenía abiertos, así que sus
// llamadas quedaron como `fetch` sueltos: sin header Authorization y por fuera
// de los interceptores de axios (src/utils/api.js). Este helper centraliza las
// dos cosas que faltaban:
//   1) mandar `Authorization: Bearer <token>` en cada petición;
//   2) reaccionar a 401/403 igual que el resto de la app (login o Ventas).

import { getToken } from "./auth";

const RUTA_LOGIN = "/login";
const RUTA_VENTAS = "/dashboard/sales";

// El middleware de autenticación responde { error, code }; el resto del backend
// responde { ok: false, mensaje }. Leemos las dos formas para no mostrar un
// error vacío cuando el que contesta es el middleware.
export const mensajeDeError = (data, porDefecto = "Ocurrió un error") =>
  data?.mensaje || data?.error || porDefecto;

// Token inválido o vencido: además de mandar al login, hay que borrar la sesión
// guardada, porque el token que quedó en localStorage ya no sirve para nada.
const CODIGOS_SESION_VENCIDA = ["INVALID_TOKEN", "EXPIRED_TOKEN"];

// Error de sesión/permiso. Se distingue de un error de datos para que la
// pantalla NO pinte su banner rojo: el navegador ya está yendo a otra ruta.
export class ErrorDeSesion extends Error {
  constructor(mensaje, code) {
    super(mensaje);
    this.name = "ErrorDeSesion";
    this.code = code;
    this.esSesion = true;
  }
}

const irALogin = (aviso) => {
  if (aviso) sessionStorage.setItem("avisoSesion", aviso);
  if (window.location.pathname !== RUTA_LOGIN) {
    window.location.replace(RUTA_LOGIN);
  }
};

// Traduce la respuesta del middleware a una acción de navegación.
// Devuelve el mensaje que se usará para el ErrorDeSesion.
const manejarNoAutorizado = (status, data, url) => {
  const code = data?.code;

  if (status === 403 && code === "ROL_NO_AUTORIZADO") {
    // Es un vendedor entrando donde no le toca. Mismo comportamiento que el
    // interceptor de axios: aviso de una sola vez y de vuelta a Ventas.
    const aviso = "No tenés permiso para este módulo.";
    sessionStorage.setItem("accesoDenegado", aviso);
    if (window.location.pathname !== RUTA_VENTAS) {
      window.location.replace(RUTA_VENTAS);
    }
    return aviso;
  }

  if (status === 401) {
    if (CODIGOS_SESION_VENCIDA.includes(code)) {
      const aviso = "Tu sesión expiró, volvé a entrar.";
      localStorage.clear();
      irALogin(aviso);
      return aviso;
    }
    // NO_TOKEN / EMPTY_TOKEN / INVALID_TOKEN_FORMAT: no hay sesión válida que
    // cerrar, solo hay que mandar al login.
    //
    // Ojo: esto NO es una sesión vencida (eso es EXPIRED_TOKEN, arriba). Como
    // authFetch siempre adjunta el header cuando hay token, un NO_TOKEN que
    // venga del servidor significa que alguna llamada se hizo por fuera de este
    // helper. Lo dejamos anotado en consola para poder encontrarla, en vez de
    // que parezca "se deslogueó sola".
    console.error(
      `[authFetch] ${code}: el backend dice que no le llegó el token. ` +
        `Si estás logueado, hay una llamada hecha con fetch/axios a mano, ` +
        `por fuera de authFetch. URL: ${url}`,
    );
    const aviso = "Tenés que iniciar sesión para ver esta pantalla.";
    irALogin(aviso);
    return aviso;
  }

  return mensajeDeError(data);
};

// fetch con token. Devuelve la Response tal cual; lanza ErrorDeSesion si la
// sesión no sirve (y en ese caso ya disparó la redirección).
export async function authFetch(url, opts = {}) {
  const token = getToken();

  // Sin token no vale la pena pegarle al backend: la sesión se cerró o alguien
  // borró el token del navegador. Vamos directo al login en vez de esperar el
  // 401 y dejar la pantalla en blanco mientras tanto.
  if (!token) {
    const aviso = "Tenés que iniciar sesión para ver esta pantalla.";
    irALogin(aviso);
    throw new ErrorDeSesion(aviso, "NO_TOKEN");
  }

  const res = await fetch(url, {
    ...opts,
    headers: {
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });

  if (res.status === 401 || res.status === 403) {
    const data = await res.json().catch(() => ({}));
    const mensaje = manejarNoAutorizado(res.status, data, url);
    throw new ErrorDeSesion(mensaje, data?.code);
  }

  return res;
}

// Igual que authFetch pero ya devuelve el JSON. Lanza Error con el mensaje del
// backend (mensaje o error, el que venga) si la respuesta no es 2xx.
export async function authFetchJson(url, opts = {}) {
  const res = await authFetch(url, opts);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(mensajeDeError(data, `Error ${res.status}`));
  return data;
}
