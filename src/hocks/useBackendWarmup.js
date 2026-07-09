// src/hooks/useBackendWarmup.js
// Hook opcional para despertar el backend desde un componente.
// El warmup principal ya se dispara en main.jsx; este hook queda disponible
// por si alguna pantalla necesita saber cuándo el backend está listo.
import { useEffect, useState } from "react";
import { warmupBackend } from "../utils/api";

export const useBackendWarmup = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let activo = true;
    warmupBackend().finally(() => {
      if (activo) setIsReady(true);
    });
    return () => {
      activo = false;
    };
  }, []);

  return { isReady };
};
