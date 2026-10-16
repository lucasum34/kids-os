// Íconos del escritorio: en una cuadrícula, se arrastran a donde uno quiera
// y con el clic derecho se ordenan (como en Windows).

import { abrirPrograma, alCambiarProgramas, listaProgramas } from './sistema'
import { alCambiarConfig, cambiarConfig, config } from './config'
import { el, menuContextual } from './ui'

const CLAVE = 'kidsos.escritorio'
const MARGEN = 10

interface Estado {
  pos: Record<string, [number, number]> // id del programa → [columna, fila]
  auto: boolean // organizar automáticamente
}

function leer(): Estado {
  try {
    return { pos: {}, auto: false, ...JSON.parse(localStorage.getItem(CLAVE) || '{}') }
  } catch {
    return { pos: {}, auto: false }
  }
}

export function armarIconos(fondo: HTMLElement, cont: HTMLElement) {
  let est = leer()
  const elementos = new Map<string, HTMLElement>()
  const guardar = () => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(est))
    } catch {}
  }

  // Tamaño de cada casillero según el tamaño de íconos elegido en Configuración.
  const escala = () => (config().iconos === 'chico' ? 0.75 : config().iconos === 'grande' ? 1.35 : 1)
  const ancho = () => Math.round(104 * escala())
  const alto = () => Math.round(108 * escala())
  const filas = () => Math.max(1, Math.floor((fondo.clientHeight - MARGEN * 2) / alto()))
  const columnas = () => Math.max(1, Math.floor((fondo.clientWidth - MARGEN * 2) / ancho()))
  const indice = ([c, r]: [number, number]) => c * filas() + r
  const casillero = (i: number): [number, number] => [Math.floor(i / filas()), i % filas()]

  /** Orden actual: de arriba a abajo y de izquierda a derecha (como los cuenta Windows). */
  const enOrden = () =>
    listaProgramas()
      .map((p) => p.id)
      .sort((a, b) => indice(est.pos[a] ?? [999, 0]) - indice(est.pos[b] ?? [999, 0]))

  /** Uno detrás del otro, sin huecos, en el orden dado. */
  function compactar(orden: string[]) {
    est.pos = {}
    orden.forEach((id, i) => (est.pos[id] = casillero(i)))
  }

  /** Que ninguno quede afuera de la pantalla ni encima de otro. */
  function acomodar() {
    const ocupado = new Set<string>()
    const sinLugar: string[] = []
    for (const id of enOrden()) {
      const p = est.pos[id]
      const k = p ? `${p[0]},${p[1]}` : ''
      if (!p || p[1] >= filas() || p[0] >= columnas() || ocupado.has(k)) sinLugar.push(id)
      else ocupado.add(k)
    }
    for (const id of sinLugar) {
      let i = 0
      while (ocupado.has(casillero(i).join(','))) i++
      est.pos[id] = casillero(i)
      ocupado.add(casillero(i).join(','))
    }
  }

  function dibujar() {
    if (est.auto) compactar(enOrden())
    acomodar()
    for (const [id, e] of elementos) {
      const [c, r] = est.pos[id]
      e.style.left = MARGEN + c * ancho() + 'px'
      e.style.top = MARGEN + r * alto() + 'px'
    }
  }

  const deseleccionar = () => cont.querySelectorAll('.icono').forEach((x) => x.classList.remove('elegido'))

  function armar() {
    elementos.forEach((e) => e.remove())
    elementos.clear()
    for (const p of listaProgramas()) crearIcono(p)
  }
  function crearIcono(p: { id: string; nombre: string; icono: string }) {
    const ic = el('div', 'icono')
    ic.tabIndex = 0
    ic.title = p.nombre
    ic.append(el('div', 'icono-dibujo', p.icono), el('div', 'icono-nombre', p.nombre))
    ic.ondblclick = () => abrirPrograma(p.id)
    ic.onkeydown = (e) => e.key === 'Enter' && abrirPrograma(p.id)
    ic.oncontextmenu = (e) => {
      e.preventDefault()
      e.stopPropagation()
      deseleccionar()
      ic.classList.add('elegido')
      menuContextual(e.clientX, e.clientY, [{ texto: 'Abrir', negrita: true, accion: () => abrirPrograma(p.id) }])
    }
    ic.onpointerdown = (e) => arrastrar(e, p.id, ic)
    elementos.set(p.id, ic)
    cont.append(ic)
  }
  armar()
  alCambiarProgramas(() => {
    armar()
    dibujar()
  })

  // --- Arrastrar un ícono: va al casillero más cercano; si ahí había otro, cambian de lugar.
  function arrastrar(e: PointerEvent, id: string, ic: HTMLElement) {
    if (e.button !== 0) return
    e.stopPropagation()
    deseleccionar()
    ic.classList.add('elegido')
    const r = cont.getBoundingClientRect()
    const dx = e.clientX - ic.offsetLeft
    const dy = e.clientY - ic.offsetTop
    const x0 = e.clientX
    const y0 = e.clientY
    let movio = false
    let sombra: HTMLElement | null = null
    const destino = (m: PointerEvent): [number, number] => {
      const x = m.clientX - dx - MARGEN
      const y = m.clientY - dy - MARGEN
      return [Math.max(0, Math.min(columnas() - 1, Math.round(x / ancho()))), Math.max(0, Math.min(filas() - 1, Math.round(y / alto())))]
    }
    const mov = (m: PointerEvent) => {
      if (!movio && Math.hypot(m.clientX - x0, m.clientY - y0) < 5) return
      if (!movio) {
        movio = true
        ic.classList.add('arrastrando')
        sombra = el('div', 'icono-sombra')
        sombra.style.width = ancho() - 8 + 'px'
        sombra.style.height = alto() - 8 + 'px'
        cont.append(sombra)
      }
      ic.style.left = m.clientX - dx + 'px'
      ic.style.top = m.clientY - dy + 'px'
      // Dónde va a quedar.
      const [c, f] = destino(m)
      sombra!.style.left = MARGEN + c * ancho() + 'px'
      sombra!.style.top = MARGEN + f * alto() + 'px'
    }
    const fin = (u: PointerEvent) => {
      document.removeEventListener('pointermove', mov)
      document.removeEventListener('pointerup', fin)
      ic.classList.remove('arrastrando')
      sombra?.remove()
      if (!movio) return
      const lugar = destino(u)
      if (est.auto) {
        // Organizado automáticamente: se mete en ese lugar de la fila y los demás se corren.
        const orden = enOrden().filter((x) => x !== id)
        orden.splice(Math.min(orden.length, indice(lugar)), 0, id)
        compactar(orden)
      } else {
        const otro = Object.keys(est.pos).find((k) => k !== id && est.pos[k][0] === lugar[0] && est.pos[k][1] === lugar[1])
        if (otro) est.pos[otro] = est.pos[id]
        est.pos[id] = lugar
      }
      guardar()
      dibujar()
      void r
    }
    document.addEventListener('pointermove', mov)
    document.addEventListener('pointerup', fin)
  }

  // --- Clic en el vacío: soltar la selección. Clic derecho: el menú del escritorio.
  fondo.addEventListener('click', (e) => {
    if (e.target === fondo || e.target === cont) deseleccionar()
  })
  fondo.addEventListener('contextmenu', (e) => {
    if (e.target !== fondo && e.target !== cont) return
    e.preventDefault()
    deseleccionar()
    const tam = config().iconos
    menuContextual(e.clientX, e.clientY, [
      {
        texto: 'Ver',
        sub: [
          { texto: 'Íconos grandes', marcado: tam === 'grande', accion: () => cambiarConfig({ iconos: 'grande' }) },
          { texto: 'Íconos medianos', marcado: tam === 'mediano', accion: () => cambiarConfig({ iconos: 'mediano' }) },
          { texto: 'Íconos chicos', marcado: tam === 'chico', accion: () => cambiarConfig({ iconos: 'chico' }) },
          '-',
          {
            texto: 'Organizar íconos automáticamente',
            marcado: est.auto,
            accion: () => {
              est.auto = !est.auto
              guardar()
              dibujar()
            },
          },
        ],
      },
      {
        texto: 'Ordenar por',
        sub: [
          { texto: 'Nombre', accion: () => ordenar((a, b) => a.nombre.localeCompare(b.nombre, 'es')) },
          { texto: 'Como venían', accion: () => ordenar(() => 0) },
        ],
      },
      '-',
      { texto: 'Abrir Mis cosas', accion: () => abrirPrograma('mis-cosas') },
      { texto: 'Personalizar', accion: () => abrirPrograma('configuracion') },
    ])
  })

  function ordenar(f: (a: { nombre: string }, b: { nombre: string }) => number) {
    compactar([...listaProgramas()].sort(f).map((p) => p.id))
    guardar()
    dibujar()
  }

  alCambiarConfig(dibujar)
  new ResizeObserver(dibujar).observe(fondo)
  dibujar()
}
