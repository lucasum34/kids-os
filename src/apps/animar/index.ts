// Animar: animación con cuadros clave, la idea de After Effects en chiquito.
// Enseña: composición, capas, propiedades de transformación (Posición, Escala,
// Rotación, Opacidad), el cronómetro que prende los cuadros clave, que entre dos
// cuadros clave el programa calcula el medio, suavizar (F9), la trayectoria,
// efectos preestablecidos, y exportar el video.

import * as fs from '../../os/archivos'
import { pedirNombre, preguntarSiGuarda } from '../../os/documento'
import { cargarImagen, imagenDeMisCosas, PROGRAMAS_CON_IMAGEN } from '../../os/imagenes'
import { elegirArchivo } from '../../os/selector'
import { aviso, barraMenu, dialogo, el } from '../../os/ui'
import type { Programa } from '../../os/ventanas'

const AN = 960
const AL = 540
const FPS = 30

type Prop = 'pos' | 'escala' | 'rot' | 'opac'
const PROPS: { id: Prop; nombre: string; tecla: string; unidad: string }[] = [
  { id: 'pos', nombre: 'Posición', tecla: 'P', unidad: '' },
  { id: 'escala', nombre: 'Escala', tecla: 'S', unidad: '%' },
  { id: 'rot', nombre: 'Rotación', tecla: 'R', unidad: '°' },
  { id: 'opac', nombre: 'Opacidad', tecla: 'T', unidad: '%' },
]
type Valor = number | [number, number]
interface Clave {
  t: number
  v: Valor
  suave: boolean
}
interface Capa {
  id: string
  nombre: string
  tipo: 'texto' | 'rect' | 'elipse' | 'estrella' | 'imagen'
  texto?: string
  color: string
  w: number
  h: number
  archivoId?: string
  visible: boolean
  base: { pos: [number, number]; escala: number; rot: number; opac: number }
  claves: Record<Prop, Clave[]>
  abierta: boolean
}
interface Comp {
  dur: number
  fondo: string
  capas: Capa[] // la primera es la de más arriba, como en After Effects
}

const COLORES = ['#ffffff', '#000000', '#e53935', '#fb8c00', '#fdd835', '#43a047', '#00acc1', '#1e88e5', '#8e24aa', '#ec407a']
const FONDOS = ['#1a1a2e', '#000000', '#ffffff', '#87ceeb', '#ffe0b2', '#c8e6c9']

const suavizado = (u: number) => u * u * (3 - 2 * u)

function valorEn(c: Capa, p: Prop, t: number): Valor {
  const ks = c.claves[p]
  if (!ks.length) return c.base[p]
  if (t <= ks[0].t) return ks[0].v
  const ult = ks[ks.length - 1]
  if (t >= ult.t) return ult.v
  let i = 0
  while (ks[i + 1].t < t) i++
  const a = ks[i]
  const b = ks[i + 1]
  let u = (t - a.t) / (b.t - a.t || 1)
  if (a.suave || b.suave) u = suavizado(u)
  if (Array.isArray(a.v) && Array.isArray(b.v)) return [a.v[0] + (b.v[0] - a.v[0]) * u, a.v[1] + (b.v[1] - a.v[1]) * u]
  return (a.v as number) + ((b.v as number) - (a.v as number)) * u
}

function estrella(g: CanvasRenderingContext2D, w: number, h: number) {
  g.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const r = i % 2 ? 0.4 : 1
    g.lineTo((Math.cos(a) * r * w) / 2, (Math.sin(a) * r * h) / 2)
  }
  g.closePath()
}

const nuevaCapa = (o: Partial<Capa> & Pick<Capa, 'tipo' | 'nombre' | 'w' | 'h'>): Capa => ({
  id: fs.nuevoId(),
  color: '#fdd835',
  visible: true,
  base: { pos: [AN / 2, AL / 2], escala: 100, rot: 0, opac: 100 },
  claves: { pos: [], escala: [], rot: [], opac: [] },
  abierta: true,
  ...o,
})

