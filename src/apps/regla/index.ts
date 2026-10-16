// Regla: dibujo técnico, la idea de AutoCAD en chiquito.
// Enseña: medidas de verdad (en metros), línea de comandos (L, REC, C, COT…),
// escribir la medida en vez de adivinarla, ORTO, referencias a objetos
// (punta, medio, centro), capas con colores, elegir con ventana, cotas.

import { imprimir } from '../../os/imprimir'
import * as fs from '../../os/archivos'
import { pedirNombre, preguntarSiGuarda } from '../../os/documento'
import { elegirArchivo } from '../../os/selector'
import { barraMenu, el } from '../../os/ui'
import type { Programa } from '../../os/ventanas'
import {
  aMundo, aPantalla, caja, CAPAS, dist, distancia, medidaTexto, moverEnt, pasoRejilla, puntosNotables,
  svgDibujo, svgEnt, svgRejilla, vistaTodo, type Ent, type P, type Vista,
} from './geometria'

class Cancelado extends Error {}

interface Comando {
  nombre: string
  icono: string
  alias: string[]
  ayuda: string
}
const COMANDOS: Comando[] = [
  { nombre: 'LINEA', icono: '╱', alias: ['L', 'LINEA', 'LINE'], ayuda: 'Línea' },
  { nombre: 'RECTANG', icono: '▭', alias: ['REC', 'RECTANG', 'RECTANGULO', 'RECTANG'], ayuda: 'Rectángulo' },
  { nombre: 'CIRCULO', icono: '◯', alias: ['C', 'CIRCULO', 'CIRCLE'], ayuda: 'Círculo' },
  { nombre: 'COTA', icono: '↔', alias: ['COT', 'COTA', 'ACOTAR', 'DIM'], ayuda: 'Cota (medida)' },
  { nombre: 'TEXTO', icono: 'A', alias: ['T', 'TEXTO', 'TEXT'], ayuda: 'Texto' },
  { nombre: 'DESPLAZA', icono: '✥', alias: ['D', 'M', 'DESPLAZA', 'MOVER', 'MOVE'], ayuda: 'Mover' },
  { nombre: 'COPIA', icono: '⧉', alias: ['CO', 'CP', 'COPIA', 'COPIAR', 'COPY'], ayuda: 'Copiar' },
  { nombre: 'BORRA', icono: '🗑', alias: ['B', 'E', 'BORRA', 'BORRAR', 'ERASE'], ayuda: 'Borrar' },
  { nombre: 'ZOOM', icono: '⛶', alias: ['Z', 'ZOOM'], ayuda: 'Ver todo' },
]

interface Datos {
  ents: Ent[]
}

