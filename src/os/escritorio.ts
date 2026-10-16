// Escritorio: íconos, barra de tareas, botón de inicio y reloj.

import { listaProgramas, abrirPrograma } from './sistema'
import { alCambiarVentanas, iniciarVentanas, minimizar, ventanaActiva, ventanasAbiertas } from './ventanas'
import { el } from './ui'
import { alCambiarConfig, aplicar, config } from './config'
import { armarIconos } from './iconos'
import * as fs from './archivos'
import { sonar } from './sonido'
import { menuContextual } from './ui'
import { esPrograma, puente } from './compu'
import { asegurarClave, menuPapa } from './papa'

export function armarEscritorio(raiz: HTMLElement) {
  const fondo = el('div', 'escritorio')
  const iconos = el('div', 'escritorio-iconos')
  const barra = el('div', 'barra-tareas')
  raiz.append(fondo, barra)
  fondo.append(iconos)
  iniciarVentanas(fondo)
  aplicar()

  // --- Íconos: un clic elige, doble clic abre, se arrastran y se ordenan (ver iconos.ts).
  armarIconos(fondo, iconos)

  // --- Botón de inicio con la lista de programas.
  const inicio = el('button', 'inicio', '🏠')
  inicio.title = 'Inicio'
  let menu: HTMLElement | null = null
  const cerrarMenu = () => {
    menu?.remove()
    menu = null
  }
  inicio.onclick = (e) => {
    e.stopPropagation()
    if (menu) return cerrarMenu()
    menu = el('div', 'menu-inicio')
    const nombre = config().nombre.trim()
    if (nombre) menu.append(el('div', 'menu-inicio-hola', `¡Hola, ${nombre}!`))
    menu.append(el('div', 'menu-inicio-titulo', 'Programas'))
    for (const p of listaProgramas()) {
      const f = el('div', 'menu-inicio-item')
      f.append(el('span', 'mi-icono', p.icono), el('span', '', p.nombre))
      f.onclick = () => {
        cerrarMenu()
        abrirPrograma(p.id)
      }
      menu.append(f)
    }
    if (esPrograma) {
      // En la compu de verdad: apagar y cerrar sesión (no hay otro escritorio adonde ir).
      const pie = el('div', 'menu-inicio-pie')
      const apagar = el('button', 'menu-inicio-apagar', '⏻ Apagar')
      apagar.onclick = () => puente!.sistema.apagar()
      const sesion = el('button', 'menu-inicio-apagar', '↪ Cerrar sesión')
      sesion.onclick = () => puente!.sistema.cerrarSesion()
      pie.append(sesion, apagar)
      menu.append(pie)
    }
    raiz.append(menu)
  }
  document.addEventListener('pointerdown', (e) => {
    if (menu && !menu.contains(e.target as Node) && e.target !== inicio) cerrarMenu()
  })

  // --- Botones de las ventanas abiertas.
  const tareas = el('div', 'tareas')
  const reloj = el('div', 'reloj')
  // --- Bandeja: el pendrive de práctica (enchufar, abrir, quitar de forma segura).
  const pendrive = el('button', 'bandeja', '🔌')
  const ponerPendrive = () => {
    pendrive.classList.toggle('prendida', fs.pendriveConectado())
    pendrive.title = fs.pendriveConectado() ? 'PENDRIVE (E:) — clic para abrirlo o quitarlo' : 'Enchufar el pendrive de práctica'
  }
  pendrive.onclick = () => {
    const r = pendrive.getBoundingClientRect()
    if (!fs.pendriveConectado())
      return menuContextual(r.left, r.top - 60, [{ texto: '🔌 Enchufar el pendrive de práctica', accion: () => enchufar() }])
    menuContextual(r.left - 160, r.top - 80, [
      { texto: 'Abrir PENDRIVE (E:)', negrita: true, accion: () => abrirPendrive() },
      { texto: '⏏ Quitar de forma segura', accion: () => quitar() },
    ])
  }
  function enchufar() {
    fs.enchufarPendrive(true)
    sonar('bien')
    avisoSistema('🔌', 'Se conectó PENDRIVE (E:). Hacé clic acá para abrirlo.', abrirPendrive)
  }
  function abrirPendrive() {
    const v = abrirPrograma('mis-cosas')
    ;(v?.api as { ir?: (a: string) => void } | undefined)?.ir?.(fs.PENDRIVE)
  }
  function quitar() {
    fs.enchufarPendrive(false)
    avisoSistema('⏏', 'Ya podés sacar el pendrive de la compu.')
  }
  fs.alCambiar(ponerPendrive)
  ponerPendrive()

  // Menú de papá o mamá: Ctrl+Alt+Mayús+P (con la clave).
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.ctrlKey && e.altKey && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        e.stopPropagation()
        menuPapa()
      }
    },
    true,
  )
  // La primera vez, un adulto elige la clave.
  setTimeout(() => asegurarClave(), 300)

  barra.append(inicio, tareas, pendrive, reloj)

  const dibujarTareas = () => {
    tareas.replaceChildren()
    for (const v of ventanasAbiertas()) {
      const b = el('button', 'tarea')
      if (v === ventanaActiva()) b.classList.add('activa')
      b.append(el('span', '', v.icono), el('span', 'tarea-texto', v.titulo))
      // Clic: si está al frente se minimiza; si no, viene al frente.
      b.onclick = () => (v === ventanaActiva() ? minimizar(v) : v.enfocar())
      tareas.append(b)
    }
  }
  alCambiarVentanas(dibujarTareas)

  const tic = () => {
    const d = new Date()
    reloj.replaceChildren(
      el('div', 'reloj-hora', d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: !config().reloj24 })),
      el('div', 'reloj-fecha', d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })),
    )
  }
  tic()
  setInterval(tic, 10_000)
  alCambiarConfig(tic)
}

/** Aviso abajo a la derecha, como las notificaciones de Windows. */
export function avisoSistema(icono: string, texto: string, alClic?: () => void) {
  document.querySelectorAll('.aviso-sistema').forEach((x) => x.remove())
  const a = el('div', 'aviso-sistema')
  a.append(el('span', 'aviso-icono', icono), el('span', 'aviso-texto', texto))
  a.onclick = () => {
    a.remove()
    alClic?.()
  }
  document.body.append(a)
  setTimeout(() => a.remove(), 5000)
}
document.addEventListener('kidsos-aviso', (e) => {
  const d = (e as CustomEvent<{ icono: string; texto: string }>).detail
  avisoSistema(d.icono, d.texto)
})
