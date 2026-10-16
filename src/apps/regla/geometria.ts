// Regla: objetos del dibujo, cómo se dibujan, cómo se eligen y sus puntos de referencia.
// Coordenadas en centímetros, con Y para arriba (como en AutoCAD).

export type P = { x: number; y: number }

export interface Capa {
  nombre: string
  color: string
  grosor: number
}
export const CAPAS: Capa[] = [
  { nombre: 'Paredes', color: '#000000', grosor: 3 },
  { nombre: 'Puertas y ventanas', color: '#e65100', grosor: 2 },
  { nombre: 'Muebles', color: '#2e7d32', grosor: 1.5 },
  { nombre: 'Cotas', color: '#d32f2f', grosor: 1 },
  { nombre: 'Textos', color: '#1565c0', grosor: 1 },
]

export type Ent =
  | { id: string; capa: number; tipo: 'linea'; a: P; b: P }
  | { id: string; capa: number; tipo: 'rect'; a: P; b: P }
  | { id: string; capa: number; tipo: 'circulo'; c: P; r: number }
  | { id: string; capa: number; tipo: 'cota'; a: P; b: P; d: number }
  | { id: string; capa: number; tipo: 'texto'; p: P; t: string; h: number }

export const dist = (a: P, b: P) => Math.hypot(b.x - a.x, b.y - a.y)
export const medio = (a: P, b: P): P => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
const sumar = (a: P, dx: number, dy: number): P => ({ x: a.x + dx, y: a.y + dy })

export function moverEnt(e: Ent, dx: number, dy: number): Ent {
  switch (e.tipo) {
    case 'linea':
    case 'rect':
    case 'cota':
      return { ...e, a: sumar(e.a, dx, dy), b: sumar(e.b, dx, dy) }
    case 'circulo':
      return { ...e, c: sumar(e.c, dx, dy) }
    case 'texto':
      return { ...e, p: sumar(e.p, dx, dy) }
  }
}

function esquinas(a: P, b: P): P[] {
  return [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }]
}

/** Puntos de la cota: las dos puntas de la línea de cota corridas d en la normal. */
export function lineaCota(e: { a: P; b: P; d: number }): [P, P] {
  const l = dist(e.a, e.b) || 1
  const nx = -(e.b.y - e.a.y) / l
  const ny = (e.b.x - e.a.x) / l
  return [sumar(e.a, nx * e.d, ny * e.d), sumar(e.b, nx * e.d, ny * e.d)]
}

/** Para las referencias a objetos: puntas, medios y centros. */
export function puntosNotables(e: Ent): { p: P; tipo: 'punta' | 'medio' | 'centro' }[] {
  switch (e.tipo) {
    case 'linea':
      return [
        { p: e.a, tipo: 'punta' },
        { p: e.b, tipo: 'punta' },
        { p: medio(e.a, e.b), tipo: 'medio' },
      ]
    case 'rect': {
      const q = esquinas(e.a, e.b)
      return [
        ...q.map((p) => ({ p, tipo: 'punta' as const })),
        ...q.map((p, i) => ({ p: medio(p, q[(i + 1) % 4]), tipo: 'medio' as const })),
        { p: medio(e.a, e.b), tipo: 'centro' },
      ]
    }
    case 'circulo':
      return [
        { p: e.c, tipo: 'centro' },
        ...[0, 1, 2, 3].map((k) => ({ p: sumar(e.c, Math.cos((k * Math.PI) / 2) * e.r, Math.sin((k * Math.PI) / 2) * e.r), tipo: 'punta' as const })),
      ]
    case 'cota':
      return []
    case 'texto':
      return [{ p: e.p, tipo: 'punta' }]
  }
}

function distSegmento(p: P, a: P, b: P): number {
  const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2
  if (!l2) return dist(p, a)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2))
  return dist(p, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) })
}

