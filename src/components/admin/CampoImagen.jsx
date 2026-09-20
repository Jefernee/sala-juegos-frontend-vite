// Bloque de imagen para los formularios del panel.
//
// Vivía dentro de ActivosPanel, pero el módulo de Juegos necesita el mismo
// para la factura de una compra: es la misma factura, entre por donde entre.
// Duplicarlo era garantía de que uno de los dos se quedara atrás.
import { useState } from "react";
import ImageUploadWithCompression from "../ImageUploadWithCompression";

const CampoImagen = ({ etiqueta, urlActual, imagenData, quitar, onChange, onQuitar, onProcesando, uploadRef, disabled }) => {
  // En edición con imagen existente: mostrarla hasta que se pida cambiarla
  const [cambiando, setCambiando] = useState(!urlActual);

  const quitarNueva = () => {
    uploadRef.current?.reset();
    onChange(null);
  };

  // Se marcó quitar la imagen guardada: se eliminará (también de Cloudinary) al guardar
  if (quitar) {
    return (
      <div>
        <label className="admin-label">{etiqueta}</label>
        <div className="aviso-quitar fade-in">
          <p className="mb-2">🗑️ La imagen se eliminará al guardar.</p>
          <button type="button" className="admin-btn-ghost" onClick={() => onQuitar(false)} disabled={disabled}>
            ↩ Deshacer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="admin-label">{etiqueta}</label>
      {!cambiando && urlActual ? (
        <div className="imagen-actual">
          <img src={urlActual} alt={etiqueta} className="imagen-actual__img" />
          <div className="d-flex gap-2 mt-2 flex-wrap">
            <button type="button" className="admin-btn-ghost" onClick={() => setCambiando(true)} disabled={disabled}>
              🔄 Cambiar imagen
            </button>
            <button
              type="button"
              className="admin-btn-ghost admin-btn-ghost--rojo"
              onClick={() => onQuitar(true)}
              disabled={disabled}
            >
              🗑️ Quitar imagen
            </button>
          </div>
        </div>
      ) : (
        <>
          <ImageUploadWithCompression
            ref={uploadRef}
            onChange={onChange}
            onProcessingChange={onProcesando}
            showPreview
            alwaysCompress
            maxWidthOrHeight={1000}
            disabled={disabled}
          />
          <div className="d-flex gap-2 mt-2 flex-wrap">
            {imagenData && (
              <button type="button" className="admin-btn-ghost" onClick={quitarNueva} disabled={disabled}>
                ✕ Quitar imagen seleccionada
              </button>
            )}
            {urlActual && (
              <button
                type="button"
                className="admin-btn-ghost"
                onClick={() => { quitarNueva(); setCambiando(false); }}
                disabled={disabled}
              >
                ↩ Mantener imagen actual
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default CampoImagen;
