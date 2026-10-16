// Trazos: dibujo vectorial, la idea de Corel en chiquito.
// Enseña: las figuras son objetos (se eligen, se mueven, se agrandan, se borran),
// relleno con clic y contorno con clic derecho en la paleta (como Corel),
// Ctrl+Z / Ctrl+Y, copiar y pegar, traer al frente, guardar y abrir.

import { imprimir } from '../os/imprimir'
import * as fs from '../os/archivos'
import { elegirArchivo } from '../os/selector'
import { pedirNombre, preguntarSiGuarda } from '../os/documento'
import { barraMenu, el } from '../os/ui'
import { copiarImagen } from '../os/portapapeles'
import type { Programa } from '../os/ventanas'

type Tipo = 'rect' | 'elipse' | 'linea' | 'trazo' | 'texto'
interface Figura {
  id: string
  tipo: Tipo
  // Caja de la figura. En línea: (x,y) es una punta y (x+w, y+h) la otra.
  x: number
  y: number
  w: number
  h: number
  pts?: [number, number][] // trazo a mano alzada, relativo a la caja (0..1)
  texto?: string
  relleno: string // 'none' = sin relleno
  borde: string
  grosor: number
}
interface Dibujo {
  figuras: Figura[]
}

type Herramienta = 'elegir' | Tipo
const HERRAMIENTAS: { id: Herramienta; icono: string; nombre: string; tecla: string }[] = [
  { id: 'elegir', icono: '↖', nombre: 'Elegir y mover', tecla: 'V' },
  { id: 'rect', icono: '▭', nombre: 'Rectángulo', tecla: 'R' },
  { id: 'elipse', icono: '◯', nombre: 'Círculo', tecla: 'C' },
  { id: 'linea', icono: '╱', nombre: 'Línea', tecla: 'L' },
  { id: 'trazo', icono: '✎', nombre: 'Lápiz', tecla: 'P' },
  { id: 'texto', icono: 'A', nombre: 'Texto', tecla: 'T' },
]
const COLORES = [
  '#000000', '#ffffff', '#9e9e9e', '#e53935', '#fb8c00', '#fdd835', '#43a047',
  '#1e88e5', '#3949ab', '#8e24aa', '#ec407a', '#8d6e63', '#80deea', '#c5e1a5',
]
const GROSORES = [2, 5, 10]
const NS = 'http://www.w3.org/2000/svg'
const ANCHO = 1000
const ALTO = 700

const svgEl = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>) => {
  const e = document.createElementNS(NS, tag)
  for (const k in attrs) e.setAttribute(k, String(attrs[k]))
  return e
}

/** Caja normalizada (ancho y alto positivos). */
function caja(f: Figura) {
  return {
    x: Math.min(f.x, f.x + f.w),
    y: Math.min(f.y, f.y + f.h),
    w: Math.abs(f.w),
    h: Math.abs(f.h),
  }
}

function figuraSvg(f: Figura): SVGElement {
  const estilo = { fill: f.relleno, stroke: f.borde, 'stroke-width': f.grosor, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }
  const c = caja(f)
  switch (f.tipo) {
    case 'rect':
      return svgEl('rect', { x: c.x, y: c.y, width: c.w, height: c.h, ...estilo })
    case 'elipse':
      return svgEl('ellipse', { cx: c.x + c.w / 2, cy: c.y + c.h / 2, rx: c.w / 2, ry: c.h / 2, ...estilo })
    case 'linea':
      return svgEl('line', { x1: f.x, y1: f.y, x2: f.x + f.w, y2: f.y + f.h, ...estilo, fill: 'none' })
    case 'trazo': {
      const d = (f.pts ?? []).map(([u, v], i) => `${i ? 'L' : 'M'}${(f.x + u * f.w).toFixed(1)} ${(f.y + v * f.h).toFixed(1)}`).join(' ')
      return svgEl('path', { d, ...estilo, fill: 'none' })
    }
    case 'texto': {
      const t = svgEl('text', { x: c.x, y: c.y + c.h * 0.8, 'font-size': c.h, 'font-family': 'Nunito, Arial, sans-serif', fill: f.relleno === 'none' ? f.borde : f.relleno })
      t.textContent = f.texto ?? ''
      return t
    }
  }
}

