// kids-os como programa de escritorio (Electron).
// - Ventana de quiosco: pantalla completa, sin barra, no se cierra con la X ni con Alt+F4.
// - Las cosas de ella se guardan en archivos de verdad, en Documentos\kids-os.
// - Se actualiza solo desde GitHub: baja la versión nueva y la instala al apagar o cerrar sesión.

const { app, BrowserWindow, Menu, ipcMain, net, protocol } = require('electron')
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const DEV = !!process.env.KIDSOS_DEV // npm run app:dev: usa el servidor de Vite y deja salir
// Prueba automática (sin tomar la pantalla): abre escondido, guarda algo, saca una foto y se cierra.
const PRUEBA = process.env.KIDSOS_PRUEBA || ''
const DIST = path.join(__dirname, '..', 'dist')

let ventana = null
let puedeCerrar = false
let actualizacion = { estado: 'nada', version: '' } // nada | buscando | bajando | lista | al-dia | error

// Una sola ventana de kids-os aunque lo abran dos veces.
if (!app.requestSingleInstanceLock()) app.quit()
app.on('second-instance', () => ventana?.focus())

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }])

// ---------- Archivos en Documentos\kids-os (uno por cada cosa guardada)
const carpeta = () => path.join(app.getPath('documents'), 'kids-os')
const archivoDe = (clave) => path.join(carpeta(), encodeURIComponent(clave) + '.json')

ipcMain.on('almacen:todo', (e) => {
  const todo = {}
  try {
    fs.mkdirSync(carpeta(), { recursive: true })
    for (const f of fs.readdirSync(carpeta())) {
      if (!f.endsWith('.json')) continue
      try {
        todo[decodeURIComponent(f.slice(0, -5))] = fs.readFileSync(path.join(carpeta(), f), 'utf8')
      } catch {}
    }
  } catch {}
  e.returnValue = todo
})
ipcMain.on('almacen:poner', (_e, clave, valor) => {
  try {
    fs.mkdirSync(carpeta(), { recursive: true })
    // Primero a un archivo aparte y después se renombra: si se corta la luz, no queda un archivo a medias.
    const destino = archivoDe(clave)
    fs.writeFileSync(destino + '.tmp', valor, 'utf8')
    fs.renameSync(destino + '.tmp', destino)
  } catch (err) {
    console.error('No se pudo guardar', clave, err)
  }
})
ipcMain.on('almacen:sacar', (_e, clave) => {
  try {
    fs.unlinkSync(archivoDe(clave))
  } catch {}
})

// ---------- Apagar, cerrar sesión, salir
function enSegundoPlano(comando, args) {
  spawn(comando, args, { detached: true, stdio: 'ignore', windowsHide: true }).unref()
}
/** Si hay una actualización bajada, se instala antes de apagar (Windows espera unos segundos). */
function terminar(accion) {
  puedeCerrar = true
  const hayActualizacion = actualizacion.estado === 'lista'
  if (process.platform === 'win32') {
    if (accion === 'apagar') enSegundoPlano('shutdown', ['/s', '/t', hayActualizacion ? '25' : '0'])
    if (accion === 'sesion') enSegundoPlano('cmd', ['/c', `timeout /t ${hayActualizacion ? 20 : 0} /nobreak >nul & shutdown /l`])
  }
  if (hayActualizacion) require('electron-updater').autoUpdater.quitAndInstall(true, false)
  else app.quit()
}
ipcMain.on('sistema:apagar', () => terminar('apagar'))
ipcMain.on('sistema:cerrarSesion', () => terminar('sesion'))
ipcMain.on('sistema:salir', () => terminar('salir'))
ipcMain.on('sistema:version', (e) => (e.returnValue = app.getVersion()))

