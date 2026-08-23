// src/components/AppRouter.jsx
import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getToken } from '../utils/auth';

const AppRouter = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
  // Leer los parámetros de la URL (ej: ?source=pwa)
  const params = new URLSearchParams(window.location.search);

  // Verificar si la app fue abierta desde la PWA instalada
  // Si viene desde la app, esperamos source=pwa
  const fromPWA = params.get('source') === 'pwa';

  // ===== Logs de debugging =====
  // Ayudan a verificar desde dónde se abrió la app y en qué ruta
  console.log('--- AppRouter ---');
  console.log('Ruta actual:', location.pathname);
  console.log('Query string:', window.location.search);
  console.log('¿Abierto desde PWA?:', fromPWA);
  console.log('-----------------');

  // Si la app se abre desde la PWA y está en la raíz (/), no tiene sentido
  // cargar Home2: se salta a donde el usuario iba a ir igual.
  //
  // Con sesión guardada eso es el panel, no el login. El manifiesto ya arranca
  // en /dashboard/sales, pero las apps YA INSTALADAS conservan el start_url
  // viejo (/?source=pwa) hasta que se reinstalen, así que este atajo es lo que
  // hace que abran adentro mientras tanto — sin pasar por el formulario.
  if (fromPWA && location.pathname === '/') {
    const destino = getToken() ? '/dashboard/sales' : '/login';
    console.log(`📱 PWA detectada → redirigiendo a ${destino}`);
    navigate(destino, { replace: true });
  }

  // El efecto se ejecuta solo cuando cambia la ruta
  // o la función navigate (comportamiento esperado)
}, [location.pathname, navigate]);

  return <>{children}</>;
};

export default AppRouter;