export const animar: Programa = {
  id: 'animar',
  nombre: 'Animar',
  icono: '✨',
  ancho: 1220,
  alto: 780,
  abrir(win, archivoId) {
    let comp: Comp = { dur: 5, fondo: '#1a1a2e', capas: [] }
    let t = 0
    let elegida: string | null = null
    let claveElegida: { capa: string; prop: Prop; i: number } | null = null
    let reproduciendo = false
    let archivo: fs.Archivo | null = null
    let cambios = false
    const atras: string[] = []
    const adelante: string[] = []
    const imagenes = new Map<string, HTMLImageElement>()
    let exportando = false

    const capa = () => comp.capas.find((c) => c.id === elegida) ?? null

    // ---------- Armado
    const raiz = el('div', 'animar')
    const menu = barraMenu([
      {
        titulo: 'Archivo',
        items: [
          { texto: 'Animación nueva', atajo: 'Ctrl+N', accion: () => nueva() },
          { texto: 'Abrir…', atajo: 'Ctrl+O', accion: () => abrirOtro() },
          '-',
          { texto: 'Guardar', atajo: 'Ctrl+S', accion: () => guardar() },
          { texto: 'Guardar como…', accion: () => guardar(true) },
          '-',
          { texto: 'Exportar video…', atajo: 'Ctrl+M', accion: () => exportar() },
          '-',
          { texto: 'Cerrar', accion: async () => (await puedeSeguir()) && win.cerrar() },
        ],
      },
      {
        titulo: 'Edición',
        items: [
          { texto: 'Deshacer', atajo: 'Ctrl+Z', accion: () => deshacer(), activo: () => atras.length > 0 },
          { texto: 'Rehacer', atajo: 'Ctrl+Y', accion: () => rehacer(), activo: () => adelante.length > 0 },
          '-',
          { texto: 'Duplicar capa', atajo: 'Ctrl+D', accion: () => duplicarCapa(), activo: () => !!elegida },
          { texto: 'Borrar', atajo: 'Supr', accion: () => borrar(), activo: () => !!elegida || !!claveElegida },
        ],
      },
      {
        titulo: 'Composición',
        items: [
          { texto: 'Duración…', accion: () => cambiarDuracion() },
          ...FONDOS.map((f, i) => ({ texto: 'Fondo ' + ['azul noche', 'negro', 'blanco', 'cielo', 'durazno', 'verde'][i], accion: () => cambiarFondo(f) })),
        ],
      },
      {
        titulo: 'Capa',
        items: [
          { texto: 'Nueva: Texto…', atajo: 'Ctrl+T', accion: () => capaTexto() },
          { texto: 'Nueva: Rectángulo', accion: () => agregarCapa(nuevaCapa({ tipo: 'rect', nombre: 'Rectángulo', w: 200, h: 140, color: '#42a5f5' })) },
          { texto: 'Nueva: Círculo', accion: () => agregarCapa(nuevaCapa({ tipo: 'elipse', nombre: 'Círculo', w: 160, h: 160, color: '#ec407a' })) },
          { texto: 'Nueva: Estrella', accion: () => agregarCapa(nuevaCapa({ tipo: 'estrella', nombre: 'Estrella', w: 180, h: 180, color: '#fdd835' })) },
          { texto: 'Nueva: Imagen de Mis cosas…', accion: () => capaImagen() },
          '-',
          { texto: 'Suavizar cuadros clave (Easy Ease)', atajo: 'F9', accion: () => suavizarElegida() },
        ],
      },
    ])
    const arriba = el('div', 'an-arriba')
    const visor = el('div', 'an-visor')
    const lienzo = document.createElement('canvas')
    lienzo.width = AN
    lienzo.height = AL
    lienzo.className = 'an-lienzo'
    visor.append(lienzo)
    const lado = el('div', 'an-lado')
    arriba.append(visor, lado)
    const linea = el('div', 'an-linea')
    const controles = el('div', 'an-controles')
    const tabla = el('div', 'an-tabla')
    linea.append(controles, tabla)
    const estado = el('div', 'barra-estado')
    raiz.append(menu, arriba, linea, estado)
    win.cuerpo.append(raiz)

    // ---------- Historia
    function guardarPaso() {
      atras.push(JSON.stringify(comp))
      if (atras.length > 150) atras.shift()
      adelante.length = 0
      if (!cambios) {
        cambios = true
        ponerTitulo()
      }
    }
    function deshacer() {
      const p = atras.pop()
      if (p === undefined) return
      adelante.push(JSON.stringify(comp))
      comp = JSON.parse(p)
      claveElegida = null
      todo()
    }
    function rehacer() {
      const p = adelante.pop()
      if (p === undefined) return
      atras.push(JSON.stringify(comp))
      comp = JSON.parse(p)
      todo()
    }

    // ---------- Dibujar un cuadro
    function dibujarCapa(g: CanvasRenderingContext2D, c: Capa, s: number) {
      if (!c.visible) return
      const [x, y] = valorEn(c, 'pos', s) as [number, number]
      const e = (valorEn(c, 'escala', s) as number) / 100
      const r = valorEn(c, 'rot', s) as number
      const o = (valorEn(c, 'opac', s) as number) / 100
      g.save()
      g.translate(x, y)
      g.rotate((r * Math.PI) / 180)
      g.scale(e, e)
      g.globalAlpha = Math.max(0, Math.min(1, o))
      g.fillStyle = c.color
      if (c.tipo === 'rect') {
        g.beginPath()
        g.roundRect(-c.w / 2, -c.h / 2, c.w, c.h, 14)
        g.fill()
      } else if (c.tipo === 'elipse') {
        g.beginPath()
        g.ellipse(0, 0, c.w / 2, c.h / 2, 0, 0, Math.PI * 2)
        g.fill()
      } else if (c.tipo === 'estrella') {
        estrella(g, c.w, c.h)
        g.fill()
      } else if (c.tipo === 'texto') {
        g.font = `800 ${c.h}px Nunito, Arial, sans-serif`
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.fillText(c.texto ?? '', 0, 0)
      } else if (c.tipo === 'imagen') {
        const img = imagenes.get(c.archivoId ?? '')
        if (img) g.drawImage(img, -c.w / 2, -c.h / 2, c.w, c.h)
      }
      g.restore()
    }

    function dibujarCuadro(conGuias = true) {
      const g = lienzo.getContext('2d')!
      g.fillStyle = comp.fondo
      g.fillRect(0, 0, AN, AL)
      // De abajo hacia arriba: la última de la lista queda al fondo.
      for (let i = comp.capas.length - 1; i >= 0; i--) dibujarCapa(g, comp.capas[i], t)
      const c = capa()
      if (conGuias && c && !reproduciendo) {
        // Trayectoria: por dónde pasa la capa (si tiene la posición animada).
        if (c.claves.pos.length > 1) {
          g.save()
          g.fillStyle = '#ffb300'
          for (let s = 0; s <= comp.dur; s += 1 / FPS) {
            const [x, y] = valorEn(c, 'pos', s) as [number, number]
            g.fillRect(x - 1.5, y - 1.5, 3, 3)
          }
          for (const k of c.claves.pos) {
            const [x, y] = k.v as [number, number]
            g.strokeStyle = '#ffb300'
            g.lineWidth = 2
            g.strokeRect(x - 6, y - 6, 12, 12)
          }
          g.restore()
        }
        // Recuadro de la capa elegida.
        const [x, y] = valorEn(c, 'pos', t) as [number, number]
        const e = (valorEn(c, 'escala', t) as number) / 100
        const r = valorEn(c, 'rot', t) as number
        const [w, h] = medida(c)
        g.save()
        g.translate(x, y)
        g.rotate((r * Math.PI) / 180)
        g.strokeStyle = '#4fc3f7'
        g.lineWidth = 2
        g.setLineDash([6, 4])
        g.strokeRect((-w / 2) * e, (-h / 2) * e, w * e, h * e)
        g.setLineDash([])
        g.fillStyle = '#4fc3f7'
        g.fillRect(-4, -4, 8, 8)
        g.restore()
      }
      pintarCabezal()
    }

    /** Tamaño de la capa sin escalar (el texto se mide). */
    function medida(c: Capa): [number, number] {
      if (c.tipo !== 'texto') return [c.w, c.h]
      const g = lienzo.getContext('2d')!
      g.font = `800 ${c.h}px Nunito, Arial, sans-serif`
      return [g.measureText(c.texto ?? '').width + 10, c.h * 1.1]
    }

    // ---------- Cuadros clave
    /** Cambia una propiedad: si tiene el cronómetro prendido, pone (o corrige) un cuadro clave acá. */
    function poner(c: Capa, p: Prop, v: Valor) {
      const ks = c.claves[p]
      if (!ks.length) {
        c.base[p] = v as never
        return
      }
      const i = ks.findIndex((k) => Math.abs(k.t - t) < 0.5 / FPS)
      if (i >= 0) ks[i].v = v
      else {
        ks.push({ t: Math.round(t * FPS) / FPS, v, suave: false })
        ks.sort((a, b) => a.t - b.t)
      }
    }
    function cronometro(c: Capa, p: Prop) {
      guardarPaso()
      const ks = c.claves[p]
      if (ks.length) {
        // Apagar: se borran los cuadros clave y queda el valor de este momento.
        c.base[p] = valorEn(c, p, t) as never
        c.claves[p] = []
      } else ks.push({ t: Math.round(t * FPS) / FPS, v: JSON.parse(JSON.stringify(c.base[p])), suave: false })
      todo()
    }
    function suavizarElegida() {
      if (claveElegida) {
        const c = comp.capas.find((x) => x.id === claveElegida!.capa)
        const k = c?.claves[claveElegida.prop][claveElegida.i]
        if (!k) return
        guardarPaso()
        k.suave = !k.suave
      } else {
        const c = capa()
        if (!c) return
        guardarPaso()
        const todas = PROPS.flatMap((p) => c.claves[p.id])
        const prender = !todas.every((k) => k.suave)
        todas.forEach((k) => (k.suave = prender))
      }
      todo()
    }

    // ---------- Efectos preestablecidos (como "Animation Presets")
    const PRESETS: { nombre: string; icono: string; hacer: (c: Capa) => void }[] = [
      {
        nombre: 'Entrar desde la izquierda',
        icono: '➡️',
        hacer: (c) => {
          const [x, y] = c.base.pos
          c.claves.pos = [{ t: 0, v: [-200, y], suave: true }, { t: 1, v: [x, y], suave: true }]
        },
      },
      {
        nombre: 'Caer y rebotar',
        icono: '⛹️',
        hacer: (c) => {
          const [x, y] = c.base.pos
          c.claves.pos = [
            { t: 0, v: [x, -150], suave: false },
            { t: 0.7, v: [x, y], suave: false },
            { t: 1, v: [x, y - 90], suave: true },
            { t: 1.3, v: [x, y], suave: false },
            { t: 1.5, v: [x, y - 30], suave: true },
            { t: 1.7, v: [x, y], suave: false },
          ]
        },
      },
      {
        nombre: 'Aparecer con zoom',
        icono: '🔍',
        hacer: (c) => {
          c.claves.escala = [{ t: 0, v: 0, suave: true }, { t: 0.6, v: 120, suave: true }, { t: 0.9, v: 100, suave: true }]
          c.claves.opac = [{ t: 0, v: 0, suave: false }, { t: 0.4, v: 100, suave: false }]
        },
      },
      {
        nombre: 'Dar vueltas',
        icono: '🌀',
        hacer: (c) => {
          c.claves.rot = [{ t: 0, v: 0, suave: false }, { t: comp.dur, v: 360 * Math.max(1, Math.round(comp.dur / 2)), suave: false }]
        },
      },
      {
        nombre: 'Latido',
        icono: '💓',
        hacer: (c) => {
          c.claves.escala = []
          for (let s = 0; s <= comp.dur + 0.01; s += 0.5) c.claves.escala.push({ t: Math.round(s * 10) / 10, v: Math.round(s * 2) % 2 ? 120 : 100, suave: true })
        },
      },
      {
        nombre: 'Aparecer de a poco',
        icono: '🌅',
        hacer: (c) => {
          c.claves.opac = [{ t: 0, v: 0, suave: true }, { t: 1.2, v: 100, suave: true }]
        },
      },
      {
        nombre: 'Irse por la derecha',
        icono: '💨',
        hacer: (c) => {
          const [x, y] = valorEn(c, 'pos', Math.max(0, comp.dur - 1)) as [number, number]
          c.claves.pos = [...c.claves.pos.filter((k) => k.t < comp.dur - 1), { t: comp.dur - 1, v: [x, y], suave: true }, { t: comp.dur, v: [AN + 250, y], suave: true }]
        },
      },
    ]

    function dibujarLado() {
      lado.replaceChildren(el('div', 'an-lado-titulo', 'Efectos listos'))
      const c = capa()
      for (const p of PRESETS) {
        const b = el('button', 'an-preset')
        b.append(el('span', 'an-preset-icono', p.icono), el('span', '', p.nombre))
        b.disabled = !c
        b.onclick = () => {
          if (!c) return
          guardarPaso()
          p.hacer(c)
          todo()
        }
        lado.append(b)
      }
      lado.append(el('div', 'an-pista', c ? 'Se aplican a la capa elegida. Después podés cambiar los cuadros clave.' : 'Elegí una capa para usarlos.'))
      if (c) {
        lado.append(el('div', 'an-lado-titulo', 'Color'))
        const cols = el('div', 'an-colores')
        for (const col of COLORES) {
          const m = el('span', 'cd-color')
          m.style.background = col
          m.onclick = () => {
            guardarPaso()
            c.color = col
            todo()
          }
          cols.append(m)
        }
        lado.append(cols)
      }
    }

    // ---------- Línea de tiempo
    const ANCHO_IZQ = 330
    let pps = 100
    function dibujarControles() {
      controles.replaceChildren()
      const b = (txt: string, titulo: string, f: () => void) => {
        const x = el('button', 'pl-boton', txt)
        x.title = titulo
        x.onclick = f
        controles.append(x)
        return x
      }
      b('⏮', 'Al principio (Inicio)', () => irA(0))
      b(reproduciendo ? '⏸' : '▶', 'Reproducir (Espacio)', () => play())
      controles.append(el('span', 'pl-tiempo an-reloj', `${t.toFixed(2)} s`))
      controles.append(el('span', 'an-esp'))
      b('+ Texto', 'Capa de texto nueva', () => capaTexto())
      b('+ Forma', 'Capa de forma nueva', () => agregarCapa(nuevaCapa({ tipo: 'estrella', nombre: 'Estrella', w: 180, h: 180 })))
      b('+ Imagen', 'Imagen de Mis cosas', () => capaImagen())
      b('F9 Suavizar', 'Suavizar los cuadros clave elegidos', () => suavizarElegida())
    }

    function dibujarTabla() {
      tabla.replaceChildren()
      const ancho = Math.max(200, tabla.clientWidth - ANCHO_IZQ - 16)
      pps = ancho / comp.dur
      // Regla de tiempo.
      const filaRegla = el('div', 'an-fila an-fila-regla')
      const cabeza = el('div', 'an-izq', 'Capas')
      const regla = el('div', 'an-der an-regla')
      for (let s = 0; s <= comp.dur; s += comp.dur > 10 ? 2 : comp.dur > 5 ? 1 : 0.5) {
        const m = el('span', 'an-marca', s % 1 ? '' : s + 's')
        m.style.left = s * pps + 'px'
        regla.append(m)
      }
      regla.onpointerdown = (e) => arrastrarTiempo(e, regla)
      filaRegla.append(cabeza, regla)
      tabla.append(filaRegla)

      comp.capas.forEach((c, i) => {
        const fila = el('div', 'an-fila capa' + (c.id === elegida ? ' elegida' : ''))
        const izq = el('div', 'an-izq')
        const flecha = el('button', 'an-flecha', c.abierta ? '▾' : '▸')
        flecha.onclick = () => {
          c.abierta = !c.abierta
          dibujarTabla()
        }
        const ojo = el('button', 'an-ojo', c.visible ? '👁' : '·')
        ojo.onclick = () => {
          guardarPaso()
          c.visible = !c.visible
          todo()
        }
        const nom = el('span', 'an-nombre', `${i + 1}  ${c.nombre}`)
        izq.append(flecha, ojo, nom)
        izq.onclick = (e) => {
          if (e.target === flecha || e.target === ojo) return
          elegida = c.id
          claveElegida = null
          todo()
        }
        const der = el('div', 'an-der barra-capa')
        der.onpointerdown = (e) => arrastrarTiempo(e, der)
        fila.append(izq, der)
        tabla.append(fila)
        if (!c.abierta) return
        for (const p of PROPS) {
          const f = el('div', 'an-fila prop')
          const pi = el('div', 'an-izq')
          const crono = el('button', 'an-crono' + (c.claves[p.id].length ? ' activo' : ''), '⏱')
          crono.title = 'Cronómetro: prende los cuadros clave de esta propiedad'
          crono.onclick = () => cronometro(c, p.id)
          pi.append(crono, el('span', 'an-prop', p.nombre))
          const v = valorEn(c, p.id, t)
          const valores = Array.isArray(v) ? v : [v]
          valores.forEach((x, j) => pi.append(numero(c, p.id, j, x, p.unidad)))
          const pd = el('div', 'an-der')
          c.claves[p.id].forEach((k, ki) => {
            const d = el('div', 'an-clave' + (k.suave ? ' suave' : '') + (claveElegida?.capa === c.id && claveElegida.prop === p.id && claveElegida.i === ki ? ' elegida' : ''))
            d.style.left = k.t * pps + 'px'
            d.title = `${k.t.toFixed(2)} s${k.suave ? ' · suavizado' : ''} — arrastralo para moverlo`
            d.onpointerdown = (e) => arrastrarClave(e, c, p.id, ki, d)
            pd.append(d)
          })
          pd.onpointerdown = (e) => arrastrarTiempo(e, pd)
          f.append(pi, pd)
          tabla.append(f)
        }
      })
      if (!comp.capas.length) tabla.append(el('div', 'an-vacio', 'Agregá una capa: + Texto, + Forma o + Imagen.'))
      const cab = el('div', 'an-cabezal')
      tabla.append(cab)
      pintarCabezal()
    }

    function pintarCabezal() {
      const cab = tabla.querySelector('.an-cabezal') as HTMLElement | null
      if (cab) cab.style.left = ANCHO_IZQ + t * pps + 'px'
      const r = controles.querySelector('.an-reloj')
      if (r) r.textContent = `${t.toFixed(2)} s`
    }

    /** Número que se cambia arrastrando hacia los costados (o con clic para escribirlo), como en After Effects. */
    function numero(c: Capa, p: Prop, j: number, valor: number, unidad: string) {
      const n = el('span', 'an-num', Math.round(valor) + unidad)
      n.title = 'Arrastrá a los costados para cambiarlo, o hacé clic para escribirlo'
      n.onpointerdown = (e) => {
        e.preventDefault()
        const x0 = e.clientX
        const v0 = valor
        let paso = false
        const mov = (m: PointerEvent) => {
          if (!paso && Math.abs(m.clientX - x0) < 3) return
          if (!paso) {
            guardarPaso()
            paso = true
          }
          const nv = Math.round(v0 + (m.clientX - x0) * (m.shiftKey ? 10 : 1))
          const actualV = valorEn(c, p, t)
          if (Array.isArray(actualV)) {
            const copia: [number, number] = [actualV[0], actualV[1]]
            copia[j] = nv
            poner(c, p, copia)
          } else poner(c, p, p === 'opac' ? Math.max(0, Math.min(100, nv)) : nv)
          n.textContent = nv + unidad
          dibujarCuadro()
        }
        const fin = async () => {
          document.removeEventListener('pointermove', mov)
          document.removeEventListener('pointerup', fin)
          if (paso) return todo()
          const r = await dialogo({ titulo: PROPS.find((x) => x.id === p)!.nombre, campo: String(Math.round(valor)), botones: [{ texto: 'Aceptar', valor: 'ok', principal: true }, { texto: 'Cancelar', valor: 'no' }] })
          const nv = Number(r.texto.replace(',', '.'))
          if (r.boton !== 'ok' || !Number.isFinite(nv)) return
          guardarPaso()
          const actualV = valorEn(c, p, t)
          if (Array.isArray(actualV)) {
            const copia: [number, number] = [actualV[0], actualV[1]]
            copia[j] = nv
            poner(c, p, copia)
          } else poner(c, p, nv)
          todo()
        }
        document.addEventListener('pointermove', mov)
        document.addEventListener('pointerup', fin)
      }
      return n
    }

    function arrastrarTiempo(e: PointerEvent, zona: HTMLElement) {
      if ((e.target as HTMLElement).classList.contains('an-clave')) return
      const r = zona.getBoundingClientRect()
      const ir = (x: number) => irA(Math.round(((x - r.left) / pps) * FPS) / FPS)
      ir(e.clientX)
      claveElegida = null
      const mov = (m: PointerEvent) => ir(m.clientX)
      const fin = () => {
        document.removeEventListener('pointermove', mov)
        document.removeEventListener('pointerup', fin)
        dibujarTabla()
      }
      document.addEventListener('pointermove', mov)
      document.addEventListener('pointerup', fin)
    }

    function arrastrarClave(e: PointerEvent, c: Capa, p: Prop, i: number, d: HTMLElement) {
      e.stopPropagation()
      elegida = c.id
      claveElegida = { capa: c.id, prop: p, i }
      const x0 = e.clientX
      const k = c.claves[p][i]
      const t0 = k.t
      let paso = false
      const mov = (m: PointerEvent) => {
        if (!paso && Math.abs(m.clientX - x0) < 3) return
        if (!paso) {
          guardarPaso()
          paso = true
        }
        k.t = Math.max(0, Math.min(comp.dur, Math.round((t0 + (m.clientX - x0) / pps) * FPS) / FPS))
        d.style.left = k.t * pps + 'px'
        dibujarCuadro()
      }
      const fin = () => {
        document.removeEventListener('pointermove', mov)
        document.removeEventListener('pointerup', fin)
        c.claves[p].sort((a, b) => a.t - b.t)
        claveElegida = { capa: c.id, prop: p, i: c.claves[p].indexOf(k) }
        if (!paso) irA(k.t)
        todo()
      }
      document.addEventListener('pointermove', mov)
      document.addEventListener('pointerup', fin)
    }

    // ---------- Visor: elegir y mover capas con el mouse
    function capaEn(x: number, y: number): Capa | null {
      for (const c of comp.capas) {
        if (!c.visible) continue
        const [px, py] = valorEn(c, 'pos', t) as [number, number]
        const e = (valorEn(c, 'escala', t) as number) / 100 || 0.001
        const r = ((valorEn(c, 'rot', t) as number) * Math.PI) / 180
        const dx = x - px
        const dy = y - py
        const lx = (dx * Math.cos(-r) - dy * Math.sin(-r)) / e
        const ly = (dx * Math.sin(-r) + dy * Math.cos(-r)) / e
        const [w, h] = medida(c)
        if (Math.abs(lx) <= w / 2 && Math.abs(ly) <= h / 2) return c
      }
      return null
    }
    const enLienzo = (e: PointerEvent): [number, number] => {
      const r = lienzo.getBoundingClientRect()
      return [((e.clientX - r.left) / r.width) * AN, ((e.clientY - r.top) / r.height) * AL]
    }
    lienzo.addEventListener('pointerdown', (e) => {
      if (reproduciendo || exportando) return
      const [x, y] = enLienzo(e)
      const c = capaEn(x, y)
      elegida = c?.id ?? null
      claveElegida = null
      todo()
      if (!c) return
      const p0 = valorEn(c, 'pos', t) as [number, number]
      let paso = false
      lienzo.setPointerCapture(e.pointerId)
      lienzo.onpointermove = (m) => {
        const [mx, my] = enLienzo(m)
        if (!paso && Math.hypot(mx - x, my - y) < 3) return
        if (!paso) {
          guardarPaso()
          paso = true
        }
        poner(c, 'pos', [Math.round(p0[0] + mx - x), Math.round(p0[1] + my - y)])
        dibujarCuadro()
      }
      lienzo.onpointerup = () => {
        lienzo.onpointermove = lienzo.onpointerup = null
        if (paso) todo()
      }
    })

    // ---------- Reproducir
    let ultimo = 0
    function play() {
      if (reproduciendo) return parar()
      reproduciendo = true
      ultimo = performance.now()
      dibujarControles()
      requestAnimationFrame(avanzar)
    }
    function avanzar(ahora: number) {
      if (!reproduciendo) return
      t += (ahora - ultimo) / 1000
      ultimo = ahora
      if (t >= comp.dur) {
        if (exportando) {
          t = comp.dur
          dibujarCuadro(false)
          parar()
          alTerminar?.()
          return
        }
        t = 0 // vuelve a empezar, como la vista previa de After Effects
      }
      dibujarCuadro(!exportando)
      requestAnimationFrame(avanzar)
    }
    function parar() {
      reproduciendo = false
      dibujarControles()
      dibujarCuadro()
      dibujarTabla()
    }
    function irA(s: number) {
      t = Math.max(0, Math.min(comp.dur, s))
      dibujarCuadro()
      if (!reproduciendo) actualizarNumeros()
    }
    function actualizarNumeros() {
      // Los valores de las propiedades cambian con el tiempo: se redibuja la tabla.
      dibujarTabla()
    }

    // ---------- Capas
    function agregarCapa(c: Capa) {
      guardarPaso()
      comp.capas.unshift(c)
      elegida = c.id
      todo()
    }
    async function capaTexto() {
      const r = await dialogo({ titulo: 'Capa de texto', icono: 'T', mensaje: '¿Qué dice?', campo: 'Hola', botones: [{ texto: 'Crear', valor: 'ok', principal: true }, { texto: 'Cancelar', valor: 'no' }] })
      if (r.boton !== 'ok' || !r.texto) return
      agregarCapa(nuevaCapa({ tipo: 'texto', nombre: r.texto.slice(0, 16), texto: r.texto, w: 0, h: 80, color: '#ffffff' }))
    }
    async function capaImagen() {
      const id = await elegirArchivo(PROGRAMAS_CON_IMAGEN, 'Elegí una foto o un dibujo')
      if (!id) return
      const url = await imagenDeMisCosas(id)
      if (!url) return
      const img = await cargarImagen(url)
      imagenes.set(id, img)
      const k = Math.min(400 / img.naturalWidth, 300 / img.naturalHeight)
      agregarCapa(nuevaCapa({ tipo: 'imagen', nombre: fs.buscar(id)?.nombre ?? 'Imagen', archivoId: id, w: Math.round(img.naturalWidth * k), h: Math.round(img.naturalHeight * k) }))
    }
    function duplicarCapa() {
      const c = capa()
      if (!c) return
      const n: Capa = { ...JSON.parse(JSON.stringify(c)), id: fs.nuevoId(), nombre: c.nombre + ' 2' }
      agregarCapa(n)
    }
    function borrar() {
      if (claveElegida) {
        const c = comp.capas.find((x) => x.id === claveElegida!.capa)
        if (!c) return
        guardarPaso()
        const ks = c.claves[claveElegida.prop]
        const k = ks[claveElegida.i]
        ks.splice(claveElegida.i, 1)
        // Si era el último cuadro clave, el valor queda fijo.
        if (!ks.length && k) c.base[claveElegida.prop] = k.v as never
        claveElegida = null
        return todo()
      }
      if (!elegida) return
      guardarPaso()
      comp.capas = comp.capas.filter((c) => c.id !== elegida)
      elegida = null
      todo()
    }
    async function cambiarDuracion() {
      const r = await dialogo({ titulo: 'Duración', mensaje: '¿Cuántos segundos dura la animación? (de 1 a 30)', campo: String(comp.dur), botones: [{ texto: 'Aceptar', valor: 'ok', principal: true }, { texto: 'Cancelar', valor: 'no' }] })
      const n = Number(r.texto.replace(',', '.'))
      if (r.boton !== 'ok' || !(n >= 1 && n <= 30)) return
      guardarPaso()
      comp.dur = n
      t = Math.min(t, n)
      todo()
    }
    function cambiarFondo(f: string) {
      guardarPaso()
      comp.fondo = f
      todo()
    }

    function todo() {
      dibujarControles()
      dibujarTabla()
      dibujarLado()
      dibujarCuadro()
      estado.textContent = 'Espacio: reproducir · Arrastrá en el visor para mover · ⏱ prende los cuadros clave · P S R T muestran una propiedad · F9 suaviza'
    }
    const obs = new ResizeObserver(() => dibujarTabla())
    obs.observe(tabla)

    // ---------- Exportar video
    let alTerminar: (() => void) | null = null
    function exportar() {
      if (!comp.capas.length) return aviso('Animar', 'Primero agregá alguna capa.', '✨')
      const tipo = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((x) => MediaRecorder.isTypeSupported(x)) ?? ''
      const grab = new MediaRecorder(lienzo.captureStream(FPS), tipo ? { mimeType: tipo } : undefined)
      const partes: Blob[] = []
      grab.ondataavailable = (e) => e.data.size && partes.push(e.data)
      grab.onstop = () => {
        exportando = false
        raiz.classList.remove('exportando')
        cartel.remove()
        const a = document.createElement('a')
        a.href = URL.createObjectURL(new Blob(partes, { type: 'video/webm' }))
        a.download = (archivo?.nombre ?? 'Mi animación') + '.webm'
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 60_000)
        aviso('Animar', `¡Listo! Se guardó "${a.download}" en Descargas.`, '✨')
      }
      const cartel = el('div', 'pl-exportando', '⏺ Grabando la animación…')
      visor.append(cartel)
      exportando = true
      raiz.classList.add('exportando')
      if (reproduciendo) reproduciendo = false
      t = 0
      alTerminar = () => {
        alTerminar = null
        setTimeout(() => grab.stop(), 200)
      }
      grab.start(500)
      play()
    }

    // ---------- Archivo
    async function guardar(como = false): Promise<boolean> {
      let n = archivo?.nombre
      if (!archivo || como) {
        const sugerido = archivo ? archivo.nombre + ' (copia)' : fs.nombreLibre('Animación', 'animar')
        const x = await pedirNombre('animar', sugerido, '¿Cómo se va a llamar tu animación?')
        if (!x) return false
        n = x
        archivo = null
      }
      const tAntes = t
      t = Math.min(comp.dur, 1.5)
      dibujarCuadro(false)
      const mini = document.createElement('canvas')
      mini.width = 240
      mini.height = 135
      mini.getContext('2d')!.drawImage(lienzo, 0, 0, 240, 135)
      t = tAntes
      dibujarCuadro()
      try {
        archivo = fs.guardar({ id: archivo?.id ?? fs.nuevoId(), nombre: n!, app: 'animar', miniatura: mini.toDataURL('image/jpeg', 0.8) }, comp)
      } catch {
        await aviso('Animar', 'No hay más lugar para guardar.', '⚠️')
        return false
      }
      cambios = false
      ponerTitulo()
      return true
    }
    async function puedeSeguir(): Promise<boolean> {
      if (exportando) return false
      if (!cambios || !comp.capas.length) return true
      const r = await preguntarSiGuarda('Animar', archivo?.nombre ?? 'Sin nombre')
      if (r === 'cancelar') return false
      if (r === 'si') return guardar()
      return true
    }
    async function cargar(id: string) {
      const a = fs.buscar(id)
      const d = fs.leer(id) as Comp | null
      if (!a || !d) return
      for (const c of d.capas)
        if (c.archivoId && !imagenes.has(c.archivoId)) {
          const url = await imagenDeMisCosas(c.archivoId)
          if (url) imagenes.set(c.archivoId, await cargarImagen(url))
        }
      comp = d
      t = 0
      elegida = null
      claveElegida = null
      archivo = a
      cambios = false
      atras.length = 0
      adelante.length = 0
      ponerTitulo()
      todo()
    }
    async function nueva() {
      if (!(await puedeSeguir())) return
      comp = { dur: 5, fondo: '#1a1a2e', capas: [] }
      t = 0
      elegida = null
      archivo = null
      cambios = false
      atras.length = 0
      adelante.length = 0
      ponerTitulo()
      todo()
    }
    async function abrirOtro() {
      if (!(await puedeSeguir())) return
      const id = await elegirArchivo('animar', 'Abrir una animación')
      if (id) await cargar(id)
    }
    function ponerTitulo() {
      win.ponerTitulo(`${cambios ? '● ' : ''}${archivo?.nombre ?? 'Sin nombre'} — Animar`)
    }

    // ---------- Arranque
    ponerTitulo()
    setTimeout(() => (archivoId ? cargar(archivoId) : todo()), 0)

    return {
      alTecla(e) {
        if (exportando) return true
        const ctrl = e.ctrlKey || e.metaKey
        const k = e.key.toLowerCase()
        if (ctrl) {
          if (k === 'z') deshacer()
          else if (k === 'y') rehacer()
          else if (k === 's') guardar()
          else if (k === 'o') abrirOtro()
          else if (k === 'n') nueva()
          else if (k === 'd') duplicarCapa()
          else if (k === 't') capaTexto()
          else if (k === 'm') exportar()
          else return false
          return true
        }
        if (e.key === ' ') play()
        else if (e.key === 'F9') suavizarElegida()
        else if (e.key === 'Delete' || e.key === 'Backspace') borrar()
        else if (e.key === 'Home') irA(0)
        else if (e.key === 'End') irA(comp.dur)
        else if (e.key === 'ArrowRight') irA(t + (e.shiftKey ? 10 : 1) / FPS)
        else if (e.key === 'ArrowLeft') irA(t - (e.shiftKey ? 10 : 1) / FPS)
        else if (['p', 's', 'r', 't'].includes(k) && capa()) {
          // Como en After Effects: abre la capa para ver esa propiedad.
          capa()!.abierta = true
          dibujarTabla()
          const nombre = PROPS.find((p) => p.tecla.toLowerCase() === k)!.nombre
          estado.textContent = `${nombre} de "${capa()!.nombre}"`
        } else return false
        return true
      },
      async alCerrar() {
        const ok = await puedeSeguir()
        if (ok) {
          reproduciendo = false
          obs.disconnect()
        }
        return ok
      },
    }
  },
}
