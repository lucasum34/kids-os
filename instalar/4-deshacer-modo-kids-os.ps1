# kids-os — Deshacer el paso 3: el usuario de ella vuelve a tener el escritorio de Windows normal
# (y el Administrador de tareas). kids-os sigue instalado y sus cosas no se tocan.
#
# Con la sesión de ella CERRADA. Correr en PowerShell COMO ADMINISTRADOR, desde tu usuario:
#   powershell -ExecutionPolicy Bypass -File "4-deshacer-modo-kids-os.ps1" -Nombre "Nombre"

param([Parameter(Mandatory = $true)][string]$Nombre)

$ErrorActionPreference = 'Stop'
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host 'Hay que abrir PowerShell como administrador.' -ForegroundColor Red
  exit 1
}
$usuario = Get-LocalUser -Name $Nombre -ErrorAction SilentlyContinue
if (-not $usuario) { Write-Host "No existe el usuario '$Nombre'." -ForegroundColor Red; exit 1 }
$perfil = (Get-CimInstance Win32_UserProfile | Where-Object { $_.SID -eq $usuario.SID.Value }).LocalPath
if (-not $perfil) { Write-Host "$Nombre no tiene perfil todavía: no hay nada que deshacer." -ForegroundColor Yellow; exit 0 }

$colmena = 'HKU\kidsos_temporal'
& reg.exe load $colmena (Join-Path $perfil 'NTUSER.DAT') | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host "No pude abrir su configuración. ¿$Nombre tiene la sesión abierta? Cerrala y probá de nuevo." -ForegroundColor Red; exit 1 }
try {
  & reg.exe delete "$colmena\Software\Microsoft\Windows NT\CurrentVersion\Winlogon" /v Shell /f 2>$null | Out-Null
  & reg.exe delete "$colmena\Software\Microsoft\Windows\CurrentVersion\Policies\System" /v DisableTaskMgr /f 2>$null | Out-Null
} finally {
  [gc]::Collect()
  Start-Sleep -Milliseconds 500
  & reg.exe unload $colmena | Out-Null
}
Write-Host "Listo: $Nombre vuelve a tener el escritorio de Windows normal." -ForegroundColor Green
