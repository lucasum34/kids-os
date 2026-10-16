// El guía de las misiones: un globito con Robotito que dice (y lee en voz alta) qué hacer,
// señala el botón de verdad dentro del programa, se da cuenta solo cuando el paso está hecho,
// y si pasa un rato sin que salga, da una pista.

import { abrirPrograma } from './sistema'
import { sonar } from './sonido'
import { el } from './ui'
import type { Ventana } from './ventanas'

export interface Paso<A> {
  /** Lo que dice el guía. */
  texto: string
  /** En qué programa es este paso, si no es el de la misión (lo abre o lo trae al frente). */
  en?: string
  /** Qué señalar: un selector dentro de la ventana del programa (o una función que lo busca). */
  senalar?: string | ((v: Ventana) => Element | null)
  /** El paso está hecho cuando esto da true (se revisa solo, varias veces por segundo). */
  listo?: (api: A) => boolean
  /** Si no hay nada que detectar: un botón para seguir ("¡Listo!", "Sigo"). */
  boton?: string
  /** Lo que dice si pasa un rato y no le sale. */
  pista?: string
  /** Algo extra en el globito (un modelo para copiar, por ejemplo). */
  extra?: () => HTMLElement
  /** Al terminar el paso (para que pase algo en el programa). */
  alTerminar?: (api: A) => void
}

export interface Mision<A> {
  id: string
  programa: string
  titulo: string
  icono: string
  figurita: string // lo que gana para el álbum
  resumen: string
  preparar?: (api: A) => void
  pasos: Paso<A>[]
  /** Si se guarda el resultado en Mis cosas, con qué nombre. */
  guardarComo?: string
}

// ---------- Progreso
const CLAVE = 'kidsos.misiones'
export function progreso(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) || '{}')
  } catch {
    return {}
  }
}
function marcar(id: string, estrellas: number) {
  const p = progreso()
  p[id] = Math.max(p[id] ?? 0, estrellas)
  try {
    localStorage.setItem(CLAVE, JSON.stringify(p))
  } catch {}
  dispatchEvent(new Event('kidsos-misiones'))
}

