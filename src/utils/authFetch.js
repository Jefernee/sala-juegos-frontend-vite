// src/utils/authFetch.js
// fetch con el token de sesión, para los módulos que NO usan axios.
//
// Los reportes se escribieron cuando el backend los tenía abiertos, así que sus
// llamadas quedaron como `fetch` sueltos: sin header Authorization y por fuera
// de los interceptores de axios (src/utils/api.js). Este helper les pone el
// token y delega el 401/403 en src/utils/sesion.js, que es la misma lógica que
// usa el interceptor de axios.

import { getToken } from "./auth";
import {
  ErrorDeSesion,
  irALoginSinSesion,
  manejarNoAutorizado,
  mensajeDeError,
} from "./sesion";

// Se reexportan para que las pantallas importen todo desde acá.
export { ErrorDeSesion, mensajeDeError };

/**
 * fetch con el token puesto. Devuelve la Response tal cual.
 * Lanza ErrorDeSesion si la sesión no sirve (y en ese caso ya redirigió).
 */
export async function authFetch(url, opts = {}) {
  const token = getToken();

  // Sin token no vale la pena pegarle al backend: la sesión se cerró o alguien
  // borró el token del navegador. Vamos directo al login en vez de esperar el
  // 401 y dejar la pantalla en blanco mientras tanto.
  if (!token) {
    throw new ErrorDeSesion(irALoginSinSesion(), "NO_TOKEN");
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
    const { manejado, mensaje } = manejarNoAutorizado(res.status, data, url);
    // Si el 401/403 no es del middleware de auth (no trae un `code` conocido),
    // se trata como un error normal del módulo y lo muestra la pantalla.
    if (manejado) throw new ErrorDeSesion(mensaje, data?.code);
    throw new Error(mensajeDeError(data, `Error ${res.status}`));
  }

  return res;
}

/**
 * Igual que authFetch pero ya devuelve el JSON. Lanza Error con el mensaje del
 * backend (`mensaje` o `error`, el que venga) si la respuesta no es 2xx.
 */
export async function authFetchJson(url, opts = {}) {
  const res = await authFetch(url, opts);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(mensajeDeError(data, `Error ${res.status}`));
  return data;
}
