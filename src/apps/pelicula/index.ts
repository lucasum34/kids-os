// Película: editor de video, la idea de DaVinci Resolve en chiquito.
// Enseña: medios (fotos, dibujos, videos, música), línea de tiempo con pistas,
// cabezal de reproducción, cortar (Ctrl+B), recortar arrastrando el borde,
// transiciones, efectos, títulos, y exportar la película terminada.

import * as fs from '../../os/archivos'
import { pedirNombre, preguntarSiGuarda } from '../../os/documento'
import { elegirArchivo, miniatura } from '../../os/selector'
import { aviso, barraMenu, dialogo, el } from '../../os/ui'
import type { Programa } from '../../os/ventanas'
import { imagenDeMisCosas, PROGRAMAS_CON_IMAGEN } from '../../os/imagenes'

const AN = 960
const AL = 540
const FUNDIDO = 0.6 // segundos

type TipoMedio = 'imagen' | 'video' | 'audio'
interface Medio {
  id: string
  nombre: string
  tipo: TipoMedio
  url: string
  duracion: number
  archivoId?: string // si vino de Mis cosas (esos se pueden guardar)
  el: HTMLImageElement | HTMLVideoElement | HTMLAudioElement
}
interface Clip {
  id: string
  medio: string
  dur: number
  desde: number // en videos: desde qué segundo arranca
  trans: 'corte' | 'fundido'
  efecto: 'nada' | 'acercar' | 'alejar'
  filtro: string
}
interface Titulo {
  id: string
  texto: string
  inicio: number
  dur: number
  pos: 'arriba' | 'centro' | 'abajo'
  color: string
}
interface Montaje {
  clips: Clip[]
  titulos: Titulo[]
  musica: { medio: string; volumen: number } | null
}
interface Datos {
  montaje: Montaje
  medios: { id: string; nombre: string; archivoId: string }[]
}

const FILTROS = [
  { valor: '', texto: 'Normal' },
  { valor: 'grayscale(100%)', texto: 'Blanco y negro' },
  { valor: 'sepia(100%)', texto: 'Antigua (sepia)' },
  { valor: 'saturate(180%)', texto: 'Colores fuertes' },
  { valor: 'brightness(130%)', texto: 'Más luz' },
]

const reloj = (s: number) => {
  const m = Math.floor(s / 60)
  const x = s - m * 60
  return `${m}:${x.toFixed(1).padStart(4, '0')}`
}

function cargar<T extends HTMLElement>(tipo: TipoMedio, url: string): Promise<T> {
  return new Promise((ok, no) => {
    if (tipo === 'imagen') {
      const i = new Image()
      i.onload = () => ok(i as unknown as T)
      i.onerror = no
      i.src = url
    } else {
      const m = document.createElement(tipo === 'video' ? 'video' : 'audio')
      m.preload = 'auto'
      m.onloadedmetadata = () => ok(m as unknown as T)
      m.onerror = no
      m.src = url
      if (m instanceof HTMLVideoElement) m.playsInline = true
    }
  })
}

