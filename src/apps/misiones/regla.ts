// Misiones de Regla (el AutoCAD): dibujar escribiendo medidas, como en la obra.

import type { Mision } from '../../os/guia'
import type { Ent } from '../regla/geometria'

interface ApiRegla {
  hizo(a: string): boolean
  ents(): Ent[]
  orto(): boolean
  comando(): string
  cargar(): void
  guardarComo(n: string): string
}
type M = Mision<ApiRegla>

const largo = (e: Ent) => (e.tipo === 'linea' ? Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y) : 0)
const lineas = (a: ApiRegla) => a.ents().filter((e) => e.tipo === 'linea')
const rects = (a: ApiRegla, capa?: number) =>
  a.ents().filter((e): e is Extract<Ent, { tipo: 'rect' }> => e.tipo === 'rect' && (capa === undefined || e.capa === capa))
const medidas = (e: Extract<Ent, { tipo: 'rect' }>) => [Math.abs(e.b.x - e.a.x), Math.abs(e.b.y - e.a.y)]

export const MISIONES_REGLA: M[] = [
  {
    id: 'rg-lineas',
    programa: 'regla',
    titulo: 'Líneas con medida',
    icono: '📏',
    figurita: '🐝',
    resumen: 'Dibujar escribiendo los metros, como los arquitectos.',
    preparar: (a) => a.cargar(),
    pasos: [
      { texto: 'Acá se dibuja escribiendo, como hacen los arquitectos y los ingenieros. Escribí la letra L y apretá Enter.', senalar: '.rg-linea', listo: (a) => a.hizo('cmd:LINEA'), pista: 'Solo la L y Enter. Aparece abajo, en la línea de comandos.' },
      {
        texto: 'Hacé clic en la hoja para empezar. Después mové el mouse hacia la derecha, escribí 3 y Enter. ¡Una línea de 3 metros justos! Fijate que al lado del mouse se ve lo que vas escribiendo.',
        listo: (a) => lineas(a).some((e) => Math.abs(largo(e) - 300) < 0.5),
        pista: 'Un clic en la hoja, mové el mouse a la derecha (sin apretar), escribí 3 y Enter.',
      },
      { texto: 'Apretá F8. Abajo se prende ORTO y las líneas salen derechitas, sin torcerse.', senalar: '.rg-modos', listo: (a) => a.orto(), pista: 'F8 está en la fila de arriba de todo del teclado.' },
      { texto: 'Seguí: mové el mouse para arriba, escribí 2 y Enter. Después a la izquierda, 3 y Enter.', listo: (a) => lineas(a).length >= 3, pista: 'Primero el mouse hacia arriba, el número y Enter. Después hacia la izquierda.' },
      { texto: 'Para cerrar la figura, escribí C y Enter. ¡Te quedó un rectángulo de 3 por 2 metros!', listo: (a) => lineas(a).length >= 4 },
      { texto: 'Con la rueda del mouse acercás y alejás el dibujo. Probala.', listo: (a) => a.hizo('zoom'), boton: 'No tengo rueda' },
      { texto: 'Escribí Z y Enter cuando quieras ver todo el dibujo. ¡Ya dibujás como en la obra!', boton: '¡Genial!' },
    ],
  },
  {
    id: 'rg-pieza',
    programa: 'regla',
    titulo: 'El plano de mi pieza',
    icono: '🛏️',
    figurita: '🗝️',
    resumen: 'Medir tu pieza de verdad y dibujarla con sus medidas.',
    guardarComo: 'El plano de mi pieza',
    preparar: (a) => a.cargar(),
    pasos: [
      { texto: 'Primero, con papá o mamá, medí tu pieza con una cinta métrica: cuánto mide de ancho y de largo, en metros (por ejemplo 3,50). Anotalo en un papel.', boton: 'Ya la medimos' },
      {
        texto: 'Escribí REC y Enter. Hacé clic en la hoja y escribí la medida así: @ancho;largo (por ejemplo @3,5;3) y Enter.',
        listo: (a) => rects(a, 0).some((e) => Math.min(...medidas(e)) >= 150),
        pista: 'La arroba @ se escribe manteniendo Alt Gr (a la derecha de la barra espaciadora) y apretando la Q. Después el ancho, un punto y coma (;), el largo, y Enter.',
      },
      { texto: 'Ahora los muebles: arriba a la derecha cambiá la capa a Muebles. Escribí REC y dibujá tu cama: @0,9;1,9.', senalar: '.rg-capa', listo: (a) => rects(a, 2).length >= 1, pista: 'En la cajita que dice Capa elegí Muebles. Después REC, clic adentro de la pieza y @0,9;1,9 (90 centímetros por 1,90 metros).' },
      { texto: 'La puerta: elegí la capa Puertas y ventanas y dibujá una línea de 0,8 (80 centímetros) donde está la puerta.', senalar: '.rg-capa', listo: (a) => a.ents().some((e) => e.capa === 1) },
      { texto: 'Ahora medila: escribí COT y Enter, clic en una esquina de la pieza, clic en la otra, y un clic afuera para ubicar la medida.', listo: (a) => a.ents().some((e) => e.tipo === 'cota') },
      { texto: 'Por último el nombre: escribí T y Enter, hacé clic adentro de la pieza y escribí Mi pieza.', listo: (a) => a.ents().some((e) => e.tipo === 'texto') },
      { texto: '¡Un plano de verdad, con las medidas de tu pieza! Así empiezan todas las casas y los edificios.', boton: '¡Qué bueno!' },
    ],
  },
]
