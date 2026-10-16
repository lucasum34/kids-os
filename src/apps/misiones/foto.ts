// Misiones de Foto (el Photoshop): las capas y los efectos.

import type { Mision } from '../../os/guia'

interface ApiFoto {
  hizo(a: string): boolean
  capas(): number
  activa(): number
  opacidad(): number
  cargar(): void
  guardarComo(n: string): string
}
type M = Mision<ApiFoto>

const herr = (nombre: string) => `.ft-herr[title^="${nombre}"]`
const menu = (titulo: string) => (v: { raiz: HTMLElement }) => [...v.raiz.querySelectorAll('.menu-titulo')].find((x) => x.textContent === titulo) ?? null

export const MISIONES_FOTO: M[] = [
  {
    id: 'ft-capas',
    programa: 'foto',
    titulo: 'Las capas',
    icono: '🥞',
    figurita: '🧅',
    resumen: 'Hojas transparentes, una arriba de la otra.',
    guardarComo: 'Mis capas',
    preparar: (a) => a.cargar(),
    pasos: [
      { texto: 'Foto trabaja con capas: son como hojas transparentes, una arriba de la otra. Primero pintá el fondo: elegí el balde, un color, y clic en la imagen.', senalar: herr('Bote de pintura'), listo: (a) => a.hizo('balde'), pista: 'El balde está en la barra de la izquierda. Los colores, arriba a la derecha.' },
      { texto: 'Ahora una capa nueva: en el panel Capas, a la derecha, apretá el ＋.', senalar: '.ft-capa-botones .cd-boton', listo: (a) => a.capas() >= 2 },
      { texto: 'Con el pincel dibujá algo en esta capa nueva: una carita, una flor, lo que quieras.', senalar: herr('Pincel'), listo: (a) => a.hizo('pincel:capa1') || (a.activa() > 0 && a.hizo('pincel:capa' + a.activa())), pista: 'Fijate que en el panel Capas esté marcada la «Capa 1» (la de arriba).' },
      { texto: 'Apretá el ojito 👁 de tu capa. ¿Viste? Lo que dibujaste se esconde, pero el fondo sigue ahí.', senalar: '.ft-capa .ft-ojo', listo: (a) => a.hizo('ocultar') },
      { texto: 'Volvé a apretar el ojito para que aparezca.', senalar: '.ft-capa .ft-ojo', listo: (a) => a.hizo('mostrar') },
      { texto: 'Mové la barrita de Opacidad hacia la izquierda: tu dibujo se vuelve transparente, como un fantasma.', senalar: '.ft-panel .ft-opcion', listo: (a) => a.opacidad() < 0.9 },
      { texto: '¡Eso son las capas! Cada cosa en su hoja, y se puede cambiar una sin tocar las otras.', boton: '¡Entendí!' },
    ],
  },
  {
    id: 'ft-postal',
    programa: 'foto',
    titulo: 'Una postal antigua',
    icono: '📷',
    figurita: '🎞️',
    resumen: 'Efectos de color y un saludo escrito.',
    guardarComo: 'Mi postal',
    preparar: (a) => a.cargar(),
    pasos: [
      {
        texto: 'Traé una foto o un dibujo tuyo: abrí el menú Capa y elegí «Meter una imagen de Mis cosas».',
        senalar: menu('Capa'),
        listo: (a) => a.hizo('imagen'),
        boton: 'No tengo imágenes',
        pista: 'Los menús están arriba de todo: Archivo, Editar, Imagen, Capa…',
      },
      { texto: 'Ahora dale efecto de foto antigua: menú Imagen → «Sepia (foto antigua)».', senalar: menu('Imagen'), listo: (a) => a.hizo('filtro:sepia') },
      { texto: 'Escribí un saludo: elegí la T, hacé clic arriba de la imagen, escribí y apretá Enter.', senalar: herr('Texto'), listo: (a) => a.hizo('texto') },
      { texto: 'Probá Imagen → «Brillo, contraste y color…» y mové las barritas. Apretá Aplicar cuando te guste.', senalar: menu('Imagen'), listo: (a) => a.hizo('filtro:brightness'), boton: 'Así está bien' },
      { texto: '¡Una postal de verdad! Los efectos cambian solo la capa que está elegida.', boton: '¡Linda!' },
    ],
  },
]
