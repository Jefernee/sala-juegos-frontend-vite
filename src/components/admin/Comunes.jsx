// Componentes pequeños compartidos del Módulo de Administración
import { useEffect } from "react";

// ─── OVERLAY DE MODAL (bloquea scroll, cierra con Escape o click afuera) ─────
export const ModalOverlay = ({ onCerrar, children, className = "", bloqueado = false }) => {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape" && !bloqueado && onCerrar) onCerrar();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onCerrar, bloqueado]);

  return (
    <div
      className="admin-modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !bloqueado && onCerrar) onCerrar();
      }}
    >
      <div className={`admin-modal ${className}`} role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  );
};

// ─── MODAL DE CONFIRMACIÓN DE ELIMINACIÓN ────────────────────────────────────
export const ConfirmarEliminar = ({ detalle, eliminando, onCancelar, onConfirmar }) => (
  <ModalOverlay onCerrar={onCancelar} bloqueado={eliminando} className="admin-modal--confirm">
    <div className="confirm-icono">🗑️</div>
    <h5 className="confirm-titulo">¿Seguro que querés eliminar este registro?</h5>
    <p className="confirm-texto">
      Esta acción no se puede deshacer.
      {detalle ? <><br />{detalle}</> : null}
    </p>
    <div className="confirm-botones">
      <button className="admin-btn-ghost" onClick={onCancelar} disabled={eliminando}>
        Cancelar
      </button>
      <button className="btn admin-btn admin-btn--red px-4 fw-bold" onClick={onConfirmar} disabled={eliminando}>
        {eliminando && <span className="btn-spinner" />}
        {eliminando ? "Eliminando..." : "Eliminar"}
      </button>
    </div>
  </ModalOverlay>
);

// ─── PAGINACIÓN ──────────────────────────────────────────────────────────────
// Siempre visible cuando hay registros (también con una sola página),
// en móvil y en computadora. Si el backend no envía los flags, se derivan.
export const Paginacion = ({ pagination, onPage, loading = false }) => {
  if (!pagination) return null;
  const actual = pagination.currentPage || 1;
  const total = pagination.totalPages || 1;
  const hayAnterior = pagination.hasPrevPage ?? actual > 1;
  const haySiguiente = pagination.hasNextPage ?? actual < total;
  return (
    <div className="admin-paginacion">
      <button
        className="admin-paginacion__btn"
        disabled={!hayAnterior || loading}
        onClick={() => onPage(actual - 1)}
        aria-label="Página anterior"
      >
        ◀
      </button>
      <span className="admin-paginacion__info">
        Página {actual} de {total}
        {pagination.totalItems != null && (
          <span className="admin-paginacion__total"> · {pagination.totalItems} registros</span>
        )}
      </span>
      <button
        className="admin-paginacion__btn"
        disabled={!haySiguiente || loading}
        onClick={() => onPage(actual + 1)}
        aria-label="Página siguiente"
      >
        ▶
      </button>
    </div>
  );
};

// ─── ESTADO DE ERROR CON REINTENTAR ──────────────────────────────────────────
export const ErrorRecarga = ({ onReintentar, mensaje = "No se pudieron cargar los datos" }) => (
  <div className="admin-error-estado fade-in">
    <span className="admin-error-estado__icono">⚠️</span>
    <p className="mb-2">{mensaje}</p>
    <button className="btn admin-btn admin-btn--gris px-4" onClick={onReintentar}>
      🔄 Reintentar
    </button>
  </div>
);

// ─── ESTADO VACÍO ────────────────────────────────────────────────────────────
export const EstadoVacio = ({ icono = "📭", mensaje, children }) => (
  <div className="admin-empty fade-in">
    <span className="admin-empty__icono">{icono}</span>
    <p className="mt-2 mb-0">{mensaje}</p>
    {children}
  </div>
);

// ─── SPINNER CENTRADO ────────────────────────────────────────────────────────
export const Cargando = ({ variante = "" }) => (
  <div className="text-center py-5">
    <div className={`admin-spinner ${variante ? `admin-spinner--${variante}` : ""}`} />
  </div>
);
