// Pincel: pintar, la idea de Paint en chiquito (lo primero, antes de Foto).
// Enseña: color 1 con clic y color 2 con clic derecho, lápiz, pinceles (aerosol,
// marcador, crayón), balde, borrador, formas con contorno y relleno, texto,
// seleccionar / mover / cortar / copiar / pegar, recortar, girar, cambiar el
// tamaño de la imagen arrastrando el borde, y la lupa.

import { imprimir } from '../os/imprimir'
import * as fs from '../os/archivos'
import { pedirNombre, preguntarSiGuarda } from '../os/documento'
import { cargarImagen } from '../os/imagenes'
import { copiarImagen, deOtro } from '../os/portapapeles'
import { elegirArchivo } from '../os/selector'
import { aviso, barraMenu, dialogo, el } from '../os/ui'
import type { Programa } from '../os/ventanas'
import { rellenar, rgbAHex, type Rect } from './foto/pixeles'

type Herr = 'seleccion' | 'lapiz' | 'borrador' | 'balde' | 'texto' | 'cuentagotas' | 'lupa' | 'pincel' | 'aerosol' | 'marcador' | 'crayon' | Forma
type Forma = 'linea' | 'rect' | 'redondeado' | 'elipse' | 'triangulo' | 'flecha' | 'estrella' | 'corazon'
const FORMAS: { id: Forma; icono: string; nombre: string }[] = [
  { id: 'linea', icono: '╱', nombre: 'Línea' },
  { id: 'rect', icono: '▭', nombre: 'Rectángulo' },
  { id: 'redondeado', icono: '▢', nombre: 'Rectángulo redondeado' },
  { id: 'elipse', icono: '◯', nombre: 'Óvalo' },
  { id: 'triangulo', icono: '△', nombre: 'Triángulo' },
  { id: 'flecha', icono: '⇨', nombre: 'Flecha' },
  { id: 'estrella', icono: '☆', nombre: 'Estrella' },
  { id: 'corazon', icono: '♡', nombre: 'Corazón' },
]
const esForma = (h: Herr): h is Forma => FORMAS.some((f) => f.id === h)
const PALETA = [
  '#000000', '#7f7f7f', '#880015', '#ed1c24', '#ff7f27', '#fff200', '#22b14c', '#00a2e8', '#3f48cc', '#a349a4',
  '#ffffff', '#c3c3c3', '#b97a57', '#ffaec9', '#ffc90e', '#efe4b0', '#b5e61d', '#99d9ea', '#7092be', '#c8bfe7',
]
const GROSORES = [1, 3, 5, 8, 14, 24]
const TAM_TEXTO = [14, 20, 28, 36, 48, 72]
const MAX_PASOS = 25
const MAX_LADO = 1600

interface Datos {
  w: number
  h: number
  imagen: string
}

const lienzoNuevo = (w: number, h: number) => {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}
const g2 = (c: HTMLCanvasElement) => c.getContext('2d', { willReadFrequently: true })!

/** Dibuja una forma en el rectángulo (x0,y0)-(x1,y1). */
function trazarForma(g: CanvasRenderingContext2D, f: Forma, x0: number, y0: number, x1: number, y1: number) {
  const x = Math.min(x0, x1)
  const y = Math.min(y0, y1)
  const w = Math.abs(x1 - x0)
  const h = Math.abs(y1 - y0)
  g.beginPath()
  if (f === 'linea') {
    g.moveTo(x0, y0)
    g.lineTo(x1, y1)
  } else if (f === 'rect') g.rect(x, y, w, h)
  else if (f === 'redondeado') g.roundRect(x, y, w, h, Math.min(w, h) * 0.2)
  else if (f === 'elipse') g.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
  else if (f === 'triangulo') {
    g.moveTo(x + w / 2, y)
    g.lineTo(x + w, y + h)
    g.lineTo(x, y + h)
    g.closePath()
  } else if (f === 'flecha') {
    g.moveTo(x, y + h * 0.3)
    g.lineTo(x + w * 0.6, y + h * 0.3)
    g.lineTo(x + w * 0.6, y)
    g.lineTo(x + w, y + h / 2)
    g.lineTo(x + w * 0.6, y + h)
    g.lineTo(x + w * 0.6, y + h * 0.7)
    g.lineTo(x, y + h * 0.7)
    g.closePath()
  } else if (f === 'estrella') {
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5
      const r = i % 2 ? 0.4 : 1
      g.lineTo(x + w / 2 + (Math.cos(a) * r * w) / 2, y + h / 2 + (Math.sin(a) * r * h) / 2 + h * 0.05)
    }
    g.closePath()
  } else if (f === 'corazon') {
    g.moveTo(x + w / 2, y + h)
    g.bezierCurveTo(x - w * 0.1, y + h * 0.55, x + w * 0.05, y - h * 0.1, x + w / 2, y + h * 0.25)
    g.bezierCurveTo(x + w * 0.95, y - h * 0.1, x + w * 1.1, y + h * 0.55, x + w / 2, y + h)
    g.closePath()
  }
}

