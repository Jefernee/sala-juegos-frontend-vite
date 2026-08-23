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
// authFetch, para que la sesión se comporte igual venga por donde venga:
//   401 SESION_CERRADA/INVALID/EXPIRED → cerrar sesión y al login
//   401 NO_TOKEN/EMPTY/FORMAT sin token guardado → al login
//   todo lo demás (incluido el 403 ROL_NO_AUTORIZADO) → error normal de la
//   pantalla, sin tocar la sesión.
// Cuando sesion.js sí se hizo cargo, el error queda marcado con `esSesion` para
// que las pantallas no pinten un banner encima de una navegación en curso. Se
// marca el error en vez de mirar el status: un 403 ahora se muestra, y las
// pantallas no tienen por qué saber cuál de los dos casos es.
axios.interceptors.response.use(null, (error) => {
  const status = error?.response?.status;
  if (status === 401 || status === 403) {
    const { manejado } = manejarNoAutorizado(
      status,
      error.response?.data,
      error.config?.url,
    );
    if (manejado) error.esSesion = true;
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
