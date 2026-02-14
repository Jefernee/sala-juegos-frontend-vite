// src/components/LogoutButton.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';

const LogoutButton = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    // 1. Cerrar sesión (limpia localStorage/sessionStorage)
    localStorage.clear();
    sessionStorage.clear();
    
    // 2. Redirigir al inicio
    navigate('/');
    
    // 3. Intentar cerrar ventana SOLO si fue abierta por script
    // Esto evita el warning en consola
    if (window.opener) {
      setTimeout(() => {
        window.close();
      }, 500);
    }
  };

  return (
    <li className="nav-item">
      <button 
        className="nav-link btn-logout"
        onClick={handleLogout}
      >
        Salir
      </button>
    </li>
  );
};

export default LogoutButton;