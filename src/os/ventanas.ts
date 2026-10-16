// Administrador de ventanas: mover, maximizar, minimizar, cerrar, traer al frente.
// Igual que en Windows, para que lo aprendido sirva después.

import { el } from './ui'
import { sonar } from './sonido'

export interface Ventana {
  id: number
  raiz: HTMLElement
  cuerpo: HTMLElement
  icono: string
  titulo: string
  minimizada: boolean
  ponerTitulo(t: string): void
  cerrar(): void
  enfocar(): void
  maximizar(): void
  /** Lo que el programa deja ver por dentro (lo usa el guía de las misiones). */
  api?: unknown
}

/** Lo que el programa le devuelve al sistema al abrirse. */
export interface Instancia {
  /** Teclas cuando su ventana está al frente. true = la usó. */
  alTecla?(e: KeyboardEvent): boolean
  /** Antes de cerrar (ej.: "¿Guardar los cambios?"). false = no cerrar. */
  alCerrar?(): Promise<boolean>
  api?: unknown
}

export interface Programa {
  id: string
  nombre: string
  icono: string
  ancho?: number
  alto?: number
  abrir(v: Ventana, archivoId?: string): Instancia
}

let escritorio: HTMLElement
let siguienteId = 1
let zTope = 10
const abiertas: { v: Ventana; inst: Instancia }[] = []
let activa: Ventana | null = null
const oyentes = new Set<() => void>()

export function alCambiarVentanas(f: () => void) {
  oyentes.add(f)
}
const avisar = () => oyentes.forEach((f) => f())

export function iniciarVentanas(contenedor: HTMLElement) {
  escritorio = contenedor
  document.addEventListener('keydown', (e) => {
    if (document.querySelector('.dialogo-fondo')) return
    const t = e.target as HTMLElement
    const escribiendo = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable
    const a = abiertas.find((x) => x.v === activa)
    if (a && !escribiendo && a.inst.alTecla?.(e)) e.preventDefault()
  })
}

export function ventanasAbiertas() {
  return abiertas.map((x) => x.v)
}
export function ventanaActiva() {
  return activa
}

export function abrirVentana(p: Programa, archivoId?: string): Ventana {
  const raiz = el('div', 'ventana')
  const barra = el('div', 'ventana-barra')
  const ico = el('span', 'ventana-icono', p.icono)
  const tit = el('span', 'ventana-titulo', p.nombre)
  const botones = el('div', 'ventana-botones')
  const bMin = el('button', 'vb', '—')
  const bMax = el('button', 'vb', '☐')
  const bCerrar = el('button', 'vb cerrar', '✕')
  bMin.title = 'Minimizar'
  bMax.title = 'Maximizar'
  bCerrar.title = 'Cerrar'
  botones.append(bMin, bMax, bCerrar)
  barra.append(ico, tit, botones)
  const cuerpo = el('div', 'ventana-cuerpo')
  raiz.append(barra, cuerpo)

  // Tamaño y posición inicial: en cascada, sin salirse del escritorio.
  const W = escritorio.clientWidth
  const H = escritorio.clientHeight
  const w = Math.min(p.ancho ?? 820, W - 20)
  const h = Math.min(p.alto ?? 560, H - 20)
  const desfase = (abiertas.length % 6) * 28
  raiz.style.width = w + 'px'
  raiz.style.height = h + 'px'
  raiz.style.left = Math.max(0, (W - w) / 2 - 80 + desfase) + 'px'
  raiz.style.top = Math.max(0, (H - h) / 2 - 40 + desfase) + 'px'

  const v: Ventana = {
    id: siguienteId++,
    raiz,
    cuerpo,
    icono: p.icono,
    titulo: p.nombre,
    minimizada: false,
    ponerTitulo(t) {
      v.titulo = t
      tit.textContent = t
      avisar()
    },
    cerrar() {
      sonar('cerrar')
      const i = abiertas.findIndex((x) => x.v === v)
      if (i >= 0) abiertas.splice(i, 1)
      raiz.remove()
      if (activa === v) {
        activa = null
        const otra = [...abiertas].reverse().find((x) => !x.v.minimizada)
        otra?.v.enfocar()
      }
      avisar()
    },
    maximizar() {
      if (!raiz.classList.contains('maximizada')) maximizar()
    },
    enfocar() {
      v.minimizada = false
      raiz.style.display = ''
      raiz.style.zIndex = String(++zTope)
      abiertas.forEach((x) => x.v.raiz.classList.toggle('activa', x.v === v))
      activa = v
      avisar()
    },
  }

  const pedirCierre = async () => {
    const a = abiertas.find((x) => x.v === v)
    if (a?.inst.alCerrar && !(await a.inst.alCerrar())) return
    v.cerrar()
  }
  const maximizar = () => {
    raiz.classList.toggle('maximizada')
    bMax.textContent = raiz.classList.contains('maximizada') ? '❐' : '☐'
    bMax.title = raiz.classList.contains('maximizada') ? 'Restaurar' : 'Maximizar'
  }

  bCerrar.onclick = pedirCierre
  bMax.onclick = maximizar
  bMin.onclick = () => minimizar(v)
  barra.ondblclick = (e) => {
    if (!(e.target as HTMLElement).closest('.vb')) maximizar()
  }
  raiz.addEventListener('pointerdown', () => activa !== v && v.enfocar(), true)

  // Arrastrar por la barra de título.
  barra.onpointerdown = (e) => {
    if ((e.target as HTMLElement).closest('.vb') || raiz.classList.contains('maximizada')) return
    const x0 = e.clientX - raiz.offsetLeft
    const y0 = e.clientY - raiz.offsetTop
    barra.setPointerCapture(e.pointerId)
    barra.onpointermove = (m) => {
      const x = Math.min(Math.max(m.clientX - x0, -raiz.offsetWidth + 80), escritorio.clientWidth - 80)
      const y = Math.min(Math.max(m.clientY - y0, 0), escritorio.clientHeight - 40)
      raiz.style.left = x + 'px'
      raiz.style.top = y + 'px'
    }
    barra.onpointerup = () => (barra.onpointermove = null)
  }

  // Agrandar desde la esquina.
  const esquina = el('div', 'ventana-esquina')
  raiz.append(esquina)
  esquina.onpointerdown = (e) => {
    e.stopPropagation()
    esquina.setPointerCapture(e.pointerId)
    const x0 = e.clientX - raiz.offsetWidth
    const y0 = e.clientY - raiz.offsetHeight
    esquina.onpointermove = (m) => {
      raiz.style.width = Math.max(320, m.clientX - x0) + 'px'
      raiz.style.height = Math.max(220, m.clientY - y0) + 'px'
      raiz.dispatchEvent(new Event('redimensionar'))
    }
    esquina.onpointerup = () => (esquina.onpointermove = null)
  }

  escritorio.append(raiz)
  const inst = p.abrir(v, archivoId)
  v.api = inst.api
  abiertas.push({ v, inst })
  v.enfocar()
  sonar('abrir')
  return v
}

export function minimizar(v: Ventana) {
  v.minimizada = true
  v.raiz.style.display = 'none'
  if (activa === v) {
    activa = null
    abiertas.forEach((x) => x.v.raiz.classList.remove('activa'))
    const otra = [...abiertas].reverse().find((x) => !x.v.minimizada)
    otra?.v.enfocar()
  }
  avisar()
}
