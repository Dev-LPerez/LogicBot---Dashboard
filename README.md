- Métricas en tiempo real
- Gráficos de analítica avanzada
- Matriz de habilidades interactiva
- Paneles de integridad y gamificación

### 3. Detalle de Estudiante
- Perfil completo del alumno
- Code Playback (historial de chat)
- Métricas de autonomía

## 🔐 Seguridad

- Autenticación anónima para demo (producción: email/password)
- Reglas de seguridad de Firestore configurables
- Datos sensibles excluidos del repositorio

## 🤝 Integración con Backend Python

Este dashboard se sincroniza con el backend Python de LogicBot mediante:
- Colección `users_sync` para datos públicos de estudiantes
- Colección `classes` para gestión de aulas
- APP_ID compartido: `default-logicbot`

## 📱 Responsive Design

Optimizado para desktop, tablet y móvil con Tailwind CSS.

## 📄 Licencia

Este proyecto es parte del ecosistema LogicBot para educación en programación.

---

Desarrollado con ❤️ para potenciar la enseñanza de Java con IA
# LogicBot - Torre de Control Docente 🎓

Dashboard web interactivo para profesores que utilizan LogicBot, un chatbot educativo de programación Java en WhatsApp.

## 🚀 Características Principales

### 📊 Gestión de Clases
- Crear y administrar aulas virtuales
- Generación automática de tokens únicos de vinculación
- Sistema de handshake con estudiantes vía WhatsApp

### 📈 Analítica Avanzada
- **Radar de Conocimiento**: Visualización del nivel promedio de la clase por tema
- **Estado de Actividad**: Clasificación de estudiantes (Activos, En Riesgo, Inactivos)
- **Matriz de Habilidades**: Heatmap de progreso individual por los 7 temas de Java
- **Top Estudiantes**: Ranking con sistema de gamificación

### 🔍 Auditoría de Integridad Académica
- Cálculo de autonomía (% de retos sin pistas)
- Detección de alta dependencia de IA
- Code Playback: Análisis forense del historial de interacciones

### 🎯 Temas de Java Monitoreados
1. Variables y Primitivos
2. Operadores Lógicos
3. Condicionales (if-else)
4. Ciclos (for, while)
5. Arrays (Arreglos)
6. Métodos y Funciones
7. Clases y Objetos (OOP)

## 🛠️ Stack Tecnológico

- **Frontend**: React 18 + Vite
- **Estilos**: Tailwind CSS
- **Backend/Database**: Firebase (Firestore + Authentication)
- **Gráficos**: Recharts
- **Iconos**: Lucide React

## 📦 Instalación

```bash
# Clonar el repositorio
git clone https://github.com/Dev-LPerez/LogicBot---Dashboard.git

# Instalar dependencias
npm install

# Ejecutar en modo desarrollo
npm run dev

# Build para producción
npm run build
```

## ⚙️ Configuración de Firebase

1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com)
2. Habilita Firestore y Authentication
3. Las credenciales ya están configuradas en `src/firebase.js`

## 🏗️ Estructura del Proyecto

```
dashboard-logicbot/
├── src/
│   ├── App.jsx          # Componente principal con 3 vistas
│   ├── firebase.js      # Configuración de Firebase
│   ├── main.jsx         # Punto de entrada
│   └── index.css        # Estilos globales con Tailwind
├── public/
├── tailwind.config.js   # Configuración de Tailwind
├── postcss.config.cjs   # Configuración de PostCSS
└── package.json
```

## 🎨 Vistas Principales

### 1. Vista de Clases
Lista de aulas virtuales con tokens de acceso

### 2. Dashboard de Clase (Torre de Control)
