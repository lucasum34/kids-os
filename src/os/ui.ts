// Piezas de interfaz comunes: elementos, cuadros de diálogo y barra de menú.
// Sin confirm()/prompt() del navegador: se ven distinto de una compu de verdad
// y además el panel de Claude los bloquea.

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  clase = '',
  texto = '',
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (clase) e.className = clase
  if (texto) e.textContent = texto
  return e
}

interface OpcionesDialogo {
  titulo: string
  mensaje?: string
  icono?: string
  botones: { texto: string; valor: string; principal?: boolean }[]
  /** Si viene, muestra un campo de texto con este valor inicial. */
  campo?: string
  /** El campo es una clave (se ven puntitos). */
  clave?: boolean
  /** Contenido extra (ej.: lista de archivos para Abrir). */
  contenido?: HTMLElement
}

/** Cuadro de diálogo modal. Resuelve con el valor del botón (o 'cancelar' con Esc). */
export function dialogo(o: OpcionesDialogo): Promise<{ boton: string; texto: string }> {
  return new Promise((resolver) => {
    const fondo = el('div', 'dialogo-fondo')
    const caja = el('div', 'dialogo')
    const barra = el('div', 'dialogo-titulo', o.titulo)
    const cuerpo = el('div', 'dialogo-cuerpo')
    if (o.icono || o.mensaje) {
      const fila = el('div', 'dialogo-mensaje')
      if (o.icono) fila.append(el('span', 'dialogo-icono', o.icono))
      if (o.mensaje) fila.append(el('span', '', o.mensaje))
      cuerpo.append(fila)
    }
    if (o.contenido) cuerpo.append(o.contenido)
    let input: HTMLInputElement | null = null
    if (o.campo !== undefined) {
      input = el('input', 'campo')
      if (o.clave) input.type = 'password'
      input.value = o.campo
      cuerpo.append(input)
    }
    const botones = el('div', 'dialogo-botones')
    const cerrar = (boton: string) => {
      fondo.remove()
      document.removeEventListener('keydown', teclas, true)
      resolver({ boton, texto: input?.value.trim() ?? '' })
    }
    const principal = o.botones.find((b) => b.principal) ?? o.botones[0]
    for (const b of o.botones) {
      const btn = el('button', 'boton' + (b.principal ? ' principal' : ''), b.texto)
      btn.onclick = () => cerrar(b.valor)
      botones.append(btn)
    }
    const teclas = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar('cancelar')
      else if (e.key === 'Enter') cerrar(principal.valor)
      else return
      e.preventDefault()
      e.stopPropagation()
    }
    document.addEventListener('keydown', teclas, true)
    caja.append(barra, cuerpo, botones)
    fondo.append(caja)
    document.body.append(fondo)
    if (input) {
      input.focus()
      input.select()
    }
  })
}

export function aviso(titulo: string, mensaje: string, icono = 'ℹ️') {
  return dialogo({ titulo, mensaje, icono, botones: [{ texto: 'Aceptar', valor: 'ok', principal: true }] })
}

export interface ItemMenu {
  texto: string
  atajo?: string
  accion: () => void
  activo?: () => boolean
}
export type Menu = { titulo: string; items: (ItemMenu | '-')[] }

