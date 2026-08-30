// Reporte del año de Mis Finanzas Personales.
//
// Es la vista del mes contada en grande: los mismos dos bolsillos —Tu plata y
// Tus ahorros— y las mismas dos escaleras, con los totales del año. Es de SOLO
// LECTURA: el backend manda el año entero armado (`GET /resumen-anual?anio=`) y
// este archivo solo lo pinta. Los promedios, porcentajes y la tasa de ahorro
// vienen ya calculados (los promedios son sobre los meses CON movimiento, no
// entre 12), así que nada se recalcula ni se reordena.
//
// Orden de la pantalla: los dos bolsillos → las dos escaleras → tu ritmo →
// mes por mes → de dónde vino y en qué se fue → lo que más pesó → contra el
// año anterior.
//
// Se quitaron, por pedido del dueño (no los leía): el resumen inteligente del
// año, el gráfico de 12 grupos de 3 barras —ahora cada mes lleva su barrita en
// su propia fila— y la tabla de ocho columnas con scroll de lado, que en el
// teléfono había que arrastrar para leer.
import { useState, useEffect, useCallback, Fragment } from "react";
import { getAxios, formatCRC, MESES } from "./adminUtils";
import { FIN_BASE as BASE, formatCRCsigned, formatPct, PALETA, iconoCat } from "./finanzasComunes";
import { Bolsas, Escalera } from "./FinanzasBolsas";
import { ErrorRecarga, EstadoVacio, Cargando } from "./Comunes";

// Años disponibles cacheados en memoria: cambian solo cuando se registra un
// movimiento en un año nuevo, así que no vale repetir la llamada al volver.
let aniosCache = null;

// Nombre del mes que manda el backend, con el del front como respaldo.
const nombreDelMes = (m) => m?.nombreMes || MESES[(m?.mes || 1) - 1];

// ─── UNA FILA DEL MES A MES ──────────────────────────────────────────────────
// Cuatro números y nada más: entró, gastaste, ahorraste y lo que quedó. La
// barrita bajo el nombre dice, sin cifras, qué tan grande fue ese mes comparado
// con el mejor del año. Al tocarla se abre la explicación en palabras.
//
// Reemplazó a una tabla de hasta ocho columnas que en el teléfono había que
// arrastrar de lado para leer.
const MesFila = ({ mes, maxIngresos, abierto, onAbrir, onIrAlMes }) => {
  const registrado = mes.registrado !== false;
  const nombre = nombreDelMes(mes);

  // Un mes sin anotar no lleva las cuatro celdas vacías: cuatro rayas con sus
  // etiquetas ocupaban más que un mes con datos y en el teléfono se leía
  // "Entró sin anotar". Va una sola frase.
  if (!registrado) {
    return (
      <div className="fin-mes-fila fin-mes-fila--sin">
        <span className="fin-mes-fila__mes">{nombre}</span>
        <span className="fin-mes-fila__nada">sin anotar</span>
      </div>
    );
  }

  const ancho = maxIngresos > 0
    ? Math.max(2, Math.round(((mes.totalIngresos || 0) / maxIngresos) * 100))
    : 0;
  const pagoAhorro = mes.totalGastoDesdeAhorro || 0;
  const retiro = mes.totalRetiroAhorro || 0;
  // `balanceMes` = entró − gastaste − ahorraste. Lo manda el backend; es lo que
  // sobró (o faltó) ese mes.
  const sobro = mes.balanceMes || 0;

  return (
    <>
      <button
        type="button"
        className={`fin-mes-fila fin-mes-fila--btn ${abierto ? "fin-mes-fila--abierta" : ""}`}
        onClick={onAbrir}
        aria-expanded={abierto}
      >
        <span className="fin-mes-fila__mes">
          {nombre}
          <span className="fin-mes-fila__barra" style={{ width: `${ancho}%` }} />
        </span>
        <span className="fin-mes-fila__dato fin-mes-fila__dato--verde" data-lbl="Entró">
          {formatCRC(mes.totalIngresos)}
        </span>
        <span className="fin-mes-fila__dato fin-mes-fila__dato--rojo" data-lbl="Gastaste">
          {formatCRC(mes.totalGastos)}
        </span>
        <span className="fin-mes-fila__dato fin-mes-fila__dato--ambar" data-lbl="Ahorraste">
          {formatCRC(mes.totalAhorro)}
        </span>
        <span className="fin-mes-fila__dato fin-mes-fila__dato--saldo" data-lbl="Te quedó">
          {formatCRCsigned(mes.saldoFinal)}
        </span>
        {pagoAhorro > 0 && (
          <span className="fin-mes-fila__nota">
            🏦 Además pagaste {formatCRC(pagoAhorro)} con tus ahorros, que no salió de la plata del mes.
          </span>
        )}
        {retiro > 0 && (
          <span className="fin-mes-fila__nota fin-mes-fila__nota--azul">
            🏧 Y sacaste {formatCRC(retiro)} del ahorro.
          </span>
        )}
      </button>

      {abierto && (
        <div className="fin-mes-detalle">
          En {nombre.toLowerCase()} entraron <strong>{formatCRC(mes.totalIngresos)}</strong>, gastaste{" "}
          <strong>{formatCRC(mes.totalGastos)}</strong> y apartaste{" "}
          <strong>{formatCRC(mes.totalAhorro)}</strong>.{" "}
          {sobro >= 0 ? (
            <>
              Te sobraron <strong>{formatCRC(sobro)}</strong> y cerraste con{" "}
              <strong>{formatCRCsigned(mes.saldoFinal)}</strong> a mano.
            </>
          ) : (
            <>
              Te faltaron <strong>{formatCRC(Math.abs(sobro))}</strong>, así que ese hueco lo tapaste
              con lo que traías: cerraste con <strong>{formatCRCsigned(mes.saldoFinal)}</strong>.
            </>
          )}
          {pagoAhorro > 0 && (
            <> Aparte pagaste <strong>{formatCRC(pagoAhorro)}</strong> con tus ahorros.</>
          )}
          <button type="button" className="fin-mes-detalle__abrir" onClick={() => onIrAlMes(mes.mes)}>
            Abrir {nombre.toLowerCase()} completo →
          </button>
        </div>
      )}
    </>
  );
};

