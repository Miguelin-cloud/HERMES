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

## 🌿 Flujo de Trabajo en GitHub (Ramas / Branches) y Sincronización

Para que tú y el resto del equipo estéis sincronizados como verdaderos profesionales, vamos a usar el sistema de ramas (branches) de GitHub. Aquí te explico paso a paso cómo crearlo y cómo debe conectarse tu compañero.

### Parte 1: Creación de la Rama de Desarrollo (Lo que debes hacer TÚ)

Como tú eres el creador original que tiene el código "perfecto" en la versión 1.0, debes aislar ese código para protegerlo y crear una "pista de pruebas" para tu compañero.

1. **Sube el código inicial**: Sincroniza este proyecto con un nuevo repositorio en tu cuenta de GitHub (desde el botón superior de AI Studio "Sync to GitHub"). Por defecto, esto se subirá a la rama principal, que a partir de ahora llamaremos la **Rama de Usuarios** (`main`).
2. **Ve a tu repositorio en GitHub.com**.
3. Busca el botón desplegable que dice **"main"** (suele estar arriba a la izquierda de la lista de archivos).
4. Escribe la palabra **`develop`** (o `desarrollo`) en la caja de texto. 
5. Aparecerá una opción debajo que dice *"Create branch: develop from 'main'"*. Haz clic ahí.

¡Listo! Acabas de clonar todo el código perfecto a una rama paralela llamada `develop`. 
*   Tu rama `main` está **protegida** para generar los `.exe`.
*   Tu rama `develop` está **lista** para que tu compañero empiece a destrozar y mejorar el código.

### Parte 2: Cómo debe conectarse tu Compañero (Lo que debe hacer ÉL)

Tu compañero *no* se va a descargar zips ni archivos sueltos. Se conectará directamente al "cerebro central" de tu GitHub. Pásale estos pasos exactos:

**Paso A: Acceso en GitHub**
1. (Tú) Tienes que invitarle a tu repositorio de GitHub como colaborador (Settings -> Collaborators -> Add people).
2. (Compañero) Debe aceptar la invitación que le llegará a su email.

**Paso B: Importar a Google AI Studio**
1. Él debe entrar en su propia cuenta de **Google AI Studio (Build)**.
2. Hacer clic en el botón de la carpeta **"Import"** u "Open Project".
3. Seleccionar la opción de **"GitHub"**.
4. Ahora, AI Studio le mostrará sus repositorios y los tuyos (como tiene permiso). Debe buscar el repositorio de HERMES.
5. **¡PASO CRÍTICO!**: Antes de abrirlo, AI Studio le preguntará o le mostrará una opción de qué rama (*branch*) quiere importar. **Dile que NUNCA elija `main`. Debe elegir SIEMPRE la rama `develop`**.
6. Le da a cargar.

**Paso C: Iniciar el trabajo con la IA**
1. Una vez cargado el código en su AI Studio, él debe pegar el **Prompt Creador** (el texto gigante de la sección superior de este documento) en el chat con la IA.
2. Al hacer esto, la IA repasará todos los archivos, entenderá la arquitectura y estará lista para programar. 

**Paso D: Guardar su trabajo**
1. Cuando haya probado las mejoras en el visor, él debe darle al botón de arríba a la derecha de AI Studio: **"Sync to GitHub"**.
2. Al hacerlo, esos cambios irán directamente a la rama `develop` de GitHub. No habrá tocado vuestro ejecutable original, pero los archivos de desarrollo estarán actualizados para mañana.

### Parte 3: ¿Qué pasa cuando queremos sacar la Versión 2.0 en .exe?

1. Tú entras en GitHub.com a tu rama `develop` y compruebas que todo el trabajo de tu compañero mola.
2. Le das al botón de GitHub que pone **"Pull Request"**.
3. Indicas que quieres fusionar `develop` hacia `main`.
4. Aceptas el Pull request ("Merge").
5. ¡Magia! El código perfecto y el nuevo invento de tu colega se abrazan en la rama principal. Descargas el ZIP de `main`, empaquetas el `.exe` como de costumbre y anuncias la V2 al público.
