import React from "react";
import { NavLink } from "react-router-dom";
import "../styles/NavBar2.css";

const Navbar = () => {
  const navClass = ({ isActive }) =>
    isActive ? "nav-link active" : "nav-link";

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark w-100 dashboard-navbar">
      <div className="container-fluid">
        <NavLink className="navbar-brand fw-bold" to="/">
          🎮 Sala de Juegos Ruiz
        </NavLink>

        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav ms-auto gap-2">
            <li className="nav-item">
              <NavLink to="/dashboard/administracion" className={navClass}>
                🏦 Administración
              </NavLink>
            </li>
            
            <li className="nav-item">
              <NavLink to="/dashboard/plays" className={navClass}>
                🎮 Control de Plays
              </NavLink>
            </li>

            <li className="nav-item">
              <NavLink to="/dashboard/pedidos" className={navClass}>
                📦 Pedidos
              </NavLink>
            </li>

            <li className="nav-item">
              <NavLink to="/dashboard/reportes" className={navClass}>
                📈 Reportes
              </NavLink>
            </li>

            <li className="nav-item">
              <NavLink to="/dashboard/sales" className={navClass}>
                💰 Ventas
              </NavLink>
            </li>

            <li className="nav-item">
              <NavLink to="/dashboard/manage-products" className={navClass}>
                ⚙️ Gestionar Productos
              </NavLink>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
