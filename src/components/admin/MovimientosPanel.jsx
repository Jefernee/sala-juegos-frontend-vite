// Panel compartido por Ganancias y Pagos de Servicios.
// Ambas vistas son idénticas en estructura: selector de mes, totales,
// lista paginada y CRUD con modal. Se parametriza con `tipo`.
import { useState, useEffect, useCallback } from "react";
import {
  API_URL, getAxios, formatCRC, formatFecha, nombreMes,
  ICONOS_GANANCIA, ICONOS_SERVICIO, LIMITE_PAGINA,
} from "./adminUtils";
import MesSelector from "./MesSelector";
import { ModalOverlay, ConfirmarEliminar, Paginacion, ErrorRecarga, EstadoVacio, Cargando } from "./Comunes";

const CONFIGS = {
  ganancias: {
    endpoint: "ganancias",
    campo: "tipo",
    labelCampo: "Tipo",
    placeholderCampo: "Selecciona el tipo",
    opciones: Object.keys(ICONOS_GANANCIA),
    iconos: ICONOS_GANANCIA,
    color: "green",
    montoClase: "verde",
    tieneTotalGeneral: true,
    singular: "ganancia",
    tituloNuevo: "Registrar ganancia",
    tituloEditar: "Editar ganancia",
    btnNuevo: "＋ Registrar ganancia",
    vacio: "No hay ganancias registradas este mes",
    iconoVacio: "📈",
  },
  pagos: {
    endpoint: "pagos-servicios",
    campo: "servicio",
    labelCampo: "Servicio",
    placeholderCampo: "Selecciona el servicio",
    opciones: Object.keys(ICONOS_SERVICIO),
    iconos: ICONOS_SERVICIO,
    color: "blue",
    montoClase: "rojo",
    tieneTotalGeneral: false,
    singular: "pago",
    tituloNuevo: "Registrar pago de servicio",
    tituloEditar: "Editar pago de servicio",
    btnNuevo: "＋ Registrar pago",
    vacio: "No hay pagos registrados este mes",
    iconoVacio: "🧾",
  },
};

// ─── MODAL CREAR / EDITAR ────────────────────────────────────────────────────
const MovimientoFormModal = ({
  cfg, registro, mes, anio,
  getAuthHeaders, mostrarNotif, manejarError, onCerrar, onExito,
}) => {
  const esEdicion = !!registro;
  const [campo, setCampo] = useState(registro?.[cfg.campo] || "");
  const [monto, setMonto] = useState(registro != null ? String(registro.monto) : "");
  const [descripcion, setDescripcion] = useState(registro?.descripcion || "");
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  const hoy = new Date();
  const esMesActual = mes === hoy.getMonth() + 1 && anio === hoy.getFullYear();

  const validar = () => {
    const e = {};
    if (!campo) e.campo = `${cfg.labelCampo} es obligatorio`;
    if (!monto || Number(monto) <= 0) e.monto = "Ingresa un monto mayor a 0";
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!validar() || guardando) return;
    setGuardando(true);
    try {
      const axios = await getAxios();
      const body = {
        [cfg.campo]: campo,
        monto: Number(monto),
        mes,
        anio,
      };
      const desc = descripcion.trim();
      if (esEdicion) body.descripcion = desc; // permite limpiar la descripción
      else if (desc) body.descripcion = desc;

      const res = esEdicion
        ? await axios.put(`${API_URL}/api/${cfg.endpoint}/${registro._id}`, body, getAuthHeaders())
        : await axios.post(`${API_URL}/api/${cfg.endpoint}`, body, getAuthHeaders());

      mostrarNotif(res.data?.message || (esEdicion ? "Registro actualizado" : "Registro creado"));
      onExito();
    } catch (err) {
      manejarError(err);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ModalOverlay onCerrar={onCerrar} bloqueado={guardando}>
      <div className={`admin-modal__header admin-panel__header--${cfg.color}`}>
        <span>{esEdicion ? "✏️" : "➕"}</span>
        {esEdicion ? cfg.tituloEditar : cfg.tituloNuevo}
        <button className="admin-modal__cerrar" onClick={onCerrar} disabled={guardando} aria-label="Cerrar">✕</button>
      </div>
      <form className="admin-modal__body" onSubmit={handleSubmit} noValidate>
        {!esMesActual && (
          <div className="aviso-mes mb-3">
            📅 Se {esEdicion ? "guardará" : "registrará"} en <strong>{nombreMes(mes, anio)}</strong>
          </div>
        )}

        <div className="mb-3">
          <label className="admin-label">{cfg.labelCampo} *</label>
          <select
            className={`form-select admin-select ${errores.campo ? "admin-input--error" : ""}`}
            value={campo}
            disabled={guardando}
            onChange={(e) => { setCampo(e.target.value); setErrores((er) => ({ ...er, campo: "" })); }}
          >
            <option value="">{cfg.placeholderCampo}...</option>
            {cfg.opciones.map((op) => (
              <option key={op} value={op}>{cfg.iconos[op]} {op}</option>
            ))}
          </select>
          {errores.campo && <div className="campo-error">{errores.campo}</div>}
        </div>

        <div className="mb-3">
          <label className="admin-label">Monto *</label>
          <div className="input-group">
            <span className="input-group-text admin-input-prefix">₡</span>
            <input
              type="number"
              inputMode="numeric"
              className={`form-control admin-input ${errores.monto ? "admin-input--error" : ""}`}
              placeholder="0"
              min="1"
              value={monto}
              disabled={guardando}
              onChange={(e) => { setMonto(e.target.value); setErrores((er) => ({ ...er, monto: "" })); }}
            />
          </div>
          {errores.monto && <div className="campo-error">{errores.monto}</div>}
        </div>

        <div className="mb-3">
          <label className="admin-label">Descripción</label>
          <textarea
            className="form-control admin-input"
            rows={2}
            maxLength={200}
            placeholder="Opcional..."
            value={descripcion}
            disabled={guardando}
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </div>

        <div className="d-flex gap-2 justify-content-end">
          <button type="button" className="admin-btn-ghost" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </button>
          <button type="submit" className={`btn admin-btn admin-btn--${cfg.color} px-4 fw-bold`} disabled={guardando}>
            {guardando && <span className="btn-spinner" />}
            {guardando ? "Guardando..." : esEdicion ? "Guardar cambios" : "Registrar"}
          </button>
        </div>
      </form>
    </ModalOverlay>
  );
};

