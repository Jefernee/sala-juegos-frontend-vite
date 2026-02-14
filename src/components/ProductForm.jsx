// src/components/ProductForm.jsx
import { useState, useRef, useEffect } from "react";
import axios from "axios";
import ImageUploadWithCompression from "./ImageUploadWithCompression";
import "../styles/ProductForm.css";

/**
 * Componente de formulario unificado para agregar y editar productos
 * @param {Object} props
 * @param {Object|null} props.producto - Producto a editar (null para crear nuevo)
 * @param {Function} props.onClose - Callback al cerrar el formulario
 * @param {Function} props.onSuccess - Callback al guardar exitosamente
 */
const ProductForm = ({ producto = null, onClose, onSuccess }) => {
  const isEditing = !!producto;

  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    cantidad: "",
    precioCompra: "",
    precioVenta: "",
    fechaCompra: "",
    imagen: null, // { file, base64 }
    seVende: true,
  });
  const [toast, setToast] = useState({ show: false, text: "", type: "" });
  const imageUploadRef = useRef(null);

  // ✅ Inicializar formulario con datos del producto si estamos editando
  useEffect(() => {
    if (isEditing && producto) {
      setForm({
        nombre: producto.nombre || "",
        cantidad: producto.cantidad || "",
        precioCompra: producto.precioCompra || "",
        precioVenta: producto.precioVenta || "",
        fechaCompra: producto.fechaCompra
          ? producto.fechaCompra.split("T")[0]
          : "",
        imagen: null, // La imagen actual se mantiene en el servidor
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
    console.log("📷 Imagen recibida:", {
      name: file.name,
      size: `${(file.size / 1024).toFixed(2)} KB`,
      type: file.type,
      base64Length: base64.length,
    });
    setForm((prev) => ({ ...prev, imagen: { file, base64 } }));
  };

  const handleImageError = (error) => {
    console.error("❌ Error procesando imagen:", error);
  };

  const validateForm = () => {
    const errors = [];

    if (!form.nombre.trim()) errors.push("El nombre es obligatorio.");
    if (!form.cantidad || Number(form.cantidad) <= 0)
      errors.push("La cantidad debe ser mayor a 0.");
    if (form.precioCompra === "" || Number(form.precioCompra) < 0)
      errors.push("El precio de compra no puede ser negativo.");
    if (form.precioVenta === "" || Number(form.precioVenta) < 0)
      errors.push("El precio de venta no puede ser negativo.");
    if (!form.fechaCompra) errors.push("La fecha de compra es obligatoria.");

    // ✅ Solo validar imagen si estamos CREANDO (no editando)
    if (!isEditing) {
      if (!form.imagen?.base64) {
        errors.push("Debes seleccionar una imagen.");
      } else if (form.imagen.file.size > 5 * 1024 * 1024) {
        const mb = (form.imagen.file.size / (1024 * 1024)).toFixed(2);
        errors.push(
          `La imagen es demasiado grande (${mb} MB). El límite es 5 MB.`,
        );
      }
    } else {
      // Si estamos editando y hay nueva imagen, validar tamaño
      if (form.imagen?.file && form.imagen.file.size > 5 * 1024 * 1024) {
        const mb = (form.imagen.file.size / (1024 * 1024)).toFixed(2);
        errors.push(
          `La imagen es demasiado grande (${mb} MB). El límite es 5 MB.`,
        );
      }
    }

    if (Number(form.precioVenta) < Number(form.precioCompra)) {
      console.warn("⚠️ Precio de venta menor al precio de compra");
    }

    return errors;
  };

  const getUserFriendlyErrorMessage = (error) => {
    if (!error.response) {
      if (error.code === "ECONNABORTED") {
        return "⏱️ La petición tardó demasiado. Verifica tu conexión e intenta con una imagen más pequeña.";
      }
      if (error.code === "ERR_NETWORK" || error.message === "Network Error") {
        return "🌐 Error de red. Verifica tu conexión a internet e intenta nuevamente.";
      }
      return "❌ No se pudo completar la petición. Verifica tu conexión e intenta nuevamente.";
    }

    const status = error.response.status;
    const errorData = error.response.data;

    switch (status) {
      case 400:
        return errorData?.error
          ? `📝 Error de validación: ${errorData.error}`
          : "📝 Datos inválidos. Por favor, revisa todos los campos.";
      case 401:
        return "🔒 Tu sesión ha expirado. Por favor, inicia sesión nuevamente.";
      case 403:
        return "🚫 No tienes permisos para realizar esta acción.";
      case 404:
        return "🔍 No se encontró el endpoint. Contacta al administrador.";
      case 413:
        return "📦 El archivo es demasiado grande para el servidor. Usa una imagen más pequeña.";
      case 415:
        return "🖼️ Formato de imagen no soportado. Usa JPG, PNG o WebP.";
      case 500:
        if (errorData?.error?.includes("cloudinary")) {
          return "☁️ Error al subir la imagen a Cloudinary. Contacta al administrador.";
        }
        if (
          errorData?.error?.includes("mongo") ||
          errorData?.error?.includes("database")
        ) {
          return "🗄️ Error al guardar en la base de datos. Contacta al administrador.";
        }
        return errorData?.error
          ? `🔧 Error del servidor: ${errorData.error}`
          : "🔧 Error interno del servidor. Contacta al administrador.";
      default:
        return errorData?.error
          ? `❌ Error: ${errorData.error}`
          : `❌ Error inesperado (Código ${status}). Contacta al administrador.`;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (uploading) return;

    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      showToast(validationErrors.join("\n"), "error");
      return;
    }

    setUploading(true);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        showToast("🔒 Debes iniciar sesión.", "error");
        return;
      }

      const apiUrl = import.meta.env.VITE_API_URL;
      if (!apiUrl) {
        showToast("Error de configuración: URL del API no definida.", "error");
        return;
      }

      // ✅ USAR JSON CON BASE64 PARA AMBOS (CREAR Y EDITAR)
      const payload = {
        nombre: form.nombre,
        cantidad: form.cantidad,
        precioCompra: form.precioCompra,
        precioVenta: form.precioVenta,
        fechaCompra: form.fechaCompra,
        seVende: form.seVende,
      };

      // ✅ Solo incluir imagen si hay una nueva
      if (form.imagen?.base64) {
        payload.imagenBase64 = form.imagen.base64;
        payload.imagenNombre = form.imagen.file.name;
        payload.imagenMimeType = form.imagen.file.type;
        console.log("✅ Nueva imagen incluida:", form.imagen.file.name);
      } else if (!isEditing) {
        // Si estamos creando y no hay imagen, es un error
        showToast("Debes seleccionar una imagen.", "error");
        setUploading(false);
        return;
      }

      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 120000,
      };

      let response;
      if (isEditing) {
        console.log("📤 Actualizando producto ID:", producto._id);
        response = await axios.put(
          `${apiUrl}/api/products/${producto._id}`,
          payload,
          config,
        );
        showToast("✅ Producto actualizado correctamente");
      } else {
        console.log("📤 Creando nuevo producto");
        response = await axios.post(`${apiUrl}/api/products`, payload, config);
        showToast("✅ Producto agregado correctamente");
      }

      console.log("✅ Operación exitosa:", response.data);

      setTimeout(() => {
        if (onSuccess) onSuccess();
      }, 1000);
    } catch (error) {
      console.error("❌ Error al guardar producto:", {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        data: error.response?.data,
      });
      showToast(getUserFriendlyErrorMessage(error), "error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="product-form-overlay">
      <div className="product-form-modal">
        {/* Header */}
        <div className="product-form-header">
          <h2 className="product-form-title">
            {isEditing ? "✏️ Editar Producto" : "➕ Agregar Producto"}
          </h2>
          <button
            className="btn-close"
            onClick={onClose}
            aria-label="Cerrar"
            disabled={uploading}
          />
        </div>

        {/* Toast */}
        {toast.show && (
          <div
            className={`toast-custom ${toast.type}`}
            style={{
              whiteSpace: "pre-line",
              maxHeight: "200px",
              overflowY: "auto",
              fontSize: "0.9rem",
              lineHeight: "1.6",
              padding: "12px",
              marginBottom: "1rem",
            }}
          >
            {toast.text}
          </div>
        )}

        {/* Formulario */}
        <form className="product-form-body" onSubmit={handleSubmit}>
          <div className="row g-3">
            {/* Nombre */}
            <div className="col-md-6">
              <label htmlFor="nombre" className="form-label">
                Nombre <span className="text-danger">*</span>
              </label>
              <input
                id="nombre"
                name="nombre"
                type="text"
                className="form-control"
                value={form.nombre}
                onChange={handleChange}
                required
                disabled={uploading}
                placeholder="Ej: Coca Cola 600ml"
              />
            </div>

            {/* Cantidad */}
            <div className="col-md-3">
              <label htmlFor="cantidad" className="form-label">
                Cantidad <span className="text-danger">*</span>
              </label>
              <input
                id="cantidad"
                name="cantidad"
                type="number"
                min="1"
                className="form-control"
                value={form.cantidad}
                onChange={handleChange}
                required
                disabled={uploading}
                placeholder="1"
              />
            </div>

            {/* Fecha */}
            <div className="col-md-3">
              <label htmlFor="fechaCompra" className="form-label">
                Fecha <span className="text-danger">*</span>
              </label>
              <input
                id="fechaCompra"
                name="fechaCompra"
                type="date"
                className="form-control"
                value={form.fechaCompra}
                onChange={handleChange}
                required
                disabled={uploading}
                max={new Date().toISOString().split("T")[0]}
              />
            </div>

            {/* Precio Compra */}
            <div className="col-md-4">
              <label htmlFor="precioCompra" className="form-label">
                Precio Compra <span className="text-danger">*</span>
              </label>
              <input
                id="precioCompra"
                name="precioCompra"
                type="number"
                min="0"
                step="0.01"
                className="form-control"
                value={form.precioCompra}
                onChange={handleChange}
                required
                disabled={uploading}
                placeholder="0.00"
              />
            </div>

            {/* Precio Venta */}
            <div className="col-md-4">
              <label htmlFor="precioVenta" className="form-label">
                Precio Venta <span className="text-danger">*</span>
              </label>
              <input
                id="precioVenta"
                name="precioVenta"
                type="number"
                min="0"
                step="0.01"
                className="form-control"
                value={form.precioVenta}
                onChange={handleChange}
                required
                disabled={uploading}
                placeholder="0.00"
              />
            </div>

            {/* Disponible para venta */}
            <div className="col-md-4 d-flex align-items-end">
              <div className="form-check">
                <input
                  id="seVende"
                  name="seVende"
                  type="checkbox"
                  className="form-check-input"
                  checked={form.seVende}
                  onChange={handleChange}
                  disabled={uploading}
                />
                <label className="form-check-label" htmlFor="seVende">
                  Disponible para venta
                </label>
              </div>
            </div>

            {/* Imagen */}
            <div className="col-12">
              <label className="form-label">
                Imagen {!isEditing && <span className="text-danger">*</span>}
                {isEditing && (
                  <span className="text-muted" style={{ fontSize: "0.85rem" }}>
                    {" "}
                    (opcional - deja vacío para mantener la actual)
                  </span>
                )}
              </label>

              {/* Mostrar imagen actual si estamos editando */}
              {isEditing && producto?.imagen && !form.imagen?.file && (
                <div className="current-image-preview mb-2">
                  <img
                    src={producto.imagenOptimizada || producto.imagen}
                    alt="Imagen actual"
                    style={{
                      maxWidth: "150px",
                      maxHeight: "150px",
                      objectFit: "contain",
                      border: "2px solid #e5e7eb",
                      borderRadius: "8px",
                      padding: "4px",
                    }}
                  />
                  <small className="d-block text-muted mt-1">
                    📷 Imagen actual del producto
                  </small>
                </div>
              )}

              <ImageUploadWithCompression
                onChange={handleImageChange}
                onError={handleImageError}
                required={!isEditing}
                disabled={uploading}
                showPreview={true}
                ref={imageUploadRef}
              />
              <small className="form-text text-muted d-block mt-1">
                📷 Formatos: JPG, PNG, WebP · Tamaño máximo: 5 MB
              </small>
            </div>

            {/* Botones */}
            <div className="col-12">
              <div className="d-flex gap-2">
                <button
                  type="submit"
                  className="btn btn-primary flex-fill"
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                        aria-hidden="true"
                      />
                      {isEditing ? "Actualizando..." : "Guardando..."}
                    </>
                  ) : (
                    <>
                      {isEditing
                        ? "💾 Actualizar Producto"
                        : "➕ Agregar Producto"}
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onClose}
                  disabled={uploading}
                >
                  ✕ Cancelar
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductForm;
