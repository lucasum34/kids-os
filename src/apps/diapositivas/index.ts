// Diapositivas: presentaciones, la idea de PowerPoint en chiquito.
// Enseña: diapositivas con diseños (título, título y texto), cuadros de texto,
// formas e imágenes que se mueven y se agrandan, temas, transiciones entre
// diapositivas, animaciones de entrada, y el modo Presentación (F5).

import { imprimir } from '../../os/imprimir'
import * as fs from '../../os/archivos'
import { pedirNombre, preguntarSiGuarda } from '../../os/documento'
import { imagenDeMisCosas, PROGRAMAS_CON_IMAGEN } from '../../os/imagenes'
import { elegirArchivo } from '../../os/selector'
import { aviso, barraMenu, dialogo, el } from '../../os/ui'
import { copiarImagen, copiarTexto, deOtro } from '../../os/portapapeles'
import type { Programa } from '../../os/ventanas'

const AN = 960
const AL = 540

type Anim = 'nada' | 'aparecer' | 'desvanecer' | 'subir' | 'zoom' | 'girar'
type Trans = 'nada' | 'desvanecer' | 'deslizar' | 'zoom'
interface Obj {
  id: string
  tipo: 'texto' | 'rect' | 'elipse' | 'flecha' | 'estrella' | 'imagen'
  rol?: 'titulo' | 'cuerpo' | 'libre'
  x: number
  y: number
  w: number
  h: number
  texto?: string
  tam?: number
  negrita?: boolean
  color?: string // si no tiene, el del tema
  alinear?: 'left' | 'center' | 'right'
  relleno?: string
  archivoId?: string
  src?: string // imagen pegada desde otro programa
  anim: Anim
}
interface Diapo {
  id: string
  objs: Obj[]
  trans: Trans
}
interface Doc {
  tema: number
  diapos: Diapo[]
}

const TEMAS = [
  { nombre: 'Blanco', fondo: '#ffffff', titulo: '#1e3a5f', texto: '#263238', acento: '#1e88e5', fuente: 'Nunito, Arial, sans-serif' },
  { nombre: 'Cielo', fondo: 'linear-gradient(160deg,#e3f2fd,#90caf9)', titulo: '#0d47a1', texto: '#1a237e', acento: '#ffb300', fuente: 'Nunito, Arial, sans-serif' },
  { nombre: 'Noche', fondo: 'linear-gradient(160deg,#1a237e,#000428)', titulo: '#ffd54f', texto: '#e8eaf6', acento: '#ff7043', fuente: 'Nunito, Arial, sans-serif' },
  { nombre: 'Selva', fondo: 'linear-gradient(160deg,#e8f5e9,#a5d6a7)', titulo: '#1b5e20', texto: '#263238', acento: '#ef6c00', fuente: 'Georgia, serif' },
  { nombre: 'Caramelo', fondo: 'linear-gradient(160deg,#fce4ec,#f8bbd0 60%,#e1bee7)', titulo: '#880e4f', texto: '#4a148c', acento: '#00acc1', fuente: '"Comic Sans MS", cursive' },
  { nombre: 'Pizarrón', fondo: '#2e4a3a', titulo: '#ffffff', texto: '#e0f2e9', acento: '#ffeb3b', fuente: '"Comic Sans MS", cursive' },
]
const COLORES = ['#000000', '#ffffff', '#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#ec407a', '#8d6e63']
const ANIMS: { id: Anim; texto: string }[] = [
  { id: 'nada', texto: 'Ninguna' },
  { id: 'aparecer', texto: 'Aparecer' },
  { id: 'desvanecer', texto: 'Desvanecer' },
  { id: 'subir', texto: 'Entrar desde abajo' },
  { id: 'zoom', texto: 'Zoom' },
  { id: 'girar', texto: 'Girar' },
]
const TRANS: { id: Trans; texto: string }[] = [
  { id: 'nada', texto: 'Ninguna' },
  { id: 'desvanecer', texto: 'Desvanecer' },
  { id: 'deslizar', texto: 'Deslizar' },
  { id: 'zoom', texto: 'Zoom' },
]

const nuevoObj = (o: Partial<Obj> & Pick<Obj, 'tipo' | 'x' | 'y' | 'w' | 'h'>): Obj => ({ id: fs.nuevoId(), anim: 'nada', ...o })

function diseno(cual: 'titulo' | 'titulo-texto' | 'blanco'): Diapo {
  const objs: Obj[] = []
  if (cual === 'titulo') {
    objs.push(nuevoObj({ tipo: 'texto', rol: 'titulo', x: 80, y: 170, w: 800, h: 120, texto: 'Título de la presentación', tam: 60, negrita: true, alinear: 'center' }))
    objs.push(nuevoObj({ tipo: 'texto', rol: 'cuerpo', x: 180, y: 310, w: 600, h: 60, texto: 'Mi nombre', tam: 28, alinear: 'center' }))
  } else if (cual === 'titulo-texto') {
    objs.push(nuevoObj({ tipo: 'texto', rol: 'titulo', x: 60, y: 40, w: 840, h: 90, texto: 'Título', tam: 48, negrita: true, alinear: 'left' }))
    objs.push(nuevoObj({ tipo: 'texto', rol: 'cuerpo', x: 60, y: 150, w: 840, h: 340, texto: '• Primera idea\n• Segunda idea\n• Tercera idea', tam: 30, alinear: 'left' }))
  }
  return { id: fs.nuevoId(), objs, trans: 'nada' }
}

