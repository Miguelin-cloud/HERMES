; HERMES Modular Assisted Installer Hook (electron-builder NSIS)
; Flow:
;   1. Welcome Page (COHETEROS + HERMES branded sidebar)
;   2. Destination Folder (MUI_PAGE_DIRECTORY)
;   3. Module Selector (Simulation Engine [mandatory], Post-Processing [optional], AI Agent [optional])
;   4. Progress Bar (MUI_PAGE_INSTFILES) + writes $INSTDIR\resources\modules.json
;   5. Finish Page with checkboxes for Desktop Shortcut & Launch HERMES

!ifndef BUILD_UNINSTALLER
  Var ModPostProcess
  Var ModAgenteJesus

  Var ChkPostProcess
  Var ChkAgenteJesus
  Var ModulesDialog

  ; Multilingual strings matching package.json installerLanguages: es-ES (3082), en-US (1033), fr-FR (1036), it-IT (1040)
  LangString HermesWelcomeTitle 3082 "Bienvenido al instalador de HERMES ${VERSION}"
  LangString HermesWelcomeTitle 1033 "Welcome to HERMES ${VERSION} Setup"
  LangString HermesWelcomeTitle 1036 "Bienvenue dans l'installation de HERMES ${VERSION}"
  LangString HermesWelcomeTitle 1040 "Benvenuto nell'installazione di HERMES ${VERSION}"

  LangString HermesWelcomeText 3082 "Este asistente instalará HERMES Simulator (Departamento de Propulsión COHETEROS) en tu equipo.$\r$\n$\r$\nEn los siguientes pasos podrás elegir la carpeta de destino y seleccionar los módulos opcionales que deseas activar.$\r$\n$\r$\nHaz clic en Siguiente para continuar."
  LangString HermesWelcomeText 1033 "This wizard will install HERMES Simulator (COHETEROS Propulsion Department) on your computer.$\r$\n$\r$\nIn the following steps you can choose the installation folder and select which optional modules to enable.$\r$\n$\r$\nClick Next to continue."
  LangString HermesWelcomeText 1036 "Cet assistant va installer HERMES Simulator (Département Propulsion COHETEROS) sur votre ordinateur.$\r$\n$\r$\nVous pourrez choisir le dossier d'installation et sélectionner les modules optionnels à activer.$\r$\n$\r$\nCliquez sur Suivant pour continuer."
  LangString HermesWelcomeText 1040 "Questa procedura installerà HERMES Simulator (Dipartimento Propulsione COHETEROS) sul tuo computer.$\r$\n$\r$\nPotrai scegliere la cartella di destinazione e selezionare i moduli opzionali da attivare.$\r$\n$\r$\nFai clic su Avanti per continuare."

  LangString HermesModTitle 3082 "Selección de Módulos"
  LangString HermesModTitle 1033 "Select Modules"
  LangString HermesModTitle 1036 "Sélection des Modules"
  LangString HermesModTitle 1040 "Selezione dei Moduli"

  LangString HermesModSubtitle 3082 "Elige los componentes de HERMES que deseas habilitar en esta instalación."
  LangString HermesModSubtitle 1033 "Choose which HERMES components you want to enable in this installation."
  LangString HermesModSubtitle 1036 "Choisissez les composants de HERMES à activer pour cette installation."
  LangString HermesModSubtitle 1040 "Scegli i componenti di HERMES da abilitare in questa installazione."

  LangString HermesModIntro 3082 "Selecciona los módulos que se activarán tras la instalación:"
  LangString HermesModIntro 1033 "Select the modules to activate after installation:"
  LangString HermesModIntro 1036 "Sélectionnez les modules à activer après l'installation :"
  LangString HermesModIntro 1040 "Seleziona i moduli da attivare dopo l'installazione:"

  LangString HermesModCoreTitle 3082 "[Obligatorio] Motor de Simulación HERMES"
  LangString HermesModCoreTitle 1033 "[Required] HERMES Simulation Engine"
  LangString HermesModCoreTitle 1036 "[Obligatoire] Moteur de Simulation HERMES"
  LangString HermesModCoreTitle 1040 "[Obbligatorio] Motore di Simulazione HERMES"

  LangString HermesModCoreDesc 3082 "Balística interna, análisis, Mission Control, Smart Search y animaciones 3D/CFD."
  LangString HermesModCoreDesc 1033 "Internal ballistics, analysis, Mission Control, Smart Search, and 3D/CFD animations."
  LangString HermesModCoreDesc 1036 "Balistique interne, analyse, Mission Control, Smart Search et animations 3D/CFD."
  LangString HermesModCoreDesc 1040 "Balistica interna, analisi, Mission Control, Smart Search e animazioni 3D/CFD."

  LangString HermesModPostTitle 3082 "[Opcional] Módulo de Post-Procesado"
  LangString HermesModPostTitle 1033 "[Optional] Post-Processing Module"
  LangString HermesModPostTitle 1036 "[Optionnel] Module de Post-Traitement"
  LangString HermesModPostTitle 1040 "[Opzionale] Modulo di Post-Elaborazione"

  LangString HermesModPostDesc 3082 "Estudios comparativos multi-motor, ensayos de banco y caracterización de propulsante."
  LangString HermesModPostDesc 1033 "Multi-motor comparative studies, static test overlays, and propellant characterization."
  LangString HermesModPostDesc 1036 "Études comparatives multi-moteurs, essais au banc et caractérisation du propergol."
  LangString HermesModPostDesc 1040 "Studi comparativi multi-motore, prove al banco e caratterizzazione del propellente."

  LangString HermesModAiTitle 3082 "[Opcional] Módulo de IA — Agente Jesús"
  LangString HermesModAiTitle 1033 "[Optional] AI Module — Agent Jesús"
  LangString HermesModAiTitle 1036 "[Optionnel] Module IA — Agent Jesús"
  LangString HermesModAiTitle 1040 "[Opzionale] Modulo IA — Agente Jesús"

  LangString HermesModAiDesc 3082 "Asistente técnico integrado para soporte, diagnóstico y análisis de propulsión."
  LangString HermesModAiDesc 1033 "Integrated technical assistant for propulsion analysis, guidance, and diagnostics."
  LangString HermesModAiDesc 1036 "Assistant technique intégré pour l'analyse et le diagnostic en propulsion."
  LangString HermesModAiDesc 1040 "Assistente tecnico integrato per analisi, supporto e diagnostica di propulsione."

  LangString HermesModNote 3082 "Los módulos desmarcados permanecerán visibles en la interfaz como bloqueados. Puedes volver a ejecutar este instalador en cualquier momento para activarlos."
  LangString HermesModNote 1033 "Unchecked modules will remain visible in the interface in a locked state. You can re-run this installer at any time to enable them."
  LangString HermesModNote 1036 "Les modules décochés resteront visibles mais verrouillés dans l'interface. Vous pouvez relancer cet installateur à tout moment pour les activer."
  LangString HermesModNote 1040 "I moduli deselezionati resteranno visibili ma bloccati nell'interfaccia. Puoi rieseguire questo programma di installazione in qualsiasi momento per attivarli."

  LangString HermesFinishTitle 3082 "Instalación de HERMES completada"
  LangString HermesFinishTitle 1033 "HERMES Setup Completed"
  LangString HermesFinishTitle 1036 "Installation de HERMES terminée"
  LangString HermesFinishTitle 1040 "Installazione di HERMES completata"

  LangString HermesFinishText 3082 "HERMES ${VERSION} se ha instalado correctamente en tu equipo.$\r$\n$\r$\nSelecciona las acciones finales y haz clic en Finalizar para cerrar el asistente."
  LangString HermesFinishText 1033 "HERMES ${VERSION} has been successfully installed on your computer.$\r$\n$\r$\nSelect your final options and click Finish to close the wizard."
  LangString HermesFinishText 1036 "HERMES ${VERSION} a été installé avec succès sur votre ordinateur.$\r$\n$\r$\nChoisissez vos options finales puis cliquez sur Terminer."
  LangString HermesFinishText 1040 "HERMES ${VERSION} è stato installato correttamente sul tuo computer.$\r$\n$\r$\nSeleziona le opzioni finali e fai clic su Fine per chiudere la procedura."

  LangString HermesFinishRun 3082 "Ejecutar HERMES ${VERSION}"
  LangString HermesFinishRun 1033 "Launch HERMES ${VERSION}"
  LangString HermesFinishRun 1036 "Lancer HERMES ${VERSION}"
  LangString HermesFinishRun 1040 "Avvia HERMES ${VERSION}"

  LangString HermesFinishShortcut 3082 "Crear acceso directo en el escritorio"
  LangString HermesFinishShortcut 1033 "Create desktop shortcut"
  LangString HermesFinishShortcut 1036 "Créer un raccourci sur le bureau"
  LangString HermesFinishShortcut 1040 "Crea collegamento sul desktop"
