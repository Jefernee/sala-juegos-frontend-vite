import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
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
