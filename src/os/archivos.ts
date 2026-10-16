// "Mis cosas": los archivos de la nena, con carpetas, papelera y un pendrive de práctica.
// Por ahora viven en localStorage. Cuando se empaquete como app de escritorio,
// solo cambia este módulo (pasan a ser archivos de verdad en Documentos).

export interface Archivo {
  id: string
  nombre: string
  app: string // qué programa lo abre ('pincel', ...)
  modificado: number
  miniatura: string // SVG o data URL para mostrar en Mis cosas
  enPapelera?: boolean
  /** Dónde está: '' = Mis cosas, PENDRIVE = el pendrive, o el id de una carpeta. */
  carpeta?: string
}

export interface Carpeta {
  id: string
  nombre: string
  padre: string // '' = Mis cosas, PENDRIVE = el pendrive, o el id de otra carpeta
  enPapelera?: boolean
  modificado: number
}

export const RAIZ = ''
export const PENDRIVE = 'pendrive'

const CLAVE_LISTA = 'kidsos.archivos'
const CLAVE_CARPETAS = 'kidsos.carpetas'
const CLAVE_PENDRIVE = 'kidsos.pendrive'
const claveDatos = (id: string) => 'kidsos.datos.' + id

type Oyente = () => void
const oyentes = new Set<Oyente>()

export function alCambiar(f: Oyente): () => void {
  oyentes.add(f)
  return () => oyentes.delete(f)
}

function avisar() {
  oyentes.forEach((f) => f())
}

const leerJSON = <T>(clave: string, si: T): T => {
  try {
    return JSON.parse(localStorage.getItem(clave) || 'null') ?? si
  } catch {
    return si
  }
}

/** Una sola vez: los dibujos vectoriales que se guardaron cuando Trazos se llamaba Pincel. */
export function migrar() {
  const lista = listar()
  let cambio = false
  for (const a of lista)
    if (a.app === 'pincel' && a.miniatura.startsWith('<svg')) {
      a.app = 'trazos'
      cambio = true
    }
  if (cambio) guardarLista(lista)
}

export function listar(): Archivo[] {
  return leerJSON<Archivo[]>(CLAVE_LISTA, [])
}

function guardarLista(lista: Archivo[]) {
  localStorage.setItem(CLAVE_LISTA, JSON.stringify(lista))
  avisar()
}

export function leer(id: string): unknown {
  const t = localStorage.getItem(claveDatos(id))
  return t ? JSON.parse(t) : null
}

export function buscar(id: string): Archivo | undefined {
  return listar().find((a) => a.id === id)
}

/** Guarda (crea o reemplaza). Si ya existía, queda en la misma carpeta. */
export function guardar(a: Omit<Archivo, 'modificado'>, datos: unknown): Archivo {
  const lista = listar()
  const i = lista.findIndex((x) => x.id === a.id)
  const nuevo: Archivo = { carpeta: RAIZ, ...(i >= 0 ? lista[i] : {}), ...a, modificado: Date.now(), enPapelera: false }
  if (i >= 0) lista[i] = nuevo
  else lista.push(nuevo)
  localStorage.setItem(claveDatos(a.id), JSON.stringify(datos))
  guardarLista(lista)
  return nuevo
}

export function nuevoId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

/** ¿Hay otro con ese nombre en la misma carpeta (por defecto, Mis cosas)? */
export function existeNombre(nombre: string, app: string, salvoId?: string, carpeta = RAIZ): boolean {
  const n = nombre.trim().toLowerCase()
  return listar().some((a) => !a.enPapelera && a.app === app && a.id !== salvoId && (a.carpeta ?? RAIZ) === carpeta && a.nombre.toLowerCase() === n)
}

/** Primer nombre libre del tipo "Dibujo 1", "Dibujo 2"... */
export function nombreLibre(base: string, app: string): string {
  for (let i = 1; ; i++) if (!existeNombre(`${base} ${i}`, app)) return `${base} ${i}`
}

