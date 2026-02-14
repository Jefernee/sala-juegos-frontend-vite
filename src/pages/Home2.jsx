import React, { lazy, Suspense, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { Link, useNavigate } from "react-router-dom";
import "../App.css";
import "../styles/Ganadores.css";
import "../styles/Encabezado.css";
import "../styles/Global.css";
import "../styles/NavVar.css";
import "../styles/ProductosSection.css";
import "../styles/Home.css";

// Importar componentes personalizados
import OptimizedImage from '../components/OptimizedImage';
import LoadingSpinner from '../components/LoadingSpinner';

// Importar datos centralizados
import { 
  juegosData, 
  ganadoresData, 
  torneosData, 
  galeriaImagenes 
} from '../constants/homeData';

// Lazy loading del mapa
const MapComponent = lazy(() => import('../components/MapComponent'));

function Home2() {
  const navigate = useNavigate();

  

  // Precargar SOLO imágenes críticas (above-the-fold)
  useEffect(() => {
    // Solo precargamos el logo del hero que es lo único crítico visible de inmediato
    const criticalImages = [
      "https://res.cloudinary.com/drjsg8j92/image/upload/c_scale,w_160,q_auto,f_auto/v1737318752/Imagen_de_WhatsApp_2025-01-11_a_las_21.53.16_f15972d6_h3rx20.jpg"
    ];

    console.log('🖼️ Precargando', criticalImages.length, 'imagen(es) crítica(s)');
    
    criticalImages.forEach(src => {
      const img = new Image();
      img.onload = () => console.log('✅ Imagen crítica cargada');
      img.onerror = () => console.error('❌ Error en imagen crítica:', src);
      img.src = src;
    });

    // El resto de imágenes se cargarán con lazy loading cuando sean visibles
  }, []);

  const handleInscribir = (torneoNombre) => {
    navigate("/inscripcion", {
      state: { torneo: torneoNombre },
    });
  };

  return (
    <>
      {/* Navegación */}
      <nav className="navbar navbar-expand-lg navbar-dark">
        <div className="container">
          <span className="navbar-brand">🎮 Sala de Juegos Ruiz</span>
          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarNav"
            aria-controls="navbarNav"
            aria-expanded="false"
            aria-label="Toggle navigation"
          >
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="navbarNav">
            <ul className="navbar-nav ms-auto mb-0">
              <li className="nav-item">
                <Link className="nav-link" to="/login">
                  Login
                </Link>
              </li>
              <li className="nav-item">
                <Link className="nav-link" to="/productos">
                  Productos en Venta
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      {/* Encabezado */}
      <header className="hero-accent">
        <div className="hero-image"></div>
        <div className="hero-content">
          <div className="hero-logo">
            <OptimizedImage
              src="https://res.cloudinary.com/drjsg8j92/image/upload/c_scale,w_160,q_auto,f_auto/v1737318752/Imagen_de_WhatsApp_2025-01-11_a_las_21.53.16_f15972d6_h3rx20.jpg"
              alt="Sala de Juegos Ruiz"
              loadingHeight="80px"
            />
          </div>
          <h1 className="fade-up">Sala de Juegos Ruiz</h1>
          <p className="fade-up delay-1">Centro de entretenimiento y recreación</p>
          <p className="fade-up delay-1">Un lugar seguro y confiable para divertirse sanamente</p>
        </div>
      </header>

      {/* Sobre sala de juegos */}
      <section id="about" className="bg-custom py-5">
        <div className="container">
          <div className="row mb-5">
            <div className="col-12 shadow rounded text-center">
              <h2 className="text-primary mt-4">Descubre la Diversión en la Sala de Juegos</h2>
              <p className="mt-4 text-muted">
                Nuestra sala de juegos ofrece una experiencia única para todos los amantes del entretenimiento. 
                Contamos con una amplia variedad de opciones, desde clásicos como ping pong, futbolín y máquinas 
                tragamonedas, hasta lo último en tecnología con consolas de videojuegos como PlayStation. 
                Aquí encontrarás el equilibrio perfecto entre tradición y modernidad, ideal para disfrutar con 
                amigos, familiares o para desafiar a otros jugadores. ¡Ven y vive momentos inolvidables en un 
                ambiente lleno de diversión y emoción!
              </p>
            </div>
          </div>

          {/* Visión y Misión */}
          <div className="row">
            <div className="col-md-6 mb-4">
              <div className="p-4 shadow rounded text-center">
                <h2 className="text-primary">Visión</h2>
                <p className="mt-4 text-muted">
                  Ser el centro de entretenimiento líder, proporcionando experiencias únicas a nuestros jugadores, 
                  creando un espacio donde todos puedan disfrutar, aprender y conectar con otros a través del juego.
                </p>
              </div>
            </div>
            <div className="col-md-6 mb-4">
              <div className="p-4 shadow rounded text-center">
                <h2 className="text-primary">Misión</h2>
                <p className="mt-4 text-muted">
                  Ofrecer un ambiente seguro, inclusivo y emocionante donde los jugadores puedan disfrutar de una 
                  amplia gama de juegos de calidad, fomentando la competencia sana y el trabajo en equipo.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Galería */}
      <section id="gallery" className="bg-custom py-5">
        <div className="container">
          <h2 className="text-center mb-3">Galería de la Sala</h2>
          <div className="row">
            {galeriaImagenes.map((src, index) => (
              <div key={index} className="col-md-4 mb-4">
                <div className="gallery-item">
                  <OptimizedImage
                    src={src}
                    alt={`Sala de Juegos - Imagen ${index + 1}`}
                    className="img-fluid rounded shadow"
                    loadingHeight="250px"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Productos en Venta */}
      <section id="productos-venta" className="bg-custom py-5">
        <div className="container">
          <h2 className="text-center mb-4">🛍️ Productos en Venta</h2>
          <p className="text-center text-muted mb-5">
            Descubre nuestra variedad de productos disponibles en la sala
          </p>

          <div className="row align-items-center">
            <div className="col-md-6 mb-4">
              <div className="position-relative">
                <OptimizedImage
                  src="https://res.cloudinary.com/drjsg8j92/image/upload/c_scale,w_800,q_auto,f_auto/v1767141336/carrito_lpapvi.png"
                  alt="Productos disponibles"
                  className="img-fluid rounded shadow-lg"
                  style={{ width: "100%", height: "400px", objectFit: "cover" }}
                  loadingHeight="400px"
                />
                <div
                  className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
                  style={{ background: "rgba(0, 0, 0, 0.3)", borderRadius: "8px" }}
                >
                  <i className="bi bi-shop text-white" style={{ fontSize: "4rem" }}></i>
                </div>
              </div>
            </div>

            <div className="col-md-6 mb-4">
              <div className="p-4">
                <h3 className="mb-4">
                  <i className="bi bi-cart-check text-primary"></i> Nuestra Tienda
                </h3>

                {[
                  { titulo: "Gran Variedad de Productos", desc: "Snacks, bebidas, entretenimiento y más" },
                  { titulo: "Siempre Disponible", desc: "Stock actualizado regularmente" },
                  { titulo: "Precios Justos", desc: "Las mejores ofertas de la zona" },
                  { titulo: "Fácil Acceso", desc: "Compra directamente en la sala" }
                ].map((item, index) => (
                  <div key={index} className="d-flex align-items-start mb-3">
                    <i className="bi bi-check-circle-fill text-success me-3 mt-1" style={{ fontSize: "1.5rem" }}></i>
                    <div>
                      <h5 className="mb-1">{item.titulo}</h5>
                      <p className="text-muted mb-0">{item.desc}</p>
                    </div>
                  </div>
                ))}

                <div className="d-grid gap-3 mt-4">
                  <Link
                    to="/productos"
                    className="btn btn-primary btn-lg"
                    style={{
                      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      border: "none",
                      padding: "15px 30px",
                      fontSize: "1.1rem",
                      fontWeight: "600",
                      boxShadow: "0 4px 15px rgba(102, 126, 234, 0.4)",
                    }}
                  >
                    <i className="bi bi-shop me-2"></i>
                    Ver Catálogo Completo
                  </Link>

                  <p className="text-center text-muted mb-0">
                    <i className="bi bi-geo-alt me-2"></i>
                    Visítanos en la sala para ver más productos
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Categorías destacadas */}
          <div className="row mt-5">
            {[
              { icon: "controller", name: "Consolas & Juegos" },
              { icon: "headphones", name: "Accesorios" },
              { icon: "box-seam", name: "Productos Varios" },
              { icon: "stars", name: "Destacados" }
            ].map((categoria, index) => (
              <div key={index} className="col-md-3 col-6 mb-3">
                <Link to="/productos" className="text-decoration-none">
                  <div className="text-center p-3 bg-white rounded shadow-sm h-100 hover-card">
                    <i
                      className={`bi bi-${categoria.icon} text-primary`}
                      style={{ fontSize: "3rem" }}
                    ></i>
                    <h6 className="mt-3 mb-0">{categoria.name}</h6>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Juegos disponibles */}
      <section id="games" className="bg-custom py-5">
        <div className="container">
          <h2 className="text-center mb-4">Los Mejores Juegos Disponibles</h2>
          <div className="row text-center mb-4">
            {juegosData.map((juego) => (
              <div key={juego.id} className="col-md-3 mb-3">
                <a href={juego.link} target="_blank" rel="noopener noreferrer">
                  <OptimizedImage
                    src={juego.imagen}
                    alt={juego.nombre}
                    className="img-fluid rounded mb-3"
                    style={{ width: "200px", height: "200px", objectFit: "cover" }}
                    loadingHeight="200px"
                  />
                  <p>{juego.nombre}</p>
                </a>
              </div>
            ))}
          </div>

          <div className="text-center">
            <a
              href="https://www.playstation.com/es-es/ps-plus/games/?category=GAME_CATALOG#plus-container"
              className="btn btn-primary"
              target="_blank"
              rel="noopener noreferrer"
            >
              Ver todos los juegos en PS Plus
            </a>
          </div>
        </div>
      </section>

      {/* Ganadores de Torneos */}
      <section id="ganadores" className="bg-custom py-5">
        <div className="container">
          <h2 className="text-center mb-4">Ganadores de Torneos</h2>
          <div className="row">
            {ganadoresData.map((ganador) => (
              <div key={ganador.id} className="col-md-6 mb-4">
                <div className={`p-3 shadow rounded text-center ${ganador.cardClass}`}>
                  <div style={{ 
                    width: "200px", 
                    height: "200px", 
                    margin: "0 auto 1rem auto",
                    position: "relative"
                  }}>
                    <OptimizedImage
                      src={ganador.imagen}
                      alt={`Ganador ${ganador.nombre}`}
                      className="img-fluid rounded-circle"
                      style={{ 
                        width: "200px", 
                        height: "200px", 
                        objectFit: "contain",
                        background: "white",
                        padding: "10px",
                        display: "block"
                      }}
                      loadingHeight="200px"
                    />
                  </div>
                  <h4 className="mb-2 text-white">{ganador.nombre}</h4>
                  <p className="text-white">{ganador.titulo}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Inscripción de Torneos */}
      <section id="tournaments" className="bg-custom py-5">
        <div className="container">
          <h2 className="text-center mb-4">Inscripción de Torneos y Competiciones</h2>
          <div className="row">
            {torneosData.map((torneo) => (
              <div key={torneo.id} className="col-md-6 mb-4">
                <div className="p-3 shadow rounded">
                  <h4 className="mb-3">{torneo.icono}{torneo.nombre}</h4>
                  <p>{torneo.descripcion}</p>
                  <p>Fecha: {torneo.fecha}</p>
                  <p>Valor: {torneo.valor}</p>
                  <button
                    className="btn btn-success"
                    onClick={() => handleInscribir(torneo.registroNombre)}
                  >
                    Inscribirse
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mapa - Lazy Loading */}
      <section id="mapa" className="bg-custom py-5">
        <div className="container">
          <h2 className="text-center mb-4">Ubicación de la Sala de Juegos</h2>
          <p className="text-center mb-4">
            Visítanos en nuestra sala ubicada en el corazón de la ciudad para disfrutar de los mejores momentos de juego.
          </p>
          <div className="row justify-content-center">
            <div className="col-md-8">
              <div className="map-container">
                <Suspense fallback={<LoadingSpinner text="Cargando mapa..." />}>
                  <MapComponent />
                </Suspense>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contacto */}
      <section id="contact" className="bg-primary py-5">
        <div className="container text-white">
          <h2 className="text-center mb-4">Contáctanos</h2>
          <p className="text-center">
            Si deseas más información sobre nuestra sala de juegos, o deseas reservar, no dudes en contactarnos.
          </p>
          <div className="text-center my-4">
            <a href="tel:86825481" className="btn btn-light mx-2">
              <i className="bi bi-telephone"></i> Llámanos
            </a>
            <a href="mailto:salajuegosruiz@gmail.com" className="btn btn-light mx-2">
              <i className="bi bi-envelope"></i> Envíanos un correo
            </a>
          </div>
          <div className="text-center mt-4">
            <p className="mb-2">
              <strong>Teléfono:</strong>{" "}
              <a href="tel:86825481" className="text-white text-decoration-underline">
                86825481 o 84237787
              </a>
            </p>
            <p className="mb-4">
              <strong>Correo:</strong>{" "}
              <a href="mailto:salajuegosruiz@gmail.com" className="text-white text-decoration-underline">
                salajuegosruiz@gmail.com
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* Pie de página */}
      <footer className="bg-dark text-white text-center py-3">
        <p className="mb-0">&copy; 2025 Sala de Juegos. Todos los derechos reservados.</p>
        <p className="mb-0">
          Proyecto realizado por <strong>Jefernee Ruiz</strong>
        </p>
        <p className="mb-0">
          Contacto:{" "}
          <a href="mailto:jefernee50@gmail.com" className="text-white">
            jefernee50@gmail.com
          </a>
        </p>
      </footer>
    </>
  );
}

export default Home2;