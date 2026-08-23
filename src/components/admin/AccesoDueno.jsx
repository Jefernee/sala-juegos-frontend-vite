// src/components/admin/AccesoDueno.jsx
//
// Lo que solo puede hacer el dueño: volver a exigir el login.
//
// El sistema ya no cierra la sesión de nadie —ni del dueño ni del personal—, así
// que nadie tiene que volver a entrar. Lo que es solo del dueño es lo contrario:
// obligar a una persona (o a todas) a iniciar sesión otra vez. Los nombres de
// las funciones siguen al endpoint (`cerrar-sesiones`); los textos de pantalla
// hablan de exigir el login, que es cómo lo piensa quien lo usa.
//
// Dos cosas que definen cómo está escrito esto:
//
// · Ni la lista de privilegios ni la explicación de cómo funciona la sesión
//   viven acá. Vienen del backend (`soloVos` y `comoFuncionaLaSesion`), que es
//   quien hace cumplir cada regla. Se recorre el arreglo y se pinta lo que
//   llegue: si mañana cambia una regla o se agrega un punto, esta pantalla lo
//   refleja sin que nadie la toque. Copiar esos textos al frontend garantizaría
//   que algún día digan una cosa y el sistema haga otra.
//
// · Al cortar sesiones el backend devuelve un token NUEVO, y hay que guardarlo
//   antes que nada. El corte invalida todos los tokens firmados antes de ese
//   instante, incluido el del dueño que apretó el botón: sin guardar el nuevo,
//   su siguiente petición responde 401 y se cierra su propia sesión. Se vería
//   como un bug, y sería nuestro.

import { useState } from "react";
import { formatFecha } from "./adminUtils";
import { ModalOverlay } from "./Comunes";

// Íconos por clave. Es lo único que el frontend decide sobre esta lista: los
// textos son del backend. Una clave que no conozcamos cae en el comodín, así
// que agregar privilegios allá no rompe nada acá.
const ICONO_PRIVILEGIO = {
  rol_protegido: "🛡️",
  passwords_visibles: "👁️",
  cerrar_sesiones: "🚪",
  crear_admin: "👑",
};

/** Un punto de cualquiera de las dos listas del backend: título y detalle. */
const Punto = ({ item, icono }) => (
  <li className="privilegio">
    <span className="privilegio__icono" aria-hidden="true">
      {icono}
    </span>
    <span>
      <strong>{item.titulo}</strong>
      {item.detalle && <span className="admin-hint d-block">{item.detalle}</span>}
    </span>
  </li>
);

/** Lista de puntos del backend, o nada si no llegó ninguno. */
const ListaDePuntos = ({ items, icono }) =>
  items.length === 0 ? null : (
    <ul className="privilegios">
      {items.map((item, i) => (
        <Punto key={item.clave || i} item={item} icono={icono(item)} />
      ))}
    </ul>
  );

/**
 * El bloque completo: privilegios del dueño, el botón para exigirle el login a
 * todo el mundo, y a quiénes les toca entrar de nuevo ahora mismo.
 */
