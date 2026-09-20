// Página pública (sin login) de un torneo: /torneos/:id
// Coincide con el urlPublica que arma el backend. Muestra el torneo y el
// formulario de inscripción. La inscripción se guarda con
// POST /api/torneos/:id/inscripciones.
//
// Es la pantalla a la que llega alguien desde un link compartido por
// WhatsApp, muchas veces sin haber visto la página antes. Por eso lleva la
// marca arriba y el afiche grande: lo primero es saber dónde está.
//
// Va envuelta en .sjr-tor y sus estilos (Torneo.css) están encapsulados bajo
// esa clase: Bootstrap se carga de forma global en main.jsx y sus reglas
// alcanzan a esta página.
import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { API_URL, formatFecha, formatCRC } from "../components/admin/adminUtils";
import "../styles/Torneo.css";

const FORM_VACIO = { nombre: "", telefono: "", correo: "", gamertag: "", nombreEquipo: "" };

const LOGO =
  "https://res.cloudinary.com/drjsg8j92/image/upload/c_scale,w_500,q_auto,f_auto/" +
  "v1737318752/Imagen_de_WhatsApp_2025-01-11_a_las_21.53.16_f15972d6_h3rx20.jpg";

const WHATSAPP = "https://wa.me/50671603115";

const formatCosto = (monto) => (Number(monto) > 0 ? formatCRC(monto) : "Gratis");

// Los campos que no son obligatorios llevan su aclaración en la etiqueta: sin
// eso, un formulario de cinco casillas parece cinco requisitos y la gente lo
// abandona. El único que hace falta de verdad es el nombre.
const CAMPOS = [
  { id: "nombre", etiqueta: "Nombre", tipo: "text", obligatorio: true, ayuda: "Como te conocen en la sala" },
  { id: "telefono", etiqueta: "Teléfono", tipo: "tel", ayuda: "Para avisarte del horario" },
  { id: "correo", etiqueta: "Correo electrónico", tipo: "email" },
  { id: "gamertag", etiqueta: "Gamertag", tipo: "text", ayuda: "Tu nombre dentro del juego" },
  { id: "nombreEquipo", etiqueta: "Nombre del equipo", tipo: "text", ayuda: "Si venís en equipo" },
];

