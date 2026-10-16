// Tablero: planilla de cálculo, la idea de Excel en chiquito.
// Enseña: celdas con nombre (B3), escribir y moverse con Enter/Tab/flechas,
// fórmulas que se recalculan solas, Σ autosuma, arrastrar la esquinita para
// rellenar (y que las fórmulas se corran), formato, y un gráfico de barras.

import { imprimir } from '../../os/imprimir'
import * as fs from '../../os/archivos'
import { pedirNombre, preguntarSiGuarda } from '../../os/documento'
import { elegirArchivo } from '../../os/selector'
import { barraMenu, el } from '../../os/ui'
import type { Programa } from '../../os/ventanas'
import { copiarTexto, deOtro } from '../../os/portapapeles'
import { aNumero, calcularHoja, esError, leerRef, letraCol, moverFormula, nombre, type Valor } from './formulas'

const COLS = 12
const FILAS = 40
const ANCHO = 96
const FONDOS = ['#fff59d', '#c5e1a5', '#b3e5fc', '#f8bbd0', '#ffe0b2', '#e1bee7', '#eeeeee', '']
const LETRAS = ['#000000', '#e53935', '#43a047', '#1e88e5', '#8e24aa', '#fb8c00']
const BARRAS = ['#42a5f5', '#66bb6a', '#ffa726', '#ab47bc', '#ef5350', '#26c6da', '#ffee58', '#8d6e63']

export interface Celda {
  v: string
  b?: boolean
  fondo?: string
  color?: string
  moneda?: boolean
}
export interface Hoja {
  celdas: Record<string, Celda>
  anchos: Record<number, number>
  grafico: string | null // rango, ej. "A1:B6"
}

const EJEMPLOS: { nombre: string; hoja: Hoja }[] = [
  {
    nombre: 'Lista del súper',
    hoja: {
      anchos: { 0: 150 },
      grafico: null,
      celdas: {
        A1: { v: 'Producto', b: true, fondo: '#b3e5fc' }, B1: { v: 'Cantidad', b: true, fondo: '#b3e5fc' },
        C1: { v: 'Precio', b: true, fondo: '#b3e5fc' }, D1: { v: 'Total', b: true, fondo: '#b3e5fc' },
        A2: { v: 'Leche' }, B2: { v: '2' }, C2: { v: '1500', moneda: true }, D2: { v: '=B2*C2', moneda: true },
        A3: { v: 'Pan' }, B3: { v: '1' }, C3: { v: '2000', moneda: true }, D3: { v: '=B3*C3', moneda: true },
        A4: { v: 'Galletitas' }, B4: { v: '3' }, C4: { v: '1200', moneda: true }, D4: { v: '=B4*C4', moneda: true },
        A5: { v: 'Manzanas' }, B5: { v: '6' }, C5: { v: '300', moneda: true },
        A7: { v: 'Total a pagar', b: true }, D7: { v: '=SUMA(D2:D6)', b: true, moneda: true, fondo: '#fff59d' },
      },
    },
  },
  {
    nombre: 'Mis ahorros',
    hoja: {
      anchos: { 0: 130 },
      grafico: 'A1:B7',
      celdas: {
        A1: { v: 'Mes', b: true, fondo: '#c5e1a5' }, B1: { v: 'Ahorré', b: true, fondo: '#c5e1a5' },
        A2: { v: 'Enero' }, B2: { v: '500', moneda: true },
        A3: { v: 'Febrero' }, B3: { v: '800', moneda: true },
        A4: { v: 'Marzo' }, B4: { v: '300', moneda: true },
        A5: { v: 'Abril' }, B5: { v: '1000', moneda: true },
        A6: { v: 'Mayo' }, B6: { v: '700', moneda: true },
        A7: { v: 'Junio' }, B7: { v: '', moneda: true },
        A9: { v: 'Total', b: true }, B9: { v: '=SUMA(B2:B7)', b: true, moneda: true, fondo: '#fff59d' },
        A10: { v: 'Promedio', b: true }, B10: { v: '=PROMEDIO(B2:B7)', moneda: true },
      },
    },
  },
]

const hojaVacia = (): Hoja => ({ celdas: {}, anchos: {}, grafico: null })
const copiar = <T>(x: T): T => JSON.parse(JSON.stringify(x))
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

function mostrar(v: Valor | undefined, c?: Celda): string {
  if (v === undefined || v === '') return ''
  if (esError(v)) return v.error
  if (typeof v === 'number') {
    const t = v.toLocaleString('es-AR', { maximumFractionDigits: c?.moneda ? 2 : 6 })
    return c?.moneda ? '$ ' + t : t
  }
  return v
}

