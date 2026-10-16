// Misiones del Cuaderno (el Word).

import type { Mision } from '../../os/guia'

interface ApiCuaderno {
  texto(): string
  renglones(): number
  hay(selector: string): boolean
  cuantos(selector: string): number
  negrita(): boolean
  tamanoMayor(): number
  colorDeLetra(): boolean
  centrado(): boolean
  elegido(): boolean
  imprimio(): boolean
  cargar(html: string): void
  guardarComo(n: string): string
}
type M = Mision<ApiCuaderno>

export const MISIONES_CUADERNO: M[] = [
  {
    id: 'cd-frase',
    programa: 'cuaderno',
    titulo: 'Mi primera frase',
    icono: '✍️',
    figurita: '🐣',
    resumen: 'Escribir, bajar de renglón y borrar.',
    guardarComo: 'Mi primera frase',
    preparar: (a) => a.cargar('<p><br></p>'),
    pasos: [
      { texto: 'Esta es una hoja en blanco. Hacé clic en la hoja y escribí: Me llamo… y tu nombre.', senalar: '.cd-hoja', listo: (a) => a.texto().trim().length >= 8, pista: 'Hacé clic en la parte blanca y escribí con las teclas. Para el espacio entre palabras, la barra larga de abajo.' },
      { texto: '¡Muy bien! Ahora apretá Enter para bajar de renglón y escribí qué te gusta hacer.', listo: (a) => a.renglones() >= 2, pista: 'Enter es la tecla grande con una flechita doblada. Te lleva al renglón de abajo.' },
      { texto: 'Si te equivocás, la tecla ⌫ (Borrar) borra la letra de atrás. Probala: borrá la última letra y volvé a escribirla.', boton: '¡Ya sé!' },
      { texto: 'Para escribir una letra mayúscula, mantené apretada la tecla ⇧ (Mayús) y apretá la letra. Escribí tu nombre otra vez, con la primera letra grande.', boton: '¡Listo!' },
    ],
  },
  {
    id: 'cd-lindas',
    programa: 'cuaderno',
    titulo: 'Letras lindas',
    icono: '🎀',
    figurita: '🦋',
    resumen: 'Elegir palabras y cambiarles el tamaño, el color y la forma.',
    guardarComo: 'Letras lindas',
    preparar: (a) => a.cargar('<p>Mi animal favorito</p><p>Me gusta porque es muy lindo y divertido.</p>'),
    pasos: [
      { texto: 'Para cambiar cómo se ven las letras, primero hay que elegirlas. Hacé doble clic en la palabra animal.', senalar: '.cd-hoja p', listo: (a) => a.elegido(), pista: 'Doble clic: dos clics rápidos arriba de la palabra. Se pinta de celeste.' },
      { texto: '¡Elegida! Ahora apretá la N para ponerla en negrita.', senalar: '.cd-boton[title^="Negrita"]', listo: (a) => a.negrita() },
      { texto: 'Ahora elegí todo el primer renglón (arrastrando de punta a punta) y hacelo grande: en el número de al lado de la letra elegí 36.', senalar: '.cd-select.tamano', listo: (a) => a.tamanoMayor() >= 28, pista: 'Apretá antes de Mi y, sin soltar, andá hasta después de favorito. Después elegí un número grande en la cajita.' },
      { texto: 'Con el renglón elegido, apretá un color de la letra. ¡El que quieras!', senalar: '.cd-colores', listo: (a) => a.colorDeLetra() },
      { texto: 'Por último, poné el título en el medio: apretá el botón de centrar.', senalar: '.cd-boton[title="Centrar"]', listo: (a) => a.centrado() },
      { texto: '¡Quedó como un título de verdad! Elegir primero, cambiar después: así se hace en todos los programas.', boton: '¡Genial!' },
    ],
  },
  {
    id: 'cd-lista',
    programa: 'cuaderno',
    titulo: 'Invitados al cumple',
    icono: '🎂',
    figurita: '🎈',
    resumen: 'Listas con puntos y con números.',
    guardarComo: 'Invitados al cumple',
    preparar: (a) => a.cargar('<p><b>Invitados a mi cumple</b></p><p><br></p>'),
    pasos: [
      { texto: 'Vamos a hacer la lista de invitados. Hacé clic en el renglón de abajo del título y apretá el botón de lista con puntos.', senalar: '.cd-boton[title="Lista con puntos"]', listo: (a) => a.hay('ul li'), pista: 'Primero clic en la hoja, debajo del título. Después el botón con puntitos.' },
      { texto: 'Apareció un puntito. Escribí el nombre de un amigo o amiga y apretá Enter: sale otro puntito solo.', listo: (a) => a.cuantos('ul li') >= 1 && a.texto().split('\n').length >= 2 },
      { texto: 'Escribí por lo menos tres invitados, uno en cada renglón.', listo: (a) => a.cuantos('ul li') >= 3, pista: 'Después de cada nombre, Enter.' },
      { texto: '¿Y si querés saber cuántos son? Elegí toda la lista y apretá el botón de lista con números.', senalar: '.cd-boton[title="Lista numerada"]', listo: (a) => a.cuantos('ol li') >= 3, pista: 'Arrastrá desde el primer nombre hasta el último y apretá el botón que tiene un 1.' },
      { texto: '¡Ahora están numerados! Así sabés cuántos invitados son.', boton: '¡Listo!' },
    ],
  },
  {
    id: 'cd-carta',
    programa: 'cuaderno',
    titulo: 'Carta para la abuela',
    icono: '💌',
    figurita: '👵',
    resumen: 'Una carta con un dibujo tuyo, para imprimir.',
    guardarComo: 'Carta para la abuela',
    preparar: (a) => a.cargar('<p><br></p>'),
    pasos: [
      { texto: 'Vamos a escribirle una carta a la abuela (o a quien quieras). Empezá con: Querida abuela', senalar: '.cd-hoja', listo: (a) => a.texto().trim().length >= 10 },
      { texto: 'Bajá con Enter y contale algo lindo: qué hiciste hoy, o qué te gustaría hacer con ella.', listo: (a) => a.renglones() >= 3, pista: 'Enter para bajar de renglón. Escribí dos o tres renglones.' },
      { texto: 'Al final, despedite: Te quiero mucho, y tu nombre.', listo: (a) => a.renglones() >= 4 },
      {
        texto: 'Ahora le agregamos un dibujo tuyo: apretá el botón de imagen y elegí uno.',
        senalar: '.cd-boton[title^="Meter una imagen"]',
        listo: (a) => a.hay('img'),
        boton: 'No tengo dibujos',
        pista: 'Si todavía no hiciste ningún dibujo, apretá «No tengo dibujos». Después podés hacer uno en Pincel.',
      },
      { texto: '¡Qué linda carta! Si querés, imprímanla con papá o mamá: es el botón de la impresora.', senalar: '.cd-boton[title^="Imprimir"]', listo: (a) => a.imprimio(), boton: 'Ahora no' },
    ],
  },
]

