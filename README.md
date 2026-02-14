# 🛍️ Sistema de Gestión de Ventas y Productos

Aplicación web moderna desarrollada con React y Vite para la gestión completa de ventas, productos, pedidos y reportes.

## 🚀 Tecnologías Utilizadas

- **React 18** - Biblioteca de JavaScript para interfaces de usuario
- **Vite** - Herramienta de construcción rápida y moderna
- **React Router DOM** - Navegación entre páginas
- **JavaScript (ES6+)** - Lenguaje de programación
- **Lazy Loading** - Carga diferida de componentes para mejor rendimiento

## ✨ Características Principales

- 🏠 Página de inicio pública
- 🔐 Sistema de autenticación (Login/Inscripción)
- 📦 Catálogo público de productos
- 📊 Dashboard administrativo completo
- 💼 Gestión de ventas en tiempo real
- 📝 Administración de productos (CRUD)
- 🚚 Control de pedidos
- 📈 Sistema de reportes
- 🎭 Gestión de obras/presentaciones
- 📜 Historial de ventas
- ⚡ Optimización de rendimiento con lazy loading

## 📦 Instalación

1. Clona el repositorio:
```bash
git clone <https://github.com/Jefernee/sala-juegos-frontend-vite>
cd <sala-juegos-frontend-vite>
```

2. Instala las dependencias:
```bash
npm install
```

3. Inicia el servidor de desarrollo:
```bash
npm run dev
```

4. Abre tu navegador en `http://localhost:5173`

## 🛠️ Scripts Disponibles

- `npm run dev` - Inicia el servidor de desarrollo con Vite
- `npm run build` - Construye la aplicación para producción
- `npm run preview` - Previsualiza la versión de producción
- `npm run lint` - Ejecuta ESLint para verificar el código

## 📁 Estructura del Proyecto

```
proyecto/
├── src/
│   ├── components/
│   │   └── AppRouter.jsx      # Enrutador principal
│   ├── pages/
│   │   ├── Home2.jsx          # Página de inicio
│   │   ├── Login.jsx          # Autenticación
│   │   ├── Inscripcion.jsx    # Registro de usuarios
│   │   ├── PublicProductList.jsx  # Catálogo público
│   │   ├── SalesDashboard.jsx     # Dashboard de ventas
│   │   ├── ProductsList.jsx       # Lista de productos
│   │   ├── ManageProducts.jsx     # Gestión de productos
│   │   ├── PedidosDashboard.jsx   # Dashboard de pedidos
│   │   ├── ReportesDashboard.jsx  # Dashboard de reportes
│   │   ├── PlaysManagement.jsx    # Gestión de obras
│   │   └── SalesHistory.jsx       # Historial de ventas
│   ├── App.jsx                # Componente principal
│   └── main.jsx               # Punto de entrada
├── public/                    # Archivos estáticos
├── index.html                 # HTML principal
├── vite.config.js             # Configuración de Vite
└── package.json               # Dependencias y scripts
```

## 🗺️ Rutas de la Aplicación

### Rutas Públicas
- `/` - Página de inicio
- `/login` - Inicio de sesión
- `/inscripcion` - Registro de nuevos usuarios
- `/productos` - Catálogo público de productos

### Rutas del Dashboard (Requieren autenticación)
- `/dashboard` - Panel principal (Gestión de productos)
- `/dashboard/sales` - Dashboard de ventas
- `/dashboard/products` - Lista de productos
- `/dashboard/manage-products` - Administrar productos
- `/dashboard/add-product` - Agregar nuevo producto
- `/dashboard/pedidos` - Gestión de pedidos
- `/dashboard/reportes` - Reportes y estadísticas
- `/dashboard/plays` - Gestión de obras/presentaciones
- `/sales-history` - Historial completo de ventas

## 🎯 Funcionalidades por Módulo

### 🏠 Módulo Público
- Visualización de productos disponibles
- Sistema de autenticación seguro
- Registro de nuevos usuarios

### 📊 Dashboard de Ventas
- Registro de ventas en tiempo real
- Visualización de métricas de ventas
- Gestión de transacciones

### 📦 Gestión de Productos
- Crear, editar y eliminar productos
- Administración de inventario
- Control de stock y precios

### 🚚 Control de Pedidos
- Seguimiento de pedidos
- Actualización de estados
- Gestión de entregas

### 📈 Reportes
- Generación de reportes de ventas
- Análisis de datos
- Estadísticas del negocio

### 🎭 Gestión de Obras
- Administración de presentaciones
- Control de eventos
- Programación

## 🔧 Configuración

El proyecto utiliza **lazy loading** para optimizar el rendimiento. Los componentes del dashboard se cargan solo cuando son necesarios, mejorando el tiempo de carga inicial.

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Para contribuir:

1. Haz fork del proyecto
2. Crea una rama para tu función (`git checkout -b feature/NuevaFuncion`)
3. Commit tus cambios (`git commit -m 'Agrega nueva función'`)
4. Push a la rama (`git push origin feature/NuevaFuncion`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia MIT.

## 👨‍💻 Desarrollo

### Requisitos Previos
- Node.js 16+ 
- npm o yarn

### Dependencias Principales
- React 18
- React Router DOM
- Vite

---

**Desarrollado con ❤️ usando React + Vite, fue migrado de create react app** ⚡