export const regla: Programa = {
  id: 'regla',
  nombre: 'Regla',
  icono: '📐',
  ancho: 1120,
  alto: 720,
  abrir(win, archivoId) {
    let ents: Ent[] = []
    let elegidos = new Set<string>()
    let capa = 0
    let archivo: fs.Archivo | null = null
    const hechas = new Set<string>() // lo que ya hizo (para el guía de las misiones)
    let cambios = false
    const atras: string[] = []
    const adelante: string[] = []
    let vista: Vista = { cx: 250, cy: 150, k: 1.5, w: 800, h: 500 }
    let cursor: P = { x: 0, y: 0 } // ya ajustado (referencias, rejilla, orto)
    let cursorPantalla: [number, number] | null = null
    let marcaRef: { p: P; tipo: string } | null = null
    const modos = { rejilla: true, forzc: false, orto: false, refent: true }
    let ultimo = ''
    let corriendo = '' // comando en marcha
    let vuelta = 0 // para que un comando cancelado no limpie al que arrancó después

    // Lo que está esperando el comando en marcha.
    let pendiente:
      | { tipo: 'punto'; base?: P; previa?: (p: P) => Ent[]; vacio?: boolean; cerrar?: P; ok: (p: P | null) => void; no: (e: Error) => void }
      | { tipo: 'texto'; ok: (t: string) => void; no: (e: Error) => void }
      | { tipo: 'seleccion'; ok: () => void; no: (e: Error) => void }
      | null = null
    let ventanaSel: { a: [number, number]; b: [number, number] } | null = null

    // ---------- Armado
    const raiz = el('div', 'regla')
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
          { texto: 'Cerrar', accion: async () => (await puedeSeguir()) && win.cerrar() },
        ],
      },
      {
        titulo: 'Editar',
        items: [
          { texto: 'Deshacer', atajo: 'Ctrl+Z', accion: () => deshacer(), activo: () => atras.length > 0 },
          { texto: 'Rehacer', atajo: 'Ctrl+Y', accion: () => rehacer(), activo: () => adelante.length > 0 },
          '-',
          { texto: 'Borrar lo elegido', atajo: 'Supr', accion: () => borrarElegidos(), activo: () => elegidos.size > 0 },
          { texto: 'Elegir todo', atajo: 'Ctrl+A', accion: () => elegirTodo() },
        ],
      },
      {
        titulo: 'Dibujo',
        items: COMANDOS.map((c) => ({ texto: c.ayuda, atajo: c.alias[0], accion: () => lanzar(c.nombre) })),
      },
    ])

    const barra = el('div', 'rg-barra')
    for (const c of COMANDOS) {
      const b = el('button', 'rg-herr')
      b.append(el('span', 'rg-herr-icono', c.icono), el('span', 'rg-herr-texto', c.ayuda))
      b.title = `${c.ayuda} (${c.alias[0]})`
      b.dataset.cmd = c.nombre
      b.onmousedown = (e) => e.preventDefault()
      b.onclick = () => lanzar(c.nombre)
      barra.append(b)
    }
    const selCapa = el('select', 'rg-capa')
    CAPAS.forEach((c, i) => {
      const o = el('option', '', '■ ' + c.nombre)
      o.value = String(i)
      o.style.color = c.color
      selCapa.append(o)
    })
    selCapa.title = 'Capa: los objetos nuevos van a esta capa. Si hay algo elegido, se pasa a esta capa.'
    selCapa.onchange = () => {
      capa = Number(selCapa.value)
      if (elegidos.size) {
        guardarPaso()
        ents = ents.map((e) => (elegidos.has(e.id) ? { ...e, capa } : e))
        dibujar()
      }
      linea.focus()
    }
    const capaCaja = el('label', 'rg-capa-caja')
    capaCaja.append(el('span', '', 'Capa'), selCapa)
    barra.append(capaCaja)

    const zona = el('div', 'rg-zona')
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.classList.add('rg-svg')
    zona.append(svg)
    // Entrada dinámica: lo que pide el comando y lo que se escribe, al lado del cursor (como en AutoCAD).
    const dinamica = el('div', 'rg-dinamica')
    zona.append(dinamica)

    const consola = el('div', 'rg-consola')
    const historia = el('div', 'rg-historia')
    const filaCmd = el('div', 'rg-fila-cmd')
    const pregunta = el('span', 'rg-pregunta', 'Comando:')
    const linea = el('input', 'rg-linea')
    linea.spellcheck = false
    filaCmd.append(pregunta, linea)
    consola.append(historia, filaCmd)

    const estado = el('div', 'rg-estado')
    const coords = el('span', 'rg-coords')
    const botonesModo = el('span', 'rg-modos')
    estado.append(coords, botonesModo)
    raiz.append(menu, barra, zona, consola, estado)
    win.cuerpo.append(raiz)

    // ---------- Línea de comandos
    function decir(t: string) {
      const l = el('div', '', t)
      historia.append(l)
      while (historia.children.length > 40) historia.firstChild?.remove()
      historia.scrollTop = historia.scrollHeight
    }
    function preguntar(t: string) {
      pregunta.textContent = t
    }

    const pedirPunto = (msg: string, o: { base?: P; previa?: (p: P) => Ent[]; vacio?: boolean; cerrar?: P } = {}) =>
      new Promise<P | null>((ok, no) => {
        preguntar(msg)
        pendiente = { tipo: 'punto', ...o, ok, no }
        dibujar()
      })
    const pedirTexto = (msg: string) =>
      new Promise<string>((ok, no) => {
        preguntar(msg)
        pendiente = { tipo: 'texto', ok, no }
      })
    async function pedirSeleccion(msg: string) {
      if (elegidos.size) return
      await new Promise<void>((ok, no) => {
        preguntar(msg)
        pendiente = { tipo: 'seleccion', ok, no }
      })
      if (!elegidos.size) throw new Cancelado()
    }

    function resolverPunto(p: P | null) {
      if (pendiente?.tipo !== 'punto') return
      const r = pendiente.ok
      pendiente = null
      r(p)
    }

    /** Lo escrito en la línea de comandos. */
    function entrada(t: string) {
      const texto = t.trim()
      linea.value = ''
      if (pendiente?.tipo === 'texto') {
        decir(pregunta.textContent + ' ' + t)
        const r = pendiente.ok
        pendiente = null
        return r(t)
      }
      if (pendiente?.tipo === 'seleccion') {
        const r = pendiente.ok
        pendiente = null
        return r()
      }
      if (pendiente?.tipo === 'punto') {
        decir(pregunta.textContent + ' ' + texto)
        if (!texto) {
          if (pendiente.vacio) resolverPunto(null)
          return
        }
        if (texto.toUpperCase() === 'C' && pendiente.cerrar) return resolverPunto(pendiente.cerrar)
        const p = leerPunto(texto, pendiente.base)
        if (p) resolverPunto(p)
        else decir('No entendí. Escribí una medida en metros (ej. 3 o 2,5), o @ancho;alto (ej. @3;2).')
        return
      }
      // Sin comando en marcha: Enter solo repite el último.
      if (!texto) {
        if (ultimo) lanzar(ultimo)
        return
      }
      const c = COMANDOS.find((x) => x.alias.includes(texto.toUpperCase()))
      if (c) lanzar(c.nombre)
      else if (['H', 'U', 'DESHACER'].includes(texto.toUpperCase())) deshacer()
      else decir(`"${texto}" no es un comando. Probá con L (línea), REC, C, COT, T, D (mover), CO, B o Z.`)
    }

    /**
     * Lo escrito, en metros: una distancia (3 o 2,5), un punto relativo (@3;2 o, como AutoCAD, @3.5,2)
     * o un punto absoluto (0;0 o 0,0). Con punto y coma los decimales pueden ir con coma.
     */
    function leerPunto(t: string, base?: P): P | null {
      const num = (s: string) => Number(s.trim().replace(',', '.')) * 100 // metros → cm
      const ok = (...n: number[]) => n.every((x) => Number.isFinite(x))
      const relativo = t.startsWith('@')
      const resto = relativo ? t.slice(1).trim() : t
      let par: string[] | null = null
      if (resto.includes(';')) par = resto.split(';')
      else if (relativo || /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(resto) && !base) par = resto.split(',')
      if (par && par.length === 2) {
        const x = num(par[0])
        const y = num(par[1])
        if (!ok(x, y)) return null
        if (relativo) return base ? { x: base.x + x, y: base.y + y } : null
        return { x, y }
      }
      if (/^\d+(?:[.,]\d+)?$/.test(resto) && base && !relativo) {
        // Medida directa: esa distancia hacia donde apunta el mouse.
        const d = num(resto)
        const l = dist(base, cursor) || 1
        return { x: base.x + ((cursor.x - base.x) / l) * d, y: base.y + ((cursor.y - base.y) / l) * d }
      }
      return null
    }

    function cancelar() {
      if (pendiente) {
        const n = pendiente.no
        pendiente = null
        n(new Cancelado())
      } else if (elegidos.size) {
        elegidos.clear()
        dibujar()
      }
      ventanaSel = null
    }

    async function lanzar(nombre: string) {
      hechas.add('cmd:' + nombre)
      if (corriendo) cancelar()
      await Promise.resolve()
      linea.value = ''
      const mia = ++vuelta
      corriendo = nombre
      ultimo = nombre === 'ZOOM' ? ultimo : nombre
      decir('Comando: ' + nombre)
      barra.querySelectorAll('.rg-herr').forEach((b) => b.classList.toggle('activa', (b as HTMLElement).dataset.cmd === nombre))
      try {
        await COMANDO[nombre]()
      } catch (e) {
        if (!(e instanceof Cancelado)) throw e
        decir('*Cancelado*')
      } finally {
        if (mia === vuelta) {
          corriendo = ''
          pendiente = null
          preguntar('Comando:')
          barra.querySelectorAll('.rg-herr').forEach((b) => b.classList.remove('activa'))
          dibujar()
        }
        linea.focus()
      }
    }

    const nuevaEnt = (e: object, enCapa = capa) => ({ ...e, id: fs.nuevoId(), capa: enCapa }) as Ent
    function agregar(e: Ent) {
      guardarPaso()
      ents.push(e)
      dibujar()
    }

    // ---------- Los comandos
    const COMANDO: Record<string, () => Promise<void>> = {
      async LINEA() {
        const primero = (await pedirPunto('Primer punto:'))!
        let a = primero
        let n = 0
        for (;;) {
          const desde = a
          const b = await pedirPunto(n >= 2 ? 'Siguiente punto (o escribí la medida) [C cierra · Enter termina]:' : 'Siguiente punto (o escribí la medida) [Enter termina]:', {
            base: desde,
            vacio: true,
            cerrar: n >= 2 ? primero : undefined,
            previa: (p) => [nuevaEnt({ tipo: 'linea', a: desde, b: p } as const)],
          })
          if (!b) return
          agregar(nuevaEnt({ tipo: 'linea', a: desde, b } as const))
          decir(`  largo ${medidaTexto(dist(desde, b))} m`)
          if (n >= 2 && dist(b, primero) < 1e-9) return // cerró la figura
          a = b
          n++
        }
      },
      async RECTANG() {
        const a = (await pedirPunto('Primera esquina:'))!
        const b = (await pedirPunto('Otra esquina (o escribí @ancho;alto en metros, ej. @3;2):', {
          base: a,
          previa: (p) => [nuevaEnt({ tipo: 'rect', a, b: p } as const)],
        }))!
        agregar(nuevaEnt({ tipo: 'rect', a, b } as const))
        decir(`  ${medidaTexto(Math.abs(b.x - a.x))} × ${medidaTexto(Math.abs(b.y - a.y))} m`)
      },
      async CIRCULO() {
        const c = (await pedirPunto('Centro:'))!
        const p = (await pedirPunto('Radio (o escribí la medida):', {
          base: c,
          previa: (q) => [nuevaEnt({ tipo: 'circulo', c, r: dist(c, q) } as const), nuevaEnt({ tipo: 'linea', a: c, b: q } as const, 3)],
        }))!
        agregar(nuevaEnt({ tipo: 'circulo', c, r: dist(c, p) } as const))
        decir(`  radio ${medidaTexto(dist(c, p))} m`)
      },
      async COTA() {
        const a = (await pedirPunto('Primer punto a medir:'))!
        const b = (await pedirPunto('Segundo punto:', { base: a, previa: (p) => [nuevaEnt({ tipo: 'linea', a, b: p } as const, 3)] }))!
        const desv = (p: P) => {
          const l = dist(a, b) || 1
          return (-(b.y - a.y) / l) * (p.x - a.x) + ((b.x - a.x) / l) * (p.y - a.y)
        }
        const p = (await pedirPunto('¿Dónde va la cota? (separala un poco):', {
          base: b,
          previa: (q) => [nuevaEnt({ tipo: 'cota', a, b, d: desv(q) } as const, 3)],
        }))!
        agregar(nuevaEnt({ tipo: 'cota', a, b, d: desv(p) } as const, 3))
        decir(`  mide ${medidaTexto(dist(a, b))} m`)
      },
      async TEXTO() {
        const p = (await pedirPunto('¿Dónde va el texto?'))!
        const t = await pedirTexto('Escribí el texto y Enter:')
        if (t.trim()) agregar(nuevaEnt({ tipo: 'texto', p, t: t.trim(), h: 15 } as const, capa === 0 ? 4 : capa))
      },
      async DESPLAZA() {
        await mudar(false)
      },
      async COPIA() {
        await mudar(true)
      },
      async BORRA() {
        await pedirSeleccion('Elegí lo que querés borrar y Enter:')
        borrarElegidos()
      },
      async ZOOM() {
        verTodo()
      },
    }

    async function mudar(copia: boolean) {
      await pedirSeleccion(`Elegí lo que querés ${copia ? 'copiar' : 'mover'} y Enter:`)
      const lista = ents.filter((e) => elegidos.has(e.id))
      const base = (await pedirPunto('Punto de base (de dónde lo agarrás):'))!
      for (;;) {
        const destino = await pedirPunto(copia ? 'Segundo punto (o la medida) [Enter termina]:' : 'Segundo punto (o la medida):', {
          base,
          vacio: copia,
          previa: (p) => lista.map((e) => moverEnt(e, p.x - base.x, p.y - base.y)),
        })
        if (!destino) break
        const dx = destino.x - base.x
        const dy = destino.y - base.y
        guardarPaso()
        if (copia) ents.push(...lista.map((e) => ({ ...moverEnt(e, dx, dy), id: fs.nuevoId() })))
        else ents = ents.map((e) => (elegidos.has(e.id) ? moverEnt(e, dx, dy) : e))
        dibujar()
        if (!copia) break
      }
      elegidos.clear()
    }

    function borrarElegidos() {
      if (!elegidos.size) return
      guardarPaso()
      decir(`  ${elegidos.size} borrado${elegidos.size > 1 ? 's' : ''}`)
      ents = ents.filter((e) => !elegidos.has(e.id))
      elegidos.clear()
      dibujar()
    }
    function elegirTodo() {
      elegidos = new Set(ents.map((e) => e.id))
      dibujar()
    }

    // ---------- Historia
    function guardarPaso() {
      atras.push(JSON.stringify(ents))
      if (atras.length > 200) atras.shift()
      adelante.length = 0
      if (!cambios) {
        cambios = true
        ponerTitulo()
      }
    }
    function deshacer() {
      const p = atras.pop()
      if (p === undefined) return decir('Nada para deshacer.')
      adelante.push(JSON.stringify(ents))
      ents = JSON.parse(p)
      elegidos.clear()
      decir('Deshecho.')
      dibujar()
    }
    function rehacer() {
      const p = adelante.pop()
      if (p === undefined) return
      atras.push(JSON.stringify(ents))
      ents = JSON.parse(p)
      dibujar()
    }

    // ---------- Vista
    function medir() {
      vista.w = zona.clientWidth
      vista.h = zona.clientHeight
    }
    function verTodo() {
      medir()
      vista = vistaTodo(ents, vista.w, vista.h)
      dibujar()
    }

    function dibujar() {
      medir()
      let s = modos.rejilla ? svgRejilla(vista) : ''
      // Ejes: origen 0,0.
      const [ox, oy] = aPantalla(vista, { x: 0, y: 0 })
      s += `<g stroke-width="2"><line x1="${ox}" y1="${oy}" x2="${ox + 40}" y2="${oy}" stroke="#ef5350"/><line x1="${ox}" y1="${oy}" x2="${ox}" y2="${oy - 40}" stroke="#66bb6a"/></g>`
      for (const e of ents) s += svgEnt(vista, e, { elegido: elegidos.has(e.id) })
      if (pendiente?.tipo === 'punto' && pendiente.previa) for (const e of pendiente.previa(cursor)) s += svgEnt(vista, e, { previa: true })
      if (ventanaSel) {
        const [ax, ay] = ventanaSel.a
        const [bx, by] = ventanaSel.b
        const cruce = bx < ax // de derecha a izquierda: todo lo que toca (verde); al revés, lo que queda adentro (azul)
        s += `<rect x="${Math.min(ax, bx)}" y="${Math.min(ay, by)}" width="${Math.abs(bx - ax)}" height="${Math.abs(by - ay)}" fill="${cruce ? 'rgba(102,187,106,.15)' : 'rgba(66,165,245,.15)'}" stroke="${cruce ? '#66bb6a' : '#42a5f5'}" ${cruce ? 'stroke-dasharray="6 4"' : ''}/>`
      }
      if (marcaRef) {
        const [x, y] = aPantalla(vista, marcaRef.p)
        const c = '#f57c00'
        s +=
          marcaRef.tipo === 'medio'
            ? `<path d="M${x} ${y - 8} L${x + 8} ${y + 6} L${x - 8} ${y + 6} Z" fill="none" stroke="${c}" stroke-width="2"/>`
            : marcaRef.tipo === 'centro'
              ? `<circle cx="${x}" cy="${y}" r="8" fill="none" stroke="${c}" stroke-width="2"/>`
              : `<rect x="${x - 7}" y="${y - 7}" width="14" height="14" fill="none" stroke="${c}" stroke-width="2"/>`
        s += `<text x="${x + 12}" y="${y - 10}" fill="${c}" font-size="12" font-family="Arial">${marcaRef.tipo}</text>`
      }
      // La cruz es el puntero mismo (ver .rg-zona en los estilos). Sin cuadradito cuando se pide un punto.
      zona.classList.toggle('pidiendo', pendiente?.tipo === 'punto')
      if (cursorPantalla && modos.forzc && !marcaRef) {
        // Con FORZC el punto salta a la rejilla: se marca dónde va a caer.
        const [x, y] = aPantalla(vista, cursor)
        s += `<circle cx="${x}" cy="${y}" r="3" fill="#1e88e5" pointer-events="none"/>`
      }
      svg.setAttribute('viewBox', `0 0 ${vista.w} ${vista.h}`)
      svg.innerHTML = s
      pintarDinamica()
      coords.textContent = `X: ${medidaTexto(cursor.x)}   Y: ${medidaTexto(cursor.y)}   m   ·   rejilla de ${(pasoRejilla(vista.k) / 100).toLocaleString('es-AR')} m`
    }

    function dibujarModos() {
      botonesModo.replaceChildren()
      const lista: [keyof typeof modos, string, string][] = [
        ['rejilla', 'REJILLA', 'F7'],
        ['forzc', 'FORZC', 'F9'],
        ['orto', 'ORTO', 'F8'],
        ['refent', 'REFENT', 'F3'],
      ]
      for (const [k, t, tecla] of lista) {
        const b = el('button', 'rg-modo' + (modos[k] ? ' activo' : ''), t)
        b.title =
          {
            rejilla: 'Mostrar la cuadrícula',
            forzc: 'El cursor salta de a 10 centímetros (0,10 m)',
            orto: 'Líneas solo derechas: horizontales o verticales',
            refent: 'Engancharse a puntas, medios y centros',
          }[k] + ` (${tecla})`
        b.onmousedown = (e) => e.preventDefault()
        b.onclick = () => alternar(k)
        botonesModo.append(b)
      }
    }
    function alternar(k: keyof typeof modos) {
      modos[k] = !modos[k]
      decir(`<${k.toUpperCase()} ${modos[k] ? 'activado' : 'desactivado'}>`)
      dibujarModos()
      dibujar()
    }

    // ---------- Mouse
    function ubicarCursor(x: number, y: number) {
      cursorPantalla = [x, y]
      let p = aMundo(vista, x, y)
      marcaRef = null
      // 1) Referencia a objetos: la más cercana dentro de 12 píxeles.
      if (modos.refent) {
        let mejor = 12 / vista.k
        for (const e of ents)
          for (const n of puntosNotables(e)) {
            const d = dist(n.p, p)
            if (d < mejor) {
              mejor = d
              marcaRef = n
            }
          }
      }
      if (marcaRef) p = marcaRef.p
      else {
        // 2) Orto: derecho desde el punto anterior.
        const base = pendiente?.tipo === 'punto' ? pendiente.base : undefined
        if (modos.orto && base) {
          if (Math.abs(p.x - base.x) > Math.abs(p.y - base.y)) p = { x: p.x, y: base.y }
          else p = { x: base.x, y: p.y }
        }
        // 3) Forzar cursor a la rejilla de 10 cm.
        if (modos.forzc) {
          const paso = 10
          if (!(modos.orto && base) || p.y === base!.y) p = { ...p, x: Math.round(p.x / paso) * paso }
          if (!(modos.orto && base) || p.x === base!.x) p = { ...p, y: Math.round(p.y / paso) * paso }
        }
      }
      cursor = p
    }

    const posicion = (e: PointerEvent | WheelEvent): [number, number] => {
      const r = svg.getBoundingClientRect()
      return [((e.clientX - r.left) / r.width) * vista.w, ((e.clientY - r.top) / r.height) * vista.h]
    }

    function objetoEn(x: number, y: number): Ent | null {
      const p = aMundo(vista, x, y)
      let mejor: Ent | null = null
      let md = 6 / vista.k
      for (const e of ents) {
        const d = distancia(e, p)
        if (d <= md) {
          md = d
          mejor = e
        }
      }
      return mejor
    }

    svg.addEventListener('pointermove', (e) => {
      const [x, y] = posicion(e)
      ubicarCursor(x, y)
      if (ventanaSel) ventanaSel.b = [x, y]
      dibujar()
    })
    svg.addEventListener('pointerleave', () => {
      cursorPantalla = null
      marcaRef = null
      dibujar()
    })
    svg.addEventListener('contextmenu', (e) => e.preventDefault())

    svg.addEventListener('pointerdown', (e) => {
      const [x, y] = posicion(e)
      ubicarCursor(x, y) // el clic ubica el cursor aunque no haya habido movimiento antes
      linea.focus()
      if (e.button === 1 || e.button === 2) {
        // Botón del medio o derecho arrastrando: mover la vista. Clic derecho sin arrastrar: Enter.
        e.preventDefault()
        const x0 = e.clientX
        const y0 = e.clientY
        const c0 = { x: vista.cx, y: vista.cy }
        let movio = false
        const mov = (m: PointerEvent) => {
          if (Math.hypot(m.clientX - x0, m.clientY - y0) > 4) movio = true
          const r = svg.getBoundingClientRect()
          const k = vista.k * (r.width / vista.w)
          vista.cx = c0.x - (m.clientX - x0) / k
          vista.cy = c0.y + (m.clientY - y0) / k
          dibujar()
        }
        const fin = () => {
          document.removeEventListener('pointermove', mov)
          document.removeEventListener('pointerup', fin)
          if (!movio && e.button === 2) entrada('')
        }
        document.addEventListener('pointermove', mov)
        document.addEventListener('pointerup', fin)
        return
      }
      if (e.button !== 0) return
      if (pendiente?.tipo === 'punto') {
        decir(`${pregunta.textContent} ${medidaTexto(cursor.x)};${medidaTexto(cursor.y)}`)
        return resolverPunto(cursor)
      }
      if (pendiente?.tipo === 'texto') return
      // Sin comando o eligiendo: clic en un objeto lo elige; en el vacío, ventana.
      const obj = objetoEn(x, y)
      if (obj) {
        if (e.shiftKey && elegidos.has(obj.id)) elegidos.delete(obj.id)
        else elegidos.add(obj.id)
        dibujar()
        return
      }
      ventanaSel = { a: [x, y], b: [x, y] }
      const fin = () => {
        document.removeEventListener('pointerup', fin)
        const vs = ventanaSel
        ventanaSel = null
        if (!vs) return
        const [ax, ay] = vs.a
        const [bx, by] = vs.b
        if (Math.abs(bx - ax) < 4 && Math.abs(by - ay) < 4) {
          if (!pendiente && !e.shiftKey) elegidos.clear()
          return dibujar()
        }
        const p1 = aMundo(vista, Math.min(ax, bx), Math.max(ay, by))
        const p2 = aMundo(vista, Math.max(ax, bx), Math.min(ay, by))
        const cruce = bx < ax
        for (const en of ents) {
          const c = caja(en)
          const adentro = c.x0 >= p1.x && c.x1 <= p2.x && c.y0 >= p1.y && c.y1 <= p2.y
          const toca = c.x1 >= p1.x && c.x0 <= p2.x && c.y1 >= p1.y && c.y0 <= p2.y
          if (cruce ? toca : adentro) elegidos.add(en.id)
        }
        dibujar()
      }
      document.addEventListener('pointerup', fin)
    })

    svg.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault()
        // Zoom alrededor del cursor.
        const [x, y] = posicion(e)
        const antes = aMundo(vista, x, y)
        vista.k = Math.min(60, Math.max(0.02, vista.k * (e.deltaY < 0 ? 1.2 : 1 / 1.2)))
        hechas.add('zoom')
        const despues = aMundo(vista, x, y)
        vista.cx += antes.x - despues.x
        vista.cy += antes.y - despues.y
        ubicarCursor(x, y)
        dibujar()
      },
      { passive: false },
    )
    svg.addEventListener('dblclick', (e) => {
      if (e.button === 1) verTodo()
    })

    // ---------- Teclado: todo pasa por la línea de comandos, como en AutoCAD
    function pintarDinamica() {
      const escrito = linea.value
      if (!cursorPantalla || (!pendiente && !escrito)) {
        dinamica.style.display = 'none'
        return
      }
      dinamica.replaceChildren()
      // La pregunta, sin las opciones entre corchetes (esas quedan en la línea de comandos).
      if (pendiente) dinamica.append(el('div', 'rg-din-pregunta', (pregunta.textContent ?? '').replace(/\s*\[.*\]/, '').replace(/:$/, '')))
      const fila = el('div', 'rg-din-fila')
      const base = pendiente?.tipo === 'punto' ? pendiente.base : undefined
      if (escrito) fila.append(el('span', 'rg-din-caja escribiendo', escrito))
      else if (pendiente?.tipo === 'punto' && base) {
        // Distancia y ángulo desde el punto anterior.
        const ang = Math.round(((Math.atan2(cursor.y - base.y, cursor.x - base.x) * 180) / Math.PI + 360) % 360)
        fila.append(el('span', 'rg-din-caja', `${medidaTexto(dist(base, cursor))} m`), el('span', 'rg-din-caja chica', `${ang}°`))
      } else if (pendiente?.tipo === 'punto') {
        fila.append(el('span', 'rg-din-caja', medidaTexto(cursor.x)), el('span', 'rg-din-caja', medidaTexto(cursor.y)))
      }
      if (fila.childElementCount) dinamica.append(fila)
      // Sin comando en marcha: los comandos que empiezan con lo escrito, como el autocompletar de AutoCAD.
      if (!pendiente && escrito) {
        const t = escrito.toUpperCase()
        for (const c of COMANDOS.filter((x) => x.alias.some((a) => a.startsWith(t))).slice(0, 4))
          dinamica.append(el('div', 'rg-din-sugerencia', `${c.icono}  ${c.alias.find((a) => a.startsWith(t))} — ${c.ayuda}`))
      }
      const [x, y] = aPantalla(vista, cursor)
      dinamica.style.display = 'block'
      const w = dinamica.offsetWidth
      const h = dinamica.offsetHeight
      dinamica.style.left = (x + 22 + w > vista.w ? x - 22 - w : x + 22) + 'px'
      dinamica.style.top = (y + 22 + h > vista.h ? y - 22 - h : y + 22) + 'px'
    }
    linea.addEventListener('input', () => pintarDinamica())

    linea.addEventListener('keydown', (e) => {
      e.stopPropagation()
      const ctrl = e.ctrlKey || e.metaKey
      const k = e.key.toLowerCase()
      if (ctrl) {
        if (k === 'z') deshacer()
        else if (k === 'y') rehacer()
        else if (k === 's') guardar()
        else if (k === 'p') imprimirEsto()
        else if (k === 'o') abrirOtro()
        else if (k === 'n') nuevo()
        else if (k === 'a') elegirTodo()
        else return
        e.preventDefault()
        return
      }
      const fn: Record<string, keyof typeof modos> = { F7: 'rejilla', F9: 'forzc', F8: 'orto', F3: 'refent' }
      if (fn[e.key]) {
        e.preventDefault()
        return alternar(fn[e.key])
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        linea.value = ''
        return cancelar()
      }
      // Enter, y también la barra espaciadora (salvo escribiendo un texto).
      if (e.key === 'Enter' || (e.key === ' ' && pendiente?.tipo !== 'texto')) {
        e.preventDefault()
        return entrada(linea.value)
      }
      if (e.key === 'Delete' && !linea.value) {
        e.preventDefault()
        borrarElegidos()
      }
    })

    // ---------- Archivo
    function imprimirEsto() {
      // El plano en blanco y negro sobre la hoja, como sale de un plotter.
      imprimir({ titulo: archivo?.nombre ?? 'Plano', paginas: [{ tipo: 'imagen', contenido: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgDibujo(ents, 1123, 794)) }], horizontal: true })
    }

    async function guardar(como = false): Promise<boolean> {
      let n = archivo?.nombre
      if (!archivo || como) {
        const sugerido = archivo ? archivo.nombre + ' (copia)' : fs.nombreLibre('Plano', 'regla')
        const x = await pedirNombre('regla', sugerido, '¿Cómo se va a llamar tu plano?')
        if (!x) return false
        n = x
        archivo = null
      }
      archivo = fs.guardar({ id: archivo?.id ?? fs.nuevoId(), nombre: n!, app: 'regla', miniatura: svgDibujo(ents, 600, 420) }, { ents } as Datos)
      cambios = false
      ponerTitulo()
      linea.focus()
      return true
    }
    async function puedeSeguir(): Promise<boolean> {
      if (!cambios || !ents.length) return true
      const r = await preguntarSiGuarda('Regla', archivo?.nombre ?? 'Sin nombre')
      if (r === 'cancelar') return false
      if (r === 'si') return guardar()
      return true
    }
    function cargar(d: Datos, a: fs.Archivo | null) {
      if (corriendo) cancelar()
      ents = d.ents ?? []
      archivo = a
      cambios = false
      atras.length = 0
      adelante.length = 0
      elegidos.clear()
      ponerTitulo()
      verTodo()
    }
    async function nuevo() {
      if (!(await puedeSeguir())) return
      cargar({ ents: [] }, null)
    }
    async function abrirOtro() {
      if (!(await puedeSeguir())) return
      const id = await elegirArchivo('regla', 'Abrir un plano')
      const d = id ? (fs.leer(id) as Datos | null) : null
      if (id && d) cargar(d, fs.buscar(id) ?? null)
    }
    function ponerTitulo() {
      win.ponerTitulo(`${cambios ? '● ' : ''}${archivo?.nombre ?? 'Sin nombre'} — Regla`)
    }

    // ---------- Arranque
    dibujarModos()
    new ResizeObserver(() => dibujar()).observe(zona)
    decir('Escribí un comando y Enter. Por ejemplo L para dibujar una línea.')
    decir('Las medidas van en metros: mientras dibujás, escribí la medida (ej. 3 o 2,5) y Enter.')
    setTimeout(() => {
      if (archivoId) {
        const d = fs.leer(archivoId) as Datos | null
        if (d) cargar(d, fs.buscar(archivoId) ?? null)
      } else verTodo()
      ponerTitulo()
      linea.focus()
    }, 0)

    return {
      alTecla(e) {
        // Si el foco quedó en otro lado, las letras van igual a la línea de comandos.
        if (e.ctrlKey || e.metaKey || e.altKey) return false
        linea.focus()
        if (e.key.length === 1) {
          linea.value += e.key
          pintarDinamica()
        }
        else linea.dispatchEvent(new KeyboardEvent('keydown', { key: e.key, shiftKey: e.shiftKey }))
        return true
      },
      // Para el guía de las misiones.
      api: {
        hizo: (a: string) => hechas.has(a),
        ents: () => ents,
        orto: () => modos.orto,
        comando: () => corriendo,
        cargar: () => {
          cargar({ ents: [] }, null)
          hechas.clear()
          for (const k of Object.keys(modos) as (keyof typeof modos)[]) modos[k] = k === 'rejilla' || k === 'refent'
          dibujarModos()
          dibujar()
        },
        guardarComo: (n0: string) => {
          let n = n0
          for (let i = 2; fs.existeNombre(n, 'regla'); i++) n = `${n0} ${i}`
          archivo = fs.guardar({ id: fs.nuevoId(), nombre: n, app: 'regla', miniatura: svgDibujo(ents, 600, 420) }, { ents } as Datos)
          cambios = false
          ponerTitulo()
          return n
        },
      },
      async alCerrar() {
        const ok = await puedeSeguir()
        if (ok) cancelar()
        return ok
      },
    }
  },
}