// ---------- Actualizaciones
function avisarActualizacion() {
  ventana?.webContents.send('actualizar:estado', actualizacion)
}
function prepararActualizaciones() {
  if (DEV) return
  const { autoUpdater } = require('electron-updater')
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('checking-for-update', () => ((actualizacion = { ...actualizacion, estado: 'buscando' }), avisarActualizacion()))
  autoUpdater.on('update-available', (i) => ((actualizacion = { estado: 'bajando', version: i.version }), avisarActualizacion()))
  autoUpdater.on('update-not-available', () => ((actualizacion = { estado: 'al-dia', version: app.getVersion() }), avisarActualizacion()))
  autoUpdater.on('update-downloaded', (i) => ((actualizacion = { estado: 'lista', version: i.version }), avisarActualizacion()))
  autoUpdater.on('error', () => ((actualizacion = { ...actualizacion, estado: 'error' }), avisarActualizacion()))
  const buscar = () => autoUpdater.checkForUpdates().catch(() => {})
  buscar()
  setInterval(buscar, 4 * 60 * 60 * 1000) // cada 4 horas, por si queda prendida
}
ipcMain.handle('actualizar:buscar', async () => {
  if (DEV) return { estado: 'al-dia', version: app.getVersion() }
  try {
    await require('electron-updater').autoUpdater.checkForUpdates()
  } catch {}
  return actualizacion
})
ipcMain.handle('actualizar:estado', () => actualizacion)
ipcMain.on('actualizar:instalarYa', () => {
  if (actualizacion.estado !== 'lista') return
  puedeCerrar = true
  require('electron-updater').autoUpdater.quitAndInstall(true, true) // se reinicia solo, ya actualizado
})

// ---------- La ventana
function abrirVentana() {
  ventana = new BrowserWindow({
    kiosk: !DEV && !PRUEBA,
    fullscreen: !DEV && !PRUEBA,
    show: !PRUEBA,
    width: 1366,
    height: 768,
    autoHideMenuBar: true,
    backgroundColor: '#7ec8f0',
    title: 'kids-os',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, devTools: DEV },
  })
  // No se cierra con la X ni con Alt+F4: solo desde el menú (Apagar, Cerrar sesión) o la salida de papá.
  ventana.on('close', (e) => {
    if (!puedeCerrar && !DEV) e.preventDefault()
  })
  // Nada de abrir ventanas nuevas ni de irse a otra página.
  ventana.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  ventana.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('app://') && !url.startsWith('http://localhost:5207')) e.preventDefault()
  })
  if (DEV) ventana.loadURL('http://localhost:5207')
  else ventana.loadURL('app://kids-os/index.html')
  if (PRUEBA)
    ventana.webContents.once('did-finish-load', () =>
      setTimeout(async () => {
        const r = await ventana.webContents.executeJavaScript(
          "localStorage.setItem('kidsos.prueba', 'ok'); JSON.stringify({ iconos: document.querySelectorAll('.icono').length, letra: getComputedStyle(document.body).fontFamily, guardado: localStorage.getItem('kidsos.prueba'), puente: !!window.kidsos })",
        )
        const foto = await ventana.webContents.capturePage()
        fs.writeFileSync(PRUEBA, foto.toPNG())
        fs.writeFileSync(PRUEBA + '.json', r)
        puedeCerrar = true
        setTimeout(() => app.quit(), 500)
      }, 3000),
    )
}

app.whenReady().then(() => {
  // Sin menú: así tampoco hay atajos del navegador (recargar, herramientas) y F5 le llega a Diapositivas.
  Menu.setApplicationMenu(null)
  protocol.handle('app', (pedido) => {
    const ruta = decodeURIComponent(new URL(pedido.url).pathname)
    const archivo = path.normalize(path.join(DIST, ruta))
    if (!archivo.startsWith(DIST)) return new Response('', { status: 403 })
    return net.fetch(pathToFileURL(archivo).toString())
  })
  abrirVentana()
  if (!PRUEBA) prepararActualizaciones()
})

app.on('window-all-closed', () => app.quit())
