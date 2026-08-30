// Las dos piezas que arman la vista de Finanzas Personales: los dos bolsillos
// y la escalera. Las usan la pantalla del mes y el reporte anual, que cuentan
// la misma historia en dos escalas.
//
// El modelo es de DOS BOLSILLOS, no un estado de resultados: toda la plata está
// en "Tu plata" (lo que se puede usar hoy) o en "Tus ahorros" (lo apartado).
// Cada bolsillo tiene su color —azul y ámbar— y lo conserva en toda la pantalla.
import { formatCRC } from "./adminUtils";
import { formatCRCsigned } from "./finanzasComunes";

// ─── LOS DOS BOLSILLOS ───────────────────────────────────────────────────────
// Es lo primero que se ve y responde las dos únicas preguntas que importan:
// cuánto puedo usar hoy y cuánto tengo guardado. Los dos números salen tal cual
// del backend.
export const Bolsas = ({ plata, ahorros, pieP, pieA }) => (
  <div className="fin-bolsas mb-3">
    <div className="fin-bolsa fin-bolsa--plata">
      <span className="fin-bolsa__rotulo">Tu plata</span>
      <span className="fin-bolsa__monto">{formatCRCsigned(plata)}</span>
      <span className="fin-bolsa__pie">{pieP || "lo que podés usar hoy"}</span>
    </div>
    <div className="fin-bolsa fin-bolsa--ahorro">
      <span className="fin-bolsa__rotulo">Tus ahorros</span>
      <span className="fin-bolsa__monto">{formatCRCsigned(ahorros)}</span>
      <span className="fin-bolsa__pie">{pieA || "lo que tenés apartado"}</span>
    </div>
  </div>
);

// ─── ESCALERA ────────────────────────────────────────────────────────────────
// Cada línea suma o resta la de arriba y la última cierra el total. Es lo que
// permite verificar los números a mano: si algo no cuadra, se ve en cuál
// escalón. Las filas llegan armadas por la pantalla; acá solo se pintan.
//
// `filas`: { clave, que, nota?, monto, signo?: "+" | "−" }
// Una fila sin signo es un arrastre y puede ser negativa (se venía debiendo),
// así que va con su propio signo en vez de en valor absoluto.
export const Escalera = ({ titulo, filas, totalQue, totalMonto, totalClase }) => (
  <div className="fin-escalera-card">
    <p className="fin-escalera__titulo">{titulo}</p>
    <div className="fin-escalera">
      {filas.map((f) => (
        <div
          key={f.clave}
          className={`fin-escalon ${f.signo === "+" ? "fin-escalon--suma" : f.signo === "−" ? "fin-escalon--resta" : ""}`}
        >
          <span className="fin-escalon__que">
            {f.que}
            {f.nota && <span className="fin-escalon__nota">{f.nota}</span>}
          </span>
          <span className="fin-escalon__cuanto">
            {f.signo
              ? `${f.signo} ${formatCRC(Math.abs(f.monto))}`
              : formatCRCsigned(f.monto)}
          </span>
        </div>
      ))}
      <div className="fin-escalon fin-escalon--total">
        <span className="fin-escalon__que">{totalQue}</span>
        <span className={`fin-escalon__cuanto fin-escalon__cuanto--${totalClase}`}>
          {formatCRCsigned(totalMonto)}
        </span>
      </div>
    </div>
  </div>
);
