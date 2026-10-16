// Misiones de Construir (el SketchUp): de un rectángulo en el piso a una casa.

import type { Mision } from '../../os/guia'

type Obj =
  | { tipo: 'caja'; w: number; h: number; d: number; mats: string[] }
  | { tipo: 'cilindro'; r: number; h: number; mats: string[] }
  | { tipo: 'persona' }
interface ApiConstruir {
  hizo(a: string): boolean
  objs(): Obj[]
  cargar(): void
  guardarComo(n: string): string
}
type M = Mision<ApiConstruir>

const herr = (id: string) => `.cs-herr[data-h="${id}"]`
const cajas = (a: ApiConstruir) => a.objs().filter((o): o is Extract<Obj, { tipo: 'caja' }> => o.tipo === 'caja')
const cerca = (x: number, y: number, tol = 1.5) => Math.abs(x - y) <= tol

export const MISIONES_CONSTRUIR: M[] = [
  {
    id: 'cs-caja',
    programa: 'construir',
    titulo: 'Mi primera caja',
    icono: '📦',
    figurita: '🧊',
    resumen: 'Del piso para arriba: dibujar y levantar.',
    preparar: (a) => a.cargar(),
    pasos: [
      { texto: 'Esa nena mide 1,20 metros, como vos. Elegí el Rectángulo y hacé clic en el piso. Mové el mouse y hacé otro clic.', senalar: herr('rect'), listo: (a) => cajas(a).length >= 1, pista: 'Un clic donde empieza, mové el mouse sin apretar, y otro clic donde termina.' },
      { texto: '¡Un rectángulo en el piso! Ahora elegí Empujar/Tirar, hacé clic arriba del rectángulo, subí el mouse y hacé clic otra vez.', senalar: herr('empujar'), listo: (a) => cajas(a).some((c) => c.h > 5), pista: 'Cuando pasás el mouse por arriba del rectángulo se pinta de azul: ahí hacé clic.' },
      { texto: 'Ahora escribí 120 y apretá Enter: la caja va a medir 1,20 metros de alto, igual que vos. Comparala con la nena.', senalar: '.cs-vcb', listo: (a) => cajas(a).some((c) => cerca(c.h, 120)), pista: 'Los números van solos al cuadrito de Medidas, abajo a la derecha. Escribí 120 y Enter.' },
      { texto: 'Para mirarla de todos lados: elegí Orbitar y arrastrá con el mouse.', senalar: herr('orbitar'), listo: (a) => a.hizo('orbitar') },
      { texto: 'Si te perdés, apretá «Ver todo» y la cámara vuelve.', senalar: '.cs-herr[title^="Ver todo"]', listo: (a) => a.hizo('vertodo') },
      { texto: '¡Construiste algo de tu tamaño! Así se hace todo en 3D: dibujar en el piso y levantar.', boton: '¡Genial!' },
    ],
  },
  {
    id: 'cs-casa',
    programa: 'construir',
    titulo: 'Una casita',
    icono: '🏠',
    figurita: '🏘️',
    resumen: 'Una casa con medidas, de ladrillo, y un árbol.',
    guardarComo: 'Mi casita',
    preparar: (a) => a.cargar(),
    pasos: [
      { texto: 'Esta vez con medidas: elegí el Rectángulo, hacé clic en el piso y escribí 400;300 y Enter. Son 4 metros por 3.', senalar: herr('rect'), listo: (a) => cajas(a).some((c) => (cerca(c.w, 400) && cerca(c.d, 300)) || (cerca(c.w, 300) && cerca(c.d, 400))), pista: 'Después del primer clic, escribí 400, el punto y coma (;), 300 y Enter.' },
      { texto: 'Levantá las paredes: Empujar/Tirar, clic arriba del rectángulo, y escribí 250 y Enter.', senalar: herr('empujar'), listo: (a) => cajas(a).some((c) => cerca(c.h, 250)) },
      { texto: 'A pintar: en Materiales elegí Ladrillo y, con la tecla Ctrl apretada, hacé clic en la casa. ¡Se pinta toda!', senalar: '.cs-materiales', listo: (a) => a.hizo('pintar:t:ladrillo'), pista: 'Ctrl está abajo a la izquierda. Mantenela apretada mientras hacés clic en una pared.' },
      { texto: 'Un árbol: con el Círculo dibujá uno en el piso, al lado de la casa, y levantalo con Empujar/Tirar.', senalar: herr('circulo'), listo: (a) => a.objs().some((o) => o.tipo === 'cilindro' && o.h > 20) },
      { texto: 'Pintá el árbol de verde o de pasto.', senalar: '.cs-materiales', listo: (a) => a.hizo('pintar:c:#43a047') || a.hizo('pintar:t:pasto') },
      { texto: '¡Qué linda casita! Si querés, hacé una puerta y ventanas con rectángulos sobre las paredes.', boton: '¡Lista!' },
    ],
  },
]