// ---------- Voz
let voz = true
try {
  voz = localStorage.getItem('kidsos.guia.voz') !== 'no'
} catch {}
function decir(t: string) {
  if (!voz || !('speechSynthesis' in window)) return
  // Sin emojis ni signos raros, que la voz los lee feo.
  const limpio = t.replace(/[\p{Extended_Pictographic}️]/gu, '').replace(/[«»"]/g, '')
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(limpio)
  u.lang = 'es-AR'
  const v = speechSynthesis.getVoices().find((x) => x.lang.startsWith('es'))
  if (v) u.voice = v
  u.rate = 0.95
  speechSynthesis.speak(u)
}
const callar = () => 'speechSynthesis' in window && speechSynthesis.cancel()

let enCurso: (() => void) | null = null
const ESPERA_PISTA = 22_000

/** Abre el programa, prepara todo y acompaña paso a paso. */
export function empezarMision<A>(m: Mision<A>, alTerminar?: () => void) {
  enCurso?.()
  const principal = abrirPrograma(m.programa)
  if (!principal) return
  principal.maximizar()
  m.preparar?.(principal.api as A)
  // Las ventanas que usa la misión (puede pasar de un programa a otro).
  const ventanas = new Map<string, Ventana>([[m.programa, principal]])
  let v: Ventana = principal
  let api = principal.api as A
  function ventanaDe(prog: string): Ventana | null {
    const ya = ventanas.get(prog)
    if (ya && ya.raiz.isConnected) {
      if (ya.minimizada || !ya.raiz.classList.contains('activa')) ya.enfocar()
      return ya
    }
    const nueva = abrirPrograma(prog)
    if (!nueva) return null
    nueva.maximizar()
    ventanas.set(prog, nueva)
    return nueva
  }

  let i = 0
  let pistas = 0
  let inicioPaso = Date.now()
  let pistaDada = false
  let terminada = false

  const globo = el('div', 'guia')
  const foco = el('div', 'guia-foco')
  const flecha = el('div', 'guia-flecha')
  document.body.append(foco, flecha, globo)

  function salir() {
    clearInterval(reloj)
    callar()
    globo.remove()
    foco.remove()
    flecha.remove()
    enCurso = null
  }
  enCurso = salir

  const botonSimple = (t: string, f: () => void, clase = '') => {
    const b = el('button', 'guia-boton ' + clase, t)
    b.onmousedown = (e) => e.preventDefault()
    b.onclick = f
    return b
  }

  function mostrarPaso() {
    const p = m.pasos[i]
    const vp = ventanaDe(p.en ?? m.programa)
    if (vp) {
      v = vp
      api = vp.api as A
    }
    inicioPaso = Date.now()
    pistaDada = false
    globo.replaceChildren()
    const cab = el('div', 'guia-cab')
    const puntos = el('div', 'guia-puntos')
    m.pasos.forEach((_, k) => puntos.append(el('span', 'guia-punto' + (k < i ? ' hecho' : k === i ? ' ahora' : ''))))
    cab.append(el('span', 'guia-mision', `${m.icono} ${m.titulo}`), puntos)
    const cuerpo = el('div', 'guia-cuerpo')
    cuerpo.append(el('div', 'guia-robot', '🤖'))
    const txt = el('div', 'guia-texto', p.texto)
    cuerpo.append(txt)
    globo.append(cab, cuerpo)
    if (p.extra) globo.append(p.extra())
    const pista = el('div', 'guia-pista')
    globo.append(pista)
    const botones = el('div', 'guia-botones')
    botones.append(
      botonSimple(voz ? '🔊' : '🔇', () => {
        voz = !voz
        try {
          localStorage.setItem('kidsos.guia.voz', voz ? 'si' : 'no')
        } catch {}
        if (voz) decir(p.texto)
        else callar()
        mostrarPaso()
      }, 'solo-icono'),
      botonSimple('↻ Repetir', () => decir(pistaDada && p.pista ? p.pista : p.texto)),
    )
    botones.append(el('span', 'guia-esp'))
    botones.append(botonSimple('Salir', () => salir(), 'chico'))
    if (p.boton) botones.append(botonSimple(p.boton, () => avanzar(), 'principal'))
    globo.append(botones)
    decir(p.texto)
    ubicar()
  }

  function avanzar() {
    const p = m.pasos[i]
    p.alTerminar?.(api)
    i++
    if (i >= m.pasos.length) return terminar()
    sonar('abrir')
    mostrarPaso()
  }

  function terminar() {
    terminada = true
    const estrellas = Math.max(1, 3 - pistas)
    marcar(m.id, estrellas)
    sonar('bien')
    let guardado = ''
    if (m.guardarComo) {
      const g = (principal!.api as { guardarComo?: (n: string) => string }).guardarComo
      if (g) guardado = g(m.guardarComo)
    }
    foco.style.display = 'none'
    flecha.style.display = 'none'
    globo.replaceChildren()
    globo.classList.add('fin')
    globo.append(
      el('div', 'guia-estrellas', '★'.repeat(estrellas) + '☆'.repeat(3 - estrellas)),
      el('div', 'guia-titulo-fin', '¡Misión cumplida!'),
      el('div', 'guia-figurita', m.figurita),
      el('div', 'guia-texto', `Ganaste una figurita para tu álbum.${guardado ? ` Lo que hiciste quedó guardado en Mis cosas como «${guardado}».` : ''}`),
    )
    const botones = el('div', 'guia-botones')
    botones.append(
      botonSimple('Seguir jugando acá', () => salir()),
      botonSimple('🗺️ Ver mis misiones', () => {
        salir()
        // Lo que había que guardar ya está en Mis cosas: la ventana de la misión se cierra.
        ventanas.forEach((x) => x.raiz.isConnected && x.cerrar())
        alTerminar?.()
      }, 'principal'),
    )
    globo.append(botones)
    decir('¡Misión cumplida! Ganaste una figurita.')
    ubicar()
  }

  function objetivo(): Element | null {
    if (terminada) return null
    const s = m.pasos[i].senalar
    if (!s) return null
    return typeof s === 'string' ? v.raiz.querySelector(s) : s(v)
  }

  /** El globito va cerca de lo que señala, sin taparlo. */
  function ubicar() {
    const t = objetivo()
    const g = globo.getBoundingClientRect()
    const margen = 14
    if (!t || !(t as HTMLElement).offsetParent) {
      foco.style.display = 'none'
      flecha.style.display = 'none'
      const vr = v.raiz.getBoundingClientRect()
      globo.style.left = Math.max(8, vr.right - g.width - 24) + 'px'
      globo.style.top = Math.max(8, vr.bottom - g.height - 24) + 'px'
      return
    }
    const r = t.getBoundingClientRect()
    foco.style.display = 'block'
    foco.style.left = r.left - 4 + 'px'
    foco.style.top = r.top - 4 + 'px'
    foco.style.width = r.width + 8 + 'px'
    foco.style.height = r.height + 8 + 'px'
    // Abajo si entra; si no, arriba; si no, al costado.
    let x = Math.min(Math.max(8, r.left + r.width / 2 - g.width / 2), innerWidth - g.width - 8)
    let y: number
    let lado: 'abajo' | 'arriba' | 'costado'
    if (r.bottom + margen + g.height < innerHeight - 8) {
      y = r.bottom + margen
      lado = 'abajo'
    } else if (r.top - margen - g.height > 8) {
      y = r.top - margen - g.height
      lado = 'arriba'
    } else {
      y = Math.min(Math.max(8, r.top), innerHeight - g.height - 8)
      x = r.right + margen + g.width < innerWidth ? r.right + margen : Math.max(8, r.left - margen - g.width)
      lado = 'costado'
    }
    globo.style.left = x + 'px'
    globo.style.top = y + 'px'
    flecha.style.display = lado === 'costado' ? 'none' : 'block'
    flecha.className = 'guia-flecha ' + lado
    flecha.style.left = r.left + r.width / 2 - 12 + 'px'
    flecha.style.top = (lado === 'abajo' ? r.bottom + 2 : r.top - 14) + 'px'
  }

  const reloj = setInterval(() => {
    if (!v.raiz.isConnected) return salir() // cerró el programa
    if (terminada) return ubicar()
    const p = m.pasos[i]
    try {
      if (p.listo && p.listo(api)) return avanzar()
    } catch {}
    if (!pistaDada && p.pista && Date.now() - inicioPaso > ESPERA_PISTA) {
      pistaDada = true
      pistas++
      const caja = globo.querySelector('.guia-pista') as HTMLElement
      caja.textContent = '💡 ' + p.pista
      caja.style.display = 'block'
      decir(p.pista)
    }
    ubicar()
  }, 250)

  mostrarPaso()
}
