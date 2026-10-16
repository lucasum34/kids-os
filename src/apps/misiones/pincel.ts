// Misiones de Pincel (el Paint).

import type { Mision } from '../../os/guia'

interface ApiPincel {
  hizo(accion: string): boolean
  color1(): string
  color2(): string
  pintado(): number
  cargar(): void
  guardarComo(n: string): string
}
type M = Mision<ApiPincel>

const boton = (titulo: string) => `.pt-boton[title="${titulo}"]`
const empiezaCon = (titulo: string) => `.pt-boton[title^="${titulo}"]`

export const MISIONES_PINCEL: M[] = [
  {
    id: 'pc-primero',
    programa: 'pincel',
    titulo: 'Mi primer dibujo',
    icono: '🖌️',
    figurita: '🌼',
    resumen: 'Elegir colores, pintar, y el color 2 con el clic derecho.',
    guardarComo: 'Mi primer dibujo',
    preparar: (a) => a.cargar(),
    pasos: [
      { texto: 'Elegí un color de los cuadraditos de arriba. ¡El que más te guste!', senalar: '.pt-paleta', listo: (a) => a.color1() !== '#000000', pista: 'Hacé un clic en cualquier color que no sea el negro.' },
      { texto: 'Ahora apretá en la hoja blanca y, sin soltar, mové el mouse para pintar.', senalar: '.pt-hoja', listo: (a) => a.hizo('pincel'), pista: 'Apretá el botón del mouse sobre la hoja y movelo sin soltar, como si fuera un pincel.' },
      { texto: 'Cambiá el tamaño del pincel en la cajita de Tamaño y pintá de nuevo.', senalar: '.paint .cd-select', listo: (a) => a.hizo('pincel:otro-tamano'), pista: 'Elegí un número más grande, como 14 o 24, y pintá otra vez.' },
      { texto: 'Un secreto: con el clic DERECHO del mouse se pinta con el color 2. Elegí un color con clic derecho y pintá con el botón derecho.', senalar: (v) => v.raiz.querySelectorAll('.pt-muestra')[1] ?? null, listo: (a) => a.hizo('pincel-der'), pista: 'El botón derecho del mouse es el del costado. En la paleta, clic derecho elige el color 2.' },
      { texto: '¡Un dibujo con dos colores! Ahora seguí pintando todo lo que quieras.', boton: '¡Terminé!' },
    ],
  },
  {
    id: 'pc-casa',
    programa: 'pincel',
    titulo: 'La casa',
    icono: '🏠',
    figurita: '🏡',
    resumen: 'Formas y el balde para pintar adentro.',
    guardarComo: 'Mi casa',
    preparar: (a) => a.cargar(),
    pasos: [
      { texto: 'Vamos a dibujar una casa con formas. Apretá el rectángulo.', senalar: boton('Rectángulo'), listo: () => !!document.querySelector('.pt-boton.activo[title="Rectángulo"]') },
      { texto: 'Apretá en la hoja y arrastrá en diagonal para hacer la pared de la casa.', senalar: '.pt-hoja', listo: (a) => a.hizo('forma:rect'), pista: 'Apretá donde va una esquina y, sin soltar, llevá el mouse hasta la otra esquina.' },
      { texto: 'Ahora el techo: elegí el triángulo y dibujalo arriba de la pared.', senalar: boton('Triángulo'), listo: (a) => a.hizo('forma:triangulo') },
      { texto: 'Para pintar la pared: elegí el balde, un color, y hacé clic adentro de la pared.', senalar: boton('Relleno con color'), listo: (a) => a.hizo('balde'), pista: 'El balde pinta todo lo que está cerrado. Si se escapa el color, ¡apretá Ctrl+Z!' },
      { texto: 'Un sol: elegí el óvalo y, con la tecla Mayús apretada, dibujá un círculo arriba.', senalar: boton('Óvalo'), listo: (a) => a.hizo('forma:elipse'), pista: 'Mayús es la tecla con la flechita para arriba. Mantenela apretada mientras dibujás: sale redondo.' },
      { texto: 'Para terminar, pintá el cielo: balde, celeste, y clic en el blanco de afuera.', senalar: boton('Relleno con color'), listo: (a) => a.hizo('balde:#99d9ea') || a.hizo('balde:#00a2e8') || a.pintado() > 0.6, pista: 'Elegí el celeste y hacé clic en una parte blanca, lejos de la casa.' },
      { texto: '¡Qué linda casa! Si querés, agregale una puerta y ventanas con rectángulos.', boton: '¡Lista!' },
    ],
  },
  {
    id: 'pc-nombre',
    programa: 'pincel',
    titulo: 'Mi nombre de colores',
    icono: '🌈',
    figurita: '✨',
    resumen: 'Texto, aerosol y crayón para decorar.',
    guardarComo: 'Mi nombre',
    preparar: (a) => a.cargar(),
    pasos: [
      { texto: 'Elegí la A, que es para escribir.', senalar: boton('Texto'), listo: () => !!document.querySelector('.pt-boton.activo[title="Texto"]') },
      { texto: 'En la cajita de Tamaño elegí 48 o 72, para que sea grande.', senalar: '.paint .cd-select', listo: () => Number((document.querySelector('.paint .cd-select') as HTMLSelectElement | null)?.value) >= 48 },
      { texto: 'Hacé clic en la hoja, escribí tu nombre y apretá Enter.', senalar: '.pt-hoja', listo: (a) => a.hizo('texto-grande'), pista: 'Clic donde quieras que empiece el nombre, escribilo y Enter.' },
      { texto: '¡Ahora a decorar! Elegí el aerosol y rociá alrededor de tu nombre.', senalar: boton('Aerosol'), listo: (a) => a.hizo('aerosol'), pista: 'Mantené apretado el botón del mouse un ratito: sale como un spray.' },
      { texto: 'Y con el crayón hacé un marco o rayitas de colores.', senalar: empiezaCon('Crayón'), listo: (a) => a.hizo('crayon') },
      { texto: '¡Quedó hermoso! Cada pincel pinta distinto.', boton: '¡Sí!' },
    ],
  },
  {
    id: 'pc-borrar',
    programa: 'pincel',
    titulo: 'Borrar y deshacer',
    icono: '🧽',
    figurita: '🦉',
    resumen: 'El borrador, y Ctrl+Z para volver atrás.',
    preparar: (a) => a.cargar(),
    pasos: [
      { texto: 'Hacé un dibujo cualquiera con el pincel.', senalar: '.pt-hoja', listo: (a) => a.hizo('pincel') && a.pintado() > 0.003 },
      { texto: 'Elegí el borrador y pasalo por una parte del dibujo.', senalar: empiezaCon('Borrador'), listo: (a) => a.hizo('borrador') },
      { texto: 'El borrador pinta con el color 2. Si el color 2 es blanco, queda como la hoja. ¿Te diste cuenta?', boton: '¡Ah, sí!' },
      { texto: 'Ahora el truco más importante de la compu: Ctrl+Z deshace lo último que hiciste. Mantené Ctrl y apretá la Z.', listo: (a) => a.hizo('deshacer'), pista: 'Ctrl está abajo a la izquierda del teclado. Mantenela apretada y apretá la Z.' },
      { texto: '¡Volvió! Ctrl+Z funciona en casi todos los programas. Si te equivocás, no pasa nada.', boton: '¡Genial!' },
    ],
  },
  {
    id: 'pc-estrellas',
    programa: 'pincel',
    titulo: 'Muchas estrellas',
    icono: '⭐',
    figurita: '🌟',
    resumen: 'Seleccionar, copiar y pegar.',
    guardarComo: 'Muchas estrellas',
    preparar: (a) => a.cargar(),
    pasos: [
      { texto: 'Dibujá una estrella: elegí la forma de estrella y arrastrá en la hoja.', senalar: boton('Estrella'), listo: (a) => a.hizo('forma:estrella') },
      { texto: 'Pintala por adentro con el balde.', senalar: boton('Relleno con color'), listo: (a) => a.hizo('balde') },
      { texto: 'Ahora elegí Seleccionar y arrastrá un rectángulo alrededor de la estrella.', senalar: empiezaCon('Seleccionar'), listo: (a) => a.hizo('seleccion'), pista: 'Apretá arriba a la izquierda de la estrella y arrastrá hasta abajo a la derecha.' },
      { texto: 'Copiala con Ctrl+C y pegala con Ctrl+V.', listo: (a) => a.hizo('copiar') && a.hizo('pegar'), pista: 'Mantené Ctrl y apretá la C. Después mantené Ctrl y apretá la V.' },
      { texto: 'La copia apareció arriba. Arrastrala a otro lugar.', listo: (a) => a.hizo('mover'), pista: 'Apretá en el medio de la copia y, sin soltar, llevala a otro lado.' },
      { texto: 'Pegá más estrellas con Ctrl+V y llená el cielo.', boton: '¡Listo el cielo!' },
    ],
  },
]
