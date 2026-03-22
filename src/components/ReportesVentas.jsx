import React, { useState, useEffect, useCallback } from "react";
import {
  ShoppingCart, DollarSign, TrendingUp, Users,
  RefreshCw, ChevronLeft, Package, Award,
  ReceiptText, Layers, ArrowUp, ArrowDown,
  BarChart2, Percent, CircleDollarSign
} from "lucide-react";
import "../styles/ReportesVentas.css";

const API_URL = import.meta.env.VITE_API_URL + "/api/ventas-reports";
const MESES       = ["","Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const MESES_SHORT = ["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const DIAS_SHORT  = ["Do","Lu","Ma","Mi","Ju","Vi","Sa"];
const COLORS      = ["#E8A020","#2CB67D","#E84040","#9B6DFF","#38BDF8","#F97316","#EC4899"];

const fmt    = (n) => String.fromCodePoint(0x20a1) + Math.round(n || 0).toLocaleString("es-CR");
const fmtN   = (n) => Math.round(n || 0).toLocaleString("es-CR");
const pct    = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
const fmtPct = (n) => `${(n || 0).toFixed(1)}%`;
const clamp  = (v, mn, mx) => Math.min(mx, Math.max(mn, v));

function getDiagnostico(margen, productosConMargenBajo = 0) {
  let emoji, texto, color;
  if (margen < 20) {
    emoji = String.fromCodePoint(0x1f534);
    texto = "Margen muy bajo \u00b7 Revisar precios urgente";
    color = "#E84040";
  } else if (margen < 35) {
    emoji = String.fromCodePoint(0x1f7e1);
    texto = "Margen ajustado \u00b7 Hay espacio para mejorar";
    color = "#E8A020";
  } else if (margen < 50) {
    emoji = String.fromCodePoint(0x1f7e2);
    texto = "Margen saludable \u00b7 Buen desempe\u00f1o";
    color = "#2CB67D";
  } else if (margen < 70) {
    emoji = String.fromCodePoint(0x1f7e2);
    texto = "Margen muy bueno \u00b7 Sigue as\u00ed";
    color = "#2CB67D";
  } else {
    emoji = "\u2705";
    texto = "Margen excelente";
    color = "#2CB67D";
  }
  if (productosConMargenBajo > 0) {
    texto += " \u00b7 " + productosConMargenBajo + " producto" + (productosConMargenBajo > 1 ? "s" : "") + " bajo 20%";
  }
  return { emoji, texto, color };
}

function KPICard({ label, value, sub, icon: Icon, color = "#E8A020", trend, diagnostico }) {
  return (
    <div className="rv-kpi-card">
      <div className="rv-kpi-accent" style={{ background: color }} />
      {Icon && <div className="rv-kpi-icon"><Icon size={26} color={color} /></div>}
      <div className="rv-kpi-label">{label}</div>
      <div className="rv-kpi-value" style={{ color }}>{value}</div>
      {sub && <div className="rv-kpi-sub">{sub}</div>}
      {diagnostico && (
        <div className="rv-kpi-diagnostico" style={{ color: diagnostico.color }}>
          <span>{diagnostico.emoji}</span>
          <span>{diagnostico.texto}</span>
        </div>
      )}
      {trend !== undefined && (
        <div className="rv-kpi-trend">
          {trend >= 0 ? <ArrowUp size={11} color="#2CB67D" /> : <ArrowDown size={11} color="#E84040" />}
          <span style={{ color: trend >= 0 ? "#2CB67D" : "#E84040" }}>{Math.abs(trend)}%</span>
          <span className="rv-kpi-trend-label">vs mes ant.</span>
        </div>
      )}
    </div>
  );
}

function BarRow({ label, value, maxValue, color, right }) {
  return (
    <div className="rv-bar-row">
      <span className="rv-bar-label" title={label}>{label}</span>
      <div className="rv-bar-track">
        <div className="rv-bar-fill" style={{ width: `${pct(value, maxValue)}%`, background: color }} />
      </div>
      {right && <span className="rv-bar-right">{right}</span>}
      <span className="rv-bar-val">{fmt(value)}</span>
    </div>
  );
}

function GananciaChip({ ganancia, margen }) {
  const color = ganancia > 0 ? "#2CB67D" : ganancia < 0 ? "#E84040" : "#8A8A85";
  return (
    <span className="rv-ganancia-chip" style={{ color, borderColor: `${color}40`, background: `${color}12` }}>
      {ganancia >= 0 ? "+" : ""}{fmt(ganancia)}
      {margen !== undefined && <span className="rv-ganancia-chip-pct"> {fmtPct(margen)}</span>}
    </span>
  );
}

function RankingProductos({ productos = [] }) {
  const medallas = ["🥇", "🥈", "🥉"];
  const max = productos[0]?.totalVendido || 1;
  if (!productos.length) return <div className="rv-empty">Sin productos registrados este período</div>;
  return (
    <div className="rv-ranking-lista">
      {productos.map((p, i) => {
        const margenProd = p.totalRecaudado > 0 ? ((p.ganancia || 0) / p.totalRecaudado) * 100 : 0;
        return (
          <div key={p.nombre + i} className="rv-ranking-row">
            <span className="rv-ranking-pos">{i < 3 ? medallas[i] : <span className="rv-ranking-num">{i + 1}</span>}</span>
            <span className="rv-ranking-nombre" title={p.nombre}>{p.nombre}</span>
            <div className="rv-ranking-right">
              <div className="rv-bar-track" style={{ width: 50 }}>
                <div className="rv-bar-fill" style={{ width: `${pct(p.totalVendido, max)}%`, background: COLORS[i % COLORS.length] }} />
              </div>
              <span className="rv-ranking-uds">{fmtN(p.totalVendido)}u</span>
              <span className="rv-ranking-rec">{fmt(p.totalRecaudado)}</span>
              <GananciaChip ganancia={p.ganancia || 0} margen={margenProd} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CalendarioHeatmap({ dias = [], año, mes }) {
  const [tooltip, setTooltip] = useState(null);
  const primerDia = new Date(año, mes - 1, 1).getDay();
  const diasEnMes = new Date(año, mes, 0).getDate();
  const maxRec    = Math.max(...dias.map((d) => d.totalRecaudado || 0), 1);
  const celdas = [
    ...Array(primerDia).fill(null),
    ...Array.from({ length: diasEnMes }, (_, i) => {
      const info = dias.find((x) => x.dia === i + 1);
      return { dia: i + 1, rec: info?.totalRecaudado || 0, ventas: info?.totalVentas || 0, gan: info?.ganancia || 0 };
    }),
  ];
  return (
    <div className="rv-cal-wrapper">
      <div className="rv-cal-grid">
        {DIAS_SHORT.map((d) => <div key={d} className="rv-cal-hdr">{d}</div>)}
        {celdas.map((c, i) => {
          if (!c) return <div key={`e-${i}`} />;
          const alpha = c.rec > 0 ? clamp((c.rec / maxRec) * 0.8 + 0.12, 0.12, 0.92) : 0;
          const isHot = tooltip?.dia === c.dia;
          return (
            <div key={c.dia} className="rv-cal-cell"
              style={{ background: c.rec > 0 ? `rgba(232,160,32,${alpha})` : "rgba(255,255,255,0.04)", color: alpha > 0.5 ? "#000" : "rgba(255,255,255,0.4)", outline: isHot ? "2px solid #E8A020" : "none" }}
              onMouseEnter={() => setTooltip(c)} onMouseLeave={() => setTooltip(null)}>
              {c.dia}
              {isHot && (
                <div className="rv-cal-tooltip">
                  <strong>Día {c.dia}</strong>
                  <span>{fmt(c.rec)}</span>
                  <span style={{ color: "#2CB67D" }}>Gan: {fmt(c.gan)}</span>
                  <span className="rv-cal-tooltip-sub">{c.ventas} venta{c.ventas !== 1 ? "s" : ""}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="rv-cal-legend">
        <span>Menos</span>
        {[0.12, 0.3, 0.5, 0.7, 0.9].map((o) => <div key={o} className="rv-cal-legend-dot" style={{ background: `rgba(232,160,32,${o})` }} />)}
        <span>Más</span>
      </div>
    </div>
  );
}

function VistaAnual({ data, onSelectMes }) {
  const meses     = data?.meses || [];
  const totRec    = meses.reduce((a, m) => a + (m.totalRecaudado || 0), 0);
  const totVen    = meses.reduce((a, m) => a + (m.totalVentas    || 0), 0);
  const totUds    = meses.reduce((a, m) => a + (m.totalUnidadesVendidas || 0), 0);
  const totCosto  = meses.reduce((a, m) => a + (m.totalCosto     || 0), 0);
  const totGan    = meses.reduce((a, m) => a + (m.gananciaTotal  || 0), 0);
  const maxRec    = Math.max(...meses.map((m) => m.totalRecaudado || 0), 1);
  const ticket    = totVen > 0 ? totRec / totVen : 0;
  const margenAno = totRec > 0 ? (totGan / totRec) * 100 : 0;

  return (
    <>
      <div className="rv-kpis">
        <KPICard label="Total recaudado"   value={fmt(totRec)}   sub={`Año ${data?.año}`}             icon={DollarSign}       color="#E8A020" />
        <KPICard label="Ganancia total"    value={fmt(totGan)}   sub={fmtPct(margenAno) + " margen"}  icon={TrendingUp}       color="#2CB67D" />
        <KPICard label="Costo productos"   value={fmt(totCosto)} sub="Total invertido"                icon={CircleDollarSign} color="#E84040" />
        <KPICard label="Total ventas"      value={fmtN(totVen)}  sub="Transacciones"                  icon={ShoppingCart}     color="#9B6DFF" />
        <KPICard label="Ticket promedio"   value={fmt(ticket)}   sub="Por transacción"                icon={ReceiptText}      color="#38BDF8" />
        <KPICard label="Unidades vendidas" value={fmtN(totUds)}  sub="Productos despachados"          icon={Package}          color="#F97316" />
      </div>

      <div className="rv-seccion">
        <p className="rv-seccion-titulo"><BarChart2 size={12} style={{ display:"inline", marginRight:6, verticalAlign:"middle" }} />Ingresos por mes — clic para ver detalle</p>
        <div className="rv-card">
          <div className="rv-meses-barras">
            {meses.map((m) => (
              <button key={m.mes} className={`rv-mes-btn${m.totalVentas ? " rv-mes-activo" : ""}`} onClick={() => m.totalVentas && onSelectMes(m.mes)} title={m.totalVentas ? `Ver ${m.nombreMes || MESES[m.mes]}` : "Sin datos"}>
                <div className="rv-mes-barra-outer">
                  <div className="rv-mes-barra-doble">
                    <div className="rv-mes-barra-inner" style={{ height: `${pct(m.totalCosto || 0, maxRec)}%`, background: m.totalVentas ? "rgba(232,64,64,0.55)" : "rgba(255,255,255,0.04)" }} />
                    <div className="rv-mes-barra-inner" style={{ height: `${pct(m.gananciaTotal || 0, maxRec)}%`, background: m.totalVentas ? "#2CB67D" : "rgba(255,255,255,0.04)" }} />
                  </div>
                </div>
                <span className="rv-mes-lbl">{MESES_SHORT[m.mes]}</span>
                <span className="rv-mes-ventas">{m.totalVentas || 0}</span>
              </button>
            ))}
          </div>
          <div className="rv-leyenda-barras">
            <span className="rv-ley-item"><span className="rv-ley-dot" style={{ background: "#2CB67D" }} />Ganancia</span>
            <span className="rv-ley-item"><span className="rv-ley-dot" style={{ background: "rgba(232,64,64,0.6)" }} />Costo</span>
          </div>
        </div>
      </div>

      <div className="rv-seccion">
        <p className="rv-seccion-titulo"><Layers size={12} style={{ display:"inline", marginRight:6, verticalAlign:"middle" }} />Detalle por mes</p>
        <div className="rv-card">
          <div className="rv-tabla-anual-head rv-tabla-6col">
            <span>Mes</span><span>Ventas</span><span>Recaudado</span><span>Costo</span><span>Ganancia</span><span style={{ textAlign:"right" }}>Margen</span>
          </div>
          <div className="rv-tabla-anual-divider" />
          {meses.map((m) => {
            const mg = m.totalRecaudado > 0 ? ((m.gananciaTotal || 0) / m.totalRecaudado) * 100 : 0;
            return (
              <div key={m.mes} className={`rv-tabla-anual-row rv-tabla-6col${m.totalVentas ? " rv-tabla-anual-row--activo" : ""}`} onClick={() => m.totalVentas && onSelectMes(m.mes)}>
                <span className="rv-tabla-mes-nombre">{m.nombreMes || MESES[m.mes]}</span>
                <span className="rv-tabla-cell">{fmtN(m.totalVentas)}</span>
                <span className="rv-tabla-cell rv-tabla-cell--accent">{fmt(m.totalRecaudado)}</span>
                <span className="rv-tabla-cell" style={{ color:"#E84040" }}>{fmt(m.totalCosto)}</span>
                <span className="rv-tabla-cell" style={{ color:"#2CB67D", fontWeight:600 }}>{fmt(m.gananciaTotal)}</span>
                <span className="rv-tabla-cell rv-tabla-cell--right">
                  <span className="rv-margen-badge" style={{ background: mg>20?"rgba(44,182,125,0.12)":mg>0?"rgba(232,160,32,0.12)":"rgba(232,64,64,0.12)", color: mg>20?"#2CB67D":mg>0?"#E8A020":"#E84040" }}>{fmtPct(mg)}</span>
                </span>
              </div>
            );
          })}
          <div className="rv-tabla-anual-divider" />
          <div className="rv-tabla-anual-total rv-tabla-6col">
            <span>Total año</span><span>{fmtN(totVen)}</span>
            <span style={{ color:"#E8A020" }}>{fmt(totRec)}</span>
            <span style={{ color:"#E84040" }}>{fmt(totCosto)}</span>
            <span style={{ color:"#2CB67D" }}>{fmt(totGan)}</span>
            <span style={{ textAlign:"right" }}>
              <span className="rv-margen-badge" style={{ background: margenAno>20?"rgba(44,182,125,0.15)":"rgba(232,160,32,0.15)", color: margenAno>20?"#2CB67D":"#E8A020" }}>{fmtPct(margenAno)}</span>
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

function VistaMensual({ reporte: r }) {
  if (!r) return null;

  const empleados = [...(r.porEmpleado         || [])].sort((a,b) => b.totalRecaudado - a.totalRecaudado);
  const productos = [...(r.productosMasVendidos || [])].slice(0, 10);
  const maxEmp    = Math.max(...empleados.map((e) => e.totalRecaudado || 0), 1);
  const totRec    = r.totalRecaudado || 0;
  const ganancia  = r.gananciaTotal  || 0;
  const costo     = r.totalCosto     || 0;
  const margen    = r.margenPromedio || 0;

  const productosConMargenBajo = productos.filter((p) => {
    const m = p.totalRecaudado > 0 ? ((p.ganancia || 0) / p.totalRecaudado) * 100 : 0;
    return m < 20 && p.totalRecaudado > 0;
  }).length;

  const diagnostico = getDiagnostico(margen, productosConMargenBajo);

  return (
    <>
      <div className="rv-kpis">
        <KPICard label="Total recaudado"   value={fmt(totRec)}                    sub={`${r.nombreMes} ${r.año}`}    icon={DollarSign}       color="#E8A020" />
        <KPICard label="Ganancia neta"     value={fmt(ganancia)}                  sub={`Margen ${fmtPct(margen)}`}   icon={TrendingUp}       color="#2CB67D" diagnostico={diagnostico} />
        <KPICard label="Costo productos"   value={fmt(costo)}                     sub="Total invertido"              icon={CircleDollarSign} color="#E84040" />
        <KPICard label="Total ventas"      value={fmtN(r.totalVentas)}            sub="Transacciones"                icon={ShoppingCart}     color="#9B6DFF" />
        <KPICard label="Ticket promedio"   value={fmt(r.ticketPromedio)}          sub="Por transacción"              icon={ReceiptText}      color="#38BDF8" />
        <KPICard label="Unidades vendidas" value={fmtN(r.totalUnidadesVendidas)}  sub="Productos despachados"        icon={Package}          color="#F97316" />
      </div>

      <div className="rv-seccion">
        <p className="rv-seccion-titulo"><Percent size={12} style={{ display:"inline", marginRight:6, verticalAlign:"middle" }} />Desglose financiero del mes</p>
        <div className="rv-card rv-desglose-card">
          <div className="rv-desglose-barra-wrap">
            <div className="rv-desglose-barra">
              <div className="rv-desglose-seg" style={{ width:`${pct(costo,totRec)}%`, background:"#E84040", opacity:0.7 }} />
              <div className="rv-desglose-seg" style={{ width:`${pct(ganancia,totRec)}%`, background:"#2CB67D" }} />
            </div>
          </div>
          <div className="rv-desglose-items">
            <div className="rv-desglose-item"><span className="rv-desglose-dot" style={{ background:"#E8A020" }} /><span className="rv-desglose-lbl">Recaudado</span><span className="rv-desglose-val" style={{ color:"#E8A020" }}>{fmt(totRec)}</span><span className="rv-desglose-pct">100%</span></div>
            <div className="rv-desglose-item"><span className="rv-desglose-dot" style={{ background:"#E84040" }} /><span className="rv-desglose-lbl">Costo</span><span className="rv-desglose-val" style={{ color:"#E84040" }}>{fmt(costo)}</span><span className="rv-desglose-pct">{fmtPct(pct(costo,totRec))}</span></div>
            <div className="rv-desglose-item"><span className="rv-desglose-dot" style={{ background:"#2CB67D" }} /><span className="rv-desglose-lbl">Ganancia</span><span className="rv-desglose-val" style={{ color:"#2CB67D" }}>{fmt(ganancia)}</span><span className="rv-desglose-pct">{fmtPct(margen)}</span></div>
          </div>
        </div>
      </div>

      <div className="rv-dos-col">
        <div className="rv-seccion">
          <p className="rv-seccion-titulo"><Users size={12} style={{ display:"inline", marginRight:6, verticalAlign:"middle" }} />Por cajero</p>
          <div className="rv-card">
            {empleados.length === 0 && <div className="rv-empty">Sin datos de cajeros</div>}
            {empleados.map((e, i) => {
              const margenEmp = e.totalRecaudado > 0 ? ((e.ganancia || 0) / e.totalRecaudado) * 100 : 0;
              return (
                <div key={e.nombre + i} className="rv-empleado-bloque">
                  <BarRow label={e.nombre} value={e.totalRecaudado || 0} maxValue={maxEmp} color={COLORS[i % COLORS.length]} right={`${fmtN(e.totalVentas)} v. · ${fmt(e.ticketPromedio)}`} />
                  <div className="rv-empleado-gan"><GananciaChip ganancia={e.ganancia || 0} margen={margenEmp} /></div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rv-seccion">
          <p className="rv-seccion-titulo"><Award size={12} style={{ display:"inline", marginRight:6, verticalAlign:"middle" }} />Productos más vendidos</p>
          <div className="rv-card"><RankingProductos productos={productos} /></div>
        </div>
      </div>

      <div className="rv-seccion">
        <p className="rv-seccion-titulo"><TrendingUp size={12} style={{ display:"inline", marginRight:6, verticalAlign:"middle" }} />Resumen de pagos</p>
        <div className="rv-card rv-pagos-grid">
          <div className="rv-pago-item"><span className="rv-pago-label">Monto cobrado</span><span className="rv-pago-value" style={{ color:"#E8A020" }}>{fmt(r.totalRecaudado)}</span></div>
          <div className="rv-pago-item"><span className="rv-pago-label">Costo productos</span><span className="rv-pago-value" style={{ color:"#E84040" }}>{fmt(r.totalCosto)}</span></div>
          <div className="rv-pago-item"><span className="rv-pago-label">Ganancia neta</span><span className="rv-pago-value" style={{ color:"#2CB67D" }}>{fmt(r.gananciaTotal)}</span></div>
          <div className="rv-pago-item"><span className="rv-pago-label">Margen</span><span className="rv-pago-value" style={{ color:"#9B6DFF" }}>{fmtPct(r.margenPromedio)}</span></div>
          <div className="rv-pago-item"><span className="rv-pago-label">Monto recibido</span><span className="rv-pago-value" style={{ color:"#38BDF8" }}>{fmt(r.totalMontoPagado)}</span></div>
          <div className="rv-pago-item"><span className="rv-pago-label">Vuelto devuelto</span><span className="rv-pago-value" style={{ color:"#8A8A85" }}>{fmt(r.totalVuelto)}</span></div>
        </div>
      </div>

      <div className="rv-seccion">
        <p className="rv-seccion-titulo"><ReceiptText size={12} style={{ display:"inline", marginRight:6, verticalAlign:"middle" }} />Actividad diaria — {r.nombreMes} {r.año}</p>
        <div className="rv-card"><CalendarioHeatmap dias={r.porDia} año={r.año} mes={r.mes} /></div>
      </div>
    </>
  );
}

export default function ReportesVentas() {
  const añoActual = new Date().getFullYear();
  const [años,        setAños]        = useState([añoActual]);
  const [selectedAño, setSelectedAño] = useState(añoActual);
  const [selectedMes, setSelectedMes] = useState(0);
  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [generando,   setGenerando]   = useState(false);
  const [error,       setError]       = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/anos-disponibles`).then((r) => r.json()).then((d) => { if (d.años?.length) setAños(d.años); }).catch(() => {});
  }, []);

  const cargarDatos = useCallback(async () => {
    setLoading(true); setError(null);
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
    } finally { setLoading(false); }
  }, [selectedAño, selectedMes]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  const handleGenerar = async () => {
    setGenerando(true);
    try {
      if (selectedMes === 0) {
        await fetch(`${API_URL}/generate-year`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ año: selectedAño }) });
      } else {
        await fetch(`${API_URL}/generate`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ año: selectedAño, mes: selectedMes }) });
      }
      await cargarDatos();
    } catch (e) { console.error(e); } finally { setGenerando(false); }
  };

  if (loading && !data) return (
    <div className="rv-loading-screen">
      <div className="rv-loading-spinner" />
      <p className="rv-loading-text">Cargando reportes de ventas…</p>
    </div>
  );

  const esAñoPasado = selectedAño < new Date().getFullYear();

  return (
    <div className="rv-page">
      <div className="rv-header">
        <div className="rv-header-left">
          {selectedMes !== 0 && (
            <button className="rv-btn-back" onClick={() => setSelectedMes(0)}><ChevronLeft size={14} /> Año {selectedAño}</button>
          )}
          <div>
            <div className="rv-header-badge">Ventas</div>
            <h1 className="rv-header-titulo">{selectedMes === 0 ? `Resumen ${selectedAño}` : `${MESES[selectedMes]} ${selectedAño}`}</h1>
          </div>
        </div>
        <div className="rv-controles">
          <select className="rv-select" value={selectedAño} onChange={(e) => { setSelectedAño(parseInt(e.target.value)); setSelectedMes(0); }}>
            {años.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select className="rv-select" value={selectedMes} onChange={(e) => setSelectedMes(parseInt(e.target.value))}>
            <option value={0}>Año completo</option>
            {MESES.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
          <button className="rv-btn-generar" onClick={handleGenerar} disabled={generando || esAñoPasado}>
            <RefreshCw size={13} style={{ animation: generando ? "rv-spin 0.8s linear infinite" : "none" }} />
            {generando ? "Generando…" : "Regenerar"}
          </button>
        </div>
      </div>
      <div className="rv-body">
        {error   && <div className="rv-error">{error}</div>}
        {loading && data && <div className="rv-overlay">Actualizando…</div>}
        {data?.tipo === "anual"   && <VistaAnual   data={data.payload} onSelectMes={(mes) => setSelectedMes(mes)} />}
        {data?.tipo === "mensual" && <VistaMensual reporte={data.payload} />}
      </div>
    </div>
  );
}