export function BloqueAccesoDueno({ acceso, falla, cerrando, onCerrarTodas }) {
  const [confirmar, setConfirmar] = useState(false);

  // Sin datos pero con motivo: se dice el motivo. Un bloque que desaparece sin
  // explicación se lee como pantalla rota, y manda a buscar el problema al lado
  // equivocado.
  if (!acceso) {
    if (!falla) return null;
    return (
      <div className="admin-panel mt-4">
        <div className="admin-panel__header admin-panel__header--orange">
          <span>🔑</span> Solo vos
        </div>
        <div className="admin-panel__body">
          <div className="admin-hint">⏳ {falla}</div>
          <div className="admin-hint mt-1">
            En cuanto el servidor lo publique, esta sección aparece sola: no hay
            que tocar nada acá.
          </div>
        </div>
      </div>
    );
  }

  const privilegios = Array.isArray(acceso.soloVos) ? acceso.soloVos : [];
  // Los cuatro puntos de cómo funciona la sesión, tal cual los manda el backend.
  const comoFunciona = Array.isArray(acceso.comoFuncionaLaSesion)
    ? acceso.comoFuncionaLaSesion
    : [];
  const cortadas = Array.isArray(acceso.sesiones?.usuariosConSesionCerrada)
    ? acceso.sesiones.usuariosConSesionCerrada
    : [];
  const ultimoCorte = acceso.sesiones?.ultimoCorte || null;
  const cerrandoTodas = cerrando === "todos";

  return (
    <div className="admin-panel mt-4">
      <div className="admin-panel__header admin-panel__header--orange">
        <span>🔑</span> Solo vos
      </div>

      <div className="admin-panel__body">
        <ListaDePuntos
          items={privilegios}
          icono={(p) => ICONO_PRIVILEGIO[p.clave] || "🔒"}
        />

        {/* Cómo funciona la sesión: por qué nadie tiene que volver a entrar y
            qué implica. El dueño tiene que saberlo —es la única razón por la que
            existe el botón de abajo—, pero la regla la escribe quien la aplica.
            Sección aparte de los privilegios: eso es lo que solo puede él, esto
            es cómo se comporta el sistema con todos. */}
        <div className="mt-4">
          <label className="admin-label">Cómo funciona la sesión</label>
          {comoFunciona.length > 0 ? (
            <ListaDePuntos items={comoFunciona} icono={() => "🔒"} />
          ) : (
            // No se escribe acá una versión "de mientras" de la nota: dos textos
            // sobre la misma regla terminan diciendo cosas distintas el día que
            // la regla cambie. Se dice que falta, que es lo único cierto.
            <div className="admin-hint">
              ⏳ El servidor todavía no manda esta nota. Aparece sola en cuanto la
              publique.
            </div>
          )}
        </div>

        {ultimoCorte && (
          <div className="admin-hint mt-2">
            🕘 Última vez que lo pediste: {formatFecha(ultimoCorte.fecha)}
            {ultimoCorte.alcance === "usuario" && " (a una sola persona)"}
          </div>
        )}

        <div className="mt-3">
          <button
            type="button"
            className="btn admin-btn admin-btn--red fw-bold"
            onClick={() => setConfirmar(true)}
            disabled={!!cerrando}
          >
            {cerrandoTodas ? <span className="btn-spinner" /> : "🔐 "}
            Exigir el login a todos otra vez
          </button>
        </div>

        {cortadas.length > 0 && (
          <div className="mt-4">
            <label className="admin-label">Les toca iniciar sesión de nuevo</label>
            <div className="admin-hint mb-2">
              No es un bloqueo: la marca se limpia sola en cuanto entren otra
              vez, y desde ahí vuelven a quedar con la sesión abierta como todos.
            </div>
            <ul className="lista-cortadas">
              {cortadas.map((u) => (
                <li key={u.usuarioId}>
                  <strong>{u.nombre || "—"}</strong>
                  <span className="admin-hint"> · {u.email}</span>
                  {u.desde && <span className="admin-hint"> · desde {formatFecha(u.desde)}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {confirmar && (
        <ModalOverlay
          onCerrar={() => !cerrandoTodas && setConfirmar(false)}
          bloqueado={cerrandoTodas}
          className="admin-modal--confirm"
        >
          <div className="confirm-icono">🔐</div>
          <h5 className="confirm-titulo">¿Exigirle el login a todo el mundo otra vez?</h5>
          {/* Dicho con las palabras que importan: esto pasa en el mostrador, en
              pleno horario, y a quien está cobrando en ese momento. */}
          <p className="confirm-texto">
            Saca la sesión de <strong>todos los celulares y computadoras</strong>,
            incluido el del vendedor que esté atendiendo en el mostrador ahora
            mismo: va a tener que iniciar sesión otra vez para seguir cobrando.
            <br />
            Tu sesión no se cierra, podés seguir acá.
          </p>
          <div className="confirm-botones">
            <button
              type="button"
              className="admin-btn-ghost"
              onClick={() => setConfirmar(false)}
              disabled={cerrandoTodas}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn admin-btn admin-btn--red px-4 fw-bold"
              onClick={async () => {
                const ok = await onCerrarTodas();
                if (ok) setConfirmar(false);
              }}
              disabled={cerrandoTodas}
            >
              {cerrandoTodas && <span className="btn-spinner" />}
              {cerrandoTodas ? "Aplicando..." : "Sí, a todos"}
            </button>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

/**
 * Exige el login otra vez a una sola persona, desde su fila. Sin modal: se
 * confirma en el mismo lugar, que para una persona alcanza.
 */
export function BotonExigirLogin({ usuario, cerrando, onCerrar }) {
  const [confirmando, setConfirmando] = useState(false);
  const enCurso = cerrando === usuario._id;

  if (confirmando) {
    return (
      <div className="d-flex align-items-center gap-2 flex-wrap mt-1">
        <span className="admin-hint">¿Que {usuario.nombre || "esta persona"} tenga que iniciar sesión otra vez?</span>
        <button
          type="button"
          className="accion-btn accion-btn--texto accion-btn--rojo"
          onClick={async () => {
            const ok = await onCerrar(usuario._id);
            if (ok) setConfirmando(false);
          }}
          disabled={!!cerrando}
        >
          {enCurso ? <span className="btn-spinner" /> : "Sí, exigirlo"}
        </button>
        <button
          type="button"
          className="accion-btn accion-btn--texto"
          onClick={() => setConfirmando(false)}
          disabled={enCurso}
        >
          No
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="accion-btn accion-btn--texto mt-1"
      onClick={() => setConfirmando(true)}
      disabled={!!cerrando}
    >
      🔐 Exigirle el login otra vez
    </button>
  );
}
