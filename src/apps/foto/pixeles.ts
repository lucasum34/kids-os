// Operaciones de píxeles de Foto.

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export function hexARgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
export function rgbAHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')
}

/** Balde de pintura: rellena la zona del mismo color (con tolerancia), dentro de la selección si hay. */
export function rellenar(img: ImageData, x0: number, y0: number, color: string, tolerancia: number, sel: Rect | null) {
  const { width: w, height: h, data } = img
  if (x0 < 0 || y0 < 0 || x0 >= w || y0 >= h) return
  const lim = sel
    ? { x0: Math.max(0, sel.x), y0: Math.max(0, sel.y), x1: Math.min(w, sel.x + sel.w), y1: Math.min(h, sel.y + sel.h) }
    : { x0: 0, y0: 0, x1: w, y1: h }
  if (x0 < lim.x0 || x0 >= lim.x1 || y0 < lim.y0 || y0 >= lim.y1) return
  const i0 = (y0 * w + x0) * 4
  const base = [data[i0], data[i0 + 1], data[i0 + 2], data[i0 + 3]]
  const [r, g, b] = hexARgb(color)
  const tol = tolerancia * 4
  const parecido = (i: number) =>
    Math.abs(data[i] - base[0]) + Math.abs(data[i + 1] - base[1]) + Math.abs(data[i + 2] - base[2]) + Math.abs(data[i + 3] - base[3]) <= tol
  const visto = new Uint8Array(w * h)
  const pila = [x0, y0]
  while (pila.length) {
    const y = pila.pop()!
    let x = pila.pop()!
    // Barrido por renglones: va a la izquierda y después pinta hacia la derecha.
    while (x > lim.x0 && !visto[y * w + x - 1] && parecido((y * w + x - 1) * 4)) x--
    let arriba = false
    let abajo = false
    for (; x < lim.x1; x++) {
      const p = y * w + x
      if (visto[p] || !parecido(p * 4)) break
      visto[p] = 1
      const i = p * 4
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = 255
      if (y > lim.y0) {
        const q = p - w
        const ok = !visto[q] && parecido(q * 4)
        if (ok && !arriba) pila.push(x, y - 1)
        arriba = ok
      }
      if (y < lim.y1 - 1) {
        const q = p + w
        const ok = !visto[q] && parecido(q * 4)
        if (ok && !abajo) pila.push(x, y + 1)
        abajo = ok
      }
    }
  }
}
