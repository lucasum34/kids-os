# Instalar kids-os en una notebook compartida

La idea: la notebook tiene **tu usuario de Windows**, que queda igual, y **un usuario para ella** donde lo único que existe es kids-os. Al prender, cada uno elige su usuario en la pantalla de inicio de Windows.

Los pasos 1, 3 y 4 cambian la configuración de Windows: hacelos vos, desde tu usuario y con PowerShell **como administrador** (clic derecho en PowerShell → Ejecutar como administrador). Antes de correr un script podés abrirlo con el Bloc de notas y leerlo: cada uno explica lo que hace.

## 1. Crear su usuario (desde tu usuario)

```powershell
cd "C:\ruta\a\kids-os\instalar"
powershell -ExecutionPolicy Bypass -File ".\1-crear-usuario.ps1" -Nombre "SuNombre" -SinClave
```

- Crea un usuario **estándar**: no puede instalar nada de Windows ni tocar la configuración.
- Sin `-SinClave` te pide una contraseña para su usuario.

## 2. Instalar kids-os en su usuario

1. Copiá el instalador `kids-os-1.0.0.exe` a una carpeta que ella pueda ver (por ejemplo `C:\Users\Public\Downloads`).
2. Cerrá tu sesión y **entrá con el usuario de ella** (la primera vez Windows tarda un rato en prepararlo).
3. Abrí el instalador. Se instala solo para su usuario, sin pedir clave de administrador, y kids-os se abre al terminar.
4. kids-os te pide **elegir la clave de papá o mamá**. Esa clave se pide para instalar programas de la Tienda y para el menú de papá.
5. Cerrá sesión: menú 🏠 de kids-os → Cerrar sesión.

## 3. Que kids-os sea su escritorio (desde tu usuario, con la sesión de ella cerrada)

```powershell
powershell -ExecutionPolicy Bypass -File ".\3-modo-kids-os.ps1" -Nombre "SuNombre"
```

Desde ese momento, al entrar con su usuario:

- Se abre **solo kids-os**, a pantalla completa. No hay barra de tareas, menú Inicio, explorador ni navegador de Windows.
- kids-os **no se cierra** con la X ni con Alt+F4.
- Su menú 🏠 tiene **Apagar** y **Cerrar sesión**.
- **Vos:** Ctrl+Alt+Mayús+P y tu clave abren el menú de papá (versión, actualizaciones, salir de kids-os).
- Ctrl+Alt+Supr no se puede bloquear, pero desde ahí solo puede cerrar sesión o apagar: el Administrador de tareas queda desactivado para su usuario.

Si algo falla y queda la pantalla negra: Ctrl+Alt+Supr → Cerrar sesión, y entrá con tu usuario.

## 4. Volver atrás

```powershell
powershell -ExecutionPolicy Bypass -File ".\4-deshacer-modo-kids-os.ps1" -Nombre "SuNombre"
```

Su usuario vuelve a tener el escritorio de Windows normal. kids-os y sus cosas quedan como estaban.

## Sus cosas

Se guardan en **Documentos\kids-os** de su usuario, como archivos. Al actualizar o reinstalar kids-os no se pierden.

## Actualizaciones

- Cada vez que se publica una versión nueva en GitHub, kids-os la baja solo cuando hay internet, sin que ella note nada.
- La versión nueva se instala cuando ella **apaga o cierra sesión** desde kids-os.
- En el menú de papá están la versión instalada y **Buscar actualizaciones ahora**.
- **Sin internet:** se puede llevar el instalador nuevo en un pendrive y correrlo en su usuario. Sus cosas no se tocan.
