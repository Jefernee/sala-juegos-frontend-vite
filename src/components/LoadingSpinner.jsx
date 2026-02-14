// src/components/LoadingSpinner.jsx
import React from "react";

const LoadingSpinner = ({ minHeight = "400px", text = "Cargando..." }) => {
  return (
    <div 
      className="d-flex flex-column justify-content-center align-items-center" 
      style={{ minHeight }}
    >
      <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
        <span className="visually-hidden">{text}</span>
      </div>
      <p className="text-muted">{text}</p>
    </div>
  );
};

export default LoadingSpinner;