import React, { useState } from "react";
import { useLocation, Link } from "react-router-dom";
import emailjs from "@emailjs/browser";
import "bootstrap/dist/css/bootstrap.min.css";
import "../styles/Inscripcion.css";

function Inscripcion() {
  const location = useLocation();
  const torneo = location.state?.torneo || "Torneo no especificado";

  const [mensaje, setMensaje] = useState("");
  const [tipoMensaje, setTipoMensaje] = useState(""); // success | error
  const [enviando, setEnviando] = useState(false);

  const handleFormSubmit = (event) => {
    event.preventDefault();
    setEnviando(true);
    setMensaje("");

    emailjs
      .sendForm(
        "service_836qmbb",
        "template_jzeg7u4",
        event.target,
        "kmFrqkvGQkrmmtRvU"
      )
      .then(
        () => {
          setTipoMensaje("success");
          setMensaje(
            "¡Inscripción realizada con éxito! Te contactaremos pronto."
          );
          event.target.reset();
          setEnviando(false);
        },
        () => {
          setTipoMensaje("error");
          setMensaje(
            "No se pudo enviar la inscripción. Intenta nuevamente más tarde."
          );
          setEnviando(false);
        }
      );
  };

  return (
    <div className="inscripcion-container">
      <div className="inscripcion-card">
        <h2 className="text-center mb-3">Inscripción al Torneo</h2>

        <p className="text-center torneo-nombre">
          <strong>{torneo}</strong>
        </p>

        {mensaje && (
          <div className={`mensaje ${tipoMensaje}`}>{mensaje}</div>
        )}

        <form onSubmit={handleFormSubmit}>
          <div className="mb-3">
            <label className="form-label">Nombre</label>
            <input
              type="text"
              name="name"
              className="form-control"
              required
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Correo Electrónico</label>
            <input
              type="email"
              name="email"
              className="form-control"
              required
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Torneo</label>
            <input
              type="text"
              name="tournament"
              className="form-control"
              value={torneo}
              readOnly
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary w-100"
            disabled={enviando}
          >
            {enviando ? "Enviando..." : "Enviar Inscripción"}
          </button>
        </form>

        <div className="text-center mt-3">
          <Link to="/" className="btn btn-link">
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Inscripcion;
