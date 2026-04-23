# Guía para crear el Ejecutable de HERMES (.exe)

Has exportado el proyecto para convertirlo en una aplicación de escritorio profesional usando **Electron**. Sigue estos pasos en tu ordenador:

## Requisitos previos
1. Descarga e instala **Node.js** (versión LTS recomendada) desde [nodejs.org](https://nodejs.org/).

## Pasos para crear el ejecutable

1.  **Descomprime el archivo ZIP** en una carpeta en tu escritorio.
2.  **Abre una terminal** (Símbolo del sistema o PowerShell en Windows) dentro de esa carpeta.
3.  **Instala las dependencias**:
    ```bash
    npm install
    ```
4.  **Genera el ejecutable**:
    Ejecuta el siguiente comando para compilar el código y empaquetarlo:
    ```bash
    npm run electron:build
    ```
5.  **Recoge tu App**:
    Cuando termine, aparecerá una carpeta llamada `release`. Dentro encontrarás el instalador `.exe` (o el ejecutable portable).

## Personalización del Icono
El sistema está configurado para buscar un icono en `public/icon.png`. 
*   **Diseño propuesto**: He diseñado conceptualmente un logo que une el casco alado de Hermes con el cuerpo aerodinámico de un cohete en tonos azules eléctricos y oro titanio.
*   **Cómo cambiarlo**: Simplemente reemplaza el archivo `public/icon.png` por tu imagen favorita y vuelve a ejecutar el comando de build.

## Probar en modo desarrollo
Si quieres ver cómo queda la ventana antes de crear el ejecutable, usa:
```bash
npm run dev          # En una terminal para arrancar el servidor web
npm run electron:dev # En otra terminal para abrir la ventana de escritorio
```
