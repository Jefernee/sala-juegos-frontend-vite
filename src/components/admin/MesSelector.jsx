// Selector de mes/año compartido por Ganancias y Pagos de Servicios.
// - Flechas ◀ ▶ para navegar mes a mes (▶ deshabilitada en el mes actual)
// - Al tocar el nombre del mes se abre un picker de mes/año
// - Chip de aviso cuando NO se está viendo el mes actual
import { useState, useEffect, useRef } from "react";
import { MESES, nombreMes } from "./adminUtils";

const MesSelector = ({ mes, anio, onChange }) => {
  const hoy = new Date();
  const mesActual = hoy.getMonth() + 1;
  const anioActual = hoy.getFullYear();
  const esMesActual = mes === mesActual && anio === anioActual;

  const [pickerAbierto, setPickerAbierto] = useState(false);
  const [pickerAnio, setPickerAnio] = useState(anio);
  const contRef = useRef(null);

  // Cerrar el picker al hacer click fuera
  useEffect(() => {
    if (!pickerAbierto) return;
    const handler = (e) => {
      if (contRef.current && !contRef.current.contains(e.target)) setPickerAbierto(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pickerAbierto]);

  const irAnterior = () => {
    if (mes === 1) onChange(12, anio - 1);
    else onChange(mes - 1, anio);
  };

  const irSiguiente = () => {
    if (esMesActual) return;
    if (mes === 12) onChange(1, anio + 1);
    else onChange(mes + 1, anio);
  };

  const togglePicker = () => {
    setPickerAnio(anio);
    setPickerAbierto((o) => !o);
  };

  const seleccionarMes = (numMes) => {
    onChange(numMes, pickerAnio);
    setPickerAbierto(false);
  };

  return (
    <div className="mes-selector mb-3" ref={contRef}>
      <div className="mes-nav">
        <button className="mes-nav__btn" onClick={irAnterior} aria-label="Mes anterior">◀</button>
        <button className="mes-nav__label" onClick={togglePicker} aria-label="Elegir mes y año">
          <span className="mes-nav__mes">{MESES[mes - 1]}</span>
          <span className="mes-nav__anio">{anio} ▾</span>
        </button>
        <button
          className="mes-nav__btn"
          onClick={irSiguiente}
          disabled={esMesActual}
          aria-label="Mes siguiente"
        >
          ▶
        </button>
      </div>

      {pickerAbierto && (
        <div className="mes-picker fade-in">
          <div className="mes-picker__anio">
            <button onClick={() => setPickerAnio((a) => a - 1)} aria-label="Año anterior">◀</button>
            <span>{pickerAnio}</span>
            <button
              onClick={() => setPickerAnio((a) => a + 1)}
              disabled={pickerAnio >= anioActual}
              aria-label="Año siguiente"
            >
              ▶
            </button>
          </div>
          <div className="mes-picker__grid">
            {MESES.map((nombre, i) => {
              const num = i + 1;
              const esFuturo =
                pickerAnio > anioActual || (pickerAnio === anioActual && num > mesActual);
              const seleccionado = num === mes && pickerAnio === anio;
              return (
                <button
                  key={nombre}
                  className={`mes-picker__mes ${seleccionado ? "mes-picker__mes--activo" : ""}`}
                  disabled={esFuturo}
                  onClick={() => seleccionarMes(num)}
                >
                  {nombre.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!esMesActual && (
        <div className="mes-chip fade-in">
          <span className="mes-chip__texto">
            📅 Viendo <strong>{nombreMes(mes, anio)}</strong> — los registros nuevos se guardarán en este mes
          </span>
          <button className="mes-chip__btn" onClick={() => onChange(mesActual, anioActual)}>
            Ir al mes actual
          </button>
        </div>
      )}
    </div>
  );
};

export default MesSelector;
