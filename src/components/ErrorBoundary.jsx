// src/components/ErrorBoundary.jsx
// Captura errores de render. Su objetivo principal es el caso típico tras un
// nuevo deploy: los chunks JS viejos (con hash) ya no existen, el import()
// dinámico de una ruta lazy falla y —sin este boundary— la app se quedaba
// pegada en "Cargando..." o en blanco. Aquí recargamos la página una vez para
// traer los archivos nuevos.
import React from "react";

const ES_ERROR_DE_CHUNK = (msg) =>
  /dynamically imported module|Loading chunk|Failed to fetch|error loading/i.test(
    String(msg || ""),
  );

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error) {
    if (ES_ERROR_DE_CHUNK(error?.message)) {
      // Recargar como máximo una vez cada 10 s para evitar bucles de recarga
      // si el problema no fuera realmente un chunk desactualizado.
      const ultimo = Number(sessionStorage.getItem("chunkReloadTs") || 0);
      if (Date.now() - ultimo > 10000) {
        sessionStorage.setItem("chunkReloadTs", String(Date.now()));
        window.location.reload();
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "60vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: 24,
            textAlign: "center",
            fontFamily: '"Segoe UI", system-ui, sans-serif',
            color: "#334155",
          }}
        >
          <div style={{ fontSize: 48 }}>🎮</div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
            Ocurrió un problema al cargar esta sección
          </h2>
          <p style={{ margin: 0, color: "#64748b", maxWidth: 360 }}>
            Puede ser una actualización reciente del sistema. Recargá la página
            para continuar.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 4,
              padding: "10px 22px",
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
              color: "#fff",
              background: "linear-gradient(90deg, #1e3a8a, #1d4ed8)",
            }}
          >
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
