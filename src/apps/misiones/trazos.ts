// Misiones de Trazos (el Corel): todo es una figura que se elige, se mueve y se cambia.

import type { Mision } from '../../os/guia'

interface ApiTrazos {
  hizo(a: string): boolean
  cuantas(tipo?: string): number
  rellenos(): number
  elegidas(): number
  cargar(): void
  guardarComo(n: string): string
}
type M = Mision<ApiTrazos>

const herr = (nombre: string) => `.herr[title^="${nombre}"]`
const menu = (titulo: string) => (v: { raiz: HTMLElement }) => [...v.raiz.querySelectorAll('.menu-titulo')].find((x) => x.textContent === titulo) ?? null

export const MISIONES_TRAZOS: M[] = [
  {
    id: 'tz-robot',
    programa: 'trazos',
    titulo: 'El robot',
    icono: '🤖',
    figurita: '🦾',
    resumen: 'Armar un robot con figuras y pintarlo.',
    guardarComo: 'Mi robot',
    preparar: (a) => a.cargar(),
    pasos: [
      { texto: 'Vamos a armar un robot. Elegí el rectángulo y dibujá el cuerpo: apretá y arrastrá en la hoja.', senalar: herr('Rectángulo'), listo: (a) => a.cuantas('rect') >= 1, pista: 'El rectángulo es el segundo botón de la izquierda. Después apretá en la hoja y arrastrá en diagonal.' },
      { texto: 'Ahora la cabeza: otro rectángulo, arriba del cuerpo.', listo: (a) => a.cuantas('rect') >= 2 },
      { texto: 'Los ojos: elegí el círculo y dibujá un ojo en la cabeza.', senalar: herr('Círculo'), listo: (a) => a.cuantas('elipse') >= 1 },
      {
        texto: 'Para el otro ojo no hace falta dibujar: con el ojo elegido apretá Ctrl+D, que lo duplica. Después arrastrá la copia al lado.',
        listo: (a) => a.hizo('pegar') && a.hizo('mover'),
        pista: 'Mantené Ctrl y apretá la D. Aparece otro ojo: agarralo con el mouse y llevalo a su lugar.',
      },
      { texto: 'A pintar: hacé clic en una parte del robot para elegirla y después clic en un color de abajo. El clic cambia el relleno.', senalar: '.paleta', listo: (a) => a.hizo('relleno-a-figura'), pista: 'Primero elegí la flecha (la de arriba de todo) y clic en una figura. Después un color.' },
      { texto: 'Con clic DERECHO en un color se cambia el contorno, el borde. Probalo con una figura elegida.', senalar: '.paleta', listo: (a) => a.hizo('borde-a-figura'), pista: 'El botón derecho del mouse es el del costado.' },
      { texto: '¡Qué robot! Agregale lo que quieras: antenas, brazos, una boca.', boton: '¡Terminé!' },
    ],
  },
  {
    id: 'tz-mover',
    programa: 'trazos',
    titulo: 'Mover, agrandar y borrar',
    icono: '📐',
    figurita: '🧩',
    resumen: 'Las figuras se pueden cambiar todo lo que quieras.',
    preparar: (a) => a.cargar(),
    pasos: [
      { texto: 'Dibujá un círculo.', senalar: herr('Círculo'), listo: (a) => a.cuantas('elipse') >= 1 },
      { texto: 'Elegí la flecha de arriba y hacé clic en el círculo. Aparecen unos cuadraditos alrededor.', senalar: herr('Elegir'), listo: (a) => a.elegidas() >= 1 },
      { texto: 'Arrastralo a otro lugar de la hoja.', listo: (a) => a.hizo('mover'), pista: 'Apretá en el medio del círculo y, sin soltar, movelo.' },
      { texto: 'Ahora agarrá un cuadradito de la esquina y tirá para agrandarlo.', listo: (a) => a.hizo('agrandar'), pista: 'Los cuadraditos blancos están en las esquinas del círculo elegido.' },
      { texto: 'Dibujá un rectángulo que tape una parte del círculo.', senalar: herr('Rectángulo'), listo: (a) => a.cuantas('rect') >= 1 },
      { texto: 'Elegí el círculo y, en el menú Ordenar, apretá «Traer al frente». ¡Queda adelante!', senalar: menu('Ordenar'), listo: (a) => a.hizo('ordenar'), pista: 'Con la flecha, clic en el pedacito de círculo que se ve. Después el menú Ordenar, arriba.' },
      { texto: 'Por último: elegí una figura y apretá la tecla Supr para borrarla.', listo: (a) => a.hizo('borrar'), pista: 'Supr está arriba a la derecha del teclado, cerca de Inicio y Fin.' },
    ],
  },
  {
    id: 'tz-paisaje',
    programa: 'trazos',
    titulo: 'Un paisaje',
    icono: '⛰️',
    figurita: '🌄',
    resumen: 'Líneas, lápiz y texto.',
    guardarComo: 'Mi paisaje',
    preparar: (a) => a.cargar(),
    pasos: [
      { texto: 'Con la línea dibujá montañas: hacé varias líneas en zigzag.', senalar: herr('Línea'), listo: (a) => a.cuantas('linea') >= 3, pista: 'Cada línea es apretar, arrastrar y soltar. Hacé tres o cuatro.' },
      { texto: 'Con el lápiz dibujá nubes, a mano.', senalar: herr('Lápiz'), listo: (a) => a.cuantas('trazo') >= 1 },
      { texto: 'Un sol amarillo: elegí amarillo en la paleta y dibujá un círculo. Con Mayús apretada sale redondito.', senalar: herr('Círculo'), listo: (a) => a.cuantas('elipse') >= 1 },
      { texto: 'Firmá tu obra: elegí la A, hacé clic abajo y escribí tu nombre. Enter para terminar.', senalar: herr('Texto'), listo: (a) => a.cuantas('texto') >= 1 },
      { texto: '¡Un paisaje de verdad! Y cada cosa se puede seguir moviendo y cambiando.', boton: '¡Lindo!' },
    ],
  },
]
