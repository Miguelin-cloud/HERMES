# 🚀 HERMES Simulator - Developer Handoff & Architecture

## 📋 Contexto del Proyecto
Bienvenido al desarrollo de **HERMES Rocket Simulator**. Este documento está diseñado para ser entregado a la Inteligencia Artificial (Google AI Studio / Gemini) cuando inicies una nueva sesión de desarrollo a partir de este código base.

---

## 🤖 PROMPT PARA COPIAR Y PEGAR EN GOOGLE AI STUDIO
*Copia el siguiente texto y pégalo en el chat de tu agente de IA cuando importes este proyecto en Google AI Studio (Build):*

> **"Hola. Acabo de importar el repositorio/código fuente de 'HERMES Rocket Launcher Simulator'. Eres el ingeniero de software líder a cargo de continuar su desarrollo.**
> 
> **CONTEXTO DEL PROYECTO Y ARQUITECTURA:**
> 1. **Propósito**: Es un simulador profesional offline para motores de cohetes de propulsante sólido. Realiza cálculos matemáticos y físicos (presión, empuje, áreas de quemado, etc.) y los visualiza en gráficos 2D y modelos 3D.
> 2. **Tecnologías Clave**: React 19, TypeScript, Vite, Tailwind CSS v4, Recharts (para las gráficas).
> 3. **Distribución**: Aunque está construido con tecnologías web, el objetivo final es empaquetarlo como una **aplicación de escritorio ejecutable (.exe) para Windows 100% offline** utilizando **Electron** y `electron-builder`. NO se apunta a Mac y NO requiere servicios en la nube ni API Keys de IA.
> 4. **Estado Actual**: Estamos en la Versión 1.0. El motor de físicas (`src/lib/simulator.ts`), la interfaz de pestañas, el modo 3D intermedio y las descargas a CSV ya funcionan. La app compila perfectamente en Windows usando `npm run electron:build`.
> 
> **REGLAS ESTRICTAS PARA TUS MODIFICACIONES:**
> - **Dependencias Físicas**: No modifiques ni elimines los scripts de `package.json` destinados al *build* de Electron. No rompas la compatibilidad con entornos sin internet.
> - **Resolución y Pantallas**: Mantén siempre un enfoque *Responsive Design* (usando Flexbox, CSS Grid y Tailwind predictivo) para asegurar que la app se vea perfecta y sin distorsiones en cualquier tamaño de pantalla o monitor 1080p, 2K, 4K o portátiles pequeños.
> - **Matemáticas**: Si modificas `simulator.ts`, asegúrate de mantener la precisión de los *floats* y las fórmulas balísticas intactas.
> - **Trabajo**: Antes de reprogramar un módulo existente, usa VIEW_FILE para leer el código. Cuando estemos listos para exportar, asegúrate de correr `lint_applet` o `compile_applet`.
> 
> **Tu tarea ahora es decirme que has entendido esta arquitectura y preguntarme qué nuevas características, bugs o refactorizaciones vamos a trabajar en esta rama de versiones hoy."**

---

## 🌿 Flujo de Trabajo en GitHub (Ramas / Branches)
Para que tú y el resto del equipo estéis sincronizados, vamos a seguir este flujo exacto:

1. **Rama `main` (La rama de los Usuarios)**: El código en esta rama SIEMPRE debe ser estable. Desde aquí es de donde se compila el instalador `.exe` final que se enviará al público. Nunca se programa directamente aquí.
2. **Rama `develop` o `versiones` (La rama de Desarrollo)**: Aquí es donde subiréis las mejoras, arreglaréis bugs y experimentaréis. 

**Proceso diario:**
- Importa la rama `develop` a Google AI Studio.
- Usa el Asistente con el *Prompt* de arriba.
- Desarrolla y prueba las mejoras.
- Sube los cambios (Commit / Push) a la rama `develop`.
- Solamente cuando estéis 100% seguros de que la nueva versión es estable y perfecta, hacéis un "Pull Request" de `develop` hacia `main`, uniendo los códigos. Tras eso, compiláis el nuevo archivo `.exe`."
