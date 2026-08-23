// src/pages/Login.jsx
//
// El formulario de entrada — y la puerta de "ya estás adentro".
//
// Con sesión guardada esta pantalla no se dibuja: se va derecho al panel. Sin
// eso, quien tenía el token bueno igual veía el formulario, porque a la app se
// entra por la home pública (la PWA arranca ahí) y nadie miraba si ya había
// sesión. El token estaba, nadie lo usaba, y parecía que la sesión no duraba.
//
// No hay riesgo de rebote entre esta redirección y la guarda de rutas: si el
// token ya no sirve, el guard pregunta a /api/auth/verify, borra la sesión y
// recién ahí vuelve acá — y para entonces no hay token que redirija.
import { useState, useEffect } from "react";
import axios from "axios";
import "../styles/Login.css";
import { useNavigate, Navigate } from "react-router-dom";
import { getToken } from "../utils/auth";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [loading, setLoading] = useState(false);

  // Aviso de una sola vez que se dejó al cerrar la sesión ("El administrador
  // cerró las sesiones..."), para que sepa por qué volvió acá.
  useEffect(() => {
    const msg = sessionStorage.getItem("avisoSesion");
    if (msg) {
      setAviso(msg);
      sessionStorage.removeItem("avisoSesion");
    }
  }, []);

  // Después de los hooks (no pueden quedar detrás de un return) y antes de
  // pintar nada: con sesión guardada, acá no hay nada que hacer.
  if (getToken()) return <Navigate to="/dashboard/sales" replace />;

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
        {aviso && <p className="aviso-sesion">{aviso}</p>}
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
