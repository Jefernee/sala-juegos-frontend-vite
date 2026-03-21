import React, { useState, useEffect, useCallback } from "react";
import { Gamepad2, DollarSign, Clock, TrendingUp, Users, RefreshCw, ChevronLeft, Trophy } from "lucide-react";
import "../styles/Reportesplays.css";

const API_URL = import.meta.env.VITE_API_URL + "/api/monthly-reports";

const MESES = ["","Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const MESES_SHORT = ["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const DIAS_SHORT = ["Do","Lu","Ma","Mi","Ju","Vi","Sá"];
const COLORS = ["#534AB7","#1D9E75","#D85A30","#D4537E","#378ADD","#BA7517","#639922"];
const COL_PLAY4 = "#534AB7";
const COL_PLAY5 = "#1D9E75";
const COL_PING  = "#D85A30";

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt  = (n) => "₡" + Math.round(n || 0).toLocaleString("es-CR");
const fmtN = (n) => Math.round(n || 0).toLocaleString("es-CR");
const fmtH = (mins) => { const h = Math.floor((mins||0)/60); const m = (mins||0)%60; return h > 0 ? `${h}h ${m}m` : `${m}m`; };
const pct  = (a, b) => (b > 0 ? Math.round((a/b)*100) : 0);

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, icon: Icon, color = "#534AB7" }) {
  return (
    <div className="rp-kpi-card">
      <div className="rp-kpi-header">
        <span className="rp-kpi-label">{label}</span>
        {Icon && <Icon size={15} style={{ color, opacity: 0.65 }} />}
      </div>
      <div className="rp-kpi-value">{value}</div>
      {sub && <div className="rp-kpi-sub">{sub}</div>}
    </div>
  );
}

// ── Barra horizontal ───────────────────────────────────────────────────────────
function BarRow({ label, value, maxValue, color, right }) {
  return (
    <div className="rp-bar-row">
      <span className="rp-bar-label" title={label}>{label}</span>
      <div className="rp-bar-track">
        <div className="rp-bar-fill" style={{ width: `${pct(value, maxValue)}%`, background: color }} />
      </div>
      {right && <span className="rp-bar-right">{right}</span>}
      <span className="rp-bar-value">{fmt(value)}</span>
    </div>
  );
}

// ── Fila tipo play ─────────────────────────────────────────────────────────────
function TipoRow({ nombre, value, total, color }) {
  return (
    <div className="rp-tipo-row">
      <div className="rp-tipo-left">
        <span className="rp-tipo-dot" style={{ background: color }} />
        <span className="rp-tipo-name">{nombre}</span>
      </div>
      <div className="rp-tipo-right">
        <span className="rp-tipo-value">{fmt(value)}</span>
        <span className="rp-tipo-pct">{pct(value, total)}%</span>
      </div>
    </div>
  );
}