const TorneoPublicDetalle = () => {
  const { id } = useParams();
  const [torneo, setTorneo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [noEncontrado, setNoEncontrado] = useState(false);

  const [form, setForm] = useState(FORM_VACIO);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null); // { tipo: "success"|"error", mensaje }
  const [inscrito, setInscrito] = useState(false);

  const fetchTorneo = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/torneos/public/${id}`);
      setTorneo(res.data?.data || null);
      setNoEncontrado(!res.data?.data);
    } catch {
      setNoEncontrado(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    document.title = "Torneo - Sala de Juegos Ruiz";
    fetchTorneo();
  }, [fetchTorneo]);

  // Título de la pestaña según el torneo (los meta OG para compartir los pone
  // la Edge Function de Netlify; esto es solo para el navegador).
  useEffect(() => {
    if (torneo?.nombre) document.title = `${torneo.nombre} — Torneo · Sala de Juegos Ruiz`;
  }, [torneo]);

  const setField = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const abierto = torneo?.estado === "abierto";
  const lleno = torneo?.cupoDisponible === 0;
  const puedeInscribir = abierto && !lleno;

  // Cuenta regresiva: convierte "hay un torneo" en "faltan 84 días", que es lo
  // que hace que alguien se anote hoy y no lo deje para después.
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    if (!torneo?.fecha) return undefined;
    const reloj = window.setInterval(() => setAhora(Date.now()), 1000);
    return () => window.clearInterval(reloj);
  }, [torneo?.fecha]);

  const cuentaAtras = () => {
    if (!torneo?.fecha) return null;
    const falta = new Date(torneo.fecha).getTime() - ahora;
    if (falta <= 0) return null;
    const s = Math.floor(falta / 1000);
    return [
      [Math.floor(s / 86400), "días"],
      [Math.floor(s / 3600) % 24, "horas"],
      [Math.floor(s / 60) % 60, "min"],
      [s % 60, "seg"],
    ];
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (enviando) return;
    if (!form.nombre.trim()) {
      setResultado({ tipo: "error", mensaje: "Tu nombre es obligatorio para inscribirte." });
      return;
    }
    setEnviando(true);
    setResultado(null);
    try {
      const payload = {
        nombre: form.nombre.trim(),
        ...(form.telefono.trim() && { telefono: form.telefono.trim() }),
        ...(form.correo.trim() && { correo: form.correo.trim() }),
        ...(form.gamertag.trim() && { gamertag: form.gamertag.trim() }),
        ...(form.nombreEquipo.trim() && { nombreEquipo: form.nombreEquipo.trim() }),
      };
      const res = await axios.post(`${API_URL}/api/torneos/${id}/inscripciones`, payload);
      setResultado({ tipo: "success", mensaje: res.data?.message || "Inscripción registrada." });
      setForm(FORM_VACIO);
      setInscrito(true);
      fetchTorneo(); // refresca cupo disponible
    } catch (err) {
      // El backend manda el message a mostrar (cerrado, lleno, etc.)
      setResultado({
        tipo: "error",
        mensaje: err?.response?.data?.message || "No se pudo registrar la inscripción. Intentá de nuevo.",
      });
      // Si cambió el estado (cerró o se llenó), refrescamos para reflejarlo.
      if (err?.response?.status === 400) fetchTorneo();
    } finally {
      setEnviando(false);
    }
  };

  const reloj = cuentaAtras();

  return (
    <div className="sjr-tor">
      <div className="aurora" aria-hidden="true">
        <span />
        <span />
      </div>

      <header className="barra">
        <div className="env barra__int">
          <Link className="marca" to="/">
            <img className="marca__logo" src={LOGO} alt="Sala de Juegos Ruiz" width="46" height="46" />
            <span className="marca__txt">
              Sala de Juegos Ruiz
              <small>Entretenimiento</small>
            </span>
          </Link>
          <Link className="boton boton--vidrio boton--chico" to="/torneos">
            🏆 Todos los torneos
          </Link>
        </div>
      </header>

      <main className="env">
        {loading ? (
          <div className="centrado">Cargando el torneo…</div>
        ) : noEncontrado ? (
          <div className="centrado">
            <b>No encontramos ese torneo</b>
            Puede que el link esté incompleto o que el torneo ya no exista.
            <div style={{ marginTop: 20 }}>
              <Link className="boton boton--vivo" to="/torneos">
                Ver todos los torneos
              </Link>
            </div>
          </div>
        ) : (
          <div className="columnas">
            {/* ── El torneo ── */}
            <div className="caja">
              {torneo.imagenUrl ? (
                /* El afiche va ENTERO. Contenido sobre una copia de sí mismo
                   desenfocada: con recorte le cortaba el título, y sin el
                   relleno quedaban dos franjas muertas a los lados. */
                <div className="afiche">
                  <img className="afiche__fondo" src={torneo.imagenUrl} alt="" aria-hidden="true" />
                  <img className="afiche__foto" src={torneo.imagenUrl} alt={`Afiche de ${torneo.nombre}`} />
                </div>
              ) : (
                <div className="afiche">
                  <div className="afiche__vacio">🏆</div>
                </div>
              )}

              <div className="caja__cuerpo">
                <span className={`estado${abierto ? "" : " estado--cerrado"}`}>
                  {abierto ? "● Inscripción abierta" : "Inscripciones cerradas"}
                </span>
                <h1>{torneo.nombre}</h1>
                {torneo.descripcion && <p className="desc">{torneo.descripcion}</p>}

                <div className="pastillas">
                  <span className="pastilla">📅 <b>{formatFecha(torneo.fecha)}</b></span>
                  <span className="pastilla">🎟️ <b>{formatCosto(torneo.costoInscripcion)}</b></span>
                  <span className="pastilla">
                    👥{" "}
                    {torneo.cupoMaximo == null ? (
                      <b>Cupos sin límite</b>
                    ) : (
                      <>
                        <b>{torneo.cupoDisponible}</b> de {torneo.cupoMaximo} cupos
                      </>
                    )}
                  </span>
                </div>

                {reloj && (
                  <div className="reloj">
                    {reloj.map(([v, u]) => (
                      <div key={u}>
                        <b>{String(v).padStart(2, "0")}</b>
                        <small>{u}</small>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── La inscripción ── */}
            <div className="caja">
              <div className="caja__cuerpo">
                <h2>Inscribirse</h2>

                {resultado && (
                  <div className={`aviso ${resultado.tipo === "success" ? "aviso--bien" : "aviso--mal"}`}>
                    {resultado.mensaje}
                  </div>
                )}

                {!puedeInscribir ? (
                  <>
                    <div className="aviso aviso--ojo">
                      {!abierto
                        ? "Las inscripciones para este torneo están cerradas."
                        : "El torneo ya alcanzó su cupo máximo."}
                    </div>
                    {/* Que no quede en un callejón sin salida: si llegó tarde a
                        este, que sepa por dónde entrarle al siguiente. */}
                    <a
                      className="boton boton--vivo boton--bloque"
                      href={WHATSAPP}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      💬 Avisame del próximo
                    </a>
                  </>
                ) : inscrito ? (
                  <div className="listo">
                    <div className="listo__marca">✅</div>
                    <p>Tu inscripción quedó registrada. Te contactamos con los detalles.</p>
                    <button
                      type="button"
                      className="boton boton--vidrio"
                      onClick={() => {
                        setInscrito(false);
                        setResultado(null);
                      }}
                    >
                      Inscribir a otra persona
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} noValidate>
                    {CAMPOS.map((campo) => (
                      <div className="campo" key={campo.id}>
                        <label htmlFor={`t-${campo.id}`}>
                          {campo.etiqueta}
                          {campo.obligatorio ? " *" : ""}
                          {campo.ayuda && <span> · {campo.ayuda}</span>}
                        </label>
                        <input
                          id={`t-${campo.id}`}
                          type={campo.tipo}
                          value={form[campo.id]}
                          onChange={setField(campo.id)}
                          disabled={enviando}
                          required={campo.obligatorio}
                        />
                      </div>
                    ))}
                    <button type="submit" className="boton boton--vivo boton--bloque" disabled={enviando}>
                      {enviando ? "Enviando…" : "Enviar inscripción"}
                    </button>
                    <p className="nota">Solo el nombre es obligatorio. No se paga nada por acá.</p>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <footer>
        <div className="env">
          <small style={{ color: "var(--cian)", fontWeight: 600 }}>
            Un lugar seguro y confiable para divertirse sanamente
          </small>
          <small style={{ marginTop: 6 }}>© {new Date().getFullYear()} Sala de Juegos Ruiz</small>
          <small style={{ marginTop: 2, opacity: 0.3, fontSize: ".7rem", letterSpacing: ".04em" }}>
            Hecho por Jefernee Ruiz
          </small>
        </div>
      </footer>
    </div>
  );
};

export default TorneoPublicDetalle;
