import React from "react";
import { NavLink } from "react-router-dom";
import { puedeVerModulo } from "../utils/auth";
import "../styles/NavBar2.css";

// Cada ítem del menú declara su `modulo`, que decide si el rol actual lo ve.
// El vendedor solo ve "sales" y "plays"; administrador y colaborador ven todo.
const ITEMS = [
  { to: "/dashboard/administracion", modulo: "administracion", label: "🏦 Administración" },
  { to: "/dashboard/plays", modulo: "plays", label: "🎮 Control de Plays" },
  { to: "/dashboard/pedidos", modulo: "pedidos", label: "📦 Pedidos" },
  { to: "/dashboard/reportes", modulo: "reportes", label: "📈 Reportes" },
  { to: "/dashboard/sales", modulo: "sales", label: "💰 Ventas" },
  { to: "/dashboard/manage-products", modulo: "manageProducts", label: "⚙️ Gestionar Productos" },
];

const Navbar = () => {
  const navClass = ({ isActive }) =>
    isActive ? "nav-link active" : "nav-link";

  const items = ITEMS.filter((item) => puedeVerModulo(item.modulo));

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
            {items.map((item) => (
              <li className="nav-item" key={item.to}>
                <NavLink to={item.to} className={navClass}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