export function renombrar(id: string, nombre: string) {
  const lista = listar()
  const a = lista.find((x) => x.id === id)
  if (!a) return
  a.nombre = nombre.trim()
  guardarLista(lista)
}

export function aPapelera(id: string, si = true) {
  const lista = listar()
  const a = lista.find((x) => x.id === id)
  if (!a) return
  a.enPapelera = si
  // Si su carpeta ya no está, al recuperarlo vuelve a Mis cosas.
  if (!si && a.carpeta && a.carpeta !== PENDRIVE && !buscarCarpeta(a.carpeta)) a.carpeta = RAIZ
  guardarLista(lista)
}

/** Borrar de verdad: solo desde la Papelera. */
export function borrarDefinitivo(id: string) {
  localStorage.removeItem(claveDatos(id))
  guardarLista(listar().filter((a) => a.id !== id))
}

// ---------- Carpetas

export function carpetas(): Carpeta[] {
  return leerJSON<Carpeta[]>(CLAVE_CARPETAS, [])
}
function guardarCarpetas(c: Carpeta[]) {
  localStorage.setItem(CLAVE_CARPETAS, JSON.stringify(c))
  avisar()
}
export const buscarCarpeta = (id: string) => carpetas().find((c) => c.id === id)

/** Nombre libre para una carpeta nueva: "Nueva carpeta", "Nueva carpeta (2)"... */
export function nombreCarpetaLibre(padre: string, base = 'Nueva carpeta'): string {
  const usados = new Set(carpetas().filter((c) => c.padre === padre && !c.enPapelera).map((c) => c.nombre.toLowerCase()))
  if (!usados.has(base.toLowerCase())) return base
  for (let i = 2; ; i++) if (!usados.has(`${base} (${i})`.toLowerCase())) return `${base} (${i})`
}

export function crearCarpeta(nombre: string, padre: string): Carpeta {
  const c: Carpeta = { id: nuevoId(), nombre, padre, modificado: Date.now() }
  guardarCarpetas([...carpetas(), c])
  return c
}
export function renombrarCarpeta(id: string, nombre: string) {
  guardarCarpetas(carpetas().map((c) => (c.id === id ? { ...c, nombre: nombre.trim() } : c)))
}
export function carpetaAPapelera(id: string, si = true) {
  guardarCarpetas(
    carpetas().map((c) => {
      if (c.id !== id) return c
      // Al recuperarla, si la de arriba ya no está, vuelve a Mis cosas.
      const padre = !si && c.padre && c.padre !== PENDRIVE && !buscarCarpeta(c.padre) ? RAIZ : c.padre
      return { ...c, enPapelera: si, padre }
    }),
  )
}
/** Borra para siempre la carpeta y todo lo que tiene adentro. */
export function borrarCarpetaDefinitivo(id: string) {
  const ids = new Set([id, ...descendientes(id)])
  for (const a of listar()) if (a.carpeta && ids.has(a.carpeta)) localStorage.removeItem(claveDatos(a.id))
  localStorage.setItem(CLAVE_LISTA, JSON.stringify(listar().filter((a) => !a.carpeta || !ids.has(a.carpeta))))
  guardarCarpetas(carpetas().filter((c) => !ids.has(c.id)))
}
function descendientes(id: string): string[] {
  const hijos = carpetas().filter((c) => c.padre === id).map((c) => c.id)
  return [...hijos, ...hijos.flatMap(descendientes)]
}