!endif

!macro customInit
  !ifndef BUILD_UNINSTALLER
    StrCpy $ModPostProcess "1"
    StrCpy $ModAgenteJesus "1"
  !endif
!macroend

; Keep setup streamlined for current user (skips redundant "All Users / Only Me" UAC screen)
!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "$(HermesWelcomeTitle)"
  !define MUI_WELCOMEPAGE_TEXT "$(HermesWelcomeText)"
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customPageAfterChangeDir
  !include "nsDialogs.nsh"

  Page custom hermesModulesPageCreate hermesModulesPageLeave

  Function hermesModulesPageCreate
    !insertmacro MUI_HEADER_TEXT "$(HermesModTitle)" "$(HermesModSubtitle)"

    nsDialogs::Create 1018
    Pop $ModulesDialog
    ${If} $ModulesDialog == error
      Abort
    ${EndIf}

    ${NSD_CreateLabel} 0 0 100% 14u "$(HermesModIntro)"
    Pop $0

    ${NSD_CreateCheckbox} 4u 18u 96% 12u "$(HermesModCoreTitle)"
    Pop $0
    ${NSD_Check} $0
    EnableWindow $0 0

    ${NSD_CreateLabel} 18u 31u 92% 16u "$(HermesModCoreDesc)"
    Pop $0

    ${NSD_CreateCheckbox} 4u 50u 96% 12u "$(HermesModPostTitle)"
    Pop $ChkPostProcess
    ${If} $ModPostProcess == "1"
      ${NSD_Check} $ChkPostProcess
    ${EndIf}

    ${NSD_CreateLabel} 18u 63u 92% 16u "$(HermesModPostDesc)"
    Pop $0

    ${NSD_CreateCheckbox} 4u 82u 96% 12u "$(HermesModAiTitle)"
    Pop $ChkAgenteJesus
    ${If} $ModAgenteJesus == "1"
      ${NSD_Check} $ChkAgenteJesus
    ${EndIf}

    ${NSD_CreateLabel} 18u 95u 92% 16u "$(HermesModAiDesc)"
    Pop $0

    ${NSD_CreateLabel} 0 116u 100% 24u "$(HermesModNote)"
    Pop $0

    nsDialogs::Show
  FunctionEnd

  Function hermesModulesPageLeave
    ${NSD_GetState} $ChkPostProcess $0
    ${If} $0 == ${BST_CHECKED}
      StrCpy $ModPostProcess "1"
    ${Else}
      StrCpy $ModPostProcess "0"
    ${EndIf}

    ${NSD_GetState} $ChkAgenteJesus $0
    ${If} $0 == ${BST_CHECKED}
      StrCpy $ModAgenteJesus "1"
    ${Else}
      StrCpy $ModAgenteJesus "0"
    ${EndIf}
  FunctionEnd
