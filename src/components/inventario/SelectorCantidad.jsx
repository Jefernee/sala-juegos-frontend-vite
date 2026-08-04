// src/components/inventario/SelectorCantidad.jsx
//
// Un solo control para una cantidad: menos, el número, más.
//
// Antes esto tenía tres cosas a la vez — una fila de botones con valores
// sugeridos, un visor con la cifra repetida y un enlace aparte para "escribir a
// mano". Para elegir un número era demasiado. Ahora el número se escribe o se
// mueve con los botones, y el salto de esos botones depende de la unidad: de 1
// en 1 lo que se cuenta, de 10 en 10 lo que se pesa.

import { unidadInfo, sufijoUnidad } from "../../constants/inventario";

const SelectorCantidad = ({
  valor,
  onChange,
  unidad = "unidades",
  paso = null,
  min = 0,
  disabled = false,
  sufijo = null,
  ayuda = null,
  id = undefined,
}) => {
  const info = unidadInfo(unidad);
  const salto = paso || info.paso;
  // Para "unidades" el sufijo es vacío: el número solo ya se entiende.
  const etiqueta = sufijo !== null ? sufijo : sufijoUnidad(unidad);

  const actual = Number(valor);
  const hayValor = valor !== "" && valor !== null && isFinite(actual);

  // Redondeamos para que 0.1 + 0.2 no termine en 0.30000000000000004.
  const mover = (delta) => {
    if (disabled) return;
    const base = hayValor ? actual : 0;
    onChange(Math.max(min, Math.round((base + delta) * 1000) / 1000));
  };

  return (
    <div className="selector-cantidad">
      <div className="selector-stepper">
        <button
          type="button"
          className="btn-stepper"
          onClick={() => mover(-salto)}
          disabled={disabled || (hayValor && actual <= min)}
          aria-label={`Restar ${salto}`}
        >
          −
        </button>

        <div className="selector-campo">
          <input
            id={id}
            type="number"
            className="form-control"
            value={valor === null ? "" : valor}
            min={min}
            step="any"
            inputMode="decimal"
            onChange={(e) => {
              const v = e.target.value;
              onChange(v === "" ? "" : Number(v));
            }}
            disabled={disabled}
          />
          {etiqueta && <span className="selector-campo-unidad">{etiqueta}</span>}
        </div>

        <button
          type="button"
          className="btn-stepper"
          onClick={() => mover(salto)}
          disabled={disabled}
          aria-label={`Sumar ${salto}`}
        >
          +
        </button>
      </div>

      {ayuda && <small className="selector-ayuda">{ayuda}</small>}
    </div>
  );
};

export default SelectorCantidad;