export const pelicula: Programa = {
  id: 'pelicula',
  nombre: 'Película',
  icono: '🎬',
  ancho: 1200,
  alto: 760,
  abrir(win, archivoId) {
    const medios = new Map<string, Medio>()
    let m: Montaje = { clips: [], titulos: [], musica: null }
    let elegido: { tipo: 'clip' | 'titulo' | 'musica'; id: string } | null = null
    let t = 0
    let reproduciendo = false
    let pps = 50 // píxeles por segundo en la línea de tiempo
    let archivo: fs.Archivo | null = null
    let cambios = false
    const atras: string[] = []
    const adelante: string[] = []
    let exportando = false

    const total = () => Math.max(m.clips.reduce((a, c) => a + c.dur, 0), ...m.titulos.map((x) => x.inicio + x.dur), 0)
    const inicioDe = (i: number) => m.clips.slice(0, i).reduce((a, c) => a + c.dur, 0)
    function clipEn(s: number): { clip: Clip; i: number; local: number } | null {
      let a = 0
      for (let i = 0; i < m.clips.length; i++) {
        const c = m.clips[i]
        if (s < a + c.dur) return { clip: c, i, local: s - a }
        a += c.dur
      }
      return null
    }

    // ---------- Armado
    const raiz = el('div', 'pelicula')
    const menu = barraMenu([
      {
        titulo: 'Archivo',
        items: [
          { texto: 'Película nueva', atajo: 'Ctrl+N', accion: () => nueva() },
          { texto: 'Abrir…', atajo: 'Ctrl+O', accion: () => abrirOtro() },
          '-',
          { texto: 'Guardar', atajo: 'Ctrl+S', accion: () => guardar() },
          { texto: 'Guardar como…', accion: () => guardar(true) },
          '-',
          { texto: 'Exportar la película (video)…', atajo: 'Ctrl+E', accion: () => exportar() },
          '-',
          { texto: 'Cerrar', accion: async () => (await puedeSeguir()) && win.cerrar() },
        ],
      },
      {
        titulo: 'Editar',
        items: [
          { texto: 'Deshacer', atajo: 'Ctrl+Z', accion: () => deshacer(), activo: () => atras.length > 0 },
          { texto: 'Rehacer', atajo: 'Ctrl+Y', accion: () => rehacer(), activo: () => adelante.length > 0 },
          '-',
          { texto: 'Cortar en el cabezal', atajo: 'Ctrl+B', accion: () => cortarAca() },
          { texto: 'Borrar lo elegido', atajo: 'Supr', accion: () => borrarElegido(), activo: () => !!elegido },
        ],
      },
      {
        titulo: 'Insertar',
        items: [
          { texto: 'Fotos o dibujos de Mis cosas…', accion: () => traerDeMisCosas() },
          { texto: 'Videos, fotos o música de la compu…', accion: () => traerDeLaCompu() },
          { texto: 'Título', atajo: 'T', accion: () => nuevoTitulo() },
        ],
      },
    ])

    const arriba = el('div', 'pl-arriba')
    const biblioteca = el('div', 'pl-medios')
    const visor = el('div', 'pl-visor')
    const lienzo = document.createElement('canvas')
    lienzo.width = AN
    lienzo.height = AL
    lienzo.className = 'pl-lienzo'
    const controles = el('div', 'pl-controles')
    const bInicio = el('button', 'pl-boton', '⏮')
    const bPlay = el('button', 'pl-boton grande', '▶')
    const tiempo = el('span', 'pl-tiempo')
    controles.append(bInicio, bPlay, tiempo)
    visor.append(lienzo, controles)
    const inspector = el('div', 'pl-inspector')
    arriba.append(biblioteca, visor, inspector)

    const linea = el('div', 'pl-linea')
    const herr = el('div', 'pl-herr')
    const pistas = el('div', 'pl-pistas')
    const scroll = el('div', 'pl-scroll')
    const regla = el('div', 'pl-regla')
    const pV = el('div', 'pl-pista video')
    const pT = el('div', 'pl-pista titulos')
    const pA = el('div', 'pl-pista audio')
    const cabezal = el('div', 'pl-cabezal')
    const contenido = el('div', 'pl-contenido')
    contenido.append(regla, pT, pV, pA, cabezal)
    scroll.append(contenido)
    const nombresPistas = el('div', 'pl-nombres')
    nombresPistas.append(el('div', 'pl-nombre regla', ''), el('div', 'pl-nombre', 'T  Títulos'), el('div', 'pl-nombre', 'V1  Imagen'), el('div', 'pl-nombre', 'A1  Música'))
    pistas.append(nombresPistas, scroll)
    linea.append(herr, pistas)
    const estado = el('div', 'barra-estado')
    raiz.append(menu, arriba, linea, estado)
    win.cuerpo.append(raiz)

    const entradaArchivo = el('input')
    entradaArchivo.type = 'file'
    entradaArchivo.accept = 'image/*,video/*,audio/*'
    entradaArchivo.multiple = true
    entradaArchivo.style.display = 'none'
    raiz.append(entradaArchivo)

    const bot = (txt: string, titulo: string, f: () => void) => {
      const b = el('button', 'pl-boton')
      b.textContent = txt
      b.title = titulo
      b.onclick = f
      return b
    }
    const zoom = el('input')
    zoom.type = 'range'
    zoom.min = '15'
    zoom.max = '200'
    zoom.value = String(pps)
    zoom.title = 'Zoom de la línea de tiempo'
    zoom.oninput = () => {
      pps = Number(zoom.value)
      dibujarLinea()
    }
    herr.append(
      bot('✂ Cortar', 'Cortar el clip en el cabezal (Ctrl+B)', () => cortarAca()),
      bot('🗑 Borrar', 'Borrar lo elegido (Supr)', () => borrarElegido()),
      bot('T Título', 'Agregar un título en el cabezal (T)', () => nuevoTitulo()),
      el('span', 'pl-esp'),
      el('span', 'pl-zoom-txt', '🔍'),
      zoom,
    )

    // ---------- Historia
    function guardarPaso() {
      atras.push(JSON.stringify(m))
      if (atras.length > 100) atras.shift()
      adelante.length = 0
      if (!cambios) {
        cambios = true
        ponerTitulo()
      }
    }
    function deshacer() {
      const p = atras.pop()
      if (p === undefined) return
      adelante.push(JSON.stringify(m))
      m = JSON.parse(p)
      elegido = null
      todo()
    }
    function rehacer() {
      const p = adelante.pop()
      if (p === undefined) return
      atras.push(JSON.stringify(m))
      m = JSON.parse(p)
      todo()
    }

    // ---------- Medios
    async function agregarMedio(nombre: string, tipo: TipoMedio, url: string, archivoId?: string, id = fs.nuevoId()): Promise<Medio | null> {
      try {
        const e = await cargar<HTMLImageElement | HTMLVideoElement | HTMLAudioElement>(tipo, url)
        const duracion = e instanceof HTMLImageElement ? 3 : (e as HTMLMediaElement).duration || 3
        if (e instanceof HTMLVideoElement) e.addEventListener('seeked', () => pedirCuadro())
        const md: Medio = { id, nombre, tipo, url, duracion, archivoId, el: e }
        medios.set(id, md)
        dibujarBiblioteca()
        return md
      } catch {
        aviso('Película', `No se pudo abrir "${nombre}".`, '⚠️')
        return null
      }
    }

    async function traerDeMisCosas() {
      const id = await elegirArchivo(PROGRAMAS_CON_IMAGEN, 'Elegí una foto o un dibujo')
      if (!id) return
      const a = fs.buscar(id)!
      const url = await imagenDeMisCosas(id)
      if (!url) return
      const md = await agregarMedio(a.nombre, 'imagen', url, id)
      if (md) ponerEnLinea(md)
    }

    function traerDeLaCompu() {
      entradaArchivo.value = ''
      entradaArchivo.onchange = async () => {
        for (const f of entradaArchivo.files ?? []) {
          const tipo: TipoMedio | null = f.type.startsWith('image/') ? 'imagen' : f.type.startsWith('video/') ? 'video' : f.type.startsWith('audio/') ? 'audio' : null
          if (!tipo) continue
          const md = await agregarMedio(f.name.replace(/\.[^.]+$/, ''), tipo, URL.createObjectURL(f))
          if (md) ponerEnLinea(md)
        }
      }
      entradaArchivo.click()
    }

    /** Lleva un medio a la línea de tiempo: imágenes y videos al final de V1, la música a A1. */
    function ponerEnLinea(md: Medio) {
      guardarPaso()
      if (md.tipo === 'audio') m.musica = { medio: md.id, volumen: 0.8 }
      else m.clips.push({ id: fs.nuevoId(), medio: md.id, dur: md.tipo === 'imagen' ? 3 : md.duracion, desde: 0, trans: 'corte', efecto: 'nada', filtro: '' })
      todo()
    }

    function dibujarBiblioteca() {
      biblioteca.replaceChildren(el('div', 'pl-titulo', 'Medios'))
      const b1 = el('button', 'boton chico', '+ De Mis cosas')
      b1.onclick = traerDeMisCosas
      const b2 = el('button', 'boton chico', '+ De la compu')
      b2.onclick = traerDeLaCompu
      biblioteca.append(b1, b2)
      const lista = el('div', 'pl-lista-medios')
      for (const md of medios.values()) {
        const it = el('div', 'pl-medio')
        it.title = 'Doble clic para ponerlo en la línea de tiempo'
        const ico = md.tipo === 'imagen' ? miniatura(md.url) : el('div', 'mini', md.tipo === 'video' ? '🎞️' : '🎵')
        it.append(ico, el('div', 'pl-medio-nombre', md.nombre), el('div', 'pl-medio-dur', md.tipo === 'imagen' ? 'imagen' : reloj(md.duracion)))
        it.ondblclick = () => ponerEnLinea(md)
        lista.append(it)
      }
      if (!medios.size) lista.append(el('div', 'pl-vacio', 'Traé fotos, dibujos, videos o música.'))
      biblioteca.append(lista)
    }

    // ---------- Dibujar un cuadro de la película
    let pedidoCuadro = false
    function pedirCuadro() {
      if (pedidoCuadro) return
      pedidoCuadro = true
      requestAnimationFrame(() => {
        pedidoCuadro = false
        dibujarCuadro(t)
      })
    }

    function dibujarClip(g: CanvasRenderingContext2D, c: Clip, local: number, alfa: number) {
      const md = medios.get(c.medio)
      if (!md || md.tipo === 'audio') return
      const e = md.el as HTMLImageElement | HTMLVideoElement
      const w = e instanceof HTMLVideoElement ? e.videoWidth : e.naturalWidth
      const h = e instanceof HTMLVideoElement ? e.videoHeight : e.naturalHeight
      if (!w || !h) return
      let k = Math.min(AN / w, AL / h)
      const p = Math.min(1, local / c.dur)
      if (c.efecto === 'acercar') k *= 1 + 0.15 * p
      if (c.efecto === 'alejar') k *= 1.15 - 0.15 * p
      g.save()
      g.globalAlpha = alfa
      g.filter = c.filtro || 'none'
      g.drawImage(e, (AN - w * k) / 2, (AL - h * k) / 2, w * k, h * k)
      g.restore()
    }

    function dibujarCuadro(s: number) {
      const g = lienzo.getContext('2d')!
      g.fillStyle = '#000'
      g.fillRect(0, 0, AN, AL)
      const en = clipEn(s)
      if (en) {
        const { clip, i, local } = en
        sincronizarVideo(clip, local)
        if (clip.trans === 'fundido' && local < FUNDIDO) {
          // Fundido: desde el clip anterior (o desde negro si es el primero).
          const prev = m.clips[i - 1]
          if (prev) dibujarClip(g, prev, prev.dur, 1)
          dibujarClip(g, clip, local, local / FUNDIDO)
        } else dibujarClip(g, clip, local, 1)
      }
      for (const ti of m.titulos) {
        if (s < ti.inicio || s >= ti.inicio + ti.dur) continue
        const l = s - ti.inicio
        const alfa = Math.min(1, l / 0.3, (ti.dur - l) / 0.3)
        g.save()
        g.globalAlpha = Math.max(0, alfa)
        g.font = 'bold 64px Nunito, Arial, sans-serif'
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        const y = ti.pos === 'arriba' ? 90 : ti.pos === 'abajo' ? AL - 90 : AL / 2
        g.lineWidth = 8
        g.strokeStyle = 'rgba(0,0,0,.75)'
        g.lineJoin = 'round'
        g.strokeText(ti.texto, AN / 2, y)
        g.fillStyle = ti.color
        g.fillText(ti.texto, AN / 2, y)
        g.restore()
      }
      tiempo.textContent = `${reloj(s)} / ${reloj(total())}`
      cabezal.style.left = s * pps + 'px'
    }

    /** Los videos se reproducen de verdad: hay que llevarlos al segundo justo. */
    function sincronizarVideo(c: Clip, local: number) {
      for (const md of medios.values()) {
        if (md.tipo !== 'video') continue
        const v = md.el as HTMLVideoElement
        if (md.id !== c.medio) {
          if (!v.paused) v.pause()
          continue
        }
        const quiero = c.desde + local
        if (reproduciendo) {
          if (v.paused) {
            v.currentTime = quiero
            v.play().catch(() => {})
          } else if (Math.abs(v.currentTime - quiero) > 0.3) v.currentTime = quiero
        } else {
          if (!v.paused) v.pause()
          if (Math.abs(v.currentTime - quiero) > 0.04) v.currentTime = quiero
        }
      }
    }

    // ---------- Reproducir
    let ultimoCuadro = 0
    function play() {
      if (reproduciendo) return pausa()
      if (t >= total() - 0.05) t = 0
      reproduciendo = true
      bPlay.textContent = '⏸'
      const mus = m.musica && medios.get(m.musica.medio)
      if (mus && m.musica) {
        const a = mus.el as HTMLAudioElement
        a.volume = m.musica.volumen
        if (t < a.duration) {
          a.currentTime = t
          a.play().catch(() => {})
        }
      }
      ultimoCuadro = performance.now()
      requestAnimationFrame(avanzar)
    }
    function avanzar(ahora: number) {
      if (!reproduciendo) return
      t += (ahora - ultimoCuadro) / 1000
      ultimoCuadro = ahora
      if (t >= total()) {
        t = total()
        pausa()
        alTerminar?.()
        return
      }
      dibujarCuadro(t)
      seguirCabezal()
      requestAnimationFrame(avanzar)
    }
    function pausa() {
      reproduciendo = false
      bPlay.textContent = '▶'
      for (const md of medios.values()) if (md.tipo !== 'imagen') (md.el as HTMLMediaElement).pause()
      pedirCuadro()
    }
    function irA(s: number) {
      const sonando = reproduciendo
      if (sonando) pausa()
      t = Math.max(0, Math.min(total(), s))
      pedirCuadro()
      if (sonando) play()
    }
    function seguirCabezal() {
      const x = t * pps
      if (x > scroll.scrollLeft + scroll.clientWidth - 40) scroll.scrollLeft = x - 80
    }
    bPlay.onclick = play
    bInicio.onclick = () => irA(0)

    // ---------- Línea de tiempo
    function dibujarLinea() {
      const largo = Math.max(total() + 10, 30)
      contenido.style.width = largo * pps + 'px'
      // Regla con los segundos.
      regla.replaceChildren()
      const cada = pps >= 60 ? 1 : pps >= 25 ? 2 : 5
      for (let s = 0; s <= largo; s += cada) {
        const r = el('div', 'pl-marca', reloj(s).replace(/\.0$/, ''))
        r.style.left = s * pps + 'px'
        regla.append(r)
      }
      // V1: los clips uno detrás del otro.
      pV.replaceChildren()
      m.clips.forEach((c, i) => {
        const md = medios.get(c.medio)
        const d = el('div', 'pl-clip' + (elegido?.id === c.id ? ' elegido' : ''))
        d.style.left = inicioDe(i) * pps + 'px'
        d.style.width = c.dur * pps - 2 + 'px'
        if (md?.tipo === 'imagen') d.style.backgroundImage = `url("${md.url.replace(/"/g, '%22')}")`
        d.append(el('span', 'pl-clip-nombre', (c.trans === 'fundido' ? '◢ ' : '') + (md?.tipo === 'video' ? '🎞️ ' : '') + (md?.nombre ?? '?')))
        const borde = el('div', 'pl-borde')
        borde.title = 'Arrastrá para hacerlo más largo o más corto'
        d.append(borde)
        d.onpointerdown = (e) => arrastrarClip(e, c, d, (e.target as HTMLElement) === borde)
        pV.append(d)
      })
      // T: títulos donde estén.
      pT.replaceChildren()
      for (const ti of m.titulos) {
        const d = el('div', 'pl-clip titulo' + (elegido?.id === ti.id ? ' elegido' : ''))
        d.style.left = ti.inicio * pps + 'px'
        d.style.width = ti.dur * pps - 2 + 'px'
        d.append(el('span', 'pl-clip-nombre', 'T ' + ti.texto))
        const borde = el('div', 'pl-borde')
        d.append(borde)
        d.onpointerdown = (e) => arrastrarTitulo(e, ti, d, (e.target as HTMLElement) === borde)
        pT.append(d)
      }
      // A1: la música.
      pA.replaceChildren()
      if (m.musica) {
        const md = medios.get(m.musica.medio)
        const d = el('div', 'pl-clip musica' + (elegido?.tipo === 'musica' ? ' elegido' : ''))
        d.style.left = '0px'
        d.style.width = Math.min(md?.duracion ?? 0, largo) * pps + 'px'
        d.append(el('span', 'pl-clip-nombre', '🎵 ' + (md?.nombre ?? '?')))
        d.onpointerdown = (e) => {
          e.stopPropagation()
          elegido = { tipo: 'musica', id: m.musica!.medio }
          todo()
        }
        pA.append(d)
      }
      cabezal.style.left = t * pps + 'px'
    }

    function arrastrarClip(e: PointerEvent, c: Clip, d: HTMLElement, borde: boolean) {
      e.stopPropagation()
      if (e.button !== 0) return
      elegido = { tipo: 'clip', id: c.id }
      const x0 = e.clientX
      const md = medios.get(c.medio)
      let paso = false
      const dur0 = c.dur
      d.setPointerCapture(e.pointerId)
      d.onpointermove = (mv) => {
        const dx = (mv.clientX - x0) / pps
        if (!paso && Math.abs(mv.clientX - x0) < 4) return
        if (!paso) {
          guardarPaso()
          paso = true
        }
        if (borde) {
          // Recortar: más largo o más corto (un video no puede pasar de lo que dura).
          const max = md?.tipo === 'video' ? md.duracion - c.desde : 60
          c.dur = Math.round(Math.max(0.5, Math.min(max, dur0 + dx)) * 10) / 10
          d.style.width = c.dur * pps - 2 + 'px'
        } else {
          d.style.transform = `translateX(${mv.clientX - x0}px)`
          d.style.zIndex = '5'
        }
      }
      d.onpointerup = (up) => {
        d.onpointermove = d.onpointerup = null
        if (paso && !borde) {
          // Soltar: va al lugar según dónde quedó el medio del clip.
          const i = m.clips.indexOf(c)
          const centro = inicioDe(i) + c.dur / 2 + (up.clientX - x0) / pps
          m.clips.splice(i, 1)
          let j = 0
          while (j < m.clips.length && inicioDe(j) + m.clips[j].dur / 2 < centro) j++
          m.clips.splice(j, 0, c)
        }
        if (!paso) irA(inicioDe(m.clips.indexOf(c)) + (e.clientX - d.getBoundingClientRect().left) / pps)
        todo()
      }
      // Sin redibujar la línea ahora: el bloque tiene que seguir existiendo mientras se arrastra.
      contenido.querySelectorAll('.pl-clip.elegido').forEach((x) => x.classList.remove('elegido'))
      d.classList.add('elegido')
      dibujarInspector()
    }

    function arrastrarTitulo(e: PointerEvent, ti: Titulo, d: HTMLElement, borde: boolean) {
      e.stopPropagation()
      if (e.button !== 0) return
      elegido = { tipo: 'titulo', id: ti.id }
      const x0 = e.clientX
      const ini0 = ti.inicio
      const dur0 = ti.dur
      let paso = false
      d.setPointerCapture(e.pointerId)
      d.onpointermove = (mv) => {
        if (!paso && Math.abs(mv.clientX - x0) < 4) return
        if (!paso) {
          guardarPaso()
          paso = true
        }
        const dx = (mv.clientX - x0) / pps
        if (borde) ti.dur = Math.round(Math.max(0.5, dur0 + dx) * 10) / 10
        else ti.inicio = Math.round(Math.max(0, ini0 + dx) * 10) / 10
        d.style.left = ti.inicio * pps + 'px'
        d.style.width = ti.dur * pps - 2 + 'px'
        pedirCuadro()
      }
      d.onpointerup = () => {
        d.onpointermove = d.onpointerup = null
        if (!paso) irA(ti.inicio + 0.01)
        todo()
      }
      // Sin redibujar la línea ahora: el bloque tiene que seguir existiendo mientras se arrastra.
      contenido.querySelectorAll('.pl-clip.elegido').forEach((x) => x.classList.remove('elegido'))
      d.classList.add('elegido')
      dibujarInspector()
    }

    // Clic en la regla o en el vacío de una pista: mover el cabezal (y arrastrarlo).
    contenido.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('.pl-clip')) return
      const r = contenido.getBoundingClientRect()
      const poner = (x: number) => irA((x - r.left) / pps)
      poner(e.clientX)
      elegido = null
      dibujarLinea()
      dibujarInspector()
      const mov = (mv: PointerEvent) => poner(mv.clientX)
      const fin = () => {
        document.removeEventListener('pointermove', mov)
        document.removeEventListener('pointerup', fin)
      }
      document.addEventListener('pointermove', mov)
      document.addEventListener('pointerup', fin)
    })

    // ---------- Editar
    function cortarAca() {
      const en = clipEn(t)
      if (!en || en.local < 0.1 || en.clip.dur - en.local < 0.1) {
        estado.textContent = 'Poné el cabezal en el medio de un clip para cortarlo.'
        return
      }
      guardarPaso()
      const { clip, i, local } = en
      const resto: Clip = { ...clip, id: fs.nuevoId(), dur: Math.round((clip.dur - local) * 100) / 100, desde: clip.desde + local, trans: 'corte' }
      clip.dur = Math.round(local * 100) / 100
      m.clips.splice(i + 1, 0, resto)
      elegido = { tipo: 'clip', id: resto.id }
      todo()
    }

    function borrarElegido() {
      if (!elegido) return
      guardarPaso()
      if (elegido.tipo === 'clip') m.clips = m.clips.filter((c) => c.id !== elegido!.id)
      else if (elegido.tipo === 'titulo') m.titulos = m.titulos.filter((x) => x.id !== elegido!.id)
      else m.musica = null
      elegido = null
      t = Math.min(t, total())
      todo()
    }

    async function nuevoTitulo() {
      const r = await dialogo({
        titulo: 'Título',
        icono: 'T',
        mensaje: '¿Qué dice el título?',
        campo: 'Mi película',
        botones: [
          { texto: 'Agregar', valor: 'ok', principal: true },
          { texto: 'Cancelar', valor: 'no' },
        ],
      })
      if (r.boton !== 'ok' || !r.texto) return
      guardarPaso()
      const ti: Titulo = { id: fs.nuevoId(), texto: r.texto, inicio: Math.round(t * 10) / 10, dur: 3, pos: 'centro', color: '#ffffff' }
      m.titulos.push(ti)
      elegido = { tipo: 'titulo', id: ti.id }
      todo()
    }

    // ---------- Inspector (propiedades de lo elegido)
    function campoSelect(texto: string, opciones: { valor: string; texto: string }[], actual: string, poner: (v: string) => void) {
      const l = el('label', 'pl-campo')
      const s = el('select')
      for (const o of opciones) {
        const op = el('option', '', o.texto)
        op.value = o.valor
        s.append(op)
      }
      s.value = actual
      s.onchange = () => {
        guardarPaso()
        poner(s.value)
        todo()
      }
      l.append(el('span', '', texto), s)
      return l
    }
    function campoNumero(texto: string, valor: number, min: number, max: number, paso: number, poner: (n: number) => void) {
      const l = el('label', 'pl-campo')
      const i = el('input')
      i.type = 'number'
      i.min = String(min)
      i.max = String(max)
      i.step = String(paso)
      i.value = String(valor)
      i.onchange = () => {
        guardarPaso()
        poner(Math.max(min, Math.min(max, Number(i.value) || min)))
        todo()
      }
      l.append(el('span', '', texto), i)
      return l
    }

    function dibujarInspector() {
      inspector.replaceChildren(el('div', 'pl-titulo', 'Inspector'))
      if (!elegido) {
        inspector.append(el('div', 'pl-vacio', 'Elegí un clip o un título en la línea de tiempo para cambiarle cosas.'))
        return
      }
      if (elegido.tipo === 'clip') {
        const c = m.clips.find((x) => x.id === elegido!.id)
        if (!c) return
        const md = medios.get(c.medio)
        inspector.append(el('div', 'pl-insp-nombre', md?.nombre ?? ''))
        const max = md?.tipo === 'video' ? md.duracion - c.desde : 60
        inspector.append(
          campoNumero('Dura (segundos)', c.dur, 0.5, Math.round(max * 10) / 10, 0.5, (n) => (c.dur = n)),
          campoSelect('Cómo empieza', [{ valor: 'corte', texto: 'Corte directo' }, { valor: 'fundido', texto: 'Fundido' }], c.trans, (v) => (c.trans = v as Clip['trans'])),
          campoSelect('Movimiento', [{ valor: 'nada', texto: 'Quieto' }, { valor: 'acercar', texto: 'Acercarse despacio' }, { valor: 'alejar', texto: 'Alejarse despacio' }], c.efecto, (v) => (c.efecto = v as Clip['efecto'])),
          campoSelect('Color', FILTROS, c.filtro, (v) => (c.filtro = v)),
        )
      } else if (elegido.tipo === 'titulo') {
        const ti = m.titulos.find((x) => x.id === elegido!.id)
        if (!ti) return
        const l = el('label', 'pl-campo')
        const i = el('input')
        i.value = ti.texto
        i.onchange = () => {
          guardarPaso()
          ti.texto = i.value || ti.texto
          todo()
        }
        l.append(el('span', '', 'Texto'), i)
        inspector.append(
          l,
          campoNumero('Empieza en (s)', ti.inicio, 0, 600, 0.5, (n) => (ti.inicio = n)),
          campoNumero('Dura (segundos)', ti.dur, 0.5, 60, 0.5, (n) => (ti.dur = n)),
          campoSelect('Lugar', [{ valor: 'arriba', texto: 'Arriba' }, { valor: 'centro', texto: 'Al medio' }, { valor: 'abajo', texto: 'Abajo' }], ti.pos, (v) => (ti.pos = v as Titulo['pos'])),
          campoSelect('Color', [{ valor: '#ffffff', texto: 'Blanco' }, { valor: '#fdd835', texto: 'Amarillo' }, { valor: '#ec407a', texto: 'Rosa' }, { valor: '#42a5f5', texto: 'Celeste' }], ti.color, (v) => (ti.color = v)),
        )
      } else if (m.musica) {
        const mu = m.musica
        inspector.append(
          el('div', 'pl-insp-nombre', '🎵 ' + (medios.get(mu.medio)?.nombre ?? '')),
          campoNumero('Volumen (0 a 100)', Math.round(mu.volumen * 100), 0, 100, 10, (n) => (mu.volumen = n / 100)),
        )
      }
    }

    function todo() {
      dibujarLinea()
      dibujarInspector()
      pedirCuadro()
      estado.textContent = m.clips.length
        ? 'Espacio: reproducir · Ctrl+B: cortar · Arrastrá un clip para cambiarlo de lugar, o su borde derecho para hacerlo más largo.'
        : 'Empezá trayendo fotos, dibujos o videos (Insertar, o los botones de Medios).'
    }

    // ---------- Exportar (graba el lienzo mientras se reproduce)
    let alTerminar: (() => void) | null = null
    let audio: { ctx: AudioContext; destino: MediaStreamAudioDestinationNode } | null = null
    const conectados = new WeakSet<HTMLMediaElement>()

    async function exportar() {
      if (!m.clips.length) return aviso('Película', 'Primero poné algo en la línea de tiempo.', '🎬')
      if (exportando) return
      if (!audio) {
        const ctx = new AudioContext()
        audio = { ctx, destino: ctx.createMediaStreamDestination() }
      }
      // El sonido de los videos y la música va al archivo y a los parlantes.
      for (const md of medios.values()) {
        if (md.tipo === 'imagen') continue
        const e = md.el as HTMLMediaElement
        if (conectados.has(e)) continue
        const f = audio.ctx.createMediaElementSource(e)
        f.connect(audio.destino)
        f.connect(audio.ctx.destination)
        conectados.add(e)
      }
      await audio.ctx.resume()
      const flujo = new MediaStream([...lienzo.captureStream(30).getVideoTracks(), ...audio.destino.stream.getAudioTracks()])
      const tipo = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((x) => MediaRecorder.isTypeSupported(x)) ?? ''
      const grabador = new MediaRecorder(flujo, tipo ? { mimeType: tipo } : undefined)
      const partes: Blob[] = []
      grabador.ondataavailable = (e) => e.data.size && partes.push(e.data)
      const cartel = el('div', 'pl-exportando', '⏺ Grabando la película… no toques nada hasta que termine.')
      visor.append(cartel)
      exportando = true
      raiz.classList.add('exportando')
      grabador.start(500)
      t = 0
      alTerminar = () => {
        alTerminar = null
        setTimeout(() => grabador.stop(), 300)
      }
      grabador.onstop = () => {
        exportando = false
        raiz.classList.remove('exportando')
        cartel.remove()
        const blob = new Blob(partes, { type: 'video/webm' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = (archivo?.nombre ?? 'Mi película') + '.webm'
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 60_000)
        aviso('Película', `¡Lista! Se guardó "${a.download}" en Descargas.`, '🎬')
      }
      play()
    }

    // ---------- Archivo
    async function guardar(como = false): Promise<boolean> {
      // Solo se guarda lo que vino de Mis cosas; lo de la compu todavía no se puede guardar acá adentro.
      const deAfuera = [...medios.values()].filter((x) => !x.archivoId && (m.clips.some((c) => c.medio === x.id) || m.musica?.medio === x.id))
      if (deAfuera.length) {
        const r = await dialogo({
          titulo: 'Película',
          icono: '⚠️',
          mensaje: `Los videos, fotos y música traídos de la compu (${deAfuera.map((x) => x.nombre).join(', ')}) no se guardan con la película: al abrirla de nuevo no van a estar. Lo de Mis cosas sí.`,
          botones: [
            { texto: 'Guardar igual', valor: 'si', principal: true },
            { texto: 'Cancelar', valor: 'no' },
          ],
        })
        if (r.boton !== 'si') return false
      }
      let n = archivo?.nombre
      if (!archivo || como) {
        const sugerido = archivo ? archivo.nombre + ' (copia)' : fs.nombreLibre('Película', 'pelicula')
        const x = await pedirNombre('pelicula', sugerido, '¿Cómo se va a llamar tu película?')
        if (!x) return false
        n = x
        archivo = null
      }
      const quedan = new Set([...medios.values()].filter((x) => x.archivoId).map((x) => x.id))
      const datos: Datos = {
        montaje: {
          clips: m.clips.filter((c) => quedan.has(c.medio)),
          titulos: m.titulos,
          musica: m.musica && quedan.has(m.musica.medio) ? m.musica : null,
        },
        medios: [...medios.values()].filter((x) => x.archivoId).map((x) => ({ id: x.id, nombre: x.nombre, archivoId: x.archivoId! })),
      }
      // Miniatura: el primer cuadro con imagen.
      const tAntes = t
      dibujarCuadro(Math.min(total(), 0.8))
      const mini = document.createElement('canvas')
      mini.width = 240
      mini.height = 135
      mini.getContext('2d')!.drawImage(lienzo, 0, 0, 240, 135)
      dibujarCuadro(tAntes)
      try {
        archivo = fs.guardar({ id: archivo?.id ?? fs.nuevoId(), nombre: n!, app: 'pelicula', miniatura: mini.toDataURL('image/jpeg', 0.8) }, datos)
      } catch {
        await aviso('Película', 'No hay más lugar para guardar.', '⚠️')
        return false
      }
      cambios = false
      ponerTitulo()
      return true
    }

    async function puedeSeguir(): Promise<boolean> {
      if (exportando) return false
      if (!cambios || (!m.clips.length && !m.titulos.length)) return true
      const r = await preguntarSiGuarda('Película', archivo?.nombre ?? 'Sin nombre')
      if (r === 'cancelar') return false
      if (r === 'si') return guardar()
      return true
    }

    async function cargarArchivo(id: string) {
      const a = fs.buscar(id)
      const d = fs.leer(id) as Datos | null
      if (!a || !d) return
      pausa()
      medios.clear()
      for (const x of d.medios) {
        const url = await imagenDeMisCosas(x.archivoId)
        if (url) await agregarMedio(x.nombre, 'imagen', url, x.archivoId, x.id)
      }
      m = { ...d.montaje, clips: d.montaje.clips.filter((c) => medios.has(c.medio)) }
      archivo = a
      cambios = false
      atras.length = 0
      adelante.length = 0
      elegido = null
      t = 0
      ponerTitulo()
      dibujarBiblioteca()
      todo()
    }

    async function nueva() {
      if (!(await puedeSeguir())) return
      pausa()
      m = { clips: [], titulos: [], musica: null }
      medios.clear()
      archivo = null
      cambios = false
      atras.length = 0
      adelante.length = 0
      elegido = null
      t = 0
      ponerTitulo()
      dibujarBiblioteca()
      todo()
    }

    async function abrirOtro() {
      if (!(await puedeSeguir())) return
      const id = await elegirArchivo('pelicula', 'Abrir una película')
      if (id) await cargarArchivo(id)
    }

    function ponerTitulo() {
      win.ponerTitulo(`${cambios ? '● ' : ''}${archivo?.nombre ?? 'Sin nombre'} — Película`)
    }

    // ---------- Arranque
    dibujarBiblioteca()
    ponerTitulo()
    todo()
    if (archivoId) cargarArchivo(archivoId)

    return {
      alTecla(e) {
        if (exportando) return true
        const ctrl = e.ctrlKey || e.metaKey
        const k = e.key.toLowerCase()
        if (ctrl) {
          if (k === 'z') deshacer()
          else if (k === 'y') rehacer()
          else if (k === 'b') cortarAca()
          else if (k === 's') guardar()
          else if (k === 'o') abrirOtro()
          else if (k === 'n') nueva()
          else if (k === 'e') exportar()
          else return false
          return true
        }
        if (e.key === ' ') play()
        else if (e.key === 'Delete' || e.key === 'Backspace') borrarElegido()
        else if (e.key === 'ArrowLeft') irA(t - (e.shiftKey ? 1 : 0.1))
        else if (e.key === 'ArrowRight') irA(t + (e.shiftKey ? 1 : 0.1))
        else if (e.key === 'Home') irA(0)
        else if (e.key === 'End') irA(total())
        else if (k === 't') nuevoTitulo()
        else return false
        return true
      },
      async alCerrar() {
        const ok = await puedeSeguir()
        if (ok) pausa()
        return ok
      },
    }
  },
}
