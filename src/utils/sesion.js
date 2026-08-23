// src/utils/sesion.js
// Reacción centralizada a los 401/403 del backend.
//
// La app le habla al servidor por dos caminos: axios (src/utils/api.js) y fetch
// (src/utils/authFetch.js). Antes cada uno reaccionaba distinto — axios manejaba
// el 403 de rol pero ignoraba los 401, así que una sesión vencida dejaba la
// pantalla con un error genérico en vez de mandar al login. Esta es la única
// implementación; los dos caminos la usan.

const RUTA_LOGIN = "/login";
const RUTA_VENTAS = "/dashboard/sales";

// Códigos que manda el middleware de autenticación del backend.
// No llegó el header (o llegó mal armado): no hay sesión que cerrar.
export const CODIGOS_SIN_TOKEN = [
  "NO_TOKEN",
  "EMPTY_TOKEN",
  "INVALID_TOKEN_FORMAT",
];
// El token existe pero ya no sirve: hay que borrar la sesión guardada.
export const CODIGOS_SESION_VENCIDA = ["INVALID_TOKEN", "EXPIRED_TOKEN"];
// El dueño cortó las sesiones desde Administración. No es que el token venciera:
// se invalidó a propósito, y el aviso tiene que decir eso — si dijera "expiró",
// el vendedor pensaría que es una falla y volvería a entrar esperando lo mismo.
export const CODIGO_SESION_CERRADA = "SESION_CERRADA";
export const CODIGO_ROL = "ROL_NO_AUTORIZADO";

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
 * Solo actúa si el `code` es uno de los del middleware de autenticación. Un 401
 * sin `code` conocido se deja pasar tal cual — el caso típico es la contraseña
 * equivocada en el login, que debe mostrar su mensaje en la pantalla y no
 * disparar una redirección ni borrar nada.
 *
 * @returns {{ manejado: boolean, mensaje: string｜null }}
 */
export const manejarNoAutorizado = (status, data, url = "") => {
  const code = data?.code;

  if (status === 403 && code === CODIGO_ROL) {
    // Un vendedor entrando donde no le toca: aviso de una sola vez y a Ventas.
    const mensaje = "No tenés permiso para este módulo.";
    sessionStorage.setItem("accesoDenegado", mensaje);
    if (window.location.pathname !== RUTA_VENTAS) {
      window.location.replace(RUTA_VENTAS);
    }
    return { manejado: true, mensaje };
  }

  if (status === 401 && code === CODIGO_SESION_CERRADA) {
    const mensaje = "Se cerraron las sesiones. Iniciá sesión de nuevo.";
    localStorage.clear();
    irALogin(mensaje);
    return { manejado: true, mensaje };
  }

  if (status === 401 && CODIGOS_SESION_VENCIDA.includes(code)) {
    const mensaje = "Tu sesión expiró, volvé a entrar.";
    localStorage.clear();
    irALogin(mensaje);
    return { manejado: true, mensaje };
  }

  if (status === 401 && CODIGOS_SIN_TOKEN.includes(code)) {
    // Esto NO es una sesión vencida: es que la petición salió sin el header.
    // Como los dos clientes lo adjuntan siempre, ver este código significa que
    // alguna llamada se hizo por fuera. Se anota la URL para poder encontrarla,
    // en vez de que parezca que la app "se desloguea sola".
    console.error(
      `[sesion] ${code}: al backend no le llegó el token. Si hay sesión ` +
        `iniciada, esa llamada está hecha con fetch/axios a mano, por fuera ` +
        `de authFetch o del axios central. URL: ${url}`,
    );
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
