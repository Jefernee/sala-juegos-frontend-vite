// src/utils/stock.js
// Disponibilidad de un producto, con el motivo cuando está agotado.
//
// El backend ya calcula el stock de las recetas y lo manda en `cantidad`. La
// idea es que además mande `agotado`, `motivoAgotado`, `ingredienteLimitante` y
// `stockCalculado`. Mientras esos campos no lleguen, acá se derivan del arreglo
// `receta` (que sí viene con cada ingrediente poblado). Si algún día llegan, se
// usan tal cual y este archivo deja de adivinar: el backend siempre gana.
//
// Regla que no se rompe: la disponibilidad NO se usa para esconder productos.
// Un producto agotado se muestra deshabilitado y con su motivo. Filtrar por
// `cantidad > 0` en el frontend anularía el arreglo del backend y volvería a
// desaparecer productos sin dejar rastro.

import { conUnidad } from "../constants/inventario";

/**
 * El ingrediente de una línea de receta. El backend a veces lo manda poblado
 * (objeto completo) y a veces solo el id, según el endpoint.
 */
function ingredienteDe(linea) {
  if (!linea) return null;
  const ref = linea.ingredienteId;
  if (ref && typeof ref === "object") return ref;
  return null;
}

/** Nombre y unidad de una línea, sin importar si viene poblada o no. */
function datosLinea(linea) {
  const ing = ingredienteDe(linea);
  return {
    nombre: linea?.nombre || ing?.nombre || "Ingrediente",
    unidad: linea?.unidad || ing?.unidad || "unidades",
    porUnidad: Number(linea?.cantidad) || 0,
    stock: ing ? Number(ing.cantidad) || 0 : null,
    precioCompra: ing ? Number(ing.precioCompra) || 0 : null,
    cantidadPorEnvase: ing?.cantidadPorEnvase ?? null,
    nombreEnvase: ing?.nombreEnvase ?? null,
  };
}

/**
 * Analiza una receta: cuánto cuesta cada unidad, cuántas se pueden preparar y
 * qué ingrediente pone el techo.
 *
 * Acepta tanto las líneas que vienen del backend como las que se están armando
 * en el formulario, siempre que traigan el ingrediente y la cantidad por unidad.
 */
export function analizarReceta(lineas, precioVenta = null) {
  const items = Array.isArray(lineas) ? lineas : [];

  let costo = 0;
  let preparables = Infinity;
  let limitante = null;
  let costoIncompleto = false;

  const detalle = items.map((linea) => {
    const d = datosLinea(linea);

    // Sin el ingrediente poblado no podemos costear ni saber el techo.
    if (d.precioCompra === null || d.stock === null) costoIncompleto = true;

    const costoLinea = (d.precioCompra || 0) * d.porUnidad;
    costo += costoLinea;

    // Una línea con cantidad 0 no consume nada, así que no limita.
    const posibles =
      d.porUnidad > 0 && d.stock !== null
        ? Math.floor(d.stock / d.porUnidad)
        : null;

    if (posibles !== null && posibles < preparables) {
      preparables = posibles;
      limitante = { ...d, posibles };
    }

    return { ...d, costoLinea, posibles };
  });

  const preparablesFinal = preparables === Infinity ? null : preparables;
  const venta = precioVenta === null || precioVenta === "" ? null : Number(precioVenta);
  const ganancia = venta === null ? null : venta - costo;

  return {
    costo,
    detalle,
    limitante,
    preparables: preparablesFinal,
    costoIncompleto,
    ganancia,
    margen: venta && venta > 0 && ganancia !== null ? (ganancia / venta) * 100 : null,
    // Vender por debajo del costo. Solo tiene sentido si ya hay precio de venta.
    conPerdida: ganancia !== null && venta > 0 && ganancia < 0,
    sinGanancia: ganancia !== null && venta > 0 && ganancia === 0,
  };
}

/**
 * Texto del motivo cuando una receta se queda sin poder prepararse.
 * Nombre completo de la unidad, no la abreviatura: "quedan 0 unidades" se lee,
 * "quedan 0 u" no.
 */
function motivoPorLimitante(limitante) {
  if (!limitante) return "Sin existencias";
  return `Falta ${limitante.nombre}: quedan ${conUnidad(limitante.stock, limitante.unidad)} y cada unidad usa ${conUnidad(limitante.porUnidad, limitante.unidad)}`;
}

/**
 * Disponibilidad de un producto tal como lo devuelve el backend.
 *
 * Devuelve siempre: { stock, agotado, motivo, limitante, esReceta }.
 */
export function resolverDisponibilidad(producto) {
  if (!producto) {
    return { stock: 0, agotado: true, motivo: "Sin existencias", limitante: null, esReceta: false };
  }

  const esReceta = producto.tipo === "receta";

  // El backend manda `stockCalculado` para las recetas; si no viene, `cantidad`
  // ya trae el stock calculado.
  const stock = Number(
    producto.stockCalculado ?? producto.cantidad ?? 0,
  );

  // ── Campos del backend, si ya llegan ──────────────────────────────────────
  const limitanteBackend = producto.ingredienteLimitante || null;
  const agotadoBackend =
    typeof producto.agotado === "boolean" ? producto.agotado : null;
  const motivoBackend = producto.motivoAgotado || null;

  // ── Derivación local mientras no lleguen ──────────────────────────────────
  let limitanteLocal = null;
  if (esReceta && Array.isArray(producto.receta) && producto.receta.length > 0) {
    limitanteLocal = analizarReceta(producto.receta).limitante;
  }

  const agotado = agotadoBackend !== null ? agotadoBackend : stock <= 0;

  let motivo = motivoBackend;
  if (!motivo && agotado) {
    if (limitanteBackend) {
      motivo = limitanteBackend.nombre
        ? `Falta ${limitanteBackend.nombre}`
        : "Sin existencias";
    } else if (esReceta) {
      motivo = motivoPorLimitante(limitanteLocal);
    } else {
      motivo = "Sin existencias";
    }
  }

  return {
    stock,
    agotado,
    motivo: motivo || null,
    limitante: limitanteBackend || limitanteLocal,
    esReceta,
  };
}

