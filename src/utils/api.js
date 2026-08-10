// src/utils/api.js
// Configuración central de axios: timeout + reintento automático + warmup del backend.
// Se importa una sola vez en main.jsx. Como axios es un singleton de módulo,
// estos ajustes aplican también a los `await import("axios")` de cada página.
import axios from "axios";
import { manejarNoAutorizado } from "./sesion";

// Quitamos barras finales para no generar "//api/health" (que da 404).
const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

// ── Timeout global ───────────────────────────────────────────────────────────
// Evita que una petición al backend dormido (Koyeb) deje la pantalla "cargando"
// para siempre. Si se pasa de este tiempo, la petición falla y el catch de cada
// página muestra su mensaje de error en vez de quedarse colgada.
axios.defaults.timeout = 30000; // 30 s

// ── Reintento automático (1 vez) ─────────────────────────────────────────────
// El backend gratuito se duerme; el primer request suele fallar por timeout o
// red mientras "despierta". Reintentamos una sola vez de forma transparente.
axios.interceptors.response.use(null, async (error) => {
  const config = error?.config;
  const esTimeout = error?.code === "ECONNABORTED";
  const esRed     = error?.code === "ERR_NETWORK";
  const sinRespuesta = !error?.response && error?.code !== "ERR_CANCELED";

  if (config && !config.__reintentado && (esTimeout || esRed || sinRespuesta)) {
    config.__reintentado = true;
    return axios(config);
  }
  return Promise.reject(error);
});

// ── Sesión y permisos (401 / 403) ────────────────────────────────────────────
// Red de seguridad para todas las llamadas por axios (ventas, plays, productos,
// administración). Delega en src/utils/sesion.js, la misma lógica que usa
// authFetch, para que un token vencido se comporte igual venga por donde venga:
//   403 ROL_NO_AUTORIZADO         → de vuelta a Ventas
//   401 INVALID_TOKEN/EXPIRED     → cerrar sesión y al login
//   401 NO_TOKEN/EMPTY/FORMAT     → al login (y queda anotado en consola)
// Un 401 sin `code` conocido no se toca: es el caso de la contraseña equivocada
// en el login, que tiene que mostrar su mensaje en la pantalla.
axios.interceptors.response.use(null, (error) => {
  const status = error?.response?.status;
  if (status === 401 || status === 403) {
    manejarNoAutorizado(status, error.response?.data, error.config?.url);
  }
  return Promise.reject(error);
});

// ── Warmup: despierta el backend al abrir la app ─────────────────────────────
// Fire-and-forget. Hace ping a /api/health con varios intentos y timeout amplio
// (el cold start puede tardar). No bloquea el render.
export async function warmupBackend(intentos = 3) {
  if (!API_URL) return false;
  for (let i = 0; i < intentos; i++) {
    try {
      await axios.get(`${API_URL}/api/health`, {
        timeout: 60000,      // cold start puede tardar
        __reintentado: true, // el bucle ya maneja los reintentos
      });
      return true;
    } catch {
      // El backend aún puede estar despertando: seguimos intentando.
    }
  }
  return false;
}

export default axios;
