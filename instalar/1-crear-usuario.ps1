# kids-os — Paso 1: crear el usuario de Windows de ella (usuario estándar, sin permisos de administrador).
#
# Correr en PowerShell COMO ADMINISTRADOR, desde tu usuario:
#   powershell -ExecutionPolicy Bypass -File "1-crear-usuario.ps1" -Nombre "Nombre"
# Con -SinClave el usuario entra sin contraseña (ella toca su nombre y listo).
# Sin -SinClave, te pide una contraseña para su usuario.

param(
  [Parameter(Mandatory = $true)][string]$Nombre,
  [switch]$SinClave
)

$ErrorActionPreference = 'Stop'

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host 'Hay que abrir PowerShell como administrador (clic derecho → Ejecutar como administrador).' -ForegroundColor Red
  exit 1
}
if (Get-LocalUser -Name $Nombre -ErrorAction SilentlyContinue) {
  Write-Host "Ya existe un usuario '$Nombre'. No toqué nada." -ForegroundColor Yellow
  exit 1
}

if ($SinClave) {
  New-LocalUser -Name $Nombre -NoPassword -FullName $Nombre -Description 'kids-os' | Out-Null
} else {
  $clave = Read-Host "Contraseña para el usuario de $Nombre" -AsSecureString
  New-LocalUser -Name $Nombre -Password $clave -FullName $Nombre -Description 'kids-os' -PasswordNeverExpires | Out-Null
}
# El grupo "Usuarios" se busca por su identificador (en Windows en castellano se llama distinto que en inglés).
$usuarios = Get-LocalGroup -SID 'S-1-5-32-545'
Add-LocalGroupMember -Group $usuarios -Member $Nombre

Write-Host ''
Write-Host "Listo: se creó el usuario '$Nombre' (estándar, sin permisos de administrador)." -ForegroundColor Green
Write-Host 'Ahora: cerrá sesión, entrá con el usuario de ella e instalá kids-os ahí (paso 2 de INSTALAR.md).'
