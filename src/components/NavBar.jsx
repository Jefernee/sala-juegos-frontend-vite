// src/components/NavBar.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import LogoutButton from './LogoutButton';
import '../styles/NavVar.css';

const NavBar = () => {
  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark w-100">
      <div className="container-fluid">
        <Link className="navbar-brand fw-bold" to="/">
          🎮 Sala de Juegos Ruiz
        </Link>
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
              <Link className="nav-link" to="/login">
                Login
              </Link>
            </li>
            <LogoutButton />
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default NavBar;