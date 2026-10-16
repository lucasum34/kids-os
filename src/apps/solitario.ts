// Solitario (Klondike), el de Windows.
// Enseña: arrastrar y soltar, doble clic. Las cartas se arrastran de a una o en escalera;
// doble clic manda una carta a las pilas de arriba; el mazo se da vuelta de a 1 o de a 3.

import { sonar } from '../os/sonido'
import { el } from '../os/ui'
import type { Programa } from '../os/ventanas'

interface Carta {
  palo: number // 0 ♠, 1 ♥, 2 ♦, 3 ♣
  valor: number // 1 (A) a 13 (K)
  arriba: boolean
}
type Lugar = { tipo: 'mazo' } | { tipo: 'descarte' } | { tipo: 'base'; i: number } | { tipo: 'mesa'; i: number }
interface Juego {
  mazo: Carta[]
  descarte: Carta[]
  bases: Carta[][]
  mesa: Carta[][]
  movidas: number
}

const PALOS = ['♠', '♥', '♦', '♣']
const VALORES = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const rojo = (c: Carta) => c.palo === 1 || c.palo === 2
const CLAVE = 'kidsos.solitario'

function repartir(): Juego {
  const mazo: Carta[] = []
  for (let p = 0; p < 4; p++) for (let v = 1; v <= 13; v++) mazo.push({ palo: p, valor: v, arriba: false })
  for (let i = mazo.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[mazo[i], mazo[j]] = [mazo[j], mazo[i]]
  }
  const mesa: Carta[][] = []
  for (let i = 0; i < 7; i++) {
    const pila = mazo.splice(0, i + 1)
    pila[pila.length - 1].arriba = true
    mesa.push(pila)
  }
  return { mazo, descarte: [], bases: [[], [], [], []], mesa, movidas: 0 }
}

