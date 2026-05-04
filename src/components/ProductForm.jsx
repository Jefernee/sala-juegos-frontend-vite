// src/components/ProductForm.jsx
import { useState, useRef, useEffect } from "react";
import axios from "axios";
import ImageUploadWithCompression from "./ImageUploadWithCompression";
import "../styles/ProductForm.css";

/**
 * Formulario unificado para agregar y editar productos.
 * La fecha de compra se asigna automáticamente en el backend
 * usando la zona horaria de Costa Rica (igual que en plays).
 */
const ProductForm = ({ producto = null, onClose, onSuccess }) => {
  const isEditing = !!producto;

  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    cantidad: "",         // solo modo crear
    cantidadAAgregar: "", // solo modo editar (reposición de stock)
    precioCompra: "",
    precioVenta: "",
    imagen: null,         // { file, base64 }
    seVende: true,
    // fechaCompra: asignada automáticamente en el backend (zona horaria Costa Rica)
  });
  const [toast, setToast] = useState({ show: false, text: "", type: "" });
  const imageUploadRef = useRef(null);

  useEffect(() => {
    if (isEditing && producto) {
      setForm({
        nombre: producto.nombre || "",
        cantidad: producto.cantidad || "",
        cantidadAAgregar: "",
        precioCompra: producto.precioCompra || "",
        precioVenta: producto.precioVenta || "",
        imagen: null,
        seVende: producto.seVende ?? true,
      });
    }
  }, [isEditing, producto]);

  const showToast = (text, type = "success") => {
    setToast({ show: true, text, type });
    setTimeout(() => setToast({ show: false, text: "", type: "" }), 8000);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleImageChange = ({ file, base64 }) => {
    setForm((prev) => ({ ...prev, imagen: { file, base64 } }));
  };

  const handleImageError = (error) => {
    console.error("Error procesando imagen:", error);
  };

  const validateForm = () => {
    const errors = [];
    if (!form.nombre.trim()) errors.push("El nombre es obligatorio.");
    if (!isEditing) {
      if (!form.cantidad || Number(form.cantidad) <= 0)
        errors.push("La cantidad debe ser mayor a 0.");
    } else {
      const aAgregar = Number(form.cantidadAAgregar);
      if (form.cantidadAAgregar !== "" && (isNaN(aAgregar) || aAgregar < 0))
        errors.push("Las unidades a agregar no pueden ser negativas.");
    }
    if (form.precioCompra === "" || Number(form.precioCompra) < 0)
      errors.push("El precio de compra no puede ser negativo.");
    if (form.precioVenta === "" || Number(form.precioVenta) < 0)
      errors.push("El precio de venta no puede ser negativo.");
    if (!isEditing) {
      if (!form.imagen?.base64) {
        errors.push("Debes seleccionar una imagen.");
      } else if (form.imagen.file.size > 5 * 1024 * 1024) {
        const mb = (form.imagen.file.size / (1024 * 1024)).toFixed(2);
        errors.push(`La imagen es demasiado grande (${mb} MB). El límite es 5 MB.`);
      }
    } else {
      if (form.imagen?.file && form.imagen.file.size > 5 * 1024 * 1024) {
        const mb = (form.imagen.file.size / (1024 * 1024)).toFixed(2);
        errors.push(`La imagen es demasiado grande (${mb} MB). El límite es 5 MB.`);
      }
    }
    return errors;
  };

  const getUserFriendlyErrorMessage = (error) => {
    if (!error.response) {
      if (error.code === "ECONNABORTED") return "La petición tardó demasiado. Intenta con una imagen más pequeña.";
      if (error.code === "ERR_NETWORK" || error.message === "Network Error") return "Error de red. Verifica tu conexión.";
      return "No se pudo completar la petición. Verifica tu conexión.";
    }
    const status = error.response.status;
    const errorData = error.response.data;
    switch (status) {
      case 400: return errorData?.error ? `Error de validación: ${errorData.error}` : "Datos inválidos. Revisa todos los campos.";
      case 401: return "Tu sesión ha expirado. Por favor inicia sesión nuevamente.";
      case 403: return "No tienes permisos para realizar esta acción.";
      case 413: return "El archivo es demasiado grande. Usa una imagen más pequeña.";
      case 415: return "Formato de imagen no soportado. Usa JPG, PNG o WebP.";
      case 500: return errorData?.error ? `Error del servidor: ${errorData.error}` : "Error interno del servidor.";
      default: return errorData?.error ? `Error: ${errorData.error}` : `Error inesperado (${status}).`;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (uploading) return;
    const validationErrors = validateForm();
    if (validationErrors.length > 0) { showToast(validationErrors.join("\n"), "error"); return; }
    setUploading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) { showToast("Debes iniciar sesión.", "error"); return; }
      const apiUrl = import.meta.env.VITE_API_URL;
      if (!apiUrl) { showToast("URL del API no definida.", "error"); return; }

      // Sin fechaCompra: el backend la pone automáticamente en hora de Costa Rica
      const payload = {
        nombre: form.nombre,
        precioCompra: form.precioCompra,
        precioVenta: form.precioVenta,
        seVende: form.seVende,
      };

      if (!isEditing) {
        payload.cantidad = form.cantidad;
      } else {
        payload.cantidadAAgregar = Number(form.cantidadAAgregar) || 0;
      }

      if (form.imagen?.base64) {
        payload.imagenBase64 = form.imagen.base64;
        payload.imagenNombre = form.imagen.file.name;
        payload.imagenMimeType = form.imagen.file.type;
      } else if (!isEditing) {
        showToast("Debes seleccionar una imagen.", "error");
        setUploading(false);
        return;
      }

      const config = {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        timeout: 120000,
      };

      let response;
      if (isEditing) {
        response = await axios.put(`${apiUrl}/api/products/${producto._id}`, payload, config);
        showToast("Producto actualizado correctamente");
      } else {
        response = await axios.post(`${apiUrl}/api/products`, payload, config);
        showToast("Producto agregado correctamente");
      }
      console.log("Operación exitosa:", response.data);
      setTimeout(() => { if (onSuccess) onSuccess(); }, 1000);
    } catch (error) {
      console.error("Error al guardar producto:", error);
      showToast(getUserFriendlyErrorMessage(error), "error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="product-form-overlay">
      <div className="product-form-modal">
        <div className="product-form-header">
          <h2 className="product-form-title">
            {isEditing ? "✏️ Editar Producto" : "➕ Agregar Producto"}
          </h2>
          <button className="btn-close" onClick={onClose} aria-label="Cerrar" disabled={uploading} />
        </div>

        {toast.show && (
          <div className={`toast-custom ${toast.type}`} style={{ whiteSpace: "pre-line", maxHeight: "200px", overflowY: "auto", fontSize: "0.9rem", lineHeight: "1.6", padding: "12px", marginBottom: "1rem" }}>
            {toast.text}
          </div>
        )}

        <form className="product-form-body" onSubmit={handleSubmit}>
          <div className="row g-3">

            {/* Nombre */}
            <div className="col-md-6">
              <label htmlFor="nombre" className="form-label">Nombre <span className="text-danger">*</span></label>
              <input id="nombre" name="nombre" type="text" className="form-control" value={form.nombre} onChange={handleChange} required disabled={uploading} placeholder="Ej: Coca Cola 600ml" />
            </div>

            {/* Cantidad: diferente según modo */}
            {!isEditing ? (
              <div className="col-md-6">
                <label htmlFor="cantidad" className="form-label">Cantidad inicial <span className="text-danger">*</span></label>
                <input id="cantidad" name="cantidad" type="number" min="1" className="form-control" value={form.cantidad} onChange={handleChange} required disabled={uploading} placeholder="1" />
              </div>
            ) : (
              <>
                <div className="col-md-3">
                  <label className="form-label">Stock actual</label>
                  <input type="number" className="form-control" value={producto.cantidad} disabled style={{ backgroundColor: "#f3f4f6", cursor: "not-allowed" }} />
                  <small className="text-muted">Solo lectura</small>
                </div>
                <div className="col-md-3">
                  <label htmlFor="cantidadAAgregar" className="form-label">Agregar unidades</label>
                  <input id="cantidadAAgregar" name="cantidadAAgregar" type="number" min="0" className="form-control" value={form.cantidadAAgregar} onChange={handleChange} disabled={uploading} placeholder="0" />
                  <small className="text-muted">0 = sin reposición</small>
                </div>
              </>
            )}

            {/* Precio Compra */}
            <div className="col-md-4">
              <label htmlFor="precioCompra" className="form-label">Precio Compra <span className="text-danger">*</span></label>
              <input id="precioCompra" name="precioCompra" type="number" min="0" step="0.01" className="form-control" value={form.precioCompra} onChange={handleChange} required disabled={uploading} placeholder="0.00" />
            </div>

            {/* Precio Venta */}
            <div className="col-md-4">
              <label htmlFor="precioVenta" className="form-label">Precio Venta <span className="text-danger">*</span></label>
              <input id="precioVenta" name="precioVenta" type="number" min="0" step="0.01" className="form-control" value={form.precioVenta} onChange={handleChange} required disabled={uploading} placeholder="0.00" />
            </div>

            {/* Disponible para venta */}
            <div className="col-md-4 d-flex align-items-end">
              <div className="form-check">
                <input id="seVende" name="seVende" type="checkbox" className="form-check-input" checked={form.seVende} onChange={handleChange} disabled={uploading} />
                <label className="form-check-label" htmlFor="seVende">Disponible para venta</label>
              </div>
            </div>

            {/* Imagen */}
            <div className="col-12">
              <label className="form-label">
                Imagen {!isEditing && <span className="text-danger">*</span>}
                {isEditing && <span className="text-muted" style={{ fontSize: "0.85rem" }}> (opcional - deja vacío para mantener la actual)</span>}
              </label>
              {isEditing && producto?.imagen && !form.imagen?.file && (
                <div className="current-image-preview mb-2">
                  <img src={producto.imagenOptimizada || producto.imagen} alt="Imagen actual" style={{ maxWidth: "150px", maxHeight: "150px", objectFit: "contain", border: "2px solid #e5e7eb", borderRadius: "8px", padding: "4px" }} />
                  <small className="d-block text-muted mt-1">📷 Imagen actual del producto</small>
                </div>
              )}
              <ImageUploadWithCompression onChange={handleImageChange} onError={handleImageError} required={!isEditing} disabled={uploading} showPreview={true} ref={imageUploadRef} />
              <small className="form-text text-muted d-block mt-1">📷 Formatos: JPG, PNG, WebP · Tamaño máximo: 5 MB</small>
            </div>

            {/* Botones */}
            <div className="col-12">
              <div className="d-flex gap-2">
                <button type="submit" className="btn btn-primary flex-fill" disabled={uploading}>
                  {uploading ? (
                    <><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />{isEditing ? "Actualizando..." : "Guardando..."}</>
                  ) : (
                    <>{isEditing ? "💾 Actualizar Producto" : "➕ Agregar Producto"}</>
                  )}
                </button>
                <button type="button" className="btn btn-secondary" onClick={onClose} disabled={uploading}>✕ Cancelar</button>
              </div>
            </div>

          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductForm;