// Vista Resumen: 3 llamadas en paralelo con el mes actual + 4 tarjetas grandes
import { useState, useEffect, useCallback } from "react";
import { API_URL, getAxios, formatCRC, nombreMes } from "./adminUtils";
import { ErrorRecarga, Cargando } from "./Comunes";

const DashboardPanel = ({ getAuthHeaders, manejarError, irAVista }) => {
  const hoy = new Date();
  const mes = hoy.getMonth() + 1;
  const anio = hoy.getFullYear();

  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchResumen = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const axios = await getAxios();
      const [ganRes, pagRes, ahoRes] = await Promise.all([
        axios.get(`${API_URL}/api/ganancias?mes=${mes}&anio=${anio}&page=1&limit=1`, getAuthHeaders()),
        axios.get(`${API_URL}/api/pagos-servicios?mes=${mes}&anio=${anio}&page=1&limit=1`, getAuthHeaders()),
        axios.get(`${API_URL}/api/ahorro`, getAuthHeaders()),
      ]);
      setDatos({
        gananciasMes: ganRes.data.totalMes || 0,
        gananciasGeneral: ganRes.data.totalGeneral || 0,
        pagosMes: pagRes.data.totalMes || 0,
        ahorroTotal: ahoRes.data.data?.totalAcumulado || 0,
      });
    } catch (err) {
      setError(true);
      manejarError(err);
    } finally {
      setLoading(false);
    }
  }, [mes, anio, getAuthHeaders, manejarError]);

  useEffect(() => { fetchResumen(); }, [fetchResumen]);

  if (loading) return <Cargando />;
  if (error || !datos) return <ErrorRecarga onReintentar={fetchResumen} mensaje="No se pudo cargar el resumen" />;

  const balance = datos.gananciasMes - datos.pagosMes;
  const balanceNegativo = balance < 0;

  const tarjetas = [
    {
      icono: "💰", titulo: "Ganancias del mes", valor: formatCRC(datos.gananciasMes),
      desc: "Ingresos por las máquinas este mes",
      variante: "verde", vista: "ganancias",
    },
    {
      icono: "🧾", titulo: "Pagos del mes", valor: formatCRC(datos.pagosMes),
      desc: "Servicios pagados este mes",
      variante: "naranja", vista: "pagos",
    },
    {
      icono: "📊", titulo: "Balance del mes",
      valor: `${balanceNegativo ? "−" : "+"}${formatCRC(Math.abs(balance))}`,
      desc: `Ganancias − Pagos del mes ${balanceNegativo ? "· este mes se gastó más de lo que entró" : "· lo que quedó libre este mes"}`,
      variante: balanceNegativo ? "rojo" : "verde", vista: "ganancias",
    },
    {
      icono: "🏦", titulo: "Ahorro total", valor: formatCRC(datos.ahorroTotal),
      desc: "Acumulado histórico de ahorros",
      variante: "azul", vista: "ahorro",
    },
  ];

  return (
    <div className="fade-in">
      <div className="resumen-header mb-3">
        <h5 className="resumen-header__titulo mb-0">
          Resumen de {nombreMes(mes, anio)}
        </h5>
        <button className="admin-btn-ghost" onClick={fetchResumen} aria-label="Refrescar resumen">
          🔄 Refrescar
        </button>
      </div>

      <div className="row g-3 mb-3">
        {tarjetas.map((t) => (
          <div key={t.titulo} className="col-12 col-sm-6">
            <button
              className={`resumen-card resumen-card--${t.variante} w-100`}
              onClick={() => irAVista(t.vista)}
            >
              <span className="resumen-card__icono">{t.icono}</span>
              <span className="resumen-card__titulo">{t.titulo}</span>
              <span className="resumen-card__valor">{t.valor}</span>
              <span className="resumen-card__desc">{t.desc}</span>
            </button>
          </div>
        ))}
      </div>

      {/* Tarjeta secundaria: ganancia histórica */}
      <button className="resumen-card resumen-card--secundaria w-100" onClick={() => irAVista("ganancias")}>
        <span className="resumen-card__icono">📈</span>
        <div className="resumen-card__col">
          <span className="resumen-card__titulo">Ganancia histórica total</span>
          <span className="resumen-card__valor resumen-card__valor--sec">
            {formatCRC(datos.gananciasGeneral)}
          </span>
        </div>
      </button>
    </div>
  );
};

export default DashboardPanel;