export const pincel: Programa = {
  id: 'pincel',
  nombre: 'Pincel',
  icono: '🖌️',
  ancho: 1100,
  alto: 720,
  abrir(win, archivoId) {
    let W = 800
    let H = 600
    const imagen = lienzoNuevo(W, H) // la pintura
    const capa = lienzoNuevo(W, H) // vista previa: formas, selección, lo que se está moviendo
    let herr: Herr = 'pincel'
    let color1 = '#000000'
    let color2 = '#ffffff'
    let grosor = 5
    let tamTexto = 28
    let contorno = true
    let relleno = false
    let zoom = 1
    let sel: Rect | null = null
    let flotante: { lienzo: HTMLCanvasElement; x: number; y: number } | null = null
    let portapapeles: HTMLCanvasElement | null = null
    let archivo: fs.Archivo | null = null
    let cambios = false
    const atras: { w: number; h: number; datos: ImageData }[] = []
    const adelante: { w: number; h: number; datos: ImageData }[] = []
    let raton: [number, number] | null = null
    const hechas = new Set<string>() // lo que ya hizo (para el guía de las misiones)
    const hizo = (a: string) => hechas.add(a)

    // ---------- Armado
    const raiz = el('div', 'paint')
    const menu = barraMenu([
      {
        titulo: 'Archivo',
        items: [
          { texto: 'Nuevo', atajo: 'Ctrl+N', accion: () => nuevo() },
          { texto: 'Abrir…', atajo: 'Ctrl+O', accion: () => abrirOtro() },
          { texto: 'Abrir una imagen de la compu…', accion: () => abrirDeLaCompu() },
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
          { texto: 'Cortar', atajo: 'Ctrl+X', accion: () => cortar(), activo: () => !!sel },
          { texto: 'Copiar', atajo: 'Ctrl+C', accion: () => copiar(), activo: () => !!sel },
          { texto: 'Pegar', atajo: 'Ctrl+V', accion: () => pegar(), activo: () => !!portapapeles || !!deOtro('pincel') },
          { texto: 'Seleccionar todo', atajo: 'Ctrl+A', accion: () => elegirTodo() },
          { texto: 'Borrar la selección', atajo: 'Supr', accion: () => borrarSel(), activo: () => !!sel },
        ],
      },
      {
        titulo: 'Ver',
        items: [
          { texto: 'Acercar', atajo: 'Ctrl++', accion: () => ponerZoom(zoom * 2) },
          { texto: 'Alejar', atajo: 'Ctrl+-', accion: () => ponerZoom(zoom / 2) },
          { texto: 'Tamaño real (100%)', atajo: 'Ctrl+0', accion: () => ponerZoom(1) },
        ],
      },
    ])
    const cinta = el('div', 'pt-cinta')
    const zona = el('div', 'pt-zona')
    const hoja = el('div', 'pt-hoja')
    imagen.className = 'pt-imagen'
    capa.className = 'pt-capa'
    const tiradorD = el('div', 'pt-tirador d')
    const tiradorA = el('div', 'pt-tirador a')
    const tiradorE = el('div', 'pt-tirador e')
    hoja.append(imagen, capa, tiradorD, tiradorA, tiradorE)
    zona.append(hoja)
    const estado = el('div', 'pt-estado')
    const posTxt = el('span', '')
    const selTxt = el('span', '')
    const tamTxt = el('span', '')
    const zoomCaja = el('span', 'pt-zoom')
    estado.append(posTxt, selTxt, tamTxt, zoomCaja)
    raiz.append(menu, cinta, zona, estado)
    win.cuerpo.append(raiz)
    const entradaArchivo = el('input')
    entradaArchivo.type = 'file'
    entradaArchivo.accept = 'image/*'
    entradaArchivo.style.display = 'none'
    raiz.append(entradaArchivo)

    // ---------- Cinta (como la del Paint)
    const grupo = (titulo: string, ...hijos: HTMLElement[]) => {
      const g = el('div', 'cd-grupo')
      const f = el('div', 'pt-fila')
      f.append(...hijos)
      g.append(f, el('div', 'cd-grupo-titulo', titulo))
      return g
    }
    const boton = (txt: string, titulo: string, f: () => void, activo = false, clase = '') => {
      const b = el('button', 'pt-boton' + (activo ? ' activo' : '') + (clase ? ' ' + clase : ''))
      b.innerHTML = txt
      b.title = titulo
      b.onmousedown = (e) => e.preventDefault()
      b.onclick = f
      return b
    }
    const herrBoton = (h: Herr, icono: string, nombre: string, clase = '') => boton(icono, nombre, () => ponerHerr(h), herr === h, clase)

    function dibujarCinta() {
      cinta.replaceChildren()
      const columna = (...b: HTMLElement[]) => {
        const c = el('div', 'pt-col')
        c.append(...b)
        return c
      }
      const formas = el('div', 'pt-formas')
      for (const f of FORMAS) formas.append(herrBoton(f.id, f.icono, f.nombre))
      const selectGrosor = el('select', 'cd-select')
      const lista = herr === 'texto' ? TAM_TEXTO : GROSORES
      for (const n of lista) {
        const o = el('option', '', herr === 'texto' ? `${n} pt` : `${n} px`)
        o.value = String(n)
        selectGrosor.append(o)
      }
      selectGrosor.value = String(herr === 'texto' ? tamTexto : grosor)
      selectGrosor.onchange = () => {
        if (herr === 'texto') tamTexto = Number(selectGrosor.value)
        else grosor = Number(selectGrosor.value)
        dibujarCapa()
      }
      const colores = el('div', 'pt-paleta')
      for (const c of PALETA) {
        const m = el('span', 'cd-color')
        m.style.background = c
        m.title = 'Clic: color 1 · Clic derecho: color 2'
        m.onclick = () => {
          color1 = c
          dibujarCinta()
        }
        m.oncontextmenu = (e) => {
          e.preventDefault()
          color2 = c
          dibujarCinta()
        }
        colores.append(m)
      }
      const muestra = (cual: 1 | 2) => {
        const c = el('div', 'pt-muestra')
        const cuadro = el('div', 'pt-muestra-color')
        cuadro.style.background = cual === 1 ? color1 : color2
        c.append(cuadro, el('div', 'pt-muestra-texto', `Color ${cual}`))
        c.title = cual === 1 ? 'Color 1: se pinta con el clic' : 'Color 2: se pinta con el clic derecho (y es el del borrador)'
        c.onclick = () => {
          const i = el('input')
          i.type = 'color'
          i.value = cual === 1 ? color1 : color2
          i.oninput = () => {
            if (cual === 1) color1 = i.value
            else color2 = i.value
            dibujarCinta()
          }
          i.click()
        }
        return c
      }
      cinta.append(
        grupo('Portapapeles', columna(boton('📋', 'Pegar (Ctrl+V)', pegar, false, 'grande')), columna(boton('✂️', 'Cortar (Ctrl+X)', cortar), boton('⧉', 'Copiar (Ctrl+C)', copiar))),
        grupo(
          'Imagen',
          columna(herrBoton('seleccion', '⬚', 'Seleccionar (arrastrá para elegir una parte)', 'grande')),
          columna(boton('⛶', 'Recortar a lo seleccionado', recortar), boton('⤢', 'Cambiar el tamaño', cambiarTamano), boton('↻', 'Girar 90° a la derecha', () => girar(90))),
          columna(boton('↺', 'Girar 90° a la izquierda', () => girar(-90)), boton('⇋', 'Voltear horizontal (espejo)', () => voltear(true)), boton('⇵', 'Voltear vertical', () => voltear(false))),
        ),
        grupo(
          'Herramientas',
          columna(herrBoton('lapiz', '✏️', 'Lápiz'), herrBoton('balde', '🪣', 'Relleno con color')),
          columna(herrBoton('texto', 'A', 'Texto'), herrBoton('borrador', '🧽', 'Borrador (pinta con el color 2)')),
          columna(herrBoton('cuentagotas', '💧', 'Selector de color'), herrBoton('lupa', '🔍', 'Lupa: clic acerca, clic derecho aleja')),
        ),
        grupo('Pinceles', columna(herrBoton('pincel', '🖌️', 'Pincel'), herrBoton('aerosol', '💨', 'Aerosol')), columna(herrBoton('marcador', '🖍️', 'Marcador (transparente)'), herrBoton('crayon', '🖊️', 'Crayón'))),
        grupo(
          'Formas',
          formas,
          columna(
            boton(contorno ? '◻︎ Contorno' : '◻︎ Sin contorno', 'Contorno de la forma (color 1)', () => {
              contorno = !contorno || !relleno ? !contorno : contorno
              if (!contorno && !relleno) contorno = true
              dibujarCinta()
            }, contorno, 'texto'),
            boton(relleno ? '◼︎ Relleno' : '◼︎ Sin relleno', 'Relleno de la forma (color 2)', () => {
              relleno = !relleno
              if (!contorno && !relleno) contorno = true
              dibujarCinta()
            }, relleno, 'texto'),
          ),
        ),
        grupo(herr === 'texto' ? 'Tamaño de letra' : 'Tamaño', selectGrosor),
        grupo('Colores', muestra(1), muestra(2), colores),
      )
    }

    function ponerHerr(h: Herr) {
      soltarFlotante()
      if (h !== 'seleccion') {
        sel = null
      }
      herr = h
      hoja.style.cursor = h === 'seleccion' ? 'crosshair' : h === 'texto' ? 'text' : h === 'lupa' ? 'zoom-in' : h === 'cuentagotas' ? 'copy' : 'crosshair'
      dibujarCinta()
      dibujarCapa()
    }

    // ---------- Historia
    function guardarPaso() {
      atras.push({ w: W, h: H, datos: g2(imagen).getImageData(0, 0, W, H) })
      if (atras.length > MAX_PASOS) atras.shift()
      adelante.length = 0
      if (!cambios) {
        cambios = true
        ponerTitulo()
      }
    }
    function reponer(p: { w: number; h: number; datos: ImageData }) {
      tamano(p.w, p.h)
      g2(imagen).putImageData(p.datos, 0, 0)
    }
    function deshacer() {
      hizo('deshacer')
      soltarFlotante()
      const p = atras.pop()
      if (!p) return
      adelante.push({ w: W, h: H, datos: g2(imagen).getImageData(0, 0, W, H) })
      reponer(p)
      sel = null
      dibujarCapa()
    }
    function rehacer() {
      const p = adelante.pop()
      if (!p) return
      atras.push({ w: W, h: H, datos: g2(imagen).getImageData(0, 0, W, H) })
      reponer(p)
      dibujarCapa()
    }

    // ---------- Tamaño y zoom
    /** Cambia el tamaño de la imagen; lo nuevo queda blanco. */
    function tamano(w: number, h: number) {
      const copia = lienzoNuevo(imagen.width, imagen.height)
      g2(copia).drawImage(imagen, 0, 0)
      W = w
      H = h
      imagen.width = capa.width = w
      imagen.height = capa.height = h
      const g = g2(imagen)
      g.fillStyle = '#ffffff'
      g.fillRect(0, 0, w, h)
      g.drawImage(copia, 0, 0)
      ubicar()
    }
    function ubicar() {
      for (const c of [imagen, capa]) {
        c.style.width = W * zoom + 'px'
        c.style.height = H * zoom + 'px'
      }
      hoja.style.width = W * zoom + 'px'
      hoja.style.height = H * zoom + 'px'
      imagen.style.imageRendering = zoom >= 2 ? 'pixelated' : 'auto'
      tamTxt.textContent = `🖼 ${W} × ${H} px`
      dibujarZoom()
    }
    function ponerZoom(z: number) {
      zoom = Math.max(0.125, Math.min(8, z))
      ubicar()
      dibujarCapa()
    }
    function dibujarZoom() {
      zoomCaja.replaceChildren()
      const menos = el('button', 'pt-zboton', '−')
      menos.onclick = () => ponerZoom(zoom / 1.25)
      const r = el('input')
      r.type = 'range'
      r.min = '-3'
      r.max = '3'
      r.step = '0.01'
      r.value = String(Math.log2(zoom))
      r.oninput = () => ponerZoom(2 ** Number(r.value))
      const mas = el('button', 'pt-zboton', '+')
      mas.onclick = () => ponerZoom(zoom * 1.25)
      zoomCaja.append(el('span', '', Math.round(zoom * 100) + '%'), menos, r, mas)
    }

    // Tiradores del borde: cambiar el tamaño de la imagen arrastrando (como en Paint).
    for (const [t, dx, dy] of [
      [tiradorD, 1, 0],
      [tiradorA, 0, 1],
      [tiradorE, 1, 1],
    ] as const) {
      t.onpointerdown = (e) => {
        e.stopPropagation()
        e.preventDefault()
        soltarFlotante()
        const x0 = e.clientX
        const y0 = e.clientY
        const w0 = W
        const h0 = H
        const guia = el('div', 'pt-guia')
        hoja.append(guia)
        const nuevo = (m: PointerEvent): [number, number] => [
          Math.max(1, Math.min(MAX_LADO, Math.round(w0 + (dx ? (m.clientX - x0) / zoom : 0)))),
          Math.max(1, Math.min(MAX_LADO, Math.round(h0 + (dy ? (m.clientY - y0) / zoom : 0)))),
        ]
        const mov = (m: PointerEvent) => {
          const [w, h] = nuevo(m)
          guia.style.width = w * zoom + 'px'
          guia.style.height = h * zoom + 'px'
          tamTxt.textContent = `🖼 ${w} × ${h} px`
        }
        const fin = (m: PointerEvent) => {
          document.removeEventListener('pointermove', mov)
          document.removeEventListener('pointerup', fin)
          guia.remove()
          const [w, h] = nuevo(m)
          if (w !== W || h !== H) {
            guardarPaso()
            tamano(w, h)
            sel = null
            dibujarCapa()
          }
        }
        mov(e)
        document.addEventListener('pointermove', mov)
        document.addEventListener('pointerup', fin)
      }
    }

    // ---------- Capa de vista previa
    let hormigas = 0
    const intervalo = setInterval(() => {
      if (sel) {
        hormigas = (hormigas + 1) % 12
        dibujarCapa()
      }
    }, 150)
    function dibujarCapa(previa?: (g: CanvasRenderingContext2D) => void) {
      const g = g2(capa)
      g.clearRect(0, 0, W, H)
      if (flotante) g.drawImage(flotante.lienzo, flotante.x, flotante.y)
      previa?.(g)
      if (sel) {
        g.save()
        g.lineWidth = 1 / zoom
        g.setLineDash([4 / zoom, 4 / zoom])
        g.strokeStyle = '#fff'
        g.strokeRect(sel.x + 0.5, sel.y + 0.5, sel.w, sel.h)
        g.strokeStyle = '#000'
        g.lineDashOffset = hormigas / zoom
        g.strokeRect(sel.x + 0.5, sel.y + 0.5, sel.w, sel.h)
        g.restore()
      }
      // El borrador muestra un cuadradito del tamaño que borra.
      if (raton && herr === 'borrador') {
        const t = grosor * 2 + 4
        g.strokeStyle = '#000'
        g.lineWidth = 1 / zoom
        g.strokeRect(Math.round(raton[0] - t / 2) + 0.5, Math.round(raton[1] - t / 2) + 0.5, t, t)
      }
      selTxt.textContent = sel ? `⬚ ${sel.w} × ${sel.h} px` : ''
    }

    // ---------- Selección
    const normal = (r: Rect): Rect => ({ x: Math.round(Math.min(r.x, r.x + r.w)), y: Math.round(Math.min(r.y, r.y + r.h)), w: Math.round(Math.abs(r.w)), h: Math.round(Math.abs(r.h)) })
    function levantar() {
      // Lo seleccionado se "despega" para moverlo; el hueco queda con el color 2 (como Paint).
      if (!sel || flotante) return
      guardarPaso()
      const l = lienzoNuevo(sel.w, sel.h)
      g2(l).drawImage(imagen, -sel.x, -sel.y)
      const g = g2(imagen)
      g.fillStyle = color2
      g.fillRect(sel.x, sel.y, sel.w, sel.h)
      flotante = { lienzo: l, x: sel.x, y: sel.y }
    }
    function soltarFlotante() {
      if (!flotante) return
      g2(imagen).drawImage(flotante.lienzo, flotante.x, flotante.y)
      flotante = null
      dibujarCapa()
    }
    function elegirTodo() {
      soltarFlotante()
      herr = 'seleccion'
      sel = { x: 0, y: 0, w: W, h: H }
      dibujarCinta()
      dibujarCapa()
    }
    function copiar() {
      if (!sel) return
      portapapeles = lienzoNuevo(sel.w, sel.h)
      hizo('copiar')
      const pg = g2(portapapeles)
      if (flotante) pg.drawImage(flotante.lienzo, 0, 0)
      else pg.drawImage(imagen, -sel.x, -sel.y)
      // También al portapapeles de la compu, para pegarla en otro programa.
      copiarImagen(portapapeles.toDataURL('image/png'), 'pincel')
    }
    function cortar() {
      if (!sel) return
      copiar()
      borrarSel()
    }
    function borrarSel() {
      if (!sel) return
      if (flotante) flotante = null
      else {
        guardarPaso()
        const g = g2(imagen)
        g.fillStyle = color2
        g.fillRect(sel.x, sel.y, sel.w, sel.h)
      }
      sel = null
      dibujarCapa()
    }
    function pegar() {
      // Si lo último que se copió vino de otro programa (un dibujo de Trazos, una foto), se pega eso.
      const otro = deOtro('pincel')
      if (otro?.tipo === 'imagen') {
        cargarImagen(otro.url).then((img) => {
          const k = Math.min(1, (W * 0.9) / (img.naturalWidth || W), (H * 0.9) / (img.naturalHeight || H))
          portapapeles = lienzoNuevo(Math.max(1, Math.round((img.naturalWidth || W) * k)), Math.max(1, Math.round((img.naturalHeight || H) * k)))
          g2(portapapeles).drawImage(img, 0, 0, portapapeles.width, portapapeles.height)
          copiarImagen(portapapeles.toDataURL('image/png'), 'pincel')
          pegarLienzo()
        })
        return
      }
      pegarLienzo()
    }
    function pegarLienzo() {
      if (!portapapeles) return
      soltarFlotante()
      guardarPaso()
      // Se pega arriba a la izquierda de lo que se ve, como en Paint.
      const x = Math.max(0, Math.round(zona.scrollLeft / zoom))
      const y = Math.max(0, Math.round(zona.scrollTop / zoom))
      if (portapapeles.width > W || portapapeles.height > H) tamano(Math.max(W, portapapeles.width), Math.max(H, portapapeles.height))
      const l = lienzoNuevo(portapapeles.width, portapapeles.height)
      g2(l).drawImage(portapapeles, 0, 0)
      flotante = { lienzo: l, x, y }
      hizo('pegar')
      sel = { x, y, w: l.width, h: l.height }
      herr = 'seleccion'
      dibujarCinta()
      dibujarCapa()
    }
    function recortar() {
      if (!sel) return
      soltarFlotante()
      guardarPaso()
      const s = sel
      const copia = lienzoNuevo(s.w, s.h)
      g2(copia).drawImage(imagen, -s.x, -s.y)
      tamano(s.w, s.h)
      g2(imagen).drawImage(copia, 0, 0)
      sel = null
      dibujarCapa()
    }

    // ---------- Imagen
    function transformar(nw: number, nh: number, f: (g: CanvasRenderingContext2D, c: HTMLCanvasElement) => void) {
      soltarFlotante()
      guardarPaso()
      const copia = lienzoNuevo(W, H)
      g2(copia).drawImage(imagen, 0, 0)
      tamano(nw, nh)
      const g = g2(imagen)
      g.save()
      f(g, copia)
      g.restore()
      sel = null
      dibujarCapa()
    }
    function girar(grados: number) {
      const w = W
      const h = H
      transformar(h, w, (g, c) => {
        if (grados === 90) g.translate(h, 0)
        else g.translate(0, w)
        g.rotate((grados * Math.PI) / 180)
        g.drawImage(c, 0, 0)
      })
    }
    function voltear(horizontal: boolean) {
      transformar(W, H, (g, c) => {
        if (horizontal) {
          g.translate(W, 0)
          g.scale(-1, 1)
        } else {
          g.translate(0, H)
          g.scale(1, -1)
        }
        g.drawImage(c, 0, 0)
      })
    }
    async function cambiarTamano() {
      const r = await dialogo({
        titulo: 'Cambiar el tamaño',
        icono: '⤢',
        mensaje: `Ahora mide ${W} × ${H}. ¿A qué porcentaje? (100 = igual, 50 = la mitad, 200 = el doble)`,
        campo: '100',
        botones: [
          { texto: 'Aceptar', valor: 'ok', principal: true },
          { texto: 'Cancelar', valor: 'no' },
        ],
      })
      const p = Number(r.texto.replace(',', '.').replace('%', ''))
      if (r.boton !== 'ok' || !(p > 0)) return
      const nw = Math.max(1, Math.min(MAX_LADO, Math.round((W * p) / 100)))
      const nh = Math.max(1, Math.min(MAX_LADO, Math.round((H * p) / 100)))
      transformar(nw, nh, (g, c) => {
        g.imageSmoothingQuality = 'high'
        g.drawImage(c, 0, 0, nw, nh)
      })
    }

    // ---------- Pintar
    const punto = (e: { clientX: number; clientY: number }): [number, number] => {
      const r = imagen.getBoundingClientRect()
      return [(e.clientX - r.left) / zoom, (e.clientY - r.top) / zoom]
    }

    hoja.addEventListener('contextmenu', (e) => e.preventDefault())
    hoja.addEventListener('pointermove', (e) => {
      raton = punto(e)
      posTxt.textContent = `✛ ${Math.floor(raton[0])}, ${Math.floor(raton[1])} px`
      if (herr === 'borrador') dibujarCapa()
    })
    hoja.addEventListener('pointerleave', () => {
      raton = null
      posTxt.textContent = ''
      if (herr === 'borrador') dibujarCapa()
    })

    hoja.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).classList.contains('pt-tirador')) return
      if (e.button !== 0 && e.button !== 2) return
      e.preventDefault()
      const der = e.button === 2
      const [x0, y0] = punto(e)
      const colorA = der ? color2 : color1 // el que pinta
      const colorB = der ? color1 : color2 // el otro
      hoja.setPointerCapture(e.pointerId)
      let alMover: ((x: number, y: number, m: PointerEvent) => void) | null = null
      let alSoltar: ((x: number, y: number, m: PointerEvent) => void) | null = null

      if (herr === 'lupa') {
        ponerZoom(der ? zoom / 2 : zoom * 2)
        return
      }
      if (herr === 'cuentagotas') {
        const d = g2(imagen).getImageData(Math.floor(x0), Math.floor(y0), 1, 1).data
        const c = rgbAHex(d[0], d[1], d[2])
        if (der) color2 = c
        else color1 = c
        ponerHerr('pincel')
        return
      }
      if (herr === 'balde') {
        guardarPaso()
        const g = g2(imagen)
        const img = g.getImageData(0, 0, W, H)
        rellenar(img, Math.floor(x0), Math.floor(y0), colorA, 32, sel)
        g.putImageData(img, 0, 0)
        hizo('balde')
        hizo('balde:' + colorA)
        return
      }
      if (herr === 'texto') {
        escribir(x0, y0, colorA)
        return
      }
      if (herr === 'seleccion') {
        const dentro = sel && x0 >= sel.x && x0 <= sel.x + sel.w && y0 >= sel.y && y0 <= sel.y + sel.h
        if (dentro && sel) {
          // Mover lo seleccionado.
          levantar()
          const fx = flotante!.x
          const fy = flotante!.y
          alMover = (x, y) => {
            flotante!.x = Math.round(fx + x - x0)
            flotante!.y = Math.round(fy + y - y0)
            hizo('mover')
            sel = { ...sel!, x: flotante!.x, y: flotante!.y }
            dibujarCapa()
          }
        } else {
          soltarFlotante()
          sel = null
          let r: Rect = { x: Math.round(x0), y: Math.round(y0), w: 0, h: 0 }
          alMover = (x, y) => {
            r = { ...r, w: Math.round(Math.max(0, Math.min(W, x))) - r.x, h: Math.round(Math.max(0, Math.min(H, y))) - r.y }
            sel = normal(r)
            dibujarCapa()
          }
          alSoltar = () => {
            if (sel && (sel.w < 2 || sel.h < 2)) sel = null
            if (sel) hizo('seleccion')
            dibujarCapa()
          }
        }
      } else if (esForma(herr)) {
        const f = herr
        const dibujarEn = (g: CanvasRenderingContext2D, x: number, y: number, m: PointerEvent) => {
          let x1 = x
          let y1 = y
          if (m.shiftKey) {
            // Con Mayús: cuadrado, círculo, o línea derecha.
            const l = Math.max(Math.abs(x - x0), Math.abs(y - y0))
            if (f === 'linea') {
              const a = Math.round(Math.atan2(y - y0, x - x0) / (Math.PI / 4)) * (Math.PI / 4)
              const d = Math.hypot(x - x0, y - y0)
              x1 = x0 + Math.cos(a) * d
              y1 = y0 + Math.sin(a) * d
            } else {
              x1 = x0 + Math.sign(x - x0 || 1) * l
              y1 = y0 + Math.sign(y - y0 || 1) * l
            }
          }
          g.save()
          trazarForma(g, f, x0, y0, x1, y1)
          g.lineWidth = grosor
          g.lineJoin = 'round'
          g.lineCap = 'round'
          if (relleno && f !== 'linea') {
            g.fillStyle = colorB
            g.fill()
          }
          if (contorno || f === 'linea') {
            g.strokeStyle = colorA
            g.stroke()
          }
          g.restore()
        }
        alMover = (x, y, m) => dibujarCapa((g) => dibujarEn(g, x, y, m))
        alSoltar = (x, y, m) => {
          if (Math.hypot(x - x0, y - y0) < 1) return dibujarCapa()
          guardarPaso()
          const g = g2(imagen)
          if (sel) {
            g.save()
            g.beginPath()
            g.rect(sel.x, sel.y, sel.w, sel.h)
            g.clip()
          }
          dibujarEn(g, x, y, m)
          hizo('forma:' + f)
          if (sel) g.restore()
          dibujarCapa()
        }
      } else {
        // Lápiz, borrador y pinceles.
        guardarPaso()
        const g = g2(imagen)
        g.save()
        if (sel) {
          g.beginPath()
          g.rect(sel.x, sel.y, sel.w, sel.h)
          g.clip()
        }
        let ux = x0
        let uy = y0
        const color = herr === 'borrador' ? color2 : colorA // el borrador pinta con el color 2, como en Paint
        let aerosol = 0
        const marcador = herr === 'marcador' ? lienzoNuevo(W, H) : null
        const tramo = (x: number, y: number) => {
          if (herr === 'lapiz') {
            // Lápiz: sin suavizar, píxel por píxel.
            const pasos = Math.max(1, Math.ceil(Math.hypot(x - ux, y - uy)))
            g.fillStyle = color
            const t = Math.max(1, Math.round(grosor / 3))
            for (let i = 0; i <= pasos; i++) g.fillRect(Math.floor(ux + ((x - ux) * i) / pasos), Math.floor(uy + ((y - uy) * i) / pasos), t, t)
          } else if (herr === 'borrador') {
            const t = grosor * 2 + 4
            const pasos = Math.max(1, Math.ceil(Math.hypot(x - ux, y - uy) / 2))
            g.fillStyle = color
            for (let i = 0; i <= pasos; i++) g.fillRect(ux + ((x - ux) * i) / pasos - t / 2, uy + ((y - uy) * i) / pasos - t / 2, t, t)
          } else if (herr === 'pincel' || herr === 'marcador') {
            const gg = marcador ? g2(marcador) : g
            gg.strokeStyle = color
            gg.lineWidth = herr === 'marcador' ? grosor * 2.5 : grosor
            gg.lineCap = herr === 'marcador' ? 'square' : 'round'
            gg.lineJoin = herr === 'marcador' ? 'miter' : 'round'
            gg.beginPath()
            gg.moveTo(ux, uy)
            gg.lineTo(x, y)
            gg.stroke()
          } else if (herr === 'crayon') {
            // Crayón: puntitos que no tapan del todo, como cera sobre papel.
            const pasos = Math.max(1, Math.ceil(Math.hypot(x - ux, y - uy)))
            g.fillStyle = color
            for (let i = 0; i <= pasos; i++)
              for (let k = 0; k < grosor * 1.5; k++) {
                if (Math.random() < 0.45) continue
                const r = (Math.random() * grosor) / 1.2
                const a = Math.random() * Math.PI * 2
                g.fillRect(ux + ((x - ux) * i) / pasos + Math.cos(a) * r, uy + ((y - uy) * i) / pasos + Math.sin(a) * r, 1.2, 1.2)
              }
          }
          ux = x
          uy = y
        }
        if (herr === 'aerosol') {
          g.fillStyle = color
          const rociar = () => {
            const r = grosor * 2.5
            for (let k = 0; k < grosor * 3; k++) {
              const a = Math.random() * Math.PI * 2
              const d = Math.sqrt(Math.random()) * r
              g.fillRect(ux + Math.cos(a) * d, uy + Math.sin(a) * d, 1, 1)
            }
          }
          rociar()
          aerosol = window.setInterval(rociar, 25)
          alMover = (x, y) => {
            ux = x
            uy = y
          }
        } else {
          tramo(x0 + 0.01, y0)
          alMover = (x, y) => {
            tramo(x, y)
            if (marcador) dibujarCapa((c) => ((c.globalAlpha = 0.4), c.drawImage(marcador, 0, 0)))
          }
        }
        const queHizo = herr + (der ? '-der' : '')
        alSoltar = () => {
          hizo(queHizo)
          if (grosor !== 5) hizo(queHizo + ':otro-tamano')
          clearInterval(aerosol)
          if (marcador) {
            // El marcador es transparente parejo: se pega todo junto al soltar.
            g.globalAlpha = 0.4
            g.drawImage(marcador, 0, 0)
          }
          g.restore()
          dibujarCapa()
        }
      }

      hoja.onpointermove = (m) => {
        const [x, y] = punto(m)
        alMover?.(x, y, m)
      }
      hoja.onpointerup = (m) => {
        hoja.onpointermove = null
        hoja.onpointerup = null
        const [x, y] = punto(m)
        alSoltar?.(x, y, m)
      }
    })

    function escribir(x: number, y: number, color: string) {
      const input = el('input', 'pt-texto')
      input.style.left = x * zoom + 'px'
      input.style.top = y * zoom + 'px'
      input.style.fontSize = tamTexto * zoom + 'px'
      input.style.color = color
      hoja.append(input)
      setTimeout(() => input.focus(), 0)
      let listo = false
      const terminar = (ok: boolean) => {
        if (listo) return
        listo = true
        const t = input.value
        input.remove()
        if (!ok || !t.trim()) return
        guardarPaso()
        const g = g2(imagen)
        g.font = `${tamTexto}px Nunito, Arial, sans-serif`
        g.fillStyle = color
        g.textBaseline = 'top'
        g.fillText(t, x + 3, y + 2)
        hizo('texto')
        if (tamTexto >= 48) hizo('texto-grande')
      }
      input.onkeydown = (e) => {
        e.stopPropagation()
        if (e.key === 'Enter') terminar(true)
        if (e.key === 'Escape') terminar(false)
      }
      input.onblur = () => terminar(true)
    }

    zona.addEventListener(
      'wheel',
      (e) => {
        if (!e.ctrlKey) return
        e.preventDefault()
        ponerZoom(e.deltaY < 0 ? zoom * 1.25 : zoom / 1.25)
      },
      { passive: false },
    )

    // ---------- Archivo
    function empezar(fuente: HTMLCanvasElement | HTMLImageElement | null, w: number, h: number, a: fs.Archivo | null) {
      tamano(w, h)
      const g = g2(imagen)
      g.fillStyle = '#ffffff'
      g.fillRect(0, 0, w, h)
      if (fuente) g.drawImage(fuente, 0, 0, w, h)
      archivo = a
      cambios = false
      atras.length = 0
      adelante.length = 0
      sel = null
      flotante = null
      ponerTitulo()
      dibujarCapa()
    }

    function imprimirEsto() {
      soltarFlotante()
      imprimir({ titulo: archivo?.nombre ?? 'Sin título', paginas: [{ tipo: 'imagen', contenido: imagen.toDataURL('image/png') }], horizontal: W > H })
    }

    async function guardar(como = false): Promise<boolean> {
      soltarFlotante()
      let n = archivo?.nombre
      if (!archivo || como) {
        const sugerido = archivo ? archivo.nombre + ' (copia)' : fs.nombreLibre('Pintura', 'pincel')
        const x = await pedirNombre('pincel', sugerido, '¿Cómo se va a llamar tu pintura?')
        if (!x) return false
        n = x
        archivo = null
      }
      const webp = imagen.toDataURL('image/webp', 0.95)
      const datos: Datos = { w: W, h: H, imagen: webp.startsWith('data:image/webp') ? webp : imagen.toDataURL('image/png') }
      const mini = lienzoNuevo(240, Math.max(1, Math.round((240 * H) / W)))
      g2(mini).drawImage(imagen, 0, 0, mini.width, mini.height)
      try {
        archivo = fs.guardar({ id: archivo?.id ?? fs.nuevoId(), nombre: n!, app: 'pincel', miniatura: mini.toDataURL('image/jpeg', 0.85) }, datos)
      } catch {
        await aviso('Pincel', 'No hay más lugar para guardar. Vaciá la papelera y probá de nuevo.', '⚠️')
        return false
      }
      cambios = false
      ponerTitulo()
      return true
    }
    async function puedeSeguir(): Promise<boolean> {
      if (!cambios) return true
      const r = await preguntarSiGuarda('Pincel', archivo?.nombre ?? 'Sin nombre')
      if (r === 'cancelar') return false
      if (r === 'si') return guardar()
      return true
    }
    async function cargar(id: string) {
      const a = fs.buscar(id)
      const d = fs.leer(id) as Datos | null
      if (!a || !d) return
      empezar(await cargarImagen(d.imagen), d.w, d.h, a)
    }
    async function nuevo() {
      if (!(await puedeSeguir())) return
      empezar(null, 800, 600, null)
    }
    async function abrirOtro() {
      if (!(await puedeSeguir())) return
      const id = await elegirArchivo('pincel', 'Abrir una pintura')
      if (id) await cargar(id)
    }
    async function abrirDeLaCompu() {
      if (!(await puedeSeguir())) return
      entradaArchivo.value = ''
      entradaArchivo.onchange = async () => {
        const f = entradaArchivo.files?.[0]
        if (!f) return
        const url = URL.createObjectURL(f)
        try {
          const img = await cargarImagen(url)
          const k = Math.min(1, MAX_LADO / Math.max(img.width, img.height))
          empezar(img, Math.round(img.width * k), Math.round(img.height * k), null)
        } catch {
          aviso('Pincel', 'Ese archivo no es una imagen que se pueda abrir.', '⚠️')
        } finally {
          URL.revokeObjectURL(url)
        }
      }
      entradaArchivo.click()
    }
    function ponerTitulo() {
      win.ponerTitulo(`${cambios ? '● ' : ''}${archivo?.nombre ?? 'Sin título'} — Pincel`)
    }

    // ---------- Arranque
    dibujarCinta()
    ponerHerr('pincel')
    if (archivoId) cargar(archivoId)
    else empezar(null, 800, 600, null)

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
          else if (k === 'a') elegirTodo()
          else if (k === '+' || k === '=') ponerZoom(zoom * 2)
          else if (k === '-') ponerZoom(zoom / 2)
          else if (k === '0') ponerZoom(1)
          else return false
          return true
        }
        if (e.key === 'Delete') borrarSel()
        else if (e.key === 'Escape') {
          soltarFlotante()
          sel = null
          dibujarCapa()
        } else if (e.key === 'Enter' && flotante) {
          soltarFlotante()
          sel = null
          dibujarCapa()
        } else return false
        return true
      },
      // Para el guía de las misiones.
      api: {
        hizo: (a: string) => hechas.has(a),
        color1: () => color1,
        color2: () => color2,
        /** Cuánto de la hoja ya no está en blanco (0 a 1). */
        pintado: () => {
          const d = g2(imagen).getImageData(0, 0, W, H).data
          let n = 0
          let t = 0
          for (let i = 0; i < d.length; i += 4 * 37) {
            t++
            if (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245) n++
          }
          return n / Math.max(1, t)
        },
        cargar: () => {
          empezar(null, 800, 600, null)
          hechas.clear()
        },
        guardarComo: (n0: string) => {
          soltarFlotante()
          let n = n0
          for (let i = 2; fs.existeNombre(n, 'pincel'); i++) n = `${n0} ${i}`
          const mini = lienzoNuevo(240, Math.max(1, Math.round((240 * H) / W)))
          g2(mini).drawImage(imagen, 0, 0, mini.width, mini.height)
          archivo = fs.guardar({ id: fs.nuevoId(), nombre: n, app: 'pincel', miniatura: mini.toDataURL('image/jpeg', 0.85) }, { w: W, h: H, imagen: imagen.toDataURL('image/png') } as Datos)
          cambios = false
          ponerTitulo()
          return n
        },
      },
      async alCerrar() {
        const ok = await puedeSeguir()
        if (ok) clearInterval(intervalo)
        return ok
      },
    }
  },
}
