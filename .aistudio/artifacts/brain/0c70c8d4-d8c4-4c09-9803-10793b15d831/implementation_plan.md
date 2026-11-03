# Implementation Plan - HERMES Simulator v2.0 Redesign & Splash Screen

## Objective
Upgrade HERMES Simulator to Version 2.0 with professional aerospace UI enhancements (glassmorphism, neon glowing accents, floating depth panels, and high contrast typography) and redesign the splash loading screen with the user's rocket workshop photo (`_DSC0362_f879f6df.JPG`) as an atmospheric, dark-purple tinted background with high-contrast glowing title and loading indicator.

---

## Proposed Changes

### 1. Splash Screen Redesign (`src/components/SplashScreen.tsx`)
- Update background to display `/public/assets/aistudio/_DSC0362_f879f6df.JPG` with a rich dark purple / slate gradient overlay (`bg-slate-950/85` combined with `backdrop-blur-sm` and purple shadow glows) so the photo provides an immersive engineering background while keeping text crystal clear.
- Display "HERMES SIMULATOR v2.0" in large, bold typography with aerospace glowing accents.
- Display subtitle "High Efficiency Rocket Motor Emulation System".
- Refine loading spinner and progress bar with smooth purple/cyan gradient effects.

### 2. Global v2.0 Aesthetic Enhancements (`src/App.tsx` & Tailwind UI)
- Enhance card containers and headers across the application with refined glassmorphism (`backdrop-blur-md bg-slate-900/80 border-slate-700/60 shadow-[0_8px_30px_rgb(0,0,0,0.3)]`), subtle neon purple borders, and depth lighting.
- Ensure all version badges and footer notes reflect v2.0.

---

## Verification Plan
- Run `lint_applet` (`tsc --noEmit`).
- Run `compile_applet` (Vite build).