// ─── DESGLOSE ANUAL POR CATEGORÍA ────────────────────────────────────────────
// Usa el `porcentaje` que manda el backend (no se recalcula). `gasto` ya viene
// sin las categorías de ahorro: son bloques independientes y no se mezclan.
const DesgloseAnualBloque = ({ titulo, icono, items, colorClase, tipo, children }) => {
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
      {children}
    </div>
  );
};

// ─── TARJETITA DE "LO QUE MÁS PESÓ" ──────────────────────────────────────────
// La etiqueta se lee sola ("El mes que más entró"), sin palabras de contador.
const Destacado = ({ icono, label, titulo, monto, pie, clase = "" }) => (
  <div className={`fin-destacado ${clase}`}>
    <span className="fin-destacado__label">{icono} {label}</span>
    <strong className="fin-destacado__titulo">{titulo}</strong>
    <span className="fin-destacado__monto">{monto}</span>
    {pie && <span className="fin-destacado__pie">{pie}</span>}
  </div>
);

// ─── UNA LÍNEA DEL "CONTRA EL AÑO PASADO" ────────────────────────────────────
// Era una tabla de cinco columnas con flechas y porcentajes. Ahora es una frase:
// cuánto fue este año y cómo se compara con el anterior. `variacion` la manda el
// backend en % (null si no hay base para comparar). Subir ingresos o ahorro es
// bueno; subir gastos es malo: el color va por el concepto, no por el signo.
const ContraFila = ({ icono, que, actual, previo, variacion, anioPrevio, subirEsBueno }) => {
  const hayVar = variacion != null && Number.isFinite(Number(variacion));
  const num = Number(variacion) || 0;
  const subio = num > 0;
  const clase = !hayVar || num === 0 ? "neutro" : subio === subirEsBueno ? "verde" : "rojo";

  return (
    <div className="fin-contra__fila">
      <span className="fin-contra__que">{icono} {que}</span>
      <span className="fin-contra__monto">{formatCRCsigned(actual)}</span>
      <span className={`fin-contra__dif fin-contra__dif--${clase}`}>
        {!hayVar
          ? `en ${anioPrevio} fueron ${formatCRCsigned(previo)}`
          : num === 0
            ? `igual que en ${anioPrevio}`
            : `${subio ? "↑" : "↓"} ${formatPct(Math.abs(num))} ${subio ? "más" : "menos"} que en ${anioPrevio} (${formatCRCsigned(previo)})`}
      </span>
    </div>
  );
};

