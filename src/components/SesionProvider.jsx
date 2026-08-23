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
// · Si la pregunta no se puede hacer (sin internet, backend dormido, /verify
//   respondiendo cualquier otra cosa), la sesión se deja pasar. Sacar al
//   vendedor del mostrador porque falló el wifi sería peor que el problema que
//   se está evitando.
//
// · La sesión SOLO se cierra si el backend dice por qué: code SESION_CERRADA,
//   INVALID_TOKEN o EXPIRED_TOKEN. Antes bastaba con que /verify contestara 401
//   o 403 —de ahí el login al abrir la app aunque el token siguiera bueno—. El
//   token dura 10 años: sin uno de esos códigos no hay motivo para borrarlo, y
//   el error inesperado del servidor ahora llega como 500, no como 401.
//
// · El rol que devuelve /verify es EL rol. El token ya no lo lleva adentro: el
//   backend lo consulta al responder, así que esta respuesta es lo más fresco
//   que hay. Se pisa el que estaba guardado antes de dar la sesión por válida,
//   para que los menús se dibujen con el rol de ahora y no con el del login.
//   Si degradan a alguien con la app abierta, su menú sigue igual hasta que la
//   vuelva a abrir; lo que lo frena mientras tanto es el 403 del backend, que
//   se muestra como un error normal (ver src/utils/sesion.js).
import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { SesionContexto, ESTADO } from "../hocks/useSesion";
import { getToken } from "../utils/auth";
import { cierraLaSesion, avisoDeCierre } from "../utils/sesion";

const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

/**
 * Refresca el usuario guardado con lo que dice /verify.
 *
 * El rol puede venir dentro del usuario (`user.rol`) o suelto (`rol`); el suelto
 * gana, porque es el que el backend acaba de consultar. Si solo llega el rol, se
 * conserva el resto del usuario guardado en vez de descartarlo: perder el nombre
 * o el email dejaría pantallas mostrando "—" sin ninguna razón.
 */
const guardarUsuario = (data) => {
  const usuario = data?.user || data?.usuario;
  const rol = data?.rol || usuario?.rol;
  if (!usuario && !rol) return;

  let guardado = {};
  try {
    guardado = JSON.parse(localStorage.getItem("user")) || {};
  } catch {
    guardado = {};
  }

  const actualizado = { ...guardado, ...(usuario || {}) };
  if (rol) actualizado.rol = rol;
  localStorage.setItem("user", JSON.stringify(actualizado));
};

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
      const cerrar = (aviso, code) => {
        console.warn(`[sesion] se cierra la sesión por ${code}: ${aviso}`);
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
        // Igual que en el catch: solo se cierra si el backend dice por qué.
        if (res.data?.valid === false) {
          const code = res.data?.code;
          if (cierraLaSesion(code)) {
            cerrar(avisoDeCierre(code), code);
            return;
          }
          console.warn("/verify devolvió valid:false sin code; se deja pasar.");
        }

        guardarUsuario(res.data);
        setResultado({ token, valida: true });
      } catch (err) {
        const status = err?.response?.status;

        // Solo estos dos códigos cierran la sesión. Un 401 o 403 pelado de
        // /verify (endpoint caído, proxy, permiso de otra cosa) NO borra nada:
        // esa era la causa de que la app pidiera login al abrir.
        const code = err?.response?.data?.code;
        if ((status === 401 || status === 403) && cierraLaSesion(code)) {
          cerrar(avisoDeCierre(code), code);
          return;
        }

        console.warn(
          "No se pudo verificar la sesión, se deja pasar:",
          code || status || err?.message,
        );
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
