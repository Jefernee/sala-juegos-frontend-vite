// Saldo de apertura de Mis Finanzas Personales.
//
// Es la plata con la que se arrancó ANTES de empezar a registrar movimientos:
// NO es un movimiento, no aparece en ningún ingreso ni gasto y no entra en los
// porcentajes del mes (si se metiera como ingreso normal, los mensajes
// inteligentes se romperían: el mes siguiente diría "tus ingresos bajaron 90%").
// El backend lo guarda aparte y hay UNO SOLO por usuario, así que el PUT es un
// upsert: el mismo formulario crea y edita.
import { useState, useEffect, useCallback } from "react";
import { getAxios, MESES, formatCRC } from "./adminUtils";
import { FIN_BASE as BASE, formatMontoInput, limpiarMontoInput } from "./finanzasComunes";
import { ModalOverlay, ConfirmarEliminar, Cargando } from "./Comunes";

const FinanzasAperturaModal = ({ getAuthHeaders, mostrarNotif, manejarError, onCerrar, onGuardado }) => {
  const hoy = new Date();
  const mesActual = hoy.getMonth() + 1;
  const anioActual = hoy.getFullYear();

  const [cargando, setCargando] = useState(true);
  const [existe, setExiste] = useState(false);        // ya había una apertura registrada
  const [montoAhorro, setMontoAhorro] = useState("");
  const [montoDisponible, setMontoDisponible] = useState("");
  const [mes, setMes] = useState(mesActual);
  const [anio, setAnio] = useState(anioActual);
  const [descripcion, setDescripcion] = useState("");
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);
  const [borrando, setBorrando] = useState(false);

  // Se pregunta siempre al abrir: si ya existe apertura, el formulario arranca
  // con los datos guardados (incluida la descripción, que el resumen no manda).
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const axios = await getAxios();
        const res = await axios.get(`${BASE}/apertura`, getAuthHeaders());
        const d = res.data?.data;
        if (!vivo) return;
        if (d) {
          setExiste(true);
          setMontoAhorro(d.montoAhorro ? String(d.montoAhorro) : "");
          setMontoDisponible(d.montoDisponible ? String(d.montoDisponible) : "");
          if (d.mesCorte) setMes(Number(d.mesCorte));
          if (d.anioCorte) setAnio(Number(d.anioCorte));
          setDescripcion(d.descripcion || "");
        }
      } catch (err) {
        manejarError(err);
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => { vivo = false; };
  }, [getAuthHeaders, manejarError]);

  const ahorroNum = Number(montoAhorro) || 0;
  const disponibleNum = Number(montoDisponible) || 0;
  const total = ahorroNum + disponibleNum;

  // El mes de corte no puede ser futuro (misma regla que el picker de meses).
  const esMesFuturo = useCallback(
    (m, a) => a > anioActual || (a === anioActual && m > mesActual),
    [anioActual, mesActual],
  );

  const cambiarAnio = (delta) => {
    const nuevo = anio + delta;
    if (nuevo > anioActual) return;
    setAnio(nuevo);
    // Si al cambiar de año el mes elegido queda en el futuro, se ajusta al actual.
    if (esMesFuturo(mes, nuevo)) setMes(mesActual);
    setErrores((er) => ({ ...er, mes: "" }));
  };

  const validar = () => {
    const e = {};
    if (total <= 0) e.monto = "Poné al menos uno de los dos montos";
    if (esMesFuturo(mes, anio)) e.mes = "El mes de corte no puede ser futuro";
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!validar() || guardando) return;
    setGuardando(true);
    try {
      const axios = await getAxios();
      // El frontend NUNCA manda fechas: solo mes (1-12) y año.
      const body = {
        montoAhorro: ahorroNum,
        montoDisponible: disponibleNum,
        mes,
        anio,
        descripcion: descripcion.trim(),
      };
      const res = await axios.put(`${BASE}/apertura`, body, getAuthHeaders());
      mostrarNotif(res.data?.message || (existe ? "Saldo de apertura actualizado" : "Saldo de apertura guardado"));
      onGuardado();
    } catch (err) {
      manejarError(err);
    } finally {
      setGuardando(false);
    }
  };

  const handleBorrar = async () => {
    if (borrando) return;
    setBorrando(true);
    try {
      const axios = await getAxios();
      const res = await axios.delete(`${BASE}/apertura`, getAuthHeaders());
      mostrarNotif(res.data?.message || "Saldo de apertura eliminado");
      onGuardado();
    } catch (err) {
      manejarError(err);
      setConfirmarBorrar(false);
    } finally {
      setBorrando(false);
    }
  };

  const bloqueado = guardando || borrando;

  return (
    <>
      <ModalOverlay onCerrar={onCerrar} bloqueado={bloqueado}>
        <div className="admin-modal__header admin-panel__header--blue">
          <span>⭐</span>
          {existe ? "Editar saldo de apertura" : "Ya tenía ahorros de antes"}
          <button className="admin-modal__cerrar" onClick={onCerrar} disabled={bloqueado} aria-label="Cerrar">✕</button>
        </div>

        {cargando ? (
          <div className="admin-modal__body"><Cargando /></div>
        ) : (
          <form className="admin-modal__body" onSubmit={handleSubmit} noValidate>
            <div className="fin-apertura-ayuda mb-3">
              Esto no cuenta como ingreso de ningún mes: solo le dice al sistema con cuánto
              arrancaste, para que el ahorro acumulado y el colchón de emergencia salgan bien.
            </div>

            {/* Ahorro que ya se tenía apartado */}
            <div className="mb-3">
              <label className="admin-label">¿Cuánto tenías ya ahorrado?</label>
              <div className="input-group">
                <span className="input-group-text admin-input-prefix">₡</span>
                <input
                  type="text"
                  inputMode="numeric"
                  className={`form-control admin-input ${errores.monto ? "admin-input--error" : ""}`}
                  placeholder="0"
                  value={formatMontoInput(montoAhorro, false)}
                  disabled={bloqueado}
                  onChange={(e) => {
                    setMontoAhorro(limpiarMontoInput(e.target.value, false));
                    setErrores((er) => ({ ...er, monto: "" }));
                  }}
                />
              </div>
              <small className="admin-hint">
                Plata que tenías apartada. No cuenta como disponible para gastar.
              </small>
            </div>

            {/* Plata que estaba lista para usar */}
            <div className="mb-3">
              <label className="admin-label">¿Cuánto tenías a mano / disponible?</label>
              <div className="input-group">
                <span className="input-group-text admin-input-prefix">₡</span>
                <input
                  type="text"
                  inputMode="numeric"
                  className={`form-control admin-input ${errores.monto ? "admin-input--error" : ""}`}
                  placeholder="0"
                  value={formatMontoInput(montoDisponible, false)}
                  disabled={bloqueado}
                  onChange={(e) => {
                    setMontoDisponible(limpiarMontoInput(e.target.value, false));
                    setErrores((er) => ({ ...er, monto: "" }));
                  }}
                />
              </div>
              <small className="admin-hint">Plata que tenías lista para gastar.</small>
            </div>

            {errores.monto && <div className="campo-error mb-3">{errores.monto}</div>}

            {/* Mes de corte: desde cuándo se llevan las cuentas en la app */}
            <div className="mb-3">
              <label className="admin-label">¿Desde qué mes llevás las cuentas acá? *</label>
              <div className="fin-apertura-mes">
                <div className="fin-apertura-mes__anio">
                  <button type="button" onClick={() => cambiarAnio(-1)} disabled={bloqueado} aria-label="Año anterior">◀</button>
                  <span>{anio}</span>
                  <button
                    type="button"
                    onClick={() => cambiarAnio(1)}
                    disabled={bloqueado || anio >= anioActual}
                    aria-label="Año siguiente"
                  >
                    ▶
                  </button>
                </div>
                <div className="fin-apertura-mes__grid">
                  {MESES.map((nombre, i) => {
                    const num = i + 1;
                    return (
                      <button
                        key={nombre}
                        type="button"
                        className={`fin-apertura-mes__btn ${num === mes ? "fin-apertura-mes__btn--activo" : ""}`}
                        disabled={bloqueado || esMesFuturo(num, anio)}
                        onClick={() => { setMes(num); setErrores((er) => ({ ...er, mes: "" })); }}
                      >
                        {nombre.slice(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>
              {errores.mes && <div className="campo-error">{errores.mes}</div>}
            </div>

            {/* Descripción: se usa como bloc de notas (de dónde salió cada
                monto), así que es textarea y con el mismo largo que la
                descripción de un movimiento. */}
            <div className="mb-3">
              <label className="admin-label">Descripción</label>
              <textarea
                className="form-control admin-input"
                rows={3}
                maxLength={200}
                placeholder="Opcional... (ej: ₡945.000 de mamá, ₡200.000 de la abuela, ₡887.330 de CreAI)"
                value={descripcion}
                disabled={bloqueado}
                onChange={(e) => setDescripcion(e.target.value)}
              />
              <small className="admin-hint">{descripcion.length}/200</small>
            </div>

            {total > 0 && (
              <div className="fin-apertura-preview mb-3">
                Arrancás en <strong>{MESES[mes - 1]} {anio}</strong> con{" "}
                <strong>{formatCRC(ahorroNum)} apartados</strong>
                {disponibleNum > 0 && <> y <strong>{formatCRC(disponibleNum)} a mano</strong></>}
                {" · "}total {formatCRC(total)}
              </div>
            )}

            <div className="fin-apertura-acciones">
              {existe && (
                <button
                  type="button"
                  className="admin-btn-ghost admin-btn-ghost--rojo"
                  onClick={() => setConfirmarBorrar(true)}
                  disabled={bloqueado}
                >
                  🗑️ Borrar apertura
                </button>
              )}
              <div className="d-flex gap-2 justify-content-end flex-grow-1">
                <button type="button" className="admin-btn-ghost" onClick={onCerrar} disabled={bloqueado}>
                  Cancelar
                </button>
                <button type="submit" className="btn admin-btn admin-btn--blue px-4 fw-bold" disabled={bloqueado}>
                  {guardando && <span className="btn-spinner" />}
                  {guardando ? "Guardando..." : existe ? "Guardar cambios" : "Guardar"}
                </button>
              </div>
            </div>
          </form>
        )}
      </ModalOverlay>

      {/* Borrar la apertura NO borra ningún movimiento */}
      {confirmarBorrar && (
        <ConfirmarEliminar
          detalle="Se borra solo el saldo de apertura: tus movimientos registrados no se tocan."
          eliminando={borrando}
          onCancelar={() => setConfirmarBorrar(false)}
          onConfirmar={handleBorrar}
        />
      )}
    </>
  );
};

export default FinanzasAperturaModal;
