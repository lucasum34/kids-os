// Foto: editor de imágenes, la idea de Photoshop en chiquito.
// Enseña: capas (ver/ocultar, opacidad, orden, combinar), pincel y borrador con
// tamaño y opacidad, balde, cuentagotas, color principal y secundario,
// selección rectangular (y que lo que hacés queda adentro), mover, texto,
// ajustes de brillo/contraste/color, recortar, girar y abrir fotos.

import { imprimir } from '../../os/imprimir'
import * as fs from '../../os/archivos'
import { pedirNombre, preguntarSiGuarda } from '../../os/documento'
import { elegirArchivo } from '../../os/selector'
import { aviso, barraMenu, dialogo, el } from '../../os/ui'
import type { Programa } from '../../os/ventanas'
import { rellenar, rgbAHex, type Rect } from './pixeles'
import { copiarImagen, deOtro } from '../../os/portapapeles'
import { imagenDeMisCosas, PROGRAMAS_CON_IMAGEN } from '../../os/imagenes'

type Herramienta = 'mover' | 'seleccion' | 'pincel' | 'borrador' | 'balde' | 'cuentagotas' | 'texto'
const HERRAMIENTAS: { id: Herramienta; icono: string; nombre: string; tecla: string }[] = [
  { id: 'mover', icono: '✥', nombre: 'Mover la capa', tecla: 'V' },
  { id: 'seleccion', icono: '⬚', nombre: 'Selección rectangular', tecla: 'M' },
  { id: 'pincel', icono: '🖌️', nombre: 'Pincel', tecla: 'B' },
  { id: 'borrador', icono: '🧽', nombre: 'Borrador', tecla: 'E' },
  { id: 'balde', icono: '🪣', nombre: 'Bote de pintura', tecla: 'G' },
  { id: 'cuentagotas', icono: '💧', nombre: 'Cuentagotas', tecla: 'I' },
  { id: 'texto', icono: 'T', nombre: 'Texto', tecla: 'T' },
]
const PALETA = ['#000000', '#ffffff', '#9e9e9e', '#e53935', '#fb8c00', '#fdd835', '#43a047', '#00acc1', '#1e88e5', '#3949ab', '#8e24aa', '#ec407a', '#8d6e63', '#ffccbc']
const MAX_LADO = 1200 // las fotos grandes se achican al abrir
const MAX_PASOS = 20

interface Capa {
  id: string
  nombre: string
  visible: boolean
  opacidad: number
  lienzo: HTMLCanvasElement
}
interface CapaGuardada {
  nombre: string
  visible: boolean
  opacidad: number
  imagen: string // data URL
}
interface Datos {
  w: number
  h: number
  capas: CapaGuardada[]
}
type Paso =
  | { tipo: 'pixeles'; capaId: string; datos: ImageData }
  | { tipo: 'todo'; w: number; h: number; activa: number; capas: { id: string; nombre: string; visible: boolean; opacidad: number; datos: ImageData }[] }

function lienzoNuevo(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}
const ctx2d = (c: HTMLCanvasElement) => c.getContext('2d', { willReadFrequently: true })!

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, no) => {
    const i = new Image()
    i.onload = () => ok(i)
    i.onerror = no
    i.src = src
  })
}

