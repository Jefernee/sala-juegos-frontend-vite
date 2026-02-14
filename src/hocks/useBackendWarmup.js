// src/hooks/useBackendWarmup.js
import { useEffect, useState } from "react";
import axios from "axios";

export const useBackendWarmup = () => {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const wakeUpBackend = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        await axios.get(`${process.env.REACT_APP_API_URL}/api/health`, {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        setIsReady(true);
        console.log("✅ Backend listo");
      } catch (err) {
        setError(err);
        setIsReady(true); // Continuar de todos modos
        console.log("⚠️ Backend warming completado con advertencia");
      }
    };

    wakeUpBackend();
  }, []);

  return { isReady, error };
};