const SVG_FORMAS: Record<string, (r: string) => string> = {
  flecha: (r) => `<svg viewBox="0 0 100 60" preserveAspectRatio="none"><path d="M0 18 H62 V0 L100 30 L62 60 V42 H0 Z" fill="${r}"/></svg>`,
  estrella: (r) => `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M50 3 L62 38 L98 38 L69 60 L80 96 L50 74 L20 96 L31 60 L2 38 L38 38 Z" fill="${r}"/></svg>`,
}

export const diapositivas: Programa = {
  id: 'diapositivas',
  nombre: 'Diapositivas',
  icono: '📽️',
  ancho: 1200,
  alto: 760,
  abrir(win, archivoId) {
    let doc: Doc = { tema: 1, diapos: [diseno('titulo')] }
    let actual = 0
    let elegido: string | null = null
    let editando: string | null = null
    let pestana = 'Inicio'
    let archivo: fs.Archivo | null = null
    const hechas = new Set<string>() // lo que ya hizo (para el guía de las misiones)
    let cambios = false
    const atras: string[] = []
    const adelante: string[] = []
    const imagenes = new Map<string, string>() // archivoId → url

    const diapo = () => doc.diapos[actual]
    const tema = () => TEMAS[doc.tema] ?? TEMAS[0]
    const obj = () => diapo().objs.find((o) => o.id === elegido) ?? null

    // ---------- Armado
    const raiz = el('div', 'diapos')
    const menu = barraMenu([
      {
        titulo: 'Archivo',
        items: [
          { texto: 'Nueva presentación', atajo: 'Ctrl+N', accion: () => nueva() },
          { texto: 'Abrir…', atajo: 'Ctrl+O', accion: () => abrirOtro() },
          '-',
          { texto: 'Guardar', atajo: 'Ctrl+S', accion: () => guardar() },
          { texto: 'Guardar como…', accion: () => guardar(true) },
          '-',
          { texto: 'Imprimir…', atajo: 'Ctrl+P', accion: () => imprimirEsto() },
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
          { texto: 'Duplicar', atajo: 'Ctrl+D', accion: () => duplicarObj(), activo: () => !!elegido },
          { texto: 'Borrar', atajo: 'Supr', accion: () => borrarObj(), activo: () => !!elegido },
        ],
      },
      {
        titulo: 'Presentación',
        items: [
          { texto: 'Desde el principio', atajo: 'F5', accion: () => presentar(0) },
          { texto: 'Desde esta diapositiva', atajo: 'Mayús+F5', accion: () => presentar(actual) },
        ],
      },
    ])
    const pestanas = el('div', 'dp-pestanas')
    const cinta = el('div', 'dp-cinta')
    const cuerpo = el('div', 'dp-cuerpo')
    const lista = el('div', 'dp-lista')
    const zona = el('div', 'dp-zona')
    const escenario = el('div', 'dp-escenario')
    zona.append(escenario)
    cuerpo.append(lista, zona)
    const estado = el('div', 'barra-estado')
    raiz.append(menu, pestanas, cinta, cuerpo, estado)
    win.cuerpo.append(raiz)

    // ---------- Historia
    function guardarPaso() {
      atras.push(JSON.stringify({ doc, actual }))
      if (atras.length > 100) atras.shift()
      adelante.length = 0
      if (!cambios) {
        cambios = true
        ponerTitulo()
      }
    }
    function reponer(t: string) {
      const x = JSON.parse(t)
      doc = x.doc
      actual = Math.min(x.actual, doc.diapos.length - 1)
      elegido = null
      todo()
    }
    function deshacer() {
      const p = atras.pop()
      if (p === undefined) return
      adelante.push(JSON.stringify({ doc, actual }))
      reponer(p)
    }
    function rehacer() {
      const p = adelante.pop()
      if (p === undefined) return
      atras.push(JSON.stringify({ doc, actual }))
      reponer(p)
    }

    // ---------- Pintar una diapositiva (sirve para la grande, las miniaturas y la presentación)
    function pintarDiapo(cont: HTMLElement, d: Diapo, k: number, conEdicion: boolean) {
      cont.replaceChildren()
      cont.style.width = AN * k + 'px'
      cont.style.height = AL * k + 'px'
      cont.style.background = tema().fondo
      cont.style.fontFamily = tema().fuente
      for (const o of d.objs) {
        const e = el('div', 'dp-obj')
        e.dataset.id = o.id
        e.style.left = o.x * k + 'px'
        e.style.top = o.y * k + 'px'
        e.style.width = o.w * k + 'px'
        e.style.height = o.h * k + 'px'
        if (o.tipo === 'texto') {
          e.classList.add('texto')
          e.style.fontSize = (o.tam ?? 28) * k + 'px'
          e.style.fontWeight = o.negrita ? '800' : '400'
          e.style.color = o.color ?? (o.rol === 'titulo' ? tema().titulo : tema().texto)
          e.style.textAlign = o.alinear ?? 'left'
          e.textContent = o.texto ?? ''
          if (!o.texto && conEdicion) e.classList.add('vacio')
        } else if (o.tipo === 'rect' || o.tipo === 'elipse') {
          e.style.background = o.relleno ?? tema().acento
          if (o.tipo === 'elipse') e.style.borderRadius = '50%'
          else e.style.borderRadius = 10 * k + 'px'
        } else if (o.tipo === 'flecha' || o.tipo === 'estrella') {
          e.innerHTML = SVG_FORMAS[o.tipo](o.relleno ?? tema().acento)
        } else if (o.tipo === 'imagen') {
          const img = el('img')
          img.src = o.src ?? imagenes.get(o.archivoId ?? '') ?? ''
          img.draggable = false
          e.append(img)
        }
        if (conEdicion && o.id === elegido) e.classList.add('elegido')
        cont.append(e)
      }
    }

    // ---------- Lista de diapositivas (izquierda)
    function dibujarLista() {
      lista.replaceChildren()
      doc.diapos.forEach((d, i) => {
        const fila = el('div', 'dp-mini-fila' + (i === actual ? ' activa' : ''))
        const mini = el('div', 'dp-mini')
        pintarDiapo(mini, d, 168 / AN, false)
        fila.append(el('span', 'dp-num', String(i + 1)), mini)
        if (d.trans !== 'nada') fila.append(el('span', 'dp-marca-trans', '✦'))
        fila.onclick = () => {
          terminarEdicion()
          actual = i
          elegido = null
          todo()
        }
        fila.oncontextmenu = (e) => {
          e.preventDefault()
          actual = i
          todo()
          menuDiapo(e)
        }
        lista.append(fila)
      })
      const mas = el('button', 'boton chico', '+ Diapositiva nueva')
      mas.onclick = () => nuevaDiapo()
      lista.append(mas)
    }

    function menuDiapo(e: MouseEvent) {
      document.querySelector('.menu-contextual')?.remove()
      const m = el('div', 'menu-contextual')
      const op = (t: string, f: () => void) => {
        const it = el('div', 'menu-item', t)
        it.onclick = () => {
          m.remove()
          f()
        }
        m.append(it)
      }
      op('Diapositiva nueva', () => nuevaDiapo())
      op('Duplicar diapositiva', () => duplicarDiapo())
      op('Subir', () => moverDiapo(-1))
      op('Bajar', () => moverDiapo(1))
      op('Borrar diapositiva', () => borrarDiapo())
      m.style.left = e.clientX + 'px'
      m.style.top = e.clientY + 'px'
      document.body.append(m)
      setTimeout(() => document.addEventListener('pointerdown', (ev) => !m.contains(ev.target as Node) && m.remove(), { once: true }), 0)
    }

    async function nuevaDiapo() {
      terminarEdicion()
      const r = await dialogo({
        titulo: 'Diapositiva nueva',
        icono: '📽️',
        mensaje: '¿Qué diseño tiene?',
        botones: [
          { texto: 'Título y texto', valor: 'titulo-texto', principal: true },
          { texto: 'Solo título', valor: 'titulo' },
          { texto: 'En blanco', valor: 'blanco' },
          { texto: 'Cancelar', valor: 'cancelar' },
        ],
      })
      if (r.boton === 'cancelar') return
      guardarPaso()
      doc.diapos.splice(actual + 1, 0, diseno(r.boton as 'titulo'))
      actual++
      elegido = null
      todo()
    }
    function duplicarDiapo() {
      guardarPaso()
      const d: Diapo = JSON.parse(JSON.stringify(diapo()))
      d.id = fs.nuevoId()
      d.objs.forEach((o) => (o.id = fs.nuevoId()))
      doc.diapos.splice(actual + 1, 0, d)
      actual++
      todo()
    }
    function moverDiapo(dd: number) {
      const j = actual + dd
      if (j < 0 || j >= doc.diapos.length) return
      guardarPaso()
      ;[doc.diapos[actual], doc.diapos[j]] = [doc.diapos[j], doc.diapos[actual]]
      actual = j
      todo()
    }
    function borrarDiapo() {
      if (doc.diapos.length < 2) return
      guardarPaso()
      doc.diapos.splice(actual, 1)
      actual = Math.min(actual, doc.diapos.length - 1)
      elegido = null
      todo()
    }

    // ---------- Diapositiva grande (centro)
    let k = 1
    let ultimoClic: { id: string; t: number } | null = null
    function dibujarEscenario() {
      k = Math.min((zona.clientWidth - 40) / AN, (zona.clientHeight - 40) / AL)
      if (!(k > 0)) k = 0.5
      pintarDiapo(escenario, diapo(), k, true)
      const o = obj()
      if (o && !editando) {
        const e = escenario.querySelector(`[data-id="${o.id}"]`) as HTMLElement
        for (const esq of ['nw', 'ne', 'sw', 'se']) {
          const m = el('div', 'dp-manija ' + esq)
          m.dataset.esq = esq
          e.append(m)
        }
      }
      if (editando) {
        const e = escenario.querySelector(`[data-id="${editando}"]`) as HTMLElement | null
        if (e) empezarEdicionEn(e)
      }
    }

    escenario.addEventListener('pointerdown', (e) => {
      const t = e.target as HTMLElement
      if (t.isContentEditable) return
      const caja = t.closest('.dp-obj') as HTMLElement | null
      terminarEdicion()
      if (!caja) {
        elegido = null
        dibujarEscenario()
        dibujarCinta()
        return
      }
      const id = caja.dataset.id!
      // Doble clic en un texto: escribir. (Se cuenta acá porque al elegir se redibuja la diapositiva.)
      const ahora = Date.now()
      if (ultimoClic && ultimoClic.id === id && ahora - ultimoClic.t < 450 && caja.classList.contains('texto')) {
        ultimoClic = null
        editando = id
        elegido = id
        dibujarEscenario()
        return
      }
      ultimoClic = { id, t: ahora }
      elegido = id
      const o = obj()!
      const esq = t.dataset.esq
      const x0 = e.clientX
      const y0 = e.clientY
      const antes = { ...o }
      let paso = false
      const mov = (m: PointerEvent) => {
        const dx = (m.clientX - x0) / k
        const dy = (m.clientY - y0) / k
        if (!paso && Math.hypot(dx, dy) * k < 3) return
        if (!paso) {
          guardarPaso()
          paso = true
        }
        if (esq) {
          // Agrandar desde la esquina; con Mayús mantiene la forma.
          let w = antes.w + (esq.includes('e') ? dx : -dx)
          let h = antes.h + (esq.includes('s') ? dy : -dy)
          if (m.shiftKey || o.tipo === 'imagen') {
            const f = Math.max(w / antes.w, h / antes.h)
            w = antes.w * f
            h = antes.h * f
          }
          o.w = Math.max(20, Math.round(w))
          o.h = Math.max(20, Math.round(h))
          o.x = Math.round(esq.includes('w') ? antes.x + antes.w - o.w : antes.x)
          o.y = Math.round(esq.includes('n') ? antes.y + antes.h - o.h : antes.y)
        } else {
          o.x = Math.round(antes.x + dx)
          o.y = Math.round(antes.y + dy)
        }
        dibujarEscenario()
      }
      const fin = () => {
        document.removeEventListener('pointermove', mov)
        document.removeEventListener('pointerup', fin)
        if (paso) dibujarLista()
      }
      document.addEventListener('pointermove', mov)
      document.addEventListener('pointerup', fin)
      dibujarEscenario()
      dibujarCinta()
    })

    function empezarEdicionEn(e: HTMLElement) {
      e.contentEditable = 'true'
      e.classList.add('editando')
      e.classList.remove('vacio')
      e.focus()
      const r = document.createRange()
      r.selectNodeContents(e)
      r.collapse(false)
      getSelection()?.removeAllRanges()
      getSelection()?.addRange(r)
      e.onkeydown = (k) => {
        k.stopPropagation()
        if (k.key === 'Escape') terminarEdicion()
      }
      e.onblur = () => terminarEdicion()
    }
    function terminarEdicion() {
      if (!editando) return
      const e = escenario.querySelector(`[data-id="${editando}"]`) as HTMLElement | null
      // Se busca en todas: puede que ya se haya cambiado de diapositiva.
      const o = doc.diapos.flatMap((d) => d.objs).find((x) => x.id === editando)
      editando = null
      if (e && o) {
        const t = e.innerText.replace(/\n$/, '')
        if (t !== o.texto) {
          guardarPaso()
          o.texto = t
        }
      }
      dibujarEscenario()
      dibujarLista()
    }

    // ---------- Objetos
    function agregar(o: Obj) {
      guardarPaso()
      diapo().objs.push(o)
      elegido = o.id
      todo()
    }
    function cuadroDeTexto() {
      const o = nuevoObj({ tipo: 'texto', rol: 'libre', x: 300, y: 220, w: 360, h: 80, texto: 'Escribí acá', tam: 32, alinear: 'center' })
      agregar(o)
      editando = o.id
      dibujarEscenario()
    }
    async function insertarImagen() {
      const id = await elegirArchivo(PROGRAMAS_CON_IMAGEN, 'Elegí una foto o un dibujo')
      if (!id) return
      const url = await imagenDeMisCosas(id)
      if (!url) return
      imagenes.set(id, url)
      const img = new Image()
      img.src = url
      await img.decode().catch(() => {})
      const ancho = 420
      const alto = img.naturalWidth ? Math.round((ancho * img.naturalHeight) / img.naturalWidth) : 300
      agregar(nuevoObj({ tipo: 'imagen', archivoId: id, x: (AN - ancho) / 2, y: Math.max(20, (AL - alto) / 2), w: ancho, h: alto }))
    }
    function borrarObj() {
      if (!elegido) return
      guardarPaso()
      diapo().objs = diapo().objs.filter((o) => o.id !== elegido)
      elegido = null
      todo()
    }
    function duplicarObj() {
      const o = obj()
      if (!o) return
      agregar({ ...JSON.parse(JSON.stringify(o)), id: fs.nuevoId(), x: o.x + 20, y: o.y + 20 })
    }
    function cambiar(f: (o: Obj) => void) {
      const o = obj()
      if (!o) return
      guardarPaso()
      f(o)
      todo()
    }
    function ordenar(arriba: boolean) {
      const o = obj()
      if (!o) return
      guardarPaso()
      const resto = diapo().objs.filter((x) => x !== o)
      diapo().objs = arriba ? [...resto, o] : [o, ...resto]
      todo()
    }

    // ---------- Cinta de opciones con pestañas, como en PowerPoint
    const PESTANAS = ['Inicio', 'Insertar', 'Diseño', 'Transiciones', 'Animaciones', 'Presentación']
    function dibujarPestanas() {
      pestanas.replaceChildren()
      for (const p of PESTANAS) {
        const b = el('button', 'dp-pestana' + (p === pestana ? ' activa' : ''), p)
        b.onclick = () => {
          pestana = p
          dibujarPestanas()
          dibujarCinta()
        }
        pestanas.append(b)
      }
    }
    const boton = (txt: string, titulo: string, f: () => void, activo = true, clase = '') => {
      const b = el('button', 'dp-boton ' + clase)
      b.innerHTML = txt
      b.title = titulo
      b.disabled = !activo
      b.onmousedown = (e) => e.preventDefault()
      b.onclick = f
      return b
    }
    const grupo = (titulo: string, ...hijos: HTMLElement[]) => {
      const g = el('div', 'cd-grupo')
      const f = el('div', 'cd-fila')
      f.append(...hijos)
      g.append(f, el('div', 'cd-grupo-titulo', titulo))
      return g
    }
    function colores(f: (c: string) => void) {
      const c = el('div', 'dp-colores')
      for (const x of COLORES) {
        const m = el('span', 'cd-color')
        m.style.background = x
        m.onmousedown = (e) => e.preventDefault()
        m.onclick = () => f(x)
        c.append(m)
      }
      return c
    }

    function dibujarCinta() {
      cinta.replaceChildren()
      const o = obj()
      const esTexto = o?.tipo === 'texto'
      if (pestana === 'Inicio') {
        const tam = el('select', 'cd-select tamano')
        for (const t of [14, 18, 20, 24, 28, 32, 40, 48, 60, 72, 96]) {
          const op = el('option', '', String(t))
          op.value = String(t)
          tam.append(op)
        }
        tam.value = String(o?.tam ?? 28)
        tam.disabled = !esTexto
        tam.onchange = () => cambiar((x) => (x.tam = Number(tam.value)))
        cinta.append(
          grupo('Diapositivas', boton('➕', 'Diapositiva nueva', () => nuevaDiapo(), true, 'grande'), boton('⧉', 'Duplicar diapositiva', () => duplicarDiapo()), boton('🗑', 'Borrar diapositiva', () => borrarDiapo(), doc.diapos.length > 1)),
          grupo(
            'Texto',
            tam,
            boton('A<small>▴</small>', 'Agrandar la letra', () => cambiar((x) => (x.tam = Math.min(160, (x.tam ?? 28) + 4))), esTexto),
            boton('A<small>▾</small>', 'Achicar la letra', () => cambiar((x) => (x.tam = Math.max(10, (x.tam ?? 28) - 4))), esTexto),
            boton('<b>N</b>', 'Negrita', () => cambiar((x) => (x.negrita = !x.negrita)), esTexto, o?.negrita ? 'activo' : ''),
            boton('⫷', 'Izquierda', () => cambiar((x) => (x.alinear = 'left')), esTexto),
            boton('☰', 'Centrar', () => cambiar((x) => (x.alinear = 'center')), esTexto),
            boton('⫸', 'Derecha', () => cambiar((x) => (x.alinear = 'right')), esTexto),
          ),
          grupo('Color', o ? colores((c) => cambiar((x) => (x.tipo === 'texto' ? (x.color = c) : (x.relleno = c)))) : el('span', 'dp-pista', 'Elegí algo')),
          grupo('Organizar', boton('⬆', 'Traer al frente', () => ordenar(true), !!o), boton('⬇', 'Enviar al fondo', () => ordenar(false), !!o), boton('🗑', 'Borrar (Supr)', () => borrarObj(), !!o)),
        )
      } else if (pestana === 'Insertar') {
        const forma = (t: Obj['tipo'], ic: string, n: string) =>
          boton(ic, n, () => agregar(nuevoObj({ tipo: t, x: 380, y: 190, w: t === 'flecha' ? 260 : 200, h: t === 'flecha' ? 140 : 200 })))
        cinta.append(
          grupo('Texto', boton('🔤', 'Cuadro de texto', () => cuadroDeTexto(), true, 'grande')),
          grupo('Imágenes', boton('🖼️', 'Foto o dibujo de Mis cosas', () => insertarImagen(), true, 'grande')),
          grupo('Formas', forma('rect', '▬', 'Rectángulo'), forma('elipse', '⬤', 'Círculo'), forma('flecha', '➡', 'Flecha'), forma('estrella', '★', 'Estrella')),
        )
      } else if (pestana === 'Diseño') {
        const temas = el('div', 'dp-temas')
        TEMAS.forEach((t, i) => {
          const b = el('button', 'dp-tema' + (i === doc.tema ? ' activo' : ''))
          b.style.background = t.fondo
          b.append(el('span', '', 'Aa'))
          ;(b.firstChild as HTMLElement).style.color = t.titulo
          ;(b.firstChild as HTMLElement).style.fontFamily = t.fuente
          b.title = t.nombre
          b.onclick = () => {
            guardarPaso()
            doc.tema = i
            todo()
          }
          temas.append(b)
        })
        cinta.append(grupo('Temas (cambia todas las diapositivas)', temas))
      } else if (pestana === 'Transiciones') {
        const fila = el('div', 'dp-opciones')
        for (const t of TRANS) {
          const b = el('button', 'dp-opcion' + (diapo().trans === t.id ? ' activa' : ''), t.texto)
          b.onclick = () => {
            guardarPaso()
            diapo().trans = t.id
            todo()
          }
          fila.append(b)
        }
        cinta.append(grupo(`Cómo entra la diapositiva ${actual + 1}`, fila), grupo('', boton('Para todas', 'Usar esta transición en todas las diapositivas', () => {
          guardarPaso()
          doc.diapos.forEach((d) => (d.trans = diapo().trans))
          todo()
        })))
      } else if (pestana === 'Animaciones') {
        const fila = el('div', 'dp-opciones')
        for (const a of ANIMS) {
          const b = el('button', 'dp-opcion' + (o?.anim === a.id ? ' activa' : ''), a.texto)
          b.disabled = !o
          b.onclick = () => cambiar((x) => (x.anim = a.id))
          fila.append(b)
        }
        const orden = diapo().objs.filter((x) => x.anim !== 'nada').map((x, i) => `${i + 1}. ${x.texto?.slice(0, 14) || x.tipo}`)
        cinta.append(
          grupo(o ? 'Cómo aparece lo elegido (con cada clic en la presentación)' : 'Elegí algo de la diapositiva', fila),
          grupo('Orden', el('span', 'dp-pista', orden.join('  ·  ') || 'Sin animaciones')),
        )
      } else if (pestana === 'Presentación') {
        cinta.append(
          grupo('Presentar', boton('▶ Desde el principio', 'F5', () => presentar(0), true, 'ancho'), boton('▷ Desde esta', 'Mayús+F5', () => presentar(actual), true, 'ancho')),
          grupo('Cómo se usa', el('span', 'dp-pista', 'Clic, Espacio o → para avanzar · ← para volver · Esc para salir')),
        )
      }
    }

    // ---------- Presentar
    function presentar(desde: number) {
      hechas.add('presentar')
      terminarEdicion()
      const capa = el('div', 'dp-presentacion')
      const lienzo = el('div', 'dp-pres-diapo')
      capa.append(lienzo)
      document.body.append(capa)
      capa.requestFullscreen?.().catch(() => {})
      let i = desde
      let paso = 0 // cuántas animaciones ya se mostraron en esta diapositiva
      const anim = () => doc.diapos[i].objs.filter((o) => o.anim !== 'nada')
      const escala = () => Math.min(innerWidth / AN, innerHeight / AL)
      function mostrar(entrando: boolean) {
        const kk = escala()
        pintarDiapo(lienzo, doc.diapos[i], kk, false)
        // Lo que tiene animación y todavía no salió, escondido.
        anim().forEach((o, n) => {
          const e = lienzo.querySelector(`[data-id="${o.id}"]`) as HTMLElement
          if (n >= paso) e.classList.add('dp-oculto')
        })
        if (entrando && doc.diapos[i].trans !== 'nada') {
          lienzo.classList.remove('t-desvanecer', 't-deslizar', 't-zoom')
          void lienzo.offsetWidth
          lienzo.classList.add('t-' + doc.diapos[i].trans)
        }
      }
      function siguiente() {
        const a = anim()
        if (paso < a.length) {
          const o = a[paso]
          const e = lienzo.querySelector(`[data-id="${o.id}"]`) as HTMLElement
          e.classList.remove('dp-oculto')
          e.classList.add('a-' + o.anim)
          paso++
          return
        }
        if (i + 1 >= doc.diapos.length) return salir()
        i++
        paso = 0
        mostrar(true)
      }
      function anterior() {
        if (i === 0) return
        i--
        paso = anim().length
        mostrar(false)
      }
      function salir() {
        document.removeEventListener('keydown', teclas, true)
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
        capa.remove()
        actual = Math.min(i, doc.diapos.length - 1)
        todo()
      }
      const teclas = (e: KeyboardEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.key === 'Escape') salir()
        else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'Backspace') anterior()
        else if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter' || e.key === 'PageDown') siguiente()
      }
      document.addEventListener('keydown', teclas, true)
      capa.onclick = siguiente
      capa.oncontextmenu = (e) => {
        e.preventDefault()
        anterior()
      }
      addEventListener('resize', () => capa.isConnected && mostrar(false))
      mostrar(true)
    }

    // ---------- Todo junto
    function todo() {
      terminarEdicion()
      dibujarLista()
      dibujarEscenario()
      dibujarCinta()
      estado.textContent = `Diapositiva ${actual + 1} de ${doc.diapos.length}   ·   Tema: ${tema().nombre}   ·   Doble clic en un texto para escribir · F5 para presentar`
    }
    const obs = new ResizeObserver(() => dibujarEscenario())
    obs.observe(zona)

    // ---------- Archivo
    function miniatura(i = 0): string {
      const d = doc.diapos[i]
      const t = tema()
      let h = ''
      for (const o of d.objs) {
        const base = `position:absolute;left:${o.x}px;top:${o.y}px;width:${o.w}px;height:${o.h}px;`
        if (o.tipo === 'texto')
          h += `<div style="${base}font-size:${o.tam}px;font-weight:${o.negrita ? 800 : 400};color:${o.color ?? (o.rol === 'titulo' ? t.titulo : t.texto)};text-align:${o.alinear};white-space:pre-wrap;overflow:hidden">${(o.texto ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)}</div>`
        else if (o.tipo === 'imagen') h += `<div style="${base}background:#cfd8dc;border-radius:6px"></div>`
        else h += `<div style="${base}background:${o.relleno ?? t.acento};border-radius:${o.tipo === 'elipse' ? '50%' : '10px'}"></div>`
      }
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${AN} ${AL}"><foreignObject width="${AN}" height="${AL}"><div xmlns="http://www.w3.org/1999/xhtml" style="position:relative;width:${AN}px;height:${AL}px;background:${t.fondo};font-family:${t.fuente.replace(/"/g, "'")}">${h}</div></foreignObject></svg>`
    }

    function imprimirEsto() {
      terminarEdicion()
      // Una diapositiva por hoja, acostada.
      imprimir({
        titulo: archivo?.nombre ?? 'Sin nombre',
        paginas: doc.diapos.map((_, i) => ({ tipo: 'imagen' as const, contenido: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(miniatura(i)) })),
        horizontal: true,
      })
    }

    async function guardar(como = false): Promise<boolean> {
      terminarEdicion()
      let n = archivo?.nombre
      if (!archivo || como) {
        const sugerido = archivo ? archivo.nombre + ' (copia)' : fs.nombreLibre('Presentación', 'diapositivas')
        const x = await pedirNombre('diapositivas', sugerido, '¿Cómo se va a llamar tu presentación?')
        if (!x) return false
        n = x
        archivo = null
      }
      try {
        archivo = fs.guardar({ id: archivo?.id ?? fs.nuevoId(), nombre: n!, app: 'diapositivas', miniatura: miniatura() }, doc)
      } catch {
        await aviso('Diapositivas', 'No hay más lugar para guardar.', '⚠️')
        return false
      }
      cambios = false
      ponerTitulo()
      return true
    }
    async function puedeSeguir(): Promise<boolean> {
      terminarEdicion()
      if (!cambios) return true
      const r = await preguntarSiGuarda('Diapositivas', archivo?.nombre ?? 'Sin nombre')
      if (r === 'cancelar') return false
      if (r === 'si') return guardar()
      return true
    }
    async function cargar(id: string) {
      const a = fs.buscar(id)
      const d = fs.leer(id) as Doc | null
      if (!a || !d) return
      // Las imágenes se leen de Mis cosas (si se borraron, queda el hueco).
      for (const dd of d.diapos)
        for (const o of dd.objs)
          if (o.archivoId && !imagenes.has(o.archivoId)) {
            const url = await imagenDeMisCosas(o.archivoId)
            if (url) imagenes.set(o.archivoId, url)
          }
      doc = d
      actual = 0
      elegido = null
      archivo = a
      cambios = false
      atras.length = 0
      adelante.length = 0
      ponerTitulo()
      todo()
    }
    async function nueva() {
      if (!(await puedeSeguir())) return
      doc = { tema: 1, diapos: [diseno('titulo')] }
      actual = 0
      elegido = null
      archivo = null
      cambios = false
      atras.length = 0
      adelante.length = 0
      ponerTitulo()
      todo()
    }
    async function abrirOtro() {
      if (!(await puedeSeguir())) return
      const id = await elegirArchivo('diapositivas', 'Abrir una presentación')
      if (id) await cargar(id)
    }
    function ponerTitulo() {
      win.ponerTitulo(`${cambios ? '● ' : ''}${archivo?.nombre ?? 'Sin nombre'} — Diapositivas`)
    }

    // ---------- Arranque
    dibujarPestanas()
    ponerTitulo()
    setTimeout(() => (archivoId ? cargar(archivoId) : todo()), 0)

    return {
      alTecla(e) {
        const ctrl = e.ctrlKey || e.metaKey
        const kk = e.key.toLowerCase()
        if (e.key === 'F5') presentar(e.shiftKey ? actual : 0)
        else if (ctrl) {
          if (kk === 'z') deshacer()
          else if (kk === 'y') rehacer()
          else if (kk === 's') guardar()
          else if (kk === 'p') imprimirEsto()
          else if (kk === 'o') abrirOtro()
          else if (kk === 'n') nueva()
          else if (kk === 'd') duplicarObj()
          else if (kk === 'c') {
            const o = obj()
            if (o?.tipo === 'texto') copiarTexto(o.texto ?? '', 'diapositivas')
            else if (o?.tipo === 'imagen') copiarImagen(o.src ?? imagenes.get(o.archivoId ?? '') ?? '', 'diapositivas')
          } else if (kk === 'v') {
            const otro = deOtro('diapositivas')
            if (otro?.tipo === 'texto') agregar(nuevoObj({ tipo: 'texto', rol: 'libre', x: 120, y: 160, w: 720, h: 220, texto: otro.texto, tam: 28, alinear: 'left' }))
            else if (otro?.tipo === 'imagen') {
              const img = new Image()
              img.onload = () => {
                const ancho = 420
                const alto = img.naturalWidth ? Math.round((ancho * img.naturalHeight) / img.naturalWidth) : 300
                agregar(nuevoObj({ tipo: 'imagen', src: otro.url, x: (AN - ancho) / 2, y: Math.max(20, (AL - alto) / 2), w: ancho, h: alto }))
              }
              img.src = otro.url
            }
          }
          else if (kk === 'm') nuevaDiapo()
          else return false
        } else if (e.key === 'Delete' || e.key === 'Backspace') borrarObj()
        else if (e.key.startsWith('Arrow') && elegido) {
          const p = e.shiftKey ? 10 : 2
          cambiar((o) => {
            if (e.key === 'ArrowLeft') o.x -= p
            if (e.key === 'ArrowRight') o.x += p
            if (e.key === 'ArrowUp') o.y -= p
            if (e.key === 'ArrowDown') o.y += p
          })
        } else if ((e.key === 'PageDown' || e.key === 'ArrowDown') && !elegido) {
          actual = Math.min(doc.diapos.length - 1, actual + 1)
          todo()
        } else if (e.key === 'Escape') {
          elegido = null
          todo()
        } else return false
        return true
      },
      // Para el guía de las misiones.
      api: {
        hizo: (a: string) => hechas.has(a),
        diapos: () => doc.diapos.length,
        actual: () => actual,
        tema: () => doc.tema,
        pestana: () => pestana,
        editando: () => !!editando,
        texto: (i: number, rol: string) => doc.diapos[i]?.objs.find((o) => o.rol === rol)?.texto ?? '',
        cuantos: (tipo: string) => doc.diapos.flatMap((d) => d.objs).filter((o) => o.tipo === tipo).length,
        animadas: () => doc.diapos.flatMap((d) => d.objs).filter((o) => o.anim !== 'nada').length,
        transiciones: () => doc.diapos.filter((d) => d.trans !== 'nada').length,
        cargar: () => {
          doc = { tema: 0, diapos: [diseno('titulo')] }
          actual = 0
          elegido = null
          archivo = null
          cambios = false
          atras.length = 0
          adelante.length = 0
          hechas.clear()
          pestana = 'Inicio'
          dibujarPestanas()
          ponerTitulo()
          todo()
        },
        guardarComo: (n0: string) => {
          terminarEdicion()
          let n = n0
          for (let i = 2; fs.existeNombre(n, 'diapositivas'); i++) n = `${n0} ${i}`
          archivo = fs.guardar({ id: fs.nuevoId(), nombre: n, app: 'diapositivas', miniatura: miniatura() }, doc)
          cambios = false
          ponerTitulo()
          return n
        },
      },
      async alCerrar() {
        const ok = await puedeSeguir()
        if (ok) obs.disconnect()
        return ok
      },
    }
  },
}
