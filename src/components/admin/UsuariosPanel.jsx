// Panel de gestión de usuarios y roles. Visible SOLO para el administrador
// (el dueño). Permite listar usuarios, cambiar el rol entre colaborador y
// vendedor, y crear nuevos usuarios (colaborador o vendedor).
//
// Reglas del backend que respetamos en la UI:
//  - No se puede asignar "administrador" ni cambiarle el rol al dueño → esas
//    filas se muestran sin editar (chip "Dueño").
//  - Al crear con el token del admin, el `rol` del body sí se respeta.
import { useState, useEffect, useCallback, useRef } from "react";
import { API_URL, getAxios, formatFecha } from "./adminUtils";
import { ModalOverlay, EstadoVacio, ErrorRecarga, Cargando } from "./Comunes";

const ROL_INFO = {
  administrador: { label: "👑 Administrador", clase: "azul" },
  colaborador: { label: "🤝 Colaborador", clase: "verde" },
  vendedor: { label: "🧾 Vendedor", clase: "amarillo" },
};

// Roles que el administrador puede asignar (nunca "administrador").
const ROLES_ASIGNABLES = [
  { valor: "colaborador", label: "🤝 Colaborador — ve todos los módulos" },
  { valor: "vendedor", label: "🧾 Vendedor — solo Ventas y Control de Plays" },
];

const getFormVacio = () => ({ nombre: "", email: "", password: "", rol: "colaborador" });

