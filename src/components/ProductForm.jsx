// src/components/ProductForm.jsx
//
// Un solo formulario para crear y editar productos, ingredientes y recetas.
//
// Por qué es así:
//
// · Todo en una sola pantalla, sin pasos. Con un asistente de "Siguiente" un
//   error podía quedar en una pantalla que ya no se estaba viendo y no había
//   forma de saber dónde buscar. Acá está todo a la vista y, si algo falta, el
//   formulario lleva solo hasta el campo que falta.
//
// · No se pregunta la unidad de medida. Se pregunta qué es la cosa (bebida,
//   helado a granel, desechable…) y de ahí sale la unidad, el salto de los
//   botones y el envase más probable. Nadie tiene que pensar en gramos.
//
// · Las cantidades tienen un solo control: menos, el número, más. El número se
//   puede escribir o mover con los botones.
//
// · Dos alertas y un panel de cuentas para el caso de los 44 vasos: escribir el
//   tamaño del paquete en vez del consumo por unidad hizo que una receta
//   costara ₡2.173 y se vendiera en ₡700, y nada lo avisaba.

import { useState, useRef, useEffect, useCallback } from "react";
import axios from "axios";
import ImageUploadWithCompression from "./ImageUploadWithCompression";
import SelectorCantidad from "./inventario/SelectorCantidad";
import PanelRentabilidad from "./inventario/PanelRentabilidad";
import {
  TIPOS_ENVASE,
  TIPOS_PRODUCTO,
  tipoProductoDe,
  normalizarUnidad,
  normalizarEnvase,
  unidadInfo,
  labelUnidad,
  unidadSingular,
  cuantos,
  labelEnvase,
  formatearMonto,
  formatearCantidad,
  formatearNumero,
} from "../constants/inventario";
import { CATEGORIAS, categoriaDe, categoriaInfo } from "../constants/categorias";
import { analizarReceta } from "../utils/stock";
import "../styles/ProductForm.css";

// Cuánto mueven los botones −/+ según la unidad. El contenido de un balde se
// mueve de 100 en 100 gramos; el stock, de 50 en 50.
const PASO_POR_ENVASE = {
  unidades: 1,
  bolas: 1,
  gramos: 100,
  kilogramos: 1,
  mililitros: 50,
  litros: 1,
};

const PASO_STOCK = {
  unidades: 5,
  bolas: 5,
  gramos: 50,
  kilogramos: 1,
  mililitros: 50,
  litros: 1,
};

