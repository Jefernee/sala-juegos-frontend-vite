// src/components/AppRouter.jsx
import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

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

  // Si la app se abre desde la PWA y está en la raíz (/),
  // redirigimos directamente al login para evitar cargar Home2
  // y mejorar el tiempo de carga percibido
  if (fromPWA && location.pathname === '/') {
    console.log('📱 PWA detectada → redirigiendo a /login');
    navigate('/login', { replace: true });
  }

  // El efecto se ejecuta solo cuando cambia la ruta
  // o la función navigate (comportamiento esperado)
}, [location.pathname, navigate]);

  return <>{children}</>;
};

export default AppRouter;