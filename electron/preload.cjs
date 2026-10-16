// Lo que la página puede pedirle a la compu: guardar archivos, apagar, actualizarse.

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('kidsos', {
  almacen: {
    todo: () => ipcRenderer.sendSync('almacen:todo'),
    poner: (clave, valor) => ipcRenderer.send('almacen:poner', clave, valor),
    sacar: (clave) => ipcRenderer.send('almacen:sacar', clave),
  },
  sistema: {
    apagar: () => ipcRenderer.send('sistema:apagar'),
    cerrarSesion: () => ipcRenderer.send('sistema:cerrarSesion'),
    salir: () => ipcRenderer.send('sistema:salir'),
    version: () => ipcRenderer.sendSync('sistema:version'),
    buscarActualizaciones: () => ipcRenderer.invoke('actualizar:buscar'),
    estadoActualizacion: () => ipcRenderer.invoke('actualizar:estado'),
    instalarActualizacionYa: () => ipcRenderer.send('actualizar:instalarYa'),
    alActualizacion: (f) => ipcRenderer.on('actualizar:estado', (_e, estado) => f(estado)),
  },
})