/** Qué tan cerca está un punto del objeto (en cm). */
export function distancia(e: Ent, p: P): number {
  switch (e.tipo) {
    case 'linea':
      return distSegmento(p, e.a, e.b)
    case 'rect': {
      const q = esquinas(e.a, e.b)
      return Math.min(...q.map((x, i) => distSegmento(p, x, q[(i + 1) % 4])))
    }
    case 'circulo':
      return Math.abs(dist(p, e.c) - e.r)
    case 'cota': {
      const [a, b] = lineaCota(e)
      return distSegmento(p, a, b)
    }
    case 'texto': {
      const ancho = e.t.length * e.h * 0.6
      const dentro = p.x >= e.p.x && p.x <= e.p.x + ancho && p.y >= e.p.y && p.y <= e.p.y + e.h
      return dentro ? 0 : Math.min(distSegmento(p, e.p, sumar(e.p, ancho, 0)), distSegmento(p, sumar(e.p, 0, e.h), sumar(e.p, ancho, e.h)))
    }
  }
}

export function caja(e: Ent): { x0: number; y0: number; x1: number; y1: number } {
  const pts: P[] =
    e.tipo === 'circulo'
      ? [sumar(e.c, -e.r, -e.r), sumar(e.c, e.r, e.r)]
      : e.tipo === 'texto'
        ? [e.p, sumar(e.p, e.t.length * e.h * 0.6, e.h)]
        : e.tipo === 'cota'
          ? [e.a, e.b, ...lineaCota(e)]
          : [e.a, e.b]
  return {
    x0: Math.min(...pts.map((p) => p.x)),
    y0: Math.min(...pts.map((p) => p.y)),
    x1: Math.max(...pts.map((p) => p.x)),
    y1: Math.max(...pts.map((p) => p.y)),
  }
}

export interface Vista {
  cx: number // centro de la pantalla, en cm
  cy: number
  k: number // píxeles por cm
  w: number // tamaño de la pantalla en píxeles
  h: number
}
export const aPantalla = (v: Vista, p: P): [number, number] => [(p.x - v.cx) * v.k + v.w / 2, v.h / 2 - (p.y - v.cy) * v.k]
export const aMundo = (v: Vista, x: number, y: number): P => ({ x: (x - v.w / 2) / v.k + v.cx, y: (v.h / 2 - y) / v.k + v.cy })

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const f = (n: number) => n.toFixed(1)

