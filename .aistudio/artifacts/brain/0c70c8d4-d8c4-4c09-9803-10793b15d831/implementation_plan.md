# Implementation Plan: Fix Propellant Guide Box & Update Results Guide Simulation Flow

## Problem Summary
1. **Propellant Guide Step 2 Bounding Box**: In `tour_create_propellant` (Step 2), the spotlight bounding box around `data-tour="propellant-standard-section"` extends off the top of the modal overlay, causing clipping and visual misalignment.
2. **Results Guide (`tour_results`) Simulation Flow**: Automatically triggering `runSim()` synchronously during step autofill caused missing results. Per user choice, Step 1 will load the motor preset inputs and explicitly guide the user to click the red **"SIMULAR"** button to generate clean ballistic curves before proceeding through the guide.

---

## Proposed Changes

### 1. Fix Propellant Guide Step 2 Highlight Box
- **Target File**: `src/components/CustomPropellantModal.tsx` & `src/lib/toursData.ts`
- **Actions**:
  - Relocate `data-tour="propellant-standard-section"` to the inner grid container of standard propellant cards inside the modal's scrollable body rather than wrapping external margins.
  - Ensure `InteractiveTourOverlay.tsx` accurately calculates `getBoundingClientRect()` for elements inside scrolled modal views, clamping padding to visible viewport boundaries so the spotlight box never overflows the modal header.

### 2. Update Results Guide (`tour_results`) Step 1 Flow
- **Target File**: `src/lib/toursData.ts`
- **Actions**:
  - Update Step 1 of `tour_results` to load the preset motor parameters (BATES 3x54mm KNSB) and clearly instruct the user:
    1. Click **"Cargar Motor BATES 3x54mm KNSB"** to load the motor configuration.
    2. Click the red **"SIMULAR"** button in the top bar to run the differential solver.
    3. Click **"Siguiente"** in the tour to inspect the generated $P(t)$ and $F(t)$ curves, Tripoli motor class, and performance cards.
  - Ensure the preset callback (`onAutofill`) sets the grains, motor, and nozzle parameters without attempting premature synchronous execution, letting the user trigger the simulation cleanly.

---

## Verification Plan

### Automated Build & Lint Verification
1. Run `lint_applet` (`tsc --noEmit`) to verify no type or syntax errors.
2. Run `compile_applet` to confirm the Vite build succeeds.

### Interactive Visual Verification
1. Open the "Create a Custom Propellant" guide (`tour_create_propellant`) and verify that Step 2 highlights `data-tour="propellant-standard-section"` cleanly inside the modal bounds without top overflow.
2. Open the "Results" guide (`tour_results`), click the preset button to load the BATES 3x54mm motor, click "SIMULAR", and confirm that the simulation completes and all ballistic cards and charts render properly.
