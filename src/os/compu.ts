// Lo que ofrece la compu cuando kids-os corre como programa (Electron). En el navegador no está.

export interface EstadoActualizacion {
  estado: 'nada' | 'buscando' | 'bajando' | 'lista' | 'al-dia' | 'error'
  version: string
}

interface Puente {
  almacen: { todo(): Record<string, string>; poner(clave: string, valor: string): void; sacar(clave: string): void }
  sistema: {
    apagar(): void
    cerrarSesion(): void
    salir(): void
    version(): string
    buscarActualizaciones(): Promise<EstadoActualizacion>
    estadoActualizacion(): Promise<EstadoActualizacion>
    instalarActualizacionYa(): void
    alActualizacion(f: (e: EstadoActualizacion) => void): void
  }
}

export const puente = (window as unknown as { kidsos?: Puente }).kidsos ?? null
/** ¿Corre como programa instalado (y no en el navegador)? */
export const esPrograma = !!puente

/**
 * En el programa, lo que todos guardan con localStorage va a archivos en Documentos\kids-os.
 * Se reemplaza localStorage entero, así ningún programa tiene que cambiar.
 * (Tiene que importarse primero que todo, antes de que alguien lea lo guardado.)
 */
if (puente) {
  const datos = new Map(Object.entries(puente.almacen.todo()))
  const almacen = {
    getItem: (k: string) => (datos.has(k) ? datos.get(k)! : null),
    setItem: (k: string, v: string) => {
      v = String(v)
      datos.set(k, v)
      puente.almacen.poner(k, v)
    },
    removeItem: (k: string) => {
      datos.delete(k)
      puente.almacen.sacar(k)
    },
    clear: () => {
      for (const k of [...datos.keys()]) almacen.removeItem(k)
    },
    key: (i: number) => [...datos.keys()][i] ?? null,
    get length() {
      return datos.size
    },
  }
  // Object.keys(localStorage) tiene que dar las claves guardadas, como el de verdad.
  const proxy = new Proxy(almacen, {
    ownKeys: () => [...datos.keys()],
    getOwnPropertyDescriptor: (_t, p) => (typeof p === 'string' && datos.has(p) ? { enumerable: true, configurable: true, value: datos.get(p) } : undefined),
    get: (t, p) => (p in t ? (t as Record<string | symbol, unknown>)[p] : typeof p === 'string' ? datos.get(p) : undefined),
  })
  Object.defineProperty(window, 'localStorage', { value: proxy, configurable: true })
}