// ─── PANEL PRINCIPAL ─────────────────────────────────────────────────────────
const MovimientosPanel = ({ tipo, getAuthHeaders, mostrarNotif, manejarError }) => {
  const cfg = CONFIGS[tipo];
  const hoy = new Date();
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [page, setPage] = useState(1);

  const [registros, setRegistros] = useState([]);
  const [totalMes, setTotalMes] = useState(0);
  const [totalGeneral, setTotalGeneral] = useState(0);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);

  const [modal, setModal] = useState(null);        // null | { registro: null | obj }
  const [aEliminar, setAEliminar] = useState(null); // null | registro
  const [eliminando, setEliminando] = useState(false);

  const fetchRegistros = useCallback(async () => {
    setLoading(true);
    setErrorCarga(false);
    try {
      const axios = await getAxios();
      const res = await axios.get(
        `${API_URL}/api/${cfg.endpoint}?mes=${mes}&anio=${anio}&page=${page}&limit=${LIMITE_PAGINA}`,
        getAuthHeaders(),
      );
      const data = res.data.data || [];
      setRegistros(data);
      setTotalMes(res.data.totalMes || 0);
      if (cfg.tieneTotalGeneral) setTotalGeneral(res.data.totalGeneral || 0);
      // Si el backend no envía pagination, se sintetiza para que el control
      // de páginas siempre sea visible cuando hay registros
      setPagination(
        res.data.pagination ||
          (data.length > 0 ? { currentPage: page, totalPages: page, totalItems: data.length } : null),
      );
    } catch (err) {
      setErrorCarga(true);
      manejarError(err);
    } finally {
      setLoading(false);
    }
  }, [cfg.endpoint, cfg.tieneTotalGeneral, mes, anio, page, getAuthHeaders, manejarError]);

  useEffect(() => { fetchRegistros(); }, [fetchRegistros]);

  const cambiarMes = (nuevoMes, nuevoAnio) => {
    setMes(nuevoMes);
    setAnio(nuevoAnio);
    setPage(1);
  };

  const handleExitoForm = (eraEdicion) => {
    setModal(null);
    // Al crear, volver a página 1 (los registros nuevos quedan de primeros)
    if (!eraEdicion && page !== 1) setPage(1);
    else fetchRegistros();
  };

  const confirmarEliminar = async () => {
    if (!aEliminar || eliminando) return;
    setEliminando(true);
    try {
      const axios = await getAxios();
      const res = await axios.delete(
        `${API_URL}/api/${cfg.endpoint}/${aEliminar._id}`,
        getAuthHeaders(),
      );
      mostrarNotif(res.data?.message || "Registro eliminado");
      setAEliminar(null);
      // Si era el último de la página y hay página anterior, retroceder
      if (registros.length === 1 && page > 1) setPage((p) => p - 1);
      else fetchRegistros();
    } catch (err) {
      manejarError(err);
    } finally {
      setEliminando(false);
    }
  };

  return (
    <div className="fade-in">
      {/* Selector de mes */}
      <MesSelector mes={mes} anio={anio} onChange={cambiarMes} />

      {/* Totales (no cambian al paginar) */}
      {cfg.tieneTotalGeneral ? (
        <div className="row g-3 mb-3">
          <div className="col-6">
            <div className="total-box total-box--green">
              <span className="total-box__label">Total del mes</span>
              <span className="total-box__value">{formatCRC(totalMes)}</span>
            </div>
          </div>
          <div className="col-6">
            <div className="total-box total-box--yellow">
              <span className="total-box__label">Total general histórico</span>
              <span className="total-box__value">{formatCRC(totalGeneral)}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="total-box total-box--red mb-3">
          <span className="total-box__label">Total pagado este mes</span>
          <span className="total-box__value">{formatCRC(totalMes)}</span>
        </div>
      )}

      {/* Botón crear */}
      <div className="d-flex justify-content-end mb-3">
        <button
          className={`btn admin-btn admin-btn--${cfg.color} px-4 fw-bold`}
          onClick={() => setModal({ registro: null })}
        >
          {cfg.btnNuevo}
        </button>
      </div>

      {/* Lista */}
      {errorCarga ? (
        <ErrorRecarga onReintentar={fetchRegistros} />
      ) : loading ? (
        <Cargando variante={cfg.color === "blue" ? "blue" : ""} />
      ) : registros.length === 0 ? (
        <EstadoVacio icono={cfg.iconoVacio} mensaje={cfg.vacio} />
      ) : (
        <>
          <div className="mov-tabla">
            <div className="mov-tabla__head">
              <span>{cfg.labelCampo}</span>
              <span>Monto</span>
              <span>Descripción</span>
              <span>Fecha</span>
              <span className="text-end">Acciones</span>
            </div>
            {registros.map((r) => (
              <div key={r._id} className={`mov-row mov-row--${cfg.color}`}>
                <span className="mov-row__tipo">
                  <span className={`registro-item__badge registro-item__badge--${cfg.color}`}>
                    {cfg.iconos[r[cfg.campo]] || ""} {r[cfg.campo]}
                  </span>
                </span>
                <span className={`mov-row__monto mov-row__monto--${cfg.montoClase}`}>
                  {formatCRC(r.monto)}
                </span>
                <span className="mov-row__desc">{r.descripcion || "—"}</span>
                <span className="mov-row__fecha">{r.fecha ? formatFecha(r.fecha) : "—"}</span>
                <span className="mov-row__acciones">
                  <button
                    className="accion-btn"
                    title="Editar"
                    aria-label={`Editar ${cfg.singular}`}
                    onClick={() => setModal({ registro: r })}
                  >
                    ✏️
                  </button>
                  <button
                    className="accion-btn accion-btn--rojo"
                    title="Eliminar"
                    aria-label={`Eliminar ${cfg.singular}`}
                    onClick={() => setAEliminar(r)}
                  >
                    🗑️
                  </button>
                </span>
              </div>
            ))}
          </div>
          <Paginacion pagination={pagination} onPage={setPage} loading={loading} />
        </>
      )}

      {/* Modal crear / editar */}
      {modal && (
        <MovimientoFormModal
          cfg={cfg}
          registro={modal.registro}
          mes={mes}
          anio={anio}
          getAuthHeaders={getAuthHeaders}
          mostrarNotif={mostrarNotif}
          manejarError={manejarError}
          onCerrar={() => setModal(null)}
          onExito={() => handleExitoForm(!!modal.registro)}
        />
      )}

      {/* Confirmación de eliminación */}
      {aEliminar && (
        <ConfirmarEliminar
          detalle={`${cfg.iconos[aEliminar[cfg.campo]] || ""} ${aEliminar[cfg.campo]} · ${formatCRC(aEliminar.monto)}`}
          eliminando={eliminando}
          onCancelar={() => setAEliminar(null)}
          onConfirmar={confirmarEliminar}
        />
      )}
    </div>
  );
};

export default MovimientosPanel;