export const tablero: Programa = {
  id: 'tablero',
  nombre: 'Tablero',
  icono: '📊',
  ancho: 1100,
  alto: 700,
  abrir(v, archivoId) {
    let hoja: Hoja = hojaVacia()
    let valores = new Map<string, Valor>()
    let archivo: fs.Archivo | null = null
    let cambios = false
    const atras: string[] = []
    const adelante: string[] = []
    let anc: [number, number] = [0, 0] // donde empezó la selección
    let act: [number, number] = [0, 0] // la celda activa
    let editando = false
    let portapapeles: { celdas: (Celda | null)[][]; desde: [number, number]; cortado: boolean } | null = null

    const rango = () => ({
      c0: Math.min(anc[0], act[0]),
      r0: Math.min(anc[1], act[1]),
      c1: Math.max(anc[0], act[0]),
      r1: Math.max(anc[1], act[1]),
    })

    // ---------- Armado
    const raiz = el('div', 'tablero')
    const menu = barraMenu([
      {
        titulo: 'Archivo',
        items: [
          { texto: 'Nuevo', atajo: 'Ctrl+N', accion: () => nuevo() },
          ...EJEMPLOS.map((e) => ({ texto: 'Nuevo: ' + e.nombre, accion: () => nuevo(e.hoja) })),
          { texto: 'Abrir…', atajo: 'Ctrl+O', accion: () => abrirOtro() },
          '-' as const,
          { texto: 'Guardar', atajo: 'Ctrl+S', accion: () => guardar() },
          { texto: 'Guardar como…', accion: () => guardar(true) },
          '-',
          { texto: 'Imprimir…', atajo: 'Ctrl+P', accion: () => imprimirEsto() },
          '-' as const,
          { texto: 'Cerrar', accion: async () => (await puedeSeguir()) && v.cerrar() },
        ],
      },
      {
        titulo: 'Editar',
        items: [
          { texto: 'Deshacer', atajo: 'Ctrl+Z', accion: () => deshacer(), activo: () => atras.length > 0 },
          { texto: 'Rehacer', atajo: 'Ctrl+Y', accion: () => rehacer(), activo: () => adelante.length > 0 },
          '-',
          { texto: 'Cortar', atajo: 'Ctrl+X', accion: () => cortar() },
          { texto: 'Copiar', atajo: 'Ctrl+C', accion: () => copiarSel() },
          { texto: 'Pegar', atajo: 'Ctrl+V', accion: () => pegar(), activo: () => !!portapapeles || !!deOtro('tablero') },
          '-',
          { texto: 'Borrar el contenido', atajo: 'Supr', accion: () => borrarSel() },
          { texto: 'Borrar el formato', accion: () => formato((c) => ({ v: c.v })) },
        ],
      },
      {
        titulo: 'Insertar',
        items: [
          { texto: 'Gráfico de barras', accion: () => ponerGrafico() },
          { texto: 'Sacar el gráfico', accion: () => sacarGrafico(), activo: () => !!hoja.grafico },
        ],
      },
    ])

    const cinta = el('div', 'tb-cinta')
    const boton = (txt: string, titulo: string, f: () => void, clase = '') => {
      const b = el('button', 'cd-boton ' + clase)
      b.innerHTML = txt
      b.title = titulo
      b.onmousedown = (e) => e.preventDefault()
      b.onclick = () => {
        if (editando) confirmar()
        f()
      }
      return b
    }
    const paleta = (titulo: string, colores: string[], f: (c: string) => void, simbolo: string) => {
      const cont = el('div', 'tb-paleta')
      cont.title = titulo
      cont.append(el('span', 'cd-colores-titulo', simbolo))
      for (const c of colores) {
        const m = el('span', 'cd-color' + (c ? '' : ' sin'))
        m.style.background = c || '#fff'
        if (!c) m.textContent = '✕'
        m.onmousedown = (e) => e.preventDefault()
        m.onclick = () => f(c)
        cont.append(m)
      }
      return cont
    }
    const bNegrita = boton('<b>N</b>', 'Negrita (Ctrl+B)', () => {
      const todas = celdasSel().every((c) => c?.b)
      formato((c) => ({ ...c, b: !todas }))
    })
    const bMoneda = boton('$', 'Pesos', () => {
      const todas = celdasSel().every((c) => c?.moneda)
      formato((c) => ({ ...c, moneda: !todas }))
    })
    cinta.append(
      boton('💾', 'Guardar (Ctrl+S)', () => guardar(), 'grande'),
      el('span', 'tb-sep'),
      boton('Σ', 'Autosuma: suma los números de arriba', () => autosuma(), 'grande sigma'),
      el('span', 'tb-sep'),
      bNegrita,
      bMoneda,
      paleta('Color de fondo', FONDOS, (c) => formato((x) => ({ ...x, fondo: c || undefined })), '🪣'),
      paleta('Color de la letra', LETRAS, (c) => formato((x) => ({ ...x, color: c })), 'A'),
      el('span', 'tb-sep'),
      boton('📊', 'Gráfico de barras con lo elegido', () => ponerGrafico(), 'grande'),
    )

    const barraFormula = el('div', 'tb-formula')
    const cajaNombre = el('div', 'tb-nombre')
    const fx = el('span', 'tb-fx', 'fx')
    const campo = el('input', 'tb-campo')
    campo.spellcheck = false
    barraFormula.append(cajaNombre, fx, campo)

    const cuerpo = el('div', 'tb-cuerpo')
    const scroll = el('div', 'tb-scroll')
    scroll.tabIndex = 0
    const tabla = el('table', 'tb-tabla')
    const colgroup = el('colgroup')
    const marco = el('div', 'tb-marco')
    const manija = el('div', 'tb-manija')
    manija.title = 'Arrastrá para rellenar'
    marco.append(manija)
    const previa = el('div', 'tb-previa')
    const editor = el('input', 'tb-editor')
    editor.spellcheck = false
    scroll.append(tabla, marco, previa, editor)
    const panelGrafico = el('div', 'tb-grafico')
    cuerpo.append(scroll, panelGrafico)
    const estado = el('div', 'barra-estado')
    raiz.append(menu, cinta, barraFormula, cuerpo, estado)
    v.cuerpo.append(raiz)

    // Grilla: encabezados con letras y números, como Excel.
    const tds: HTMLTableCellElement[][] = []
    const ths: HTMLTableCellElement[] = []
    const cols: HTMLTableColElement[] = []
    colgroup.append(el('col'))
    ;(colgroup.firstChild as HTMLElement).style.width = '44px'
    for (let c = 0; c < COLS; c++) {
      const col = el('col')
      cols.push(col)
      colgroup.append(col)
    }
    const thead = el('thead')
    const filaCab = el('tr')
    filaCab.append(el('th', 'tb-esquina'))
    for (let c = 0; c < COLS; c++) {
      const th = el('th', 'tb-col', letraCol(c))
      const agarre = el('div', 'tb-agarre')
      agarre.title = 'Arrastrá para cambiar el ancho'
      agarre.onpointerdown = (e) => anchoColumna(e, c)
      th.append(agarre)
      th.onpointerdown = (e) => {
        if (e.target !== th) return
        terminarEdicion()
        anc = [c, 0]
        act = [c, FILAS - 1]
        pintarSeleccion()
      }
      ths.push(th)
      filaCab.append(th)
    }
    thead.append(filaCab)
    const tbody = el('tbody')
    for (let r = 0; r < FILAS; r++) {
      const tr = el('tr')
      const th = el('th', 'tb-fila', String(r + 1))
      th.onpointerdown = () => {
        terminarEdicion()
        anc = [0, r]
        act = [COLS - 1, r]
        pintarSeleccion()
      }
      tr.append(th)
      tds.push([])
      for (let c = 0; c < COLS; c++) {
        const td = el('td')
        td.dataset.c = String(c)
        td.dataset.r = String(r)
        tds[r].push(td)
        tr.append(td)
      }
      tbody.append(tr)
    }
    tabla.append(colgroup, thead, tbody)

    // ---------- Pintar
    function recalcular() {
      const entradas: Record<string, string> = {}
      for (const k in hoja.celdas) entradas[k] = hoja.celdas[k].v
      valores = calcularHoja(entradas)
    }

    function pintarCeldas() {
      for (let c = 0; c < COLS; c++) cols[c].style.width = (hoja.anchos[c] ?? ANCHO) + 'px'
      for (let r = 0; r < FILAS; r++)
        for (let c = 0; c < COLS; c++) {
          const ref = nombre(c, r)
          const cel = hoja.celdas[ref]
          const val = valores.get(ref)
          const td = tds[r][c]
          td.textContent = mostrar(val, cel)
          td.className = typeof val === 'number' ? 'num' : val && esError(val) ? 'err' : ''
          td.style.fontWeight = cel?.b ? '800' : ''
          td.style.background = cel?.fondo ?? ''
          td.style.color = cel?.color ?? ''
          td.title = cel?.v.startsWith('=') ? cel.v : ''
        }
      pintarGrafico()
    }

    function pintarSeleccion() {
      const { c0, r0, c1, r1 } = rango()
      const a = tds[r0][c0]
      const b = tds[r1][c1]
      marco.style.left = a.offsetLeft - 1 + 'px'
      marco.style.top = a.offsetTop - 1 + 'px'
      marco.style.width = b.offsetLeft + b.offsetWidth - a.offsetLeft + 1 + 'px'
      marco.style.height = b.offsetTop + b.offsetHeight - a.offsetTop + 1 + 'px'
      ths.forEach((t, c) => t.classList.toggle('sel', c >= c0 && c <= c1))
      tbody.querySelectorAll('th').forEach((t, r) => t.classList.toggle('sel', r >= r0 && r <= r1))
      tds.forEach((fila, r) => fila.forEach((td, c) => td.classList.toggle('en-sel', r >= r0 && r <= r1 && c >= c0 && c <= c1 && !(c === act[0] && r === act[1]))))
      const ref = nombre(act[0], act[1])
      cajaNombre.textContent = c0 === c1 && r0 === r1 ? ref : `${nombre(c0, r0)}:${nombre(c1, r1)}`
      if (!editando) campo.value = hoja.celdas[ref]?.v ?? ''
      bNegrita.classList.toggle('activo', !!hoja.celdas[ref]?.b)
      bMoneda.classList.toggle('activo', !!hoja.celdas[ref]?.moneda)
      // Que la celda activa se vea.
      const td = tds[act[1]][act[0]]
      if (td.offsetTop < scroll.scrollTop + 30) scroll.scrollTop = td.offsetTop - 30
      if (td.offsetTop + td.offsetHeight > scroll.scrollTop + scroll.clientHeight) scroll.scrollTop = td.offsetTop + td.offsetHeight - scroll.clientHeight
      if (td.offsetLeft < scroll.scrollLeft + 44) scroll.scrollLeft = td.offsetLeft - 44
      if (td.offsetLeft + td.offsetWidth > scroll.scrollLeft + scroll.clientWidth) scroll.scrollLeft = td.offsetLeft + td.offsetWidth - scroll.clientWidth
      ponerEstado()
    }

    function ponerEstado() {
      // Como Excel: con varias celdas elegidas, la suma y el promedio abajo.
      const { c0, r0, c1, r1 } = rango()
      const nums: number[] = []
      for (let r = r0; r <= r1; r++)
        for (let c = c0; c <= c1; c++) {
          const x = valores.get(nombre(c, r))
          if (typeof x === 'number') nums.push(x)
        }
      if (nums.length > 1) {
        const s = nums.reduce((a, b) => a + b, 0)
        const f = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 })
        estado.textContent = `Suma: ${f(s)}   ·   Promedio: ${f(s / nums.length)}   ·   Cantidad: ${nums.length}`
      } else estado.textContent = editando ? 'Escribiendo… Enter para terminar, Esc para cancelar.' : 'Listo'
    }

    function todo() {
      recalcular()
      pintarCeldas()
      pintarSeleccion()
    }

    // ---------- Historia
    function guardarPaso() {
      atras.push(JSON.stringify(hoja))
      if (atras.length > 200) atras.shift()
      adelante.length = 0
      if (!cambios) {
        cambios = true
        ponerTitulo()
      }
    }
    function deshacer() {
      const p = atras.pop()
      if (p === undefined) return
      adelante.push(JSON.stringify(hoja))
      hoja = JSON.parse(p)
      todo()
    }
    function rehacer() {
      const p = adelante.pop()
      if (p === undefined) return
      atras.push(JSON.stringify(hoja))
      hoja = JSON.parse(p)
      todo()
    }

    // ---------- Escribir en una celda
    function empezarEdicion(texto?: string) {
      const ref = nombre(act[0], act[1])
      editando = true
      const td = tds[act[1]][act[0]]
      editor.style.display = 'block'
      editor.style.left = td.offsetLeft + 'px'
      editor.style.top = td.offsetTop + 'px'
      editor.style.minWidth = td.offsetWidth + 'px'
      editor.style.height = td.offsetHeight + 'px'
      editor.value = texto ?? hoja.celdas[ref]?.v ?? ''
      campo.value = editor.value
      editor.focus()
      editor.setSelectionRange(editor.value.length, editor.value.length)
      ponerEstado()
    }

    function confirmar() {
      if (!editando) return
      const ref = nombre(act[0], act[1])
      let t = editor.value.trim() === '' ? '' : editor.value
      if (t.startsWith('=')) t = t.toUpperCase().replace(/\s+/g, '')
      const viejo = hoja.celdas[ref]
      terminarEdicion()
      if ((viejo?.v ?? '') === t) return
      guardarPaso()
      if (!t && viejo && Object.keys(viejo).length === 1) delete hoja.celdas[ref]
      else hoja.celdas[ref] = { ...viejo, v: t }
      recalcular()
      pintarCeldas()
    }

    function terminarEdicion() {
      if (!editando) return
      editando = false
      editor.style.display = 'none'
      scroll.focus({ preventScroll: true })
    }

    function mover(dc: number, dr: number, extender = false) {
      act = [Math.min(COLS - 1, Math.max(0, act[0] + dc)), Math.min(FILAS - 1, Math.max(0, act[1] + dr))]
      if (!extender) anc = [...act]
      pintarSeleccion()
    }

    /** ¿Se está escribiendo una fórmula en un lugar donde va una celda? (después de =, +, (, ;…) */
    function esperaReferencia(): boolean {
      const t = editor.value.slice(0, editor.selectionStart ?? editor.value.length)
      return t.startsWith('=') && /[=+\-*/(;:]$/.test(t)
    }

    const teclasEdicion = (e: KeyboardEvent, desdeCampo: boolean) => {
      if (e.key === 'Enter') {
        confirmar()
        mover(0, e.shiftKey ? -1 : 1)
      } else if (e.key === 'Tab') {
        confirmar()
        mover(e.shiftKey ? -1 : 1, 0)
      } else if (e.key === 'Escape') {
        terminarEdicion()
        pintarSeleccion()
      } else if (!desdeCampo && e.key.startsWith('Arrow') && !editor.value.startsWith('=') && !e.shiftKey) {
        // Escribiendo un número o texto, las flechas confirman y se mueven (como Excel).
        confirmar()
        const d: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }
        mover(...d[e.key])
      } else return
      e.preventDefault()
    }
    editor.onkeydown = (e) => {
      e.stopPropagation()
      teclasEdicion(e, false)
    }
    editor.oninput = () => {
      campo.value = editor.value
    }
    campo.onfocus = () => {
      if (!editando) {
        empezarEdicion()
        campo.focus()
      }
    }
    campo.oninput = () => {
      editor.value = campo.value
    }
    campo.onkeydown = (e) => {
      e.stopPropagation()
      teclasEdicion(e, true)
    }
    editor.onblur = campo.onblur = () => {
      // Si el foco se fue a otro lado (no al otro campo ni a la grilla), se confirma.
      setTimeout(() => {
        const a = document.activeElement
        if (editando && a !== editor && a !== campo && !v.raiz.contains(a)) confirmar()
      }, 0)
    }

    // ---------- Mouse en la grilla
    const celdaEn = (x: number, y: number): [number, number] | null => {
      const td = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest('td')
      if (!td || !tabla.contains(td)) return null
      return [Number(td.dataset.c), Number(td.dataset.r)]
    }

    tabla.addEventListener('pointerdown', (e) => {
      const td = (e.target as HTMLElement).closest('td')
      if (!td || e.button !== 0) return
      const c = Number(td.dataset.c)
      const r = Number(td.dataset.r)
      if (editando && esperaReferencia()) {
        // Escribiendo una fórmula: el clic pone el nombre de la celda.
        e.preventDefault()
        const i = editor.selectionStart ?? editor.value.length
        editor.value = editor.value.slice(0, i) + nombre(c, r) + editor.value.slice(i)
        campo.value = editor.value
        editor.focus()
        editor.setSelectionRange(i + nombre(c, r).length, i + nombre(c, r).length)
        return
      }
      confirmar()
      if (e.shiftKey) act = [c, r]
      else anc = act = [c, r]
      pintarSeleccion()
      scroll.focus({ preventScroll: true })
      e.preventDefault()
      const mov = (m: PointerEvent) => {
        const p = celdaEn(m.clientX, m.clientY)
        if (p && (p[0] !== act[0] || p[1] !== act[1])) {
          act = p
          pintarSeleccion()
        }
      }
      const fin = () => {
        document.removeEventListener('pointermove', mov)
        document.removeEventListener('pointerup', fin)
      }
      document.addEventListener('pointermove', mov)
      document.addEventListener('pointerup', fin)
    })
    tabla.addEventListener('dblclick', (e) => {
      if ((e.target as HTMLElement).closest('td')) empezarEdicion()
    })

    // ---------- Formato
    function celdasSel(): (Celda | undefined)[] {
      const { c0, r0, c1, r1 } = rango()
      const l: (Celda | undefined)[] = []
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) l.push(hoja.celdas[nombre(c, r)])
      return l
    }
    function formato(f: (c: Celda) => Celda) {
      guardarPaso()
      const { c0, r0, c1, r1 } = rango()
      for (let r = r0; r <= r1; r++)
        for (let c = c0; c <= c1; c++) {
          const ref = nombre(c, r)
          hoja.celdas[ref] = f(hoja.celdas[ref] ?? { v: '' })
        }
      todo()
    }
    function borrarSel() {
      guardarPaso()
      const { c0, r0, c1, r1 } = rango()
      for (let r = r0; r <= r1; r++)
        for (let c = c0; c <= c1; c++) {
          const ref = nombre(c, r)
          if (hoja.celdas[ref]) hoja.celdas[ref].v = ''
        }
      todo()
    }

    function anchoColumna(e: PointerEvent, c: number) {
      e.stopPropagation()
      e.preventDefault()
      guardarPaso()
      const x0 = e.clientX
      const w0 = hoja.anchos[c] ?? ANCHO
      const mov = (m: PointerEvent) => {
        hoja.anchos[c] = Math.max(40, w0 + m.clientX - x0)
        cols[c].style.width = hoja.anchos[c] + 'px'
        pintarSeleccion()
      }
      const fin = () => {
        document.removeEventListener('pointermove', mov)
        document.removeEventListener('pointerup', fin)
      }
      document.addEventListener('pointermove', mov)
      document.addEventListener('pointerup', fin)
    }

    // ---------- Σ Autosuma
    function autosuma() {
      const { c0, r0, c1, r1 } = rango()
      let destino: [number, number]
      let desde: number
      let hasta: number
      if (c0 === c1 && r1 > r0) {
        // Una columna elegida: la suma va abajo.
        destino = [c0, Math.min(FILAS - 1, r1 + 1)]
        desde = r0
        hasta = r1
      } else {
        // Una celda: suma los números que tiene arriba, seguidos.
        destino = [...act]
        hasta = act[1] - 1
        while (hasta >= 0 && typeof valores.get(nombre(act[0], hasta)) !== 'number') hasta--
        desde = hasta
        while (desde - 1 >= 0 && typeof valores.get(nombre(act[0], desde - 1)) === 'number') desde--
        if (hasta < 0) {
          estado.textContent = 'Σ suma los números que hay arriba: poné la celda debajo de una columna de números.'
          return
        }
      }
      guardarPaso()
      const ref = nombre(destino[0], destino[1])
      hoja.celdas[ref] = { ...hoja.celdas[ref], v: `=SUMA(${nombre(destino[0], desde)}:${nombre(destino[0], hasta)})` }
      anc = act = destino
      todo()
    }

    // ---------- Rellenar arrastrando la esquinita
    manija.onpointerdown = (e) => {
      e.stopPropagation()
      e.preventDefault()
      confirmar()
      const { c0, r0, c1, r1 } = rango()
      let hasta: { dir: 'abajo' | 'derecha'; n: number } | null = null
      const mov = (m: PointerEvent) => {
        const p = celdaEn(m.clientX, m.clientY)
        if (!p) return
        const abajo = p[1] - r1
        const der = p[0] - c1
        hasta = abajo > 0 && abajo >= der ? { dir: 'abajo', n: p[1] } : der > 0 ? { dir: 'derecha', n: p[0] } : null
        if (!hasta) return (previa.style.display = 'none')
        const a = tds[r0][c0]
        const b = hasta.dir === 'abajo' ? tds[hasta.n][c1] : tds[r1][hasta.n]
        previa.style.display = 'block'
        previa.style.left = a.offsetLeft + 'px'
        previa.style.top = a.offsetTop + 'px'
        previa.style.width = b.offsetLeft + b.offsetWidth - a.offsetLeft + 'px'
        previa.style.height = b.offsetTop + b.offsetHeight - a.offsetTop + 'px'
      }
      const fin = () => {
        document.removeEventListener('pointermove', mov)
        document.removeEventListener('pointerup', fin)
        previa.style.display = 'none'
        if (hasta) rellenar(hasta.dir, hasta.n)
      }
      document.addEventListener('pointermove', mov)
      document.addEventListener('pointerup', fin)
    }

    function rellenar(dir: 'abajo' | 'derecha', hasta: number) {
      guardarPaso()
      const { c0, r0, c1, r1 } = rango()
      const vertical = dir === 'abajo'
      // Cada columna (o fila) se rellena por separado.
      const lineas = vertical ? [c0, c1] : [r0, r1]
      for (let k = lineas[0]; k <= lineas[1]; k++) {
        const ini = vertical ? r0 : c0
        const fin = vertical ? r1 : c1
        const largo = fin - ini + 1
        const ref = (i: number) => (vertical ? nombre(k, i) : nombre(i, k))
        const fuente = Array.from({ length: largo }, (_, i) => hoja.celdas[ref(ini + i)])
        // Si son dos o más números con el mismo salto (1, 2, 3…), se sigue la serie.
        const nums = fuente.map((c) => (c && !c.v.startsWith('=') ? aNumero(c.v) : null))
        const salto = largo >= 2 && nums.every((n) => n !== null) ? nums[1]! - nums[0]! : null
        const serie = salto !== null && nums.every((n, i) => i === 0 || Math.abs(n! - nums[i - 1]! - salto) < 1e-9)
        for (let i = fin + 1; i <= hasta; i++) {
          const j = (i - ini) % largo
          const src = fuente[j]
          if (!src) {
            delete hoja.celdas[ref(i)]
            continue
          }
          let t = src.v
          if (serie) t = String(nums[largo - 1]! + salto! * (i - fin)).replace('.', ',')
          else if (t.startsWith('=')) {
            const d = i - (ini + j)
            t = vertical ? moverFormula(t, 0, d) : moverFormula(t, d, 0)
          }
          hoja.celdas[ref(i)] = { ...src, v: t }
        }
      }
      if (vertical) act = [c1, hasta]
      else act = [hasta, r1]
      anc = [c0, r0]
      todo()
    }

    // ---------- Copiar y pegar
    function copiarSel(cortado = false) {
      const { c0, r0, c1, r1 } = rango()
      const celdas: (Celda | null)[][] = []
      const lineas: string[] = []
      for (let r = r0; r <= r1; r++) {
        const fila: (Celda | null)[] = []
        const textos: string[] = []
        for (let c = c0; c <= c1; c++) {
          const cel = hoja.celdas[nombre(c, r)]
          fila.push(cel ? copiar(cel) : null)
          textos.push(mostrar(valores.get(nombre(c, r)), cel))
        }
        celdas.push(fila)
        lineas.push(textos.join('\t'))
      }
      portapapeles = { celdas, desde: [c0, r0], cortado }
      // También como texto, para pegarlo en el Cuaderno.
      copiarTexto(lineas.join('\n'), 'tablero')
      estado.textContent = 'Copiado. Elegí dónde y apretá Ctrl+V.'
    }
    function cortar() {
      copiarSel(true)
      borrarSel()
    }
    function pegar() {
      // Texto copiado en otro programa (una lista del Cuaderno): cada renglón va a una fila.
      const otro = deOtro('tablero')
      if (otro?.tipo === 'texto') {
        guardarPaso()
        otro.texto
          .split(/\r?\n/)
          .filter((l) => l.trim()) // los renglones vacíos (entre párrafos) no ocupan casilla
          .forEach((linea, i) =>
            linea.split('\t').forEach((t, j) => {
              const c = act[0] + j
              const r = act[1] + i
              if (c < COLS && r < FILAS) hoja.celdas[nombre(c, r)] = { ...hoja.celdas[nombre(c, r)], v: t.replace(/^\s*[•·\-]\s*/, '').trim() }
            }),
          )
        copiarTexto(otro.texto, 'tablero')
        return todo()
      }
      if (!portapapeles) return
      guardarPaso()
      const dc = act[0] - portapapeles.desde[0]
      const dr = act[1] - portapapeles.desde[1]
      portapapeles.celdas.forEach((fila, i) =>
        fila.forEach((cel, j) => {
          const c = act[0] + j
          const r = act[1] + i
          if (c >= COLS || r >= FILAS) return
          const ref = nombre(c, r)
          if (!cel) delete hoja.celdas[ref]
          // Copiar corre las referencias; cortar y pegar es mudar la celda: la fórmula queda igual (como Excel).
          else hoja.celdas[ref] = { ...cel, v: cel.v.startsWith('=') && !portapapeles!.cortado ? moverFormula(cel.v, dc, dr) : cel.v }
        }),
      )
      // Queda elegido lo pegado.
      anc = [...act]
      act = [Math.min(COLS - 1, act[0] + portapapeles.celdas[0].length - 1), Math.min(FILAS - 1, act[1] + portapapeles.celdas.length - 1)]
      if (portapapeles.cortado) portapapeles = null // lo cortado se pega una sola vez
      todo()
    }

    // ---------- Gráfico
    function ponerGrafico() {
      const { c0, r0, c1, r1 } = rango()
      if (r0 === r1) {
        estado.textContent = 'Para el gráfico, elegí arrastrando una columna de nombres y una de números.'
        return
      }
      guardarPaso()
      hoja.grafico = `${nombre(c0, r0)}:${nombre(c1, r1)}`
      todo()
    }
    function sacarGrafico() {
      guardarPaso()
      hoja.grafico = null
      todo()
    }

    function datosGrafico(): { titulo: string; barras: { nombre: string; valor: number }[] } | null {
      if (!hoja.grafico) return null
      const [a, b] = hoja.grafico.split(':').map((x) => leerRef(x)!)
      const cn = Math.min(a[0], b[0])
      const cv = Math.max(a[0], b[0])
      let titulo = ''
      const barras: { nombre: string; valor: number }[] = []
      for (let r = Math.min(a[1], b[1]); r <= Math.max(a[1], b[1]); r++) {
        const val = valores.get(nombre(cv, r))
        const nom = cn !== cv ? mostrar(valores.get(nombre(cn, r))) : String(r + 1)
        if (typeof val === 'number') barras.push({ nombre: nom, valor: val })
        else if (typeof val === 'string' && val && !barras.length) titulo = val
      }
      return { titulo, barras }
    }

    function pintarGrafico() {
      const d = datosGrafico()
      panelGrafico.style.display = d ? '' : 'none'
      if (!d) return
      const W = 380
      const H = 280
      const abajo = 50
      const arriba = 30
      const max = Math.max(1, ...d.barras.map((b) => b.valor))
      const n = Math.max(1, d.barras.length)
      const paso = (W - 20) / n
      let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`
      s += `<line x1="10" y1="${H - abajo}" x2="${W - 10}" y2="${H - abajo}" stroke="#90a4ae" stroke-width="2"/>`
      d.barras.forEach((b, i) => {
        const h = Math.max(0, (b.valor / max) * (H - abajo - arriba))
        const x = 10 + i * paso + paso * 0.15
        const w = paso * 0.7
        const y = H - abajo - h
        s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${BARRAS[i % BARRAS.length]}"/>`
        s += `<text x="${x + w / 2}" y="${y - 6}" font-size="13" text-anchor="middle" fill="#37474f" font-weight="700">${esc(b.valor.toLocaleString('es-AR', { maximumFractionDigits: 1 }))}</text>`
        s += `<text x="${x + w / 2}" y="${H - abajo + 18}" font-size="13" text-anchor="middle" fill="#37474f">${esc(b.nombre.slice(0, 10))}</text>`
      })
      s += '</svg>'
      panelGrafico.innerHTML = `<div class="tb-graf-titulo">${esc(d.titulo || 'Gráfico')}</div>${s}<div class="tb-graf-pie">Datos de ${hoja.grafico}. Si cambiás los números, el gráfico cambia solo.</div>`
      const sacar = el('button', 'boton chico', 'Sacar el gráfico')
      sacar.onclick = sacarGrafico
      panelGrafico.append(sacar)
    }

    // ---------- Archivo
    function miniatura(): string {
      let s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 420"><rect width="600" height="420" fill="#fff"/>'
      for (let r = 0; r < 10; r++)
        for (let c = 0; c < 6; c++) {
          const cel = hoja.celdas[nombre(c, r)]
          const x = c * 100
          const y = r * 42
          s += `<rect x="${x}" y="${y}" width="100" height="42" fill="${cel?.fondo || '#fff'}" stroke="#cfd8dc"/>`
          const t = mostrar(valores.get(nombre(c, r)), cel)
          if (t) s += `<text x="${x + 6}" y="${y + 28}" font-size="20" font-family="Nunito,Arial" font-weight="${cel?.b ? 800 : 400}" fill="${cel?.color || '#263238'}">${esc(t.slice(0, 9))}</text>`
        }
      return s + '</svg>'
    }

    function imprimirEsto() {
      confirmar()
      // Solo la parte usada de la hoja, como una tabla.
      let ultC = 0
      let ultR = 0
      for (const ref of Object.keys(hoja.celdas)) {
        const p = leerRef(ref)
        const c = hoja.celdas[ref]
        if (p && (c.v || c.fondo)) {
          ultC = Math.max(ultC, p[0])
          ultR = Math.max(ultR, p[1])
        }
      }
      let h = '<table style="border-collapse:collapse;margin:40px;font-size:14pt">'
      for (let r = 0; r <= ultR; r++) {
        h += '<tr>'
        for (let c = 0; c <= ultC; c++) {
          const ref = nombre(c, r)
          const cel = hoja.celdas[ref]
          const val = valores.get(ref)
          h += `<td style="border:1px solid #9e9e9e;padding:4px 10px;min-width:${(hoja.anchos[c] ?? ANCHO) - 20}px;${typeof val === 'number' ? 'text-align:right;' : ''}${cel?.b ? 'font-weight:800;' : ''}${cel?.fondo ? 'background:' + cel.fondo + ';' : ''}${cel?.color ? 'color:' + cel.color + ';' : ''}">${esc(mostrar(val, cel))}</td>`
        }
        h += '</tr>'
      }
      h += '</table>'
      const paginas: { tipo: 'html' | 'imagen'; contenido: string }[] = [{ tipo: 'html', contenido: h }]
      if (hoja.grafico) paginas.push({ tipo: 'html', contenido: `<div style="padding:40px">${panelGrafico.innerHTML.replace(/<button[\s\S]*?<\/button>/g, '')}</div>` })
      imprimir({ titulo: archivo?.nombre ?? 'Sin nombre', paginas, horizontal: ultC > 6 })
    }

    async function guardar(como = false): Promise<boolean> {
      confirmar()
      let n = archivo?.nombre
      if (!archivo || como) {
        const sugerido = archivo ? archivo.nombre + ' (copia)' : fs.nombreLibre('Tablero', 'tablero')
        const x = await pedirNombre('tablero', sugerido, '¿Cómo se va a llamar tu tablero?')
        if (!x) return false
        n = x
        archivo = null
      }
      archivo = fs.guardar({ id: archivo?.id ?? fs.nuevoId(), nombre: n!, app: 'tablero', miniatura: miniatura() }, hoja)
      cambios = false
      ponerTitulo()
      return true
    }

    async function puedeSeguir(): Promise<boolean> {
      confirmar()
      if (!cambios || !Object.keys(hoja.celdas).length) return true
      const r = await preguntarSiGuarda('Tablero', archivo?.nombre ?? 'Sin nombre')
      if (r === 'cancelar') return false
      if (r === 'si') return guardar()
      return true
    }

    function cargarHoja(h: Hoja, a: fs.Archivo | null) {
      hoja = copiar({ ...hojaVacia(), ...h })
      archivo = a
      cambios = false
      atras.length = 0
      adelante.length = 0
      anc = act = [0, 0]
      ponerTitulo()
      todo()
    }

    async function nuevo(desde?: Hoja) {
      if (!(await puedeSeguir())) return
      cargarHoja(desde ?? hojaVacia(), null)
    }

    async function abrirOtro() {
      if (!(await puedeSeguir())) return
      const id = await elegirArchivo('tablero', 'Abrir un tablero')
      if (!id) return
      const h = fs.leer(id) as Hoja | null
      if (h) cargarHoja(h, fs.buscar(id) ?? null)
    }

    function ponerTitulo() {
      v.ponerTitulo(`${cambios ? '● ' : ''}${archivo?.nombre ?? 'Sin nombre'} — Tablero`)
    }

    // ---------- Arranque
    if (archivoId) {
      const h = fs.leer(archivoId) as Hoja | null
      cargarHoja(h ?? hojaVacia(), h ? fs.buscar(archivoId) ?? null : null)
    } else cargarHoja(hojaVacia(), null)
    v.raiz.addEventListener('redimensionar', () => pintarSeleccion())
    setTimeout(() => {
      pintarSeleccion()
      scroll.focus({ preventScroll: true })
    }, 0)

    return {
      alTecla(e) {
        if (editando) return false
        const ctrl = e.ctrlKey || e.metaKey
        const k = e.key.toLowerCase()
        if (ctrl) {
          if (k === 'z') deshacer()
          else if (k === 'y') rehacer()
          else if (k === 'c') copiarSel()
          else if (k === 'x') cortar()
          else if (k === 'v') pegar()
          else if (k === 'b') bNegrita.click()
          else if (k === 's') guardar()
          else if (k === 'p') imprimirEsto()
          else if (k === 'o') abrirOtro()
          else if (k === 'n') nuevo()
          else return false
          return true
        }
        const d: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }
        if (d[e.key]) mover(...d[e.key], e.shiftKey)
        else if (e.key === 'Enter') mover(0, e.shiftKey ? -1 : 1)
        else if (e.key === 'Tab') mover(e.shiftKey ? -1 : 1, 0)
        else if (e.key === 'Delete' || e.key === 'Backspace') borrarSel()
        else if (e.key === 'F2') empezarEdicion()
        else if (e.key.length === 1 && !e.altKey) {
          anc = [...act]
          pintarSeleccion()
          empezarEdicion(e.key)
        } else return false
        return true
      },
      alCerrar: puedeSeguir,
      // Para el guía de las misiones: mirar y preparar la hoja sin pasar por los menús.
      api: {
        celda: (ref: string) => ({ v: hoja.celdas[ref]?.v ?? '', valor: valores.get(ref), fondo: hoja.celdas[ref]?.fondo, moneda: !!hoja.celdas[ref]?.moneda, b: !!hoja.celdas[ref]?.b }),
        activa: () => nombre(act[0], act[1]),
        seleccion: () => {
          const { c0, r0, c1, r1 } = rango()
          return c0 === c1 && r0 === r1 ? nombre(c0, r0) : `${nombre(c0, r0)}:${nombre(c1, r1)}`
        },
        editando: () => editando,
        grafico: () => hoja.grafico,
        cargar: (h: Hoja) => cargarHoja(h, null),
        poner: (ref: string, c: Partial<Celda>) => {
          hoja.celdas[ref] = { ...(hoja.celdas[ref] ?? { v: '' }), ...c }
          todo()
        },
        guardarComo: (nombreArchivo: string) => {
          let n = nombreArchivo
          for (let i = 2; fs.existeNombre(n, 'tablero'); i++) n = `${nombreArchivo} ${i}`
          archivo = fs.guardar({ id: fs.nuevoId(), nombre: n, app: 'tablero', miniatura: miniatura() }, hoja)
          cambios = false
          ponerTitulo()
          return n
        },
      },
    }
  },
}
