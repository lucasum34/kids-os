// La ventana de Imprimir, igual para todos los programas (como la de Windows):
// vista previa, qué impresora, cuántas copias, color o blanco y negro, vertical u horizontal.
// La "impresora de práctica" saca las hojas en la pantalla; la de verdad usa la impresora de la casa.

import { avisoSistema } from './escritorio'
import { sonar } from './sonido'
import { el } from './ui'

export interface Pagina {
  tipo: 'html' | 'imagen'
  contenido: string
}

type Impresora = 'practica' | 'casa' | 'pdf'
const IMPRESORAS: { id: Impresora; nombre: string }[] = [
  { id: 'practica', nombre: '🖨️ Impresora de práctica' },
  { id: 'casa', nombre: '🖨️ La impresora de casa (de verdad)' },
  { id: 'pdf', nombre: '📄 Guardar como PDF' },
]

/** Lo que pasó con la última impresión (lo mira el guía de las misiones). */
export const impresion = {
  abierta: false,
  copias: 1,
  color: true,
  impresora: 'practica' as Impresora,
  ultima: null as null | { copias: number; color: boolean; impresora: Impresora; paginas: number },
}

const ANCHO_HOJA = 794 // A4 a 96 dpi
const ALTO_HOJA = 1123

export function imprimir(o: { titulo: string; paginas: Pagina[]; horizontal?: boolean }): Promise<boolean> {
  return new Promise((resolver) => {
    let pagina = 0
    let horizontal = !!o.horizontal
    impresion.abierta = true
    impresion.copias = 1
    impresion.color = true

    const fondo = el('div', 'dialogo-fondo')
    const caja = el('div', 'imp')
    const cab = el('div', 'dialogo-titulo', `Imprimir — ${o.titulo}`)
    const cuerpo = el('div', 'imp-cuerpo')
    const previa = el('div', 'imp-previa')
    const opciones = el('div', 'imp-opciones')
    cuerpo.append(previa, opciones)
    caja.append(cab, cuerpo)
    fondo.append(caja)
    document.body.append(fondo)

    function cerrar(ok: boolean) {
      impresion.abierta = false
      fondo.remove()
      document.removeEventListener('keydown', teclas, true)
      resolver(ok)
    }
    const teclas = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        cerrar(false)
      }
    }
    document.addEventListener('keydown', teclas, true)

    function hoja(p: Pagina, ancho: number): HTMLElement {
      const [w, h] = horizontal ? [ALTO_HOJA, ANCHO_HOJA] : [ANCHO_HOJA, ALTO_HOJA]
      const k = ancho / w
      const marco = el('div', 'imp-hoja')
      marco.style.width = w * k + 'px'
      marco.style.height = h * k + 'px'
      const adentro = el('div', 'imp-adentro')
      adentro.style.width = w + 'px'
      adentro.style.height = h + 'px'
      adentro.style.transform = `scale(${k})`
      if (!impresion.color) adentro.style.filter = 'grayscale(1)'
      if (p.tipo === 'html') {
        adentro.classList.add('html')
        adentro.innerHTML = p.contenido
      } else {
        const img = el('img')
        img.src = p.contenido
        adentro.append(img)
      }
      marco.append(adentro)
      return marco
    }

    function dibujar() {
      previa.replaceChildren(hoja(o.paginas[pagina], horizontal ? 420 : 300))
      if (o.paginas.length > 1) {
        const nav = el('div', 'imp-nav')
        const a = el('button', 'boton chico', '‹')
        a.disabled = pagina === 0
        a.onclick = () => {
          pagina--
          dibujar()
        }
        const b = el('button', 'boton chico', '›')
        b.disabled = pagina === o.paginas.length - 1
        b.onclick = () => {
          pagina++
          dibujar()
        }
        nav.append(a, el('span', '', `Página ${pagina + 1} de ${o.paginas.length}`), b)
        previa.append(nav)
      }

      opciones.replaceChildren()
      const fila = (t: string, ...h: HTMLElement[]) => {
        const f = el('div', 'imp-fila')
        f.append(el('div', 'imp-etiqueta', t), ...h)
        opciones.append(f)
      }
      const sel = el('select', 'imp-select')
      for (const i of IMPRESORAS) {
        const op = el('option', '', i.nombre)
        op.value = i.id
        sel.append(op)
      }
      sel.value = impresion.impresora
      sel.onchange = () => {
        impresion.impresora = sel.value as Impresora
        dibujar()
      }
      fila('Impresora', sel)
      if (impresion.impresora !== 'practica')
        opciones.append(el('div', 'imp-nota', impresion.impresora === 'casa' ? 'Se va a abrir la ventana de impresión de la compu. Pedile ayuda a papá o mamá.' : 'Se va a abrir la ventana de la compu: ahí elegí «Guardar como PDF».'))

      const menos = el('button', 'imp-mas', '−')
      const num = el('span', 'imp-num', String(impresion.copias))
      const mas = el('button', 'imp-mas', '+')
      menos.onclick = () => {
        impresion.copias = Math.max(1, impresion.copias - 1)
        dibujar()
      }
      mas.onclick = () => {
        impresion.copias = Math.min(10, impresion.copias + 1)
        dibujar()
      }
      const copias = el('div', 'imp-copias')
      copias.append(menos, num, mas)
      fila('Copias', copias)

      const elegir = (opcionesB: { t: string; activo: boolean; f: () => void }[]) => {
        const g = el('div', 'imp-opcionesb')
        for (const x of opcionesB) {
          const b = el('button', 'imp-op' + (x.activo ? ' activa' : ''), x.t)
          b.onclick = () => {
            x.f()
            dibujar()
          }
          g.append(b)
        }
        return g
      }
      fila('Color', elegir([{ t: '🌈 Color', activo: impresion.color, f: () => (impresion.color = true) }, { t: '⚫ Blanco y negro', activo: !impresion.color, f: () => (impresion.color = false) }]))
      fila('Hoja', elegir([{ t: '▯ Parada', activo: !horizontal, f: () => (horizontal = false) }, { t: '▭ Acostada', activo: horizontal, f: () => (horizontal = true) }]))
      const hojas = o.paginas.length * impresion.copias
      opciones.append(el('div', 'imp-total', `Van a salir ${hojas} ${hojas === 1 ? 'hoja' : 'hojas'}.`))
      const botones = el('div', 'imp-botones')
      const imp = el('button', 'boton principal', '🖨️ Imprimir')
      imp.onclick = () => mandar()
      const can = el('button', 'boton', 'Cancelar')
      can.onclick = () => cerrar(false)
      botones.append(can, imp)
      opciones.append(botones)
    }

    async function mandar() {
      impresion.ultima = { copias: impresion.copias, color: impresion.color, impresora: impresion.impresora, paginas: o.paginas.length }
      if (impresion.impresora === 'practica') {
        // Las hojas salen de la impresora, una por una.
        cuerpo.replaceChildren()
        const sala = el('div', 'imp-sala')
        const maquina = el('div', 'imp-maquina', '🖨️')
        const bandeja = el('div', 'imp-bandeja')
        sala.append(maquina, bandeja, el('div', 'imp-estado', 'Imprimiendo…'))
        cuerpo.append(sala)
        const total = o.paginas.length * impresion.copias
        for (let n = 0; n < total; n++) {
          const h = hoja(o.paginas[n % o.paginas.length], horizontal ? 150 : 110)
          h.classList.add('saliendo')
          h.style.zIndex = String(n)
          h.style.left = 20 + Math.min(n, 6) * 8 + 'px'
          bandeja.append(h)
          sonar('abrir')
          await new Promise((r) => setTimeout(r, 650))
        }
        sonar('bien')
        avisoSistema('🖨️', `Se ${total === 1 ? 'imprimió 1 hoja' : `imprimieron ${total} hojas`} (de práctica).`)
        await new Promise((r) => setTimeout(r, 700))
        return cerrar(true)
      }
      imprimirDeVerdad(o.paginas, impresion.color, horizontal, impresion.copias)
      cerrar(true)
    }

    dibujar()
  })
}

/** Manda las hojas a la impresora de la compu (o a "Guardar como PDF") con la ventana del sistema. */
function imprimirDeVerdad(paginas: Pagina[], color: boolean, horizontal: boolean, copias: number) {
  const marco = document.createElement('iframe')
  marco.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0'
  document.body.append(marco)
  const hojas = Array.from({ length: copias }, () => paginas)
    .flat()
    .map((p) => `<div class="hoja">${p.tipo === 'html' ? p.contenido : `<img src="${p.contenido}">`}</div>`)
    .join('')
  const doc = marco.contentDocument!
  doc.open()
  doc.write(
    `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4 ${horizontal ? 'landscape' : 'portrait'};margin:12mm}body{margin:0;font-family:Nunito,Arial,sans-serif;${color ? '' : 'filter:grayscale(1);'}}.hoja{page-break-after:always;break-after:page}.hoja:last-child{page-break-after:auto}.hoja img{max-width:100%;max-height:100%;display:block;margin:auto}</style></head><body>${hojas}</body></html>`,
  )
  doc.close()
  setTimeout(() => {
    marco.contentWindow?.focus()
    marco.contentWindow?.print()
    setTimeout(() => marco.remove(), 1000)
  }, 300)
}
