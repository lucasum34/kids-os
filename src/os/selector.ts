// Cuadro "Abrir": muestra los archivos de un programa como en Mis cosas.

import { visibles } from './archivos'
import { dialogo, el, fechaCorta } from './ui'

export function miniatura(svgOData: string): HTMLElement {
  const caja = el('div', 'mini')
  if (svgOData.startsWith('<svg')) caja.innerHTML = svgOData
  else if (svgOData) {
    const img = el('img')
    img.src = svgOData
    caja.append(img)
  }
  return caja
}

/** `app` puede ser uno o varios programas (ej. fotos y dibujos). */
export async function elegirArchivo(app: string | string[], titulo = 'Abrir'): Promise<string | null> {
  const apps = Array.isArray(app) ? app : [app]
  // Todo lo que se puede abrir ahora, esté en la carpeta que esté (y en el pendrive si está enchufado).
  const archivos = visibles()
    .filter((a) => apps.includes(a.app))
    .sort((a, b) => b.modificado - a.modificado)
  if (!archivos.length) {
    await dialogo({
      titulo,
      icono: '📂',
      mensaje: 'Todavía no hay nada guardado.',
      botones: [{ texto: 'Aceptar', valor: 'ok', principal: true }],
    })
    return null
  }
  let elegido: string | null = null
  const grilla = el('div', 'grilla-archivos selector')
  let resolverDoble: (() => void) | null = null
  for (const a of archivos) {
    const it = el('div', 'archivo')
    it.append(miniatura(a.miniatura), el('div', 'archivo-nombre', a.nombre), el('div', 'archivo-fecha', fechaCorta(a.modificado)))
    it.onclick = () => {
      grilla.querySelectorAll('.archivo').forEach((x) => x.classList.remove('elegido'))
      it.classList.add('elegido')
      elegido = a.id
    }
    it.ondblclick = () => {
      elegido = a.id
      resolverDoble?.()
    }
    grilla.append(it)
  }
  const promesa = dialogo({
    titulo,
    contenido: grilla,
    botones: [
      { texto: 'Abrir', valor: 'abrir', principal: true },
      { texto: 'Cancelar', valor: 'cancelar' },
    ],
  })
  // Doble clic = elegir y apretar Abrir.
  resolverDoble = () => (document.querySelector('.dialogo .boton.principal') as HTMLElement)?.click()
  const r = await promesa
  return r.boton === 'abrir' ? elegido : null
}