// ─── PANTALLA DEL REPORTE ANUAL ──────────────────────────────────────────────
const FinanzasReporteAnual = ({ anioInicial, getAuthHeaders, manejarError, onVolver }) => {
  const anioHoy = new Date().getFullYear();
  const [anio, setAnio] = useState(anioInicial || anioHoy);
  const [anios, setAnios] = useState(aniosCache || []);
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [mesAbierto, setMesAbierto] = useState(null);

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
        aniosCache = lista.length ? lista : [anioHoy];
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
  const sinDatos = !cargando && !error && (t.movimientos || 0) === 0;
  const nombreCorte = apertura
    ? apertura.nombreMesCorte || MESES[(apertura.mesCorte || 1) - 1]
    : "";

  // ¿Hubo retiros del ahorro este año? Solo con datos viejos: el retiro salió
  // de la interfaz y ya no se puede crear uno nuevo.
  const huboRetiros = (t.totalRetiroAhorro || 0) > 0;

  // Los términos del recorrido del saldo los manda armados el backend
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

  const pagadoConAhorro = t.totalGastoDesdeAhorro || 0;
  const enCurso = !!data?.enCurso;
  const mesesConMov = prom.mesesConMovimiento || 0;
  // Los promedios son sobre los meses CON movimiento, no entre 12: se aclara al
  // lado para que nadie lea "por mes" como "entre los doce del año".
  const pieMeses = mesesConMov
    ? `en ${mesesConMov === 1 ? "el mes que anotaste" : `los ${mesesConMov} meses que anotaste`}`
    : "";

  // ── Las dos escaleras del año ─────────────────────────────────────────────
  // Las mismas dos del mes, con los totales del año. Todo viene del backend;
  // acá solo se ordena en filas. `rec.balance` es ingresos − egresos (con el
  // ahorro adentro), así que abrirlo en "+ entró − gastaste − ahorraste" da
  // exactamente lo mismo y deja ver de dónde sale.
  const filasPlata = [
    { clave: "arrastre", que: `Tenías al empezar ${anio}`, monto: rec.saldoInicialAnio },
    // Solo si el saldo de apertura aportó plata A MANO y cae dentro del año.
    ...(apertura && (rec.aperturaDisponible || 0) !== 0
      ? [{
          clave: "apertura",
          que: `Saldo de apertura (${nombreCorte})`,
          nota: "lo que ya tenías antes de empezar a anotar",
          monto: rec.aperturaDisponible,
          signo: "+",
        }]
      : []),
    { clave: "entro", que: "Entró", monto: t.totalIngresos, signo: "+" },
    ...(huboRetiros
      ? [{ clave: "retiro", que: "Sacaste del ahorro", monto: t.totalRetiroAhorro, signo: "+" }]
      : []),
    { clave: "gasto", que: "Gastaste", monto: t.totalGastos, signo: "−" },
    { clave: "ahorro", que: "Ahorraste", monto: t.totalAhorro, signo: "−" },
  ];

  const filasAhorro = [
    { clave: "arrastre", que: `Tenías ahorrado al empezar ${anio}`, monto: data?.ahorroInicioAnio },
    ...(apertura && (apertura.montoAhorro || 0) !== 0
      ? [{
          clave: "apertura",
          que: `Ahorro del saldo de apertura (${nombreCorte})`,
          monto: apertura.montoAhorro,
          signo: "+",
        }]
      : []),
    { clave: "aparte", que: "Ahorraste", monto: t.totalAhorro, signo: "+" },
    ...(huboRetiros
      ? [{ clave: "retiro", que: "Sacaste del ahorro", monto: t.totalRetiroAhorro, signo: "−" }]
      : []),
    // Se oculta si no se pagó nada con los ahorros (el caso normal).
    ...(pagadoConAhorro > 0
      ? [{
          clave: "pago",
          que: "Pagaste con tus ahorros",
          nota: "plata que se consumió sin pasar por el mes",
          monto: pagadoConAhorro,
          signo: "−",
        }]
      : []),
  ];

  // El mes más grande del año marca el 100% de las barritas del mes a mes.
  const maxIngresos = meses.reduce((max, m) => Math.max(max, m.totalIngresos || 0), 0);

  // "De cada ₡100 que entraron, guardaste ₡41". `tasaAhorro` es la tasa NETA
  // (lo apartado menos lo que salió del ahorro) y PUEDE SER NEGATIVA, así que
  // cuando lo es se dice al revés en vez de mostrar un "guardaste ₡-5".
  const tasa = Number(t.tasaAhorro) || 0;
  const guardado = Math.round(Math.abs(tasa));

  return (
    <div className="fade-in fin-ancho">
      {/* Cabecera: volver + selector de año */}
      <div className="fin-anual-head mb-3">
        <button className="admin-btn-ghost" onClick={() => onVolver()}>← Volver al mes</button>
        <h5 className="fin-anual-titulo">Tu año {anio}</h5>
        <div className="fin-anual-anios">
          {(anios.length ? anios : [anio]).map((a) => (
            <button
              key={a}
              className={`fin-anual-anio ${a === anio ? "fin-anual-anio--activo" : ""}`}
              onClick={() => { setAnio(a); setMesAbierto(null); }}
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
      ) : sinDatos ? (
        <EstadoVacio icono="📭" mensaje={`No hay movimientos registrados en ${anio}`} />
      ) : (
        <>
          {/* El año todavía no cerró: los totales son parciales */}
          {enCurso && (
            <div className="fin-aviso fin-aviso--curso mb-3">
              ⏳ <strong>{anio} va en curso</strong> — llevás {mesesConMov}{" "}
              {mesesConMov === 1 ? "mes anotado" : "meses anotados"}, así que estos son los números
              de lo que va del año, no de un año entero.
            </div>
          )}

          {/* 1 · Los dos bolsillos al cerrar el año */}
          <Bolsas
            plata={rec.saldoFinalAnio}
            ahorros={data?.ahorroFinalAnio}
            pieP={enCurso ? "lo que tenés a mano hoy" : `lo que te quedó a mano al cerrar ${anio}`}
            pieA={`entre las dos tenés ${formatCRCsigned(data?.patrimonioFinal)}`}
          />

          {/* 2 · Las dos escaleras del año — las mismas del mes, en grande.
              Cada línea suma o resta la de arriba y cierra en el total. */}
          <div className="fin-escaleras mb-3">
            <Escalera
              titulo={`💵 Tu plata en ${anio}`}
              filas={filasPlata}
              totalQue={enCurso ? "Te queda" : `Te quedó al cerrar ${anio}`}
              totalMonto={rec.saldoFinalAnio}
              totalClase={(rec.saldoFinalAnio || 0) >= 0 ? "plata" : "rojo"}
            />
            <Escalera
              titulo={`🏦 Tus ahorros en ${anio}`}
              filas={filasAhorro}
              totalQue="Tenés ahorrado"
              totalMonto={data?.ahorroFinalAnio}
              totalClase="ahorro"
            />
          </div>

          {/* 3 · Tu ritmo: lo que no cabe en una escalera, en lenguaje llano. */}
          <div className="fin-anual-panel mb-3">
            <p className="fin-desglose__titulo">📐 Tu ritmo en {anio}</p>
            <div className="fin-ritmo">
              <div className="fin-ritmo__item">
                <span className="fin-ritmo__label">Entró por mes</span>
                <span className="fin-ritmo__valor fin-ritmo__valor--verde">{formatCRC(prom.ingresos)}</span>
                <span className="fin-ritmo__pie">{pieMeses}</span>
              </div>
              <div className="fin-ritmo__item">
                <span className="fin-ritmo__label">Gastaste por mes</span>
                <span className="fin-ritmo__valor fin-ritmo__valor--rojo">{formatCRC(prom.gastos)}</span>
                <span className="fin-ritmo__pie">{pieMeses}</span>
              </div>
              <div className="fin-ritmo__item">
                <span className="fin-ritmo__label">De cada ₡100 que entraron</span>
                <span className={`fin-ritmo__valor fin-ritmo__valor--${tasa < 0 ? "rojo" : "ambar"}`}>
                  {tasa < 0 ? `se fueron ₡${guardado}` : `guardaste ₡${guardado}`}
                </span>
                <span className="fin-ritmo__pie">
                  {tasa < 0
                    ? `sacaste más ahorro del que apartaste (${formatCRCsigned(t.ahorroNeto)})`
                    : `${formatCRC(t.ahorroNeto)} se quedaron en tus ahorros`}
                </span>
              </div>
            </div>
          </div>

          {/* 4 · Mes por mes: cuatro números por mes y nada más. */}
          <div className="fin-anual-panel mb-3">
            <p className="fin-desglose__titulo">🗓️ Mes por mes</p>
            <p className="fin-anual-hint">Tocá un mes para ver su detalle.</p>
            <div className="fin-meses__head">
              <span>Mes</span>
              <span>Entró</span>
              <span>Gastaste</span>
              <span>Ahorraste</span>
              <span>Te quedó</span>
            </div>
            <div className="fin-meses">
              {meses.map((m, i) => (
                <Fragment key={m.mes ?? i}>
                  {/* De acá salió el salto del ahorro acumulado */}
                  {m.aperturaAplicada && apertura && (
                    <div className="fin-anual-apertura">
                      ⭐ Saldo de apertura ({nombreCorte}): {formatCRC(apertura.montoAhorro)} apartados
                      {(apertura.montoDisponible || 0) > 0 &&
                        ` · ${formatCRC(apertura.montoDisponible)} a mano`}
                    </div>
                  )}
                  <MesFila
                    mes={m}
                    maxIngresos={maxIngresos}
                    abierto={mesAbierto === m.mes}
                    onAbrir={() => setMesAbierto(mesAbierto === m.mes ? null : m.mes)}
                    onIrAlMes={(mes) => onVolver(mes, anio)}
                  />
                </Fragment>
              ))}
            </div>
          </div>

          {/* 5 · De dónde vino y en qué se fue */}
          <div className="fin-desglose-cols fin-anual-desglose mb-3">
            <DesgloseAnualBloque
              titulo={`De dónde vino la plata en ${anio}`}
              icono="📈"
              items={data?.desglose?.ingreso}
              colorClase="verde"
              tipo="ingreso"
            />
            <DesgloseAnualBloque
              titulo={`En qué se te fue en ${anio}`}
              icono="📉"
              items={data?.desglose?.gasto}
              colorClase="rojo"
              tipo="egreso"
            />
            <DesgloseAnualBloque
              titulo={`Lo que apartaste en ${anio}`}
              icono="🐷"
              items={data?.desglose?.ahorro}
              colorClase="ahorro"
              tipo="egreso"
            />
            {pagadoConAhorro > 0 && (
              <DesgloseAnualBloque
                titulo="Lo que pagaste con tus ahorros"
                icono="🏦"
                items={data?.desglose?.gastoAhorro}
                colorClase="ahorro"
                tipo="egreso"
              >
                {(data?.desglose?.gastoAhorroPorBolsa || []).length > 0 && (
                  <p className="fin-anual-nota">
                    Salió de:{" "}
                    {[...data.desglose.gastoAhorroPorBolsa]
                      .sort((a, b) => (b.total || 0) - (a.total || 0))
                      .map((b) => `${b.categoria} ${formatCRC(b.total)}`)
                      .join(" · ")}
                    . Esa plata se consumió sin pasar por la plata del año.
                  </p>
                )}
              </DesgloseAnualBloque>
            )}
            {huboRetiros && (
              <DesgloseAnualBloque
                titulo={`Lo que sacaste del ahorro en ${anio}`}
                icono="🏧"
                items={data?.desglose?.retiro}
                colorClase="azul"
                tipo="retiro_ahorro"
              />
            )}
          </div>

          {/* 6 · Lo que más pesó */}
          <div className="fin-anual-panel mb-3">
            <p className="fin-desglose__titulo">🏆 Lo que más pesó en {anio}</p>
            <div className="fin-destacados">
              {dest.mesMasIngresos && (
                <Destacado
                  icono="📈" label="El mes que más entró" clase="fin-destacado--verde"
                  titulo={nombreDelMes(dest.mesMasIngresos)}
                  monto={formatCRC(dest.mesMasIngresos.monto)}
                />
              )}
              {dest.mesMasCaro && (
                <Destacado
                  icono="💸" label="El mes que más gastaste" clase="fin-destacado--rojo"
                  titulo={nombreDelMes(dest.mesMasCaro)}
                  monto={formatCRC(dest.mesMasCaro.monto)}
                />
              )}
              {dest.mesMasAhorro && (
                <Destacado
                  icono="🐷" label="El mes que más ahorraste" clase="fin-destacado--ahorro"
                  titulo={nombreDelMes(dest.mesMasAhorro)}
                  monto={formatCRC(dest.mesMasAhorro.monto)}
                />
              )}
              {dest.mejorMes && (
                <Destacado
                  icono="🥇" label="El mes que más te sobró" clase="fin-destacado--plata"
                  titulo={nombreDelMes(dest.mejorMes)}
                  monto={formatCRCsigned(dest.mejorMes.monto)}
                />
              )}
              {dest.mesMasGastoDesdeAhorro && (
                <Destacado
                  icono="🏦" label="El mes que más pagaste con tus ahorros" clase="fin-destacado--ahorro"
                  titulo={nombreDelMes(dest.mesMasGastoDesdeAhorro)}
                  monto={formatCRC(dest.mesMasGastoDesdeAhorro.monto)}
                />
              )}
              {/* `mesMasRetiro` viene null si el año no tuvo retiros */}
              {dest.mesMasRetiro && (
                <Destacado
                  icono="🏧" label="El mes que más sacaste del ahorro" clase="fin-destacado--azul"
                  titulo={nombreDelMes(dest.mesMasRetiro)}
                  monto={formatCRC(dest.mesMasRetiro.monto)}
                />
              )}
              {dest.categoriaTopGasto && (
                <Destacado
                  icono="🎯" label="Lo que más se llevó tu plata" clase="fin-destacado--rojo"
                  titulo={`${iconoCat(dest.categoriaTopGasto.categoria, "egreso")} ${dest.categoriaTopGasto.categoria}`}
                  monto={formatCRC(dest.categoriaTopGasto.total)}
                  pie={`${formatPct(dest.categoriaTopGasto.porcentaje)} de tus gastos del año`}
                />
              )}
            </div>
            {Array.isArray(dest.mesesEnRojo) && dest.mesesEnRojo.length > 0 && (
              <p className="fin-anual-rojos">
                🔴 {dest.mesesEnRojo.length === 1
                  ? "Un mes gastaste más de lo que entró: "
                  : "Estos meses gastaste más de lo que entró: "}
                {dest.mesesEnRojo
                  .map((m) => `${nombreDelMes(m)} (${formatCRCsigned(m.balance)})`)
                  .join(" · ")}
                . Ese hueco lo tapaste con lo que traías de antes.
              </p>
            )}
          </div>

          {/* 7 · Contra el año pasado: una línea por concepto, sin tabla. */}
          {comp && (
            <div className="fin-anual-panel mb-3">
              <p className="fin-desglose__titulo">🔁 {anio} contra {comp.anio}</p>
              <div className="fin-contra">
                <ContraFila
                  icono="📈" que="Entró"
                  actual={t.totalIngresos} previo={comp.totalIngresos}
                  variacion={comp.variacion?.ingresos} anioPrevio={comp.anio} subirEsBueno
                />
                <ContraFila
                  icono="📉" que="Gastaste"
                  actual={t.totalGastos} previo={comp.totalGastos}
                  variacion={comp.variacion?.gastos} anioPrevio={comp.anio} subirEsBueno={false}
                />
                {/* `variacion.ahorro` compara NETO contra NETO, así que la fila
                    muestra los netos: con los brutos el % no cuadraría. */}
                <ContraFila
                  icono="🐷" que="Se quedó ahorrado"
                  actual={t.ahorroNeto ?? t.totalAhorro}
                  previo={comp.ahorroNeto ?? comp.totalAhorro}
                  variacion={comp.variacion?.ahorro} anioPrevio={comp.anio} subirEsBueno
                />
              </div>
              <p className="fin-anual-nota">
                {anio} tiene {mesesConMov} {mesesConMov === 1 ? "mes" : "meses"} anotados y{" "}
                {comp.anio} tiene {comp.mesesConMovimiento || 0}.
                {enCurso && ` Como ${anio} todavía va en curso, la comparación es parcial.`}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default FinanzasReporteAnual;