export const solitario: Programa = {
  id: 'solitario',
  nombre: 'Solitario',
  icono: '🃏',
  ancho: 900,
  alto: 680,
  abrir(win) {
    let j: Juego = repartir()
    let deA3 = false
    try {
      deA3 = JSON.parse(localStorage.getItem(CLAVE) || '{}').deA3 ?? false
    } catch {}
    const atras: string[] = []
    let segundos = 0
    let empezo = false
    let gano = false

    const raiz = el('div', 'sol')
    const barra = el('div', 'sol-barra')
    const mesaEl = el('div', 'sol-mesa')
    const pie = el('div', 'sol-pie')
    raiz.append(barra, mesaEl, pie)
    win.cuerpo.append(raiz)

    const reloj = setInterval(() => {
      if (empezo && !gano && !win.minimizada) {
        segundos++
        ponerPie()
      }
    }, 1000)

    // ---------- Medidas: las cartas se achican con la ventana
    let W = 80
    let H = 112
    let sep = 12
    function medir() {
      const ancho = mesaEl.clientWidth
      sep = Math.max(6, ancho * 0.015)
      W = Math.min(110, (ancho - sep * 8) / 7)
      H = W * 1.4
    }
    const xCol = (i: number) => sep + i * (W + sep)
    const yMesa = () => sep * 2 + H
    function pasoMesa(pila: Carta[], k: number): number {
      // Las de abajo boca abajo van más juntas; si no entran, se aprietan todas.
      const alto = mesaEl.clientHeight - yMesa() - H - sep
      let a = 0
      let b = 0
      for (let n = 0; n < pila.length - 1; n++) pila[n].arriba ? b++ : a++
      let ab = H * 0.12
      let ar = H * 0.26
      const total = a * ab + b * ar
      if (total > alto && total > 0) {
        const f = alto / total
        ab *= f
        ar *= f
      }
      let y = 0
      for (let n = 0; n < k; n++) y += pila[n].arriba ? ar : ab
      return y
    }

    // ---------- Reglas
    const sePuedeEnBase = (c: Carta, base: Carta[]) => (base.length ? base[base.length - 1].palo === c.palo && base[base.length - 1].valor === c.valor - 1 : c.valor === 1)
    const sePuedeEnMesa = (c: Carta, pila: Carta[]) => {
      if (!pila.length) return c.valor === 13
      const t = pila[pila.length - 1]
      return t.arriba && rojo(t) !== rojo(c) && t.valor === c.valor + 1
    }
    const pilaDe = (l: Lugar): Carta[] => (l.tipo === 'mazo' ? j.mazo : l.tipo === 'descarte' ? j.descarte : l.tipo === 'base' ? j.bases[l.i] : j.mesa[l.i])

    function guardarPaso() {
      atras.push(JSON.stringify(j))
      if (atras.length > 200) atras.shift()
      empezo = true
    }
    function darVueltaLasDeArriba() {
      for (const p of j.mesa) if (p.length && !p[p.length - 1].arriba) p[p.length - 1].arriba = true
    }

    function mover(desde: Lugar, cuantas: number, hacia: Lugar): boolean {
      const origen = pilaDe(desde)
      const grupo = origen.slice(origen.length - cuantas)
      const destino = pilaDe(hacia)
      if (!grupo.length) return false
      if (hacia.tipo === 'base' ? !(cuantas === 1 && sePuedeEnBase(grupo[0], destino)) : hacia.tipo === 'mesa' ? !sePuedeEnMesa(grupo[0], destino) : true) return false
      guardarPaso()
      origen.splice(origen.length - cuantas, cuantas)
      destino.push(...grupo)
      j.movidas++
      darVueltaLasDeArriba()
      revisar()
      return true
    }

    function sacarDelMazo() {
      guardarPaso()
      if (!j.mazo.length) {
        // Se da vuelta el descarte y vuelve a ser el mazo.
        j.mazo = j.descarte.reverse().map((c) => ({ ...c, arriba: false }))
        j.descarte = []
      } else {
        const n = deA3 ? 3 : 1
        for (let k = 0; k < n && j.mazo.length; k++) {
          const c = j.mazo.pop()!
          c.arriba = true
          j.descarte.push(c)
        }
      }
      j.movidas++
      dibujar()
    }

    /** Doble clic: a la base si se puede. */
    function aLaBase(desde: Lugar): boolean {
      const p = pilaDe(desde)
      const c = p[p.length - 1]
      if (!c) return false
      for (let i = 0; i < 4; i++) if (sePuedeEnBase(c, j.bases[i])) return mover(desde, 1, { tipo: 'base', i })
      return false
    }

    function revisar() {
      if (j.bases.every((b) => b.length === 13) && !gano) {
        gano = true
        sonar('bien')
        festejo()
      }
    }
    const todasDadasVuelta = () => !j.mazo.length && !j.descarte.length && j.mesa.every((p) => p.every((c) => c.arriba))

    /** Cuando ya está todo a la vista, las cartas suben solas a las bases. */
    async function terminarSolo() {
      let algo = true
      while (algo && !gano) {
        algo = false
        for (let i = 0; i < 7 && !algo; i++) if (aLaBase({ tipo: 'mesa', i })) algo = true
        dibujar()
        await new Promise((r) => setTimeout(r, 90))
      }
    }

    // ---------- Dibujar
    function cartaEl(c: Carta | null, x: number, y: number): HTMLElement {
      const d = el('div', 'carta')
      d.style.left = x + 'px'
      d.style.top = y + 'px'
      d.style.width = W + 'px'
      d.style.height = H + 'px'
      d.style.fontSize = W * 0.22 + 'px'
      if (!c) {
        d.classList.add('hueco')
        return d
      }
      if (!c.arriba) {
        d.classList.add('dorso')
        return d
      }
      if (rojo(c)) d.classList.add('roja')
      const esq = `<span>${VALORES[c.valor]}</span><span>${PALOS[c.palo]}</span>`
      d.innerHTML = `<div class="esq a">${esq}</div><div class="centro">${c.valor > 10 ? ['J', 'Q', 'K'][c.valor - 11] + PALOS[c.palo] : PALOS[c.palo]}</div><div class="esq b">${esq}</div>`
      return d
    }

    function dibujar() {
      medir()
      mesaEl.replaceChildren()
      // Mazo.
      const m = cartaEl(j.mazo.length ? j.mazo[j.mazo.length - 1] : null, xCol(0), sep)
      if (!j.mazo.length) {
        m.textContent = '↻'
        m.classList.add('reciclar')
      }
      m.onclick = sacarDelMazo
      m.title = 'Clic para sacar cartas'
      mesaEl.append(m)
      // Descarte (de a 3 se ven abiertas en abanico).
      const visibles = j.descarte.slice(deA3 ? -3 : -1)
      if (!visibles.length) mesaEl.append(cartaEl(null, xCol(1), sep))
      visibles.forEach((c, k) => {
        const d = cartaEl(c, xCol(1) + k * W * 0.22, sep)
        if (k === visibles.length - 1) prepararArrastre(d, { tipo: 'descarte' }, 1)
        mesaEl.append(d)
      })
      // Bases.
      j.bases.forEach((b, i) => {
        const d = cartaEl(b.length ? b[b.length - 1] : null, xCol(3 + i), sep)
        if (!b.length) {
          d.textContent = 'A'
          d.classList.add('base-vacia')
        } else prepararArrastre(d, { tipo: 'base', i }, 1)
        d.dataset.lugar = `base:${i}`
        mesaEl.append(d)
      })
      // Mesa.
      j.mesa.forEach((p, i) => {
        if (!p.length) {
          const h = cartaEl(null, xCol(i), yMesa())
          h.dataset.lugar = `mesa:${i}`
          mesaEl.append(h)
        }
        p.forEach((c, k) => {
          const d = cartaEl(c, xCol(i), yMesa() + pasoMesa(p, k))
          d.dataset.lugar = `mesa:${i}`
          if (c.arriba) prepararArrastre(d, { tipo: 'mesa', i }, p.length - k)
          mesaEl.append(d)
        })
      })
      dibujarBarra()
      ponerPie()
    }

    function dibujarBarra() {
      barra.replaceChildren()
      const b = (t: string, titulo: string, f: () => void, activo = true) => {
        const x = el('button', 'boton chico', t)
        x.title = titulo
        x.disabled = !activo
        x.onclick = f
        barra.append(x)
      }
      b('Nueva partida', 'F2', nueva)
      b('↶ Deshacer', 'Ctrl+Z', deshacer, atras.length > 0)
      b(deA3 ? 'Sacar de a 3' : 'Sacar de a 1', 'Cambia cuántas cartas da el mazo (empieza una partida nueva)', () => {
        deA3 = !deA3
        try {
          localStorage.setItem(CLAVE, JSON.stringify({ deA3 }))
        } catch {}
        nueva()
      })
      if (todasDadasVuelta() && !gano) b('✨ Terminar solo', 'Manda todas las cartas a las bases', () => terminarSolo())
    }

    function ponerPie() {
      const m = Math.floor(segundos / 60)
      pie.textContent = gano
        ? `¡Ganaste! ${j.movidas} movidas en ${m}:${String(segundos % 60).padStart(2, '0')}`
        : `Movidas: ${j.movidas}   ·   Tiempo: ${m}:${String(segundos % 60).padStart(2, '0')}   ·   Arrastrá las cartas · Doble clic las sube a las bases`
    }

    // ---------- Arrastrar
    function prepararArrastre(d: HTMLElement, desde: Lugar, cuantas: number) {
      d.classList.add('movil')
      d.onpointerdown = (e) => {
        if (e.button !== 0 || gano) return
        e.preventDefault()
        // Lo que se arrastra: esta carta y las que tiene encima.
        const todos = [...mesaEl.children] as HTMLElement[]
        const idx = todos.indexOf(d)
        const grupo = todos.slice(idx, idx + cuantas)
        const x0 = e.clientX
        const y0 = e.clientY
        let movio = false
        grupo.forEach((g) => (g.style.zIndex = '100'))
        const mov = (m: PointerEvent) => {
          const dx = m.clientX - x0
          const dy = m.clientY - y0
          if (!movio && Math.hypot(dx, dy) < 4) return
          movio = true
          grupo.forEach((g) => {
            g.style.transform = `translate(${dx}px, ${dy}px)`
            g.classList.add('volando')
          })
        }
        const fin = (u: PointerEvent) => {
          document.removeEventListener('pointermove', mov)
          document.removeEventListener('pointerup', fin)
          if (!movio) {
            // Fue un clic: no se redibuja, así el doble clic encuentra la misma carta.
            grupo.forEach((g) => (g.style.zIndex = ''))
            return
          }
          // ¿Dónde cayó? En la pila que más se superpone con la carta.
          const r = d.getBoundingClientRect()
          grupo.forEach((g) => (g.style.visibility = 'hidden'))
          const destinos: { tipo: 'base' | 'mesa'; i: number }[] = [...[0, 1, 2, 3].map((i) => ({ tipo: 'base' as const, i })), ...[0, 1, 2, 3, 4, 5, 6].map((i) => ({ tipo: 'mesa' as const, i }))]
          const zona = mesaEl.getBoundingClientRect()
          let mejor: { tipo: 'base' | 'mesa'; i: number } | null = null
          let mejorArea = 0
          for (const l of destinos) {
            if (l.tipo === desde.tipo && 'i' in desde && 'i' in l && l.i === desde.i) continue
            const px = zona.left + xCol(l.i)
            const py = zona.top + (l.tipo === 'base' ? sep : yMesa() + (j.mesa[l.i].length ? pasoMesa(j.mesa[l.i], j.mesa[l.i].length - 1) : 0))
            const ax = Math.max(0, Math.min(r.right, px + W) - Math.max(r.left, px))
            const ay = Math.max(0, Math.min(r.bottom, py + H) - Math.max(r.top, py))
            if (ax * ay > mejorArea) {
              mejorArea = ax * ay
              mejor = l
            }
          }
          void u
          if (!mejor || !mover(desde, cuantas, mejor)) sonar('aviso')
          dibujar()
        }
        document.addEventListener('pointermove', mov)
        document.addEventListener('pointerup', fin)
      }
      d.ondblclick = () => {
        if (cuantas === 1 && aLaBase(desde)) dibujar()
      }
    }

    // ---------- Fin
    function festejo() {
      dibujar()
      // Las cartas de las bases saltan por la mesa, como en el Windows de antes.
      const cartas = [...mesaEl.querySelectorAll('.carta:not(.hueco)')] as HTMLElement[]
      cartas.forEach((c, i) => {
        c.style.transition = `transform 1.6s cubic-bezier(.3,.6,.4,1) ${i * 0.03}s`
        c.style.transform = `translate(${(Math.random() - 0.5) * mesaEl.clientWidth}px, ${mesaEl.clientHeight * 0.6}px) rotate(${(Math.random() - 0.5) * 720}deg)`
      })
    }

    function nueva() {
      j = repartir()
      atras.length = 0
      segundos = 0
      empezo = false
      gano = false
      dibujar()
    }
    function deshacer() {
      const p = atras.pop()
      if (!p) return
      j = JSON.parse(p)
      gano = false
      dibujar()
    }

    const obs = new ResizeObserver(() => dibujar())
    obs.observe(mesaEl)

    return {
      alTecla(e) {
        if (e.key === 'F2') nueva()
        else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') deshacer()
        else if (e.key === ' ') sacarDelMazo()
        else return false
        return true
      },
      async alCerrar() {
        clearInterval(reloj)
        obs.disconnect()
        return true
      },
    }
  },
}
