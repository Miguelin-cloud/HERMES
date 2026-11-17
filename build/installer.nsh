; HERMES Modular Extensions Installer Hook (electron-builder NSIS assisted installer)
; Shown right after MUI_PAGE_DIRECTORY (folder browser) via !macro customPageAfterChangeDir.
; Persists selected modules into $INSTDIR\resources\modules.json so the Electron runtime knows
; which optional extensions/plugins the user chose to install.

!ifndef BUILD_UNINSTALLER
  Var ModAnimations
  Var ModAgenteJesus
  Var ModPropChar

  Var ChkAnimations
  Var ChkAgenteJesus
  Var ChkPropChar
  Var ModulesDialog
!endif

!macro customInit
  !ifndef BUILD_UNINSTALLER
    StrCpy $ModAnimations "1"
    StrCpy $ModAgenteJesus "1"
    StrCpy $ModPropChar "1"
  !endif
!macroend

!macro customPageAfterChangeDir
  !include "nsDialogs.nsh"

  Page custom hermesModulesPageCreate hermesModulesPageLeave

  Function hermesModulesPageCreate
    !insertmacro MUI_HEADER_TEXT "Extensiones y Paquetes Opcionales" "Elige qué módulos de HERMES quieres instalar (podrás reinstalar para cambiarlos)."

    nsDialogs::Create 1018
    Pop $ModulesDialog
    ${If} $ModulesDialog == error
      Abort
    ${EndIf}

    ${NSD_CreateLabel} 0 0 100% 24u "HERMES Core (Motor balístico, Análisis, Mission Control y Smart Search) se instalará siempre en la ruta seleccionada."
    Pop $0

    ${NSD_CreateCheckbox} 8u 32u 100% 14u "[ Obligatorio ] Núcleo HERMES Simulator + Motor Balístico"
    Pop $0
    ${NSD_Check} $0
    EnableWindow $0 0

    ${NSD_CreateCheckbox} 8u 54u 100% 14u "Animaciones 3D de Vuelo y Motor CFD (~3 MB extra)"
    Pop $ChkAnimations
    ${If} $ModAnimations == "1"
      ${NSD_Check} $ChkAnimations
    ${EndIf}

    ${NSD_CreateCheckbox} 8u 76u 100% 14u "Agente Jesús — Asistente IA Local (futuro paquete pesado con modelo IA)"
    Pop $ChkAgenteJesus
    ${If} $ModAgenteJesus == "1"
      ${NSD_Check} $ChkAgenteJesus
    ${EndIf}

    ${NSD_CreateCheckbox} 8u 98u 100% 14u "Caracterización del Propulsante — Ajuste experimental de leyes (a, n)"
    Pop $ChkPropChar
    ${If} $ModPropChar == "1"
      ${NSD_Check} $ChkPropChar
    ${EndIf}

    ${NSD_CreateLabel} 0 122u 100% 24u "Nota: Los módulos no marcados mostrarán un aviso en su pestaña para ahorrar espacio. Para activarlos más adelante, desinstala HERMES y vuelve a ejecutar el instalador."
    Pop $0

    nsDialogs::Show
  FunctionEnd

  Function hermesModulesPageLeave
    ${NSD_GetState} $ChkAnimations $0
    ${If} $0 == ${BST_CHECKED}
      StrCpy $ModAnimations "1"
    ${Else}
      StrCpy $ModAnimations "0"
    ${EndIf}

    ${NSD_GetState} $ChkAgenteJesus $0
    ${If} $0 == ${BST_CHECKED}
      StrCpy $ModAgenteJesus "1"
    ${Else}
      StrCpy $ModAgenteJesus "0"
    ${EndIf}

    ${NSD_GetState} $ChkPropChar $0
    ${If} $0 == ${BST_CHECKED}
      StrCpy $ModPropChar "1"
    ${Else}
      StrCpy $ModPropChar "0"
    ${EndIf}
  FunctionEnd
!macroend

!macro customInstall
  CreateDirectory "$INSTDIR\resources"
  ClearErrors
  FileOpen $0 "$INSTDIR\resources\modules.json" w
  ${IfNot} ${Errors}
  ${AndIf} $0 != ""
    StrCpy $1 "false"
    ${If} $ModAnimations == "1"
      StrCpy $1 "true"
    ${EndIf}
    StrCpy $2 "false"
    ${If} $ModAgenteJesus == "1"
      StrCpy $2 "true"
    ${EndIf}
    StrCpy $3 "false"
    ${If} $ModPropChar == "1"
      StrCpy $3 "true"
    ${EndIf}
    FileWrite $0 "{$\"core$\":true,$\"animations$\":$1,$\"agente_jesus$\":$2,$\"propellant_char$\":$3}"
    FileClose $0
  ${EndIf}
!macroend

!macro customUnInstall
  Delete "$INSTDIR\resources\modules.json"
!macroend
