// src/components/inventario/PanelRentabilidad.jsx
// Costo, ganancia y cuántas se pueden preparar, mientras se arma la receta.
//
// Este panel existe por el caso de los 44 vasos: la receta quedó costando más
// que su precio de venta y nada en la pantalla lo dijo. Con el costo a la vista
// el error se ve solo — un costo de ₡2.173 contra un precio de ₡700 se pinta en
// rojo antes de guardar.

import { formatearMonto, formatearNumero } from "../../constants/inventario";

const PanelRentabilidad = ({
  titulo = "Cuentas de esta receta",
  costo,
  precioVenta,
  ganancia,
  margen,
  // `undefined` oculta el dato (los productos simples no se "preparan").
  preparables,
  conPerdida,
  sinGanancia,
  costoIncompleto = false,
  vacio = false,
  contexto = "receta",
  // Si el producto no se vende (solo es ingrediente), no tiene sentido mostrar
  // "Se vende en —" y "Te queda —": son dos guiones que no dicen nada.
  mostrarVenta = true,
}) => {
  const hayVenta =
    precioVenta !== "" && precioVenta !== null && Number(precioVenta) > 0;

  const estado = conPerdida ? "perdida" : sinGanancia ? "empate" : "ok";
  const muestraPreparables = preparables !== undefined;

  const colaAviso =
    contexto === "receta"
      ? "Revisá las cantidades de los ingredientes antes de guardar."
      : "Revisá el precio de compra o el de venta antes de guardar.";

  return (
    <div className={`panel-rentabilidad ${estado}`}>
      <div className="panel-rentabilidad-titulo">{titulo}</div>

      {vacio ? (
        <p className="panel-rentabilidad-vacio">
          Agregá ingredientes y el costo se calcula acá mismo.
        </p>
      ) : (
        <>
          <div className="panel-rentabilidad-grid">
            <div className="rent-item">
              <span className="rent-label">
                {contexto === "receta" ? "Cuesta preparar una" : "Te cuesta"}
              </span>
              <span className="rent-valor">{formatearMonto(costo)}</span>
            </div>

            {mostrarVenta && (
              <>
                <div className="rent-item">
                  <span className="rent-label">Se vende en</span>
                  <span className="rent-valor">
                    {hayVenta ? formatearMonto(precioVenta) : "—"}
                  </span>
                </div>

                <div className="rent-item">
                  <span className="rent-label">Te queda</span>
                  <span className={`rent-valor ${conPerdida ? "rent-negativo" : ""}`}>
                    {hayVenta && ganancia !== null ? formatearMonto(ganancia) : "—"}
                    {hayVenta && margen !== null && (
                      <small className="rent-margen">
                        {" "}
                        ({formatearNumero(margen, 0)}%)
                      </small>
                    )}
                  </span>
                </div>
              </>
            )}

            {muestraPreparables && (
              <div className="rent-item">
                <span className="rent-label">Podés preparar</span>
                <span className="rent-valor">
                  {preparables === null
                    ? "—"
                    : `${formatearNumero(preparables)} ${preparables === 1 ? "unidad" : "unidades"}`}
                </span>
              </div>
            )}
          </div>

          {conPerdida && (
            <div className="panel-rentabilidad-aviso">
              Estás vendiendo con pérdida: cada unidad cuesta{" "}
              {formatearMonto(costo)} y la vendés en{" "}
              {formatearMonto(precioVenta)}. {colaAviso}
            </div>
          )}

          {sinGanancia && !conPerdida && (
            <div className="panel-rentabilidad-aviso">
              El precio de venta es igual al costo: no queda ganancia.
            </div>
          )}

          {muestraPreparables && preparables === 0 && (
            <div className="panel-rentabilidad-aviso">
              Con el stock actual no se puede preparar ninguna. La receta va a
              quedar agotada.
            </div>
          )}

          {costoIncompleto && (
            <small className="panel-rentabilidad-nota">
              Falta el detalle de algún ingrediente, así que el costo puede estar
              incompleto.
            </small>
          )}
        </>
      )}
    </div>
  );
};

export default PanelRentabilidad;
