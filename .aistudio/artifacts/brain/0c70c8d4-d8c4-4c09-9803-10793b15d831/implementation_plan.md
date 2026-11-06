# Plan y Estado de Implementación: Refactorización Global Smart Search & Differential Evolution

## 1. Resumen de Objetivos Implementados

Este documento resume las especificaciones técnicas completadas para la unificación del optimizador balístico de **HERMES** y las mejoras de flujo solicitadas para la pestaña **Smart Search**:

1. **Bandeja de Objetivos de Misión al Iniciar (Paso 0)**:
   - Al ingresar a la pestaña Smart Search, el usuario accede primero a una bandeja inicial con el objetivo primordial: **Máxima Altitud / Mayor Impulso Total ($I_{\text{total}}$)**.
   - Al pulsar la bandeja, el flujo avanza de forma secuencial y limpia:
     $$\text{Bandeja de Objetivos (Paso 0)} \longrightarrow \text{Fase 1: Hardware} \longrightarrow \text{Fase 2: Granos} \longrightarrow \text{Fase 3: Algoritmos y Ejecución}$$
   - Se eliminó la selección redundante de 5 objetivos que anteriormente se encontraba al final de la Fase 3, sustituyéndola por una tarjeta de confirmación del objetivo activo fijado desde la bandeja con enlace directo para volver a la bandeja si se desea.

2. **Botón de Cancelar Simulación en Rojo y Recuperación de Resultados**:
   - Implementado un controlador de cancelación síncrono/asíncrono (`shouldStop?: () => boolean` y `abortControllerRef`).
   - Tanto en el panel HUD interactivo de progreso como en la barra de acciones inferior, se despliega un botón **CANCELAR SIMULACIÓN** en color rojo de alta visibilidad durante la ejecución.
   - Al cancelarse, la simulación se interrumpe inmediatamente en el paso de generación actual, sin bloquear el hilo principal ni provocar congelamientos.
   - El sistema devuelve y visualiza los mejores candidatos factibles evaluados hasta el momento de la interrupción, acompañados de una notificación clara de simulación cancelada.

3. **Documentación Detallada en "Algoritmo & Formulación"**:
   - Al pulsar el botón "Algoritmo & Formulación", se despliega una explicación exhaustiva de los tres modos de algoritmo y su modus operandi:
     - **Búsqueda Rápida (500 simulaciones / N)**: Población $NP = 15$, generaciones $G = 33$, muestreo LHS estratificado. Ideal para barridos preliminares de viabilidad dimensional.
     - **Búsqueda Estándar (1.000 simulaciones / N - Recomendado)**: Población $NP = 25$, generaciones $G = 40$, dither estocástico $F \in [0.5, 0.9]$ por generación y cruce binomial $CR = 0.85$. Óptimo para diseño balístico de alta fidelidad.
     - **Búsqueda Profunda (2.000 simulaciones / N)**: Población $NP = 40$, generaciones $G = 50$. Mapeo exhaustivo para valles de fitness estrechos, geometrías de estrella o propulsores con alto exponente de presión $n$.
     - **Motor Balístico 0D Intacto**: Se conserva intacta la integración numérica diferencial transitoria exacta de Vieille ($r = a \cdot P^n$), continuidad en cámara con tobera de Laval y regresión geométrica 3D.
     - **Reglas de Factibilidad de Deb (1998)**: Detalle técnico de por qué los métodos continuos basados en gradiente (`fmincon`, Newton-Raphson) fallan en balística de cohetes (discontinuidades temporales por desaparición de caras de grano y censura por sobrepresión), y cómo las reglas de dominancia de Deb guían la convergencia hacia el máximo impulso sin funciones de penalización arbitrarias.

4. **Maximización Estricta de Impulso Real**:
   - Clasificación directa por $I_{\text{total}} = \int_0^{t_b} F(t) \, dt$ devuelto por el simulador físico, sin penalizaciones por volumen de empaque o planitud.
   - Evaluación transparente por número de granos ($N$) que permite seleccionar la mejor configuración factible global.

---

## 2. Verificación y Calidad

- **Compilación**: Verificada con `compile_applet` (`npm run build`), pasando con 0 errores.
- **Tipado**: Verificado con `lint_applet` (`tsc --noEmit`), pasando con 0 errores.
- **Servidor de Desarrollo**: Verificado en puerto 3000 con respuesta `HTTP/1.1 200 OK`.
