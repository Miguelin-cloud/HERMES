# 🛠️ Guía Maestra: Crea tu Aplicación HERMES (.exe) para Escritorio

¡Hola! Has elegido la opción de **Electron** para convertir este simulador en un programa profesional que cualquiera pueda instalar en su ordenador. Como es tu primera vez, he preparado esta guía paso a paso para que no te pierdas.

> **Importante**: La creación del archivo instalador (`.exe`) se debe hacer **en tu propio ordenador**, ya que requiere acceso a las herramientas del sistema que no están disponibles en el navegador.

---

## 1️⃣ Paso 1: Descarga el Código
Primero, saca todo el trabajo que hemos hecho de aquí a tu escritorio:
1.  Arriba a la derecha, busca el botón **Settings** (Ajustes).
2.  Pulsa en **Export to ZIP**.
3.  Guarda el archivo en tu ordenador y **descomprímelo** (clic derecho -> Extraer todo) en una carpeta que tengas a mano, por ejemplo, en el Escritorio.

---

## 2️⃣ Paso 2: Prepara tu Ordenador (Solo la primera vez)
Para que tu PC pueda "cocinar" el código y convertirlo en una app, necesita un pequeño motor llamado **Node.js**:
1.  Ve a [nodejs.org](https://nodejs.org/).
2.  Descarga la versión que dice **LTS** (es la más estable).
3.  Instálala como cualquier otro programa (Siguiente, Siguiente, Aceptar).

---

## 3️⃣ Paso 3: Abre la "Cocina" (Terminal)
Ahora vamos a decirle al ordenador que trabaje con los archivos que descargaste:
1.  Entra en la carpeta donde extrajiste el código.
2.  En la barra de direcciones de la carpeta (arriba, donde pone la ruta), escribe `cmd` y pulsa **Enter**. Se abrirá una ventana negra (la terminal).

---

## 4️⃣ Paso 4: Comandos Mágicos
Escribe estos comandos en la ventana negra uno por uno (pulsa Enter después de cada uno y espera a que terminen):

### A) Instalar las herramientas necesarias:
Este paso descarga todas las librerías (React, Recharts, Electron...) en tu carpeta.
```bash
npm install
```

### B) Crear el instalador (.exe):
Este es el comando que hace todo el trabajo pesado. Limpia el código, lo prepara para Windows y crea el instalador.
```bash
npm run electron:build
```

---

## 5️⃣ ¡Ya lo tienes!
Cuando el proceso termine (verás que pone "Done" o vuelve a aparecer el cursor), ve a tu carpeta del proyecto. 
*   Verás que ha aparecido una carpeta nueva llamada **`release`**.
*   Dentro de `release` encontrarás el instalador **`HERMES V2.1.0 Setup 2.1.0.exe`**.

**¡Ese es tu instalador!** Puedes enviárselo a quien quieras, subirlo a una web o mandarlo por correo. Al ejecutarlo, mostrará la bienvenida con la identidad oficial de **COHETEROS**, te permitirá elegir la carpeta de destino, seleccionar los módulos (Motor de simulación obligatorio con animaciones 3D/CFD, Post-procesado opcional y Módulo de IA Agente Jesús opcional) y, al finalizar, decidir si crear el acceso directo en el escritorio y ejecutar HERMES.

---

## 🎨 Personalización Final
Si quieres cambiar el icono o las imágenes del instalador antes de crear el `.exe`:
1.  Reemplaza los archivos `public/icon.png` y `public/icon.ico` (icono de la app) o `build/installerSidebar.bmp` (`164×314`) y `build/installerHeader.bmp` (`150×57`).
2.  Vuelve a ejecutar `npm run electron:build`.

---

## 🛡️ Compatibilidad Automática en Windows (GPU / Sandbox)
*   **Intel Arc / Drivers estrictos / Windows 11**: HERMES incorpora arranque adaptativo automático. Si el proceso gráfico falla en un equipo, el sistema limpia las cachés gráficas y escala automáticamente al modo compatible (`--no-sandbox` manteniendo aceleración 3D, o renderizado SwiftShader por software si el controlador lo bloquea), sin necesidad de modificar accesos directos manualmente.
*   **Diagnóstico opcional por línea de comandos**: Si un usuario desea forzar o restablecer un modo manualmente, puede abrir la app con `--software-gl` (modo seguro CPU) o `--reset-gpu` (restablecer perfil gráfico).
*   **Aviso de Windows SmartScreen**: Como la aplicación no está firmada con un certificado comercial, Windows puede mostrar "Windows protegió su PC". Pulsa en *"Más información"* y luego en *"Ejecutar de todas formas"*.
*   **Probar sin instalar**: Si solo quieres ver cómo queda la ventana sin generar el `.exe`, ejecuta `npm run dev` en una terminal y `npm run electron:dev` en otra.

¡Disfruta de tu nueva aplicación de escritorio de HERMES! 🚀
