// Robotito: programación con bloques.
// Enseña: secuencia, repetir, repetir adentro de repetir, mientras, si / si no,
// y que los bloques son lo mismo que el código escrito ("Ver como texto").

import * as fs from '../../os/archivos'
import { pedirNombre, preguntarSiGuarda } from '../../os/documento'
import { elegirArchivo } from '../../os/selector'
import { barraMenu, dialogo, el } from '../../os/ui'
import type { Programa } from '../../os/ventanas'
import {
  aTexto, Choque, contar, ejecutar, estrella, hayCamino, inicio, LIBRE, llego, NIVELES,
  type Bloque, type Condicion, type Estado, type Nivel, type Paso, type TipoBloque,
} from './mundo'

const NS = 'http://www.w3.org/2000/svg'
const C = 60 // tamaño de cada casilla en el dibujo
const COLORES_PINTAR = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#ec407a', '#000000', '#ffffff']
const CONDICIONES: { id: Condicion; texto: string }[] = [
  { id: 'adelante', texto: 'hay camino adelante' },
  { id: 'izquierda', texto: 'hay camino a la izquierda' },
  { id: 'derecha', texto: 'hay camino a la derecha' },
]
const INFO: Record<TipoBloque, { texto: string; clase: string }> = {
  avanzar: { texto: '⬆ avanzar', clase: 'mov' },
  izq: { texto: '↺ girar a la izquierda', clase: 'mov' },
  der: { texto: '↻ girar a la derecha', clase: 'mov' },
  pintar: { texto: '🖌 pintar', clase: 'pin' },
  repetir: { texto: '🔁 repetir', clase: 'ctl' },
  mientras: { texto: '🔁 mientras no llegue a la ⭐', clase: 'ctl' },
  si: { texto: '❓ si', clase: 'si' },
}
const VELOCIDADES = [
  { texto: '🐢', ms: 750 },
  { texto: '🚶', ms: 400 },
  { texto: '🐇', ms: 140 },
]
const MAX_PASOS = 2000
const CLAVE_PROGRESO = 'kidsos.robotito.progreso'

type Modo = number | 'libre' // número de nivel (0..) o taller libre
interface DatosArchivo {
  modo: Modo
  programa: Bloque[]
}

const svgEl = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>) => {
  const e = document.createElementNS(NS, tag)
  for (const k in attrs) e.setAttribute(k, String(attrs[k]))
  return e
}

function nuevoBloque(tipo: TipoBloque): Bloque {
  const b: Bloque = { id: fs.nuevoId(), tipo }
  if (tipo === 'repetir') Object.assign(b, { n: 3, hijos: [] })
  if (tipo === 'mientras') b.hijos = []
  if (tipo === 'si') Object.assign(b, { cond: 'adelante', hijos: [], sino: [] })
  if (tipo === 'pintar') b.color = COLORES_PINTAR[0]
  return b
}

/** Busca en qué lista está un bloque. */
function ubicar(lista: Bloque[], id: string): [Bloque[], number] | null {
  for (let i = 0; i < lista.length; i++) {
    const b = lista[i]
    if (b.id === id) return [lista, i]
    const r = ubicar(b.hijos ?? [], id) ?? ubicar(b.sino ?? [], id)
    if (r) return r
  }
  return null
}

/** Dibujo del mundo, para la miniatura de Mis cosas y para la pantalla. */
function dibujarMundo(n: Nivel, pintadas: Map<string, string>): SVGSVGElement {
  const alto = n.mapa.length
  const ancho = n.mapa[0].length
  const s = svgEl('svg', { xmlns: NS, viewBox: `0 0 ${ancho * C} ${alto * C}` }) as SVGSVGElement
  for (let y = 0; y < alto; y++)
    for (let x = 0; x < ancho; x++) {
      const camino = hayCamino(n, x, y)
      s.append(svgEl('rect', { x: x * C, y: y * C, width: C, height: C, fill: camino ? '#f3e5c0' : '#8bc34a', stroke: camino ? '#e0cf9f' : '#7cb342' }))
      const p = pintadas.get(`${x},${y}`)
      if (p) s.append(svgEl('rect', { x: x * C + 3, y: y * C + 3, width: C - 6, height: C - 6, rx: 6, fill: p }))
      if (!camino) {
        const t = svgEl('text', { x: x * C + C / 2, y: y * C + C * 0.72, 'font-size': C * 0.6, 'text-anchor': 'middle' })
        t.textContent = '🌳'
        s.append(t)
      }
    }
  const e = estrella(n)
  if (e) {
    const t = svgEl('text', { x: e[0] * C + C / 2, y: e[1] * C + C * 0.72, 'font-size': C * 0.62, 'text-anchor': 'middle' })
    t.textContent = '⭐'
    s.append(t)
  }
  return s
}

