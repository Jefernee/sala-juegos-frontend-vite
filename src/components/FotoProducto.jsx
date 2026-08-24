// src/components/FotoProducto.jsx
//
// La foto de un producto, con red de seguridad.
//
// Por qué existe: pedimos las fotos con una transformación de Cloudinary (el
// tamaño y la forma del hueco donde van). Si esa transformación falla para una
// foto concreta —un formato raro, un `public_id` con caracteres que se le
// atragantan, un producto cuya URL ni siquiera es de Cloudinary— el navegador
// se queda sin imagen y la pantalla muestra el respaldo: la inicial del
// producto. Al vendedor le aparece una letra donde esperaba una gaseosa.
//
// Eso no puede pasar por culpa nuestra. Acá hay tres escalones, y solo se baja
// cuando el anterior falla de verdad:
//
//   1. la foto transformada, que es la liviana y la que encaja;
//   2. la foto tal como la guardó el backend, sin tocar;
//   3. nada — y ahí sí aparece el respaldo de la pantalla, porque la foto
//      está rota de origen y no hay nada que mostrar.
//
// El estado vive acá y no en un `onError` que le cambia el `src` al elemento a
// mano: React vuelve a pintar en cada cambio del pedido, y ese `src` escrito a
// mano se perdería en el siguiente render — la imagen fallaría, se arreglaría y
// volvería a fallar en bucle.
import { useState } from "react";
import { fotoProducto, fotoProductoSrcSet } from "../utils/imagenes";

const FotoProducto = ({ src, ancho, forma, anchos, sizes, alt = "", ...resto }) => {
  // Qué escalón se está usando, y para qué foto. Los dos juntos en un estado
  // porque cambiar de producto tiene que volver al primer escalón: si guardara
  // solo el escalón, una tarjeta que reutiliza el nodo heredaría el "rota" de
  // la foto anterior y no mostraría una imagen que sí funciona.
  const [estado, setEstado] = useState({ src, escalon: "transformada" });

  // Ajuste durante el render, no en un efecto: así el primer pintado de la foto
  // nueva ya sale por el escalón bueno, sin un parpadeo intermedio.
  if (estado.src !== src) setEstado({ src, escalon: "transformada" });

  if (!src || estado.src !== src || estado.escalon === "rota") return null;

  const cruda = estado.escalon === "cruda";
  if (cruda) {
    console.warn(
      `[foto] la versión transformada no cargó, se usa la original: ${src}`,
    );
  }

  return (
    <img
      src={cruda ? src : fotoProducto(src, { ancho, forma })}
      srcSet={!cruda && anchos ? fotoProductoSrcSet(src, anchos, forma) : undefined}
      sizes={!cruda && anchos ? sizes : undefined}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setEstado({ src, escalon: cruda ? "rota" : "cruda" })}
      {...resto}
    />
  );
};

export default FotoProducto;
