# kids-os — Paso 3: que en el usuario de ella kids-os reemplace al escritorio de Windows.
# Al entrar con su usuario no aparece la barra de tareas, ni el menú Inicio, ni el explorador: solo kids-os.
# También le desactiva el Administrador de tareas. Tu usuario NO se toca.
#
# Antes: ella tiene que haber entrado una vez y tener kids-os instalado (paso 2), y estar con la sesión CERRADA.
# Correr en PowerShell COMO ADMINISTRADOR, desde tu usuario:
#   powershell -ExecutionPolicy Bypass -File "3-modo-kids-os.ps1" -Nombre "Nombre"
# Para volver atrás: 4-deshacer-modo-kids-os.ps1

param([Parameter(Mandatory = $true)][string]$Nombre)

$ErrorActionPreference = 'Stop'
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host 'Hay que abrir PowerShell como administrador.' -ForegroundColor Red
  exit 1
}

$usuario = Get-LocalUser -Name $Nombre -ErrorAction SilentlyContinue
if (-not $usuario) { Write-Host "No existe el usuario '$Nombre'." -ForegroundColor Red; exit 1 }
$perfil = (Get-CimInstance Win32_UserProfile | Where-Object { $_.SID -eq $usuario.SID.Value }).LocalPath
if (-not $perfil) { Write-Host "$Nombre todavía no entró nunca a su usuario. Hacé el paso 2 primero." -ForegroundColor Red; exit 1 }
$programa = Join-Path $perfil 'AppData\Local\Programs\kids-os\kids-os.exe'
if (-not (Test-Path $programa)) { Write-Host "No encuentro kids-os instalado en su usuario ($programa). Hacé el paso 2 primero." -ForegroundColor Red; exit 1 }

# Se abre la parte del registro que es solo de ella (por eso tiene que tener la sesión cerrada).
$colmena = 'HKU\kidsos_temporal'
& reg.exe load $colmena (Join-Path $perfil 'NTUSER.DAT') | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host "No pude abrir su configuración. ¿$Nombre tiene la sesión abierta? Cerrala (o reiniciá) y probá de nuevo." -ForegroundColor Red; exit 1 }
try {
  & reg.exe add "$colmena\Software\Microsoft\Windows NT\CurrentVersion\Winlogon" /v Shell /t REG_SZ /d "`"$programa`"" /f | Out-Null
  & reg.exe add "$colmena\Software\Microsoft\Windows\CurrentVersion\Policies\System" /v DisableTaskMgr /t REG_DWORD /d 1 /f | Out-Null
} finally {
  [gc]::Collect()
  Start-Sleep -Milliseconds 500
  & reg.exe unload $colmena | Out-Null
}

Write-Host ''
Write-Host "Listo: cuando $Nombre entre a su usuario, se abre solo kids-os." -ForegroundColor Green
Write-Host 'Para salir: en kids-os, el menú 🏠 tiene Apagar y Cerrar sesión. Vos: Ctrl+Alt+Mayús+P y tu clave.'
