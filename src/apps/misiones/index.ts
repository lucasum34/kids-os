// Misiones: el mapa de islas (una por programa), las misiones de cada una con sus
// estrellas, y el álbum de figuritas que se ganan.

import { empezarMision, progreso, type Mision } from '../../os/guia'
import { el } from '../../os/ui'
import { ventanasAbiertas, type Programa } from '../../os/ventanas'
import { abrirPrograma } from '../../os/sistema'
import { MISIONES_TABLERO } from './tablero'
import { MISIONES_CUADERNO } from './cuaderno'
import { MISIONES_PINCEL } from './pincel'
import { MISIONES_TRAZOS } from './trazos'
import { MISIONES_DIAPOSITIVAS } from './diapositivas'
import { MISIONES_REGLA } from './regla'
import { MISIONES_FOTO } from './foto'
import { MISIONES_CONSTRUIR } from './construir'
import { MISIONES_COMPU } from './compu'

interface Isla {
  id: string
  nombre: string
  icono: string
  color: string
  misiones: Mision<never>[]
}
const lista = <A>(m: Mision<A>[]) => m as unknown as Mision<never>[]
const ISLAS: Isla[] = [
  // Ordenadas de lo más fácil a lo más difícil.
  { id: 'compu', nombre: 'Isla Compu', icono: '💻', color: '#3949ab', misiones: lista(MISIONES_COMPU) },
  { id: 'pincel', nombre: 'Isla Pincel', icono: '🖌️', color: '#ec407a', misiones: lista(MISIONES_PINCEL) },
  { id: 'cuaderno', nombre: 'Isla Cuaderno', icono: '📝', color: '#1e88e5', misiones: lista(MISIONES_CUADERNO) },
  { id: 'trazos', nombre: 'Isla Trazos', icono: '✒️', color: '#8e24aa', misiones: lista(MISIONES_TRAZOS) },
  { id: 'diapositivas', nombre: 'Isla Diapositivas', icono: '📽️', color: '#e64a19', misiones: lista(MISIONES_DIAPOSITIVAS) },
  { id: 'tablero', nombre: 'Isla Tablero', icono: '📊', color: '#43a047', misiones: lista(MISIONES_TABLERO) },
  { id: 'foto', nombre: 'Isla Foto', icono: '🖼️', color: '#00838f', misiones: lista(MISIONES_FOTO) },
  { id: 'regla', nombre: 'Isla Regla', icono: '📐', color: '#546e7a', misiones: lista(MISIONES_REGLA) },
  { id: 'construir', nombre: 'Isla Construir', icono: '🏠', color: '#6d4c41', misiones: lista(MISIONES_CONSTRUIR) },
]

export const misiones: Programa = {
  id: 'misiones',
  nombre: 'Misiones',
  icono: '🗺️',
  ancho: 980,
  alto: 680,
  abrir(win) {
    let isla = ISLAS[0]
    let vista: 'mapa' | 'album' = 'mapa'
    const raiz = el('div', 'mis')
    win.cuerpo.append(raiz)

    const volverAlMapa = () => {
      const ya = ventanasAbiertas().find((v) => v.raiz.contains(raiz))
      if (ya) {
        ya.enfocar()
        dibujar()
      } else abrirPrograma('misiones')
    }

    function dibujar() {
      const p = progreso()
      raiz.replaceChildren()
      const cab = el('div', 'mis-cab')
      const total = ISLAS.flatMap((i) => i.misiones).length
      const hechas = ISLAS.flatMap((i) => i.misiones).filter((m) => p[m.id]).length
      const estrellas = Object.values(p).reduce((a, b) => a + b, 0)
      cab.append(el('div', 'mis-titulo', '🗺️ Mis misiones'), el('div', 'mis-cuenta', `⭐ ${estrellas}   ·   ${hechas} de ${total} misiones`))
      const tabs = el('div', 'mis-tabs')
      for (const [id, t] of [
        ['mapa', '🏝️ Islas'],
        ['album', '📒 Mi álbum'],
      ] as const) {
        const b = el('button', 'mis-tab' + (vista === id ? ' activa' : ''), t)
        b.onclick = () => {
          vista = id
          dibujar()
        }
        tabs.append(b)
      }
      cab.append(tabs)
      raiz.append(cab)

      if (vista === 'album') {
        const album = el('div', 'mis-album')
        for (const i of ISLAS)
          for (const m of i.misiones) {
            const f = el('div', 'mis-figurita' + (p[m.id] ? ' tiene' : ''))
            f.append(el('div', 'mis-fig-dibujo', p[m.id] ? m.figurita : '?'), el('div', 'mis-fig-nombre', p[m.id] ? m.titulo : '???'))
            album.append(f)
          }
        raiz.append(album, el('div', 'mis-pista', 'Cada misión cumplida te da una figurita. ¡Llená el álbum!'))
        return
      }

      const cuerpo = el('div', 'mis-cuerpo')
      const islas = el('div', 'mis-islas')
      for (const i of ISLAS) {
        const n = i.misiones.length
        const h = i.misiones.filter((m) => p[m.id]).length
        const b = el('button', 'mis-isla' + (i === isla ? ' activa' : '') + (n ? '' : ' pronto'))
        b.style.setProperty('--color', i.color)
        b.append(el('span', 'mis-isla-icono', i.icono), el('span', 'mis-isla-nombre', i.nombre), el('span', 'mis-isla-cuenta', n ? `${h}/${n}` : 'Pronto'))
        b.onclick = () => {
          isla = i
          dibujar()
        }
        islas.append(b)
      }
      const lista = el('div', 'mis-lista')
      if (!isla.misiones.length) lista.append(el('div', 'mis-pronto', `${isla.icono} Las misiones de esta isla están en camino.`))
      isla.misiones.forEach((m, k) => {
        const abierta = k === 0 || !!p[isla.misiones[k - 1].id]
        const e = p[m.id] ?? 0
        const c = el('button', 'mis-mision' + (abierta ? '' : ' cerrada') + (e ? ' hecha' : ''))
        c.style.setProperty('--color', isla.color)
        c.append(
          el('div', 'mis-num', abierta ? String(k + 1) : '🔒'),
          el('div', 'mis-icono', m.icono),
          (() => {
            const t = el('div', 'mis-texto')
            t.append(el('div', 'mis-nombre', m.titulo), el('div', 'mis-resumen', m.resumen))
            return t
          })(),
          el('div', 'mis-estrellas', e ? '★'.repeat(e) + '☆'.repeat(3 - e) : abierta ? '▶ Jugar' : ''),
        )
        c.disabled = !abierta
        c.onclick = () => empezarMision(m, volverAlMapa)
        lista.append(c)
      })
      cuerpo.append(islas, lista)
      raiz.append(cuerpo)
    }

    const alCambiar = () => dibujar()
    addEventListener('kidsos-misiones', alCambiar)
    dibujar()
    return {
      async alCerrar() {
        removeEventListener('kidsos-misiones', alCambiar)
        return true
      },
    }
  },
}
