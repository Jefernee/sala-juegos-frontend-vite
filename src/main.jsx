import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

// Bootstrap va PRIMERO y desde acá, no desde una página.
// Antes se importaba dentro de Home2.jsx, que carga en diferido igual que
// Administracion.jsx: el orden en que se inyectaban las hojas dependía de por
// dónde hubieras entrado al sitio. Entrando directo a /administracion,
// Administracion.css se cargaba antes y Bootstrap terminaba pisándole
// .card, .btn, .form-control y los fondos. Desde acá el orden es siempre el
// mismo: Bootstrap de base, y encima los estilos propios.
import 'bootstrap/dist/css/bootstrap.min.css'
import './index.css'
import App from './App.jsx'
import { warmupBackend } from './utils/api'

// Despierta el backend (Koyeb se duerme por inactividad) apenas carga la app,
// sin bloquear el render. Configura además timeout + reintento global de axios.
warmupBackend()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
