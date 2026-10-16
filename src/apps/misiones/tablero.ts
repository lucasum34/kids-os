// Misiones del Tablero (el Excel): de a poco, con cosas que le importan a una nena de 7.

import type { Mision } from '../../os/guia'
import { el } from '../../os/ui'
import type { Celda, Hoja } from '../tablero'
import { leerRef, type Valor } from '../tablero/formulas'

interface ApiTablero {
  celda(ref: string): { v: string; valor: Valor | undefined; fondo?: string; moneda: boolean; b: boolean }
  activa(): string
  seleccion(): string
  editando(): boolean
  grafico(): string | null
  cargar(h: Hoja): void
  poner(ref: string, c: Partial<Celda>): void
  guardarComo(n: string): string
}
type M = Mision<ApiTablero>

/** Selector de una casilla, para señalarla. */
const casilla = (ref: string) => {
  const [c, r] = leerRef(ref)!
  return `td[data-c="${c}"][data-r="${r}"]`
}
const lleno = (a: ApiTablero, ...refs: string[]) => !a.editando() && refs.every((r) => a.celda(r).v.trim() !== '')
const numero = (a: ApiTablero, ...refs: string[]) => !a.editando() && refs.every((r) => typeof a.celda(r).valor === 'number')
const vale = (a: ApiTablero, ref: string, n: number) => !a.editando() && a.celda(ref).valor === n

function hoja(celdas: Record<string, string | Partial<Celda>>, anchos: Record<number, number> = {}, grafico: string | null = null): Hoja {
  const h: Hoja = { celdas: {}, anchos, grafico }
  for (const [k, c] of Object.entries(celdas)) h.celdas[k] = typeof c === 'string' ? { v: c } : { v: '', ...c }
  return h
}
const titulo = (v: string): Partial<Celda> => ({ v, b: true, fondo: '#b3e5fc' })

const COLS = 'ABCDEFGHIJKL'
const CORAZON = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...']
// El corazón empieza en la B2.
const celdasCorazon = CORAZON.flatMap((fila, r) => [...fila].map((x, c) => (x === 'X' ? `${COLS[c + 1]}${r + 2}` : ''))).filter(Boolean)

function modeloCorazon(): HTMLElement {
  const m = el('div', 'guia-modelo')
  for (const fila of CORAZON) for (const x of fila) m.append(el('span', x === 'X' ? 'si' : ''))
  m.style.gridTemplateColumns = `repeat(${CORAZON[0].length}, 14px)`
  return m
}
function codigo(t: string): () => HTMLElement {
  return () => el('div', 'guia-codigo', t)
}

