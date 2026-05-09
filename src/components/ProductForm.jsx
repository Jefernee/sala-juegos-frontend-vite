// src/components/ProductForm.jsx
import { useState, useRef, useEffect } from "react";
import axios from "axios";
import ImageUploadWithCompression from "./ImageUploadWithCompression";
import "../styles/ProductForm.css";

const ProductForm = ({ producto = null, onClose, onSuccess }) => {
  const isEditing = !!producto;

  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    cantidad: "",
    cantidadAAgregar: "",
    precioCompra: "",
    precioVenta: "",
    imagen: null,
    seVende: true,
    tipo: "producto",
    unidad: "unidades",
    cantidadPorEnvase: "",
    nombreEnvase: "",
  });
  const [mostrarConfigEnvase, setMostrarConfigEnvase] = useState(false);
  const [modoReposicion, setModoReposicion] = useState("unidades"); // "envases" | "unidades"
  const [envasesAAgregar, setEnvasesAAgregar] = useState("");
  const [modoCreacion, setModoCreacion] = useState("unidades"); // para cantidad inicial
  const [cantidadEnvasesCrear, setCantidadEnvasesCrear] = useState("");
  const [toast, setToast] = useState({ show: false, text: "", type: "" });
  const imageUploadRef = useRef(null);

  // Estado para ingredientes de receta
  const [receta, setReceta] = useState([]);
  const [ingredienteSearch, setIngredienteSearch] = useState("");
  const [ingredientesResultados, setIngredientesResultados] = useState([]);
  const [buscandoIngredientes, setBuscandoIngredientes] = useState(false);
  const ingredienteTimeoutRef = useRef(null);
  const ingredienteSearchRef = useRef(null);
  const [mostrarDropdown, setMostrarDropdown] = useState(false);

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
        tipo: producto.tipo || "producto",
        unidad: producto.unidad || "unidades",
        cantidadPorEnvase: producto.cantidadPorEnvase ?? "",
        nombreEnvase: producto.nombreEnvase || "",
      });
      if (producto.cantidadPorEnvase) {
        setMostrarConfigEnvase(true);
      }
      if (producto.tipo === "receta" && Array.isArray(producto.receta)) {
        setReceta(
          producto.receta.map((ing) => {
            const esObjeto = ing.ingredienteId && typeof ing.ingredienteId === "object";
            return {
              ingredienteId: esObjeto ? ing.ingredienteId._id : ing.ingredienteId,
              nombre: ing.nombre || (esObjeto ? ing.ingredienteId.nombre : ""),
              unidad: ing.unidad || (esObjeto ? ing.ingredienteId.unidad : "") || "",
              cantidad: ing.cantidad,
            };
          })
        );
      }
    }
  }, [isEditing, producto]);

  const showToast = (text, type = "success") => {
    setToast({ show: true, text, type });
    setTimeout(() => setToast({ show: false, text: "", type: "" }), 8000);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: type === "checkbox" ? checked : value };
      if (name === "seVende" && !checked) {
        next.precioVenta = "";
      }
      return next;
    });
  };

  const handleImageChange = ({ file, base64 }) => {
    setForm((prev) => ({ ...prev, imagen: { file, base64 } }));
  };

  const handleImageError = (error) => {
    console.error("Error procesando imagen:", error);
  };

  // ===== INGREDIENTES =====

  const buscarIngredientes = async (searchTerm) => {
    if (!searchTerm.trim()) {
      setIngredientesResultados([]);
      setBuscandoIngredientes(false);
      return;
    }
    setBuscandoIngredientes(true);
    try {
      const token = localStorage.getItem("token");
      const apiUrl = import.meta.env.VITE_API_URL;
      const response = await axios.get(`${apiUrl}/api/products/ingredientes`, {
        params: { search: searchTerm },
        headers: { Authorization: `Bearer ${token}` },
      });
      const todos = response.data.ingredientes || [];
      const agregadosIds = new Set(receta.map((r) => r.ingredienteId));
      setIngredientesResultados(todos.filter((i) => !agregadosIds.has(i._id)));
      setMostrarDropdown(true);
    } catch (error) {
      console.error("Error buscando ingredientes:", error);
    } finally {
      setBuscandoIngredientes(false);
    }
  };

  const handleIngredienteSearchChange = (e) => {
    const value = e.target.value;
    setIngredienteSearch(value);
    if (ingredienteTimeoutRef.current) clearTimeout(ingredienteTimeoutRef.current);
    if (!value.trim()) {
      setIngredientesResultados([]);
      setMostrarDropdown(false);
      return;
    }
    ingredienteTimeoutRef.current = setTimeout(() => buscarIngredientes(value), 400);
  };

  const agregarIngrediente = (ing) => {
    if (receta.find((r) => r.ingredienteId === ing._id)) return;
    setReceta((prev) => [
      ...prev,
      { ingredienteId: ing._id, nombre: ing.nombre, unidad: ing.unidad || "", cantidad: 1 },
    ]);
    setIngredienteSearch("");
    setIngredientesResultados([]);
    setMostrarDropdown(false);
  };

  const quitarIngrediente = (ingredienteId) => {
    setReceta((prev) => prev.filter((r) => r.ingredienteId !== ingredienteId));
  };

  const actualizarCantidadIngrediente = (ingredienteId, value) => {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return;
    setReceta((prev) =>
      prev.map((r) =>
        r.ingredienteId === ingredienteId ? { ...r, cantidad: num } : r
      )
    );
  };

  // ===== VALIDACIÓN =====

  const validateForm = () => {
    const errors = [];
    const esReceta = form.tipo === "receta";

    if (!form.nombre.trim()) errors.push("El nombre es obligatorio.");

    if (!esReceta) {
      if (!form.unidad.trim()) errors.push("La unidad es obligatoria.");

      if (!isEditing) {
        if (modoCreacion === "envases") {
          if (!cantidadEnvasesCrear || Number(cantidadEnvasesCrear) <= 0)
            errors.push("La cantidad de envases debe ser mayor a 0.");
        } else {
          if (!form.cantidad || Number(form.cantidad) <= 0)
            errors.push("La cantidad debe ser mayor a 0.");
        }
      } else {
        if (modoReposicion === "envases") {
          const env = Number(envasesAAgregar);
          if (envasesAAgregar !== "" && (isNaN(env) || env < 0))
            errors.push("Los envases a agregar no pueden ser negativos.");
        } else {
          const aAgregar = Number(form.cantidadAAgregar);
          if (form.cantidadAAgregar !== "" && (isNaN(aAgregar) || aAgregar < 0))
            errors.push("La cantidad a agregar no puede ser negativa.");
        }
      }
      if (form.precioCompra === "")
        errors.push("El precio de compra es obligatorio.");
      else if (Number(form.precioCompra) < 0)
        errors.push("El precio de compra no puede ser negativo.");
    }

    if (form.seVende) {
      if (form.precioVenta === "")
        errors.push("El precio de venta es obligatorio.");
      else if (Number(form.precioVenta) < 0)
        errors.push("El precio de venta no puede ser negativo.");
    } else {
      if (form.precioVenta !== "" && Number(form.precioVenta) < 0)
        errors.push("El precio de venta no puede ser negativo.");
    }

    if (esReceta) {
      if (receta.length === 0)
        errors.push("La receta debe tener al menos 1 ingrediente.");
    } else {
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
    }

    if (esReceta && form.imagen?.file && form.imagen.file.size > 5 * 1024 * 1024) {
      const mb = (form.imagen.file.size / (1024 * 1024)).toFixed(2);
      errors.push(`La imagen es demasiado grande (${mb} MB). El límite es 5 MB.`);
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

      const esReceta = form.tipo === "receta";

      const payload = {
        nombre: form.nombre,
        precioVenta: form.precioVenta === "" ? 0 : form.precioVenta,
        seVende: form.seVende,
      };

      if (esReceta) {
        payload.tipo = "receta";
        payload.receta = receta.map(({ ingredienteId, cantidad }) => ({
          ingredienteId: typeof ingredienteId === "object" ? ingredienteId._id : ingredienteId,
          cantidad,
        }));
      } else {
        payload.precioCompra = form.precioCompra;
        payload.unidad = form.unidad || "unidades";
        if (form.cantidadPorEnvase !== "" && form.cantidadPorEnvase !== null) {
          payload.cantidadPorEnvase = Number(form.cantidadPorEnvase);
        } else {
          payload.cantidadPorEnvase = null;
        }
        payload.nombreEnvase = form.nombreEnvase || "";

        if (!isEditing) {
          if (modoCreacion === "envases" && form.cantidadPorEnvase) {
            payload.cantidad = Number(cantidadEnvasesCrear) * Number(form.cantidadPorEnvase);
          } else {
            payload.cantidad = form.cantidad;
          }
        } else {
          if (modoReposicion === "envases" && envasesAAgregar !== "") {
            payload.envasesAAgregar = Number(envasesAAgregar) || 0;
          } else {
            payload.cantidadAAgregar = Number(form.cantidadAAgregar) || 0;
          }
        }
      }

      if (form.imagen?.base64) {
        payload.imagenBase64 = form.imagen.base64;
        payload.imagenNombre = form.imagen.file.name;
        payload.imagenMimeType = form.imagen.file.type;
      } else if (!isEditing && !esReceta) {
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
        showToast(esReceta ? "Receta actualizada correctamente" : "Producto actualizado correctamente");
      } else {
        response = await axios.post(`${apiUrl}/api/products`, payload, config);
        showToast(esReceta ? "Receta agregada correctamente" : "Producto agregado correctamente");
      }
      console.log("Operación exitosa:", response.data);
      setTimeout(() => { if (onSuccess) onSuccess(); }, 1000);
    } catch (error) {
      console.error("Error al guardar:", error);
      showToast(getUserFriendlyErrorMessage(error), "error");
    } finally {
      setUploading(false);
    }
  };

  const esReceta = form.tipo === "receta";

  // Equivalencia en tiempo real para reposición por envases
  const equivalenciaEnvases =
    modoReposicion === "envases" &&
    envasesAAgregar !== "" &&
    Number(envasesAAgregar) > 0 &&
    form.cantidadPorEnvase
      ? Number(envasesAAgregar) * Number(form.cantidadPorEnvase)
      : null;

  return (
    <div className="product-form-overlay">
      <div className="product-form-modal">
        <div className="product-form-header">
          <h2 className="product-form-title">
            {isEditing
              ? esReceta ? "✏️ Editar Receta" : "✏️ Editar Producto"
              : "➕ Agregar Producto"}
          </h2>
          <button className="btn-close" onClick={onClose} aria-label="Cerrar" disabled={uploading} />
        </div>

        <form className="product-form-body" onSubmit={handleSubmit}>
          {toast.show && (
            <div className={`toast-custom ${toast.type}`} style={{ whiteSpace: "pre-line", maxHeight: "200px", overflowY: "auto", fontSize: "0.9rem", lineHeight: "1.6", padding: "12px", marginBottom: "1rem" }}>
              {toast.text}
            </div>
          )}

          <div className="row g-3">

            {/* Tipo de producto — solo en creación */}
            {!isEditing && (
              <div className="col-12">
                <label className="form-label">Tipo de producto</label>
                <div className="btn-group w-100" role="group" aria-label="Tipo de producto">
                  <input type="radio" className="btn-check" name="tipo" id="tipo-producto" value="producto" checked={form.tipo === "producto"} onChange={handleChange} disabled={uploading} />
                  <label className="btn btn-outline-primary" htmlFor="tipo-producto">📦 Producto simple</label>
                  <input type="radio" className="btn-check" name="tipo" id="tipo-receta" value="receta" checked={form.tipo === "receta"} onChange={handleChange} disabled={uploading} />
                  <label className="btn btn-outline-warning" htmlFor="tipo-receta">🍽️ Receta</label>
                </div>
              </div>
            )}

            {/* Badge de tipo cuando se está editando */}
            {isEditing && esReceta && (
              <div className="col-12">
                <span className="badge bg-warning text-dark fs-6 px-3 py-2">🍽️ Receta</span>
                <small className="text-muted ms-2">Las recetas calculan su stock automáticamente a partir de los ingredientes.</small>
              </div>
            )}

            {/* Nombre */}
            <div className="col-md-6">
              <label htmlFor="nombre" className="form-label">Nombre <span className="text-danger">*</span></label>
              <input id="nombre" name="nombre" type="text" className="form-control" value={form.nombre} onChange={handleChange} required disabled={uploading} placeholder={esReceta ? "Ej: Cono de vainilla" : "Ej: Coca Cola 600ml"} />
            </div>

            {/* Unidad — solo para productos simples */}
            {!esReceta && (
              <div className="col-md-6">
                <label htmlFor="unidad" className="form-label">Unidad <span className="text-danger">*</span></label>
                <input id="unidad" name="unidad" type="text" className="form-control" value={form.unidad} onChange={handleChange} disabled={uploading} placeholder="unidades" />
                <small className="text-muted">En qué unidad se mide este ingrediente. Ejemplos: ml, bolas, gr, unidades.</small>
              </div>
            )}

            {/* Cantidad / Reposición — solo para productos simples */}
            {!esReceta && (
              !isEditing ? (
                <div className="col-md-6">
                  <label htmlFor="cantidad" className="form-label">
                    Cantidad inicial <span className="text-danger">*</span>
                  </label>

                  {/* Si ya configuró envase, mostrar toggle igual que en edición */}
                  {mostrarConfigEnvase && form.cantidadPorEnvase ? (
                    <>
                      <div className="btn-group w-100 mb-2" role="group">
                        <input type="radio" className="btn-check" id="crear-modo-envases" checked={modoCreacion === "envases"} onChange={() => { setModoCreacion("envases"); setForm(p => ({ ...p, cantidad: "" })); }} disabled={uploading} />
                        <label className="btn btn-outline-primary btn-sm" htmlFor="crear-modo-envases">
                          Por {form.nombreEnvase || "envases"}
                        </label>
                        <input type="radio" className="btn-check" id="crear-modo-unidades" checked={modoCreacion === "unidades"} onChange={() => { setModoCreacion("unidades"); setCantidadEnvasesCrear(""); }} disabled={uploading} />
                        <label className="btn btn-outline-primary btn-sm" htmlFor="crear-modo-unidades">
                          Por {form.unidad || "unidades"}
                        </label>
                      </div>

                      {modoCreacion === "envases" ? (
                        <>
                          <div className="input-group">
                            <input
                              type="number"
                              min="1"
                              step="any"
                              className="form-control"
                              value={cantidadEnvasesCrear}
                              onChange={(e) => setCantidadEnvasesCrear(e.target.value)}
                              disabled={uploading}
                              placeholder="1"
                            />
                            <span className="input-group-text">{form.nombreEnvase || "envases"}</span>
                          </div>
                          {cantidadEnvasesCrear && Number(cantidadEnvasesCrear) > 0 && (
                            <small className="text-success fw-semibold">
                              = {Number(cantidadEnvasesCrear) * Number(form.cantidadPorEnvase)} {form.unidad}
                            </small>
                          )}
                        </>
                      ) : (
                        <div className="input-group">
                          <input id="cantidad" name="cantidad" type="number" min="1" step="any" className="form-control" value={form.cantidad} onChange={handleChange} disabled={uploading} placeholder="1" />
                          <span className="input-group-text">{form.unidad}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="input-group">
                      <input id="cantidad" name="cantidad" type="number" min="1" step="any" className="form-control" value={form.cantidad} onChange={handleChange} disabled={uploading} placeholder="1" />
                      {form.unidad && <span className="input-group-text">{form.unidad}</span>}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Stock actual */}
                  <div className="col-md-3">
                    <label className="form-label">Stock actual</label>
                    <div className="input-group">
                      <input type="number" className="form-control" value={producto.cantidad} disabled style={{ backgroundColor: "#f3f4f6", cursor: "not-allowed" }} />
                      {form.unidad && <span className="input-group-text" style={{ backgroundColor: "#f3f4f6" }}>{form.unidad}</span>}
                    </div>
                    <small className="text-muted">Solo lectura</small>
                  </div>

                  {/* Reposición: modo envases vs. unidades */}
                  {form.cantidadPorEnvase ? (
                    <div className="col-md-9">
                      <label className="form-label">Reposición de stock</label>
                      <div className="btn-group w-100 mb-2" role="group">
                        <input type="radio" className="btn-check" id="modo-envases" checked={modoReposicion === "envases"} onChange={() => { setModoReposicion("envases"); setForm(p => ({ ...p, cantidadAAgregar: "" })); }} disabled={uploading} />
                        <label className="btn btn-outline-primary btn-sm" htmlFor="modo-envases">
                          Por {form.nombreEnvase || "envases"}
                        </label>
                        <input type="radio" className="btn-check" id="modo-unidades" checked={modoReposicion === "unidades"} onChange={() => { setModoReposicion("unidades"); setEnvasesAAgregar(""); }} disabled={uploading} />
                        <label className="btn btn-outline-primary btn-sm" htmlFor="modo-unidades">
                          Por {form.unidad || "unidades"}
                        </label>
                      </div>

                      {modoReposicion === "envases" ? (
                        <>
                          <div className="input-group">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              className="form-control"
                              value={envasesAAgregar}
                              onChange={(e) => setEnvasesAAgregar(e.target.value)}
                              disabled={uploading}
                              placeholder="0"
                            />
                            <span className="input-group-text">{form.nombreEnvase || "envases"}</span>
                          </div>
                          {equivalenciaEnvases !== null && (
                            <small className="text-success fw-semibold">
                              = {equivalenciaEnvases} {form.unidad}
                            </small>
                          )}
                          <div><small className="text-muted">0 = sin reposición</small></div>
                        </>
                      ) : (
                        <>
                          <div className="input-group">
                            <input id="cantidadAAgregar" name="cantidadAAgregar" type="number" min="0" step="any" className="form-control" value={form.cantidadAAgregar} onChange={handleChange} disabled={uploading} placeholder="0" />
                            {form.unidad && <span className="input-group-text">{form.unidad}</span>}
                          </div>
                          <small className="text-muted">0 = sin reposición</small>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="col-md-3">
                      <label htmlFor="cantidadAAgregar" className="form-label">
                        Agregar ({form.unidad || "unidades"})
                      </label>
                      <div className="input-group">
                        <input id="cantidadAAgregar" name="cantidadAAgregar" type="number" min="0" step="any" className="form-control" value={form.cantidadAAgregar} onChange={handleChange} disabled={uploading} placeholder="0" />
                        {form.unidad && <span className="input-group-text">{form.unidad}</span>}
                      </div>
                      <small className="text-muted">0 = sin reposición</small>
                    </div>
                  )}
                </>
              )
            )}

            {/* Configurar envase — solo para productos simples */}
            {!esReceta && (
              <div className="col-12">
                {!mostrarConfigEnvase ? (
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setMostrarConfigEnvase(true)}
                    disabled={uploading}
                  >
                    ⚙️ Configurar envase (opcional)
                  </button>
                ) : (
                  <div className="envase-config-panel">
                    <div className="row g-2">
                      <div className="col-12">
                        <span className="fw-semibold" style={{ fontSize: "0.9rem" }}>Configuración de envase</span>
                        <small className="text-muted ms-2">Permite reponer por cajas, botellas, baldes, etc.</small>
                      </div>
                      <div className="col-md-6">
                        <label htmlFor="cantidadPorEnvase" className="form-label">Cantidad por envase</label>
                        <div className="input-group">
                          <input
                            id="cantidadPorEnvase"
                            name="cantidadPorEnvase"
                            type="number"
                            min="0"
                            step="any"
                            className="form-control"
                            value={form.cantidadPorEnvase}
                            onChange={handleChange}
                            disabled={uploading}
                            placeholder="Ej: 500"
                          />
                          {form.unidad && <span className="input-group-text">{form.unidad}</span>}
                        </div>
                        <small className="text-muted">
                          Cuántas {form.unidad || "unidades"} trae una {form.nombreEnvase || "envase"}.
                          {" "}Ejemplo: una botella de sirope trae 500 ml.
                        </small>
                      </div>
                      <div className="col-md-6">
                        <label htmlFor="nombreEnvase" className="form-label">Nombre del envase</label>
                        <input
                          id="nombreEnvase"
                          name="nombreEnvase"
                          type="text"
                          className="form-control"
                          value={form.nombreEnvase}
                          onChange={handleChange}
                          disabled={uploading}
                          placeholder="Ej: botella, balde, paquete"
                        />
                        <small className="text-muted">Cómo se llama el envase. Ejemplo: botella, balde, paquete.</small>
                      </div>
                      <div className="col-12">
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => {
                            setMostrarConfigEnvase(false);
                            setModoReposicion("unidades");
                            setEnvasesAAgregar("");
                            setModoCreacion("unidades");
                            setCantidadEnvasesCrear("");
                            setForm((p) => ({ ...p, cantidadPorEnvase: "", nombreEnvase: "" }));
                          }}
                          disabled={uploading}
                        >
                          Quitar configuración de envase
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Precio Compra: solo para productos simples */}
            {!esReceta && (
              <div className="col-md-4">
                <label htmlFor="precioCompra" className="form-label">Precio Compra <span className="text-danger">*</span></label>
                <input id="precioCompra" name="precioCompra" type="number" min="0" step="0.01" className="form-control" value={form.precioCompra} onChange={handleChange} disabled={uploading} placeholder="0.00" />
              </div>
            )}

            {/* Precio Venta */}
            <div className={esReceta ? "col-md-6" : "col-md-4"}>
              <label htmlFor="precioVenta" className="form-label">
                Precio Venta {form.seVende && <span className="text-danger">*</span>}
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
                disabled={uploading || !form.seVende}
                placeholder={form.seVende ? "0.00" : "No aplica"}
                style={!form.seVende ? { backgroundColor: "#f3f4f6", cursor: "not-allowed" } : {}}
              />
              {!form.seVende ? (
                <small className="text-muted">Este producto no se vende directamente, no necesita precio de venta.</small>
              ) : esReceta ? (
                <small className="text-muted">Las recetas no tienen precio de compra — su costo viene de los ingredientes.</small>
              ) : null}
            </div>

            {/* Disponible para venta */}
            <div className={`${esReceta ? "col-md-6" : "col-md-4"} d-flex align-items-end`}>
              <div className="form-check">
                <input id="seVende" name="seVende" type="checkbox" className="form-check-input" checked={form.seVende} onChange={handleChange} disabled={uploading} />
                <label className="form-check-label" htmlFor="seVende">Disponible para venta</label>
              </div>
            </div>

            {/* Editor de ingredientes: solo para recetas */}
            {esReceta && (
              <div className="col-12">
                <label className="form-label">
                  Ingredientes <span className="text-danger">*</span>
                  <small className="text-muted fw-normal ms-2">(mínimo 1, solo productos simples)</small>
                </label>

                {/* Buscador */}
                <div className="ingredient-search-wrapper mb-2" ref={ingredienteSearchRef}>
                  <div className="input-group">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Buscar ingrediente por nombre..."
                      value={ingredienteSearch}
                      onChange={handleIngredienteSearchChange}
                      disabled={uploading}
                      autoComplete="off"
                      onFocus={() => ingredientesResultados.length > 0 && setMostrarDropdown(true)}
                      onBlur={() => setTimeout(() => setMostrarDropdown(false), 200)}
                    />
                    {buscandoIngredientes && (
                      <span className="input-group-text">
                        <span className="spinner-border spinner-border-sm" role="status" />
                      </span>
                    )}
                  </div>

                  {/* Dropdown de resultados */}
                  {mostrarDropdown && ingredientesResultados.length > 0 && (
                    <div className="ingredient-dropdown">
                      {ingredientesResultados.map((ing) => (
                        <button
                          key={ing._id}
                          type="button"
                          className="ingredient-dropdown-item"
                          onMouseDown={() => agregarIngrediente(ing)}
                        >
                          <span className="ing-nombre">
                            {ing.nombre}
                            {ing.unidad && <span className="ing-unidad"> ({ing.unidad})</span>}
                          </span>
                          <span className="ing-stock">Stock: {ing.cantidad}{ing.unidad ? ` ${ing.unidad}` : ""}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {mostrarDropdown && !buscandoIngredientes && ingredienteSearch.trim() && ingredientesResultados.length === 0 && (
                    <div className="ingredient-dropdown">
                      <div className="ingredient-dropdown-empty">Sin resultados para "{ingredienteSearch}"</div>
                    </div>
                  )}
                </div>

                {/* Lista de ingredientes añadidos */}
                {receta.length === 0 ? (
                  <div className="alert alert-warning py-2 mb-0" style={{ fontSize: "0.88rem" }}>
                    Aún no hay ingredientes. Usa el buscador para agregar al menos uno.
                  </div>
                ) : (
                  <div className="ingredients-list">
                    {receta.map((ing) => (
                      <div key={ing.ingredienteId} className="ingredient-list-item">
                        <span className="ingredient-list-nombre">{ing.nombre}</span>
                        <div className="ingredient-list-controls">
                          <input
                            type="number"
                            min="0.001"
                            step="any"
                            className="form-control form-control-sm ingredient-qty-input"
                            value={ing.cantidad}
                            onChange={(e) => actualizarCantidadIngrediente(ing.ingredienteId, e.target.value)}
                            disabled={uploading}
                          />
                          {ing.unidad && (
                            <span className="ingredient-unidad-label">{ing.unidad}</span>
                          )}
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => quitarIngrediente(ing.ingredienteId)}
                            disabled={uploading}
                            title="Quitar ingrediente"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Imagen */}
            <div className="col-12">
              <label className="form-label">
                Imagen{" "}
                {!isEditing && !esReceta && <span className="text-danger">*</span>}
                {(isEditing || esReceta) && (
                  <span className="text-muted" style={{ fontSize: "0.85rem" }}>
                    {" "}(opcional{isEditing && !esReceta ? " - deja vacío para mantener la actual" : ""})
                  </span>
                )}
              </label>
              {isEditing && producto?.imagen && !form.imagen?.file && (
                <div className="current-image-preview mb-2">
                  <img src={producto.imagenOptimizada || producto.imagen} alt="Imagen actual" style={{ maxWidth: "150px", maxHeight: "150px", objectFit: "contain", border: "2px solid #e5e7eb", borderRadius: "8px", padding: "4px" }} />
                  <small className="d-block text-muted mt-1">📷 Imagen actual</small>
                </div>
              )}
              <ImageUploadWithCompression onChange={handleImageChange} onError={handleImageError} required={!isEditing && !esReceta} disabled={uploading} showPreview={true} ref={imageUploadRef} />
              <small className="form-text text-muted d-block mt-1">📷 Formatos: JPG, PNG, WebP · Tamaño máximo: 5 MB</small>
            </div>

            {/* Botones */}
            <div className="col-12">
              <div className="d-flex gap-2">
                <button type="submit" className="btn btn-primary flex-fill" disabled={uploading}>
                  {uploading ? (
                    <><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />{isEditing ? "Actualizando..." : "Guardando..."}</>
                  ) : (
                    <>{isEditing ? (esReceta ? "💾 Actualizar Receta" : "💾 Actualizar Producto") : (esReceta ? "➕ Agregar Receta" : "➕ Agregar Producto")}</>
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