function aSvgTexto(d: Dibujo): string {
  const s = svgEl('svg', { xmlns: NS, viewBox: `0 0 ${ANCHO} ${ALTO}` })
  s.append(svgEl('rect', { x: 0, y: 0, width: ANCHO, height: ALTO, fill: '#fff' }))
  d.figuras.forEach((f) => s.append(figuraSvg(f)))
  return s.outerHTML
}

export const trazos: Programa = {
  id: 'trazos',
  nombre: 'Trazos',
  icono: '✒️',
  ancho: 1000,
  alto: 680,
  abrir(v, archivoId) {
    let dibujo: Dibujo = { figuras: [] }
    let archivo: fs.Archivo | null = null
    const hechas = new Set<string>() // lo que ya hizo (para el guía de las misiones)
    const hizo = (a: string) => hechas.add(a)
    let cambios = false
    let herramienta: Herramienta = 'rect'
    let relleno = '#fdd835'
    let borde = '#000000'
    let grosor = 5
    let elegidos: string[] = []
    const atras: string[] = []
    const adelante: string[] = []
    let portapapeles: Figura[] = []

    // ---------- Armado de la ventana
    const raiz = el('div', 'trazos')
    const menu = barraMenu([
      {
        titulo: 'Archivo',
        items: [
          { texto: 'Nuevo', atajo: 'Ctrl+N', accion: () => nuevo() },
          { texto: 'Abrir…', atajo: 'Ctrl+O', accion: () => abrirOtro() },
          '-',
          { texto: 'Guardar', atajo: 'Ctrl+S', accion: () => guardar() },
          { texto: 'Guardar como…', accion: () => guardar(true) },
          '-',
          { texto: 'Imprimir…', atajo: 'Ctrl+P', accion: () => imprimirEsto() },
          '-',
          { texto: 'Cerrar', accion: () => cerrarVentana() },
        ],
      },
      {
        titulo: 'Editar',
        items: [
          { texto: 'Deshacer', atajo: 'Ctrl+Z', accion: () => deshacer(), activo: () => atras.length > 0 },
          { texto: 'Rehacer', atajo: 'Ctrl+Y', accion: () => rehacer(), activo: () => adelante.length > 0 },
          '-',
          { texto: 'Cortar', atajo: 'Ctrl+X', accion: () => cortar(), activo: () => elegidos.length > 0 },
          { texto: 'Copiar', atajo: 'Ctrl+C', accion: () => copiar(), activo: () => elegidos.length > 0 },
          { texto: 'Pegar', atajo: 'Ctrl+V', accion: () => pegar(), activo: () => portapapeles.length > 0 },
          { texto: 'Duplicar', atajo: 'Ctrl+D', accion: () => duplicar(), activo: () => elegidos.length > 0 },
          { texto: 'Borrar', atajo: 'Supr', accion: () => borrarElegidos(), activo: () => elegidos.length > 0 },
          '-',
          { texto: 'Elegir todo', atajo: 'Ctrl+A', accion: () => elegirTodo() },
        ],
      },
      {
        titulo: 'Ordenar',
        items: [
          { texto: 'Traer al frente', atajo: 'Ctrl+Inicio', accion: () => ordenar('frente'), activo: () => elegidos.length > 0 },
          { texto: 'Mandar al fondo', atajo: 'Ctrl+Fin', accion: () => ordenar('fondo'), activo: () => elegidos.length > 0 },
        ],
      },
    ])

    const cuerpo = el('div', 'trazos-cuerpo')
    const caja_herr = el('div', 'trazos-herramientas')
    const zona = el('div', 'trazos-zona')
    const lienzo = svgEl('svg', { viewBox: `0 0 ${ANCHO} ${ALTO}`, class: 'trazos-lienzo' }) as SVGSVGElement
    const capaFiguras = svgEl('g', {})
    const capaGuia = svgEl('g', {})
    lienzo.append(svgEl('rect', { x: 0, y: 0, width: ANCHO, height: ALTO, fill: '#fff' }), capaFiguras, capaGuia)
    zona.append(lienzo)
    cuerpo.append(caja_herr, zona)

    const abajo = el('div', 'trazos-abajo')
    const muestra = el('div', 'trazos-muestra')
    const paleta = el('div', 'paleta')
    const grosores = el('div', 'grosores')
    abajo.append(muestra, paleta, grosores)
    const estado = el('div', 'barra-estado')
    raiz.append(menu, cuerpo, abajo, estado)
    v.cuerpo.append(raiz)

    // ---------- Herramientas
    function dibujarHerramientas() {
      caja_herr.replaceChildren()
      for (const h of HERRAMIENTAS) {
        const b = el('button', 'herr' + (h.id === herramienta ? ' activa' : ''), h.icono)
        b.title = `${h.nombre} (${h.tecla})`
        b.onclick = () => ponerHerramienta(h.id)
        caja_herr.append(b)
      }
    }
    function ponerHerramienta(h: Herramienta) {
      herramienta = h
      if (h !== 'elegir') elegidos = []
      lienzo.style.cursor = h === 'elegir' ? 'default' : h === 'texto' ? 'text' : 'crosshair'
      dibujarHerramientas()
      redibujar()
    }

    // ---------- Paleta: clic = relleno, clic derecho = contorno (como en Corel)
    function dibujarPaleta() {
      paleta.replaceChildren()
      const sin = el('div', 'color sin', '✕')
      sin.title = 'Sin relleno (clic) · Sin contorno (clic derecho)'
      sin.onclick = () => ponerColor('relleno', 'none')
      sin.oncontextmenu = (e) => {
        e.preventDefault()
        ponerColor('borde', 'none')
      }
      paleta.append(sin)
      for (const c of COLORES) {
        const b = el('div', 'color')
        b.style.background = c
        b.title = 'Clic: relleno · Clic derecho: contorno'
        b.onclick = () => ponerColor('relleno', c)
        b.oncontextmenu = (e) => {
          e.preventDefault()
          ponerColor('borde', c)
        }
        paleta.append(b)
      }
      grosores.replaceChildren()
      for (const g of GROSORES) {
        const b = el('div', 'grosor' + (g === grosor ? ' activo' : ''))
        const raya = el('div', 'raya')
        raya.style.height = g + 'px'
        b.append(raya)
        b.title = 'Grosor del contorno'
        b.onclick = () => {
          grosor = g
          if (elegidos.length) cambiar((f) => (f.grosor = g))
          dibujarPaleta()
        }
        grosores.append(b)
      }
      muestra.replaceChildren()
      const m = el('div', 'muestra-figura')
      m.style.background = relleno === 'none' ? 'repeating-linear-gradient(45deg,#fff 0 6px,#eee 6px 12px)' : relleno
      m.style.border = borde === 'none' ? '3px dashed #ccc' : `4px solid ${borde}`
      m.title = 'Relleno y contorno de lo próximo que dibujes'
      muestra.append(m)
    }
    function ponerColor(cual: 'relleno' | 'borde', c: string) {
      if (cual === 'relleno') relleno = c
      else borde = c
      hizo(cual)
      if (elegidos.length) hizo(cual + '-a-figura')
      if (elegidos.length) cambiar((f) => (f[cual] = c))
      dibujarPaleta()
    }

    // ---------- Historia (deshacer / rehacer)
    const foto = () => JSON.stringify(dibujo.figuras)
    function guardarPaso() {
      atras.push(foto())
      if (atras.length > 200) atras.shift()
      adelante.length = 0
      cambios = true
      ponerTitulo()
    }
    function deshacer() {
      const p = atras.pop()
      if (p === undefined) return
      adelante.push(foto())
      dibujo.figuras = JSON.parse(p)
      elegidos = elegidos.filter((id) => dibujo.figuras.some((f) => f.id === id))
      cambios = true
      ponerTitulo()
      redibujar()
    }
    function rehacer() {
      const p = adelante.pop()
      if (p === undefined) return
      atras.push(foto())
      dibujo.figuras = JSON.parse(p)
      elegidos = elegidos.filter((id) => dibujo.figuras.some((f) => f.id === id))
      cambios = true
      ponerTitulo()
      redibujar()
    }
    function cambiar(f: (fig: Figura) => void) {
      guardarPaso()
      dibujo.figuras.filter((x) => elegidos.includes(x.id)).forEach(f)
      redibujar()
    }

    // ---------- Edición
    const elegidas = () => dibujo.figuras.filter((f) => elegidos.includes(f.id))
    function borrarElegidos() {
      if (!elegidos.length) return
      guardarPaso()
      hizo('borrar')
      dibujo.figuras = dibujo.figuras.filter((f) => !elegidos.includes(f.id))
      elegidos = []
      redibujar()
    }
    function copiar() {
      if (!elegidos.length) return
      portapapeles = JSON.parse(JSON.stringify(elegidas()))
      // Recortado a lo elegido, sin fondo.
      const cs = elegidas().map(caja)
      const m = Math.max(...elegidas().map((f) => f.grosor)) + 4
      const x0 = Math.min(...cs.map((c) => c.x)) - m
      const y0 = Math.min(...cs.map((c) => c.y)) - m
      const x1 = Math.max(...cs.map((c) => c.x + c.w)) + m
      const y1 = Math.max(...cs.map((c) => c.y + c.h)) + m
      const s = svgEl('svg', { xmlns: NS, viewBox: `${x0} ${y0} ${x1 - x0} ${y1 - y0}`, width: Math.round(x1 - x0), height: Math.round(y1 - y0) })
      elegidas().forEach((f) => s.append(figuraSvg(f)))
      copiarImagen('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s.outerHTML), 'trazos')
    }
    function cortar() {
      copiar()
      borrarElegidos()
    }
    function pegar(desfase = 20) {
      if (!portapapeles.length) return
      guardarPaso()
      const nuevas = portapapeles.map((f) => ({ ...JSON.parse(JSON.stringify(f)), id: fs.nuevoId(), x: f.x + desfase, y: f.y + desfase }))
      dibujo.figuras.push(...nuevas)
      hizo('pegar')
      portapapeles = JSON.parse(JSON.stringify(nuevas)) // la próxima pegada sale corrida otra vez
      elegidos = nuevas.map((f) => f.id)
      ponerHerramienta('elegir')
    }
    function duplicar() {
      const guardado = portapapeles
      copiar()
      pegar()
      portapapeles = guardado
    }
    function elegirTodo() {
      herramienta = 'elegir'
      elegidos = dibujo.figuras.map((f) => f.id)
      dibujarHerramientas()
      redibujar()
    }
    function ordenar(a: 'frente' | 'fondo') {
      if (!elegidos.length) return
      guardarPaso()
      hizo('ordenar')
      const sel = elegidas()
      const resto = dibujo.figuras.filter((f) => !elegidos.includes(f.id))
      dibujo.figuras = a === 'frente' ? [...resto, ...sel] : [...sel, ...resto]
      redibujar()
    }
    function mover(dx: number, dy: number) {
      dibujo.figuras.filter((f) => elegidos.includes(f.id)).forEach((f) => {
        f.x += dx
        f.y += dy
      })
    }

    // ---------- Dibujo en pantalla
    function redibujar() {
      capaFiguras.replaceChildren()
      for (const f of dibujo.figuras) {
        const e = figuraSvg(f)
        e.dataset.id = f.id
        // Para elegir líneas finas sin puntería perfecta: una línea invisible más gruesa debajo.
        if (f.tipo === 'linea' || f.tipo === 'trazo' || f.relleno === 'none') {
          const g = svgEl('g', {})
          const ayuda = e.cloneNode() as SVGElement
          ayuda.setAttribute('stroke', 'transparent')
          ayuda.setAttribute('fill', 'none')
          ayuda.setAttribute('stroke-width', String(Math.max(16, f.grosor + 10)))
          ayuda.dataset.id = f.id
          g.append(ayuda, e)
          capaFiguras.append(g)
        } else capaFiguras.append(e)
      }
      capaGuia.replaceChildren()
      for (const f of elegidas()) {
        const c = caja(f)
        const m = 6
        capaGuia.append(
          svgEl('rect', { x: c.x - m, y: c.y - m, width: c.w + 2 * m, height: c.h + 2 * m, fill: 'none', stroke: '#1e88e5', 'stroke-width': 1.5, 'stroke-dasharray': '6 4', 'pointer-events': 'none' }),
        )
        if (elegidos.length === 1) {
          // Manijas: esquinas para agrandar.
          const esquinas: [number, number, string][] =
            f.tipo === 'linea'
              ? [
                  [f.x, f.y, 'a'],
                  [f.x + f.w, f.y + f.h, 'b'],
                ]
              : [
                  [c.x - m, c.y - m, 'nw'],
                  [c.x + c.w + m, c.y - m, 'ne'],
                  [c.x - m, c.y + c.h + m, 'sw'],
                  [c.x + c.w + m, c.y + c.h + m, 'se'],
                ]
          for (const [x, y, n] of esquinas) {
            const h = svgEl('rect', { x: x - 7, y: y - 7, width: 14, height: 14, fill: '#fff', stroke: '#1e88e5', 'stroke-width': 2, class: 'manija ' + n })
            h.dataset.manija = n
            capaGuia.append(h)
          }
        }
      }
      ponerEstado()
    }

    function ponerEstado() {
      const n = elegidos.length
      const h = HERRAMIENTAS.find((x) => x.id === herramienta)!
      estado.textContent =
        n === 1
          ? `Elegiste 1 figura. Arrastrala para moverla, o tirá de los cuadraditos para agrandarla. Supr la borra.`
          : n > 1
            ? `Elegiste ${n} figuras.`
            : herramienta === 'elegir'
              ? 'Hacé clic en una figura para elegirla. Arrastrando sobre el fondo elegís varias.'
              : herramienta === 'texto'
                ? 'Hacé clic donde quieras escribir.'
                : `${h.nombre}: apretá y arrastrá. Con Shift sale ${herramienta === 'elipse' ? 'redondo' : herramienta === 'linea' ? 'derecha' : 'cuadrado'}.`
    }

    function ponerTitulo() {
      v.ponerTitulo(`${cambios ? '● ' : ''}${archivo?.nombre ?? 'Sin nombre'} — Trazos`)
    }

    // ---------- Mouse sobre el lienzo
    const punto = (e: PointerEvent): [number, number] => {
      const p = lienzo.createSVGPoint()
      p.x = e.clientX
      p.y = e.clientY
      const q = p.matrixTransform(lienzo.getScreenCTM()!.inverse())
      return [Math.round(q.x), Math.round(q.y)]
    }

    lienzo.addEventListener('contextmenu', (e) => e.preventDefault())
    lienzo.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return
      const [x0, y0] = punto(e)
      const objetivo = e.target as SVGElement
      lienzo.setPointerCapture(e.pointerId)
      let alSoltar: (() => void) | null = null
      let alMover: ((x: number, y: number, ev: PointerEvent) => void) | null = null

      if (herramienta === 'elegir') {
        const manija = objetivo.dataset.manija
        const id = objetivo.closest('[data-id]')?.getAttribute('data-id') ?? (objetivo.dataset.id || null)
        if (manija && elegidos.length === 1) {
          // Agrandar desde una esquina.
          guardarPaso()
          hizo('agrandar')
          const f = elegidas()[0]
          const orig = { ...f, pts: f.pts }
          const c0 = caja(orig)
          alMover = (x, y, ev) => {
            if (f.tipo === 'linea') {
              if (manija === 'a') {
                f.x = x
                f.y = y
                f.w = orig.x + orig.w - x
                f.h = orig.y + orig.h - y
              } else {
                f.w = x - orig.x
                f.h = y - orig.y
              }
              return
            }
            // La esquina opuesta queda fija.
            const fx = manija.includes('w') ? c0.x + c0.w : c0.x
            const fy = manija.includes('n') ? c0.y + c0.h : c0.y
            let w = x - fx
            let h = y - fy
            if (ev.shiftKey || f.tipo === 'texto') {
              // Mantiene la forma (el texto siempre, para que no se deforme).
              const k = Math.max(Math.abs(w) / (c0.w || 1), Math.abs(h) / (c0.h || 1))
              w = Math.sign(w || 1) * c0.w * k
              h = Math.sign(h || 1) * c0.h * k
            }
            // Las figuras se guardan normalizadas, salvo el trazo (sus puntos se espejan).
            f.x = fx + Math.min(0, w)
            f.y = fy + Math.min(0, h)
            f.w = Math.max(2, Math.abs(w))
            f.h = Math.max(2, Math.abs(h))
            if (f.tipo === 'trazo' && orig.pts) {
              const espejoX = (w < 0) !== manija.includes('w')
              const espejoY = (h < 0) !== manija.includes('n')
              f.pts = orig.pts.map(([u, v]) => [espejoX ? 1 - u : u, espejoY ? 1 - v : v])
            }
          }
        } else if (id) {
          // Elegir (con Shift suma o saca) y mover.
          if (e.shiftKey) elegidos = elegidos.includes(id) ? elegidos.filter((x) => x !== id) : [...elegidos, id]
          else if (!elegidos.includes(id)) elegidos = [id]
          redibujar()
          let movio = false
          let ux = x0
          let uy = y0
          alMover = (x, y) => {
            if (!movio) {
              if (Math.hypot(x - x0, y - y0) < 3) return
              guardarPaso()
              movio = true
            }
            mover(x - ux, y - uy)
            hizo('mover')
            ux = x
            uy = y
          }
        } else {
          // Recuadro de selección sobre el fondo.
          if (!e.shiftKey) elegidos = []
          const marco = svgEl('rect', { fill: 'rgba(30,136,229,.08)', stroke: '#1e88e5', 'stroke-dasharray': '4 3', 'pointer-events': 'none' })
          capaGuia.append(marco)
          let x1 = x0
          let y1 = y0
          alMover = (x, y) => {
            x1 = x
            y1 = y
            marco.setAttribute('x', String(Math.min(x0, x)))
            marco.setAttribute('y', String(Math.min(y0, y)))
            marco.setAttribute('width', String(Math.abs(x - x0)))
            marco.setAttribute('height', String(Math.abs(y - y0)))
          }
          alSoltar = () => {
            const r = { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) }
            if (r.w > 3 || r.h > 3) {
              const dentro = dibujo.figuras.filter((f) => {
                const c = caja(f)
                return c.x >= r.x && c.y >= r.y && c.x + c.w <= r.x + r.w && c.y + c.h <= r.y + r.h
              })
              elegidos = [...new Set([...elegidos, ...dentro.map((f) => f.id)])]
            }
          }
        }
      } else if (herramienta === 'texto') {
        escribirTexto(x0, y0)
        return
      } else {
        // Figura nueva.
        guardarPaso()
        const f: Figura = { id: fs.nuevoId(), tipo: herramienta, x: x0, y: y0, w: 0, h: 0, relleno, borde, grosor }
        if (herramienta === 'trazo') {
          f.relleno = 'none'
          if (borde === 'none') f.borde = relleno === 'none' ? '#000' : relleno
        }
        if (herramienta === 'linea' && borde === 'none') f.borde = relleno === 'none' ? '#000' : relleno
        const crudos: [number, number][] = [[x0, y0]]
        dibujo.figuras.push(f)
        alMover = (x, y, ev) => {
          if (f.tipo === 'trazo') {
            crudos.push([x, y])
            const xs = crudos.map((p) => p[0])
            const ys = crudos.map((p) => p[1])
            f.x = Math.min(...xs)
            f.y = Math.min(...ys)
            f.w = Math.max(1, Math.max(...xs) - f.x)
            f.h = Math.max(1, Math.max(...ys) - f.y)
            f.pts = crudos.map(([px, py]) => [(px - f.x) / f.w, (py - f.y) / f.h])
            return
          }
          let w = x - x0
          let h = y - y0
          if (ev.shiftKey) {
            if (f.tipo === 'linea') {
              // Horizontal, vertical o a 45°.
              const ang = Math.round(Math.atan2(h, w) / (Math.PI / 4)) * (Math.PI / 4)
              const l = Math.hypot(w, h)
              w = Math.round(Math.cos(ang) * l)
              h = Math.round(Math.sin(ang) * l)
            } else {
              const l = Math.max(Math.abs(w), Math.abs(h))
              w = Math.sign(w || 1) * l
              h = Math.sign(h || 1) * l
            }
          }
          f.w = w
          f.h = h
        }
        alSoltar = () => {
          const c = caja(f)
          if (c.w < 3 && c.h < 3 && f.tipo !== 'trazo') {
            // Fue un clic suelto: no queda una figura invisible.
            dibujo.figuras.pop()
            atras.pop()
          } else if (f.tipo !== 'linea' && f.tipo !== 'trazo') {
            f.x = c.x
            f.y = c.y
            f.w = c.w
            f.h = c.h
          }
        }
      }

      lienzo.onpointermove = (m) => {
        const [x, y] = punto(m)
        alMover?.(x, y, m)
        redibujar()
      }
      lienzo.onpointerup = () => {
        lienzo.onpointermove = null
        lienzo.onpointerup = null
        alSoltar?.()
        redibujar()
      }
    })

    // Doble clic en un texto para cambiarlo.
    lienzo.addEventListener('dblclick', (e) => {
      const id = (e.target as SVGElement).dataset.id
      const f = dibujo.figuras.find((x) => x.id === id)
      if (f?.tipo === 'texto') escribirTexto(f.x, f.y, f)
    })

    function escribirTexto(x: number, y: number, existente?: Figura) {
      // Del dibujo a la pantalla (el lienzo puede estar achicado y centrado).
      const m = lienzo.getScreenCTM()!
      const k = m.a
      const z = zona.getBoundingClientRect()
      const tam = existente ? existente.h : 48
      const input = el('input', 'trazos-texto')
      input.value = existente?.texto ?? ''
      input.style.left = m.e + x * k - z.left + zona.scrollLeft + 'px'
      input.style.top = m.f + y * k - z.top + zona.scrollTop + 'px'
      input.style.fontSize = tam * k + 'px'
      input.style.color = relleno === 'none' ? borde : relleno
      zona.append(input)
      input.focus()
      let listo = false
      const terminar = (ok: boolean) => {
        if (listo) return
        listo = true
        const t = input.value.trim()
        input.remove()
        if (!ok) return
        if (existente) {
          if (t === existente.texto) return
          guardarPaso()
          if (!t) dibujo.figuras = dibujo.figuras.filter((f) => f !== existente)
          else {
            existente.w = existente.w * (t.length / Math.max(1, existente.texto!.length))
            existente.texto = t
          }
        } else if (t) {
          guardarPaso()
          const f: Figura = { id: fs.nuevoId(), tipo: 'texto', texto: t, x, y, w: t.length * tam * 0.58, h: tam, relleno: relleno === 'none' ? borde : relleno, borde: 'none', grosor: 0 }
          dibujo.figuras.push(f)
          elegidos = [f.id]
          ponerHerramienta('elegir')
        }
        redibujar()
      }
      input.onkeydown = (e) => {
        e.stopPropagation()
        if (e.key === 'Enter') terminar(true)
        if (e.key === 'Escape') terminar(false)
      }
      input.onblur = () => terminar(true)
    }

    // ---------- Archivo
    function imprimirEsto() {
      imprimir({ titulo: archivo?.nombre ?? 'Sin nombre', paginas: [{ tipo: 'imagen', contenido: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(aSvgTexto(dibujo)) }], horizontal: true })
    }

    async function guardar(como = false): Promise<boolean> {
      let nombre = archivo?.nombre
      if (!archivo || como) {
        const sugerido = archivo ? archivo.nombre + ' (copia)' : fs.nombreLibre('Dibujo', 'trazos')
        const n = await pedirNombre('trazos', sugerido, '¿Cómo se va a llamar tu dibujo?')
        if (!n) return false
        nombre = n
        archivo = null // con "Guardar como" queda un archivo nuevo
      }
      archivo = fs.guardar({ id: archivo?.id ?? fs.nuevoId(), nombre: nombre!, app: 'trazos', miniatura: aSvgTexto(dibujo) }, dibujo)
      cambios = false
      ponerTitulo()
      return true
    }

    /** Si hay cambios sin guardar, pregunta. false = la nena canceló. */
    async function puedeSeguir(): Promise<boolean> {
      if (!cambios) return true
      const r = await preguntarSiGuarda('Trazos', archivo?.nombre ?? 'Sin nombre')
      if (r === 'cancelar') return false
      if (r === 'si') return guardar()
      return true
    }

    function cargar(id: string) {
      const a = fs.buscar(id)
      const d = fs.leer(id) as Dibujo | null
      if (!a || !d) return
      archivo = a
      dibujo = { figuras: d.figuras ?? [] }
      atras.length = 0
      adelante.length = 0
      elegidos = []
      cambios = false
      ponerTitulo()
      redibujar()
    }

    async function nuevo() {
      if (!(await puedeSeguir())) return
      archivo = null
      dibujo = { figuras: [] }
      atras.length = 0
      adelante.length = 0
      elegidos = []
      cambios = false
      ponerTitulo()
      redibujar()
    }

    async function abrirOtro() {
      if (!(await puedeSeguir())) return
      const id = await elegirArchivo('trazos', 'Abrir un dibujo')
      if (id) cargar(id)
    }

    async function cerrarVentana() {
      if (await puedeSeguir()) v.cerrar()
    }

    // ---------- Arranque
    dibujarHerramientas()
    dibujarPaleta()
    ponerHerramienta('rect')
    if (archivoId) cargar(archivoId)
    ponerTitulo()

    return {
      alTecla(e) {
        const ctrl = e.ctrlKey || e.metaKey
        const k = e.key.toLowerCase()
        if (ctrl) {
          if (k === 'z') deshacer()
          else if (k === 'y') rehacer()
          else if (k === 's') guardar()
          else if (k === 'p') imprimirEsto()
          else if (k === 'o') abrirOtro()
          else if (k === 'n') nuevo()
          else if (k === 'c') copiar()
          else if (k === 'x') cortar()
          else if (k === 'v') pegar()
          else if (k === 'd') duplicar()
          else if (k === 'a') elegirTodo()
          else if (e.key === 'Home') ordenar('frente')
          else if (e.key === 'End') ordenar('fondo')
          else return false
          return true
        }
        if (e.key === 'Delete' || e.key === 'Backspace') borrarElegidos()
        else if (e.key === 'Escape') {
          elegidos = []
          redibujar()
        } else if (e.key.startsWith('Arrow') && elegidos.length) {
          // Flechas: mover de a poquito (con Shift, más).
          const p = e.shiftKey ? 10 : 1
          guardarPaso()
          mover(e.key === 'ArrowLeft' ? -p : e.key === 'ArrowRight' ? p : 0, e.key === 'ArrowUp' ? -p : e.key === 'ArrowDown' ? p : 0)
          redibujar()
        } else {
          const h = HERRAMIENTAS.find((x) => x.tecla.toLowerCase() === k)
          if (!h) return false
          ponerHerramienta(h.id)
        }
        return true
      },
      alCerrar: puedeSeguir,
      // Para el guía de las misiones.
      api: {
        hizo: (a: string) => hechas.has(a),
        cuantas: (tipo?: string) => dibujo.figuras.filter((f) => !tipo || f.tipo === tipo).length,
        rellenos: () => new Set(dibujo.figuras.map((f) => f.relleno)).size,
        elegidas: () => elegidos.length,
        cargar: () => {
          dibujo = { figuras: [] }
          archivo = null
          cambios = false
          atras.length = 0
          adelante.length = 0
          elegidos = []
          hechas.clear()
          ponerTitulo()
          redibujar()
        },
        guardarComo: (n0: string) => {
          let n = n0
          for (let i = 2; fs.existeNombre(n, 'trazos'); i++) n = `${n0} ${i}`
          archivo = fs.guardar({ id: fs.nuevoId(), nombre: n, app: 'trazos', miniatura: aSvgTexto(dibujo) }, dibujo)
          cambios = false
          ponerTitulo()
          return n
        },
      },
    }
  },
}