/** Robotito mirando a la derecha, centrado en (0,0). */
function dibujoRobot(): SVGGElement {
  const g = svgEl('g', {}) as SVGGElement
  g.append(
    svgEl('rect', { x: -20, y: -18, width: 36, height: 36, rx: 9, fill: '#42a5f5', stroke: '#1565c0', 'stroke-width': 3 }),
    svgEl('circle', { cx: 6, cy: -7, r: 5, fill: '#fff' }),
    svgEl('circle', { cx: 6, cy: 7, r: 5, fill: '#fff' }),
    svgEl('circle', { cx: 8, cy: -7, r: 2.5, fill: '#263238' }),
    svgEl('circle', { cx: 8, cy: 7, r: 2.5, fill: '#263238' }),
    svgEl('path', { d: 'M18 -8 L27 0 L18 8 Z', fill: '#ffb300', stroke: '#e65100', 'stroke-width': 2 }),
  )
  return g
}

export const robotito: Programa = {
  id: 'robotito',
  nombre: 'Robotito',
  icono: '🤖',
  ancho: 1180,
  alto: 720,
  abrir(v, archivoId) {
    let modo: Modo = 0
    const programas = new Map<Modo, Bloque[]>() // cada nivel guarda su programa mientras la ventana está abierta
    let programa: Bloque[] = []
    let archivo: fs.Archivo | null = null
    let cambios = false
    let velocidad = 1
    let elegido: string | null = null
    const atras: string[] = []
    const adelante: string[] = []

    let progreso = 0 // último nivel habilitado
    try {
      progreso = Number(localStorage.getItem(CLAVE_PROGRESO) || 0)
    } catch {}

    const nivel = (): Nivel => (modo === 'libre' ? LIBRE : NIVELES[modo])

    // ---------- Armado
    const raiz = el('div', 'robotito')
    const menu = barraMenu([
      {
        titulo: 'Archivo',
        items: [
          { texto: 'Nuevo programa', atajo: 'Ctrl+N', accion: () => vaciar() },
          { texto: 'Abrir…', atajo: 'Ctrl+O', accion: () => abrirOtro() },
          '-',
          { texto: 'Guardar', atajo: 'Ctrl+S', accion: () => guardar() },
          { texto: 'Guardar como…', accion: () => guardar(true) },
          '-',
          { texto: 'Cerrar', accion: async () => (await puedeSeguir()) && v.cerrar() },
        ],
      },
      {
        titulo: 'Editar',
        items: [
          { texto: 'Deshacer', atajo: 'Ctrl+Z', accion: () => deshacer(), activo: () => atras.length > 0 },
          { texto: 'Rehacer', atajo: 'Ctrl+Y', accion: () => rehacer(), activo: () => adelante.length > 0 },
          '-',
          { texto: 'Borrar el bloque elegido', atajo: 'Supr', accion: () => borrarElegido(), activo: () => !!elegido },
          { texto: 'Borrar todo el programa', accion: () => vaciar() },
        ],
      },
    ])
    const niveles = el('div', 'rb-niveles')
    const cuerpo = el('div', 'rb-cuerpo')
    const paleta = el('div', 'rb-paleta')
    const zonaPrograma = el('div', 'rb-programa')
    const derecha = el('div', 'rb-derecha')
    cuerpo.append(paleta, zonaPrograma, derecha)
    const estado = el('div', 'barra-estado')
    raiz.append(menu, niveles, cuerpo, estado)
    v.cuerpo.append(raiz)

    const consigna = el('div', 'rb-consigna')
    const mundoCaja = el('div', 'rb-mundo')
    const controles = el('div', 'rb-controles')
    const bCorrer = el('button', 'boton principal', '▶ Ejecutar')
    const bPaso = el('button', 'boton', '⏭ Un paso')
    const bVolver = el('button', 'boton', '↩ Volver al inicio')
    const vel = el('div', 'rb-velocidad')
    controles.append(bCorrer, bPaso, bVolver, vel)
    const contador = el('div', 'rb-contador')
    const verTexto = el('label', 'rb-ver-texto')
    const chk = el('input')
    chk.type = 'checkbox'
    verTexto.append(chk, el('span', '', ' Ver como texto'))
    const texto = el('pre', 'rb-texto')
    derecha.append(consigna, mundoCaja, controles, contador, verTexto, texto)

    // ---------- Niveles
    function dibujarNiveles() {
      niveles.replaceChildren()
      NIVELES.forEach((_, i) => {
        const b = el('button', 'rb-nivel' + (modo === i ? ' activo' : '') + (i < progreso ? ' hecho' : ''), i < progreso ? '⭐' : String(i + 1))
        if (i > progreso) {
          b.disabled = true
          b.textContent = '🔒'
        }
        b.title = `Nivel ${i + 1}`
        b.onclick = () => irA(i)
        niveles.append(b)
      })
      const libre = el('button', 'rb-nivel libre' + (modo === 'libre' ? ' activo' : ''), '🖌 Taller libre')
      libre.onclick = () => irA('libre')
      niveles.append(libre)
    }

    function irA(m: Modo) {
      parar()
      programas.set(modo, programa)
      modo = m
      programa = programas.get(m) ?? []
      atras.length = 0
      adelante.length = 0
      elegido = null
      if (!archivo) cambios = false
      dibujarTodo()
    }

    // ---------- Paleta de bloques
    function dibujarPaleta() {
      paleta.replaceChildren(el('div', 'rb-titulo', 'Bloques'))
      for (const t of nivel().bloques) {
        const b = el('div', `rb-bloque ${INFO[t].clase} en-paleta`, INFO[t].texto)
        b.title = 'Arrastralo al programa (o hacé clic para ponerlo al final)'
        b.onpointerdown = (e) => empezarArrastre(e, { nuevo: t }, b)
        paleta.append(b)
      }
      paleta.append(el('div', 'rb-ayuda', 'Para sacar un bloque, arrastralo de vuelta acá.'))
    }

    // ---------- Programa (los bloques armados)
    function dibujarPrograma() {
      zonaPrograma.replaceChildren(el('div', 'rb-titulo', 'Mi programa'))
      const lista = dibujarLista(programa, 'raiz')
      lista.classList.add('raiz')
      if (!programa.length) lista.append(el('div', 'rb-vacio', 'Arrastrá bloques acá'))
      zonaPrograma.append(lista)
      const n = contar(programa)
      const max = nivel().maximo
      contador.textContent = max ? `Bloques: ${n} de ${max}` : `Bloques: ${n}`
      contador.classList.toggle('excede', !!max && n > max)
      texto.textContent = programa.length ? aTexto(programa) : '(el programa está vacío)'
      texto.style.display = chk.checked ? '' : 'none'
    }

    function dibujarLista(lista: Bloque[], clave: string): HTMLElement {
      const cont = el('div', 'rb-lista')
      cont.dataset.lista = clave
      for (const b of lista) cont.append(dibujarBloque(b))
      return cont
    }

    function dibujarBloque(b: Bloque): HTMLElement {
      const info = INFO[b.tipo]
      const caja = el('div', `rb-bloque ${info.clase}` + (b.id === elegido ? ' elegido' : ''))
      caja.dataset.id = b.id
      const cabeza = el('div', 'rb-cabeza')
      cabeza.append(el('span', '', info.texto))
      caja.append(cabeza)

      const selector = (opciones: { valor: string; texto: string }[], actual: string, cambiar: (v: string) => void) => {
        const s = el('select', 'rb-select')
        for (const o of opciones) {
          const op = el('option', '', o.texto)
          op.value = o.valor
          s.append(op)
        }
        s.value = actual
        s.onpointerdown = (e) => e.stopPropagation()
        s.onchange = () => {
          guardarPaso()
          cambiar(s.value)
          dibujarPrograma()
        }
        return s
      }

      if (b.tipo === 'repetir') {
        cabeza.append(
          selector(
            Array.from({ length: 11 }, (_, i) => ({ valor: String(i + 2), texto: String(i + 2) })),
            String(b.n),
            (x) => (b.n = Number(x)),
          ),
          el('span', '', 'veces'),
        )
      }
      if (b.tipo === 'si') {
        cabeza.append(selector(CONDICIONES.map((c) => ({ valor: c.id, texto: c.texto })), b.cond!, (x) => (b.cond = x as Condicion)))
      }
      if (b.tipo === 'pintar') {
        const colores = el('span', 'rb-colores')
        for (const c of COLORES_PINTAR) {
          const m = el('span', 'rb-color' + (c === b.color ? ' activo' : ''))
          m.style.background = c
          m.onpointerdown = (e) => e.stopPropagation()
          m.onclick = () => {
            guardarPaso()
            b.color = c
            dibujarPrograma()
          }
          colores.append(m)
        }
        cabeza.append(colores)
      }
      if (b.hijos) {
        caja.classList.add('contenedor')
        caja.append(dibujarLista(b.hijos, b.id + ':hijos'))
      }
      if (b.tipo === 'si') {
        caja.append(el('div', 'rb-cabeza', 'si no'), dibujarLista(b.sino!, b.id + ':sino'))
      }
      if (b.hijos) caja.append(el('div', 'rb-pie'))

      caja.onpointerdown = (e) => {
        e.stopPropagation()
        empezarArrastre(e, { id: b.id }, caja)
      }
      return caja
    }

    function listaPorClave(clave: string): Bloque[] | null {
      if (clave === 'raiz') return programa
      const [id, parte] = clave.split(':')
      const u = ubicar(programa, id)
      if (!u) return null
      const b = u[0][u[1]]
      return (parte === 'sino' ? b.sino : b.hijos) ?? null
    }

    // ---------- Arrastrar y soltar
    function empezarArrastre(e: PointerEvent, que: { nuevo?: TipoBloque; id?: string }, origen: HTMLElement) {
      if (e.button !== 0 || corriendo) return
      const x0 = e.clientX
      const y0 = e.clientY
      let fantasma: HTMLElement | null = null
      const marca = el('div', 'rb-marca')
      let destino: { clave: string; indice: number } | null = null

      const mover = (m: PointerEvent) => {
        if (!fantasma) {
          if (Math.hypot(m.clientX - x0, m.clientY - y0) < 5) return
          fantasma = origen.cloneNode(true) as HTMLElement
          fantasma.classList.add('rb-fantasma')
          fantasma.style.width = origen.offsetWidth + 'px'
          document.body.append(fantasma)
          if (que.id) origen.classList.add('arrastrando')
        }
        fantasma.style.left = m.clientX - 20 + 'px'
        fantasma.style.top = m.clientY - 14 + 'px'
        // ¿Sobre qué lista está? La más interna, y nunca adentro del mismo bloque que se arrastra.
        const debajo = document.elementFromPoint(m.clientX, m.clientY) as HTMLElement | null
        let lista = debajo?.closest('.rb-lista') as HTMLElement | null
        if (!lista && debajo && zonaPrograma.contains(debajo)) lista = zonaPrograma.querySelector('.rb-lista.raiz')
        if (lista && que.id && origen.contains(lista)) lista = null
        marca.remove()
        destino = null
        if (!lista) return
        const hijos = [...lista.children].filter((c) => c.classList.contains('rb-bloque') && c !== origen) as HTMLElement[]
        let indice = hijos.length
        for (let i = 0; i < hijos.length; i++) {
          const r = hijos[i].getBoundingClientRect()
          // En un bloque grande (repetir, si) la mitad se calcula con la cabeza, no con todo el bloque.
          const alto = hijos[i].classList.contains('contenedor') ? Math.min(r.height, 36) : r.height
          if (m.clientY < r.top + alto / 2) {
            indice = i
            break
          }
        }
        lista.insertBefore(marca, hijos[indice] ?? null)
        lista.querySelector('.rb-vacio')?.remove()
        destino = { clave: lista.dataset.lista!, indice }
      }

      const soltar = () => {
        document.removeEventListener('pointermove', mover)
        document.removeEventListener('pointerup', soltar)
        marca.remove()
        fantasma?.remove()
        origen.classList.remove('arrastrando')
        if (!fantasma) {
          // Fue un clic: en la paleta lo pone al final; en el programa lo elige.
          if (que.nuevo) {
            guardarPaso()
            programa.push(nuevoBloque(que.nuevo))
          } else elegido = que.id ?? null
          dibujarPrograma()
          return
        }
        if (!destino && que.nuevo) return dibujarPrograma()
        guardarPaso()
        let bloque: Bloque
        if (que.id) {
          const u = ubicar(programa, que.id)!
          bloque = u[0].splice(u[1], 1)[0]
        } else bloque = nuevoBloque(que.nuevo!)
        if (destino) {
          // El índice se calculó sin contar el bloque que se movió: ya está bien.
          listaPorClave(destino.clave)?.splice(destino.indice, 0, bloque)
        } else if (elegido === bloque.id) elegido = null // soltado afuera: se borra
        dibujarPrograma()
      }
      document.addEventListener('pointermove', mover)
      document.addEventListener('pointerup', soltar)
      e.preventDefault()
    }

    function borrarElegido() {
      if (!elegido) return
      const u = ubicar(programa, elegido)
      if (!u) return
      guardarPaso()
      u[0].splice(u[1], 1)
      elegido = null
      dibujarPrograma()
    }

    async function vaciar() {
      if (!programa.length) return
      const r = await dialogo({
        titulo: 'Robotito',
        icono: '🗑️',
        mensaje: '¿Borrás todo el programa?',
        botones: [
          { texto: 'Borrar todo', valor: 'si' },
          { texto: 'Cancelar', valor: 'no', principal: true },
        ],
      })
      if (r.boton !== 'si') return
      guardarPaso()
      programa.length = 0
      dibujarPrograma()
    }

    // ---------- Deshacer
    function guardarPaso() {
      atras.push(JSON.stringify(programa))
      if (atras.length > 200) atras.shift()
      adelante.length = 0
      cambios = true
      ponerTitulo()
    }
    function reponer(json: string) {
      programa = JSON.parse(json)
      programas.set(modo, programa)
      elegido = null
      cambios = true
      ponerTitulo()
      dibujarPrograma()
    }
    function deshacer() {
      const p = atras.pop()
      if (p === undefined) return
      adelante.push(JSON.stringify(programa))
      reponer(p)
    }
    function rehacer() {
      const p = adelante.pop()
      if (p === undefined) return
      atras.push(JSON.stringify(programa))
      reponer(p)
    }

    // ---------- Mundo y ejecución
    let est: Estado = inicio(nivel())
    let robot: SVGGElement
    let capaPintura: SVGGElement
    let corrida: Generator<Paso> | null = null
    let corriendo = false
    let pasos = 0

    function dibujarMundoEnPantalla() {
      est = inicio(nivel())
      const s = dibujarMundo(nivel(), new Map())
      s.classList.add('rb-svg')
      capaPintura = svgEl('g', {}) as SVGGElement
      s.insertBefore(capaPintura, s.querySelector('text') ?? null)
      robot = dibujoRobot()
      s.append(robot)
      mundoCaja.replaceChildren(s)
      ponerRobot(false)
    }

    function ponerRobot(animado: boolean) {
      robot.style.transition = animado ? `transform ${VELOCIDADES[velocidad].ms * 0.8}ms ease-in-out` : 'none'
      robot.style.transform = `translate(${est.x * C + C / 2}px, ${est.y * C + C / 2}px) rotate(${est.giro}deg)`
      capaPintura.replaceChildren()
      est.pintadas.forEach((c, k) => {
        const [x, y] = k.split(',').map(Number)
        capaPintura.append(svgEl('rect', { x: x * C + 3, y: y * C + 3, width: C - 6, height: C - 6, rx: 6, fill: c }))
      })
    }

    function marcarBloque(id: string | null) {
      zonaPrograma.querySelectorAll('.corriendo').forEach((x) => x.classList.remove('corriendo'))
      if (id) zonaPrograma.querySelector(`[data-id="${id}"]`)?.classList.add('corriendo')
    }

    function volver() {
      parar()
      dibujarMundoEnPantalla()
      marcarBloque(null)
      mundoCaja.classList.remove('choco')
      ponerEstado('')
    }

    function parar() {
      corriendo = false
      corrida = null
      bCorrer.textContent = '▶ Ejecutar'
      raiz.classList.remove('corriendo')
    }

    /** Avanza un paso. Devuelve cuánto esperar antes del siguiente, o null si terminó. */
    function unPaso(): number | null {
      if (!corrida) {
        if (!programa.length) {
          ponerEstado('El programa está vacío: arrastrá bloques a "Mi programa".')
          return null
        }
        dibujarMundoEnPantalla()
        mundoCaja.classList.remove('choco')
        corrida = ejecutar(programa, nivel(), est)
        pasos = 0
      }
      try {
        const r = corrida.next()
        if (r.done) {
          terminar()
          return null
        }
        if (++pasos > MAX_PASOS) {
          parar()
          ponerEstado('Robotito se cansó: el programa no termina nunca. ¿Hay un "mientras" que no lo deja llegar?')
          return null
        }
        marcarBloque(r.value.id)
        ponerRobot(true)
        return r.value.accion ? VELOCIDADES[velocidad].ms : VELOCIDADES[velocidad].ms / 3
      } catch (e) {
        if (!(e instanceof Choque)) throw e
        parar()
        marcarBloque(e.id)
        mundoCaja.classList.add('choco')
        ponerEstado('¡Uy! Robotito chocó con un árbol. El bloque marcado en rojo es donde pasó.')
        zonaPrograma.querySelector(`[data-id="${e.id}"]`)?.classList.add('error')
        return null
      }
    }

    async function terminar() {
      parar()
      marcarBloque(null)
      if (modo === 'libre') return ponerEstado('Terminó el programa.')
      if (!llego(nivel(), est)) return ponerEstado('Terminó el programa pero Robotito no llegó a la estrella. Probá de nuevo.')
      const max = nivel().maximo
      if (max && contar(programa) > max) {
        return ponerEstado(`¡Llegó! Pero usaste ${contar(programa)} bloques y el máximo es ${max}. ¿Se puede con menos?`)
      }
      const actual = modo as number
      if (actual + 1 > progreso) {
        progreso = actual + 1
        try {
          localStorage.setItem(CLAVE_PROGRESO, String(progreso))
        } catch {}
      }
      dibujarNiveles()
      ponerEstado('⭐ ¡Muy bien!')
      const hay = actual + 1 < NIVELES.length
      const r = await dialogo({
        titulo: 'Robotito',
        icono: '⭐',
        mensaje: hay ? '¡Muy bien! Robotito llegó a la estrella.' : '¡Terminaste todos los niveles! Ahora probá el taller libre.',
        botones: [
          { texto: hay ? 'Siguiente nivel' : 'Ir al taller libre', valor: 'seguir', principal: true },
          { texto: 'Quedarme acá', valor: 'quedar' },
        ],
      })
      if (r.boton === 'seguir') irA(hay ? actual + 1 : 'libre')
    }

    async function correr() {
      if (corriendo) return volver()
      if (corrida === null) volver()
      corriendo = true
      bCorrer.textContent = '⏹ Parar'
      raiz.classList.add('corriendo')
      ponerEstado('')
      while (corriendo) {
        const espera = unPaso()
        if (espera === null) break
        await new Promise((r) => setTimeout(r, espera))
      }
    }

    bCorrer.onclick = correr
    bPaso.onclick = () => {
      if (corriendo) return
      ponerEstado('Paso a paso: mirá qué bloque se marca.')
      unPaso()
    }
    bVolver.onclick = volver

    function dibujarVelocidad() {
      vel.replaceChildren()
      VELOCIDADES.forEach((x, i) => {
        const b = el('button', 'rb-vel' + (i === velocidad ? ' activa' : ''), x.texto)
        b.title = ['Lento', 'Normal', 'Rápido'][i]
        b.onclick = () => {
          velocidad = i
          dibujarVelocidad()
        }
        vel.append(b)
      })
    }
    chk.onchange = () => dibujarPrograma()

    zonaPrograma.onpointerdown = () => {
      if (elegido) {
        elegido = null
        dibujarPrograma()
      }
    }

    function ponerEstado(t: string) {
      estado.textContent = t || 'Arrastrá bloques a "Mi programa" y apretá ▶ Ejecutar.'
    }
    function ponerTitulo() {
      const nombre = archivo?.nombre ?? (modo === 'libre' ? 'Taller libre' : `Nivel ${(modo as number) + 1}`)
      v.ponerTitulo(`${cambios && archivo ? '● ' : ''}${nombre} — Robotito`)
    }

    function dibujarTodo() {
      dibujarNiveles()
      dibujarPaleta()
      dibujarPrograma()
      dibujarMundoEnPantalla()
      consigna.textContent = nivel().texto
      ponerEstado('')
      ponerTitulo()
    }

    // ---------- Archivo
    async function guardar(como = false): Promise<boolean> {
      let nombre = archivo?.nombre
      if (!archivo || como) {
        const sugerido = archivo ? archivo.nombre + ' (copia)' : fs.nombreLibre('Programa', 'robotito')
        const n = await pedirNombre('robotito', sugerido, '¿Cómo se va a llamar tu programa?')
        if (!n) return false
        nombre = n
        archivo = null
      }
      // La miniatura muestra cómo quedó el mundo al final (en el taller libre, el dibujo).
      const fin = inicio(nivel())
      try {
        let i = 0
        for (const _ of ejecutar(programa, nivel(), fin)) if (++i > MAX_PASOS) break
      } catch {}
      const mini = dibujarMundo(nivel(), fin.pintadas).outerHTML
      const datos: DatosArchivo = { modo, programa }
      archivo = fs.guardar({ id: archivo?.id ?? fs.nuevoId(), nombre: nombre!, app: 'robotito', miniatura: mini }, datos)
      cambios = false
      ponerTitulo()
      return true
    }

    async function puedeSeguir(): Promise<boolean> {
      // En los niveles sin archivo no se pregunta: el programa es un ejercicio.
      if (!cambios || (!archivo && modo !== 'libre') || !programa.length) return true
      const r = await preguntarSiGuarda('Robotito', archivo?.nombre ?? 'Taller libre')
      if (r === 'cancelar') return false
      if (r === 'si') return guardar()
      return true
    }

    function cargar(id: string) {
      const a = fs.buscar(id)
      const d = fs.leer(id) as DatosArchivo | null
      if (!a || !d) return
      const m: Modo = d.modo === 'libre' || (typeof d.modo === 'number' && d.modo <= progreso) ? d.modo : 'libre'
      irA(m)
      archivo = a
      programa = d.programa ?? []
      programas.set(m, programa)
      cambios = false
      dibujarTodo()
    }

    async function abrirOtro() {
      if (!(await puedeSeguir())) return
      const id = await elegirArchivo('robotito', 'Abrir un programa')
      if (id) cargar(id)
    }

    // ---------- Arranque
    modo = Math.min(progreso, NIVELES.length - 1)
    dibujarVelocidad()
    dibujarTodo()
    if (archivoId) cargar(archivoId)

    return {
      alTecla(e) {
        const ctrl = e.ctrlKey || e.metaKey
        const k = e.key.toLowerCase()
        if (ctrl && k === 'z') deshacer()
        else if (ctrl && k === 'y') rehacer()
        else if (ctrl && k === 's') guardar()
        else if (ctrl && k === 'o') abrirOtro()
        else if (ctrl && k === 'n') vaciar()
        else if (e.key === 'Delete' || e.key === 'Backspace') borrarElegido()
        else if (e.key === 'F5') correr()
        else return false
        return true
      },
      async alCerrar() {
        const ok = await puedeSeguir()
        if (ok) parar()
        return ok
      },
    }
  },
}
