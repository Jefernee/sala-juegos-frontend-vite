import { useState } from "react";
import axios from "axios";
import "../styles/Login.css";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    console.log("🌐 ========================================");
    console.log("🌐 INICIANDO LOGIN DESDE FRONTEND");
    console.log("🌐 Timestamp:", new Date().toISOString());
    console.log("API:", import.meta.env.VITE_API_URL);
    const inicioFrontend = Date.now();
    setError("");
    setLoading(true);
    console.log(import.meta.env.VITE_API_URL); // para verificar que la variable está cargada

    try {
      // Llamada al backend usando la URL de la variable de entorno
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/auth/login`,
        {
          email,
          password,
        },
      );
      const tiempoTotal = Date.now() - inicioFrontend;
      console.log("✅ ========================================");
      console.log(`✅ LOGIN COMPLETADO`);
      console.log(
        `⏱️ TIEMPO TOTAL (FRONTEND): ${tiempoTotal}ms (${(tiempoTotal / 1000).toFixed(2)}s)`,
      );
      console.log("✅ ========================================");

      // Guardar token en localStorage
      localStorage.setItem("token", response.data.token);
      localStorage.setItem("user", JSON.stringify(response.data.user));

      // Redirigir al dashboard
      navigate("/dashboard/sales");
    } catch (err) {
      console.error("Error de login:", err);
      setError(err.response?.data?.message || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleLogin}>
        <h2>Iniciar Sesión</h2>
        <input
          type="email"
          placeholder="Correo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
        />
        <button type="submit" disabled={loading}>
          {loading ? (
            <div className="loading-button-content">
              <div className="button-spinner"></div>
              <span>Iniciando sesión...</span>
            </div>
          ) : (
            "🔐 Ingresar"
          )}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
}
