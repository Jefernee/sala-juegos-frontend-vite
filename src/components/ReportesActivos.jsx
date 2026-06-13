import React, { useState, useEffect, useCallback } from "react";
import {
  Boxes, ShoppingCart, Wrench, CircleDollarSign,
  Printer, Download, Layers, Tag, RefreshCw,
} from "lucide-react";
import { formatPlaca } from "./admin/adminUtils";
import "../styles/ReportesActivos.css";

const API_URL = import.meta.env.VITE_API_URL + "/api/activos-reports";

// Punto como separador de miles (estándar de Costa Rica): ₡1.234.567
const milesPunto = (n) => Math.round(n || 0).toLocaleString("es-CR").replace(/\s/g, ".");
const fmt  = (n) => "₡" + milesPunto(n);
const fmtN = (n) => milesPunto(n);
const pct  = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

// Color por estado del activo (coherente con los badges de Administración)
const COLOR_ESTADO = {
  "En uso": "#047857",
  "En reparación": "#b45309",
  Reparado: "#1d4ed8",
  "Fuera de servicio": "#b91c1c",
  Almacenado: "#6b7280",
};
const COLOR_TIPO = {
  "Nueva Compra": "#047857",
  "Reparación": "#b45309",
};
const colorEstado = (e) => COLOR_ESTADO[e] || "#6b7280";

const fechaCorta = (f) =>
  f
    ? new Date(f).toLocaleDateString("es-CR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "America/Costa_Rica",
      })
    : "—";

function KPICard({ label, value, sub, icon: Icon, color }) {
  return (
    <div className="ra-kpi-card">
      <div className="ra-kpi-accent" style={{ background: color }} />
      {Icon && <div className="ra-kpi-icon"><Icon size={26} color={color} /></div>}
      <div className="ra-kpi-label">{label}</div>
      <div className="ra-kpi-value">{value}</div>
      {sub && <div className="ra-kpi-sub">{sub}</div>}
    </div>
  );
}

// Fila de barra para desgloses (por estado / por tipo)
function BarRow({ label, cantidad, monto, value, maxValue, color }) {
  return (
    <div className="ra-bar-row">
      <span className="ra-bar-dot" style={{ background: color }} />
      <span className="ra-bar-label" title={label}>{label}</span>
      <span className="ra-bar-count">{fmtN(cantidad)}</span>
      <div className="ra-bar-track">
        <div className="ra-bar-fill" style={{ width: `${pct(value, maxValue)}%`, background: color }} />
      </div>
      <span className="ra-bar-val">{fmt(monto)}</span>
    </div>
  );
}

