
// components/ImageUploadWithCompression.jsx
import { useState, useRef, forwardRef, useImperativeHandle, useCallback } from "react";
import imageCompression from "browser-image-compression";

const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const mb = bytes / (k * k);
  const kb = bytes / k;
  return mb >= 1 ? `${mb.toFixed(2)} MB` : `${kb.toFixed(2)} KB`;
};

const ImageUploadWithCompression = forwardRef(
  (
    {
      onChange,
      required = false,
      disabled = false,
      accept = "image/jpeg,image/jpg,image/png,image/webp",
      showPreview = true,
      onError = null,
    },
    ref,
  ) => {
    const [isCompressing, setIsCompressing] = useState(false);
    const [preview, setPreview] = useState(null);
    const [originalSize, setOriginalSize] = useState(null);
    const [compressedSize, setCompressedSize] = useState(null);
    const [errorMessage, setErrorMessage] = useState("");
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);

    const processFile = useCallback(async (file) => {
      if (!file) return;

      setIsCompressing(true);
      setErrorMessage("");

      // Limpiar preview anterior
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
      setOriginalSize(null);
      setCompressedSize(null);

      try {
        // Validar formato
        const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
        if (!allowedTypes.includes(file.type)) {
          throw new Error("Formato no válido. Solo JPG, PNG o WebP.");
        }

        setOriginalSize(file.size);
        console.log("📷 Imagen original:", formatFileSize(file.size));

        let finalFile = file;

        // Solo comprimir si supera 5MB
        if (file.size > 5 * 1024 * 1024) {
          console.log("🔄 Imagen >5MB, comprimiendo...");

          const options = {
            maxSizeMB: 4.5,
            maxWidthOrHeight: 1200,
            useWebWorker: true,
            fileType: "image/jpeg",
            initialQuality: 0.8,
          };

          finalFile = await imageCompression(file, options);
          console.log("✅ Compresión completada:", formatFileSize(finalFile.size));

          if (finalFile.size > 5 * 1024 * 1024) {
            throw new Error(`IMAGE_TOO_LARGE:${formatFileSize(finalFile.size)}`);
          }
        } else {
          console.log("✅ Imagen dentro del límite, sin compresión necesaria");
        }

        setCompressedSize(finalFile.size);

        // Generar preview local
        if (showPreview) {
          const previewUrl = URL.createObjectURL(finalFile);
          setPreview(previewUrl);
        }

        // ✅ CONVERTIR A BASE64 para evitar problemas de multipart/FormData
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result); // Incluye el prefijo data:image/...;base64,
          reader.onerror = () => reject(new Error("Error al leer el archivo"));
          reader.readAsDataURL(finalFile);
        });

        console.log("✅ Imagen convertida a base64, longitud:", base64.length);

        // Pasamos tanto el File como el base64 al padre
        onChange({ file: finalFile, base64 });

      } catch (error) {
        console.error("❌ Error procesando imagen:", error);

        if (error.message.includes("IMAGE_TOO_LARGE")) {
          const size = error.message.split(":")[1];
          setErrorMessage(
            `❌ La imagen sigue siendo demasiado grande (${size}).\nUsa una imagen menor a 5MB o comprímela con una app.`,
          );
        } else {
          setErrorMessage(`❌ ${error.message}`);
        }

        if (onError) onError(error);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } finally {
        setIsCompressing(false);
      }
    }, [preview, showPreview, onChange, onError]);

    const handleFileChange = (e) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    };

    const handleDrop = (e) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    };

    const handleDragOver = (e) => {
      e.preventDefault();
      setIsDragging(true);
    };

    const handleDragLeave = () => setIsDragging(false);

    const reset = () => {
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
      setOriginalSize(null);
      setCompressedSize(null);
      setErrorMessage("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    };

    useImperativeHandle(ref, () => ({ reset }));

    return (
      <div>
        {/* Zona de drag & drop */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !disabled && !isCompressing && fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${isDragging ? "#0d6efd" : errorMessage ? "#dc3545" : "#dee2e6"}`,
            borderRadius: "8px",
            padding: "20px",
            textAlign: "center",
            cursor: disabled || isCompressing ? "not-allowed" : "pointer",
            backgroundColor: isDragging ? "#f0f7ff" : "#fafafa",
            transition: "all 0.2s ease",
          }}
        >
          {/* Input oculto */}
          <input
            type="file"
            accept={accept}
            style={{ display: "none" }}
            onChange={handleFileChange}
            required={required}
            disabled={disabled || isCompressing}
            ref={fileInputRef}
          />

          {isCompressing ? (
            <div className="py-2">
              <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
              <span className="text-primary fw-medium">Procesando imagen...</span>
            </div>
          ) : preview && showPreview ? (
            /* Preview de la imagen */
            <div>
              <img
                src={preview}
                alt="Vista previa"
                style={{
                  maxWidth: "100%",
                  maxHeight: "200px",
                  objectFit: "contain",
                  borderRadius: "6px",
                  marginBottom: "8px",
                  display: "block",
                  marginLeft: "auto",
                  marginRight: "auto",
                }}
              />
              <small className="text-success d-block">
                ✅ {formatFileSize(compressedSize)}
                {originalSize && originalSize !== compressedSize && (
                  <span className="text-muted">
                    {" "}(original: {formatFileSize(originalSize)}, reducción:{" "}
                    {((1 - compressedSize / originalSize) * 100).toFixed(0)}%)
                  </span>
                )}
              </small>
              {!disabled && (
                <small className="text-muted d-block mt-1">
                  Haz clic para cambiar la imagen
                </small>
              )}
            </div>
          ) : (
            /* Estado vacío */
            <div className="py-2">
              <div style={{ fontSize: "2rem", marginBottom: "8px" }}>🖼️</div>
              <p className="mb-1 fw-medium text-secondary">
                Arrastra una imagen aquí o haz clic para seleccionar
              </p>
              <small className="text-muted">JPG, PNG, WebP · Máximo 5MB</small>
            </div>
          )}
        </div>

        {/* Mensaje de error */}
        {errorMessage && !isCompressing && (
          <div className="alert alert-danger mt-2 mb-0 py-2" style={{ whiteSpace: "pre-line", fontSize: "0.875rem" }}>
            {errorMessage}
          </div>
        )}
      </div>
    );
  },
);

ImageUploadWithCompression.displayName = "ImageUploadWithCompression";
export default ImageUploadWithCompression;
