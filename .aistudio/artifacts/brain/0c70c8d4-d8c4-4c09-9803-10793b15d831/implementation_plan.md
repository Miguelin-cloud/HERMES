# Plan de Implementación: Mejoras Secuenciales en Smart Search y Mission Control

Plan de trabajo por fases para resolver la localización multilingüe (Español, Francés, Italiano, Inglés) en la pestaña Smart Search y actualizar el bloque de Mission Control con cálculo 2D de apogeo por ángulo de trayectoria (*Flight Path Angle*), visualización dual AGL/ASL y un gestor visual de curvas aerodinámicas Mach vs Cd.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> **Decisiones confirmadas por el usuario en la fase de clarificación:**
> 1. **Visualización de Apogeo:** Se indicarán claramente las siglas y descripciones dinámicas según el idioma de la aplicación:
>    - **AGL** (*Above Ground Level* / Sobre Plataforma de Lanzamiento).
>    - **ASL** (*Above Sea Level* / Sobre el Nivel del Mar - SNM).
> 2. **Importación de Curva Mach vs Cd:** Se integrará un botón visible directo de importación con ventana modal interactiva, tabla visual de formato esperado (columnas de Mach y Cd) y botón de descarga directa de plantilla (`.csv` / `.xlsx` / `.txt`).
> 3. **Flight Path Angle:** Convención estándar de elevación respecto a la horizontal ($90^\circ$ = vertical pura, $87^\circ$ = $3^\circ$ de inclinación en rampa). Afecta directamente al cálculo 2D de trayectoria tanto para el modelo teórico como para la comparativa con datos experimentales.
> 4. **Ejecución Secuencial:** Cada fase se desarrollará, compilará y verificará de manera independiente antes de continuar con la siguiente.

---