export default function ReportesActivos() {
  const [reporte, setReporte] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(API_URL, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error();
      setReporte(d.reporte);
    } catch {
      setError("No se pudo cargar el reporte de activos.");
      setReporte(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const exportarCSV = () => {
    if (!reporte?.activos?.length) return;
    const cols = [
      ["Placa", (a) => formatPlaca(a)],
      ["Nombre", (a) => a.nombre || ""],
      ["Tipo", (a) => a.tipoRegistro || ""],
      ["Estado", (a) => a.estado || ""],
      ["Costo", (a) => a.costo ?? ""],
      ["Costo reparación", (a) => a.costoReparacion ?? ""],
      ["N° Factura", (a) => a.numeroFactura || ""],
      ["Problema técnico", (a) => a.problemaTecnico || ""],
      ["Reparado por", (a) => a.reparadoPor || ""],
      ["Fecha", (a) => fechaCorta(a.fechaCompraReparacion)],
    ];
    const escapar = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const filas = [
      cols.map((c) => c[0]).join(","),
      ...reporte.activos.map((a) => cols.map((c) => escapar(c[1](a))).join(",")),
    ];
    const blob = new Blob(["﻿" + filas.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "reporte-activos.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading && !reporte) {
    return (
      <div className="ra-loading-screen">
        <div className="ra-loading-spinner" />
        <p className="ra-loading-text">Cargando reporte de activos…</p>
      </div>
    );
  }

  if (error && !reporte) {
    return (
      <div className="ra-page">
        <div className="ra-error">
          {error}
          <button className="ra-btn ra-btn--ghost" onClick={cargar}>
            <RefreshCw size={13} /> Reintentar
          </button>
        </div>
      </div>
    );
  }

  const r = reporte;
  const estados = [...(r.porEstado || [])].sort((a, b) => (b.costoTotal || 0) - (a.costoTotal || 0));
  const tipos   = [...(r.porTipo   || [])].sort((a, b) => (b.montoTotal || 0) - (a.montoTotal || 0));
  const maxEstado = Math.max(...estados.map((e) => e.costoTotal || 0), 1);
  const maxTipo   = Math.max(...tipos.map((t) => t.montoTotal || 0), 1);
  const activos = r.activos || [];

  return (
    <div className="ra-page">
      <div className="ra-header">
        <div className="ra-header-left">
          <div className="ra-header-badge">Activos</div>
          <h1 className="ra-header-titulo">Reporte de Activos</h1>
          {r.generadoEn && (
            <span className="ra-header-fecha">Generado {fechaCorta(r.generadoEn)}</span>
          )}
        </div>
        <div className="ra-controles">
          <button className="ra-btn ra-btn--ghost" onClick={exportarCSV} disabled={!activos.length}>
            <Download size={13} /> CSV
          </button>
          <button className="ra-btn ra-btn--accent" onClick={() => window.print()}>
            <Printer size={13} /> Imprimir
          </button>
        </div>
      </div>

      <div className="ra-body">
        {loading && <div className="ra-overlay">Actualizando…</div>}

        {/* Tarjetas resumen */}
        <div className="ra-kpis">
          <KPICard
            label="Total de activos" value={fmtN(r.totalActivos)}
            sub={`${fmtN(r.totalCompras)} compras · ${fmtN(r.totalReparaciones)} reparaciones`}
            icon={Boxes} color="#4338ca"
          />
          <KPICard
            label="Inversión en compras" value={fmt(r.totalInvertidoCompras)}
            sub="Costo de los productos" icon={ShoppingCart} color="#047857"
          />
          <KPICard
            label="Costo de reparaciones" value={fmt(r.totalCostoReparaciones)}
            sub="Gastado en arreglos" icon={Wrench} color="#b45309"
          />
          <KPICard
            label="Inversión total" value={fmt(r.inversionTotal)}
            sub="Compras + reparaciones" icon={CircleDollarSign} color="#1d4ed8"
          />
        </div>

        <div className="ra-dos-col">
          {/* Desglose por estado */}
          <div className="ra-seccion">
            <p className="ra-seccion-titulo">
              <Layers size={12} /> Por estado
            </p>
            <div className="ra-card">
              {estados.length === 0 && <div className="ra-empty">Sin datos por estado</div>}
              {estados.map((e) => (
                <BarRow
                  key={e.estado} label={e.estado} cantidad={e.cantidad}
                  monto={e.costoTotal} value={e.costoTotal} maxValue={maxEstado}
                  color={colorEstado(e.estado)}
                />
              ))}
            </div>
          </div>

          {/* Desglose por tipo */}
          <div className="ra-seccion">
            <p className="ra-seccion-titulo">
              <Tag size={12} /> Por tipo de registro
            </p>
            <div className="ra-card">
              {tipos.length === 0 && <div className="ra-empty">Sin datos por tipo</div>}
              {tipos.map((t) => (
                <BarRow
                  key={t.tipoRegistro} label={t.tipoRegistro} cantidad={t.cantidad}
                  monto={t.montoTotal} value={t.montoTotal} maxValue={maxTipo}
                  color={COLOR_TIPO[t.tipoRegistro] || "#8A8A85"}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Tabla completa de activos */}
        <div className="ra-seccion">
          <p className="ra-seccion-titulo">
            <Boxes size={12} /> Detalle de activos ({fmtN(activos.length)})
          </p>
          <div className="ra-card ra-tabla-card">
            <div className="ra-tabla-head">
              <span>Placa</span>
              <span>Artículo</span>
              <span>Tipo</span>
              <span>Estado</span>
              <span className="ra-col-num">Costo</span>
              <span className="ra-col-num">Reparación</span>
            </div>
            <div className="ra-tabla-divider" />
            {activos.length === 0 && <div className="ra-empty">No hay activos registrados</div>}
            {activos.map((a, i) => (
              <div key={a.numeroPlaca ?? a.nombre + i} className="ra-tabla-row">
                <span className="ra-placa">{formatPlaca(a)}</span>
                <span className="ra-tabla-nombre" title={a.nombre}>{a.nombre}</span>
                <span>
                  <span
                    className="ra-chip"
                    style={{
                      color: COLOR_TIPO[a.tipoRegistro] || "#8A8A85",
                      borderColor: `${COLOR_TIPO[a.tipoRegistro] || "#8A8A85"}40`,
                      background: `${COLOR_TIPO[a.tipoRegistro] || "#8A8A85"}14`,
                    }}
                  >
                    {a.tipoRegistro === "Reparación" ? "Reparación" : "Compra"}
                  </span>
                </span>
                <span>
                  <span
                    className="ra-chip"
                    style={{
                      color: colorEstado(a.estado),
                      borderColor: `${colorEstado(a.estado)}40`,
                      background: `${colorEstado(a.estado)}14`,
                    }}
                  >
                    {a.estado}
                  </span>
                </span>
                <span className="ra-col-num ra-monto">{fmt(a.costo)}</span>
                <span className="ra-col-num ra-monto-rep">
                  {a.costoReparacion != null ? fmt(a.costoReparacion) : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
