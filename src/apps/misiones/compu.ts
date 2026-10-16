// Misiones de la Isla Compu: usar la computadora en sí (carpetas, pendrive, copiar y pegar entre programas).

import * as fs from '../../os/archivos'
import type { Mision } from '../../os/guia'
import { portapapeles } from '../../os/portapapeles'
import { ventanasAbiertas } from '../../os/ventanas'
import { estaInstalado, ponerInstalado } from '../../os/sistema'
import { impresion } from '../../os/imprimir'

// Cada paso puede ser de un programa distinto, así que el api es el del programa de ese paso.
type M = Mision<any>

/** ¿Alguna ventana de Mis cosas está mostrando este lugar (o algo de esa unidad)? */
function misCosasEn(f: (lugar: string) => boolean): boolean {
  return ventanasAbiertas().some((v) => {
    const a = v.api as { lugar?: () => string } | undefined
    return !!a?.lugar && f(a.lugar())
  })
}

/** Para practicar hace falta tener algo guardado: si no hay nada, se crean un par de cosas de ejemplo. */
function asegurarCosas() {
  const propias = fs.visibles().filter((a) => fs.unidad(a.carpeta ?? fs.RAIZ) === fs.RAIZ)
  if (propias.length >= 2) return
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700"><rect width="1000" height="700" fill="#fff"/>' +
    '<circle cx="500" cy="330" r="200" fill="#fdd835" stroke="#000" stroke-width="6"/><circle cx="430" cy="280" r="25"/><circle cx="570" cy="280" r="25"/>' +
    '<path d="M400 400 Q500 480 600 400" fill="none" stroke="#000" stroke-width="10"/></svg>'
  fs.guardar(
    { id: fs.nuevoId(), nombre: 'Carita de práctica', app: 'trazos', miniatura: svg },
    {
      figuras: [
        { id: fs.nuevoId(), tipo: 'elipse', x: 300, y: 130, w: 400, h: 400, relleno: '#fdd835', borde: '#000000', grosor: 6 },
        { id: fs.nuevoId(), tipo: 'elipse', x: 405, y: 255, w: 50, h: 50, relleno: '#000000', borde: '#000000', grosor: 2 },
        { id: fs.nuevoId(), tipo: 'elipse', x: 545, y: 255, w: 50, h: 50, relleno: '#000000', borde: '#000000', grosor: 2 },
      ],
    },
  )
  const html = '<p><b>Lista de cosas para hacer</b></p><p>• Ordenar mi pieza</p><p>• Dibujar un gato</p>'
  fs.guardar(
    { id: fs.nuevoId(), nombre: 'Lista de práctica', app: 'cuaderno', miniatura: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 560"><rect width="800" height="560" fill="#fff"/><foreignObject width="800" height="560"><div xmlns="http://www.w3.org/1999/xhtml" style="padding:60px 70px;font-family:Nunito,Arial;font-size:16pt">${html}</div></foreignObject></svg>` },
    { html },
  )
}

let enPendriveAlEmpezar = 0
const cuantosEnPendrive = () => fs.listar().filter((a) => !a.enPapelera && fs.unidad(a.carpeta ?? fs.RAIZ) === fs.PENDRIVE).length
const carpetasPropias = () => fs.carpetas().filter((c) => !c.enPapelera && fs.unidad(c.padre) === fs.RAIZ)
let carpetasAlEmpezar = 0

export const MISIONES_COMPU: M[] = [
  {
    id: 'cp-carpetas',
    programa: 'mis-cosas',
    titulo: 'Ordenar en carpetas',
    icono: '📁',
    figurita: '🗂️',
    resumen: 'Crear una carpeta, ponerle nombre y guardar cosas adentro.',
    preparar: () => {
      asegurarCosas()
      carpetasAlEmpezar = carpetasPropias().length
    },
    pasos: [
      { texto: 'Esto es Mis cosas: acá está todo lo que guardás. Vamos a ordenarlo. Apretá «Nueva carpeta».', senalar: '.ex-boton[title^="Nueva carpeta"]', listo: () => carpetasPropias().length > carpetasAlEmpezar, pista: 'También se puede con clic derecho en el blanco → Nueva carpeta.' },
      {
        texto: 'Escribile un nombre, por ejemplo Dibujos, y apretá Enter.',
        listo: () => carpetasPropias().some((c) => !c.nombre.startsWith('Nueva carpeta')) && !document.querySelector('.campo.renombrar'),
        pista: 'Si el nombre ya no se puede escribir: clic en la carpeta y la tecla F2.',
      },
      { texto: 'Ahora agarrá una de tus cosas con el mouse y soltala arriba de la carpeta.', listo: () => fs.listar().some((a) => !a.enPapelera && !!a.carpeta && a.carpeta !== fs.PENDRIVE && fs.unidad(a.carpeta) === fs.RAIZ), pista: 'Apretá sobre un dibujo y, sin soltar, llevalo hasta la carpeta. Cuando se pinta de azul, soltá.' },
      { texto: 'Doble clic en la carpeta para entrar. ¡Ahí está lo que guardaste!', listo: () => misCosasEn((l) => l !== fs.RAIZ && l !== fs.PENDRIVE && !l.startsWith('::') && fs.unidad(l) === fs.RAIZ) },
      { texto: 'Para volver, apretá la flecha ↑ o «Mis cosas» en el camino de arriba.', senalar: '.ex-ruta', listo: () => misCosasEn((l) => l === fs.RAIZ) },
      { texto: '¡Ya sabés ordenar! Las carpetas son como cajones: cada cosa en su lugar.', boton: '¡Genial!' },
    ],
  },
  {
    id: 'cp-pendrive',
    programa: 'mis-cosas',
    titulo: 'El pendrive',
    icono: '🔌',
    figurita: '💾',
    resumen: 'Traer cosas de un pendrive, llevar las tuyas, y sacarlo bien.',
    preparar: () => {
      asegurarCosas()
      if (fs.pendriveConectado()) fs.enchufarPendrive(false)
    },
    pasos: [
      { texto: 'Un pendrive es como una cajita para llevar tus cosas de una compu a otra. Enchufalo: apretá el 🔌 de abajo a la derecha.', senalar: () => document.querySelector('.bandeja'), listo: () => fs.pendriveConectado(), pista: 'Está en la barra de abajo, al lado de la hora. Después elegí «Enchufar».' },
      {
        texto: 'Se conectó. En Mis cosas, a la izquierda, apareció PENDRIVE (E:). Hacé clic ahí.',
        senalar: (v) => [...v.raiz.querySelectorAll('.lugar')].find((x) => x.textContent?.includes('PENDRIVE')) ?? null,
        listo: () => misCosasEn((l) => fs.unidad(l) === fs.PENDRIVE),
        alTerminar: () => (enPendriveAlEmpezar = cuantosEnPendrive()),
      },
      {
        texto: 'Adentro hay un cuento. Agarralo con el mouse y soltalo en «Mis cosas», a la izquierda: se copia a tu compu.',
        listo: () => fs.visibles().some((a) => fs.unidad(a.carpeta ?? fs.RAIZ) === fs.RAIZ && a.nombre.includes('dragón')),
        pista: 'Cuando lo llevás arriba de «Mis cosas» dice «Copiar a Mis cosas». Ahí soltalo.',
      },
      {
        texto: 'Ahora al revés: andá a Mis cosas, hacé clic derecho en algo tuyo y elegí «Enviar a ▸ PENDRIVE».',
        senalar: (v) => [...v.raiz.querySelectorAll('.lugar')].find((x) => x.textContent?.includes('Mis cosas')) ?? null,
        listo: () => cuantosEnPendrive() > enPendriveAlEmpezar,
        pista: 'Clic en «Mis cosas» a la izquierda, después clic DERECHO en un dibujo.',
      },
      {
        texto: 'Antes de sacar un pendrive hay que avisarle a la compu. Apretá ⏏ al lado de PENDRIVE (o el 🔌 de abajo → Quitar de forma segura).',
        senalar: (v) => v.raiz.querySelector('.ex-expulsar') ?? document.querySelector('.bandeja'),
        listo: () => !fs.pendriveConectado(),
        pista: 'Si lo sacás sin avisar, lo que se estaba copiando se puede romper.',
      },
      { texto: '¡Perfecto! Así se usa un pendrive de verdad. Cuando tengas uno, probalo con papá o mamá.', boton: '¡Sí!' },
    ],
  },
  {
    id: 'cp-pegar',
    programa: 'pincel',
    titulo: 'Copiar y pegar entre programas',
    icono: '📋',
    figurita: '✂️',
    resumen: 'Un dibujo de Pincel al Cuaderno, y una lista del Cuaderno al Tablero.',
    preparar: (a) => a.cargar(),
    pasos: [
      { texto: 'Dibujá algo lindo en Pincel.', listo: (a) => a.pintado() > 0.003 },
      { texto: 'Ahora elegí todo el dibujo con Ctrl+A y copialo con Ctrl+C.', listo: () => portapapeles()?.tipo === 'imagen' && portapapeles()?.origen === 'pincel', pista: 'Mantené Ctrl y apretá la A. Después, Ctrl y la C.' },
      { en: 'cuaderno', texto: 'Se abrió el Cuaderno. Escribí: Mi dibujo, apretá Enter, y después Ctrl+V para pegar.', senalar: '.cd-hoja', listo: (a) => a.hay('img'), pista: 'Ctrl y la V. ¡Tiene que aparecer tu dibujo!' },
      {
        en: 'cuaderno',
        texto: '¡Pasó de un programa al otro! Ahora escribí tres frutas, una en cada renglón, elegilas con el mouse y copialas con Ctrl+C.',
        listo: () => portapapeles()?.tipo === 'texto' && portapapeles()?.origen === 'cuaderno',
        pista: 'Apretá antes de la primera fruta y arrastrá hasta el final de la última. Después Ctrl+C.',
      },
      { en: 'tablero', texto: 'Se abrió el Tablero. Hacé clic en la A1 y apretá Ctrl+V: cada fruta va a una casilla.', listo: (a) => a.celda('A1').v.trim() !== '' && a.celda('A2').v.trim() !== '' },
      { en: 'tablero', texto: '¡Copiar y pegar funciona entre todos los programas! Es de lo más útil de la compu.', boton: '¡Genial!' },
    ],
  },
  {
    id: 'cp-tienda',
    programa: 'tienda',
    titulo: 'Instalar un juego',
    icono: '🛍️',
    figurita: '🎮',
    resumen: 'Bajar un programa de la Tienda, con permiso de papá o mamá.',
    preparar: () => ponerInstalado('buscaminas', false),
    pasos: [
      { texto: 'Esta es la Tienda: acá se bajan programas nuevos para la compu. ¿Ves el Buscaminas? Todavía no está instalado.', senalar: '.td-tarjeta[data-prog="buscaminas"]', boton: 'Sigo' },
      {
        texto: 'Apretá «Instalar» en el Buscaminas.',
        senalar: '.td-tarjeta[data-prog="buscaminas"] .td-instalar',
        listo: (a) => a.instalando() || estaInstalado('buscaminas') || document.querySelector('.dialogo-titulo')?.textContent === 'Permiso de un adulto',
      },
      {
        texto: 'Para instalar hace falta permiso. Pedile a papá o mamá que escriba su clave y apriete Aceptar.',
        listo: (a) => a.instalando() || estaInstalado('buscaminas'),
        pista: 'Si cerraste el cartel, volvé a apretar «Instalar».',
      },
      { texto: 'Se está bajando y después se instala. Esperá un poquito…', listo: () => estaInstalado('buscaminas') },
      {
        texto: '¡Instalado! Ahora buscalo en el escritorio (o en el menú 🏠 de abajo) y abrilo.',
        senalar: () => document.querySelector('.inicio'),
        listo: () => ventanasAbiertas().some((v) => v.titulo === 'Buscaminas'),
      },
      { texto: '¡A jugar! Clic para abrir casillas y clic derecho para poner banderitas. Y si un día no lo querés más, en la Tienda se puede desinstalar.', boton: '¡Genial!' },
    ],
  },
  {
    id: 'cp-imprimir',
    programa: 'cuaderno',
    titulo: 'Imprimir',
    icono: '🖨️',
    figurita: '📄',
    resumen: 'Elegir impresora, copias y color, y mirar la hoja antes.',
    preparar: (a) => a.cargar('<p><br></p>'),
    pasos: [
      { texto: 'Escribí algo para imprimir: por ejemplo, un saludo para tu familia.', senalar: '.cd-hoja', listo: (a) => a.texto().trim().length >= 5 },
      { texto: 'Abrí la ventana de imprimir: menú Archivo → Imprimir, o Ctrl+P.', senalar: (v) => [...v.raiz.querySelectorAll('.menu-titulo')].find((x) => x.textContent === 'Archivo') ?? null, listo: () => impresion.abierta, pista: 'Ctrl es la tecla de abajo a la izquierda. Mantenela y apretá la P.' },
      { texto: 'A la izquierda se ve la hoja como va a salir. Poné 2 copias con el botón +.', senalar: () => document.querySelector('.imp-copias'), listo: () => impresion.copias >= 2 },
      { texto: 'Elegí «Blanco y negro»: así se gasta menos tinta de color.', senalar: () => document.querySelectorAll('.imp-opcionesb')[0] ?? null, listo: () => !impresion.color },
      { texto: 'Fijate que diga «Impresora de práctica» y apretá Imprimir.', senalar: () => document.querySelector('.imp-botones .principal'), listo: () => !!impresion.ultima && impresion.ultima.copias >= 2 },
      { texto: '¡Salieron tus hojas! Cuando quieras imprimir de verdad, con papá o mamá elegí «La impresora de casa».', boton: '¡Listo!' },
    ],
  },
  {
    id: 'cp-tele',
    programa: 'diapositivas',
    titulo: 'Mostrar en la tele',
    icono: '📺',
    figurita: '🎬',
    resumen: 'Conectar la compu a la tele o a un proyector y presentar (con un adulto).',
    preparar: (a) => a.cargar(),
    pasos: [
      { texto: 'Esta misión se hace con papá o mamá. Primero, conecten la compu a la tele (o al proyector) con el cable HDMI.', boton: 'Ya está conectado' },
      { texto: 'En la compu apretá juntas la tecla Windows (⊞) y la P. Aparece un menú: elegí «Duplicar», así se ve lo mismo en las dos pantallas. (En Linux está en Configuración → Pantallas.)', boton: 'Ya se ve en la tele' },
      { texto: 'Ahora presentá: apretá F5. Para pasar de diapositiva, la flecha → o un clic. Para terminar, Esc.', listo: (a) => a.hizo('presentar'), pista: 'F5 está en la fila de arriba de todo del teclado.' },
      { texto: '¡Como en el cine! Así se presentan los trabajos en el colegio. Al terminar, desenchufen el cable con cuidado.', boton: '¡Genial!' },
    ],
  },
]
