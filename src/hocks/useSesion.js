// src/hocks/useSesion.js
// El estado de la sesión, compartido por toda la app.
//
// Vive aparte del componente que lo provee por el refresco en caliente de Vite:
// un archivo que exporta componentes no puede exportar también funciones.
import { createContext, useContext } from "react";

export const ESTADO = {
  // Hay token guardado y se está preguntando al backend si todavía sirve.
  VERIFICANDO: "verificando",
  // El backend dijo que sirve (o no se pudo preguntar y se decidió seguir).
  VALIDA: "valida",
  // No hay token, o el backend dijo que ya no vale.
  SIN_SESION: "sin-sesion",
};

// Por defecto se asume válida: así, si algún día un componente queda fuera del
// proveedor, no se convierte en una pantalla de login inesperada.
export const SesionContexto = createContext({ estado: ESTADO.VALIDA });

export const useSesion = () => useContext(SesionContexto);
