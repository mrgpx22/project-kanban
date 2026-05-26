#  Project Kanban

Aplicación web para la gestión de fichajes laborales con autenticación de usuarios y visualización mensual de actividad mediante un calendario interactivo.

##  Características

-  Registro de fichajes de entrada y salida
-  Sistema de autenticación de usuarios
-  Calendario mensual con visualización de actividad
-  Interfaz rápida y moderna desarrollada con Vite
-  Backend y base de datos gestionados con Supabase

##  Tecnologías utilizadas

![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)
![HTML](https://img.shields.io/badge/HTML+CSS-E34F26?style=flat&logo=html5&logoColor=white)

##  Estructura del proyecto
```
project-kanban/
├── src/
├── public/
├── assets/
│   ├── img/
│   └── js/
└── package.json
└── vite.config.js
```

## Screenshots

- Repositorio: [screenshots](https://github.com/mrgpx22/project-kanban/tree/main/public/assets/screenshots)

# Login del Kanban
![Login](./public/assets/screenshots/Login%20Screenshot.png)

# Main Screenshot (Donde se pueden ver todos los proyectos donde participas) El Jefe podrá ver todos los proyectos y podrá gestionar Proyectos y Personas 
![Main](./public/assets/screenshots/Main%20Screenshot.png)

# El Kanban de un Proyecto (Por donde podrás ver las tareas  del Proyecto
![Kanban](./public/assets/screenshots/Kanban%20Screenshot.png)

# El Calendario del Proyecto de Kanban (Por donde podrás ver los plazos de las tareas  del Proyecto
![Calendar](./public/assets/screenshots/Calendar%20Screenshot.png)

# El Gantt del Proyecto de Kanban (Por donde podrás estructurar el Proyecto)
![Gantt](./public/assets/screenshots/Gantt%20Screenshot.png)

# El Apartado de Notas del Proyecto de Kanban (Por donde podrás hacer apuntes rapidos del Proyecto)
![Notas](./public/assets/screenshots/Notas%20Screenshot.png)

##  Instalación y uso

**1. Clona el repositorio:**
```bash
git clone https://github.com/mrgpx22/project-kanban.git
```

**2. Accede al directorio del proyecto:**
```bash
cd project-kanban
```

**3. Instala las dependencias:**
```bash
npm install
```

**4. Ejecuta el entorno de desarrollo:**
```bash
npm run dev
```

##  Configuración

Crea un archivo `.env` en la raíz del proyecto con las credenciales de Supabase:

```env
VITE_SUPABASE_URL=tu_url
VITE_SUPABASE_ANON_KEY=tu_clave
```

## Vista general

Aplicación orientada a facilitar el seguimiento de jornadas laborales y el control horario de usuarios desde una interfaz sencilla y accesible.

## Autor

**Joan Cabrerizo Benedicto**

- GitHub: [@mrgpx22](https://github.com/mrgpx22)
- Repositorio: [project-kanban](https://github.com/mrgpx22/project-kanban)