/** De qué "disco" es una carpeta: Mis cosas o el pendrive. */
export function unidad(carpeta: string): string {
  let c = carpeta
  for (let n = 0; c && c !== PENDRIVE && n < 50; n++) c = buscarCarpeta(c)?.padre ?? RAIZ
  return c === PENDRIVE ? PENDRIVE : RAIZ
}
/** El camino desde arriba: [Mis cosas, Dibujos, Animales]. */
export function camino(carpeta: string): { id: string; nombre: string }[] {
  const r: { id: string; nombre: string }[] = []
  let c = carpeta
  for (let n = 0; c && c !== PENDRIVE && n < 50; n++) {
    const x = buscarCarpeta(c)
    if (!x) break
    r.unshift({ id: x.id, nombre: x.nombre })
    c = x.padre
  }
  r.unshift(c === PENDRIVE ? { id: PENDRIVE, nombre: 'PENDRIVE (E:)' } : { id: RAIZ, nombre: 'Mis cosas' })
  return r
}
/** ¿Está escondida? (en la papelera, adentro de algo que está en la papelera, o en el pendrive desenchufado) */
function carpetaOculta(carpeta: string): boolean {
  let c = carpeta
  for (let n = 0; c && n < 50; n++) {
    if (c === PENDRIVE) return !pendriveConectado()
    const x = buscarCarpeta(c)
    if (!x || x.enPapelera) return true
    c = x.padre
  }
  return false
}
export const visible = (a: Archivo) => !a.enPapelera && !carpetaOculta(a.carpeta ?? RAIZ)
/** Los archivos que se pueden abrir ahora (para el cuadro Abrir de los programas). */
export const visibles = () => listar().filter(visible)

/** Lo que hay adentro de una carpeta. */
export function contenido(carpeta: string): { carpetas: Carpeta[]; archivos: Archivo[] } {
  return {
    carpetas: carpetas().filter((c) => c.padre === carpeta && !c.enPapelera),
    archivos: listar().filter((a) => (a.carpeta ?? RAIZ) === carpeta && !a.enPapelera),
  }
}

/** Mover un archivo o una carpeta a otra carpeta. */
export function mover(tipo: 'archivo' | 'carpeta', id: string, destino: string): boolean {
  if (tipo === 'carpeta') {
    // Una carpeta no puede ir adentro de sí misma.
    if (id === destino || descendientes(id).includes(destino)) return false
    guardarCarpetas(carpetas().map((c) => (c.id === id ? { ...c, padre: destino } : c)))
    return true
  }
  const lista = listar()
  const a = lista.find((x) => x.id === id)
  if (!a) return false
  a.carpeta = destino
  a.nombre = nombreSinRepetir(a.nombre, a.app, destino, a.id)
  guardarLista(lista)
  return true
}

/** Copiar un archivo (con sus datos) o una carpeta entera (con todo lo de adentro). */
export function copiar(tipo: 'archivo' | 'carpeta', id: string, destino: string): boolean {
  if (tipo === 'archivo') {
    const a = buscar(id)
    if (!a) return false
    const copia: Archivo = { ...a, id: nuevoId(), carpeta: destino, modificado: Date.now(), nombre: nombreSinRepetir(a.nombre, a.app, destino) }
    localStorage.setItem(claveDatos(copia.id), localStorage.getItem(claveDatos(id)) ?? 'null')
    guardarLista([...listar(), copia])
    return true
  }
  const c = buscarCarpeta(id)
  if (!c || id === destino || descendientes(id).includes(destino)) return false
  const nueva = crearCarpeta(nombreCarpetaLibre(destino, c.nombre), destino)
  for (const a of listar().filter((x) => x.carpeta === id && !x.enPapelera)) copiar('archivo', a.id, nueva.id)
  for (const h of carpetas().filter((x) => x.padre === id && !x.enPapelera)) copiar('carpeta', h.id, nueva.id)
  return true
}

function nombreSinRepetir(nombre: string, app: string, carpeta: string, salvoId?: string): string {
  if (!existeNombre(nombre, app, salvoId, carpeta)) return nombre
  if (!existeNombre(`${nombre} (copia)`, app, salvoId, carpeta)) return `${nombre} (copia)`
  for (let i = 2; ; i++) if (!existeNombre(`${nombre} (copia ${i})`, app, salvoId, carpeta)) return `${nombre} (copia ${i})`
}

// ---------- El pendrive de práctica

interface EstadoPendrive {
  conectado: boolean
  armado: boolean
}
const estadoPendrive = () => leerJSON<EstadoPendrive>(CLAVE_PENDRIVE, { conectado: false, armado: false })
export const pendriveConectado = () => estadoPendrive().conectado

