// src/utils/sesion.js
// Reacción centralizada a los 401/403 del backend.
//
// La app le habla al servidor por dos caminos: axios (src/utils/api.js) y fetch
// (src/utils/authFetch.js). Antes cada uno reaccionaba distinto — axios manejaba
// el 403 de rol pero ignoraba los 401, así que una sesión vencida dejaba la
// pantalla con un error genérico en vez de mandar al login. Esta es la única
// implementación; los dos caminos la usan.
//
// REGLA (el token dura 10 años, la sesión ya no vence por tiempo):
// un 401 NO cierra la sesión. La sesión se borra únicamente cuando el backend
// dice explícitamente por qué el token dejó de servir:
//   · SESION_CERRADA  → el administrador cortó las sesiones
//   · INVALID_TOKEN   → el token no es válido para este servidor
//   · EXPIRED_TOKEN   → el token venció (no debería pasar con 10 años, pero si
//                       el backend lo dice, se le cree)
// Cualquier otro 401 (un endpoint que pide algo más, un módulo que responde mal,
// el login con la contraseña equivocada) se trata como error normal y lo muestra
// la pantalla. Borrar el token por un 401 suelto es lo que hacía que la app
// "pidiera login sola".

import { getToken } from "./auth";

const RUTA_LOGIN = "/login";

// Códigos que manda el middleware de autenticación del backend.
// No llegó el header (o llegó mal armado): no hay sesión que cerrar.
export const CODIGOS_SIN_TOKEN = [
  "NO_TOKEN",
  "EMPTY_TOKEN",
  "INVALID_TOKEN_FORMAT",
];
// El dueño cortó las sesiones desde Administración. El aviso tiene que decir
// eso — si dijera "expiró", el vendedor pensaría que es una falla del sistema.
export const CODIGO_SESION_CERRADA = "SESION_CERRADA";
export const CODIGO_TOKEN_INVALIDO = "INVALID_TOKEN";
export const CODIGO_TOKEN_VENCIDO = "EXPIRED_TOKEN";
export const CODIGO_ROL = "ROL_NO_AUTORIZADO";

// Los únicos códigos que justifican borrar la sesión guardada.
export const CODIGOS_QUE_CIERRAN_SESION = [
  CODIGO_SESION_CERRADA,
  CODIGO_TOKEN_INVALIDO,
  CODIGO_TOKEN_VENCIDO,
];

export const AVISO_SESION_CERRADA =
  "El administrador cerró las sesiones. Iniciá sesión de nuevo.";
export const AVISO_TOKEN_VENCIDO = "Tu sesión venció, volvé a entrar.";
export const AVISO_TOKEN_INVALIDO = "Tu sesión ya no es válida, volvé a entrar.";

/** ¿Este `code` del backend obliga a cerrar la sesión? */
export const cierraLaSesion = (code) =>
  CODIGOS_QUE_CIERRAN_SESION.includes(code);

/** El aviso que va a ver el usuario en el login, según por qué salió. */
export const avisoDeCierre = (code) => {
  if (code === CODIGO_SESION_CERRADA) return AVISO_SESION_CERRADA;
  if (code === CODIGO_TOKEN_VENCIDO) return AVISO_TOKEN_VENCIDO;
  return AVISO_TOKEN_INVALIDO;
};

// El backend no nombra igual el mensaje en todos lados: unos módulos responden
// { ok: false, mensaje }, el middleware de auth { error, code } y los de
// usuarios { message }. Se leen los tres para que nunca aparezca un error vacío
// —o peor, el genérico de "revisá la conexión" tapando lo que el backend
// explicaba bien.
export const mensajeDeError = (data, porDefecto = "Ocurrió un error") =>
  data?.mensaje || data?.error || data?.message || porDefecto;

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

/**
 * Decide qué hacer con una respuesta 401/403 y ejecuta la navegación.
 *
 * @returns {{ manejado: boolean, mensaje: string｜null }}
 */
export const manejarNoAutorizado = (status, data, url = "") => {
  const code = data?.code;

  if (status === 403 && code === CODIGO_ROL) {
    // El rol lo decide el backend en cada petición, así que este 403 puede
    // llegarle a alguien a quien acaban de degradar mientras trabajaba, en una
    // pantalla que su menú todavía le muestra. No se cierra la sesión ni se lo
    // saca de donde está: se devuelve `manejado: false` para que la pantalla
    // pinte el mensaje del backend como cualquier otro error. Sacarlo con un
    // `location.replace` en medio de una venta le haría perder lo que estaba
    // haciendo, y encima parecería una falla del sistema.
    // Quien entra por URL a un módulo que no le toca lo sigue frenando
    // RequireRol, que decide con el rol recién traído de /api/auth/verify.
    return { manejado: false, mensaje: null };
  }

  if (status === 401 && cierraLaSesion(code)) {
    const mensaje = avisoDeCierre(code);
    localStorage.clear();
    irALogin(mensaje);
    return { manejado: true, mensaje };
  }

  if (status === 401 && CODIGOS_SIN_TOKEN.includes(code)) {
    // Esto NO es una sesión inválida: es que la petición salió sin el header.
    if (getToken()) {
      // Hay sesión guardada, así que la llamada está hecha por fuera de
      // authFetch o del axios central. Se anota para poder encontrarla, pero no
      // se toca la sesión: sacar al usuario por un bug de una pantalla es
      // exactamente el "se desloguea solo" que estamos corrigiendo.
      console.error(
        `[sesion] ${code}: al backend no le llegó el token pese a haber ` +
          `sesión iniciada. Esa llamada está hecha con fetch/axios a mano, ` +
          `por fuera de authFetch o del axios central. URL: ${url}`,
      );
      return { manejado: false, mensaje: null };
    }
    // De verdad no hay token guardado: acá sí corresponde el login.
    const mensaje = "Tenés que iniciar sesión para ver esta pantalla.";
    irALogin(mensaje);
    return { manejado: true, mensaje };
  }

  return { manejado: false, mensaje: null };
};

// Sin sesión guardada no vale la pena ni salir a la red.
export const irALoginSinSesion = () => {
  const mensaje = "Tenés que iniciar sesión para ver esta pantalla.";
  irALogin(mensaje);
  return mensaje;
};