// ── Juegos más jugados ─────────────────────────────────────────────────────────
function JuegosMasJugados({ juegos = [] }) {
  if (!juegos.length) return (
    <div className="rp-sin-juegos">Sin juegos registrados este mes</div>
  );

  const maxVeces = juegos[0]?.vecesJugado || 1;
  const medallas = ["🥇", "🥈", "🥉"];

  return (
    <div className="rp-juegos-lista">
      {juegos.map((j, i) => (
        <div key={j.nombre} className="rp-juego-row">
          <div className="rp-juego-izq">
            <span className="rp-juego-pos">
              {i < 3 ? medallas[i] : <span className="rp-juego-num">{i + 1}</span>}
            </span>
            <span className="rp-juego-nombre">{j.nombre}</span>
          </div>
          <div className="rp-juego-der">
            <div className="rp-bar-track" style={{ width: 80 }}>
              <div
                className="rp-bar-fill"
                style={{ width: `${pct(j.vecesJugado, maxVeces)}%`, background: COLORS[i % COLORS.length] }}
              />
            </div>
            <span className="rp-juego-veces">{j.vecesJugado}x</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Calendario heatmap ─────────────────────────────────────────────────────────
function CalendarioHeatmap({ dias = [], periodoInicio, año, mes }) {
  const [tooltip, setTooltip] = useState(null);

  const primerDiaUTC = periodoInicio ? new Date(periodoInicio) : null;
  let offsetDia = 0;
  if (primerDiaUTC) {
    const crStr = primerDiaUTC.toLocaleString("en-US", { timeZone: "America/Costa_Rica", weekday: "short" });
    offsetDia = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 }[crStr] || 0;
  }

  const diasEnMes = new Date(año, mes, 0).getDate();
  const maxRec    = Math.max(...dias.map((d) => d.totalRecaudado || 0), 1);

  const celdas = [
    ...Array(offsetDia).fill(null),
    ...Array.from({ length: diasEnMes }, (_, i) => {
      const info = dias.find((x) => x.dia === i + 1);
      return { dia: i + 1, rec: info?.totalRecaudado || 0, ses: info?.totalSesiones || 0 };
    }),
  ];

  return (
    <div style={{ position: "relative" }}>
      <div className="rp-cal-grid">
        {DIAS_SHORT.map((d) => <div key={d} className="rp-cal-hdr">{d}</div>)}
        {celdas.map((c, i) => {
          if (!c) return <div key={`e-${i}`} />;
          const alpha = c.rec > 0 ? Math.max(0.15, Math.min(0.9, (c.rec / maxRec) * 0.85 + 0.1)) : 0;
          return (
            <div
              key={c.dia}
              className="rp-cal-cell"
              style={{
                background: c.rec > 0 ? `rgba(83,74,183,${alpha})` : "#f3f4f6",
                color: alpha > 0.5 ? "#fff" : "#6b7280",
              }}
              onMouseEnter={() => setTooltip(c)}
              onMouseLeave={() => setTooltip(null)}
            >
              {c.dia}
              {tooltip?.dia === c.dia && (
                <div className="rp-cal-tooltip">
                  <strong>Día {c.dia}</strong><br />
                  {fmt(c.rec)}<br />
                  {c.ses} sesión{c.ses !== 1 ? "es" : ""}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="rp-cal-legend">
        <span>Menos</span>
        {[0.15, 0.3, 0.5, 0.7, 0.9].map((o) => (
          <div key={o} style={{ width: 11, height: 11, borderRadius: 2, background: `rgba(83,74,183,${o})` }} />
        ))}
        <span>Más</span>
      </div>
    </div>
  );
}

// ── Vista anual ────────────────────────────────────────────────────────────────
function VistaAnual({ data, onSelectMes }) {
  const meses  = data?.meses || [];
  const totRec = meses.reduce((a, m) => a + (m.totalRecaudado || 0), 0);
  const totSes = meses.reduce((a, m) => a + (m.totalSesiones  || 0), 0);
  const totP4  = meses.reduce((a, m) => a + (m.totalPlay4     || 0), 0);
  const totP5  = meses.reduce((a, m) => a + (m.totalPlay5     || 0), 0);
  const totPP  = meses.reduce((a, m) => a + (m.totalPingPong  || 0), 0);
  const maxRec = Math.max(...meses.map((m) => m.totalRecaudado || 0), 1);

  return (
    <>
      <div className="rp-kpis">
        <KPICard label="Total recaudado"  value={fmt(totRec)}                  sub={`Año ${data?.año}`} icon={DollarSign} />
        <KPICard label="Total sesiones"   value={fmtN(totSes)}                 sub="Todo el año"        icon={Gamepad2}   color="#1D9E75" />
        <KPICard label="Promedio mensual" value={fmt(totRec / 12)}             sub="Por mes"            icon={TrendingUp} color="#D85A30" />
        <KPICard label="Sesiones / mes"   value={fmtN(Math.round(totSes/12))} sub="Promedio"           icon={Users}      color="#378ADD" />
      </div>

      <div className="rp-seccion">
        <p className="rp-seccion-titulo">Ingresos mensuales — clic para ver el detalle</p>
        <div className="rp-card">
          <div className="rp-meses-barras">
            {meses.map((m) => (
              <button
                key={m.mes}
                className={`rp-mes-btn${m.totalSesiones ? " rp-mes-activo" : ""}`}
                onClick={() => m.totalSesiones && onSelectMes(m.mes)}
                title={m.totalSesiones ? `Ver ${m.nombreMes || MESES[m.mes]}` : "Sin datos"}
              >
                <div className="rp-mes-barra-outer">
                  <div
                    className="rp-mes-barra-inner"
                    style={{
                      height: `${pct(m.totalRecaudado||0, maxRec)}%`,
                      background: m.totalSesiones ? COL_PLAY4 : "#e5e7eb",
                    }}
                  />
                </div>
                <span className="rp-mes-lbl">{MESES_SHORT[m.mes]}</span>
                <span className="rp-mes-ses">{m.totalSesiones || 0}</span>
              </button>
            ))}
          </div>
          <div className="rp-leyenda">
            {[
              { l: `Play 4: ${fmt(totP4)}`,    c: COL_PLAY4 },
              { l: `Play 5: ${fmt(totP5)}`,    c: COL_PLAY5 },
              { l: `Ping Pong: ${fmt(totPP)}`, c: COL_PING  },
            ].map((x) => (
              <span key={x.l} className="rp-leyenda-item">
                <span className="rp-leyenda-dot" style={{ background: x.c }} />
                {x.l}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="rp-seccion">
        <p className="rp-seccion-titulo">Detalle por mes</p>
        <div className="rp-card">
          {meses.map((m) => (
            <div key={m.mes} className="rp-tipo-row">
              <div className="rp-tipo-left" style={{ gap: 10 }}>
                <span style={{ width: 90, flexShrink: 0, fontSize: 13, color: "#374151" }}>
                  {m.nombreMes || MESES[m.mes]}
                </span>
                <div className="rp-bar-track" style={{ flex: 1 }}>
                  <div className="rp-bar-fill" style={{ width: `${pct(m.totalRecaudado||0, maxRec)}%`, background: COL_PLAY4 }} />
                </div>
              </div>
              <div className="rp-tipo-right">
                <span className="rp-tipo-value">{fmt(m.totalRecaudado)}</span>
                <span className="rp-tipo-pct">{fmtN(m.totalSesiones)} ses.</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Vista mensual ──────────────────────────────────────────────────────────────
function VistaMensual({ reporte: r }) {
  if (!r) return null;

  const empleados = [...(r.porEmpleado || [])].sort((a, b) => b.totalRecaudado - a.totalRecaudado);
  const lugares   = [...(r.porLugar   || [])].sort((a, b) => b.totalRecaudado - a.totalRecaudado);
  const juegos    = r.juegosMasJugados || [];
  const maxEmp    = Math.max(...empleados.map((e) => e.totalRecaudado || 0), 1);
  const maxLug    = Math.max(...lugares.map((l)   => l.totalRecaudado || 0), 1);
  const totRec    = r.totalRecaudado || 0;

  return (
    <>
      <div className="rp-kpis">
        <KPICard label="Total recaudado"  value={fmt(totRec)}                       sub={`${r.nombreMes} ${r.año}`}                icon={DollarSign} />
        <KPICard label="Total sesiones"   value={fmtN(r.totalSesiones)}             sub={`${fmtN(r.sesionesCompletadas)} completadas`} icon={Gamepad2}   color="#1D9E75" />
        <KPICard label="Tiempo jugado"    value={fmtH(r.tiempoTotalPagadoMinutos)}  sub="Tiempo pagado"                            icon={Clock}      color="#D85A30" />
        <KPICard label="Controles extra"  value={fmtN(r.totalControlesAdicionales)} sub="Adicionales cobrados"                     icon={TrendingUp} color="#378ADD" />
      </div>

      <div className="rp-dos-col">
        {/* Tipo de play + estados */}
        <div className="rp-seccion">
          <p className="rp-seccion-titulo">Por tipo de play</p>
          <div className="rp-card">
            <TipoRow nombre="Play 4"    value={r.totalPlay4    || 0} total={totRec} color={COL_PLAY4} />
            <TipoRow nombre="Play 5"    value={r.totalPlay5    || 0} total={totRec} color={COL_PLAY5} />
            <TipoRow nombre="Ping Pong" value={r.totalPingPong || 0} total={totRec} color={COL_PING}  />
            <div className="rp-estados">
              <div className="rp-estado">
                <div className="rp-estado-val" style={{ color: "#059669" }}>{fmtN(r.sesionesCompletadas)}</div>
                <div className="rp-estado-lbl">Completadas</div>
              </div>
              <div className="rp-estado">
                <div className="rp-estado-val" style={{ color: "#d97706" }}>{fmtN(r.sesionesPendientes)}</div>
                <div className="rp-estado-lbl">Pendientes</div>
              </div>
              <div className="rp-estado">
                <div className="rp-estado-val" style={{ color: "#6b7280" }}>{fmtN(r.sesionesEnProceso)}</div>
                <div className="rp-estado-lbl">En proceso</div>
              </div>
            </div>
          </div>
        </div>

        {/* Juegos más jugados */}
        <div className="rp-seccion">
          <p className="rp-seccion-titulo">
            <Trophy size={12} style={{ display: "inline", marginRight: 5, verticalAlign: "middle" }} />
            Juegos más jugados
          </p>
          <div className="rp-card">
            <JuegosMasJugados juegos={juegos} />
          </div>
        </div>
      </div>

      <div className="rp-dos-col">
        {/* Por lugar */}
        <div className="rp-seccion">
          <p className="rp-seccion-titulo">Por lugar</p>
          <div className="rp-card">
            {lugares.map((l, i) => (
              <BarRow key={l.lugar} label={l.lugar} value={l.totalRecaudado||0} maxValue={maxLug} color={COLORS[i % COLORS.length]} />
            ))}
          </div>
        </div>

        {/* Por empleado */}
        <div className="rp-seccion">
          <p className="rp-seccion-titulo">Por empleado</p>
          <div className="rp-card">
            {empleados.map((e, i) => (
              <BarRow
                key={e.nombre}
                label={e.nombre}
                value={e.totalRecaudado || 0}
                maxValue={maxEmp}
                color={COLORS[i % COLORS.length]}
                right={`${fmtN(e.totalSesiones)} ses. · ${fmtH(e.tiempoTotalMinutos)}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Calendario heatmap */}
      <div className="rp-seccion">
        <p className="rp-seccion-titulo">Actividad diaria — {r.nombreMes} {r.año}</p>
        <div className="rp-card">
          <CalendarioHeatmap dias={r.porDia} periodoInicio={r.periodoInicio} año={r.año} mes={r.mes} />
        </div>
      </div>
    </>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function ReportesPlays() {
  const añoActual = new Date().getFullYear();

  const [años,        setAños]        = useState([añoActual]);
  const [selectedAño, setSelectedAño] = useState(añoActual);
  const [selectedMes, setSelectedMes] = useState(0);
  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [generando,   setGenerando]   = useState(false);
  const [error,       setError]       = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/anos-disponibles`)
      .then((r) => r.json())
      .then((d) => { if (d.años?.length) setAños(d.años); })
      .catch(() => {});
  }, []);

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (selectedMes === 0) {
        const r = await fetch(`${API_URL}/${selectedAño}`);
        const d = await r.json();
        if (!d.ok) throw new Error();
        setData({ tipo: "anual", payload: d });
      } else {
        const r = await fetch(`${API_URL}/${selectedAño}/${selectedMes}`);
        if (!r.ok) throw new Error();
        const d = await r.json();
        setData({ tipo: "mensual", payload: d.reporte });
      }
    } catch {
      setError("No hay reporte para este período. Presiona Regenerar para generarlo.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedAño, selectedMes]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  const handleGenerar = async () => {
    setGenerando(true);
    try {
      if (selectedMes === 0) {
        await fetch(`${API_URL}/generate-year`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ año: selectedAño }),
        });
      } else {
        await fetch(`${API_URL}/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ año: selectedAño, mes: selectedMes }),
        });
      }
      await cargarDatos();
    } catch (e) {
      console.error("Error generando reporte:", e);
    } finally {
      setGenerando(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="reportes-loading-screen-small">
        <div className="reportes-loading-content">
          <div className="reportes-loading-spinner" />
          <p className="reportes-loading-text">Cargando reportes de plays...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="reportes-plays-contenido">
      {/* Barra de controles */}
      <div className="rp-controles">
        <div className="rp-controles-izq">
          {selectedMes !== 0 && (
            <button className="rp-btn-volver" onClick={() => setSelectedMes(0)}>
              <ChevronLeft size={14} />
              Año {selectedAño}
            </button>
          )}
          <span className="rp-titulo-periodo">
            {selectedMes === 0 ? `Resumen ${selectedAño}` : `${MESES[selectedMes]} ${selectedAño}`}
          </span>
        </div>
        <div className="rp-controles-der">
          <select className="rp-select" value={selectedAño} onChange={(e) => { setSelectedAño(parseInt(e.target.value)); setSelectedMes(0); }}>
            {años.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select className="rp-select" value={selectedMes} onChange={(e) => setSelectedMes(parseInt(e.target.value))}>
            <option value={0}>Año completo</option>
            {MESES.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          <button className="rp-btn-generar" onClick={handleGenerar} disabled={generando}>
            <RefreshCw size={13} style={{ animation: generando ? "rp-spin 1s linear infinite" : "none" }} />
            {generando ? "Generando..." : "Regenerar"}
          </button>
        </div>
      </div>

      {error && <div className="rp-error">{error}</div>}
      {loading && data && <div className="rp-loading-overlay">Actualizando...</div>}

      {data?.tipo === "anual"   && <VistaAnual   data={data.payload}    onSelectMes={(mes) => setSelectedMes(mes)} />}
      {data?.tipo === "mensual" && <VistaMensual reporte={data.payload} />}
    </div>
  );
}