const UsuariosPanel = ({ getAuthHeaders, mostrarNotif, manejarError }) => {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);
  const [cambiandoId, setCambiandoId] = useState(null);

  const [modalCrear, setModalCrear] = useState(false);
  const [form, setForm] = useState(getFormVacio);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  // Contraseñas: cuáles están reveladas + modal de reasignación.
  const [revelados, setRevelados] = useState(() => new Set());
  const [modalPassword, setModalPassword] = useState(null); // usuario | null
  const [nuevaPassword, setNuevaPassword] = useState("");
  const [errorPassword, setErrorPassword] = useState("");
  const [guardandoPassword, setGuardandoPassword] = useState(false);

  const montado = useRef(true);

  useEffect(() => () => { montado.current = false; }, []);

  const fetchUsuarios = useCallback(async () => {
    setLoading(true);
    setErrorCarga(false);
    try {
      const axios = await getAxios();
      const res = await axios.get(`${API_URL}/api/auth/users`, getAuthHeaders());
      setUsuarios(Array.isArray(res.data?.users) ? res.data.users : []);
    } catch (err) {
      setErrorCarga(true);
      manejarError(err);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, manejarError]);

  useEffect(() => { fetchUsuarios(); }, [fetchUsuarios]);

  const cambiarRol = async (usuario, nuevoRol) => {
    if (nuevoRol === usuario.rol || cambiandoId) return;
    setCambiandoId(usuario._id);
    try {
      const axios = await getAxios();
      const res = await axios.patch(
        `${API_URL}/api/auth/users/${usuario._id}/rol`,
        { rol: nuevoRol },
        getAuthHeaders(),
      );
      const rolFinal = res.data?.user?.rol || nuevoRol;
      setUsuarios((prev) => prev.map((u) => (u._id === usuario._id ? { ...u, rol: rolFinal } : u)));
      mostrarNotif(res.data?.message || "Rol actualizado");
    } catch (err) {
      manejarError(err);
    } finally {
      setCambiandoId(null);
    }
  };

  const setField = (field) => (e) => {
    const valor = e.target.value;
    setForm((f) => ({ ...f, [field]: valor }));
    setErrores((er) => ({ ...er, [field]: "" }));
  };

  const validar = () => {
    const e = {};
    if (!form.nombre.trim()) e.nombre = "El nombre es obligatorio";
    if (!form.email.trim()) e.email = "El correo es obligatorio";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = "Correo no válido";
    if (!form.password || form.password.length < 6) e.password = "Mínimo 6 caracteres";
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const toggleReveal = (id) =>
    setRevelados((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const copiarPassword = async (pw) => {
    if (!pw) return;
    try {
      await navigator.clipboard.writeText(pw);
      mostrarNotif("Contraseña copiada");
    } catch {
      window.prompt("Copiá la contraseña:", pw);
    }
  };

  const abrirReasignar = (u) => {
    setModalPassword(u);
    setNuevaPassword("");
    setErrorPassword("");
  };

  const reasignarPassword = async (ev) => {
    ev.preventDefault();
    if (guardandoPassword) return;
    if (!nuevaPassword || nuevaPassword.length < 6) {
      setErrorPassword("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    setGuardandoPassword(true);
    try {
      const axios = await getAxios();
      const res = await axios.patch(
        `${API_URL}/api/auth/users/${modalPassword._id}/password`,
        { password: nuevaPassword },
        getAuthHeaders(),
      );
      // Reflejamos la nueva clave en la lista (el GET la mostraría igual).
      const nueva = nuevaPassword;
      setUsuarios((prev) => prev.map((u) => (u._id === modalPassword._id ? { ...u, password: nueva } : u)));
      mostrarNotif(res.data?.message || "Contraseña actualizada");
      if (montado.current) setModalPassword(null);
    } catch (err) {
      manejarError(err);
    } finally {
      if (montado.current) setGuardandoPassword(false);
    }
  };

  const abrirCrear = () => {
    setForm(getFormVacio());
    setErrores({});
    setModalCrear(true);
  };

  const crearUsuario = async (ev) => {
    ev.preventDefault();
    if (!validar() || guardando) return;
    setGuardando(true);
    try {
      const axios = await getAxios();
      // Se manda el token del admin para que el backend respete el `rol`.
      const res = await axios.post(
        `${API_URL}/api/auth/register`,
        {
          nombre: form.nombre.trim(),
          email: form.email.trim(),
          password: form.password,
          rol: form.rol,
        },
        getAuthHeaders(),
      );
      mostrarNotif(res.data?.message || "Usuario creado");
      if (montado.current) setModalCrear(false);
      fetchUsuarios();
    } catch (err) {
      manejarError(err);
    } finally {
      if (montado.current) setGuardando(false);
    }
  };

  return (
    <div className="fade-in">
      <div className="aviso-mes mb-4">
        👥 Gestión de usuarios. Solo vos (administrador) ves esta sección. Podés
        crear personal, cambiar entre <strong>Colaborador</strong> (ve todo) y
        <strong> Vendedor</strong> (solo Ventas y Control de Plays), y ver o
        reasignar la <strong>contraseña</strong> de cada quien.
      </div>

      <div className="d-flex justify-content-end mb-3">
        <button className="btn admin-btn admin-btn--orange fw-bold" onClick={abrirCrear}>
          ＋ Crear usuario
        </button>
      </div>

      {errorCarga ? (
        <ErrorRecarga onReintentar={fetchUsuarios} />
      ) : loading ? (
        <Cargando variante="orange" />
      ) : usuarios.length === 0 ? (
        <EstadoVacio icono="👥" mensaje="No hay usuarios registrados todavía" />
      ) : (
        <div className="row g-3">
          {usuarios.map((u) => {
            const info = ROL_INFO[u.rol] || { label: u.rol, clase: "gris" };
            const esDueno = u.rol === "administrador";
            return (
              <div key={u._id} className="col-12 col-lg-6">
                <div className="activo-card w-100">
                  <div className="activo-card__body">
                    <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
                      <h6 className="activo-card__nombre mb-0">{u.nombre || "—"}</h6>
                      <span className={`estado-badge estado-badge--${info.clase}`}>{info.label}</span>
                    </div>
                    <div className="admin-hint mt-1">✉️ {u.email}</div>
                    {u.createdAt && (
                      <div className="admin-hint">📅 Desde {formatFecha(u.createdAt)}</div>
                    )}

                    {/* Contraseña (oculta por defecto) */}
                    <div className="mt-2">
                      <label className="admin-label">Contraseña</label>
                      {u.password ? (
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                          <code style={{ fontSize: "0.95rem", wordBreak: "break-all" }}>
                            {revelados.has(u._id) ? u.password : "••••••••"}
                          </code>
                          <button
                            type="button"
                            className="accion-btn accion-btn--texto"
                            onClick={() => toggleReveal(u._id)}
                          >
                            {revelados.has(u._id) ? "🙈 Ocultar" : "👁️ Mostrar"}
                          </button>
                          <button
                            type="button"
                            className="accion-btn accion-btn--texto"
                            onClick={() => copiarPassword(u.password)}
                          >
                            📋 Copiar
                          </button>
                        </div>
                      ) : (
                        <div className="admin-hint">— (sin registrar)</div>
                      )}
                      <button
                        type="button"
                        className="accion-btn accion-btn--texto accion-btn--naranja mt-1"
                        onClick={() => abrirReasignar(u)}
                      >
                        🔑 Reasignar contraseña
                      </button>
                    </div>

                    <div className="mt-3">
                      {esDueno ? (
                        <span className="activo-card__tipo-chip">✋ Cuenta del dueño · no editable</span>
                      ) : (
                        <>
                          <label className="admin-label">Rol</label>
                          <div className="d-flex align-items-center gap-2">
                            <select
                              className="form-select admin-select"
                              value={u.rol}
                              disabled={cambiandoId === u._id}
                              onChange={(e) => cambiarRol(u, e.target.value)}
                            >
                              {ROLES_ASIGNABLES.map((r) => (
                                <option key={r.valor} value={r.valor}>{r.label}</option>
                              ))}
                            </select>
                            {cambiandoId === u._id && <span className="btn-spinner" />}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalCrear && (
        <ModalOverlay onCerrar={() => !guardando && setModalCrear(false)} bloqueado={guardando}>
          <div className="admin-modal__header admin-panel__header--orange">
            <span>👤</span>
            Crear usuario
            <button
              className="admin-modal__cerrar"
              onClick={() => setModalCrear(false)}
              disabled={guardando}
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
          <form className="admin-modal__body" onSubmit={crearUsuario} noValidate>
            <div className="row g-3">
              <div className="col-12">
                <label className="admin-label">Nombre *</label>
                <input
                  type="text"
                  className={`form-control admin-input ${errores.nombre ? "admin-input--error" : ""}`}
                  placeholder="Nombre del usuario"
                  value={form.nombre}
                  disabled={guardando}
                  onChange={setField("nombre")}
                />
                {errores.nombre && <div className="campo-error">{errores.nombre}</div>}
              </div>

              <div className="col-12">
                <label className="admin-label">Correo *</label>
                <input
                  type="email"
                  className={`form-control admin-input ${errores.email ? "admin-input--error" : ""}`}
                  placeholder="correo@ejemplo.com"
                  value={form.email}
                  disabled={guardando}
                  onChange={setField("email")}
                />
                {errores.email && <div className="campo-error">{errores.email}</div>}
              </div>

              <div className="col-12">
                <label className="admin-label">Contraseña *</label>
                <input
                  type="password"
                  className={`form-control admin-input ${errores.password ? "admin-input--error" : ""}`}
                  placeholder="Mínimo 6 caracteres"
                  value={form.password}
                  disabled={guardando}
                  onChange={setField("password")}
                />
                {errores.password && <div className="campo-error">{errores.password}</div>}
              </div>

              <div className="col-12">
                <label className="admin-label">Rol</label>
                <select
                  className="form-select admin-select"
                  value={form.rol}
                  disabled={guardando}
                  onChange={setField("rol")}
                >
                  {ROLES_ASIGNABLES.map((r) => (
                    <option key={r.valor} value={r.valor}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="d-flex gap-2 justify-content-end align-items-center mt-4 flex-wrap">
              <button
                type="button"
                className="admin-btn-ghost"
                onClick={() => setModalCrear(false)}
                disabled={guardando}
              >
                Cancelar
              </button>
              <button type="submit" className="btn admin-btn admin-btn--orange px-4 fw-bold" disabled={guardando}>
                {guardando && <span className="btn-spinner" />}
                {guardando ? "Creando..." : "Crear usuario"}
              </button>
            </div>
          </form>
        </ModalOverlay>
      )}

      {modalPassword && (
        <ModalOverlay onCerrar={() => !guardandoPassword && setModalPassword(null)} bloqueado={guardandoPassword}>
          <div className="admin-modal__header admin-panel__header--orange">
            <span>🔑</span>
            Reasignar contraseña
            <button
              className="admin-modal__cerrar"
              onClick={() => setModalPassword(null)}
              disabled={guardandoPassword}
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
          <form className="admin-modal__body" onSubmit={reasignarPassword} noValidate>
            <p className="mb-3">
              Nueva contraseña para <strong>{modalPassword.nombre || modalPassword.email}</strong>.
              Cambia su acceso y la copia visible al mismo tiempo.
            </p>
            <label className="admin-label">Nueva contraseña *</label>
            <input
              type="text"
              className={`form-control admin-input ${errorPassword ? "admin-input--error" : ""}`}
              placeholder="Mínimo 6 caracteres"
              value={nuevaPassword}
              disabled={guardandoPassword}
              onChange={(e) => { setNuevaPassword(e.target.value); setErrorPassword(""); }}
              autoFocus
            />
            {errorPassword && <div className="campo-error">{errorPassword}</div>}
            <div className="d-flex gap-2 justify-content-end align-items-center mt-4 flex-wrap">
              <button
                type="button"
                className="admin-btn-ghost"
                onClick={() => setModalPassword(null)}
                disabled={guardandoPassword}
              >
                Cancelar
              </button>
              <button type="submit" className="btn admin-btn admin-btn--orange px-4 fw-bold" disabled={guardandoPassword}>
                {guardandoPassword && <span className="btn-spinner" />}
                {guardandoPassword ? "Guardando..." : "Guardar contraseña"}
              </button>
            </div>
          </form>
        </ModalOverlay>
      )}
    </div>
  );
};

export default UsuariosPanel;
