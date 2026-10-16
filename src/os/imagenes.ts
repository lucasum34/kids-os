// Imágenes de Mis cosas para usar dentro de otros programas (Película, Diapositivas, Animar).

import * as fs from './archivos'

export const PROGRAMAS_CON_IMAGEN = ['foto', 'pincel', 'trazos']

export function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, no) => {
    const i = new Image()
    i.onload = () => ok(i)
    i.onerror = no
    i.src = src
  })
}

/** Una imagen de Mis cosas (foto con capas, pintura de Pincel o dibujo de Trazos) como data URL. */
export async function imagenDeMisCosas(id: string): Promise<string | null> {
  const a = fs.buscar(id)
  if (!a) return null
  if (a.app === 'trazos') return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(a.miniatura)
  if (a.app === 'pincel') return (fs.leer(id) as { imagen?: string } | null)?.imagen ?? null
  if (a.app === 'foto') {
    const d = fs.leer(id) as { w: number; h: number; capas: { visible: boolean; opacidad: number; imagen: string }[] } | null
    if (!d) return null
    const c = document.createElement('canvas')
    c.width = d.w
    c.height = d.h
    const g = c.getContext('2d')!
    g.fillStyle = '#fff'
    g.fillRect(0, 0, d.w, d.h)
    for (const capa of d.capas) {
      if (!capa.visible) continue
      const img = await cargarImagen(capa.imagen)
      g.globalAlpha = capa.opacidad
      g.drawImage(img, 0, 0)
    }
    return c.toDataURL('image/jpeg', 0.9)
  }
  return a.miniatura || null
}
