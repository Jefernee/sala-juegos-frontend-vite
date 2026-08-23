// src/components/SesionProvider.jsx
//
// Pregunta al backend si el token guardado todavía sirve, una sola vez por token.
//
// Por qué existe: la sesión ya no vence por tiempo, así que el frontend no puede
// deducir nada de la fecha del token. La única forma de saber si sigue valiendo
// es preguntar — y hay un caso nuevo en el que deja de valer sin haber vencido:
// que el dueño haya exigido el login de nuevo desde Administración.
//
// Tres decisiones que importan:
//
// · El estado se DERIVA en cada render comparando el token guardado con el que
//   ya se verificó. No se guarda "estoy verificando" en una variable aparte, y
//   esa es la diferencia entre que funcione y que no: si el estado viviera solo
//   en un `useState` que arranca un efecto, el render inmediatamente posterior
//   al login mostraría todavía "sin sesión" —los efectos corren después— y la
//   guarda de rutas mandaría al login justo cuando se acaba de iniciar sesión.
//
// · Mientras se pregunta se muestra la pantalla de carga, NO el login. Si se
//   mostrara el login, cada apertura de la app con sesión buena arrancaría con
//   un parpadeo de "iniciá sesión" que no es cierto.
//
// · Si la pregunta no se puede hacer (sin internet, backend dormido), la sesión
//   se deja pasar. Sacar al vendedor del mostrador porque falló el wifi sería
//   peor que el problema que se está evitando: si el token de verdad no sirve,
//   la primera petición real lo va a descubrir igual.
import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { SesionContexto, ESTADO } from "../hocks/useSesion";
import { getToken } from "../utils/auth";

const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

const SesionProvider = ({ children }) => {
  // Lo verificado hasta ahora: qué token y si sirvió. null = todavía nada.
  const [resultado, setResultado] = useState(null);
  // El token que tiene una pregunta en vuelo, para no preguntar dos veces por
  // el mismo (StrictMode monta los efectos dos veces).
  const enVuelo = useRef(null);
  const location = useLocation();

  const token = getToken();

  const estado = !token
    ? ESTADO.SIN_SESION
    : resultado?.token !== token
      ? ESTADO.VERIFICANDO
      : resultado.valida
        ? ESTADO.VALIDA
        : ESTADO.SIN_SESION;

  useEffect(() => {
    if (!token) return;
    // Ya está verificado, o ya se está preguntando por él.
    if (resultado?.token === token || enVuelo.current === token) return;

    enVuelo.current = token;

    (async () => {
      const cerrar = (aviso) => {
        localStorage.clear();
        sessionStorage.setItem("avisoSesion", aviso);
        setResultado({ token, valida: false });
      };

      try {
        const axios = (await import("axios")).default;
        const res = await axios.get(`${API_URL}/api/auth/verify`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        // `valid: false` con estado 200 sería una sesión rechazada sin error.
        if (res.data?.valid === false) {
          cerrar("Se cerró tu sesión. Iniciá sesión de nuevo.");
          return;
        }

        // El backend puede devolver el usuario actualizado: si el dueño le
        // cambió el rol, se aplica al abrir en vez de quedar con el rol viejo
        // guardado desde el login.
        const usuario = res.data?.user || res.data?.usuario;
        if (usuario) localStorage.setItem("user", JSON.stringify(usuario));

        setResultado({ token, valida: true });
      } catch (err) {
        const status = err?.response?.status;

        // 401/403: el token ya no sirve. Se maneja acá y no se confía en el
        // interceptor global, porque la respuesta de /verify no trae el `code`
        // que ese interceptor necesita para reaccionar.
        if (status === 401 || status === 403) {
          cerrar("Se cerró tu sesión. Iniciá sesión de nuevo.");
          return;
        }

        console.warn("No se pudo verificar la sesión:", status || err?.message);
        setResultado({ token, valida: true });
      } finally {
        if (enVuelo.current === token) enVuelo.current = null;
      }
    })();
    // `location` está en las dependencias a propósito: es lo que hace que se
    // mire el token nuevo después de iniciar sesión, sin que Login tenga que
    // avisar nada.
  }, [token, resultado, location]);

  // El proveedor no bloquea nada: las páginas públicas (inicio, catálogo,
  // torneos) tienen que verse enseguida aunque haya un token viejo dando
  // vueltas. La pantalla de carga la pone RequireRol, que es quien sabe si esa
  // ruta necesita sesión.
  return (
    <SesionContexto.Provider value={{ estado }}>
      {children}
    </SesionContexto.Provider>
  );
};

export default SesionProvider;