!macroend

!macro customFinishPage
  !ifndef BUILD_UNINSTALLER
    Function HermesStartApp
      ${if} ${isUpdated}
        StrCpy $1 "--updated"
      ${else}
        StrCpy $1 ""
      ${endif}
      ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
    FunctionEnd

    Function HermesCreateDesktopShortcut
      CreateShortCut "$DESKTOP\${SHORTCUT_NAME}.lnk" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
      ClearErrors
      WinShell::SetLnkAUMI "$DESKTOP\${SHORTCUT_NAME}.lnk" "${APP_ID}"
      System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
    FunctionEnd

    !define MUI_FINISHPAGE_TITLE "$(HermesFinishTitle)"
    !define MUI_FINISHPAGE_TEXT "$(HermesFinishText)"
    !ifndef HIDE_RUN_AFTER_FINISH
      !define MUI_FINISHPAGE_RUN
      !define MUI_FINISHPAGE_RUN_TEXT "$(HermesFinishRun)"
      !define MUI_FINISHPAGE_RUN_FUNCTION "HermesStartApp"
    !endif
    !define MUI_FINISHPAGE_SHOWREADME
    !define MUI_FINISHPAGE_SHOWREADME_TEXT "$(HermesFinishShortcut)"
    !define MUI_FINISHPAGE_SHOWREADME_FUNCTION "HermesCreateDesktopShortcut"
    !insertmacro MUI_PAGE_FINISH
  !endif
!macroend

!macro customInstall
  CreateDirectory "$INSTDIR\resources"
  ClearErrors
  FileOpen $0 "$INSTDIR\resources\modules.json" w
  ${IfNot} ${Errors}
  ${AndIf} $0 != ""
    StrCpy $1 "false"
    ${If} $ModPostProcess == "1"
      StrCpy $1 "true"
    ${EndIf}
    StrCpy $2 "false"
    ${If} $ModAgenteJesus == "1"
      StrCpy $2 "true"
    ${EndIf}
    FileWrite $0 "{$\"core$\":true,$\"postprocess$\":$1,$\"agente_jesus$\":$2}"
    FileClose $0
  ${EndIf}
!macroend

!macro customUnInstall
  Delete "$INSTDIR\resources\modules.json"
  WinShell::UninstShortcut "$DESKTOP\${SHORTCUT_NAME}.lnk"
  Delete "$DESKTOP\${SHORTCUT_NAME}.lnk"
  System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
!macroend