/** Una medida guardada en cm, mostrada en metros con dos decimales (como en los planos: 3,50). */
export function medidaTexto(cm: number): string {
  return (cm / 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Un objeto como SVG, en coordenadas de pantalla. */
export function svgEnt(v: Vista, e: Ent, estilo: { color?: string; elegido?: boolean; previa?: boolean } = {}): string {
  const capa = CAPAS[e.capa] ?? CAPAS[0]
  const color = estilo.color ?? capa.color
  const extra = estilo.elegido ? ' stroke-dasharray="7 4"' : estilo.previa ? ' opacity="0.8"' : ''
  const trazo = `stroke="${color}" stroke-width="${capa.grosor}" fill="none"${extra}`
  switch (e.tipo) {
    case 'linea': {
      const [x1, y1] = aPantalla(v, e.a)
      const [x2, y2] = aPantalla(v, e.b)
      return `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" ${trazo} stroke-linecap="round"/>`
    }
    case 'rect': {
      const [x1, y1] = aPantalla(v, e.a)
      const [x2, y2] = aPantalla(v, e.b)
      return `<rect x="${f(Math.min(x1, x2))}" y="${f(Math.min(y1, y2))}" width="${f(Math.abs(x2 - x1))}" height="${f(Math.abs(y2 - y1))}" ${trazo}/>`
    }
    case 'circulo': {
      const [x, y] = aPantalla(v, e.c)
      return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(e.r * v.k)}" ${trazo}/>`
    }
    case 'texto': {
      const [x, y] = aPantalla(v, e.p)
      return `<text x="${f(x)}" y="${f(y)}" font-size="${f(Math.max(4, e.h * v.k))}" fill="${color}" font-family="Arial, sans-serif"${estilo.elegido ? ' text-decoration="underline"' : ''}>${esc(e.t)}</text>`
    }
    case 'cota': {
      const [c1, c2] = lineaCota(e)
      const [ax, ay] = aPantalla(v, e.a)
      const [bx, by] = aPantalla(v, e.b)
      const [x1, y1] = aPantalla(v, c1)
      const [x2, y2] = aPantalla(v, c2)
      const ang = Math.atan2(y2 - y1, x2 - x1)
      // Líneas de extensión, línea de cota con marcas a 45° (como en los planos) y la medida.
      const marca = (x: number, y: number) => {
        const a = ang + Math.PI / 4
        return `<line x1="${f(x - Math.cos(a) * 5)}" y1="${f(y - Math.sin(a) * 5)}" x2="${f(x + Math.cos(a) * 5)}" y2="${f(y + Math.sin(a) * 5)}" stroke="${color}" stroke-width="2"/>`
      }
      let gr = (ang * 180) / Math.PI
      if (gr > 90 || gr < -90) gr += 180 // que el número no quede patas para arriba
      const tam = Math.max(10, Math.min(18, 10 * v.k))
      const [mx, my] = [(x1 + x2) / 2, (y1 + y2) / 2]
      return (
        `<g${extra}>` +
        `<line x1="${f(ax)}" y1="${f(ay)}" x2="${f(x1)}" y2="${f(y1)}" stroke="${color}" stroke-width="0.8"/>` +
        `<line x1="${f(bx)}" y1="${f(by)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${color}" stroke-width="0.8"/>` +
        `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${color}" stroke-width="1"/>` +
        marca(x1, y1) +
        marca(x2, y2) +
        `<text x="${f(mx)}" y="${f(my)}" dy="-5" font-size="${f(tam)}" fill="${color}" text-anchor="middle" font-family="Arial, sans-serif" transform="rotate(${f(gr)} ${f(mx)} ${f(my)})">${medidaTexto(dist(e.a, e.b))}</text>` +
        `</g>`
      )
    }
  }
}

/** Paso de la rejilla según el zoom: que las líneas no queden ni muy juntas ni muy separadas. */
export function pasoRejilla(k: number): number {
  for (const p of [1, 5, 10, 50, 100, 500, 1000]) if (p * k >= 14) return p
  return 5000
}

export function svgRejilla(v: Vista): string {
  const paso = pasoRejilla(v.k)
  const mayor = paso * (paso === 5 || paso === 50 || paso === 500 ? 2 : 10)
  const a = aMundo(v, 0, v.h)
  const b = aMundo(v, v.w, 0)
  let s = ''
  for (let x = Math.ceil(a.x / paso) * paso; x <= b.x; x += paso) {
    const [sx] = aPantalla(v, { x, y: 0 })
    const fuerte = Math.abs(x % mayor) < 1e-6
    s += `<line x1="${f(sx)}" y1="0" x2="${f(sx)}" y2="${v.h}" stroke="${x === 0 ? '#90a4ae' : fuerte ? '#d5dce2' : '#eef1f4'}" stroke-width="1"/>`
  }
  for (let y = Math.ceil(a.y / paso) * paso; y <= b.y; y += paso) {
    const [, sy] = aPantalla(v, { x: 0, y })
    const fuerte = Math.abs(y % mayor) < 1e-6
    s += `<line x1="0" y1="${f(sy)}" x2="${v.w}" y2="${f(sy)}" stroke="${y === 0 ? '#90a4ae' : fuerte ? '#d5dce2' : '#eef1f4'}" stroke-width="1"/>`
  }
  return s
}

/** Vista que muestra todo el dibujo con un margen. */
export function vistaTodo(ents: Ent[], w: number, h: number): Vista {
  if (!ents.length) return { cx: 250, cy: 150, k: Math.min(w / 600, h / 400), w, h }
  const cs = ents.map(caja)
  const x0 = Math.min(...cs.map((c) => c.x0))
  const y0 = Math.min(...cs.map((c) => c.y0))
  const x1 = Math.max(...cs.map((c) => c.x1))
  const y1 = Math.max(...cs.map((c) => c.y1))
  const k = Math.min(w / Math.max(20, (x1 - x0) * 1.2), h / Math.max(20, (y1 - y0) * 1.2))
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, k, w, h }
}

/** El dibujo entero como SVG (para la miniatura de Mis cosas). */
export function svgDibujo(ents: Ent[], w: number, h: number): string {
  const v = vistaTodo(ents, w, h)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#ffffff"/>${ents.map((e) => svgEnt(v, e)).join('')}</svg>`
}
