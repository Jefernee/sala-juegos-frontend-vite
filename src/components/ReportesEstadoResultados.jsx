import React, { useState, useEffect, useCallback } from "react";
import {
  TrendingUp, TrendingDown, Wallet, Activity, Scale, CalendarDays,
  ChevronLeft, ChevronRight, Download, Printer, RefreshCw,
} from "lucide-react";
import "../styles/ReportesEstado.css";

const API_URL = import.meta.env.VITE_API_URL + "/api/estado-resultados";

const MESES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const COLORS = ["#1d4ed8", "#047857", "#b45309", "#be185d", "#4338ca", "#0891b2", "#6b7280"];

// Punto como separador de miles (estándar CR). Maneja negativos: -₡5.500
const milesPunto = (n) => Math.round(Math.abs(n || 0)).toLocaleString("es-CR").replace(/\s/g, ".");
const fmt  = (n) => ((n || 0) < 0 ? "-₡" : "₡") + milesPunto(n);
const fmtN = (n) => Math.round(n || 0).toLocaleString("es-CR").replace(/\s/g, ".");
const fmtPct = (n) => `${(Number(n) || 0).toFixed(1)}%`;
const pct  = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
const signClass = (n) => ((n || 0) < 0 ? "er-neg" : "er-pos");

const fmtFechaHora = (f) =>
  f
    ? new Date(f).toLocaleString("es-CR", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit", timeZone: "America/Costa_Rica",
      })
    : "";