export const foto: Programa = {
  id: 'foto',
  nombre: 'Foto',
  icono: '🖼️',
  ancho: 1180,
  alto: 740,
  abrir(win, archivoId) {
    let W = 800
    let H = 600
    let capas: Capa[] = []
    let activa = 0
    let herramienta: Herramienta = 'pincel'
    let principal = '#e53935'
    let secundario = '#ffffff'
    let tamano = 20
    let opacidad = 1
    let tolerancia = 32
    let tamTexto = 48
    let sel: Rect | null = null
    let archivo: fs.Archivo | null = null
    const hechas = new Set<string>() // lo que ya hizo (para el guía de las misiones)
    const hizo = (a: string) => hechas.add(a)
    let cambios = false
    const atras: Paso[] = []
    const adelante: Paso[] = []
    let vista = { k: 1, ox: 0, oy: 0 }
    let raton: [number, number] | null = null // en coordenadas de la imagen
    let espacio = false
    let filtroPrevio = '' // ajuste que se está probando sobre la capa activa
    // Trazo en curso (pincel/borrador): se pinta aparte y se pega al soltar, así la opacidad no se acumula.
    const trazo = lienzoNuevo(W, H)
    let trazando = false
    let desplazamiento: [number, number] | null = null // mover capa en curso
    let selNueva: Rect | null = null
    let ultimoPunto: [number, number] | null = null

    const capa = () => capas[activa]
    const nuevoIdCapa = () => fs.nuevoId()

    // ---------- Armado
    const raiz = el('div', 'foto')
    const menu = barraMenu([
      {
        titulo: 'Archivo',
        items: [
          { texto: 'Nueva imagen…', atajo: 'Ctrl+N', accion: () => nueva() },
          { texto: 'Abrir…', atajo: 'Ctrl+O', accion: () => abrirOtro() },
          { texto: 'Abrir una foto de la compu…', accion: () => abrirDeLaCompu() },
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
          { texto: 'Copiar', atajo: 'Ctrl+C', accion: () => copiar() },
          { texto: 'Pegar como capa nueva', atajo: 'Ctrl+V', accion: () => pegar(), activo: () => !!portapapeles || !!deOtro('foto') },
          { texto: 'Borrar lo seleccionado', atajo: 'Supr', accion: () => borrarSeleccion() },
          { texto: 'Rellenar con el color', atajo: 'Alt+Supr', accion: () => rellenarSeleccion() },
        ],
      },
      {
        titulo: 'Imagen',
        items: [
          { texto: 'Brillo, contraste y color…', accion: () => ajustes() },
          { texto: 'Blanco y negro', accion: () => aplicarFiltro('grayscale(100%)') },
          { texto: 'Sepia (foto antigua)', accion: () => aplicarFiltro('sepia(100%)') },
          { texto: 'Invertir colores', accion: () => aplicarFiltro('invert(100%)') },
          { texto: 'Desenfocar', accion: () => aplicarFiltro('blur(3px)') },
          '-',
          { texto: 'Recortar a la selección', accion: () => recortar(), activo: () => !!sel },
          { texto: 'Girar 90° a la derecha', accion: () => girar() },
          { texto: 'Espejar (dar vuelta)', accion: () => espejar() },
        ],
      },
      {
        titulo: 'Capa',
        items: [
          { texto: 'Capa nueva', atajo: 'Ctrl+Mayús+N', accion: () => capaNueva() },
          { texto: 'Duplicar capa', atajo: 'Ctrl+J', accion: () => duplicarCapa() },
          { texto: 'Borrar capa', accion: () => borrarCapa(), activo: () => capas.length > 1 },
          { texto: 'Combinar con la de abajo', atajo: 'Ctrl+E', accion: () => combinarAbajo(), activo: () => activa > 0 },
          '-',
          { texto: 'Meter una imagen de Mis cosas…', accion: () => importarImagen() },
        ],
      },
      {
        titulo: 'Seleccionar',
        items: [
          { texto: 'Todo', atajo: 'Ctrl+A', accion: () => elegirTodo() },
          { texto: 'Nada', atajo: 'Ctrl+D', accion: () => deseleccionar() },
        ],
      },
    ])

    const opciones = el('div', 'ft-opciones')
    const cuerpo = el('div', 'ft-cuerpo')
    const caja = el('div', 'ft-herramientas')
    const zona = el('div', 'ft-zona')
    const vistaC = document.createElement('canvas')
    vistaC.className = 'ft-lienzo'
    zona.append(vistaC)
    const panel = el('div', 'ft-panel')
    cuerpo.append(caja, zona, panel)
    const estado = el('div', 'barra-estado')
    raiz.append(menu, opciones, cuerpo, estado)
    win.cuerpo.append(raiz)
    const archivoFoto = el('input')
    archivoFoto.type = 'file'
    archivoFoto.accept = 'image/*'
    archivoFoto.style.display = 'none'
    raiz.append(archivoFoto)

    // ---------- Herramientas y colores
    function dibujarHerramientas() {
      caja.replaceChildren()
      for (const h of HERRAMIENTAS) {
        const b = el('button', 'ft-herr' + (h.id === herramienta ? ' activa' : ''), h.icono)
        b.title = `${h.nombre} (${h.tecla})`
        b.onclick = () => ponerHerramienta(h.id)
        caja.append(b)
      }
      // Color principal y secundario, como en Photoshop.
      const colores = el('div', 'ft-colores')
      const p = el('div', 'ft-color principal')
      const s = el('div', 'ft-color secundario')
      p.style.background = principal
      s.style.background = secundario
      p.title = 'Color principal (clic para elegir otro)'
      s.title = 'Color secundario'
      const elegir = (cual: 'p' | 's') => {
        const i = el('input')
        i.type = 'color'
        i.value = cual === 'p' ? principal : secundario
        i.oninput = () => {
          if (cual === 'p') principal = i.value
          else secundario = i.value
          dibujarHerramientas()
        }
        i.click()
      }
      p.onclick = () => elegir('p')
      s.onclick = () => elegir('s')
      const cambiar = el('button', 'ft-cambiar', '⇄')
      cambiar.title = 'Cambiar (X)'
      cambiar.onclick = intercambiar
      colores.append(s, p, cambiar)
      caja.append(colores)
    }
    function intercambiar() {
      ;[principal, secundario] = [secundario, principal]
      dibujarHerramientas()
    }
    function ponerHerramienta(h: Herramienta) {
      herramienta = h
      dibujarHerramientas()
      dibujarOpciones()
      pedirDibujo()
    }

    function deslizador(texto: string, min: number, max: number, valor: number, poner: (n: number) => void, unidad = '') {
      const l = el('label', 'ft-opcion')
      const r = el('input')
      r.type = 'range'
      r.min = String(min)
      r.max = String(max)
      r.value = String(valor)
      const n = el('span', 'ft-valor', valor + unidad)
      r.oninput = () => {
        poner(Number(r.value))
        n.textContent = r.value + unidad
        pedirDibujo()
      }
      l.append(el('span', '', texto), r, n)
      return l
    }

    function dibujarOpciones() {
      opciones.replaceChildren()
      const h = HERRAMIENTAS.find((x) => x.id === herramienta)!
      opciones.append(el('span', 'ft-op-nombre', `${h.icono} ${h.nombre}`))
      if (herramienta === 'pincel' || herramienta === 'borrador') {
        opciones.append(
          deslizador('Tamaño', 1, 200, tamano, (n) => (tamano = n), ' px'),
          deslizador('Opacidad', 5, 100, Math.round(opacidad * 100), (n) => (opacidad = n / 100), '%'),
          el('span', 'ft-pista', 'Con Mayús hacés una línea recta desde el último punto. [ y ] cambian el tamaño.'),
        )
      } else if (herramienta === 'balde') {
        opciones.append(deslizador('Tolerancia', 0, 255, tolerancia, (n) => (tolerancia = n)), el('span', 'ft-pista', 'Más tolerancia: pinta también los colores parecidos.'))
      } else if (herramienta === 'texto') {
        opciones.append(deslizador('Tamaño', 10, 200, tamTexto, (n) => (tamTexto = n), ' px'), el('span', 'ft-pista', 'Hacé clic donde quieras escribir. El texto queda en una capa nueva.'))
      } else if (herramienta === 'seleccion') {
        opciones.append(el('span', 'ft-pista', 'Arrastrá para elegir una parte. Lo que pintes queda adentro. Ctrl+D para soltar.'))
      } else if (herramienta === 'mover') {
        opciones.append(el('span', 'ft-pista', 'Arrastrá para mover la capa elegida.'))
      } else if (herramienta === 'cuentagotas') {
        opciones.append(el('span', 'ft-pista', 'Hacé clic en la imagen para tomar ese color.'))
      }
      // Paleta rápida: clic = principal, clic derecho = secundario.
      const pal = el('div', 'ft-paleta')
      for (const c of PALETA) {
        const m = el('span', 'cd-color')
        m.style.background = c
        m.title = 'Clic: color principal · Clic derecho: secundario'
        m.onclick = () => {
          principal = c
          dibujarHerramientas()
        }
        m.oncontextmenu = (e) => {
          e.preventDefault()
          secundario = c
          dibujarHerramientas()
        }
        pal.append(m)
      }
      opciones.append(pal)
    }

    // ---------- Panel de capas
    function dibujarCapas() {
      panel.replaceChildren(el('div', 'ft-panel-titulo', 'Capas'))
      const op = el('label', 'ft-opcion')
      const r = el('input')
      r.type = 'range'
      r.min = '0'
      r.max = '100'
      r.value = String(Math.round(capa().opacidad * 100))
      const n = el('span', 'ft-valor', r.value + '%')
      let guardado = false
      r.oninput = () => {
        if (!guardado) {
          guardarTodo()
          guardado = true
        }
        capa().opacidad = Number(r.value) / 100
        n.textContent = r.value + '%'
        pedirDibujo()
      }
      op.append(el('span', '', 'Opacidad'), r, n)
      panel.append(op)
      const lista = el('div', 'ft-capas')
      // Arriba la de más arriba, como en Photoshop.
      for (let i = capas.length - 1; i >= 0; i--) {
        const c = capas[i]
        const fila = el('div', 'ft-capa' + (i === activa ? ' activa' : ''))
        const ojo = el('button', 'ft-ojo', c.visible ? '👁' : '·')
        ojo.title = c.visible ? 'Ocultar' : 'Mostrar'
        ojo.onclick = (e) => {
          e.stopPropagation()
          c.visible = !c.visible
          hizo(c.visible ? 'mostrar' : 'ocultar')
          dibujarCapas()
          pedirDibujo()
        }
        const mini = lienzoNuevo(48, 36)
        mini.className = 'ft-mini'
        const k = Math.min(48 / W, 36 / H)
        const m = ctx2d(mini)
        m.drawImage(c.lienzo, (48 - W * k) / 2, (36 - H * k) / 2, W * k, H * k)
        const nom = el('span', 'ft-capa-nombre', c.nombre)
        nom.ondblclick = async () => {
          const res = await dialogo({ titulo: 'Nombre de la capa', campo: c.nombre, botones: [{ texto: 'Aceptar', valor: 'ok', principal: true }, { texto: 'Cancelar', valor: 'no' }] })
          if (res.boton === 'ok' && res.texto) {
            c.nombre = res.texto
            marcar()
            dibujarCapas()
          }
        }
        fila.append(ojo, mini, nom)
        fila.onclick = () => {
          activa = i
          dibujarCapas()
        }
        lista.append(fila)
      }
      panel.append(lista)
      const botones = el('div', 'ft-capa-botones')
      const b = (t: string, titulo: string, f: () => void) => {
        const x = el('button', 'cd-boton', t)
        x.title = titulo
        x.onclick = f
        botones.append(x)
      }
      b('＋', 'Capa nueva', capaNueva)
      b('⧉', 'Duplicar capa', duplicarCapa)
      b('▲', 'Subir la capa', () => moverCapa(1))
      b('▼', 'Bajar la capa', () => moverCapa(-1))
      b('🗑', 'Borrar capa', borrarCapa)
      panel.append(botones, el('div', 'ft-pista', 'Doble clic en el nombre para cambiarlo.'))
    }

    // ---------- Historia
    function marcar() {
      if (!cambios) {
        cambios = true
        ponerTitulo()
      }
    }
    function empujar(p: Paso) {
      atras.push(p)
      if (atras.length > MAX_PASOS) atras.shift()
      adelante.length = 0
      marcar()
    }
    const fotoPixeles = (c: Capa): Paso => ({ tipo: 'pixeles', capaId: c.id, datos: ctx2d(c.lienzo).getImageData(0, 0, W, H) })
    const fotoTodo = (): Paso => ({
      tipo: 'todo',
      w: W,
      h: H,
      activa,
      capas: capas.map((c) => ({ id: c.id, nombre: c.nombre, visible: c.visible, opacidad: c.opacidad, datos: ctx2d(c.lienzo).getImageData(0, 0, W, H) })),
    })
    const guardarPixeles = () => empujar(fotoPixeles(capa()))
    const guardarTodo = () => empujar(fotoTodo())

    function reponer(p: Paso): Paso {
      if (p.tipo === 'pixeles') {
        const c = capas.find((x) => x.id === p.capaId)
        if (!c) return p
        const inversa = fotoPixeles(c)
        ctx2d(c.lienzo).putImageData(p.datos, 0, 0)
        return inversa
      }
      const inversa = fotoTodo()
      cambiarTamano(p.w, p.h)
      capas = p.capas.map((x) => {
        const l = lienzoNuevo(p.w, p.h)
        ctx2d(l).putImageData(x.datos, 0, 0)
        return { id: x.id, nombre: x.nombre, visible: x.visible, opacidad: x.opacidad, lienzo: l }
      })
      activa = Math.min(p.activa, capas.length - 1)
      return inversa
    }
    function deshacer() {
      const p = atras.pop()
      if (!p) return
      adelante.push(reponer(p))
      marcar()
      todo()
    }
    function rehacer() {
      const p = adelante.pop()
      if (!p) return
      atras.push(reponer(p))
      todo()
    }

    // ---------- Dibujar la pantalla
    let pedido = false
    function pedirDibujo() {
      if (pedido) return
      pedido = true
      requestAnimationFrame(() => {
        pedido = false
        dibujar()
      })
    }
    let hormigas = 0
    const intervalo = setInterval(() => {
      if (sel || selNueva) {
        hormigas = (hormigas + 1) % 16
        pedirDibujo()
      }
    }, 120)

    function dibujar() {
      const dpr = devicePixelRatio || 1
      const zw = zona.clientWidth
      const zh = zona.clientHeight
      if (vistaC.width !== Math.round(zw * dpr) || vistaC.height !== Math.round(zh * dpr)) {
        vistaC.width = Math.round(zw * dpr)
        vistaC.height = Math.round(zh * dpr)
      }
      const g = vistaC.getContext('2d')!
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.fillStyle = '#3c3f41'
      g.fillRect(0, 0, zw, zh)
      const { k, ox, oy } = vista
      // Cuadritos grises = transparente.
      g.save()
      g.beginPath()
      g.rect(ox, oy, W * k, H * k)
      g.clip()
      const t = 10
      for (let y = 0; y < H * k; y += t)
        for (let x = 0; x < W * k; x += t) {
          g.fillStyle = ((x + y) / t) % 2 ? '#d0d0d0' : '#ffffff'
          g.fillRect(ox + x, oy + y, t, t)
        }
      g.imageSmoothingEnabled = k < 2
      capas.forEach((c, i) => {
        if (!c.visible) return
        g.globalAlpha = c.opacidad
        let fuente: CanvasImageSource = c.lienzo
        let dx = 0
        let dy = 0
        if (i === activa) {
          if (trazando && herramienta === 'borrador') {
            const tmp = lienzoNuevo(W, H)
            const tc = ctx2d(tmp)
            tc.drawImage(c.lienzo, 0, 0)
            tc.globalAlpha = opacidad
            tc.globalCompositeOperation = 'destination-out'
            tc.drawImage(trazo, 0, 0)
            fuente = tmp
          }
          if (desplazamiento) [dx, dy] = desplazamiento
          if (filtroPrevio) g.filter = filtroPrevio
        }
        g.drawImage(fuente, ox + dx * k, oy + dy * k, W * k, H * k)
        g.filter = 'none'
        if (i === activa && trazando && herramienta === 'pincel') {
          g.globalAlpha = c.opacidad * opacidad
          g.drawImage(trazo, ox, oy, W * k, H * k)
        }
      })
      g.restore()
      g.globalAlpha = 1
      g.strokeStyle = '#000'
      g.lineWidth = 1
      g.strokeRect(ox - 0.5, oy - 0.5, W * k + 1, H * k + 1)
      // Hormigas de la selección.
      const s = selNueva ?? sel
      if (s) {
        const r = normalizar(s)
        g.lineWidth = 1
        g.setLineDash([5, 5])
        g.strokeStyle = '#fff'
        g.lineDashOffset = 0
        g.strokeRect(ox + r.x * k + 0.5, oy + r.y * k + 0.5, r.w * k, r.h * k)
        g.strokeStyle = '#000'
        g.lineDashOffset = hormigas
        g.strokeRect(ox + r.x * k + 0.5, oy + r.y * k + 0.5, r.w * k, r.h * k)
        g.setLineDash([])
      }
      // Círculo del pincel.
      if (raton && (herramienta === 'pincel' || herramienta === 'borrador')) {
        g.beginPath()
        g.arc(ox + raton[0] * k, oy + raton[1] * k, Math.max(1, (tamano / 2) * k), 0, Math.PI * 2)
        g.strokeStyle = 'rgba(0,0,0,.7)'
        g.stroke()
        g.beginPath()
        g.arc(ox + raton[0] * k, oy + raton[1] * k, Math.max(1, (tamano / 2) * k) + 1, 0, Math.PI * 2)
        g.strokeStyle = 'rgba(255,255,255,.7)'
        g.stroke()
      }
      zona.style.cursor = espacio ? 'grab' : herramienta === 'pincel' || herramienta === 'borrador' ? 'crosshair' : herramienta === 'mover' ? 'move' : herramienta === 'texto' ? 'text' : 'crosshair'
      const pos = raton ? `x: ${Math.round(raton[0])}  y: ${Math.round(raton[1])}   ·   ` : ''
      estado.textContent = `${pos}Imagen de ${W} × ${H}   ·   Zoom ${Math.round(k * 100)}%   ·   Capa: ${capa()?.nombre ?? ''}${sel ? `   ·   Selección ${Math.round(normalizar(sel).w)} × ${Math.round(normalizar(sel).h)}` : ''}`
    }

    function normalizar(r: Rect): Rect {
      return { x: Math.min(r.x, r.x + r.w), y: Math.min(r.y, r.y + r.h), w: Math.abs(r.w), h: Math.abs(r.h) }
    }

    function ajustarVista() {
      const zw = zona.clientWidth
      const zh = zona.clientHeight
      const k = Math.min(1, (zw - 40) / W, (zh - 40) / H)
      vista = { k, ox: (zw - W * k) / 2, oy: (zh - H * k) / 2 }
      pedirDibujo()
    }

    function todo() {
      dibujarCapas()
      pedirDibujo()
    }

    // ---------- Mouse
    const aImagen = (e: { clientX: number; clientY: number }): [number, number] => {
      const r = vistaC.getBoundingClientRect()
      return [(e.clientX - r.left - vista.ox) / vista.k, (e.clientY - r.top - vista.oy) / vista.k]
    }

    function recortarAlaSeleccion(g: CanvasRenderingContext2D) {
      if (!sel) return
      const r = normalizar(sel)
      g.beginPath()
      g.rect(r.x, r.y, r.w, r.h)
      g.clip()
    }

    zona.addEventListener('contextmenu', (e) => e.preventDefault())
    zona.addEventListener('pointermove', (e) => {
      raton = aImagen(e)
      pedirDibujo()
    })
    zona.addEventListener('pointerleave', () => {
      raton = null
      pedirDibujo()
    })
    zona.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault()
        const r = vistaC.getBoundingClientRect()
        const mx = e.clientX - r.left
        const my = e.clientY - r.top
        const k = Math.min(32, Math.max(0.05, vista.k * (e.deltaY < 0 ? 1.15 : 1 / 1.15)))
        vista.ox = mx - ((mx - vista.ox) / vista.k) * k
        vista.oy = my - ((my - vista.oy) / vista.k) * k
        vista.k = k
        pedirDibujo()
      },
      { passive: false },
    )

    zona.addEventListener('pointerdown', (e) => {
      const p = aImagen(e)
      raton = p
      zona.setPointerCapture(e.pointerId)
      // Mover la vista: botón del medio, derecho, o la barra espaciadora apretada.
      if (e.button === 1 || e.button === 2 || espacio) {
        const x0 = e.clientX - vista.ox
        const y0 = e.clientY - vista.oy
        zona.onpointermove = (m) => {
          vista.ox = m.clientX - x0
          vista.oy = m.clientY - y0
          pedirDibujo()
        }
        zona.onpointerup = () => (zona.onpointermove = zona.onpointerup = null)
        return
      }
      if (e.button !== 0) return
      const c = capa()
      if (herramienta === 'pincel' || herramienta === 'borrador') {
        if (!c.visible) return void aviso('Foto', 'La capa elegida está oculta. Prendé el ojito para pintar en ella.', '👁')
        trazando = true
        const tc = ctx2d(trazo)
        tc.clearRect(0, 0, W, H)
        tc.strokeStyle = tc.fillStyle = principal
        tc.lineWidth = tamano
        tc.lineCap = tc.lineJoin = 'round'
        tc.beginPath()
        if (e.shiftKey && ultimoPunto) {
          tc.moveTo(...ultimoPunto)
          tc.lineTo(...p)
          tc.stroke()
        } else {
          tc.arc(p[0], p[1], tamano / 2, 0, Math.PI * 2)
          tc.fill()
        }
        tc.beginPath()
        tc.moveTo(...p)
        let ult = p
        zona.onpointermove = (m) => {
          raton = aImagen(m)
          tc.lineTo(...raton)
          tc.stroke()
          tc.beginPath()
          tc.moveTo(...raton)
          ult = raton
          pedirDibujo()
        }
        zona.onpointerup = () => {
          zona.onpointermove = zona.onpointerup = null
          guardarPixeles()
          const g = ctx2d(c.lienzo)
          g.save()
          recortarAlaSeleccion(g)
          g.globalAlpha = opacidad
          g.globalCompositeOperation = herramienta === 'borrador' ? 'destination-out' : 'source-over'
          g.drawImage(trazo, 0, 0)
          g.restore()
          trazando = false
          hizo(herramienta + ':capa' + activa)
          ultimoPunto = ult
          todo()
        }
        pedirDibujo()
      } else if (herramienta === 'balde') {
        guardarPixeles()
        const g = ctx2d(c.lienzo)
        const img = g.getImageData(0, 0, W, H)
        rellenar(img, Math.floor(p[0]), Math.floor(p[1]), principal, tolerancia, sel ? normalizar(sel) : null)
        hizo('balde')
        g.putImageData(img, 0, 0)
        todo()
      } else if (herramienta === 'cuentagotas') {
        const plano = aplanar()
        const d = ctx2d(plano).getImageData(Math.floor(p[0]), Math.floor(p[1]), 1, 1).data
        if (d[3]) {
          principal = rgbAHex(d[0], d[1], d[2])
          dibujarHerramientas()
        }
      } else if (herramienta === 'seleccion') {
        selNueva = { x: Math.round(p[0]), y: Math.round(p[1]), w: 0, h: 0 }
        zona.onpointermove = (m) => {
          raton = aImagen(m)
          const x = Math.max(0, Math.min(W, Math.round(raton[0])))
          const y = Math.max(0, Math.min(H, Math.round(raton[1])))
          selNueva = { ...selNueva!, w: x - selNueva!.x, h: y - selNueva!.y }
          pedirDibujo()
        }
        zona.onpointerup = () => {
          zona.onpointermove = zona.onpointerup = null
          const r = normalizar(selNueva!)
          sel = r.w > 2 && r.h > 2 ? r : null
          selNueva = null
          pedirDibujo()
        }
      } else if (herramienta === 'mover') {
        const x0 = p[0]
        const y0 = p[1]
        desplazamiento = [0, 0]
        zona.onpointermove = (m) => {
          raton = aImagen(m)
          desplazamiento = [Math.round(raton[0] - x0), Math.round(raton[1] - y0)]
          pedirDibujo()
        }
        zona.onpointerup = () => {
          zona.onpointermove = zona.onpointerup = null
          const [dx, dy] = desplazamiento!
          desplazamiento = null
          if (dx || dy) {
            guardarPixeles()
            const tmp = lienzoNuevo(W, H)
            ctx2d(tmp).drawImage(c.lienzo, 0, 0)
            const g = ctx2d(c.lienzo)
            g.clearRect(0, 0, W, H)
            g.drawImage(tmp, dx, dy)
          }
          todo()
        }
      } else if (herramienta === 'texto') {
        escribir(p)
      }
    })

    function escribir(p: [number, number]) {
      const input = el('input', 'ft-texto')
      const r = vistaC.getBoundingClientRect()
      const z = zona.getBoundingClientRect()
      input.style.left = r.left - z.left + vista.ox + p[0] * vista.k + 'px'
      input.style.top = r.top - z.top + vista.oy + p[1] * vista.k - tamTexto * vista.k * 0.85 + 'px'
      input.style.fontSize = tamTexto * vista.k + 'px'
      input.style.color = principal
      zona.append(input)
      setTimeout(() => input.focus(), 0)
      let listo = false
      const terminar = (ok: boolean) => {
        if (listo) return
        listo = true
        const t = input.value.trim()
        input.remove()
        if (!ok || !t) return
        guardarTodo()
        const l = lienzoNuevo(W, H)
        const g = ctx2d(l)
        g.font = `bold ${tamTexto}px Nunito, Arial, sans-serif`
        g.fillStyle = principal
        g.fillText(t, p[0], p[1])
        hizo('texto')
        capas.splice(activa + 1, 0, { id: nuevoIdCapa(), nombre: 'Texto: ' + t.slice(0, 14), visible: true, opacidad: 1, lienzo: l })
        activa++
        todo()
      }
      input.onkeydown = (e) => {
        e.stopPropagation()
        if (e.key === 'Enter') terminar(true)
        if (e.key === 'Escape') terminar(false)
      }
      input.onblur = () => terminar(true)
    }

    // ---------- Capas
    function capaNueva() {
      guardarTodo()
      const n = capas.length
      capas.splice(activa + 1, 0, { id: nuevoIdCapa(), nombre: `Capa ${n}`, visible: true, opacidad: 1, lienzo: lienzoNuevo(W, H) })
      activa++
      todo()
    }
    function duplicarCapa() {
      guardarTodo()
      const c = capa()
      const l = lienzoNuevo(W, H)
      ctx2d(l).drawImage(c.lienzo, 0, 0)
      capas.splice(activa + 1, 0, { ...c, id: nuevoIdCapa(), nombre: c.nombre + ' copia', lienzo: l })
      activa++
      todo()
    }
    function borrarCapa() {
      if (capas.length < 2) return
      guardarTodo()
      capas.splice(activa, 1)
      activa = Math.max(0, activa - 1)
      todo()
    }
    function moverCapa(d: number) {
      const j = activa + d
      if (j < 0 || j >= capas.length) return
      guardarTodo()
      ;[capas[activa], capas[j]] = [capas[j], capas[activa]]
      activa = j
      todo()
    }
    function combinarAbajo() {
      if (activa < 1) return
      guardarTodo()
      const arriba = capas[activa]
      const abajo = capas[activa - 1]
      const g = ctx2d(abajo.lienzo)
      g.globalAlpha = arriba.visible ? arriba.opacidad : 0
      g.drawImage(arriba.lienzo, 0, 0)
      g.globalAlpha = 1
      capas.splice(activa, 1)
      activa--
      todo()
    }

    /** Todas las capas visibles juntas en una sola imagen. */
    function aplanar(fondo?: string): HTMLCanvasElement {
      const l = lienzoNuevo(W, H)
      const g = ctx2d(l)
      if (fondo) {
        g.fillStyle = fondo
        g.fillRect(0, 0, W, H)
      }
      for (const c of capas) {
        if (!c.visible) continue
        g.globalAlpha = c.opacidad
        g.drawImage(c.lienzo, 0, 0)
      }
      g.globalAlpha = 1
      return l
    }

    // ---------- Selección
    let portapapeles: HTMLCanvasElement | null = null
    function elegirTodo() {
      sel = { x: 0, y: 0, w: W, h: H }
      pedirDibujo()
    }
    function deseleccionar() {
      sel = null
      pedirDibujo()
    }
    function borrarSeleccion() {
      if (!sel) return
      guardarPixeles()
      const r = normalizar(sel)
      ctx2d(capa().lienzo).clearRect(r.x, r.y, r.w, r.h)
      todo()
    }
    function rellenarSeleccion() {
      const r = sel ? normalizar(sel) : { x: 0, y: 0, w: W, h: H }
      guardarPixeles()
      const g = ctx2d(capa().lienzo)
      g.fillStyle = principal
      g.fillRect(r.x, r.y, r.w, r.h)
      todo()
    }
    function copiar() {
      const r = sel ? normalizar(sel) : { x: 0, y: 0, w: W, h: H }
      if (r.w < 1 || r.h < 1) return
      portapapeles = lienzoNuevo(r.w, r.h)
      ctx2d(portapapeles).drawImage(capa().lienzo, -r.x, -r.y)
      copiarImagen(portapapeles.toDataURL('image/png'), 'foto')
      estado.textContent = 'Copiado. Ctrl+V lo pega en una capa nueva.'
    }
    function pegar() {
      const otro = deOtro('foto')
      if (otro?.tipo === 'imagen') {
        cargarImagen(otro.url).then((img) => {
          const k = Math.min(1, (W * 0.9) / (img.naturalWidth || W), (H * 0.9) / (img.naturalHeight || H))
          portapapeles = lienzoNuevo(Math.max(1, Math.round((img.naturalWidth || W) * k)), Math.max(1, Math.round((img.naturalHeight || H) * k)))
          ctx2d(portapapeles).drawImage(img, 0, 0, portapapeles.width, portapapeles.height)
          copiarImagen(portapapeles.toDataURL('image/png'), 'foto')
          pegarLienzo()
        })
        return
      }
      pegarLienzo()
    }
    function pegarLienzo() {
      if (!portapapeles) return
      guardarTodo()
      const l = lienzoNuevo(W, H)
      const r = sel ? normalizar(sel) : { x: (W - portapapeles.width) / 2, y: (H - portapapeles.height) / 2 }
      ctx2d(l).drawImage(portapapeles, Math.round(r.x), Math.round(r.y))
      capas.splice(activa + 1, 0, { id: nuevoIdCapa(), nombre: 'Pegado', visible: true, opacidad: 1, lienzo: l })
      activa++
      ponerHerramienta('mover')
      todo()
    }

    // ---------- Imagen
    function cambiarTamano(w: number, h: number) {
      W = w
      H = h
      trazo.width = w
      trazo.height = h
    }
    function transformar(nw: number, nh: number, f: (g: CanvasRenderingContext2D, c: HTMLCanvasElement) => void) {
      guardarTodo()
      capas = capas.map((c) => {
        const l = lienzoNuevo(nw, nh)
        f(ctx2d(l), c.lienzo)
        return { ...c, lienzo: l }
      })
      cambiarTamano(nw, nh)
      sel = null
      ajustarVista()
      todo()
    }
    function recortar() {
      if (!sel) return
      const r = normalizar(sel)
      transformar(Math.round(r.w), Math.round(r.h), (g, c) => g.drawImage(c, -Math.round(r.x), -Math.round(r.y)))
    }
    function girar() {
      const w = W
      const h = H
      transformar(h, w, (g, c) => {
        g.translate(h, 0)
        g.rotate(Math.PI / 2)
        g.drawImage(c, 0, 0)
      })
    }
    function espejar() {
      transformar(W, H, (g, c) => {
        g.translate(W, 0)
        g.scale(-1, 1)
        g.drawImage(c, 0, 0)
      })
    }

    function aplicarFiltro(filtro: string) {
      hizo('filtro:' + filtro.split('(')[0])
      guardarPixeles()
      const c = capa()
      const tmp = lienzoNuevo(W, H)
      ctx2d(tmp).drawImage(c.lienzo, 0, 0)
      const g = ctx2d(c.lienzo)
      g.save()
      if (sel) {
        // Solo adentro de la selección.
        recortarAlaSeleccion(g)
      }
      g.clearRect(0, 0, W, H)
      g.filter = filtro
      g.drawImage(tmp, 0, 0)
      g.restore()
      if (sel) {
        // Afuera de la selección queda como estaba.
        const r = normalizar(sel)
        const g2 = ctx2d(c.lienzo)
        g2.save()
        g2.beginPath()
        g2.rect(0, 0, W, H)
        g2.rect(r.x, r.y, r.w, r.h)
        g2.clip('evenodd')
        g2.clearRect(0, 0, W, H)
        g2.drawImage(tmp, 0, 0)
        g2.restore()
      }
      todo()
    }

    async function ajustes() {
      const valores = { brillo: 100, contraste: 100, saturacion: 100 }
      const filtro = () => `brightness(${valores.brillo}%) contrast(${valores.contraste}%) saturate(${valores.saturacion}%)`
      const cont = el('div', 'ft-ajustes')
      const fila = (t: string, k: keyof typeof valores) => {
        const l = el('label', 'ft-opcion ancha')
        const r = el('input')
        r.type = 'range'
        r.min = '0'
        r.max = '200'
        r.value = '100'
        const n = el('span', 'ft-valor', '100%')
        r.oninput = () => {
          valores[k] = Number(r.value)
          n.textContent = r.value + '%'
          filtroPrevio = filtro()
          pedirDibujo()
        }
        l.append(el('span', '', t), r, n)
        cont.append(l)
      }
      fila('Brillo', 'brillo')
      fila('Contraste', 'contraste')
      fila('Color (saturación)', 'saturacion')
      const r = await dialogo({
        titulo: 'Brillo, contraste y color',
        contenido: cont,
        botones: [
          { texto: 'Aplicar', valor: 'ok', principal: true },
          { texto: 'Cancelar', valor: 'no' },
        ],
      })
      filtroPrevio = ''
      if (r.boton === 'ok') aplicarFiltro(filtro())
      else pedirDibujo()
    }

    // ---------- Archivo
    function empezar(w: number, h: number, fondo: HTMLCanvasElement | string | null, a: fs.Archivo | null, nombreFondo = 'Fondo') {
      cambiarTamano(w, h)
      const l = lienzoNuevo(w, h)
      const g = ctx2d(l)
      if (typeof fondo === 'string') {
        g.fillStyle = fondo
        g.fillRect(0, 0, w, h)
      } else if (fondo) g.drawImage(fondo, 0, 0, w, h)
      capas = [{ id: nuevoIdCapa(), nombre: nombreFondo, visible: true, opacidad: 1, lienzo: l }]
      activa = 0
      sel = null
      archivo = a
      cambios = false
      atras.length = 0
      adelante.length = 0
      ponerTitulo()
      ajustarVista()
      todo()
    }

    async function nueva() {
      if (!(await puedeSeguir())) return
      const r = await dialogo({
        titulo: 'Nueva imagen',
        icono: '🖼️',
        mensaje: '¿Qué forma tiene?',
        botones: [
          { texto: 'Acostada 800 × 600', valor: '800x600', principal: true },
          { texto: 'Parada 600 × 800', valor: '600x800' },
          { texto: 'Cuadrada 700 × 700', valor: '700x700' },
          { texto: 'Cancelar', valor: 'cancelar' },
        ],
      })
      if (r.boton === 'cancelar') return
      const [w, h] = r.boton.split('x').map(Number)
      empezar(w, h, '#ffffff', null)
    }

    async function abrirDeLaCompu() {
      if (!(await puedeSeguir())) return
      archivoFoto.value = ''
      archivoFoto.onchange = async () => {
        const f = archivoFoto.files?.[0]
        if (!f) return
        const url = URL.createObjectURL(f)
        try {
          const img = await cargarImagen(url)
          const k = Math.min(1, MAX_LADO / Math.max(img.width, img.height))
          const c = lienzoNuevo(Math.round(img.width * k), Math.round(img.height * k))
          ctx2d(c).drawImage(img, 0, 0, c.width, c.height)
          empezar(c.width, c.height, c, null, f.name.replace(/\.[^.]+$/, ''))
        } catch {
          aviso('Foto', 'Ese archivo no es una imagen que se pueda abrir.', '⚠️')
        } finally {
          URL.revokeObjectURL(url)
        }
      }
      archivoFoto.click()
    }

    async function importarImagen() {
      const id = await elegirArchivo(PROGRAMAS_CON_IMAGEN, 'Elegí una imagen')
      const a = id ? fs.buscar(id) : null
      if (!a) return
      const url = await imagenDeMisCosas(a.id)
      if (!url) return
      const img = await cargarImagen(url)
      guardarTodo()
      const l = lienzoNuevo(W, H)
      const k = Math.min(W / img.width, H / img.height)
      ctx2d(l).drawImage(img, (W - img.width * k) / 2, (H - img.height * k) / 2, img.width * k, img.height * k)
      capas.splice(activa + 1, 0, { id: nuevoIdCapa(), nombre: a.nombre, visible: true, opacidad: 1, lienzo: l })
      activa++
      hizo('imagen')
      todo()
    }

    const aDato = (c: HTMLCanvasElement) => {
      const webp = c.toDataURL('image/webp', 0.92)
      return webp.startsWith('data:image/webp') ? webp : c.toDataURL('image/png')
    }

    function imprimirEsto() {
      imprimir({ titulo: archivo?.nombre ?? 'Sin nombre', paginas: [{ tipo: 'imagen', contenido: aplanar('#ffffff').toDataURL('image/jpeg', 0.92) }], horizontal: W > H })
    }

    async function guardar(como = false): Promise<boolean> {
      let n = archivo?.nombre
      if (!archivo || como) {
        const sugerido = archivo ? archivo.nombre + ' (copia)' : fs.nombreLibre('Foto', 'foto')
        const x = await pedirNombre('foto', sugerido, '¿Cómo se va a llamar tu imagen?')
        if (!x) return false
        n = x
        archivo = null
      }
      const datos: Datos = { w: W, h: H, capas: capas.map((c) => ({ nombre: c.nombre, visible: c.visible, opacidad: c.opacidad, imagen: aDato(c.lienzo) })) }
      const plano = aplanar('#ffffff')
      const mini = lienzoNuevo(240, Math.round((240 * H) / W))
      ctx2d(mini).drawImage(plano, 0, 0, mini.width, mini.height)
      try {
        archivo = fs.guardar({ id: archivo?.id ?? fs.nuevoId(), nombre: n!, app: 'foto', miniatura: mini.toDataURL('image/jpeg', 0.8) }, datos)
      } catch {
        await aviso('Foto', 'No hay más lugar para guardar. Borrá cosas viejas de la papelera o combiná capas, y probá de nuevo.', '⚠️')
        return false
      }
      cambios = false
      ponerTitulo()
      return true
    }

    async function puedeSeguir(): Promise<boolean> {
      if (!cambios) return true
      const r = await preguntarSiGuarda('Foto', archivo?.nombre ?? 'Sin nombre')
      if (r === 'cancelar') return false
      if (r === 'si') return guardar()
      return true
    }

    async function cargar(id: string) {
      const a = fs.buscar(id)
      const d = fs.leer(id) as Datos | null
      if (!a || !d) return
      cambiarTamano(d.w, d.h)
      capas = await Promise.all(
        d.capas.map(async (c) => {
          const l = lienzoNuevo(d.w, d.h)
          ctx2d(l).drawImage(await cargarImagen(c.imagen), 0, 0)
          return { id: nuevoIdCapa(), nombre: c.nombre, visible: c.visible, opacidad: c.opacidad, lienzo: l }
        }),
      )
      activa = capas.length - 1
      sel = null
      archivo = a
      cambios = false
      atras.length = 0
      adelante.length = 0
      ponerTitulo()
      ajustarVista()
      todo()
    }

    async function abrirOtro() {
      if (!(await puedeSeguir())) return
      const id = await elegirArchivo('foto', 'Abrir una imagen')
      if (id) await cargar(id)
    }

    function ponerTitulo() {
      win.ponerTitulo(`${cambios ? '● ' : ''}${archivo?.nombre ?? 'Sin nombre'} — Foto`)
    }

    // ---------- Teclas (la barra espaciadora apretada = mover la vista, como en Photoshop)
    const soltarTecla = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        espacio = false
        pedirDibujo()
      }
    }
    document.addEventListener('keyup', soltarTecla)

    // ---------- Arranque
    dibujarHerramientas()
    dibujarOpciones()
    const obs = new ResizeObserver(() => pedirDibujo())
    obs.observe(zona)
    setTimeout(() => {
      if (archivoId) cargar(archivoId)
      else empezar(800, 600, '#ffffff', null)
    }, 0)

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
          else if (k === 'n' && e.shiftKey) capaNueva()
          else if (k === 'n') nueva()
          else if (k === 'c') copiar()
          else if (k === 'v') pegar()
          else if (k === 'a') elegirTodo()
          else if (k === 'd') deseleccionar()
          else if (k === 'j') duplicarCapa()
          else if (k === 'e') combinarAbajo()
          else if (k === '0') ajustarVista()
          else return false
          return true
        }
        if (e.key === ' ') {
          espacio = true
          pedirDibujo()
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
          if (e.altKey) rellenarSeleccion()
          else borrarSeleccion()
        } else if (k === 'x') intercambiar()
        else if (k === 'd') {
          principal = '#000000'
          secundario = '#ffffff'
          dibujarHerramientas()
        } else if (e.key === '[' || e.key === ']') {
          tamano = Math.max(1, Math.min(200, tamano + (e.key === ']' ? 5 : -5)))
          dibujarOpciones()
          pedirDibujo()
        } else {
          const h = HERRAMIENTAS.find((x) => x.tecla.toLowerCase() === k)
          if (!h) return false
          ponerHerramienta(h.id)
        }
        return true
      },
      // Para el guía de las misiones.
      api: {
        hizo: (a: string) => hechas.has(a),
        capas: () => capas.length,
        activa: () => activa,
        opacidad: () => capa()?.opacidad ?? 1,
        herramienta: () => herramienta,
        cargar: () => {
          empezar(800, 600, '#ffffff', null)
          hechas.clear()
        },
        guardarComo: (n0: string) => {
          let n = n0
          for (let i = 2; fs.existeNombre(n, 'foto'); i++) n = `${n0} ${i}`
          const datos: Datos = { w: W, h: H, capas: capas.map((c) => ({ nombre: c.nombre, visible: c.visible, opacidad: c.opacidad, imagen: aDato(c.lienzo) })) }
          const plano = aplanar('#ffffff')
          const mini = lienzoNuevo(240, Math.round((240 * H) / W))
          ctx2d(mini).drawImage(plano, 0, 0, mini.width, mini.height)
          archivo = fs.guardar({ id: fs.nuevoId(), nombre: n, app: 'foto', miniatura: mini.toDataURL('image/jpeg', 0.8) }, datos)
          cambios = false
          ponerTitulo()
          return n
        },
      },
      async alCerrar() {
        const ok = await puedeSeguir()
        if (ok) {
          clearInterval(intervalo)
          obs.disconnect()
          document.removeEventListener('keyup', soltarTecla)
        }
        return ok
      },
    }
  },
}
