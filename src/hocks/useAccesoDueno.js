// src/hocks/useAccesoDueno.js
// Los datos del panel del dueño y el corte de sesiones.
//
// Vive aparte de los componentes por el refresco en caliente de Vite: un archivo
// que exporta componentes no puede exportar también funciones.
//
// Lo importante de acá está en `cerrarSesiones`: al cortar, el backend devuelve
// un token NUEVO y hay que guardarlo antes que nada. El corte invalida todos los
// tokens firmados antes de ese instante, incluido el del dueño que apretó el
// botón; sin guardar el nuevo, su siguiente petición responde 401 y se cierra su
// propia sesión. Se vería como un bug, y sería nuestro.
import { useState, useCallback, useEffect, useRef } from "react";
import { API_URL, getAxios } from "../components/admin/adminUtils";

/**
 * Trae el panel del dueño y expone el corte de sesiones.
 *
 * Quién es el dueño lo dice el backend, no el frontend: si responde 200 hay
 * panel, si responde 403 SOLO_DUENO no lo hay. Antes esto se deducía de que
 * llegaran las contraseñas visibles en /api/auth/users — una inferencia que
 * podía quedar desfasada del permiso real. Y ese 403 NO es un error: es la
 * respuesta correcta para un administrador que no es el dueño, así que no se
 * muestra ningún aviso.
 */
export function useAccesoDueno({ getAuthHeaders, mostrarNotif, manejarError }) {
  const [acceso, setAcceso] = useState(null);
  // Por qué no se pudo traer. Si el dueño no ve el panel tiene que saber la
  // razón: esconderlo en silencio hace que un backend sin desplegar se vea
  // exactamente igual que un bug del frontend.
  const [falla, setFalla] = useState(null);
  const [cerrando, setCerrando] = useState(null); // "todos" | usuarioId | null
  const montado = useRef(true);

  // El `true` de la ida es imprescindible, no adorno: la app corre dentro de
  // StrictMode, que monta, desmonta y vuelve a montar. Sin volver a marcarlo, la
  // limpieza del primer montaje deja `montado` en false para siempre y ningún
  // setState se ejecuta — el panel nunca aparece.
  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; };
  }, []);

  const cargar = useCallback(async () => {
    try {
      const axios = await getAxios();
      const res = await axios.get(`${API_URL}/api/auth/acceso-dueno`, getAuthHeaders());
      if (montado.current) {
        setAcceso(res.data || null);
        setFalla(null);
      }
    } catch (err) {
      // Sin este panel Administración funciona igual: nunca un cartel rojo a
      // media pantalla. Pero sí una línea que explique, porque el dueño abre
      // Usuarios esperando verlo.
      const estado = err?.response?.status;
      const code = err?.response?.data?.code;

      // 403 SOLO_DUENO: este administrador no es el dueño. Es la respuesta
      // esperada, no una falla: el bloque simplemente no existe para él.
      if (estado === 403) {
        if (montado.current) { setAcceso(null); setFalla(null); }
        return;
      }

      console.warn("No se pudo cargar el acceso del dueño:", code || estado || err?.message);
      if (montado.current) {
        setAcceso(null);
        setFalla(
          estado === 404
            ? "El servidor todavía no tiene este módulo: /api/auth/acceso-dueno responde 404."
            : `No se pudo cargar (${estado || err?.message || "sin respuesta"}).`,
        );
      }
    }
  }, [getAuthHeaders]);

  useEffect(() => { cargar(); }, [cargar]);

  /**
   * Corta sesiones. Sin `usuarioId` corta las de todos.
   * @returns {boolean} si salió bien
   */
  const cerrarSesiones = useCallback(async (usuarioId) => {
    setCerrando(usuarioId || "todos");
    try {
      const axios = await getAxios();
      const cuerpo = usuarioId ? { usuarioId } : {};
      const res = await axios.post(
        `${API_URL}/api/auth/cerrar-sesiones`,
        cuerpo,
        getAuthHeaders(),
      );

      // PRIMERO el token nuevo, antes de cualquier otra cosa. El corte acaba de
      // invalidar el que teníamos guardado.
      if (res.data?.token) localStorage.setItem("token", res.data.token);

      mostrarNotif(res.data?.mensaje || "Sesiones cerradas");
      await cargar();
      return true;
    } catch (err) {
      manejarError(err);
      return false;
    } finally {
      if (montado.current) setCerrando(null);
    }
  }, [getAuthHeaders, mostrarNotif, manejarError, cargar]);

  return { acceso, falla, cerrando, cerrarSesiones };
}