export const MISIONES_TABLERO: M[] = [
  {
    id: 'tb-batalla',
    programa: 'tablero',
    titulo: 'Batalla naval',
    icono: '🚢',
    figurita: '🐙',
    resumen: 'Cada casilla tiene un nombre, como en la batalla naval.',
    preparar: (a) => {
      const c: Record<string, Partial<Celda>> = {}
      for (let r = 1; r <= 6; r++) for (const col of 'ABCDEF') c[col + r] = { fondo: '#b3e5fc' }
      a.cargar(hoja(c, { 0: 60, 1: 60, 2: 60, 3: 60, 4: 60, 5: 60 }))
    },
    pasos: [
      { texto: 'Esto es como la batalla naval. Arriba de todo hay letras: cada una es una columna. Mirá, esta es la columna B.', senalar: 'thead th:nth-child(3)', boton: 'Sigo' },
      { texto: 'Y al costado hay números: cada uno es una fila. Esta es la fila 3.', senalar: 'tbody tr:nth-child(3) th', boton: 'Sigo' },
      { texto: 'Hacé clic en la casilla B3: la columna B y la fila 3.', senalar: casilla('B3'), listo: (a) => a.activa() === 'B3', pista: 'Bajá por la columna B hasta llegar a la fila 3 y hacé clic.' },
      { texto: '¡Muy bien! ¡Disparo! Ahora en la D5.', listo: (a) => a.activa() === 'D5', pista: 'Buscá la letra D arriba y el número 5 al costado. Donde se cruzan, ahí es.', alTerminar: (a) => a.poner('D5', { v: '💧' }) },
      { texto: 'Agua... Hay un barco escondido en la C2. ¡Hundilo!', listo: (a) => a.activa() === 'C2', pista: 'La C es la tercera letra. La fila 2 es la segunda de arriba.', alTerminar: (a) => a.poner('C2', { v: '💥', fondo: '#ffcc80' }) },
      { texto: '¡Tocado y hundido! El último barco está en la E1. ¡Fuego!', listo: (a) => a.activa() === 'E1', pista: 'La fila 1 es la de más arriba.', alTerminar: (a) => a.poner('E1', { v: '💥', fondo: '#ffcc80' }) },
      { texto: '¡Ganaste! Y un secreto: en este cuadrito de arriba siempre dice en qué casilla estás.', senalar: '.tb-nombre', boton: '¡Entendido!' },
    ],
  },
  {
    id: 'tb-frutas',
    programa: 'tablero',
    titulo: 'Mi lista de frutas',
    icono: '🍎',
    figurita: '🍓',
    resumen: 'Escribir en las casillas y moverse con Enter.',
    guardarComo: 'Mis frutas',
    preparar: (a) => a.cargar(hoja({}, { 0: 140, 1: 110 })),
    pasos: [
      { texto: 'Vamos a hacer una lista. Hacé clic en la A1, escribí la palabra Frutas y apretá Enter.', senalar: casilla('A1'), listo: (a) => lleno(a, 'A1'), pista: 'Enter es la tecla grande con una flechita doblada, a la derecha de las letras.' },
      { texto: '¿Viste? Enter te bajó solo a la A2. Escribí una fruta que te guste y Enter.', senalar: casilla('A2'), listo: (a) => lleno(a, 'A2'), pista: 'Escribí, por ejemplo, Banana, y apretá Enter.' },
      { texto: 'Escribí dos frutas más, una abajo de la otra.', listo: (a) => lleno(a, 'A3', 'A4'), pista: 'Después de cada fruta, Enter.' },
      { texto: 'Ahora hacé clic en la B1 y escribí Cuántas.', senalar: casilla('B1'), listo: (a) => lleno(a, 'B1') },
      { texto: 'En la B2, la B3 y la B4 escribí cuántas comerías de cada fruta. Solo números.', senalar: casilla('B2'), listo: (a) => numero(a, 'B2', 'B3', 'B4'), pista: 'Clic en la B2, escribí un número, Enter, y así.' },
      { texto: 'Para que el título se note: hacé clic en la A1 y apretá la N, que es Negrita.', senalar: '.cd-boton[title^="Negrita"]', listo: (a) => a.celda('A1').b, pista: 'Primero clic en la casilla que dice Frutas, después en la N de arriba.' },
    ],
  },
  {
    id: 'tb-kiosco',
    programa: 'tablero',
    titulo: 'El kiosco',
    icono: '🍭',
    figurita: '🍫',
    resumen: 'La compu hace las cuentas, y se arreglan solas.',
    guardarComo: 'El kiosco',
    preparar: (a) =>
      a.cargar(
        hoja(
          {
            A1: titulo('Golosina'), B1: titulo('Precio'),
            A2: 'Chupetín', B2: { v: '100', moneda: true },
            A3: 'Alfajor', B3: { v: '500', moneda: true },
            A4: 'Chicle', B4: { v: '50', moneda: true },
            A6: { v: 'Total', b: true }, B6: { moneda: true, fondo: '#fff59d' },
          },
          { 0: 140, 1: 110 },
        ),
      ),
    pasos: [
      { texto: 'Querés comprar las tres golosinas. ¿Cuánto es? La compu lo puede sumar. Hacé clic en la B6, la amarilla.', senalar: casilla('B6'), listo: (a) => a.activa() === 'B6' },
      {
        texto: 'Escribí esto tal cual y apretá Enter. El signo igual le dice a la compu: ¡hacé una cuenta!',
        extra: codigo('=B2+B3+B4'),
        senalar: casilla('B6'),
        listo: (a) => vale(a, 'B6', 650),
        pista: 'El igual está arriba del 0 (con la tecla Mayúscula). Después B2, el signo más, B3, más, B4, y Enter.',
      },
      { texto: '¡650 pesos! Ahora pasó algo: el alfajor aumentó. Cambiá el precio de la B3: escribí 600 y Enter.', senalar: casilla('B3'), listo: (a) => vale(a, 'B3', 600), pista: 'Clic en la casilla del alfajor (500), escribí 600 y Enter.' },
      { texto: '¡Mirá el total! Cambió solo a 750. Eso hace el Excel: las cuentas se arreglan solas.', senalar: casilla('B6'), boton: '¡Qué bueno!' },
    ],
  },
  {
    id: 'tb-sigma',
    programa: 'tablero',
    titulo: 'La varita Σ',
    icono: '🪄',
    figurita: '⭐',
    resumen: 'Sumar un montón de números de un saque.',
    preparar: (a) =>
      a.cargar(hoja({ A1: titulo('Puntos del juego'), A2: '12', A3: '8', A4: '15', A5: '10', A6: '7', A7: '20', A8: { fondo: '#fff59d' } }, { 0: 170 })),
    pasos: [
      { texto: 'Sumar muchos números a mano es largo. Hacé clic en la casilla de abajo de todo, la A8.', senalar: casilla('A8'), listo: (a) => a.activa() === 'A8' },
      { texto: 'Ahora apretá la varita Σ. Suma todo lo que hay arriba.', senalar: '.cd-boton.sigma', listo: (a) => a.celda('A8').v.startsWith('=SUMA'), pista: 'Es el botón verde con una letra que parece una M acostada: Σ.' },
      { texto: '¡72 puntos! Mirá arriba lo que escribió la varita: SUMA de la A2 a la A7. Quiere decir: sumá desde la A2 hasta la A7.', senalar: '.tb-campo', boton: 'Sigo' },
      { texto: 'Un truco más: hacé clic en la A2 y, sin soltar, arrastrá hasta la A7.', listo: (a) => a.seleccion() === 'A2:A7', pista: 'Apretá en el 12 y bajá hasta el 20 sin soltar el botón.' },
      { texto: 'Abajo de todo dice la suma, el promedio y cuántos números hay. ¡Sin escribir nada!', senalar: '.tablero .barra-estado', boton: '¡Listo!' },
    ],
  },
  {
    id: 'tb-esquina',
    programa: 'tablero',
    titulo: 'La esquinita mágica',
    icono: '✨',
    figurita: '🦄',
    resumen: 'Que la compu siga contando sola: 1, 2, 3…',
    guardarComo: 'Mis tablas',
    preparar: (a) => a.cargar(hoja({})),
    pasos: [
      { texto: 'Escribí 1 en la A1 y apretá Enter.', senalar: casilla('A1'), listo: (a) => vale(a, 'A1', 1) },
      { texto: 'Ahora 2 en la A2 y Enter.', senalar: casilla('A2'), listo: (a) => vale(a, 'A2', 2) },
      { texto: 'Elegí las dos: hacé clic en la A1 y arrastrá hasta la A2.', listo: (a) => a.seleccion() === 'A1:A2', pista: 'Apretá en el 1 y, sin soltar, bajá al 2.' },
      {
        texto: '¿Ves el cuadradito verde en la esquina de abajo? Agarralo y arrastrá hacia abajo hasta la fila 10.',
        senalar: '.tb-manija',
        listo: (a) => vale(a, 'A10', 10),
        pista: 'Poné el mouse justo arriba del cuadradito (se vuelve una cruz finita), apretá y bajá sin soltar.',
      },
      { texto: '¡Contó solo hasta 10! Ahora la tabla del 2: escribí 2 en la B1 y 4 en la B2.', senalar: casilla('B1'), listo: (a) => vale(a, 'B1', 2) && vale(a, 'B2', 4) },
      { texto: 'Elegí la B1 y la B2, y arrastrá la esquinita hasta la fila 10.', listo: (a) => vale(a, 'B10', 20), pista: 'Igual que antes: elegí las dos y tirá del cuadradito verde.' },
      { texto: '¡La tabla del 2 entera! ¿Te animás a hacer la del 5 en la columna C?', listo: (a) => vale(a, 'C10', 50), boton: 'Después' },
    ],
  },
  {
    id: 'tb-pixel',
    programa: 'tablero',
    titulo: 'Dibujo con casillas',
    icono: '❤️',
    figurita: '🎨',
    resumen: 'Pintar casillas de colores para hacer un dibujo.',
    guardarComo: 'Mi corazón',
    preparar: (a) => a.cargar(hoja({}, Object.fromEntries([...Array(12)].map((_, i) => [i, 32])))),
    pasos: [
      { texto: 'Las casillas también sirven para dibujar. Hacé clic en la B2 y arrastrá hasta la C3.', senalar: casilla('B2'), listo: (a) => a.seleccion() === 'B2:C3', pista: 'Apretá en la B2 y, sin soltar, andá en diagonal hasta la C3.' },
      { texto: 'Ahora elegí un color del balde 🪣 de arriba. ¡El que más te guste!', senalar: '.tb-paleta', listo: (a) => !!a.celda('B2').fondo, pista: 'Son los cuadraditos de colores al lado del balde.' },
      {
        texto: '¡Pintaste! Ahora hacé un corazón como este. Elegí casillas y pintalas.',
        extra: modeloCorazon,
        listo: (a) => celdasCorazon.every((r) => !!a.celda(r).fondo),
        pista: 'Podés pintar de a una casilla o arrastrar varias juntas. El corazón empieza en la B2, como el que ya pintaste.',
      },
      { texto: '¡Qué lindo corazón! Se puede dibujar cualquier cosa así: un hongo, una carita, un gato…', boton: '¡Gracias!' },
    ],
  },
  {
    id: 'tb-encuesta',
    programa: 'tablero',
    titulo: 'La encuesta',
    icono: '📊',
    figurita: '🏆',
    resumen: 'Preguntarle a la familia y hacer un gráfico.',
    guardarComo: 'La encuesta',
    preparar: (a) => a.cargar(hoja({ A1: titulo('Fruta'), B1: titulo('Votos'), A2: 'Banana', A3: 'Manzana', A4: 'Frutilla', A5: 'Naranja' }, { 0: 130 })),
    pasos: [
      { texto: 'Preguntale a tu familia qué fruta les gusta más. En la columna B escribí cuántos votos sacó cada una.', senalar: casilla('B2'), listo: (a) => numero(a, 'B2', 'B3', 'B4', 'B5'), pista: 'Clic en la B2, escribí el número y Enter. Así con las cuatro.' },
      { texto: 'Elegí toda la tabla: hacé clic en la A1 y arrastrá hasta la B5.', listo: (a) => a.seleccion() === 'A1:B5', pista: 'Apretá en Fruta y, sin soltar, andá hasta el último número.' },
      { texto: 'Ahora apretá el botón del gráfico 📊.', senalar: '.cd-boton[title^="Gráfico"]', listo: (a) => !!a.grafico() },
      { texto: '¡Un gráfico! La barra más alta es la que ganó. Y si cambiás un número, el gráfico cambia solo.', boton: '¡Listo!' },
    ],
  },
  {
    id: 'tb-ahorros',
    programa: 'tablero',
    titulo: 'Mis ahorros',
    icono: '🐷',
    figurita: '💰',
    resumen: 'Lo que hace la gente grande con el Excel.',
    guardarComo: 'Mis ahorros',
    preparar: (a) =>
      a.cargar(hoja({ A1: titulo('Mes'), B1: titulo('Ahorré'), A2: 'Enero', A3: 'Febrero', A4: 'Marzo', A5: 'Abril', A6: 'Mayo', A7: 'Junio', A8: { v: 'Total', b: true } }, { 0: 120, 1: 110 })),
    pasos: [
      { texto: 'Escribí cuánta plata juntaste, o te gustaría juntar, en enero, febrero y marzo.', senalar: casilla('B2'), listo: (a) => numero(a, 'B2', 'B3', 'B4') },
      { texto: 'Para que se vean como pesos: elegí desde la B2 hasta la B7 y apretá el botón $.', senalar: '.cd-boton[title="Pesos"]', listo: (a) => a.celda('B2').moneda, pista: 'Primero arrastrá de la B2 a la B7, después el $ de arriba.' },
      { texto: 'Hacé clic en la B8 y apretá la varita Σ para saber cuánto juntaste en total.', senalar: '.cd-boton.sigma', listo: (a) => a.celda('B8').v.startsWith('=SUMA') },
      { texto: 'Para terminar: elegí desde la A1 hasta la B7 y apretá el gráfico 📊.', senalar: '.cd-boton[title^="Gráfico"]', listo: (a) => !!a.grafico() },
      { texto: '¡Ya sabés hacer lo mismo que la gente grande con el Excel! Cada vez que ahorres, lo escribís y el total se arregla solo.', boton: '¡Genial!' },
    ],
  },
]
