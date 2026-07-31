// Reporte anual de Mis Finanzas Personales.
//
// Es una vista de SOLO LECTURA: no hay botón de "generar" ni cálculos acá — el
// backend manda el año entero armado (`GET /resumen-anual?anio=`) y este archivo
// solo lo pinta. Los promedios, porcentajes y la tasa de ahorro vienen ya
// calculados (los promedios son sobre los meses CON movimiento, no entre 12),
// así que nada se recalcula ni se reordena.
//
// Orden de la pantalla: totales del año → recorrido del saldo → barras por mes
// → tabla mes por mes → desglose por categoría → destacados → comparativo con
// el año anterior → mensajes del año.
import { useState, useEffect, useCallback, Fragment } from "react";
import { getAxios, formatCRC, MESES } from "./adminUtils";
import { FIN_BASE as BASE, formatCRCsigned, formatPct, PALETA, iconoCat } from "./finanzasComunes";
import { ErrorRecarga, EstadoVacio, Cargando } from "./Comunes";

// Las tres series del gráfico y de la tabla, con los mismos colores que usa el
// resto del módulo (verde ingresos, rojo gastos, ámbar ahorro).
const SERIES = [
  { key: "totalIngresos", label: "Ingresos", color: "#34d399" },
  { key: "totalGastos", label: "Gastos", color: "#f87171" },
  { key: "totalAhorro", label: "Ahorro", color: "#fbbf24" },
];

// Años disponibles cacheados en memoria: cambian solo cuando se registra un
// movimiento en un año nuevo, así que no vale repetir la llamada al volver.
let aniosCache = null;

