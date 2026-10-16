// Buscaminas: el clásico de Windows.
// Enseña: clic izquierdo y clic derecho (banderita), pensar con los números.
// El primer clic nunca es mina. Clic en un número con todas sus banderas puestas abre los vecinos.

import { sonar } from '../os/sonido'
import { el } from '../os/ui'
import type { Programa } from '../os/ventanas'

const NIVELES = [
  { nombre: 'Principiante', ancho: 9, alto: 9, minas: 10 },
  { nombre: 'Intermedio', ancho: 16, alto: 16, minas: 40 },
  { nombre: 'Experto', ancho: 30, alto: 16, minas: 99 },
]
const COLOR_NUM = ['', '#1e5bd8', '#2e7d32', '#d32f2f', '#1a237e', '#7b1f1f', '#00838f', '#000', '#757575']
const CLAVE = 'kidsos.buscaminas.records'

interface Celda {
  mina: boolean
  abierta: boolean
  marca: '' | 'bandera' | 'duda'
  vecinas: number
}

export const buscaminas: Programa = {
  id: 'buscaminas',
  nombre: 'Buscaminas',
  icono: '💣',
  ancho: 560,
  alto: 600,
  abrir(win) {
    let nivel = 0
    let grilla: Celda[][] = []
    let estado: 'listo' | 'jugando' | 'gano' | 'perdio' = 'listo'
    let segundos = 0
    let reloj = 0
    let explotada: [number, number] | null = null
    let records: Record<string, number> = {}
    try {
      records = JSON.parse(localStorage.getItem(CLAVE) || '{}')
    } catch {}

    const raiz = el('div', 'bm')
    const barra = el('div', 'bm-niveles')
    const marco = el('div', 'bm-marco')
    const cabeza = el('div', 'bm-cabeza')
    const cuentaMinas = el('div', 'bm-digitos')
    const cara = el('button', 'bm-cara', '🙂')
    const tiempo = el('div', 'bm-digitos')
    cabeza.append(cuentaMinas, cara, tiempo)
    const tablero = el('div', 'bm-tablero')
    marco.append(cabeza, tablero)
    const pie = el('div', 'bm-pie')
    raiz.append(barra, marco, pie)
    win.cuerpo.append(raiz)

    const N = () => NIVELES[nivel]
    const vecinos = (x: number, y: number) => {
      const r: [number, number][] = []
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          if ((dx || dy) && nx >= 0 && ny >= 0 && nx < N().ancho && ny < N().alto) r.push([nx, ny])
        }
      return r
    }

    function nuevo() {
      clearInterval(reloj)
      grilla = Array.from({ length: N().alto }, () => Array.from({ length: N().ancho }, () => ({ mina: false, abierta: false, marca: '' as const, vecinas: 0 })))
      estado = 'listo'
      segundos = 0
      explotada = null
      // La ventana se acomoda al tamaño del tablero (como el Buscaminas de siempre).
      if (!win.raiz.classList.contains('maximizada')) {
        win.raiz.style.width = Math.max(380, N().ancho * 26 + 48) + 'px'
        win.raiz.style.height = N().alto * 26 + 210 + 'px'
      }
      dibujar()
    }

    /** Las minas se ponen recién en el primer clic, lejos de esa celda. */
    function sembrar(x0: number, y0: number) {
      const prohibidas = new Set([`${x0},${y0}`, ...vecinos(x0, y0).map(([x, y]) => `${x},${y}`)])
      let puestas = 0
      while (puestas < N().minas) {
        const x = Math.floor(Math.random() * N().ancho)
        const y = Math.floor(Math.random() * N().alto)
        if (grilla[y][x].mina || prohibidas.has(`${x},${y}`)) continue
        grilla[y][x].mina = true
        puestas++
      }
      for (let y = 0; y < N().alto; y++) for (let x = 0; x < N().ancho; x++) grilla[y][x].vecinas = vecinos(x, y).filter(([a, b]) => grilla[b][a].mina).length
      estado = 'jugando'
      reloj = window.setInterval(() => {
        if (win.minimizada) return
        segundos = Math.min(999, segundos + 1)
        tiempo.textContent = String(segundos).padStart(3, '0')
      }, 1000)
    }

    function abrir(x: number, y: number) {
      const c = grilla[y][x]
      if (c.abierta || c.marca === 'bandera') return
      if (c.mina) return perder(x, y)
      // Si no tiene minas alrededor, se abren solas las de al lado.
      const pila: [number, number][] = [[x, y]]
      while (pila.length) {
        const [a, b] = pila.pop()!
        const d = grilla[b][a]
        if (d.abierta || d.marca === 'bandera') continue
        d.abierta = true
        d.marca = ''
        if (d.vecinas === 0) for (const v of vecinos(a, b)) if (!grilla[v[1]][v[0]].abierta) pila.push(v)
      }
    }

    function clic(x: number, y: number) {
      if (estado === 'gano' || estado === 'perdio') return
      if (estado === 'listo') sembrar(x, y)
      const c = grilla[y][x]
      if (c.abierta && c.vecinas > 0) {
        // Clic en un número: si tiene todas sus banderas, abre las demás vecinas.
        const vs = vecinos(x, y)
        const banderas = vs.filter(([a, b]) => grilla[b][a].marca === 'bandera').length
        if (banderas === c.vecinas) for (const [a, b] of vs) if (estado === 'jugando') abrir(a, b)
      } else abrir(x, y)
      if (estado === 'jugando') revisarSiGano()
      dibujar()
    }

    function marcar(x: number, y: number) {
      if (estado === 'gano' || estado === 'perdio') return
      const c = grilla[y][x]
      if (c.abierta) return
      c.marca = c.marca === '' ? 'bandera' : c.marca === 'bandera' ? 'duda' : ''
      dibujar()
    }

    function perder(x: number, y: number) {
      estado = 'perdio'
      explotada = [x, y]
      clearInterval(reloj)
      sonar('mal')
    }
    function revisarSiGano() {
      const faltan = grilla.flat().filter((c) => !c.mina && !c.abierta).length
      if (faltan) return
      estado = 'gano'
      clearInterval(reloj)
      grilla.flat().forEach((c) => c.mina && (c.marca = 'bandera'))
      const n = N().nombre
      if (!records[n] || segundos < records[n]) {
        records[n] = segundos
        try {
          localStorage.setItem(CLAVE, JSON.stringify(records))
        } catch {}
      }
      sonar('bien')
    }

    function dibujar() {
      barra.replaceChildren()
      NIVELES.forEach((n, i) => {
        const b = el('button', 'bm-nivel' + (i === nivel ? ' activo' : ''), n.nombre)
        b.onclick = () => {
          nivel = i
          nuevo()
        }
        barra.append(b)
      })
      const banderas = grilla.flat().filter((c) => c.marca === 'bandera').length
      cuentaMinas.textContent = String(Math.max(-99, N().minas - banderas)).padStart(3, '0')
      tiempo.textContent = String(segundos).padStart(3, '0')
      cara.textContent = estado === 'gano' ? '😎' : estado === 'perdio' ? '😵' : '🙂'
      tablero.style.gridTemplateColumns = `repeat(${N().ancho}, var(--bm-celda))`
      tablero.replaceChildren()
      grilla.forEach((fila, y) =>
        fila.forEach((c, x) => {
          const d = el('div', 'bm-celda')
          if (c.abierta) {
            d.classList.add('abierta')
            if (c.vecinas) {
              d.textContent = String(c.vecinas)
              d.style.color = COLOR_NUM[c.vecinas]
            }
          } else if (estado === 'perdio' && c.mina) {
            d.classList.add('abierta')
            d.textContent = '💣'
            if (explotada && explotada[0] === x && explotada[1] === y) d.classList.add('explotada')
          } else if (estado === 'perdio' && c.marca === 'bandera') {
            d.textContent = '❌' // bandera puesta donde no había mina
          } else if (c.marca === 'bandera') d.textContent = '🚩'
          else if (c.marca === 'duda') d.textContent = '?'
          d.onmousedown = (e) => {
            if (e.button === 0 && estado !== 'gano' && estado !== 'perdio') cara.textContent = '😮'
          }
          d.onmouseup = (e) => {
            if (e.button === 0) clic(x, y)
            else if (e.button === 1) {
              // Botón del medio: abrir alrededor, como en el clásico.
              if (c.abierta) clic(x, y)
            }
          }
          d.oncontextmenu = (e) => {
            e.preventDefault()
            marcar(x, y)
          }
          tablero.append(d)
        }),
      )
      const r = records[N().nombre]
      pie.textContent =
        estado === 'gano'
          ? `¡Ganaste en ${segundos} segundos!${r === segundos ? ' ¡Récord nuevo!' : ''}`
          : estado === 'perdio'
            ? '¡Boom! Apretá la carita para jugar otra vez.'
            : `Clic: abrir · Clic derecho: banderita 🚩 · ${r ? `Récord: ${r} s` : 'Todavía sin récord'}`
    }

    cara.onclick = () => nuevo()
    nuevo()

    return {
      alTecla(e) {
        if (e.key === 'F2') {
          nuevo()
          return true
        }
        return false
      },
      async alCerrar() {
        clearInterval(reloj)
        return true
      },
    }
  },
}