### 1. Visión General del Sistema y Fases

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 ARQUITECTURA DE MEJORAS                                │
├───────────────────────────────────────┬────────────────────────────────────────────────┤
│         PESTAÑA SMART SEARCH          │            PESTAÑA MISSION CONTROL             │
├───────────────────────────────────────┼────────────────────────────────────────────────┤
│ • Localización completa en 4 idiomas  │ • Parámetro Cohete: Flight Path Angle (γ)      │
│   (Español, Inglés, Francés, Italiano)│ • Apogeo 2D: Ecuaciones balísticas inclinadas  │
│ • Reemplazo del operador binario      │ • Indicadores dinámicos AGL (Rampa) y ASL (SNM)│
│   `isSpanish ? ... : ...`             │ • Modal e importador visual para curva Mach-Cd │
│ • Traducción de fases, avisos y HUD   │ • Plantilla descargable y validación en vivo   │
└───────────────────────────────────────┴────────────────────────────────────────────────┘
```

---

### 2. Desglose Secuencial de Fases de Implementación

#### **Fase 1: Localización Multilingüe Completa de Smart Search (ES, EN, FR, IT)**
* **Problema:** Actualmente `src/components/SmartSearchEngine.tsx` utiliza la condición binaria `const isSpanish = lang === 'es'`. Al seleccionar Francés (`fr`) o Italiano (`it`), todos los textos de las fases, cabeceras, botones, avisos de validación y explicaciones permanecen en inglés.
* **Solución:**
  1. Implementar una función de localización cuádruple `loc(es, en, fr, it)` o diccionario tipado dentro de `SmartSearchEngine.tsx`.
  2. Traducir al francés e italiano todos los elementos:
     - Cabecera y HUD de optimización (`HERMES SMART SEARCH`).
     - Bandeja de objetivos (`Máxima Altitud / Impulso Total`).
     - Fase 1 (Parámetros de Cámara y Tobera, avisos de escoria/erosión).
     - Fase 2 (Restricciones de Granos, avisos de espesor de pared y límites de cámara).
     - Fase 3 (Algoritmos: Búsqueda Rápida, Estándar y Profunda).
     - Guía de Formulación y comparativa algorítmica.
     - Botón de cancelación y estados de progreso.
* **Verificación de la Fase 1:** Comprobación del selector de idioma en la barra superior alternando entre ES, EN, FR e IT, asegurando traducción nativa completa sin fugas de texto en inglés.

---

#### **Fase 2: Incorporación del Flight Path Angle y Trayectoria 2D de Apogeo**
* **Problema:** `calculateApogee` en `src/lib/apogee.ts` asume un lanzamiento vertical puro a $90^\circ$ (1D). No existe la variable de ángulo de inclinación de la rampa en los parámetros del cohete, lo que sobreestima el apogeo vertical si el cohete se lanza con ángulo (ej. $87^\circ$, $85^\circ$).
* **Solución:**
  1. En `src/lib/apogee.ts`, actualizar `calculateApogee` para resolver las ecuaciones de movimiento en 2D (vector de velocidad $\vec{v} = (v_x, v_y)$ y posición $\vec{r} = (x, y)$):
     $$\vec{a} = \frac{\vec{F}_{thrust} + \vec{F}_{drag}}{m} + (0, -g)$$
     Donde el empuje actúa a lo largo de la trayectoria inicial impuesta por la rampa ($\theta_0 = \text{flightPathAngle}$) y posteriormente por el vector de velocidad, y la gravedad actúa en el eje vertical $(0, -g)$.
  2. El apogeo vertical relativo se alcanza en el instante donde $v_y = 0$.
  3. En `src/components/MissionControl.tsx`, añadir el campo **Ángulo de Lanzamiento (*Flight Path Angle*) [º]** con valor por defecto $90^\circ$ (configurable entre $60^\circ$ y $90^\circ$) en el bloque de **Parámetros del Cohete**.
* **Verificación de la Fase 2:** Comparar un lanzamiento a $90^\circ$ vs $87^\circ$; verificar que la altitud máxima del apogeo vertical disminuye congruentemente debido a la componente horizontal y que la velocidad horizontal downrange se calcula sin errores.

---

#### **Fase 3: Visualización Dinámica de Apogeo Dual (AGL y ASL / SNM) en 4 Idiomas**
* **Problema:** El usuario necesita saber con precisión si la altitud de apogeo mostrada es sobre la plataforma o sobre el nivel del mar, evitando confusiones durante el lanzamiento.
* **Solución:**
  1. En el bloque de métricas teóricas y experimentales de `MissionControl.tsx`, mostrar la cota de apogeo de forma explícita:
     - **Apogeo AGL** (*Sobre la Plataforma* / *Above Ground Level*): $h_{AGL} = h_{rel}$.
     - **Apogeo ASL / SNM** (*Sobre el Nivel del Mar* / *Above Sea Level*): $h_{ASL} = h_{launch} + h_{rel}$.
  2. Adaptar las siglas e indicadores dinámicamente según el idioma:
     - **ES:** `AGL (Sobre Plataforma)` / `SNM (Sobre el Nivel del Mar)`.
     - **EN:** `AGL (Above Ground Level)` / `ASL (Above Sea Level)`.
     - **FR:** `AGL (Au-dessus du Sol)` / `AMSL (Au-dessus du Niveau de la Mer)`.
     - **IT:** `AGL (Sopra la Piattaforma)` / `s.l.m. (Sul Livello del Mare)`.
* **Verificación de la Fase 3:** Verificar que la suma $h_{launch} + h_{rel}$ coincide matemáticamente con la altitud de la plataforma ingresada y que las siglas cambian correctamente con el selector de idioma.

---

#### **Fase 4: Importador Visual y Gestor de Curvas Mach vs Cd**
* **Problema:** En la tarjeta de **Datos Aerodinámicos (Mach vs Cd)**, al no estar marcada la casilla, el contenido se oculta y el usuario no dispone de un botón visible de importación ni de un asistente claro para entender el formato de archivo requerido.
* **Solución:**
  1. Diseñar un botón destacado **"Importar Curva Mach vs Cd"** visible siempre en la cabecera de la tarjeta junto a un botón de **"Ver Formato / Ejemplo"**.
  2. Implementar una ventana modal interactiva (`ModalFormatAero`) similar al importador de datos experimentales que incluya:
     - Explicación didáctica de las dos columnas esperadas: Columna 1 = Número de Mach ($M \ge 0$), Columna 2 = Coeficiente de Resistencia ($C_d$).
     - Vista previa de una tabla de ejemplo con datos típicos transónicos y supersónicos ($M = 0.0$ a $3.0$).
     - Botón de descarga de plantilla (`hermes_plantilla_mach_cd.csv`).
     - Zona de carga (*drag & drop*) de archivos `.csv`, `.xlsx`, `.xls` y `.txt`, con detección automática de separadores (coma, punto y coma, tabuladores).
     - Área de pegado manual directo para usuarios que copian celdas directamente desde Excel.
  3. Asegurar que cuando se carguen datos aerodinámicos, el cálculo de apogeo de Mission Control utilice prioritariamente la interpolación de esa curva y se informe al usuario en pantalla con una insignia verde indicando el número de puntos activos.
* **Verificación de la Fase 4:** Cargar un archivo de prueba con $C_d$ elevado (ej. $0.90$) y verificar que el apogeo se reduce en consecuencia respecto al $C_d$ estándar; descargar la plantilla y comprobar su apertura limpia en Excel/Sheets.

---

### 3. Plan de Verificación y Compilación
* Tras cada fase, se ejecutará `compile_applet` y `lint_applet` para garantizar cero errores de TypeScript y de interfaz.
* Se probará en el navegador `localhost:3000` comprobando que los estados reactivos, el cambio de idioma y los cálculos aerodinámicos funcionan con fluidez.