// ─── GRÁFICO DE BARRAS POR MES (SVG puro, sin dependencias) ──────────────────
// 12 grupos de 3 barras. Los meses sin registrar NO se dibujan como barras en
// cero: salen atenuados con un "—" para que se lea "no hay datos" y no
// "gastaste ₡0".
const BarrasAnuales = ({ meses }) => {
  const filas = meses || [];
  const max = filas.reduce(
    (m, f) => Math.max(m, ...SERIES.map((s) => Number(f[s.key]) || 0)),
    0,
  );

  const W = 760;
  const H = 250;
  const padTop = 14;
  const padBottom = 38;
  const areaH = H - padTop - padBottom;
  const base = padTop + areaH;
  const slot = W / 12;
  const gap = 3;
  const barW = Math.min(22, (slot * 0.68 - gap * (SERIES.length - 1)) / SERIES.length);
  const grupoW = barW * SERIES.length + gap * (SERIES.length - 1);

  const altura = (valor) => {
    const v = Number(valor) || 0;
    if (v <= 0 || max <= 0) return 0;
    return Math.max(2, (v / max) * areaH);   // mínimo 2px para que se vea
  };

  return (
    <div className="fin-anual-chart">
      <div className="fin-anual-chart__head">
        <p className="fin-desglose__titulo mb-0">📊 Ingresos, gastos y ahorro por mes</p>
        {max > 0 && <span className="fin-anual-chart__escala">escala: hasta {formatCRC(max)}</span>}
      </div>

      <div className="fin-anual-chart__scroll">
        <svg
          className="fin-anual-chart__svg"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="Ingresos, gastos y ahorro de cada mes del año"
        >
          {/* Guías: la mitad y el techo de la escala */}
          {[0.5, 1].map((f) => (
            <line
              key={f}
              x1={0}
              x2={W}
              y1={base - areaH * f}
              y2={base - areaH * f}
              stroke="rgba(255,255,255,0.06)"
              strokeDasharray="4 6"
            />
          ))}
          {/* Línea base */}
          <line x1={0} x2={W} y1={base} y2={base} stroke="rgba(255,255,255,0.14)" />

          {filas.map((f, i) => {
            const centro = slot * i + slot / 2;
            const inicio = centro - grupoW / 2;
            const nombre = (f.nombreMes || MESES[(f.mes || i + 1) - 1] || "").slice(0, 3);
            const sinDatos = f.registrado === false;

            return (
              <g key={f.mes ?? i}>
                {sinDatos ? (
                  <text x={centro} y={base - 8} textAnchor="middle" className="fin-anual-chart__sin">—</text>
                ) : (
                  SERIES.map((s, j) => {
                    const h = altura(f[s.key]);
                    if (h === 0) return null;
                    return (
                      <rect
                        key={s.key}
                        x={inicio + j * (barW + gap)}
                        y={base - h}
                        width={barW}
                        height={h}
                        rx={2}
                        fill={s.color}
                      >
                        <title>{`${f.nombreMes || nombre} · ${s.label}: ${formatCRC(f[s.key])}`}</title>
                      </rect>
                    );
                  })
                )}
                <text
                  x={centro}
                  y={H - 18}
                  textAnchor="middle"
                  className={`fin-anual-chart__mes ${sinDatos ? "fin-anual-chart__mes--sin" : ""}`}
                >
                  {nombre}
                </text>
                {f.aperturaAplicada && (
                  <text x={centro} y={H - 5} textAnchor="middle" className="fin-anual-chart__estrella">⭐</text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="fin-donut-leyenda fin-anual-chart__leyenda">
        {SERIES.map((s) => (
          <span key={s.key} className="fin-donut-leyenda__item">
            <span className="fin-cat__dot" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
        <span className="fin-donut-leyenda__item fin-anual-chart__nota">— sin movimientos registrados</span>
      </div>
    </div>
  );
};

// ─── DESGLOSE ANUAL POR CATEGORÍA ────────────────────────────────────────────
// Usa el `porcentaje` que manda el backend (no se recalcula). `gasto` ya viene
// sin las categorías de ahorro: son tres bloques independientes y no se mezclan.
const DesgloseAnualBloque = ({ titulo, icono, items, colorClase, tipo }) => {
  const filas = items || [];
  return (
    <div className="fin-desglose">
      <p className="fin-desglose__titulo">{icono} {titulo}</p>
      {filas.length === 0 ? (
        <p className="fin-desglose__vacio">Sin movimientos este año</p>
      ) : (
        <div className="fin-desglose__lista">
          {filas.map((it, i) => (
            <div key={it.categoria} className="fin-cat">
              <div className="fin-cat__head">
                <span className="fin-cat__nombre">
                  <span className="fin-cat__dot" style={{ background: PALETA[i % PALETA.length] }} />
                  {iconoCat(it.categoria, tipo)} {it.categoria}
                  <span className="fin-cat__cantidad">
                    ({it.cantidad} {it.cantidad === 1 ? "mov." : "movs."}) · {formatPct(it.porcentaje)}
                  </span>
                </span>
                <span className={`fin-cat__monto fin-cat__monto--${colorClase}`}>{formatCRC(it.total)}</span>
              </div>
              <div className="fin-cat__barra">
                <span
                  className={`fin-cat__barra-fill fin-cat__barra-fill--${colorClase}`}
                  style={{ width: `${Math.min(100, Number(it.porcentaje) || 0)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── TARJETITA DE DESTACADO ──────────────────────────────────────────────────
const Destacado = ({ icono, label, titulo, monto, pie, clase = "" }) => (
  <div className={`fin-destacado ${clase}`}>
    <span className="fin-destacado__label">{icono} {label}</span>
    <strong className="fin-destacado__titulo">{titulo}</strong>
    <span className="fin-destacado__monto">{monto}</span>
    {pie && <span className="fin-destacado__pie">{pie}</span>}
  </div>
);

// ─── FILA DEL COMPARATIVO CON EL AÑO ANTERIOR ────────────────────────────────
// `variacion` viene del backend en % (null si no hay base para comparar).
// Subir ingresos o ahorro es bueno; subir gastos es malo: el color cambia según
// el concepto, no según el signo.
const ComparativoFila = ({ label, previo, actual, variacion, subirEsBueno }) => {
  const v = variacion;
  const hayVar = v != null && Number.isFinite(Number(v));
  const num = Number(v) || 0;
  const clase = !hayVar || num === 0
    ? "neutro"
    : (num > 0) === subirEsBueno ? "verde" : "rojo";

  return (
    <div className="fin-comparativo__fila">
      <span className="fin-comparativo__label">{label}</span>
      {/* con signo: el ahorro neto puede ser negativo si se sacó más de lo que se apartó */}
      <span className="fin-comparativo__previo">{formatCRCsigned(previo)}</span>
      <span className="fin-comparativo__flecha">→</span>
      <span className="fin-comparativo__actual">{formatCRCsigned(actual)}</span>
      <span className={`fin-comparativo__var fin-comparativo__var--${clase}`}>
        {hayVar ? `${num > 0 ? "▲" : num < 0 ? "▼" : "="} ${formatPct(Math.abs(num))}` : "—"}
      </span>
    </div>
  );
};

// ─── PANTALLA DEL REPORTE ANUAL ──────────────────────────────────────────────
const FinanzasReporteAnual = ({ anioInicial, getAuthHeaders, manejarError, onVolver }) => {
  const anioActual = new Date().getFullYear();
  const [anio, setAnio] = useState(anioInicial || anioActual);
  const [anios, setAnios] = useState(aniosCache || []);
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  // Años con datos para el selector (vienen ordenados del más nuevo al más
  // viejo e incluyen el actual). Si falla, se cae al año que se está viendo.
  useEffect(() => {
    if (aniosCache) return;
    let vivo = true;
    (async () => {
      try {
        const axios = await getAxios();
        const res = await axios.get(`${BASE}/anios-disponibles`, getAuthHeaders());
        const lista = Array.isArray(res.data?.anios) ? res.data.anios : [];
        aniosCache = lista.length ? lista : [anioActual];
        if (vivo) setAnios(aniosCache);
      } catch (err) {
        console.error("[FinanzasPersonales] No se pudieron cargar los años:", err);
        if (vivo) setAnios([anio]);
      }
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getAuthHeaders]);

  const fetchReporte = useCallback(async () => {
    setCargando(true);
    setError(false);
    try {
      const axios = await getAxios();
      const res = await axios.get(`${BASE}/resumen-anual?anio=${anio}`, getAuthHeaders());
      setData(res.data || null);
    } catch (err) {
      setError(true);
      manejarError(err);
    } finally {
      setCargando(false);
    }
  }, [anio, getAuthHeaders, manejarError]);

  useEffect(() => { fetchReporte(); }, [fetchReporte]);

  const t = data?.totales || {};
  const meses = data?.meses || [];
  const apertura = data?.apertura || null;
  const prom = data?.promedios || {};
  const dest = data?.destacados || {};
  const comp = data?.comparativo || null;
  const mensajes = Array.isArray(data?.mensajes) ? data.mensajes : [];
  const sinDatos = !cargando && !error && (t.movimientos || 0) === 0;
  const nombreCorte = apertura
    ? apertura.nombreMesCorte || MESES[(apertura.mesCorte || 1) - 1]
    : "";

  // ¿Hubo retiros del ahorro este año? De eso dependen la columna extra de la
  // tabla, el bloque del desglose, la tarjeta de destacados y la tasa neta vs
  // bruta: sin retiros nada de eso aparece y la pantalla queda como antes.
  const huboRetiros = (t.totalRetiroAhorro || 0) > 0;

  // Los cuatro términos del recorrido del saldo los manda armados el backend
  // (`recorridoSaldo`) porque el retiro va como término APARTE del balance:
  //   saldoInicialAnio + aperturaDisponible + balance + retiroAhorro = saldoFinalAnio
  // Si no viniera (backend viejo), se rearma con los campos sueltos.
  const rec = data?.recorridoSaldo || {
    saldoInicialAnio: data?.saldoInicialAnio,
    aperturaDisponible: apertura?.montoDisponible || 0,
    balance: t.balance,
    retiroAhorro: t.totalRetiroAhorro || 0,
    saldoFinalAnio: data?.saldoFinalAnio,
  };

  // Los meses con movimiento son la base de los promedios que manda el backend:
  // se aclara al lado para que no parezca un promedio entre 12.
  const pieProm = (valor) =>
    prom.mesesConMovimiento
      ? `promedio ${formatCRC(valor)} en ${prom.mesesConMovimiento} ${prom.mesesConMovimiento === 1 ? "mes" : "meses"} con movimiento`
      : null;

  return (
    <div className="fade-in fin-ancho">
      {/* Cabecera: volver + selector de año */}
      <div className="fin-anual-head mb-3">
        <button className="admin-btn-ghost" onClick={onVolver}>← Volver al mes</button>
        <h5 className="fin-anual-titulo">📅 Reporte del año</h5>
        <div className="fin-anual-anios">
          {(anios.length ? anios : [anio]).map((a) => (
            <button
              key={a}
              className={`fin-anual-anio ${a === anio ? "fin-anual-anio--activo" : ""}`}
              onClick={() => setAnio(a)}
              disabled={cargando && a !== anio}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <ErrorRecarga onReintentar={fetchReporte} mensaje={`No se pudo cargar el reporte de ${anio}`} />
      ) : cargando ? (
        <Cargando />
      ) : (
        <>
          {/* El año todavía no cerró: los totales son parciales */}
          {data?.enCurso && (
            <div className="fin-aviso fin-aviso--curso mb-3">
              ⏳ <strong>{anio} va en curso</strong> — los totales son de lo que llevás del año,
              no de un año completo.
            </div>
          )}

          {/* Mensajes inteligentes del año. Vienen ordenados y recortados por el
              backend (máximo 6): se pintan tal cual, sin reordenar. Con el año
              vacío el backend manda un solo mensaje `info` explicándolo, así que
              esta lista va antes del estado vacío. */}
          {mensajes.length > 0 && (
            <div className="fin-recom-panel mb-4">
              <p className="fin-recom-titulo">🧠 Resumen inteligente de {anio}</p>
              <div className="fin-recom-lista">
                {mensajes.map((m, i) => (
                  <div key={i} className={`fin-recom fin-recom--${m.nivel || "info"}`}>
                    {m.icono && <span className="fin-recom__icono">{m.icono}</span>}
                    <span className="fin-recom__msg">{m.mensaje}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {sinDatos ? (
            <EstadoVacio icono="📭" mensaje={`No hay movimientos registrados en ${anio}`} />
          ) : (
            <>
              {/* Totales del año */}
              <div className="fin-anual-kpis mb-3">
                <div className="fin-kpi fin-kpi--verde">
                  <span className="fin-kpi__label">📈 Ingresos del año</span>
                  <span className="fin-kpi__valor">{formatCRC(t.totalIngresos)}</span>
                  {pieProm(prom.ingresos) && <span className="fin-kpi__pie">{pieProm(prom.ingresos)}</span>}
                </div>
                <div className="fin-kpi fin-kpi--rojo">
                  <span className="fin-kpi__label">📉 Gastos del año</span>
                  <span className="fin-kpi__valor">{formatCRC(t.totalGastos)}</span>
                  {pieProm(prom.gastos) && <span className="fin-kpi__pie">{pieProm(prom.gastos)}</span>}
                </div>
                {/* "Apartado en <año>", no "Ahorro del año": esta tarjeta es
                    solo lo que se apartó DURANTE el año, y confundía con el
                    acumulado (que incluye el saldo de apertura y los años
                    anteriores). Por eso el acumulado va en la línea de abajo.
                    `tasaAhorro` es la NETA (apartado − retirado) y puede ser
                    negativa; `tasaAhorroBruta` mide el hábito de apartar. Con
                    años sin retiros las dos son iguales y se muestra una sola. */}
                <div className="fin-kpi fin-kpi--ahorro">
                  <span className="fin-kpi__label">🐷 Apartado en {anio}</span>
                  <span className="fin-kpi__valor">{formatCRC(t.totalAhorro)}</span>
                  <span className="fin-kpi__pie">
                    tasa de ahorro{" "}
                    <strong className={`fin-tasa fin-tasa--${(t.tasaAhorro || 0) < 0 ? "rojo" : "verde"}`}>
                      {formatPct(t.tasaAhorro)}
                    </strong>
                    {huboRetiros && ` (neta) · apartado sobre ingresos ${formatPct(t.tasaAhorroBruta)}`}
                  </span>
                  {huboRetiros && (
                    <span className="fin-kpi__pie">
                      sacaste {formatCRC(t.totalRetiroAhorro)} del ahorro · neto{" "}
                      {formatCRCsigned(t.ahorroNeto)}
                    </span>
                  )}
                  <span className="fin-kpi__pie">
                    acumulado total {formatCRC(data?.ahorroFinalAnio)}
                  </span>
                </div>
                <div className={`fin-kpi fin-kpi--balance fin-kpi--${(t.balance || 0) >= 0 ? "verde" : "rojo"}`}>
                  <span className="fin-kpi__label">⚖️ Balance del año</span>
                  <span className="fin-kpi__valor">{formatCRCsigned(t.balance)}</span>
                  <span className="fin-kpi__pie">
                    ingresos − egresos ({formatCRC(t.totalEgresos)} con ahorro) · {t.movimientos || 0}{" "}
                    {t.movimientos === 1 ? "movimiento" : "movimientos"}
                    {huboRetiros && ` · no incluye los ${formatCRC(t.totalRetiroAhorro)} sacados del ahorro`}
                  </span>
                </div>
              </div>

              {/* Recorrido del saldo: la fila que hace cuadrar los números.
                  saldoInicial + apertura disponible + balance + retiro = saldoFinal */}
              <div className="fin-resumen mb-4">
                <div className="fin-resumen__fila">
                  <span className="fin-resumen__label">💼 Saldo al empezar {anio}</span>
                  <span className="fin-resumen__monto fin-resumen__monto--neutro">
                    {formatCRCsigned(rec.saldoInicialAnio)}
                  </span>
                </div>
                {/* Solo si la apertura aportó plata A MANO. Si únicamente tenía
                    ahorro (montoDisponible = 0), esta fila sería un ₡0 que no
                    suma nada al recorrido —y encima confunde, porque el
                    subtítulo habla de millones apartados—. En ese caso el monto
                    del ahorro de apertura ya se ve en "Ahorro acumulado al
                    cierre" y en la etiqueta ⭐ de la tabla. */}
                {apertura && (rec.aperturaDisponible || 0) !== 0 && (
                  <div className="fin-resumen__fila">
                    <span className="fin-resumen__label">
                      ⭐ Saldo de apertura ({nombreCorte})
                      <small className="fin-resumen__sublabel">
                        {formatCRC(apertura.montoAhorro)} apartados en ahorro (no entran al saldo)
                      </small>
                    </span>
                    <span className="fin-resumen__monto fin-resumen__monto--azul">
                      {formatCRCsigned(rec.aperturaDisponible)}
                    </span>
                  </div>
                )}
                <div className="fin-resumen__fila">
                  <span className="fin-resumen__label">
                    ⚖️ Balance del año
                    <small className="fin-resumen__sublabel">
                      ingresos − egresos, sin contar los retiros del ahorro
                    </small>
                  </span>
                  <span className={`fin-resumen__monto fin-resumen__monto--${(rec.balance || 0) >= 0 ? "verde" : "rojo"}`}>
                    {formatCRCsigned(rec.balance)}
                  </span>
                </div>
                {(rec.retiroAhorro || 0) > 0 && (
                  <div className="fin-resumen__fila">
                    <span className="fin-resumen__label">
                      🏧 Sacado del ahorro
                      <small className="fin-resumen__sublabel">
                        plata que solo cambió de bolsillo: salió del ahorro y quedó a mano
                      </small>
                    </span>
                    <span className="fin-resumen__monto fin-resumen__monto--azul">
                      {formatCRC(rec.retiroAhorro)}
                    </span>
                  </div>
                )}
                <div className="fin-resumen__fila fin-resumen__fila--total">
                  <span className="fin-resumen__label">🏁 Saldo al cerrar {anio}</span>
                  <span className={`fin-resumen__monto fin-resumen__monto--${(rec.saldoFinalAnio || 0) >= 0 ? "verde" : "rojo"}`}>
                    {formatCRCsigned(rec.saldoFinalAnio)}
                  </span>
                </div>
                <div className="fin-resumen__fila fin-resumen__fila--acumulado">
                  <span className="fin-resumen__label">
                    🏦 Ahorro acumulado al cierre
                    {/* Se desglosa de dónde sale el número: si el saldo de
                        apertura cae en este año, es la parte que explica el
                        salto (y por qué no coincide con lo apartado en el año). */}
                    <small className="fin-resumen__sublabel">
                      {apertura
                        ? `${formatCRC(apertura.montoAhorro)} del saldo de apertura (${nombreCorte}) + ${formatCRC(t.totalAhorro)} apartados en ${anio}`
                        : `arrancó el año en ${formatCRC(data?.ahorroInicioAnio)} + ${formatCRC(t.totalAhorro)} apartados en ${anio}`}
                      {huboRetiros && ` − ${formatCRC(t.totalRetiroAhorro)} que sacaste`}
                    </small>
                    <small className="fin-resumen__sublabel">
                      plata apartada, no es saldo disponible
                    </small>
                  </span>
                  <span className="fin-resumen__valor-stack">
                    <span className="fin-resumen__monto fin-resumen__monto--ahorro">
                      {formatCRC(data?.ahorroFinalAnio)}
                    </span>
                    <small className="fin-resumen__submonto">
                      Patrimonio {formatCRCsigned(data?.patrimonioFinal)} · total con lo que tenés a mano
                    </small>
                  </span>
                </div>
              </div>

              {/* Barras por mes */}
              <div className="fin-anual-panel mb-4">
                <BarrasAnuales meses={meses} />
              </div>

              {/* Tabla mes por mes */}
              <div className="fin-anual-panel mb-4">
                <p className="fin-desglose__titulo">🗓️ Mes por mes</p>
                <div className="fin-anual-tabla-scroll">
                  {/* La columna "Sacado" solo aparece si el año tuvo retiros:
                      así los años normales no cargan con una columna de ceros. */}
                  <div className={`fin-anual-tabla ${huboRetiros ? "fin-anual-tabla--retiro" : ""}`}>
                    <div className="fin-anual-tabla__head">
                      <span>Mes</span>
                      <span>Ingresos</span>
                      <span>Gastos</span>
                      <span>Ahorro</span>
                      {huboRetiros && <span>Sacado</span>}
                      <span>Balance</span>
                      <span>Saldo final</span>
                    </div>
                    {meses.map((m, i) => {
                      const registrado = m.registrado !== false;
                      const enRojo = registrado && (m.balanceMes || 0) < 0;
                      return (
                        <Fragment key={m.mes ?? i}>
                          {/* De acá salió el salto del ahorro acumulado */}
                          {m.aperturaAplicada && apertura && (
                            <div className="fin-anual-apertura">
                              ⭐ Saldo de apertura ({nombreCorte}): {formatCRC(apertura.montoAhorro)} apartados
                              {(apertura.montoDisponible || 0) > 0 &&
                                ` · ${formatCRC(apertura.montoDisponible)} a mano`}
                            </div>
                          )}
                          <div
                            className={`fin-anual-fila ${!registrado ? "fin-anual-fila--sin" : ""} ${enRojo ? "fin-anual-fila--rojo" : ""}`}
                          >
                            <span className="fin-anual-fila__mes">
                              {m.nombreMes || MESES[(m.mes || i + 1) - 1]}
                            </span>
                            {registrado ? (
                              <>
                                <span className="fin-anual-fila__monto fin-anual-fila__monto--verde">
                                  {formatCRC(m.totalIngresos)}
                                </span>
                                <span className="fin-anual-fila__monto fin-anual-fila__monto--rojo">
                                  {formatCRC(m.totalGastos)}
                                </span>
                                <span className="fin-anual-fila__monto fin-anual-fila__monto--ahorro">
                                  {formatCRC(m.totalAhorro)}
                                </span>
                                {huboRetiros && (
                                  <span className="fin-anual-fila__monto fin-anual-fila__monto--azul">
                                    {(m.totalRetiroAhorro || 0) > 0 ? formatCRC(m.totalRetiroAhorro) : "—"}
                                  </span>
                                )}
                                <span
                                  className={`fin-anual-fila__monto fin-anual-fila__monto--${(m.balanceMes || 0) >= 0 ? "verde" : "rojo"}`}
                                >
                                  {formatCRCsigned(m.balanceMes)}
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="fin-anual-fila__monto">—</span>
                                <span className="fin-anual-fila__monto">—</span>
                                <span className="fin-anual-fila__monto">—</span>
                                {huboRetiros && <span className="fin-anual-fila__monto">—</span>}
                                <span className="fin-anual-fila__monto">—</span>
                              </>
                            )}
                            <span className="fin-anual-fila__monto fin-anual-fila__monto--saldo">
                              {formatCRCsigned(m.saldoFinal)}
                            </span>
                          </div>
                        </Fragment>
                      );
                    })}
                  </div>
                </div>
                <p className="fin-anual-nota">
                  Los meses sin registrar salen con "—": no es que hayas gastado ₡0, es que no hay
                  movimientos. El saldo final se arrastra igual de un mes al otro.
                </p>
              </div>

              {/* Desglose por categoría: bloques aparte (el ahorro no es gasto, y
                  el retiro tampoco es un ingreso). `desglose.retiro` ya viene
                  separado: no se filtran las categorías "Ahorro*" ahí. */}
              <div className={`fin-desglose-cols fin-anual-desglose ${huboRetiros ? "fin-anual-desglose--4" : ""} mb-4`}>
                <DesgloseAnualBloque
                  titulo={`Ingresos de ${anio}`}
                  icono="📈"
                  items={data?.desglose?.ingreso}
                  colorClase="verde"
                  tipo="ingreso"
                />
                <DesgloseAnualBloque
                  titulo={`Gastos de ${anio}`}
                  icono="📉"
                  items={data?.desglose?.gasto}
                  colorClase="rojo"
                  tipo="egreso"
                />
                <DesgloseAnualBloque
                  titulo={`Apartado en ${anio}`}
                  icono="🐷"
                  items={data?.desglose?.ahorro}
                  colorClase="ahorro"
                  tipo="egreso"
                />
                {huboRetiros && (
                  <DesgloseAnualBloque
                    titulo={`Sacado del ahorro en ${anio}`}
                    icono="🏧"
                    items={data?.desglose?.retiro}
                    colorClase="azul"
                    tipo="retiro_ahorro"
                  />
                )}
              </div>

              {/* Destacados del año */}
              <div className="fin-anual-panel mb-4">
                <p className="fin-desglose__titulo">🏆 Destacados de {anio}</p>
                <div className="fin-destacados">
                  {dest.mejorMes && (
                    <Destacado
                      icono="🥇" label="Mejor mes" clase="fin-destacado--verde"
                      titulo={dest.mejorMes.nombreMes || MESES[(dest.mejorMes.mes || 1) - 1]}
                      monto={formatCRCsigned(dest.mejorMes.monto)} pie="balance del mes"
                    />
                  )}
                  {dest.peorMes && (
                    <Destacado
                      icono="🥀" label="Mes más flojo" clase="fin-destacado--rojo"
                      titulo={dest.peorMes.nombreMes || MESES[(dest.peorMes.mes || 1) - 1]}
                      monto={formatCRCsigned(dest.peorMes.monto)} pie="balance del mes"
                    />
                  )}
                  {dest.mesMasCaro && (
                    <Destacado
                      icono="💸" label="Mes más caro" clase="fin-destacado--rojo"
                      titulo={dest.mesMasCaro.nombreMes || MESES[(dest.mesMasCaro.mes || 1) - 1]}
                      monto={formatCRC(dest.mesMasCaro.monto)} pie="gastos del mes"
                    />
                  )}
                  {dest.mesMasIngresos && (
                    <Destacado
                      icono="📈" label="Más ingresos" clase="fin-destacado--verde"
                      titulo={dest.mesMasIngresos.nombreMes || MESES[(dest.mesMasIngresos.mes || 1) - 1]}
                      monto={formatCRC(dest.mesMasIngresos.monto)} pie="ingresos del mes"
                    />
                  )}
                  {dest.mesMasAhorro && (
                    <Destacado
                      icono="🐷" label="Más ahorro" clase="fin-destacado--ahorro"
                      titulo={dest.mesMasAhorro.nombreMes || MESES[(dest.mesMasAhorro.mes || 1) - 1]}
                      monto={formatCRC(dest.mesMasAhorro.monto)} pie="ahorro del mes"
                    />
                  )}
                  {/* `mesMasRetiro` viene null si el año no tuvo retiros */}
                  {dest.mesMasRetiro && (
                    <Destacado
                      icono="🏧" label="Más sacado del ahorro" clase="fin-destacado--azul"
                      titulo={dest.mesMasRetiro.nombreMes || MESES[(dest.mesMasRetiro.mes || 1) - 1]}
                      monto={formatCRC(dest.mesMasRetiro.monto)} pie="sacado del ahorro"
                    />
                  )}
                  {dest.categoriaTopGasto && (
                    <Destacado
                      icono="🎯" label="Lo que más se llevó"
                      titulo={`${iconoCat(dest.categoriaTopGasto.categoria, "egreso")} ${dest.categoriaTopGasto.categoria}`}
                      monto={formatCRC(dest.categoriaTopGasto.total)}
                      pie={`${formatPct(dest.categoriaTopGasto.porcentaje)} de tus gastos del año`}
                    />
                  )}
                </div>
                {Array.isArray(dest.mesesEnRojo) && dest.mesesEnRojo.length > 0 && (
                  <p className="fin-anual-rojos">
                    🔴 {dest.mesesEnRojo.length === 1 ? "Mes cerrado en rojo" : "Meses cerrados en rojo"}:{" "}
                    {dest.mesesEnRojo
                      .map((m) => `${m.nombreMes || MESES[(m.mes || 1) - 1]} (${formatCRCsigned(m.balance)})`)
                      .join(" · ")}
                  </p>
                )}
              </div>

              {/* Comparativo con el año anterior (solo si el backend lo manda) */}
              {comp && (
                <div className="fin-anual-panel mb-4">
                  <p className="fin-desglose__titulo">🔁 {anio} contra {comp.anio}</p>
                  <div className="fin-comparativo">
                    <div className="fin-comparativo__head">
                      <span>Concepto</span>
                      <span>{comp.anio}</span>
                      <span />
                      <span>{anio}</span>
                      <span className="text-end">Variación</span>
                    </div>
                    <ComparativoFila
                      label="📈 Ingresos" previo={comp.totalIngresos} actual={t.totalIngresos}
                      variacion={comp.variacion?.ingresos} subirEsBueno
                    />
                    <ComparativoFila
                      label="📉 Gastos" previo={comp.totalGastos} actual={t.totalGastos}
                      variacion={comp.variacion?.gastos} subirEsBueno={false}
                    />
                    {/* `variacion.ahorro` compara NETO contra NETO, así que la
                        fila muestra los netos: si mostrara los brutos, el % no
                        cuadraría con los montos de al lado. */}
                    <ComparativoFila
                      label="🐷 Ahorro neto"
                      previo={comp.ahorroNeto ?? comp.totalAhorro}
                      actual={t.ahorroNeto ?? t.totalAhorro}
                      variacion={comp.variacion?.ahorro} subirEsBueno
                    />
                    {/* Informativa: el backend no manda variación de retiros, así
                        que la columna del % queda en "—" en vez de inventarla. */}
                    {(huboRetiros || (comp.totalRetiroAhorro || 0) > 0) && (
                      <ComparativoFila
                        label="🏧 Sacado del ahorro"
                        previo={comp.totalRetiroAhorro} actual={t.totalRetiroAhorro}
                        variacion={null} subirEsBueno={false}
                      />
                    )}
                  </div>
                  <p className="fin-anual-nota">
                    {comp.anio} tuvo {comp.mesesConMovimiento || 0}{" "}
                    {comp.mesesConMovimiento === 1 ? "mes" : "meses"} con movimiento
                    {data?.enCurso ? ` · ${anio} todavía va en curso, así que la comparación es parcial` : ""}.
                  </p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default FinanzasReporteAnual;