/** Barra de menú clásica (Archivo, Editar...). */
export function barraMenu(menus: Menu[]): HTMLElement {
  const barra = el('div', 'menu-barra')
  let abierto: HTMLElement | null = null
  const cerrarTodo = () => {
    abierto?.remove()
    abierto = null
    barra.querySelectorAll('.menu-titulo').forEach((t) => t.classList.remove('abierto'))
  }
  for (const m of menus) {
    const t = el('div', 'menu-titulo', m.titulo)
    const abrir = () => {
      cerrarTodo()
      t.classList.add('abierto')
      const lista = el('div', 'menu-lista')
      for (const it of m.items) {
        if (it === '-') {
          lista.append(el('div', 'menu-separador'))
          continue
        }
        const fila = el('div', 'menu-item')
        const ok = it.activo ? it.activo() : true
        if (!ok) fila.classList.add('inactivo')
        fila.append(el('span', '', it.texto), el('span', 'menu-atajo', it.atajo ?? ''))
        fila.onclick = (e) => {
          e.stopPropagation()
          if (!ok) return
          cerrarTodo()
          it.accion()
        }
        lista.append(fila)
      }
      lista.style.left = t.offsetLeft + 'px'
      barra.append(lista)
      abierto = lista
    }
    t.onpointerdown = (e) => {
      e.stopPropagation()
      if (t.classList.contains('abierto')) cerrarTodo()
      else abrir()
    }
    t.onpointerenter = () => {
      if (abierto && !t.classList.contains('abierto')) abrir()
    }
    barra.append(t)
  }
  document.addEventListener('pointerdown', (e) => {
    if (abierto && !barra.contains(e.target as Node)) cerrarTodo()
  })
  return barra
}

export function fechaCorta(ms: number): string {
  const d = new Date(ms)
  const hoy = new Date()
  const hora = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === hoy.toDateString()) return 'hoy ' + hora
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) + ' ' + hora
}

export type ItemContextual =
  | { texto: string; atajo?: string; accion?: () => void; sub?: ItemContextual[]; marcado?: boolean; activo?: boolean; negrita?: boolean }
  | '-'

/** Menú del clic derecho, con submenús que se abren al pasar el mouse (como en Windows). */
export function menuContextual(x: number, y: number, items: ItemContextual[]) {
  document.querySelectorAll('.menu-contextual').forEach((m) => m.remove())
  const abiertos: HTMLElement[] = []
  const cerrar = () => {
    abiertos.forEach((m) => m.remove())
    document.removeEventListener('pointerdown', fuera, true)
    document.removeEventListener('keydown', tecla, true)
  }
  const fuera = (e: PointerEvent) => {
    if (!abiertos.some((m) => m.contains(e.target as Node))) cerrar()
  }
  const tecla = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      cerrar()
    }
  }

  function armar(lista: ItemContextual[], px: number, py: number, nivel: number, xIzq = 0): HTMLElement {
    const m = el('div', 'menu-contextual')
    let hijo: HTMLElement | null = null
    for (const it of lista) {
      if (it === '-') {
        m.append(el('div', 'menu-separador'))
        continue
      }
      const fila = el('div', 'menu-item' + (it.activo === false ? ' inactivo' : '') + (it.negrita ? ' negrita' : ''))
      fila.append(el('span', 'menu-marca', it.marcado ? '✓' : ''), el('span', 'menu-texto', it.texto), el('span', 'menu-atajo', it.sub ? '▸' : (it.atajo ?? '')))
      fila.onpointerenter = () => {
        // Al pasar por otra fila se cierra el submenú abierto; si esta tiene, se abre.
        if (hijo) {
          abiertos.splice(abiertos.indexOf(hijo)).forEach((h) => h.remove())
          hijo = null
        }
        if (it.sub && it.activo !== false) {
          const r = fila.getBoundingClientRect()
          hijo = armar(it.sub, r.right - 4, r.top - 4, nivel + 1, r.left + 4)
        }
      }
      fila.onclick = (e) => {
        e.stopPropagation()
        if (it.sub || it.activo === false) return
        cerrar()
        it.accion?.()
      }
      m.append(fila)
    }
    document.body.append(m)
    abiertos.push(m)
    // Que no se salga de la pantalla.
    const w = m.offsetWidth
    const h = m.offsetHeight
    // Un submenú que no entra a la derecha se abre a la izquierda.
    if (px + w > innerWidth) px = nivel ? xIzq - w : innerWidth - w - 4
    if (py + h > innerHeight) py = innerHeight - h - 4
    m.style.left = Math.max(0, px) + 'px'
    m.style.top = Math.max(0, py) + 'px'
    return m
  }
  armar(items, x, y, 0)
  setTimeout(() => {
    document.addEventListener('pointerdown', fuera, true)
    document.addEventListener('keydown', tecla, true)
  }, 0)
}
