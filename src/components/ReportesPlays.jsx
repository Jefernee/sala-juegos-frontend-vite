import React, { useState, useEffect, useCallback, useRef } from "react";
import { Gamepad2, DollarSign, Clock, TrendingUp, Users, ChevronLeft, ChevronDown, Trophy, Search } from "lucide-react";
import { authFetchJson } from "../utils/authFetch";
import "../styles/Reportesplays.css";

// Todo /api/monthly-reports exige token. Las llamadas pasan por authFetchJson,
// que pone el header Authorization y maneja el 401/403 (login o Ventas).
const API_URL = import.meta.env.VITE_API_URL + "/api/monthly-reports";

const MESES       = ["","Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const MESES_SHORT = ["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const DIAS_SHORT  = ["Do","Lu","Ma","Mi","Ju","Vi","Sá"];
const COLORS      = ["#1e3a8a","#047857","#b45309","#be185d","#1d4ed8","#4338ca","#6b7280"];
const COL_PLAY4   = "#1e3a8a";
const COL_PLAY5   = "#047857";
const COL_PING    = "#b45309";

// Punto como separador de miles (estándar de Costa Rica): ₡1.234.567
const milesPunto = (n) => Math.round(n || 0).toLocaleString("es-CR").replace(/\s/g, ".");
const fmt  = (n) => "₡" + milesPunto(n);
const fmtN = (n) => milesPunto(n);
const fmtH = (mins) => { const h = Math.floor((mins||0)/60); const m = (mins||0)%60; return h > 0 ? `${h}h ${m}m` : `${m}m`; };
const pct  = (a, b) => (b > 0 ? Math.round((a/b)*100) : 0);

// Minutos → "12 h" / "3 h 30 min" / "45 min", con el mismo formato que manda el
// backend en tiempoTotalTexto. Se usa donde llegan minutos crudos (topClientes
// del reporte mensual); en el ranking de clientes el texto ya viene hecho.
const fmtHM = (mins) => {
  const total = Math.max(0, Math.round(mins || 0));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m} min`;
  if (!m) return `${h} h`;
  return `${h} h ${m} min`;
};

const fmtFecha = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("es-CR", {
        day: "2-digit", month: "short", year: "numeric",
        timeZone: "America/Costa_Rica",
      })
    : "—";

const medallaDe = (posicion) => ["🥇", "🥈", "🥉"][posicion - 1] || null;
const vecesTexto = (n) => `${fmtN(n)} ${n === 1 ? "vez" : "veces"}`;

function KPICard({ label, value, sub, icon: Icon, color = "#1e3a8a" }) {
  return (
    <div className="rp-kpi-card">
      <div className="rp-kpi-accent" style={{ background: color }} />
      {Icon && <div className="rp-kpi-icon"><Icon size={22} color={color} /></div>}
      <div className="rp-kpi-label">{label}</div>
      <div className="rp-kpi-value">{value}</div>
      {sub && <div className="rp-kpi-sub">{sub}</div>}
    </div>
  );
}

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
              <div className="rp-bar-fill" style={{ width: `${pct(j.vecesJugado, maxVeces)}%`, background: COLORS[i % COLORS.length] }} />
            </div>
            <span className="rp-juego-veces">{j.vecesJugado}x</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Punto 3: tarjeta "Clientes que más jugaron" ───────────────────────────────
// Pareja visual de "Juegos más jugados": mismo card, misma estructura de fila.
// Son máximo 10 y ya vienen ordenados por sesiones dentro del reporte mensual.
function TopClientes({ clientes = [], onVerTodos }) {
  if (!clientes.length) return (
    <div className="rp-sin-juegos">Sin clientes registrados este mes</div>
  );
  const maxSesiones = clientes[0]?.sesiones || 1;
  return (
    <>
      <div className="rp-juegos-lista">
        {clientes.map((c, i) => (
          <div key={c.cliente} className="rp-juego-row">
            <div className="rp-juego-izq">
              <span className="rp-juego-pos">
                {medallaDe(c.posicion) || <span className="rp-juego-num">{c.posicion}</span>}
              </span>
              <span className="rp-cliente-texto">
                <span className="rp-juego-nombre">{c.cliente}</span>
                <span className="rp-cliente-sub">
                  {fmtHM(c.tiempoTotalMinutos)} · {fmt(c.montoTotal)}
                </span>
              </span>
            </div>
            <div className="rp-juego-der">
              <div className="rp-bar-track" style={{ width: 80 }}>
                <div className="rp-bar-fill" style={{ width: `${pct(c.sesiones, maxSesiones)}%`, background: COLORS[i % COLORS.length] }} />
              </div>
              <span className="rp-juego-veces">{c.sesiones}x</span>
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="rp-ver-todos" onClick={onVerTodos}>
        Ver todos los clientes →
      </button>
    </>
  );
}

// ── Punto 2: ranking de clientes por periodo ──────────────────────────────────
const TIPOS_PERIODO = [
  { tipo: "mes",           label: "Todo el mes" },
  { tipo: "quincena",      label: "Quincena"    },
  { tipo: "semana",        label: "Semana"      },
  { tipo: "personalizado", label: "Fechas"      },
];

const ORDENES = [
  { valor: "sesiones", label: "Más veces"  },
  { valor: "tiempo",   label: "Más tiempo" },
  { valor: "monto",    label: "Más plata"  },
];

function DetalleCliente({ c }) {
  const datos = [
    ["Días distintos",     `${fmtN(c.diasDistintos)} ${c.diasDistintos === 1 ? "día" : "días"}`],
    ["Promedio por visita", `${fmtHM(c.promedioMinutosPorSesion)} · ${fmt(c.promedioMontoPorSesion)}`],
    ["Play 4",             fmt(c.totalPlay4)],
    ["Play 5",             fmt(c.totalPlay5)],
    ["Ping Pong",          fmt(c.totalPingPong)],
    ["Controles extra",    `${fmtN(c.controlesAdicionales)} · ${fmt(c.totalCostosControles)}`],
    ["Primera visita",     fmtFecha(c.primeraVisita)],
    ["Última visita",      fmtFecha(c.ultimaVisita)],
  ];
  return (
    <div className="rp-rank-detalle">
      <div className="rp-rank-datos-grid">
        {datos.map(([etiqueta, valor]) => (
          <div key={etiqueta} className="rp-rank-dato">
            <span className="rp-rank-dato-lbl">{etiqueta}</span>
            <span className="rp-rank-dato-val">{valor}</span>
          </div>
        ))}
      </div>
      {c.juegosFavoritos?.length > 0 && (
        <div className="rp-rank-juegos">
          <span className="rp-rank-dato-lbl">Juegos favoritos</span>
          <div className="rp-rank-chips">
            {c.juegosFavoritos.map((j) => (
              <span key={j.nombre} className="rp-rank-chip-juego">
                {j.nombre} <strong>{j.vecesJugado}x</strong>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RankingClientes({ año, mes }) {
  const [tipo,       setTipo]       = useState("mes");
  const [numero,     setNumero]     = useState(null);
  const [desde,      setDesde]      = useState("");
  const [hasta,      setHasta]      = useState("");
  const [ordenarPor, setOrdenarPor] = useState("sesiones");
  const [buscar,        setBuscar]        = useState("");
  const [buscarAplicado, setBuscarAplicado] = useState("");
  const [data,     setData]     = useState(null);
  // Las opciones se guardan aparte para que los botones no desaparezcan si una
  // consulta falla o mientras carga la siguiente.
  const [opciones, setOpciones] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [abierto,  setAbierto]  = useState(null);

  // Al cambiar de mes se vuelve al periodo por defecto ("Todo el mes").
  useEffect(() => {
    setTipo("mes"); setNumero(null); setDesde(""); setHasta("");
    setBuscar(""); setBuscarAplicado(""); setAbierto(null);
  }, [año, mes]);

  // Debounce del buscador (mismo comportamiento que el de Plays).
  useEffect(() => {
    const t = setTimeout(() => setBuscarAplicado(buscar.trim()), 300);
    return () => clearTimeout(t);
  }, [buscar]);

  const faltanFechas = tipo === "personalizado" && (!desde || !hasta);

  // Al teclear en el buscador pueden quedar dos consultas en vuelo: solo la
  // última pinta resultados.
  const peticionRef = useRef(0);

  const cargar = useCallback(async () => {
    // Con "Fechas" no se consulta hasta tener las dos puestas.
    if (tipo === "personalizado" && (!desde || !hasta)) return;
    const idPeticion = ++peticionRef.current;
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams({ periodo: tipo, ordenarPor });
      if (tipo === "semana"   && numero) p.append("semana", numero);
      if (tipo === "quincena" && numero) p.append("quincena", numero);
      if (tipo === "personalizado") { p.append("desde", desde); p.append("hasta", hasta); }
      if (buscarAplicado) p.append("buscar", buscarAplicado);

      const d = await authFetchJson(`${API_URL}/${año}/${mes}/clientes?${p.toString()}`);
      if (idPeticion !== peticionRef.current) return;
      setData(d);
      if (d?.opciones) setOpciones(d.opciones);
    } catch (e) {
      // Sesión vencida: authFetch ya está redirigiendo, no pintamos error.
      if (e?.esSesion || idPeticion !== peticionRef.current) return;
      // El backend manda los mensajes de error ya escritos en español
      // ("Semana inválida. Febrero 2026 tiene 4 semanas..."): se muestran tal cual.
      setError(e.message || "No se pudo cargar el ranking de clientes.");
      setData(null);
    } finally {
      if (idPeticion === peticionRef.current) setLoading(false);
    }
  }, [año, mes, tipo, numero, desde, hasta, ordenarPor, buscarAplicado]);

  useEffect(() => { cargar(); }, [cargar]);

  const elegirTipo = (nuevoTipo) => {
    setAbierto(null);
    if (nuevoTipo === "semana")        setNumero(opciones?.semanas?.[0]?.numero   ?? 1);
    else if (nuevoTipo === "quincena") setNumero(opciones?.quincenas?.[0]?.numero ?? 1);
    else setNumero(null);
    setTipo(nuevoTipo);
  };

  const volverAlMes = () => { setBuscar(""); elegirTipo("mes"); };

  // Los botones de semana/quincena se dibujan desde `opciones`: si el mes tiene
  // 4 semanas, salen 4 botones. Nunca se calculan acá.
  const subopciones =
    tipo === "semana" ? opciones?.semanas || [] :
    tipo === "quincena" ? opciones?.quincenas || [] : [];

  // Límites de los date pickers: el mes que se está viendo.
  const diaFin = opciones?.mes?.diaFin || new Date(año, mes, 0).getDate();
  const mesPad = String(mes).padStart(2, "0");
  const minFecha = `${año}-${mesPad}-01`;
  const maxFecha = `${año}-${mesPad}-${String(diaFin).padStart(2, "0")}`;

  const clientes = data?.clientes || [];
  const totales  = data?.totales;

  return (
    <div className="rp-seccion" id="rp-ranking-clientes">
      <p className="rp-seccion-titulo">
        <Users size={12} style={{ display: "inline", marginRight: 5, verticalAlign: "middle" }} />
        Quién jugó más
      </p>
      <div className="rp-card">
        {/* Selector de periodo */}
        <div className="rp-chips">
          {TIPOS_PERIODO.map((t) => (
            <button
              key={t.tipo}
              className={`rp-chip${tipo === t.tipo ? " rp-chip--activo" : ""}`}
              onClick={() => elegirTipo(t.tipo)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {subopciones.length > 0 && (
          <div className="rp-chips rp-chips--sub">
            {subopciones.map((o) => (
              <button
                key={o.numero}
                className={`rp-chip rp-chip--num${numero === o.numero ? " rp-chip--activo" : ""}`}
                onClick={() => { setNumero(o.numero); setAbierto(null); }}
                title={o.etiqueta}
              >
                {o.etiquetaCorta}
              </button>
            ))}
          </div>
        )}

        {tipo === "personalizado" && (
          <div className="rp-fechas">
            <label className="rp-fecha-campo">
              <span>Desde</span>
              <input type="date" value={desde} min={minFecha} max={maxFecha}
                onChange={(e) => setDesde(e.target.value)} />
            </label>
            <label className="rp-fecha-campo">
              <span>Hasta</span>
              <input type="date" value={hasta} min={minFecha} max={maxFecha}
                onChange={(e) => setHasta(e.target.value)} />
            </label>
          </div>
        )}

        {/* Qué periodo se está viendo, en palabras */}
        {data?.periodo?.etiqueta && !faltanFechas && (
          <p className="rp-periodo-etiqueta">{data.periodo.etiqueta}</p>
        )}

        {/* Selector de orden */}
        <div className="rp-chips rp-chips--orden">
          {ORDENES.map((o) => (
            <button
              key={o.valor}
              className={`rp-chip rp-chip--orden${ordenarPor === o.valor ? " rp-chip--activo" : ""}`}
              onClick={() => setOrdenarPor(o.valor)}
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* Buscador dentro del ranking */}
        <div className="rp-buscador">
          <Search size={16} className="rp-buscador-icono" />
          <input
            type="search"
            className="rp-buscador-input"
            placeholder="Buscar cliente…"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            aria-label="Buscar cliente en el ranking"
          />
          {buscar && (
            <button className="rp-buscador-limpiar" onClick={() => setBuscar("")} aria-label="Limpiar búsqueda">✕</button>
          )}
        </div>

        {/* Totales del periodo completo (no cambian al buscar: sirven para comparar) */}
        {totales && !faltanFechas && (
          <div className="rp-rank-totales">
            <div className="rp-rank-total">
              <span className="rp-rank-total-val">{fmtN(totales.sesiones)}</span>
              <span className="rp-rank-total-lbl">sesiones</span>
            </div>
            <div className="rp-rank-total">
              <span className="rp-rank-total-val">{totales.tiempoTotalTexto}</span>
              <span className="rp-rank-total-lbl">jugado</span>
            </div>
            <div className="rp-rank-total">
              <span className="rp-rank-total-val">{fmt(totales.montoTotal)}</span>
              <span className="rp-rank-total-lbl">cobrado</span>
            </div>
            <div className="rp-rank-total">
              <span className="rp-rank-total-val">{fmtN(totales.clientesDistintos)}</span>
              <span className="rp-rank-total-lbl">clientes</span>
            </div>
          </div>
        )}

        {faltanFechas && (
          <p className="rp-rank-aviso">Elegí las dos fechas para ver el ranking.</p>
        )}
        {error && !faltanFechas && <div className="rp-error">{error}</div>}
        {loading && !faltanFechas && <div className="rp-loading-overlay">Actualizando...</div>}

        {/* Lista completa: sin paginar y sin recortar */}
        {!faltanFechas && !error && (
          clientes.length === 0 && !loading ? (
            <div className="rp-rank-vacio">
              {buscarAplicado ? (
                <>
                  <p>No hay clientes con «{buscarAplicado}»</p>
                  <button className="rp-chip" onClick={() => setBuscar("")}>✕ Limpiar la búsqueda</button>
                </>
              ) : (
                <>
                  <p>Nadie jugó en este periodo</p>
                  <button className="rp-chip" onClick={volverAlMes}>Ver todo el mes</button>
                </>
              )}
            </div>
          ) : (
            <>
              {buscarAplicado && clientes.length > 0 && (
                <p className="rp-rank-aviso">
                  {fmtN(clientes.length)} de {fmtN(totales?.clientesDistintos || 0)} clientes · el puesto es el del periodo completo
                </p>
              )}
              <div className="rp-rank-lista">
                {clientes.map((c) => {
                  const estaAbierto = abierto === c.cliente;
                  return (
                    <div key={c.cliente} className={`rp-rank-item${c.posicion <= 3 ? " rp-rank-item--podio" : ""}`}>
                      <button
                        className="rp-rank-fila"
                        onClick={() => setAbierto(estaAbierto ? null : c.cliente)}
                        aria-expanded={estaAbierto}
                      >
                        <span className="rp-rank-pos">
                          {medallaDe(c.posicion) || <span className="rp-juego-num">{c.posicion}</span>}
                        </span>
                        <span className="rp-rank-info">
                          <span className="rp-rank-nombre">{c.cliente}</span>
                          <span className="rp-rank-datos">
                            {vecesTexto(c.sesiones)} · {c.tiempoTotalTexto} · {fmt(c.montoTotal)}
                          </span>
                        </span>
                        <ChevronDown size={16} className={`rp-rank-flecha${estaAbierto ? " rp-rank-flecha--abierta" : ""}`} />
                      </button>
                      {estaAbierto && <DetalleCliente c={c} />}
                    </div>
                  );
                })}
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
}

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
            <div key={c.dia} className="rp-cal-cell"
              style={{ background: c.rec > 0 ? `rgba(30,58,138,${alpha})` : "#f3f4f6", color: alpha > 0.5 ? "#fff" : "#6b7280" }}
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
          <div key={o} style={{ width: 11, height: 11, borderRadius: 2, background: `rgba(30,58,138,${o})` }} />
        ))}
        <span>Más</span>
      </div>
    </div>
  );
}

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
        <KPICard label="Total sesiones"   value={fmtN(totSes)}                 sub="Todo el año"        icon={Gamepad2}   color="#047857" />
        <KPICard label="Promedio mensual" value={fmt(totRec / 12)}             sub="Por mes"            icon={TrendingUp} color="#b45309" />
        <KPICard label="Sesiones / mes"   value={fmtN(Math.round(totSes/12))} sub="Promedio"           icon={Users}      color="#1d4ed8" />
      </div>
      <div className="rp-seccion">
        <p className="rp-seccion-titulo">Ingresos mensuales — clic para ver el detalle</p>
        <div className="rp-card">
          <div className="rp-meses-barras">
            {meses.map((m) => (
              <button key={m.mes}
                className={`rp-mes-btn${m.totalSesiones ? " rp-mes-activo" : ""}`}
                onClick={() => m.totalSesiones && onSelectMes(m.mes)}
                title={m.totalSesiones ? `Ver ${m.nombreMes || MESES[m.mes]}` : "Sin datos"}
              >
                <div className="rp-mes-barra-outer">
                  <div className="rp-mes-barra-inner" style={{ height: `${pct(m.totalRecaudado||0, maxRec)}%`, background: m.totalSesiones ? "#1e3a8a" : "#e5e7eb" }} />
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
        <p className="rp-seccion-titulo">Detalle por mes — clic en una fila para ver el detalle</p>
        <div className="rp-card">
          {meses.map((m) => (
            <div
              key={m.mes}
              className={`rp-tipo-row${m.totalSesiones ? " rp-tipo-row--activo" : ""}`}
              onClick={() => m.totalSesiones && onSelectMes(m.mes)}
            >
              <div className="rp-tipo-left" style={{ gap: 10 }}>
                <span style={{ width: 90, flexShrink: 0, fontSize: 13, color: "#374151" }}>
                  {m.nombreMes || MESES[m.mes]}
                </span>
                <div className="rp-bar-track" style={{ flex: 1 }}>
                  <div className="rp-bar-fill" style={{ width: `${pct(m.totalRecaudado||0, maxRec)}%`, background: "#1e3a8a" }} />
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

function VistaMensual({ reporte: r }) {
  if (!r) return null;
  const empleados = [...(r.porEmpleado || [])].sort((a, b) => b.totalRecaudado - a.totalRecaudado);
  const lugares   = [...(r.porLugar   || [])].sort((a, b) => b.totalRecaudado - a.totalRecaudado);
  const juegos    = r.juegosMasJugados || [];
  // Top 10 de clientes: viene dentro del mismo reporte mensual, ya ordenado por
  // sesiones. Puede venir vacío si el mes no tuvo plays.
  const topClientes = r.topClientes || [];
  const maxEmp    = Math.max(...empleados.map((e) => e.totalRecaudado || 0), 1);
  const maxLug    = Math.max(...lugares.map((l)   => l.totalRecaudado || 0), 1);
  const totRec    = r.totalRecaudado || 0;

  // Puente entre el vistazo rápido (tarjeta) y el detalle (ranking de abajo).
  const irAlRanking = () =>
    document.getElementById("rp-ranking-clientes")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <>
      <div className="rp-kpis">
        <KPICard label="Total recaudado"  value={fmt(totRec)}                       sub={`${r.nombreMes} ${r.año}`}                   icon={DollarSign} />
        <KPICard label="Total sesiones"   value={fmtN(r.totalSesiones)}             sub={`${fmtN(r.sesionesCompletadas)} completadas`}  icon={Gamepad2}   color="#047857" />
        <KPICard label="Tiempo jugado"    value={fmtH(r.tiempoTotalPagadoMinutos)}  sub="Tiempo pagado"                               icon={Clock}      color="#b45309" />
        <KPICard label="Controles extra"  value={fmtN(r.totalControlesAdicionales)} sub="Adicionales cobrados"                        icon={TrendingUp} color="#1d4ed8" />
        <KPICard label="Monto controles"  value={fmt(r.totalCostosControles)}       sub="Cobrado por controles extra"                 icon={DollarSign} color="#b45309" />
      </div>
      <div className="rp-dos-col">
        <div className="rp-seccion">
          <p className="rp-seccion-titulo">Por tipo de play</p>
          <div className="rp-card">
            <TipoRow nombre="Play 4"    value={r.totalPlay4    || 0} total={totRec} color={COL_PLAY4} />
            <TipoRow nombre="Play 5"    value={r.totalPlay5    || 0} total={totRec} color={COL_PLAY5} />
            <TipoRow nombre="Ping Pong" value={r.totalPingPong || 0} total={totRec} color={COL_PING}  />
            <div className="rp-estados">
              <div className="rp-estado">
                <div className="rp-estado-val" style={{ color: "#047857" }}>{fmtN(r.sesionesCompletadas)}</div>
                <div className="rp-estado-lbl">Completadas</div>
              </div>
              <div className="rp-estado">
                <div className="rp-estado-val" style={{ color: "#b45309" }}>{fmtN(r.sesionesPendientes)}</div>
                <div className="rp-estado-lbl">Pendientes</div>
              </div>
              {/* "En proceso" se descontinuó: solo se muestra si hay registros
                  viejos con ese estado, para que los totales sigan cuadrando. */}
              {r.sesionesEnProceso > 0 && (
                <div className="rp-estado">
                  <div className="rp-estado-val" style={{ color: "#6b7280" }}>{fmtN(r.sesionesEnProceso)}</div>
                  <div className="rp-estado-lbl">En proceso</div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="rp-seccion">
          <p className="rp-seccion-titulo">Por lugar</p>
          <div className="rp-card">
            {lugares.map((l, i) => (
              <BarRow key={l.lugar} label={l.lugar} value={l.totalRecaudado||0} maxValue={maxLug} color={COLORS[i % COLORS.length]} />
            ))}
          </div>
        </div>
      </div>
      {/* Los dos "top" van juntos: el de juegos y el de clientes son pareja. */}
      <div className="rp-dos-col">
        <div className="rp-seccion">
          <p className="rp-seccion-titulo">
            <Trophy size={12} style={{ display: "inline", marginRight: 5, verticalAlign: "middle" }} />
            Juegos más jugados
          </p>
          <div className="rp-card">
            <JuegosMasJugados juegos={juegos} />
          </div>
        </div>
        <div className="rp-seccion">
          <p className="rp-seccion-titulo">
            <Users size={12} style={{ display: "inline", marginRight: 5, verticalAlign: "middle" }} />
            Clientes que más jugaron
          </p>
          <div className="rp-card">
            <TopClientes clientes={topClientes} onVerTodos={irAlRanking} />
          </div>
        </div>
      </div>
      <div>
        <div className="rp-seccion">
          <p className="rp-seccion-titulo">Por empleado</p>
          <div className="rp-card">
            {empleados.map((e, i) => (
              <div key={e.nombre} className="rp-empleado-bloque">
                <BarRow label={e.nombre} value={e.totalRecaudado||0} maxValue={maxEmp} color={COLORS[i % COLORS.length]} right={`${fmtN(e.totalSesiones)} ses. · ${fmtH(e.tiempoTotalMinutos)}`} />
                <div className="rp-empleado-controles">
                  🎮 {fmtN(e.totalControlesAdicionales || 0)} controles extra · <strong>{fmt(e.totalCostosControles || 0)}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="rp-seccion">
        <p className="rp-seccion-titulo">Actividad diaria — {r.nombreMes} {r.año}</p>
        <div className="rp-card">
          <CalendarioHeatmap dias={r.porDia} periodoInicio={r.periodoInicio} año={r.año} mes={r.mes} />
        </div>
      </div>
      <RankingClientes año={r.año} mes={r.mes} />
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
  const [error,       setError]       = useState(null);

  useEffect(() => {
    authFetchJson(`${API_URL}/anos-disponibles`)
      .then((d) => { if (d.años?.length) setAños(d.años); })
      .catch(() => {});
  }, []);

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (selectedMes === 0) {
        const d = await authFetchJson(`${API_URL}/${selectedAño}`);
        if (!d.ok) throw new Error();
        setData({ tipo: "anual", payload: d });
      } else {
        const d = await authFetchJson(`${API_URL}/${selectedAño}/${selectedMes}`);
        setData({ tipo: "mensual", payload: d.reporte });
      }
    } catch (e) {
      // Sesión vencida o sin permiso: authFetch ya está mandando al login o a
      // Ventas, así que no pintamos el banner de error sobre una pantalla que
      // está por desaparecer.
      if (e?.esSesion) return;
      // El reporte aún no existe para este período (se genera automáticamente al registrar plays)
      setError("No hay datos para este período todavía.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedAño, selectedMes]);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

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

      {/* ===== BARRA DE CONTROLES (sin botón Regenerar) ===== */}
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
          <select
            className="rp-select"
            value={selectedAño}
            onChange={(e) => { setSelectedAño(parseInt(e.target.value)); setSelectedMes(0); }}
          >
            {años.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select
            className="rp-select"
            value={selectedMes}
            onChange={(e) => setSelectedMes(parseInt(e.target.value))}
          >
            <option value={0}>Año completo</option>
            {MESES.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        </div>
      </div>

      {error  && <div className="rp-error">{error}</div>}
      {loading && data && <div className="rp-loading-overlay">Actualizando...</div>}

      {data?.tipo === "anual"   && <VistaAnual   data={data.payload}    onSelectMes={(mes) => setSelectedMes(mes)} />}
      {data?.tipo === "mensual" && <VistaMensual reporte={data.payload} />}
    </div>
  );
}