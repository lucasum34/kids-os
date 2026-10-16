// Misiones de Diapositivas (el PowerPoint): armar una presentación y mostrarla.

import type { Mision } from '../../os/guia'

interface ApiDiapos {
  hizo(a: string): boolean
  diapos(): number
  tema(): number
  pestana(): string
  editando(): boolean
  texto(i: number, rol: string): string
  cuantos(tipo: string): number
  animadas(): number
  transiciones(): number
  cargar(): void
  guardarComo(n: string): string
}
type M = Mision<ApiDiapos>

const pestana = (nombre: string) => (v: { raiz: HTMLElement }) => [...v.raiz.querySelectorAll('.dp-pestana')].find((x) => x.textContent === nombre) ?? null
const cambio = (a: ApiDiapos, i: number, rol: string, original: string) => !a.editando() && a.texto(i, rol).trim() !== '' && a.texto(i, rol) !== original

export const MISIONES_DIAPOSITIVAS: M[] = [
  {
    id: 'dp-mascota',
    programa: 'diapositivas',
    titulo: 'Mi mascota',
    icono: '🐶',
    figurita: '🐾',
    resumen: 'Una presentación de dos diapositivas, para mostrarle a la familia.',
    guardarComo: 'Mi mascota',
    preparar: (a) => a.cargar(),
    pasos: [
      { texto: 'Esta es tu primera diapositiva. Hacé doble clic en el título y escribí: Mi mascota. Después hacé clic afuera, en lo gris.', senalar: '.dp-escenario .dp-obj', listo: (a) => cambio(a, 0, 'titulo', 'Título de la presentación'), pista: 'Doble clic es dos clics rápidos. Borrá lo que dice con ⌫ y escribí.' },
      { texto: 'En el renglón de abajo escribí tu nombre (doble clic, escribir, y clic afuera).', senalar: '.dp-escenario .dp-obj:nth-child(2)', listo: (a) => cambio(a, 0, 'cuerpo', 'Mi nombre') },
      { texto: 'Ahora una diapositiva nueva: apretá «+ Diapositiva nueva» y elegí «Título y texto».', senalar: '.dp-lista .boton', listo: (a) => a.diapos() >= 2 },
      { texto: 'En el título escribí: Cómo es. Y en el texto de abajo, tres cosas de tu mascota (o de tu animal favorito).', listo: (a) => cambio(a, 1, 'titulo', 'Título') && cambio(a, 1, 'cuerpo', '• Primera idea\n• Segunda idea\n• Tercera idea'), pista: 'Doble clic en cada texto para escribir. Al terminar, clic afuera.' },
      { texto: 'Hagámosla linda: abrí la pestaña Diseño y elegí un tema.', senalar: pestana('Diseño'), listo: (a) => a.tema() !== 0, pista: 'Las pestañas están arriba, en la franja de color. Después elegí uno de los cuadrados con «Aa».' },
      { texto: '¡A presentar! Apretá la tecla F5. Para pasar: clic o la flecha →. Para salir: Esc.', listo: (a) => a.hizo('presentar'), pista: 'F5 está en la fila de arriba de todo del teclado.' },
      { texto: '¡Excelente! Así se presenta un trabajo en el colegio. Mostrásela a tu familia.', boton: '¡Sí!' },
    ],
  },
  {
    id: 'dp-efectos',
    programa: 'diapositivas',
    titulo: 'Con efectos',
    icono: '🎬',
    figurita: '🎆',
    resumen: 'Animaciones, transiciones y una imagen tuya.',
    guardarComo: 'Con efectos',
    preparar: (a) => a.cargar(),
    pasos: [
      { texto: 'Abrí la pestaña Insertar y poné una estrella.', senalar: pestana('Insertar'), listo: (a) => a.cuantos('estrella') >= 1 },
      { texto: 'Con la estrella elegida, abrí la pestaña Animaciones y elegí «Girar».', senalar: pestana('Animaciones'), listo: (a) => a.animadas() >= 1, pista: 'Si la estrella no tiene un borde de color alrededor, hacé clic en ella primero.' },
      { texto: 'Ahora la pestaña Transiciones: elegí «Desvanecer». Es cómo entra la diapositiva.', senalar: pestana('Transiciones'), listo: (a) => a.transiciones() >= 1 },
      { texto: 'Agregá una foto o un dibujo tuyo: Insertar → Foto o dibujo de Mis cosas.', senalar: pestana('Insertar'), listo: (a) => a.cuantos('imagen') >= 1, boton: 'No tengo dibujos' },
      { texto: 'Presentá con F5. La estrella aparece girando cuando hacés clic.', listo: (a) => a.hizo('presentar') },
      { texto: '¡Como en el cine! No pongas demasiados efectos: con pocos queda mejor.', boton: '¡Entendido!' },
    ],
  },
]
