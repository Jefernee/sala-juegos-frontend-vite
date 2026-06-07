// Vista Ahorro: total acumulado + formulario para agregar montos
import { useState, useEffect, useCallback, useRef } from "react";
import { API_URL, getAxios, formatCRC, formatFecha } from "./adminUtils";
import { ErrorRecarga, Cargando } from "./Comunes";

// Anima el número del total cuando cambia (count-up)
const useCountUp = (valor, duracion = 700) => {
  const [mostrado, setMostrado] = useState(valor);
  const prevRef = useRef(valor);

  useEffect(() => {
    const desde = prevRef.current;
    const hasta = valor;
    if (desde === hasta) return undefined;
    prevRef.current = valor;

    const inicio = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min((t - inicio) / duracion, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setMostrado(Math.round(desde + (hasta - desde) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [valor, duracion]);

  return mostrado;
};

const AhorroPanel = ({ getAuthHeaders, mostrarNotif, manejarError }) => {
  const [ahorro, setAhorro] = useState(null);
  const [monto, setMonto] = useState("");
  const [errorMonto, setErrorMonto] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorCarga, setErrorCarga] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const totalAnimado = useCountUp(ahorro?.totalAcumulado || 0);

  const fetchAhorro = useCallback(async () => {
    setLoading(true);
    setErrorCarga(false);
    try {
      const axios = await getAxios();
      const res = await axios.get(`${API_URL}/api/ahorro`, getAuthHeaders());
      setAhorro(res.data.data);
    } catch (err) {
      setErrorCarga(true);
      manejarError(err);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, manejarError]);

  useEffect(() => { fetchAhorro(); }, [fetchAhorro]);

  const handleAgregar = async () => {
    if (!monto || Number(monto) <= 0) {
      setErrorMonto("Ingresa un monto mayor a 0");
      return;
    }
    setErrorMonto("");
    setGuardando(true);
    try {
      const axios = await getAxios();
      const res = await axios.post(`${API_URL}/api/ahorro`, { monto: Number(monto) }, getAuthHeaders());
      setMonto("");
      mostrarNotif(res.data?.message || "Ahorro agregado exitosamente");
      // Si el backend devuelve el nuevo total, usarlo; si no, refrescar
      if (res.data?.data?.totalAcumulado !== undefined) {
        setAhorro(res.data.data);
      } else {
        fetchAhorro();
      }
    } catch (err) {
      manejarError(err);
    } finally {
      setGuardando(false);
    }
  };

  if (loading) return <Cargando />;
  if (errorCarga) return <ErrorRecarga onReintentar={fetchAhorro} mensaje="No se pudo cargar el ahorro" />;

  return (
    <div className="fade-in">
      {/* Hero total */}
      <div className="ahorro-hero mb-4">
        <div className="ahorro-hero__bg" />
        <div className="ahorro-hero__content">
          <p className="ahorro-hero__label">🏦 Total Ahorrado</p>
          <div className="ahorro-hero__amount">{formatCRC(totalAnimado)}</div>
          <p className="ahorro-hero__date">
            {ahorro?.ultimaActualizacion
              ? `Última actualización: ${formatFecha(ahorro.ultimaActualizacion)}`
              : "Aún no hay movimientos"}
          </p>
        </div>
      </div>

      {/* Formulario */}
      <div className="admin-panel admin-panel--green">
        <div className="admin-panel__header admin-panel__header--green">
          <span>➕</span> Agregar al Ahorro
        </div>
        <div className="admin-panel__body">
          <label className="admin-label" htmlFor="ahorro-monto">Monto a agregar *</label>
          <div className="input-group input-group-lg">
            <span className="input-group-text admin-input-prefix">₡</span>
            <input
              id="ahorro-monto"
              type="number"
              inputMode="numeric"
              className={`form-control admin-input ${errorMonto ? "admin-input--error" : ""}`}
              placeholder="Ingresa el monto"
              value={monto}
              min="1"
              disabled={guardando}
              onChange={(e) => { setMonto(e.target.value); setErrorMonto(""); }}
              onKeyDown={(e) => e.key === "Enter" && !guardando && handleAgregar()}
            />
            <button
              className="btn admin-btn admin-btn--green px-4 fw-bold"
              onClick={handleAgregar}
              disabled={guardando}
            >
              {guardando && <span className="btn-spinner" />}
              {guardando ? "Guardando..." : "Agregar al ahorro"}
            </button>
          </div>
          {errorMonto && <div className="campo-error">{errorMonto}</div>}
          <small className="admin-hint mt-2 d-block">
            💡 También puedes presionar Enter para agregar
          </small>
        </div>
      </div>
    </div>
  );
};

export default AhorroPanel;