export function enchufarPendrive(si: boolean) {
  const e = estadoPendrive()
  if (si && !e.armado) armarPendrive()
  localStorage.setItem(CLAVE_PENDRIVE, JSON.stringify({ conectado: si, armado: true }))
  avisar()
}

/** La primera vez, el pendrive viene con algunas cosas (como si te lo hubiera prestado alguien). */
function armarPendrive() {
  const guardarEn = (nombre: string, app: string, miniatura: string, datos: unknown) => {
    const a: Archivo = { id: nuevoId(), nombre, app, miniatura, carpeta: PENDRIVE, modificado: Date.now() }
    localStorage.setItem(claveDatos(a.id), JSON.stringify(datos))
    localStorage.setItem(CLAVE_LISTA, JSON.stringify([...listar(), a]))
  }
  const cuento =
    '<p style="text-align: center;"><b><span style="font-size: 28pt;">El dragón que tenía frío</span></b></p>' +
    '<p>Había una vez un dragón que no podía echar fuego. Cada vez que lo intentaba, le salían burbujas.</p>' +
    '<p>Un día una nena le prestó su bufanda, y el dragón se rió tanto que, por fin, ¡le salió una llamita!</p>' +
    '<p>Desde ese día son amigos, y en invierno él le calienta el chocolate.</p>'
  guardarEn(
    'Cuento del dragón',
    'cuaderno',
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 560"><rect width="800" height="560" fill="#fff"/><foreignObject width="800" height="560"><div xmlns="http://www.w3.org/1999/xhtml" style="padding:60px 70px;font-family:Nunito,Arial;font-size:16pt">${cuento}</div></foreignObject></svg>`,
    { html: cuento },
  )
  const fig = (tipo: string, x: number, y: number, w: number, h: number, relleno: string) => ({ id: nuevoId(), tipo, x, y, w, h, relleno, borde: '#000000', grosor: 5 })
  const flor = { figuras: [fig('rect', 485, 330, 30, 300, '#43a047'), ...[0, 1, 2, 3, 4, 5].map((k) => fig('elipse', 500 + Math.cos(k) * 110 - 70, 260 + Math.sin(k) * 110 - 70, 140, 140, '#ec407a')), fig('elipse', 430, 190, 140, 140, '#fdd835')] }
  const svgFlor =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700"><rect width="1000" height="700" fill="#fff"/>' +
    flor.figuras.map((f) => (f.tipo === 'rect' ? `<rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" fill="${f.relleno}" stroke="#000" stroke-width="5"/>` : `<ellipse cx="${f.x + f.w / 2}" cy="${f.y + f.h / 2}" rx="${f.w / 2}" ry="${f.h / 2}" fill="${f.relleno}" stroke="#000" stroke-width="5"/>`)).join('') +
    '</svg>'
  guardarEn('Flor de la tía', 'trazos', svgFlor, flor)
  const hoja = {
    anchos: { 0: 130 },
    grafico: 'A1:B5',
    celdas: {
      A1: { v: 'Equipo', b: true, fondo: '#b3e5fc' }, B1: { v: 'Puntos', b: true, fondo: '#b3e5fc' },
      A2: { v: 'Leones' }, B2: { v: '12' }, A3: { v: 'Águilas' }, B3: { v: '9' }, A4: { v: 'Tiburones' }, B4: { v: '15' }, A5: { v: 'Pumas' }, B5: { v: '7' },
    },
  }
  guardarEn('Puntos del campeonato', 'tablero', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 420"><rect width="600" height="420" fill="#fff"/><rect x="40" y="300" width="80" height="80" fill="#42a5f5"/><rect x="170" y="240" width="80" height="140" fill="#66bb6a"/><rect x="300" y="160" width="80" height="220" fill="#ffa726"/><rect x="430" y="320" width="80" height="60" fill="#ab47bc"/></svg>', hoja)
}