const tablaPara = (tabla, unidad) => tabla[normalizarUnidad(unidad)] || tabla.unidades;

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
    // En qué pestaña de Ventas aparece. Vacío = que decida el backend: él
    // clasifica por el nombre al guardar. Elegirla acá es para corregirlo.
    categoria: "",
  });
  // Qué es el producto (bebida, helado a granel, desechable…). De acá sale la
  // unidad; el usuario nunca la elige a mano.
  const [tipoProducto, setTipoProducto] = useState(null);
  const [mostrarConfigEnvase, setMostrarConfigEnvase] = useState(false);
  const [modoReposicion, setModoReposicion] = useState("unidades"); // "envases" | "unidades"
  const [envasesAAgregar, setEnvasesAAgregar] = useState("");
  const [modoCreacion, setModoCreacion] = useState("unidades"); // para cantidad inicial
  const [cantidadEnvasesCrear, setCantidadEnvasesCrear] = useState("");
  const [precioEnvase, setPrecioEnvase] = useState("");
  const [toast, setToast] = useState({ show: false, text: "", type: "" });
  const imageUploadRef = useRef(null);
  const cuerpoRef = useRef(null);

  // Receta: cada línea guarda también los datos del ingrediente (stock, costo,
  // envase) porque son los que alimentan las alertas y el panel de cuentas.
  const [receta, setReceta] = useState([]);
  const [ingredientesTodos, setIngredientesTodos] = useState([]);
  const [cargandoIngredientes, setCargandoIngredientes] = useState(false);
  const [ingredientesCargados, setIngredientesCargados] = useState(false);
  const [mostrarPicker, setMostrarPicker] = useState(false);
  const [filtroIngrediente, setFiltroIngrediente] = useState("");
  // Solo se usa si el listado completo no está disponible: entonces sí hay que
  // teclear para buscar contra el backend.
  const [modoBusquedaServidor, setModoBusquedaServidor] = useState(false);
  const busquedaTimeoutRef = useRef(null);

  const esReceta = form.tipo === "receta";

  // ===== CARGA INICIAL EN EDICIÓN =====

  useEffect(() => {
    if (isEditing && producto) {
      setForm({
        nombre: producto.nombre || "",
        cantidad: producto.cantidad ?? "",
        cantidadAAgregar: "",
        precioCompra: producto.precioCompra ?? "",
        precioVenta: producto.precioVenta ?? "",
        imagen: null,
        seVende: producto.seVende ?? true,
        tipo: producto.tipo || "producto",
        unidad: normalizarUnidad(producto.unidad || "unidades"),
        cantidadPorEnvase: producto.cantidadPorEnvase ?? "",
        nombreEnvase: normalizarEnvase(producto.nombreEnvase || ""),
        // Un producto viejo, sin el campo todavía, arranca en "Automática":
        // así guardarlo sin tocar nada deja que el backend lo clasifique, en
        // vez de fijarle "Otros" para siempre sin que nadie lo haya elegido.
        categoria: producto.categoria ? categoriaDe(producto) : "",
      });
      setTipoProducto(tipoProductoDe(producto.unidad)?.id || null);
      if (producto.cantidadPorEnvase) {
        setMostrarConfigEnvase(true);
        if (producto.precioCompra && producto.cantidadPorEnvase) {
          setPrecioEnvase(
            String(
              Math.round(
                Number(producto.precioCompra) * Number(producto.cantidadPorEnvase),
              ),
            ),
          );
        }
      }
      if (producto.tipo === "receta" && Array.isArray(producto.receta)) {
        setReceta(
          producto.receta.map((ing) => {
            const ref = ing.ingredienteId;
            const obj = ref && typeof ref === "object" ? ref : null;
            return {
              ingredienteId: obj ? obj._id : ref,
              nombre: ing.nombre || obj?.nombre || "Ingrediente",
              unidad: normalizarUnidad(ing.unidad || obj?.unidad || "unidades"),
              cantidad: Number(ing.cantidad) || 0,
              stock: obj ? Number(obj.cantidad) || 0 : null,
              precioCompra: obj ? Number(obj.precioCompra) || 0 : null,
              cantidadPorEnvase: obj?.cantidadPorEnvase ?? null,
              nombreEnvase: obj?.nombreEnvase ?? null,
            };
          }),
        );
      }
    }
  }, [isEditing, producto]);

  const showToast = (text, type = "success") => {
    setToast({ show: true, text, type });
    setTimeout(() => setToast({ show: false, text: "", type: "" }), 10000);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: type === "checkbox" ? checked : value };
      if (name === "seVende" && !checked) next.precioVenta = "";
      return next;
    });
  };

  // Elegir el tipo fija la unidad y, si hace falta, sugiere el envase.
  const elegirTipoProducto = (tipo) => {
    setTipoProducto(tipo.id);
    setForm((p) => ({
      ...p,
      unidad: tipo.unidad,
      nombreEnvase: p.nombreEnvase || tipo.envaseSugerido || "",
    }));
  };

  const handleImageChange = ({ file, base64 }) => {
    setForm((prev) => ({ ...prev, imagen: { file, base64 } }));
  };

  const handleImageError = (error) => {
    console.error("Error procesando imagen:", error);
  };

  // ===== INGREDIENTES =====

  // Traemos el catálogo completo una sola vez para que elegir un ingrediente no
  // exija teclear. Si el endpoint no devuelve la lista sin `search`, caemos a
  // búsqueda por servidor.
  const cargarIngredientes = useCallback(async () => {
    if (ingredientesCargados || cargandoIngredientes) return;
    setCargandoIngredientes(true);
    try {
      const token = localStorage.getItem("token");
      const apiUrl = import.meta.env.VITE_API_URL;
      const response = await axios.get(`${apiUrl}/api/products/ingredientes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const lista = response.data.ingredientes || [];
      setIngredientesTodos(lista);
      setModoBusquedaServidor(lista.length === 0);
    } catch (error) {
      console.error("Error cargando ingredientes:", error);
      setModoBusquedaServidor(true);
    } finally {
      setCargandoIngredientes(false);
      setIngredientesCargados(true);
    }
  }, [ingredientesCargados, cargandoIngredientes]);

  useEffect(() => {
    if (esReceta) cargarIngredientes();
  }, [esReceta, cargarIngredientes]);

  const buscarEnServidor = useCallback(async (termino) => {
    if (!termino.trim()) return;
    setCargandoIngredientes(true);
    try {
      const token = localStorage.getItem("token");
      const apiUrl = import.meta.env.VITE_API_URL;
      const response = await axios.get(`${apiUrl}/api/products/ingredientes`, {
        params: { search: termino },
        headers: { Authorization: `Bearer ${token}` },
      });
      setIngredientesTodos(response.data.ingredientes || []);
    } catch (error) {
      console.error("Error buscando ingredientes:", error);
    } finally {
      setCargandoIngredientes(false);
    }
  }, []);

  const handleFiltroChange = (e) => {
    const value = e.target.value;
    setFiltroIngrediente(value);
    if (!modoBusquedaServidor) return;
    if (busquedaTimeoutRef.current) clearTimeout(busquedaTimeoutRef.current);
    busquedaTimeoutRef.current = setTimeout(() => buscarEnServidor(value), 400);
  };

  const agregarIngrediente = (ing) => {
    if (receta.find((r) => r.ingredienteId === ing._id)) return;
    const unidad = normalizarUnidad(ing.unidad || "unidades");
    setReceta((prev) => [
      ...prev,
      {
        ingredienteId: ing._id,
        nombre: ing.nombre,
        unidad,
        // Arranca en una cantidad chica: lo normal es usar poco de cada cosa,
        // no un paquete entero.
        cantidad: unidadInfo(unidad).inicial,
        stock: Number(ing.cantidad) || 0,
        precioCompra: Number(ing.precioCompra) || 0,
        cantidadPorEnvase: ing.cantidadPorEnvase ?? null,
        nombreEnvase: ing.nombreEnvase ?? null,
      },
    ]);
    setMostrarPicker(false);
    setFiltroIngrediente("");
  };

  const quitarIngrediente = (ingredienteId) => {
    setReceta((prev) => prev.filter((r) => r.ingredienteId !== ingredienteId));
  };

  const actualizarCantidadIngrediente = (ingredienteId, valor) => {
    setReceta((prev) =>
      prev.map((r) =>
        r.ingredienteId === ingredienteId ? { ...r, cantidad: valor } : r,
      ),
    );
  };

  const yaAgregados = new Set(receta.map((r) => r.ingredienteId));
  const ingredientesDisponibles = ingredientesTodos
    .filter((i) => !yaAgregados.has(i._id))
    .filter((i) =>
      modoBusquedaServidor || !filtroIngrediente.trim()
        ? true
        : i.nombre.toLowerCase().includes(filtroIngrediente.trim().toLowerCase()),
    );

  // ===== CUENTAS EN VIVO =====

  const lineasParaAnalisis = receta.map((r) => ({
    nombre: r.nombre,
    unidad: r.unidad,
    cantidad: Number(r.cantidad) || 0,
    ingredienteId: {
      _id: r.ingredienteId,
      nombre: r.nombre,
      unidad: r.unidad,
      cantidad: r.stock,
      precioCompra: r.precioCompra,
      cantidadPorEnvase: r.cantidadPorEnvase,
      nombreEnvase: r.nombreEnvase,
    },
  }));

  const analisis = analizarReceta(lineasParaAnalisis, form.precioVenta);

  const costoUnitarioSimple =
    form.cantidadPorEnvase && precioEnvase !== "" && Number(form.cantidadPorEnvase) > 0
      ? Number(precioEnvase) / Number(form.cantidadPorEnvase)
      : Number(form.precioCompra) || 0;

  const gananciaSimple =
    form.precioVenta === "" ? null : Number(form.precioVenta) - costoUnitarioSimple;

  // ===== ALERTAS DE UNA LÍNEA DE RECETA =====

  const alertasDeLinea = (linea) => {
    const alertas = [];
    const cantidad = Number(linea.cantidad) || 0;
    const u = labelUnidad(linea.unidad);

    // Alerta 1 — la que faltaba el día de los 44 vasos.
    if (
      linea.cantidadPorEnvase &&
      Number(linea.cantidadPorEnvase) > 0 &&
      cantidad >= Number(linea.cantidadPorEnvase)
    ) {
      const envase = (labelEnvase(linea.nombreEnvase) || "envase").toLowerCase();
      const veces = cantidad / Number(linea.cantidadPorEnvase);
      alertas.push({
        tipo: "envase",
        texto:
          veces >= 2
            ? `¿Seguro? Cada unidad se llevaría ${formatearCantidad(veces)} ${envase}s enteros de ${linea.nombre} (${formatearCantidad(linea.cantidadPorEnvase)} ${u} cada uno).`
            : `¿Seguro que cada unidad se lleva un ${envase} entero de ${linea.nombre}? Un ${envase} trae ${formatearCantidad(linea.cantidadPorEnvase)} ${u}.`,
      });
    }

    // Alerta 2 — el stock no alcanza ni para una.
    if (linea.stock !== null && cantidad > linea.stock) {
      alertas.push({
        tipo: "agotado",
        texto: `No alcanza: solo quedan ${formatearCantidad(linea.stock)} ${u} de ${linea.nombre}. La receta va a quedar agotada y no se va a poder vender.`,
      });
    }

    return alertas;
  };

  // ===== VALIDACIÓN =====
  // Cada problema sabe a qué campo pertenece, para poder llevar al usuario ahí.

  const unidadFueraDeCatalogo = isEditing && !tipoProductoDe(form.unidad);

  // Al editar, ¿la opción elegida cambiaría la unidad con la que ya está
  // guardado el producto?
  const cambiaLaUnidad =
    isEditing &&
    !esReceta &&
    normalizarUnidad(producto.unidad) !== normalizarUnidad(form.unidad);

  const revisarTodo = () => {
    const problemas = [];
    const agregar = (texto, ancla) => problemas.push({ texto, ancla });

    if (!form.nombre.trim()) agregar("Escribí el nombre.", "nombre");

    // Al crear, el backend exige la categoría (400 CATEGORIA_REQUERIDA) y ya no
    // la deduce del nombre: probó y fallaba justo con las marcas — "Crunchy" y
    // "Chokies" son helados aunque suenen a galleta. Se pide para todo, también
    // para recetas e ingredientes: las dos ramas del POST la exigen. Se valida
    // acá para no mostrar un error del servidor por un campo que está a la vista.
    if (!isEditing && !form.categoria) {
      agregar("Elegí en qué categoría se vende.", "campo-categoria");
    }

    if (esReceta) {
      if (receta.length === 0) {
        agregar("Agregá al menos una cosa a la receta.", "campo-ingredientes");
      } else {
        const sinCantidad = receta.filter((r) => !(Number(r.cantidad) > 0));
        if (sinCantidad.length > 0) {
          agregar(
            `Poné cuánto lleva de: ${sinCantidad.map((r) => r.nombre).join(", ")}.`,
            "campo-ingredientes",
          );
        }
      }
    } else {
      if (!tipoProducto && !unidadFueraDeCatalogo) {
        agregar("Elegí qué es (bebida, helado, desechable…).", "campo-que-es");
      }

      if (mostrarConfigEnvase) {
        if (!form.nombreEnvase) agregar("Elegí en qué viene.", "nombreEnvase");
        if (!(Number(form.cantidadPorEnvase) > 0)) {
          agregar(
            `Poné ${cuantos(form.unidad).toLowerCase()} ${labelUnidad(form.unidad)} trae cada ${(labelEnvase(form.nombreEnvase) || "envase").toLowerCase()}.`,
            "campo-envase-contenido",
          );
        }
      }

      if (!isEditing) {
        if (modoCreacion === "envases") {
          if (!(Number(cantidadEnvasesCrear) > 0)) {
            agregar(
              `Poné cuántos ${(labelEnvase(form.nombreEnvase) || "envase").toLowerCase()}s tenés.`,
              "campo-stock",
            );
          }
        } else if (!(Number(form.cantidad) > 0)) {
          agregar(
            `Poné ${cuantos(form.unidad).toLowerCase()} ${labelUnidad(form.unidad)} tenés.`,
            "campo-stock",
          );
        }
      } else if (modoReposicion === "envases") {
        const env = Number(envasesAAgregar);
        if (envasesAAgregar !== "" && (isNaN(env) || env < 0)) {
          agregar("Lo que compraste no puede ser negativo.", "campo-stock");
        }
      } else {
        const aAgregar = Number(form.cantidadAAgregar);
        if (form.cantidadAAgregar !== "" && (isNaN(aAgregar) || aAgregar < 0)) {
          agregar("Lo que compraste no puede ser negativo.", "campo-stock");
        }
      }

      if (form.cantidadPorEnvase) {
        if (precioEnvase === "") {
          agregar(
            `Poné cuánto pagaste por el ${(labelEnvase(form.nombreEnvase) || "envase").toLowerCase()}.`,
            "precioEnvase",
          );
        } else if (Number(precioEnvase) < 0) {
          agregar("El precio no puede ser negativo.", "precioEnvase");
        }
      } else if (form.precioCompra === "") {
        agregar(`Poné cuánto te cuesta cada ${unidadSingular(form.unidad)}.`, "precioCompra");
      } else if (Number(form.precioCompra) < 0) {
        agregar("El precio no puede ser negativo.", "precioCompra");
      }
    }

    if (form.seVende) {
      if (form.precioVenta === "") {
        agregar('Poné a cuánto lo vendés, o apagá "Se vende en el mostrador".', "precioVenta");
      } else if (Number(form.precioVenta) < 0) {
        agregar("El precio de venta no puede ser negativo.", "precioVenta");
      }
    }

    if (!isEditing && !esReceta && !form.imagen?.base64) {
      agregar("Elegí una foto.", "campo-imagen");
    }
    if (form.imagen?.file && form.imagen.file.size > 5 * 1024 * 1024) {
      const mb = (form.imagen.file.size / (1024 * 1024)).toFixed(2);
      agregar(`La foto es muy grande (${mb} MB). El límite es 5 MB.`, "campo-imagen");
    }

    return problemas;
  };

  // Lleva la vista al primer campo que falta, lo resalta y le pone el foco.
  // Es lo que evita el "algo falló y no sé dónde".
  const irAlProblema = (ancla) => {
    if (!ancla) return;
    const el = document.getElementById(ancla);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("campo-con-error");
    setTimeout(() => el.classList.remove("campo-con-error"), 2500);
    const enfocable = el.matches("input, select, textarea")
      ? el
      : el.querySelector("input, select, textarea, button");
    if (enfocable) setTimeout(() => enfocable.focus({ preventScroll: true }), 400);
  };

  // ===== GUARDAR =====

  const getUserFriendlyErrorMessage = (error) => {
    if (!error.response) {
      if (error.code === "ECONNABORTED")
        return "Tardó demasiado. Probá con una foto más pequeña.";
      if (error.code === "ERR_NETWORK" || error.message === "Network Error")
        return "No hay conexión con el servidor. Revisá el internet.";
      return "No se pudo guardar. Revisá la conexión.";
    }
    const status = error.response.status;
    const errorData = error.response.data;
    switch (status) {
      case 400:
        return errorData?.error
          ? `No se pudo guardar: ${errorData.error}`
          : "Hay algo mal en los datos. Revisá los campos.";
      case 401:
        return "El servidor no autorizó guardar. Probá de nuevo.";
      case 403:
        return "No tenés permiso para hacer esto.";
      case 413:
        return "La foto es demasiado grande. Usá una más pequeña.";
      case 415:
        return "Ese tipo de foto no sirve. Usá JPG, PNG o WebP.";
      case 500:
        return errorData?.error
          ? `Error del servidor: ${errorData.error}`
          : "Error del servidor. Intentá de nuevo.";
      default:
        return errorData?.error ? `Error: ${errorData.error}` : `Error inesperado (${status}).`;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (uploading) return;

    const problemas = revisarTodo();
    if (problemas.length > 0) {
      showToast(
        problemas.length === 1
          ? problemas[0].texto
          : `Falta esto:\n${problemas.map((p) => `• ${p.texto}`).join("\n")}`,
        "error",
      );
      if (cuerpoRef.current) cuerpoRef.current.scrollTo({ top: 0, behavior: "smooth" });
      // Primero se lee el aviso arriba, después se va al campo que falta.
      setTimeout(() => irAlProblema(problemas[0].ancla), 700);
      return;
    }

    setUploading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        showToast("Tenés que iniciar sesión.", "error");
        setUploading(false);
        return;
      }
      const apiUrl = import.meta.env.VITE_API_URL;
      if (!apiUrl) {
        showToast("Falta configurar la dirección del servidor.", "error");
        setUploading(false);
        return;
      }

      const payload = {
        nombre: form.nombre,
        precioVenta: form.precioVenta === "" ? 0 : form.precioVenta,
        seVende: form.seVende,
      };

      // Solo se manda si se eligió a mano. Sin este campo el backend clasifica
      // solo; mandarlo vacío o adivinado desde acá pisaría esa decisión.
      if (form.categoria) payload.categoria = form.categoria;

      if (esReceta) {
        payload.tipo = "receta";
        payload.receta = receta.map(({ ingredienteId, cantidad }) => ({
          ingredienteId:
            typeof ingredienteId === "object" ? ingredienteId._id : ingredienteId,
          cantidad: Number(cantidad),
        }));
      } else {
        if (form.cantidadPorEnvase && precioEnvase !== "") {
          payload.precioCompra = Math.round(
            Number(precioEnvase) / Number(form.cantidadPorEnvase),
          );
        } else {
          payload.precioCompra = form.precioCompra;
        }
        // Se guarda el valor canónico en minúscula: es lo que evita que en la
        // base vuelvan a convivir "Gramos" y "gramos".
        payload.unidad = normalizarUnidad(form.unidad) || "unidades";
        payload.cantidadPorEnvase =
          form.cantidadPorEnvase !== "" && form.cantidadPorEnvase !== null
            ? Number(form.cantidadPorEnvase)
            : null;
        payload.nombreEnvase = normalizarEnvase(form.nombreEnvase) || "";

        if (!isEditing) {
          payload.cantidad =
            modoCreacion === "envases" && form.cantidadPorEnvase
              ? Number(cantidadEnvasesCrear) * Number(form.cantidadPorEnvase)
              : form.cantidad;
        } else if (modoReposicion === "envases" && envasesAAgregar !== "") {
          payload.envasesAAgregar = Number(envasesAAgregar) || 0;
        } else {
          payload.cantidadAAgregar = Number(form.cantidadAAgregar) || 0;
        }
      }

      if (form.imagen?.base64) {
        payload.imagenBase64 = form.imagen.base64;
        payload.imagenNombre = form.imagen.file.name;
        payload.imagenMimeType = form.imagen.file.type;
      }

      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 120000,
      };

      if (isEditing) {
        await axios.put(`${apiUrl}/api/products/${producto._id}`, payload, config);
        showToast(esReceta ? "Receta guardada." : "Producto guardado.");
      } else {
        await axios.post(`${apiUrl}/api/products`, payload, config);
        showToast(esReceta ? "Receta creada." : "Producto creado.");
      }
      setTimeout(() => onSuccess && onSuccess(), 1000);
    } catch (error) {
      console.error("Error al guardar:", error);
      showToast(getUserFriendlyErrorMessage(error), "error");
      if (cuerpoRef.current) cuerpoRef.current.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setUploading(false);
    }
  };

  // ===== TEXTOS QUE DEPENDEN DE LA UNIDAD =====

  const uLabel = labelUnidad(form.unidad);
  const uSingular = unidadSingular(form.unidad);
  const uCuantos = cuantos(form.unidad);
  const envaseLabel = (labelEnvase(form.nombreEnvase) || "envase").toLowerCase();

  const envaseActual = normalizarEnvase(form.nombreEnvase);
  const opcionesEnvase =
    !envaseActual || TIPOS_ENVASE.some((en) => en.id === envaseActual)
      ? TIPOS_ENVASE
      : [...TIPOS_ENVASE, { id: envaseActual, label: labelEnvase(envaseActual) }];

  const equivalenciaEnvases =
    modoReposicion === "envases" &&
    envasesAAgregar !== "" &&
    Number(envasesAAgregar) > 0 &&
    form.cantidadPorEnvase
      ? Number(envasesAAgregar) * Number(form.cantidadPorEnvase)
      : null;

  const tituloModal = isEditing
    ? esReceta
      ? "Editar receta"
      : "Editar producto"
    : "Producto nuevo";

  return (
    <div className="product-form-overlay">
      <div className="product-form-modal">
        <div className="product-form-header">
          <h2 className="product-form-title">{tituloModal}</h2>
          <button
            className="btn-close"
            onClick={onClose}
            aria-label="Cerrar"
            disabled={uploading}
          />
        </div>

        <form
          className="product-form-body"
          onSubmit={handleSubmit}
          ref={cuerpoRef}
          noValidate
        >
          {toast.show && (
            <div className={`toast-custom ${toast.type} toast-form`}>{toast.text}</div>
          )}

          {/* ══════════ 1 · QUÉ VAS A GUARDAR ══════════ */}
          <section className="bloque-form">
            <h3 className="bloque-titulo">
              <span className="bloque-numero">1</span> Qué vas a guardar
            </h3>

            <div className="bloque-campos">
              {!isEditing ? (
                <div className="campo-bloque">
                  <div className="tarjetas-tipo">
                    <button
                      type="button"
                      className={`tarjeta-tipo ${!esReceta ? "activa" : ""}`}
                      onClick={() => setForm((p) => ({ ...p, tipo: "producto" }))}
                      disabled={uploading}
                    >
                      <span className="tarjeta-tipo-titulo">Algo que comprás</span>
                      <span className="tarjeta-tipo-desc">
                        Vasos, gaseosas, un balde de helado. Tiene su propio stock.
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`tarjeta-tipo ${esReceta ? "activa" : ""}`}
                      onClick={() => setForm((p) => ({ ...p, tipo: "receta" }))}
                      disabled={uploading}
                    >
                      <span className="tarjeta-tipo-titulo">Algo que preparás</span>
                      <span className="tarjeta-tipo-desc">
                        Se arma con varias cosas. El stock se calcula solo.
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="campo-bloque">
                  <span className={`etiqueta-tipo ${esReceta ? "receta" : ""}`}>
                    {esReceta ? "Se prepara con ingredientes" : "Producto"}
                  </span>
                </div>
              )}

              <div className="campo-bloque">
                <label htmlFor="nombre" className="form-label">
                  ¿Cómo se llama?
                </label>
                <input
                  id="nombre"
                  name="nombre"
                  type="text"
                  className="form-control form-control-lg"
                  value={form.nombre}
                  onChange={handleChange}
                  disabled={uploading}
                  placeholder={esReceta ? "Cono de vainilla" : "Vasos"}
                  autoComplete="off"
                />
              </div>
            </div>
          </section>

          {/* ══════════ 2 · QUÉ ES Y CUÁNTO TENÉS (productos) ══════════ */}
          {!esReceta && (
            <section className="bloque-form">
              <h3 className="bloque-titulo">
                <span className="bloque-numero">2</span> Qué es y cuánto tenés
              </h3>

              <div className="bloque-campos">
                <div className="campo-bloque" id="campo-que-es">
                  <label className="form-label">¿Qué es?</label>
                  <div className="tarjetas-tipo tarjetas-tipo--compacto">
                    {TIPOS_PRODUCTO.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className={`tarjeta-tipo ${tipoProducto === t.id ? "activa" : ""}`}
                        onClick={() => elegirTipoProducto(t)}
                        disabled={uploading}
                      >
                        <span className="tarjeta-tipo-titulo">{t.label}</span>
                        <span className="tarjeta-tipo-desc">{t.ejemplo}</span>
                      </button>
                    ))}
                  </div>
                  {/* Cambiar la unidad de algo que ya se usa en recetas cambia el
                      significado de las cantidades guardadas: si "Helado" pasa de
                      gramos a unidades, una receta que usaba 100 pasa a querer
                      100 unidades. Avisamos antes de que se guarde. */}
                  {cambiaLaUnidad ? (
                    <small className="texto-aviso">
                      Ojo: esto se contaba en {labelUnidad(producto.unidad)} y ahora
                      pasaría a {uLabel}. Las recetas que lo usan van a leer sus
                      cantidades en {uLabel}. Si no querés eso, dejá la opción como
                      estaba.
                    </small>
                  ) : tipoProducto ? (
                    <small className="texto-apoyo">Se va a contar en {uLabel}.</small>
                  ) : unidadFueraDeCatalogo ? (
                    <small className="texto-apoyo">
                      Hoy se cuenta en {uLabel}. Si elegís una opción de arriba, esa
                      medida cambia.
                    </small>
                  ) : (
                    <small className="texto-apoyo">
                      Con esto el sistema sabe si se cuenta de una en una o si se pesa.
                    </small>
                  )}
                </div>

                {/* En qué pestaña de Ventas aparece. Se pregunta siempre, también
                    para recetas e ingredientes: el backend ya no la deduce del
                    nombre y la exige al crear. Nadie la adivina mejor que el
                    dueño — "Crunchy" y "Chokies" son helados aunque suenen a
                    galleta, y un "Chao" no se deduce de ninguna manera. */}
                <div className="campo-bloque" id="campo-categoria">
                  <label className="form-label">¿En qué categoría va?</label>
                  <div className="chips-categoria">
                    {CATEGORIAS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={`chip-categoria ${form.categoria === c.id ? "activa" : ""}`}
                        onClick={() => setForm((p) => ({ ...p, categoria: c.id }))}
                        disabled={uploading}
                      >
                        <span aria-hidden="true">{c.icono}</span> {c.label}
                      </button>
                    ))}
                  </div>
                  <small className="texto-apoyo">
                    {!form.seVende
                      ? "No se vende en el mostrador, así que no va a aparecer en ninguna pestaña — pero hay que elegirla igual."
                      : form.categoria
                        ? `Va a aparecer en la pestaña ${categoriaInfo(form.categoria).label} de Ventas.`
                        : "Es la pestaña de Ventas donde el empleado lo va a buscar."}
                  </small>
                </div>

                <div className="campo-bloque">
                  <label className="interruptor">
                    <input
                      type="checkbox"
                      checked={mostrarConfigEnvase}
                      onChange={(e) => {
                        if (!e.target.checked) {
                          setModoReposicion("unidades");
                          setEnvasesAAgregar("");
                          setModoCreacion("unidades");
                          setCantidadEnvasesCrear("");
                          setPrecioEnvase("");
                          setForm((p) => ({
                            ...p,
                            cantidadPorEnvase: "",
                            nombreEnvase: "",
                          }));
                        }
                        setMostrarConfigEnvase(e.target.checked);
                      }}
                      disabled={uploading}
                    />
                    <span className="interruptor-visual" aria-hidden="true" />
                    <span className="interruptor-texto">
                      <strong>Lo compro por paquete, caja o balde</strong>
                      <small>Si lo comprás de a uno, dejalo apagado.</small>
                    </span>
                  </label>
                </div>

                {mostrarConfigEnvase && (
                  <div className="envase-config-panel campo-bloque">
                    <div className="campo-bloque">
                      <label htmlFor="nombreEnvase" className="form-label">
                        ¿En qué viene?
                      </label>
                      <select
                        id="nombreEnvase"
                        name="nombreEnvase"
                        className="form-select"
                        value={envaseActual}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, nombreEnvase: e.target.value }))
                        }
                        disabled={uploading}
                      >
                        <option value="">Elegí una opción…</option>
                        {opcionesEnvase.map((en) => (
                          <option key={en.id} value={en.id}>
                            {en.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="campo-bloque" id="campo-envase-contenido">
                      <label className="form-label">
                        ¿{uCuantos} {uLabel} trae cada {envaseLabel}?
                      </label>
                      <SelectorCantidad
                        valor={form.cantidadPorEnvase}
                        onChange={(v) => setForm((p) => ({ ...p, cantidadPorEnvase: v }))}
                        unidad={form.unidad}
                        paso={tablaPara(PASO_POR_ENVASE, form.unidad)}
                        min={0}
                        disabled={uploading}
                      />
                    </div>
                  </div>
                )}

                {!isEditing ? (
                  <div className="campo-bloque" id="campo-stock">
                    <label className="form-label">
                      ¿{uCuantos} {uLabel} tenés?
                    </label>

                    {mostrarConfigEnvase && Number(form.cantidadPorEnvase) > 0 && (
                      <div className="toggle-modo">
                        <button
                          type="button"
                          className={`btn-modo ${modoCreacion === "envases" ? "activo" : ""}`}
                          onClick={() => {
                            setModoCreacion("envases");
                            setForm((p) => ({ ...p, cantidad: "" }));
                          }}
                          disabled={uploading}
                        >
                          Contar {envaseLabel}s
                        </button>
                        <button
                          type="button"
                          className={`btn-modo ${modoCreacion === "unidades" ? "activo" : ""}`}
                          onClick={() => {
                            setModoCreacion("unidades");
                            setCantidadEnvasesCrear("");
                          }}
                          disabled={uploading}
                        >
                          Contar {uLabel}
                        </button>
                      </div>
                    )}

                    {modoCreacion === "envases" &&
                    mostrarConfigEnvase &&
                    Number(form.cantidadPorEnvase) > 0 ? (
                      <SelectorCantidad
                        valor={cantidadEnvasesCrear}
                        onChange={setCantidadEnvasesCrear}
                        unidad={form.unidad}
                        paso={1}
                        sufijo={envaseLabel}
                        disabled={uploading}
                        ayuda={
                          Number(cantidadEnvasesCrear) > 0
                            ? `Son ${formatearCantidad(Number(cantidadEnvasesCrear) * Number(form.cantidadPorEnvase))} ${uLabel} en total.`
                            : null
                        }
                      />
                    ) : (
                      <SelectorCantidad
                        valor={form.cantidad}
                        onChange={(v) => setForm((p) => ({ ...p, cantidad: v }))}
                        unidad={form.unidad}
                        paso={tablaPara(PASO_STOCK, form.unidad)}
                        disabled={uploading}
                      />
                    )}
                  </div>
                ) : (
                  <>
                    <div className="campo-bloque campo-medio dato-solo-lectura">
                      <span className="dato-label">Tenés ahora</span>
                      <span className="dato-valor">
                        {formatearCantidad(producto.cantidad)} {uLabel}
                        {Number(form.cantidadPorEnvase) > 0 && (
                          <small className="texto-apoyo">
                            {" "}
                            ≈{" "}
                            {formatearNumero(
                              producto.cantidad / Number(form.cantidadPorEnvase),
                              1,
                            )}{" "}
                            {envaseLabel}
                          </small>
                        )}
                      </span>
                    </div>

                    <div className="campo-bloque campo-medio" id="campo-stock">
                      <label className="form-label">¿Compraste más?</label>

                      {Number(form.cantidadPorEnvase) > 0 && (
                        <div className="toggle-modo">
                          <button
                            type="button"
                            className={`btn-modo ${modoReposicion === "envases" ? "activo" : ""}`}
                            onClick={() => {
                              setModoReposicion("envases");
                              setForm((p) => ({ ...p, cantidadAAgregar: "" }));
                            }}
                            disabled={uploading}
                          >
                            Contar {envaseLabel}s
                          </button>
                          <button
                            type="button"
                            className={`btn-modo ${modoReposicion === "unidades" ? "activo" : ""}`}
                            onClick={() => {
                              setModoReposicion("unidades");
                              setEnvasesAAgregar("");
                            }}
                            disabled={uploading}
                          >
                            Contar {uLabel}
                          </button>
                        </div>
                      )}

                      {modoReposicion === "envases" &&
                      Number(form.cantidadPorEnvase) > 0 ? (
                        <SelectorCantidad
                          valor={envasesAAgregar}
                          onChange={setEnvasesAAgregar}
                          unidad={form.unidad}
                          paso={1}
                          sufijo={envaseLabel}
                          disabled={uploading}
                          ayuda={
                            equivalenciaEnvases !== null
                              ? `Suma ${formatearCantidad(equivalenciaEnvases)} ${uLabel} al stock.`
                              : "Dejalo en 0 si no compraste más."
                          }
                        />
                      ) : (
                        <SelectorCantidad
                          valor={form.cantidadAAgregar}
                          onChange={(v) => setForm((p) => ({ ...p, cantidadAAgregar: v }))}
                          unidad={form.unidad}
                          paso={tablaPara(PASO_STOCK, form.unidad)}
                          disabled={uploading}
                          ayuda="Dejalo en 0 si no compraste más."
                        />
                      )}
                    </div>
                  </>
                )}
              </div>
            </section>
          )}

          {/* ══════════ 2 · INGREDIENTES (recetas) ══════════ */}
          {esReceta && (
            <section className="bloque-form">
              <h3 className="bloque-titulo">
                <span className="bloque-numero">2</span> Con qué se prepara
              </h3>

              <div className="bloque-campos">
                <div className="campo-bloque" id="campo-ingredientes">
                  <label className="form-label">
                    ¿Qué lleva {form.nombre ? `un ${form.nombre}` : "cada uno"}?
                  </label>
                  <small className="texto-apoyo d-block mb-2">
                    Poné lo que se gasta al preparar <strong>uno solo</strong>, no lo
                    que trae el paquete que compraste.
                  </small>

                  {receta.length === 0 ? (
                    <div className="aviso-vacio">Todavía no hay nada agregado.</div>
                  ) : (
                    <div className="ingredientes-receta">
                      {receta.map((linea) => {
                        const alertas = alertasDeLinea(linea);
                        const u = labelUnidad(linea.unidad);
                        const costoLinea =
                          (linea.precioCompra || 0) * (Number(linea.cantidad) || 0);
                        const alcanzan =
                          linea.stock !== null && Number(linea.cantidad) > 0
                            ? Math.floor(linea.stock / Number(linea.cantidad))
                            : null;

                        return (
                          <div
                            key={linea.ingredienteId}
                            className={`ingrediente-card ${alertas.some((a) => a.tipo === "agotado") ? "con-error" : alertas.length > 0 ? "con-aviso" : ""}`}
                          >
                            <div className="ingrediente-card-head">
                              <div>
                                <span className="ingrediente-card-nombre">
                                  {linea.nombre}
                                </span>
                                <small className="ingrediente-card-meta">
                                  Quedan {formatearCantidad(linea.stock ?? 0)} {u}
                                  {linea.precioCompra !== null &&
                                    ` · ${formatearMonto(linea.precioCompra)} por ${unidadSingular(linea.unidad)}`}
                                </small>
                              </div>
                              <button
                                type="button"
                                className="btn-quitar"
                                onClick={() => quitarIngrediente(linea.ingredienteId)}
                                disabled={uploading}
                                aria-label={`Quitar ${linea.nombre}`}
                              >
                                Quitar
                              </button>
                            </div>

                            <SelectorCantidad
                              valor={linea.cantidad}
                              onChange={(v) =>
                                actualizarCantidadIngrediente(linea.ingredienteId, v)
                              }
                              unidad={linea.unidad}
                              disabled={uploading}
                            />

                            <div className="ingrediente-card-cuentas">
                              <span>Cuesta {formatearMonto(costoLinea)}</span>
                              {alcanzan !== null && (
                                <span>
                                  Alcanza para {formatearNumero(alcanzan)}{" "}
                                  {alcanzan === 1 ? "unidad" : "unidades"}
                                </span>
                              )}
                            </div>

                            {alertas.map((a) => (
                              <div
                                key={a.tipo}
                                className={`alerta-receta ${a.tipo === "agotado" ? "grave" : ""}`}
                              >
                                {a.texto}
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {!mostrarPicker ? (
                    <button
                      type="button"
                      className="btn-agregar-ingrediente"
                      onClick={() => setMostrarPicker(true)}
                      disabled={uploading}
                    >
                      + Agregar algo
                    </button>
                  ) : (
                    <div className="picker-ingredientes">
                      <div className="picker-head">
                        <strong>¿Qué le agregás?</strong>
                        <button
                          type="button"
                          className="btn-quitar"
                          onClick={() => {
                            setMostrarPicker(false);
                            setFiltroIngrediente("");
                          }}
                        >
                          Cerrar
                        </button>
                      </div>

                      <input
                        type="text"
                        className="form-control form-control-sm mb-2"
                        placeholder={
                          modoBusquedaServidor
                            ? "Escribí para buscar…"
                            : "Buscar en la lista (opcional)"
                        }
                        value={filtroIngrediente}
                        onChange={handleFiltroChange}
                        autoComplete="off"
                      />

                      {cargandoIngredientes ? (
                        <div className="picker-estado">
                          <span className="spinner-border spinner-border-sm me-2" />
                          Cargando…
                        </div>
                      ) : ingredientesDisponibles.length === 0 ? (
                        <div className="picker-estado">
                          {modoBusquedaServidor && !filtroIngrediente.trim()
                            ? "Escribí el nombre de lo que buscás."
                            : "No hay nada con ese nombre."}
                        </div>
                      ) : (
                        <div className="picker-lista">
                          {ingredientesDisponibles.map((ing) => {
                            const u = labelUnidad(ing.unidad);
                            return (
                              <button
                                key={ing._id}
                                type="button"
                                className="picker-item"
                                onClick={() => agregarIngrediente(ing)}
                              >
                                <span className="picker-item-nombre">{ing.nombre}</span>
                                <span className="picker-item-meta">
                                  Quedan {formatearCantidad(ing.cantidad)} {u} ·{" "}
                                  {formatearMonto(ing.precioCompra)} por{" "}
                                  {unidadSingular(ing.unidad)}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* ══════════ 3 · PRECIO Y VENTA ══════════ */}
          <section className="bloque-form">
            <h3 className="bloque-titulo">
              <span className="bloque-numero">3</span> Precio y venta
            </h3>

            <div className="bloque-campos">
              <div className="campo-bloque">
                <label className="interruptor">
                  <input
                    id="seVende"
                    name="seVende"
                    type="checkbox"
                    checked={form.seVende}
                    onChange={handleChange}
                    disabled={uploading}
                  />
                  <span className="interruptor-visual" aria-hidden="true" />
                  <span className="interruptor-texto">
                    <strong>Se vende en el mostrador</strong>
                    <small>Apagalo si solo se usa para preparar otras cosas.</small>
                  </span>
                </label>
              </div>

              {!esReceta &&
                (Number(form.cantidadPorEnvase) > 0 ? (
                  <div className="campo-bloque campo-medio">
                    <label htmlFor="precioEnvase" className="form-label">
                      ¿Cuánto pagaste por el {envaseLabel}?
                    </label>
                    <div className="input-group input-group-lg">
                      <span className="input-group-text">₡</span>
                      <input
                        id="precioEnvase"
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        className="form-control"
                        value={precioEnvase}
                        onChange={(e) => setPrecioEnvase(e.target.value)}
                        disabled={uploading}
                        placeholder="0"
                      />
                    </div>
                    {precioEnvase !== "" && Number(form.cantidadPorEnvase) > 0 && (
                      <small className="texto-apoyo">
                        {formatearMonto(precioEnvase)} entre{" "}
                        {formatearCantidad(form.cantidadPorEnvase)} {uLabel} ={" "}
                        <strong>{formatearMonto(costoUnitarioSimple)}</strong> por{" "}
                        {uSingular}
                      </small>
                    )}
                  </div>
                ) : (
                  <div className="campo-bloque campo-medio">
                    <label htmlFor="precioCompra" className="form-label">
                      ¿Cuánto te cuesta cada {uSingular}?
                    </label>
                    <div className="input-group input-group-lg">
                      <span className="input-group-text">₡</span>
                      <input
                        id="precioCompra"
                        name="precioCompra"
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        className="form-control"
                        value={form.precioCompra}
                        onChange={handleChange}
                        disabled={uploading}
                        placeholder="0"
                      />
                    </div>
                  </div>
                ))}

              {form.seVende && (
                <div className="campo-bloque campo-medio">
                  <label htmlFor="precioVenta" className="form-label">
                    ¿A cuánto lo vendés?
                  </label>
                  <div className="input-group input-group-lg">
                    <span className="input-group-text">₡</span>
                    <input
                      id="precioVenta"
                      name="precioVenta"
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      className="form-control"
                      value={form.precioVenta}
                      onChange={handleChange}
                      disabled={uploading}
                      placeholder="0"
                    />
                  </div>
                </div>
              )}

              {esReceta ? (
                <PanelRentabilidad
                  costo={analisis.costo}
                  precioVenta={form.precioVenta}
                  ganancia={analisis.ganancia}
                  margen={analisis.margen}
                  preparables={analisis.preparables}
                  conPerdida={analisis.conPerdida}
                  sinGanancia={analisis.sinGanancia}
                  costoIncompleto={analisis.costoIncompleto}
                  vacio={receta.length === 0}
                  mostrarVenta={form.seVende}
                />
              ) : (
                <PanelRentabilidad
                  titulo="Cuentas de este producto"
                  contexto="producto"
                  costo={costoUnitarioSimple}
                  precioVenta={form.precioVenta}
                  ganancia={gananciaSimple}
                  margen={
                    Number(form.precioVenta) > 0 && gananciaSimple !== null
                      ? (gananciaSimple / Number(form.precioVenta)) * 100
                      : null
                  }
                  conPerdida={
                    form.seVende &&
                    Number(form.precioVenta) > 0 &&
                    gananciaSimple !== null &&
                    gananciaSimple < 0
                  }
                  sinGanancia={
                    form.seVende && Number(form.precioVenta) > 0 && gananciaSimple === 0
                  }
                  mostrarVenta={form.seVende}
                />
              )}

              <div className="campo-bloque" id="campo-imagen">
                <label className="form-label">
                  Foto{" "}
                  {!isEditing && !esReceta ? (
                    <span className="text-danger">*</span>
                  ) : (
                    <span className="texto-apoyo">(se puede dejar sin foto)</span>
                  )}
                </label>
                {isEditing && producto?.imagen && !form.imagen?.file && (
                  <div className="current-image-preview mb-2">
                    <img
                      src={producto.imagenOptimizada || producto.imagen}
                      alt="Foto actual"
                      style={{
                        maxWidth: "150px",
                        maxHeight: "150px",
                        objectFit: "contain",
                        border: "2px solid #e5e7eb",
                        borderRadius: "8px",
                        padding: "4px",
                      }}
                    />
                    <small className="d-block texto-apoyo mt-1">
                      Foto actual — si no elegís otra, se queda esta.
                    </small>
                  </div>
                )}
                <ImageUploadWithCompression
                  onChange={handleImageChange}
                  onError={handleImageError}
                  required={!isEditing && !esReceta}
                  disabled={uploading}
                  showPreview={true}
                  ref={imageUploadRef}
                />
              </div>
            </div>
          </section>

          {/* ══════════ ACCIONES ══════════ */}
          <div className="form-acciones">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={uploading}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={uploading}>
              {uploading ? (
                <>
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  />
                  Guardando…
                </>
              ) : (
                "Guardar"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductForm;