const authFetch = (url, opts = {}) => {
  const token = localStorage.getItem("token");
  return fetch(url, {
    ...opts,
    headers: {
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
};

// ── Piezas visuales ─────────────────────────────────────────────────────────
function KPICard({ label, value, sub, icon: Icon, color = "#1d4ed8", valueClass, trend }) {
  return (
    <div className="er-kpi-card">
      <div className="er-kpi-accent" style={{ background: color }} />
      {Icon && <div className="er-kpi-icon"><Icon size={22} color={color} /></div>}
      <div className="er-kpi-label">{label}</div>
      <div className={`er-kpi-value ${valueClass || ""}`}>{value}</div>
      {sub && <div className="er-kpi-sub">{sub}</div>}
      {trend}
    </div>
  );
}

// Tendencia vs el mes anterior. `mejorSubir` define si subir es bueno (ingresos,
// utilidades) o malo (egresos), para colorear en verde/rojo.
function Trend({ actual, anterior, mejorSubir, mesAnterior }) {
  if (anterior == null) return null;
  const diff = (actual || 0) - (anterior || 0);
  if (diff === 0) {
    return <div className="er-trend er-trend--flat">Igual que {mesAnterior}</div>;
  }
  const base = Math.abs(anterior);
  const pctv = base > 0 ? Math.round(Math.abs(diff / base) * 100) : 100;
  const subio = diff > 0;
  const bueno = mejorSubir ? subio : !subio;
  return (
    <div className={`er-trend ${bueno ? "er-trend--bueno" : "er-trend--malo"}`}>
      {subio ? "▲" : "▼"} {pctv}% vs {mesAnterior}
    </div>
  );
}

// Fila de un monto (Ingresos / Egresos). `fuerte` = subtotal/total resaltado.
// `desc` = aclaración formal de qué incluye ese renglón.
function LineaMonto({ label, desc, value, fuerte }) {
  return (
    <div className={`er-linea ${fuerte ? "er-linea--fuerte" : ""}`}>
      <span className="er-linea-info">
        <span className="er-linea-label">{label}</span>
        {desc && <span className="er-linea-desc">{desc}</span>}
      </span>
      <span className="er-linea-val">{fmt(value)}</span>
    </div>
  );
}

// Detalle desglosado de un renglón (ej. servicios por tipo). Va ANIDADO justo
// debajo de su línea, para que se lea como "el detalle de esto" y no se repita.
function Desglose({ items, total, restoLabel = "Otros" }) {
  if (!items?.length) return null;
  // Si el backend truncó la lista (ej. top 15 de ventas), la suma no llega al
  // total: mostramos una fila con la diferencia para que el desglose cuadre.
  const suma = items.reduce((s, it) => s + (Number(it.monto) || 0), 0);
  const resto = Math.round((total || 0) - suma);
  return (
    <div className="er-desglose">
      {items.map((it, i) => (
        <div key={it.tipo} className="er-desglose-row">
          <span className="er-desglose-name">
            <span className="er-dot" style={{ background: COLORS[i % COLORS.length] }} />
            <span className="er-desglose-txt">{it.tipo}</span>
          </span>
          <span className="er-desglose-cifra">
            {fmt(it.monto)} <span className="er-desglose-pct">{pct(it.monto, total)}%</span>
          </span>
        </div>
      ))}
      {resto > 0 && (
        <div className="er-desglose-row">
          <span className="er-desglose-name">
            <span className="er-dot" style={{ background: "#cbd5e1" }} />
            <span className="er-desglose-txt">{restoLabel}</span>
          </span>
          <span className="er-desglose-cifra">
            {fmt(resto)} <span className="er-desglose-pct">{pct(resto, total)}%</span>
          </span>
        </div>
      )}
    </div>
  );
}

// Fila de resultado (utilidad + margen), con color según signo.
// `destacar` resalta la fila (la usamos para la utilidad operativa, el indicador clave).
function UtilidadRow({ label, desc, value, margen, destacar }) {
  return (
    <div className={`er-util-row ${destacar ? "er-util-row--destacar" : ""}`}>
      <div className="er-util-info">
        <span className="er-util-label">{label}</span>
        {desc && <span className="er-util-desc">{desc}</span>}
      </div>
      <div className="er-util-cifras">
        <span className={`er-util-val ${signClass(value)}`}>{fmt(value)}</span>
        <span className={`er-util-margen ${signClass(margen)}`}>{fmtPct(margen)}</span>
      </div>
    </div>
  );
}

// ── Vista de un mes ──────────────────────────────────────────────────────────
function VistaMensual({ reporte: r }) {
  if (!r) return null;
  const ganancias = [...(r.gananciasPorTipo || [])].sort((a, b) => (b.monto || 0) - (a.monto || 0));
  const servicios = [...(r.serviciosPorTipo || [])].sort((a, b) => (b.monto || 0) - (a.monto || 0));
  const comp = r.comparativo;      // totales del mes anterior (si el backend los manda)
  const mesAnt = comp?.nombreMesAnterior;

  return (
    <>
      <div className="er-kpis">
        <KPICard
          label="Total de ingresos" value={fmt(r.totalIngresos)} sub={`${r.nombreMes} ${r.año}`}
          icon={TrendingUp} color="#059669"
          trend={comp && <Trend actual={r.totalIngresos} anterior={comp.totalIngresos} mejorSubir mesAnterior={mesAnt} />}
        />
        <KPICard
          label="Total de egresos" value={fmt(r.totalEgresos)} sub="Gastos operativos + compras de equipo"
          icon={TrendingDown} color="#dc2626"
          trend={comp && <Trend actual={r.totalEgresos} anterior={comp.totalEgresos} mejorSubir={false} mesAnterior={mesAnt} />}
        />
        <KPICard
          label="Utilidad operativa" value={fmt(r.utilidadOperativa)} sub={`Del negocio operando · margen ${fmtPct(r.margenOperativo)}`}
          icon={Activity} color="#2563eb" valueClass={signClass(r.utilidadOperativa)}
          trend={comp && <Trend actual={r.utilidadOperativa} anterior={comp.utilidadOperativa} mejorSubir mesAnterior={mesAnt} />}
        />
        <KPICard
          label="Utilidad neta" value={fmt(r.utilidadNeta)} sub={`Después de compras de equipo · margen ${fmtPct(r.margenNeto)}`}
          icon={Wallet} color={(r.utilidadNeta || 0) < 0 ? "#dc2626" : "#059669"} valueClass={signClass(r.utilidadNeta)}
          trend={comp && <Trend actual={r.utilidadNeta} anterior={comp.utilidadNeta} mejorSubir mesAnterior={mesAnt} />}
        />
      </div>

      <div className="er-dos-col">
        {/* Ingresos (dinero que entró) */}
        <div className="er-seccion">
          <p className="er-seccion-titulo"><TrendingUp size={13} /> Ingresos — dinero que entró</p>
          <div className="er-card">
            <LineaMonto label="🛒 Ventas de productos" desc="Golosinas, bebidas y demás de la tienda" value={r.ingresoVentas} />
            {r.ventasDetalle?.length > 0 && (
              <Desglose
                items={r.ventasDetalle.map((v) => ({
                  tipo: v.cantidad ? `${v.nombre} ×${v.cantidad}` : v.nombre,
                  monto: v.ingreso,
                }))}
                total={r.ingresoVentas}
                restoLabel="Otros productos"
              />
            )}
            <LineaMonto label="🎮 Alquiler de consolas (Plays)" desc="Cobrado por las sesiones de juego" value={r.ingresoPlays} />
            <LineaMonto label="🕹️ Ganancias de máquinas" desc="Futbolín y máquinas de fichas" value={r.ingresoGanancias} />
            <Desglose items={ganancias} total={r.ingresoGanancias} />
            <LineaMonto label="Total de ingresos" value={r.totalIngresos} fuerte />
          </div>
        </div>

        {/* Egresos (dinero que salió) */}
        <div className="er-seccion">
          <p className="er-seccion-titulo"><TrendingDown size={13} /> Egresos — dinero que salió</p>
          <div className="er-card">
            <LineaMonto label="🛒 Costo de la mercadería vendida" desc="Lo que costó comprar lo que se vendió" value={r.costoVentas} />
            <LineaMonto label="🧾 Servicios del mes" desc="Luz, agua, internet, patente, etc." value={r.egresoServicios} />
            <Desglose items={servicios} total={r.egresoServicios} />
            <LineaMonto label="🔧 Reparaciones de equipo" desc="Arreglos registrados este mes" value={r.egresoReparaciones} />
            {r.reparacionesDetalle?.length > 0 && (
              <Desglose
                items={r.reparacionesDetalle.map((x) => ({
                  tipo: x.problemaTecnico ? `${x.activo} · ${x.problemaTecnico}` : x.activo,
                  monto: x.costo,
                }))}
                total={r.egresoReparaciones}
              />
            )}
            <LineaMonto label="Subtotal de gastos operativos" desc="Mercadería + servicios + reparaciones" value={r.egresosOperativos} fuerte />

            {/* La compra de equipo se separa: es inversión de capital, no gasto del día a día */}
            <div className="er-inversion">
              <div className="er-inversion-fila">
                <span className="er-linea-info">
                  <span className="er-linea-label">📦 Compra de equipo (inversión)</span>
                  <span className="er-linea-desc">
                    No es gasto operativo · baja solo el resultado neto, no la utilidad operativa
                  </span>
                </span>
                <span className="er-linea-val">{fmt(r.inversionActivos)}</span>
              </div>
              {r.comprasActivos?.length > 0 && (
                <div className="er-desglose er-desglose--inversion">
                  {r.comprasActivos.map((a, i) => (
                    <div key={a._id || a.numeroPlaca || i} className="er-desglose-row">
                      <span className="er-desglose-name">
                        <span className="er-dot" style={{ background: COLORS[i % COLORS.length] }} />
                        {a.nombre}{a.categoria ? ` · ${a.categoria}` : ""}
                      </span>
                      <span className="er-desglose-cifra">{fmt(a.costo)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <LineaMonto label="Total de egresos" desc="Gastos operativos + compra de equipo" value={r.totalEgresos} fuerte />
          </div>
        </div>
      </div>

      {/* Resultados */}
      <div className="er-seccion">
        <p className="er-seccion-titulo"><Scale size={13} /> Resultados — utilidades del mes</p>
        <div className="er-card">
          <UtilidadRow label="Utilidad bruta" desc="Ingresos − costo de la mercadería vendida" value={r.utilidadBruta} margen={r.margenBruto} />
          <UtilidadRow label="Utilidad operativa" desc="Rentabilidad real del negocio (sin la compra de equipo)" value={r.utilidadOperativa} margen={r.margenOperativo} destacar />
          <UtilidadRow label="Resultado del mes" desc="Después de restar todo, incluida la compra de equipo" value={r.utilidadNeta} margen={r.margenNeto} />
        </div>
      </div>

      {/* Ahorro: informativo, NO afecta ninguna utilidad (es plata que se aparta) */}
      {(r.ahorroDelMes != null || r.ahorroAcumulado != null) && (
        <div className="er-ahorro">
          <span className="er-ahorro-icon">🐷</span>
          <div className="er-ahorro-info">
            <span className="er-ahorro-titulo">Ahorro · informativo (no afecta la utilidad)</span>
            <span className="er-ahorro-desc">
              Apartado en {r.nombreMes}: <strong>{fmt(r.ahorroDelMes || 0)}</strong>
              {r.ahorroAcumulado != null && <> · Total acumulado: <strong>{fmt(r.ahorroAcumulado)}</strong></>}
            </span>
          </div>
        </div>
      )}

      {/* Conteos + última actualización */}
      <div className="er-meta">
        <span className="er-meta-conteos">
          Incluye {fmtN(r.ventasIncluidas)} ventas · {fmtN(r.playsIncluidos)} plays · {fmtN(r.gananciasIncluidas)} ganancias de máquinas ·{" "}
          {fmtN(r.serviciosIncluidos)} servicios · {fmtN(r.reparacionesIncluidas)} reparaciones ·{" "}
          {fmtN(r.comprasActivosIncluidas)} compras de equipo
        </span>
        {r.ultimaActualizacion && <span className="er-meta-fecha">Actualizado {fmtFechaHora(r.ultimaActualizacion)}</span>}
      </div>
    </>
  );
}

// ── Vista de un año ──────────────────────────────────────────────────────────
function VistaAnual({ data, onSelectMes }) {
  const meses  = data?.meses || [];
  const totIng = meses.reduce((a, m) => a + (m.totalIngresos     || 0), 0);
  const totEg  = meses.reduce((a, m) => a + (m.totalEgresos      || 0), 0);
  const totOper = meses.reduce((a, m) => a + (m.utilidadOperativa || 0), 0);
  const totNeta = meses.reduce((a, m) => a + (m.utilidadNeta      || 0), 0);

  return (
    <>
      <div className="er-kpis">
        <KPICard label="Ingresos del año" value={fmt(totIng)} sub={`Acumulado ${data?.año}`} icon={TrendingUp} color="#059669" />
        <KPICard label="Egresos del año" value={fmt(totEg)} sub="Gastos + compras de equipo" icon={TrendingDown} color="#dc2626" />
        <KPICard label="Utilidad operativa" value={fmt(totOper)} sub="Del negocio operando" icon={Activity} color="#2563eb" valueClass={signClass(totOper)} />
        <KPICard label="Utilidad neta" value={fmt(totNeta)} sub="Después de compras de equipo" icon={Wallet} color={totNeta < 0 ? "#dc2626" : "#059669"} valueClass={signClass(totNeta)} />
      </div>

      <div className="er-seccion">
        <p className="er-seccion-titulo"><CalendarDays size={13} /> Detalle por mes</p>
        <p className="er-hint">Tocá un mes con datos para abrir su estado de resultados completo.</p>
        <div className="er-card">
          <div className="er-mes-head">
            <span>Mes</span>
            <span className="er-col-num er-col-sec">Ingresos</span>
            <span className="er-col-num er-col-sec">Egresos</span>
            <span className="er-col-num">Utilidad neta</span>
            <span aria-hidden="true" />
          </div>
          {meses.map((m) => (
            <div
              key={m.mes}
              className={`er-mes-row${m.generado ? " er-mes-row--activo" : ""}`}
              onClick={() => m.generado && onSelectMes(m.mes)}
              onKeyDown={(e) => {
                if (m.generado && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onSelectMes(m.mes); }
              }}
              role={m.generado ? "button" : undefined}
              tabIndex={m.generado ? 0 : undefined}
              aria-label={m.generado ? `Ver ${m.nombreMes || MESES[m.mes]} ${m.año || data?.año}` : undefined}
            >
              <span className="er-mes-nombre">{m.nombreMes || MESES[m.mes]}</span>
              {m.generado ? (
                <>
                  <span className="er-col-num er-col-sec er-pos">{fmt(m.totalIngresos)}</span>
                  <span className="er-col-num er-col-sec er-neg">{fmt(m.totalEgresos)}</span>
                  <span className={`er-col-num ${signClass(m.utilidadNeta)}`}>{fmt(m.utilidadNeta)}</span>
                  <span className="er-mes-chevron"><ChevronRight size={16} /></span>
                </>
              ) : (
                <>
                  <span className="er-mes-sindatos">Sin datos</span>
                  <span aria-hidden="true" />
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function ReportesEstadoResultados() {
  const añoActual = new Date().getFullYear();

  const [años,        setAños]        = useState([añoActual]);
  const [selectedAño, setSelectedAño] = useState(añoActual);
  const [selectedMes, setSelectedMes] = useState(0);
  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [regenerando, setRegenerando] = useState(false);

  useEffect(() => {
    authFetch(`${API_URL}/anos-disponibles`)
      .then((r) => r.json())
      .then((d) => { if (d.años?.length) setAños(d.años); })
      .catch(() => {});
  }, []);

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (selectedMes === 0) {
        const r = await authFetch(`${API_URL}/${selectedAño}`);
        const d = await r.json();
        if (!r.ok || !d.ok) throw new Error();
        setData({ tipo: "anual", payload: d });
      } else {
        const r = await authFetch(`${API_URL}/${selectedAño}/${selectedMes}`);
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.ok) throw new Error(d.mensaje || "");
        setData({ tipo: "mensual", payload: d.reporte });
      }
    } catch (e) {
      setError(
        selectedMes === 0
          ? "No hay datos para este año todavía."
          : e.message || `Aún no hay datos de ${MESES[selectedMes]} ${selectedAño}.`,
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedAño, selectedMes]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  const regenerar = async () => {
    if (regenerando) return;
    setRegenerando(true);
    try {
      const r = await authFetch(`${API_URL}/generar`, {
        method: "POST",
        body: JSON.stringify({ año: selectedAño, mes: selectedMes }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) throw new Error(d.mensaje || "No se pudo generar el reporte.");
      setData({ tipo: "mensual", payload: d.reporte });
      setError(null);
    } catch (e) {
      setError(e.message || "No se pudo generar el reporte.");
    } finally {
      setRegenerando(false);
    }
  };

  const exportarCSV = () => {
    let filas = [];
    let nombre = "estado-resultados";
    if (data?.tipo === "mensual") {
      const r = data.payload;
      nombre = `estado-resultados-${r.nombreMes}-${r.año}`;
      filas = [
        ["Concepto", "Monto"],
        ["Ventas", r.ingresoVentas], ["Plays", r.ingresoPlays], ["Otras ganancias", r.ingresoGanancias],
        ["Total ingresos", r.totalIngresos],
        ["Costo de ventas", r.costoVentas], ["Servicios", r.egresoServicios], ["Reparaciones", r.egresoReparaciones],
        ["Egresos operativos", r.egresosOperativos], ["Inversión en activos", r.inversionActivos],
        ["Total egresos", r.totalEgresos],
        ["Utilidad bruta", r.utilidadBruta], ["Utilidad operativa", r.utilidadOperativa], ["Utilidad neta", r.utilidadNeta],
        ["Margen bruto (%)", r.margenBruto], ["Margen operativo (%)", r.margenOperativo], ["Margen neto (%)", r.margenNeto],
      ];
    } else if (data?.tipo === "anual") {
      nombre = `estado-resultados-${data.payload.año}`;
      filas = [
        ["Mes", "Ingresos", "Egresos", "Utilidad operativa", "Utilidad neta", "Margen neto (%)"],
        ...(data.payload.meses || [])
          .filter((m) => m.generado)
          .map((m) => [m.nombreMes || MESES[m.mes], m.totalIngresos, m.totalEgresos, m.utilidadOperativa, m.utilidadNeta, m.margenNeto]),
      ];
    }
    if (filas.length <= 1) return;
    const escapar = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = filas.map((f) => f.map(escapar).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${nombre}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading && !data) {
    return (
      <div className="reportes-loading-screen-small">
        <div className="reportes-loading-content">
          <div className="reportes-loading-spinner" />
          <p className="reportes-loading-text">Cargando estado de resultados...</p>
        </div>
      </div>
    );
  }

  const puedeExportar = !!data;

  return (
    <div className="reportes-estado-contenido">
      {/* Controles */}
      <div className="er-controles">
        <div className="er-controles-izq">
          {selectedMes !== 0 && (
            <button className="er-btn-volver" onClick={() => setSelectedMes(0)}>
              <ChevronLeft size={14} />
              Año {selectedAño}
            </button>
          )}
          <span className="er-titulo-periodo">
            {selectedMes === 0 ? `Resumen ${selectedAño}` : `${MESES[selectedMes]} ${selectedAño}`}
          </span>
        </div>
        <div className="er-controles-der">
          <select
            className="er-select"
            value={selectedAño}
            onChange={(e) => { setSelectedAño(parseInt(e.target.value)); setSelectedMes(0); }}
          >
            {años.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select
            className="er-select"
            value={selectedMes}
            onChange={(e) => setSelectedMes(parseInt(e.target.value))}
          >
            <option value={0}>Año completo</option>
            {MESES.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          <button className="er-btn" onClick={exportarCSV} disabled={!puedeExportar}>
            <Download size={13} /> CSV
          </button>
          <button className="er-btn er-btn--accent" onClick={() => window.print()} disabled={!puedeExportar}>
            <Printer size={13} /> Imprimir
          </button>
        </div>
      </div>

      {error && (
        <div className="er-error">
          <span>{error}</span>
          {selectedMes !== 0 && selectedAño >= añoActual && (
            <button className="er-btn" onClick={regenerar} disabled={regenerando}>
              <RefreshCw size={13} /> {regenerando ? "Generando..." : "Regenerar"}
            </button>
          )}
        </div>
      )}
      {loading && data && <div className="er-loading-overlay">Actualizando...</div>}

      {data?.tipo === "anual"   && <VistaAnual   data={data.payload}    onSelectMes={(mes) => setSelectedMes(mes)} />}
      {data?.tipo === "mensual" && <VistaMensual reporte={data.payload} />}
    </div>
  );
}
