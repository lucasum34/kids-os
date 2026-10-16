// Cuaderno: procesador de texto, la idea de Word en chiquito.
// Enseña: escribir en una hoja, elegir texto y darle formato (negrita, tamaño,
// color, letra), alinear, listas, meter un dibujo, la rayita roja de ortografía,
// guardar, abrir e imprimir.

import { imprimir as imprimirVentana } from '../os/imprimir'
import * as fs from '../os/archivos'
import { pedirNombre, preguntarSiGuarda } from '../os/documento'
import { elegirArchivo } from '../os/selector'
import { imagenDeMisCosas, PROGRAMAS_CON_IMAGEN } from '../os/imagenes'
import { barraMenu, el } from '../os/ui'
import { copiarTexto, deOtro } from '../os/portapapeles'
import type { Programa } from '../os/ventanas'

const LETRAS = [
  { nombre: 'Nunito', css: 'Nunito, Arial, sans-serif' },
  { nombre: 'Arial', css: 'Arial, sans-serif' },
  { nombre: 'Times New Roman', css: '"Times New Roman", serif' },
  { nombre: 'Comic Sans MS', css: '"Comic Sans MS", cursive' },
  { nombre: 'Courier New', css: '"Courier New", monospace' },
]
const TAMANOS = [8, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72]
const COLORES = ['#000000', '#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#3949ab', '#8e24aa', '#ec407a', '#8d6e63', '#9e9e9e', '#ffffff']
const RESALTADOS = ['#fff59d', '#c5e1a5', '#b3e5fc', '#f8bbd0', '#ffe0b2', 'transparent']

interface Datos {
  html: string
}

/** Miniatura para Mis cosas: la parte de arriba de la hoja. */
function miniatura(html: string): string {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 560">' +
    '<rect width="800" height="560" fill="#fff"/>' +
    '<foreignObject x="0" y="0" width="800" height="560">' +
    `<div xmlns="http://www.w3.org/1999/xhtml" style="padding:60px 70px;font-family:Nunito,Arial,sans-serif;font-size:16pt;color:#000">${html}</div>` +
    '</foreignObject></svg>'
  )
}

export const cuaderno: Programa = {
  id: 'cuaderno',
  nombre: 'Cuaderno',
  icono: '📝',
  ancho: 1000,
  alto: 700,
  abrir(v, archivoId) {
    let archivo: fs.Archivo | null = null
    let cambios = false
    let rango: Range | null = null // última selección dentro de la hoja
    let tamano = 16 // tamaño pedido sin texto elegido: se aplica a lo próximo que se escriba
    let imagen: HTMLImageElement | null = null

    // ---------- Armado
    const raiz = el('div', 'cuaderno')
    const menu = barraMenu([
      {
        titulo: 'Archivo',
        items: [
          { texto: 'Nuevo', atajo: 'Ctrl+N', accion: () => nuevo() },
          { texto: 'Abrir…', atajo: 'Ctrl+O', accion: () => abrirOtro() },
          '-',
          { texto: 'Guardar', atajo: 'Ctrl+S', accion: () => guardar() },
          { texto: 'Guardar como…', accion: () => guardar(true) },
          '-',
          { texto: 'Imprimir…', atajo: 'Ctrl+P', accion: () => imprimir() },
          '-',
          { texto: 'Cerrar', accion: async () => (await puedeSeguir()) && v.cerrar() },
        ],
      },
      {
        titulo: 'Editar',
        items: [
          { texto: 'Deshacer', atajo: 'Ctrl+Z', accion: () => comando('undo') },
          { texto: 'Rehacer', atajo: 'Ctrl+Y', accion: () => comando('redo') },
          '-',
          { texto: 'Cortar', atajo: 'Ctrl+X', accion: () => comando('cut') },
          { texto: 'Copiar', atajo: 'Ctrl+C', accion: () => comando('copy') },
          { texto: 'Pegar', atajo: 'Ctrl+V', accion: () => pegar() },
          '-',
          { texto: 'Elegir todo', atajo: 'Ctrl+A', accion: () => comando('selectAll') },
        ],
      },
      {
        titulo: 'Insertar',
        items: [
          { texto: 'Una imagen de Mis cosas…', accion: () => insertarDibujo() },
          { texto: 'Una línea', accion: () => comando('insertHorizontalRule') },
        ],
      },
    ])

    const cinta = el('div', 'cd-cinta')
    const zona = el('div', 'cd-zona')
    const hoja = el('div', 'cd-hoja')
    hoja.contentEditable = 'true'
    hoja.spellcheck = true
    hoja.lang = 'es'
    zona.append(hoja)
    const estado = el('div', 'barra-estado')
    raiz.append(menu, cinta, zona, estado)
    v.cuerpo.append(raiz)

    // ---------- Selección: los botones no le roban la selección a la hoja
    document.addEventListener('selectionchange', alCambiarSeleccion)
    function alCambiarSeleccion() {
      const s = getSelection()
      if (s && s.rangeCount && hoja.contains(s.anchorNode)) {
        rango = s.getRangeAt(0).cloneRange()
        actualizarCinta()
      }
    }
    function recuperarSeleccion() {
      // Si la selección sigue en la hoja, esa manda; si no (la tomó un desplegable), se repone la última.
      const viva = getSelection()
      const enHoja = !!viva?.rangeCount && hoja.contains(viva.anchorNode)
      const guardado = enHoja ? viva!.getRangeAt(0).cloneRange() : rango
      hoja.focus()
      rango = guardado
      if (rango) {
        const s = getSelection()!
        s.removeAllRanges()
        s.addRange(rango)
      }
    }
    function comando(cmd: string, valor?: string, css = true) {
      recuperarSeleccion()
      document.execCommand('styleWithCSS', false, String(css))
      document.execCommand(cmd, false, valor)
      // El comando rearma el texto: se toma la selección nueva ya, sin esperar a selectionchange.
      const s = getSelection()
      if (s?.rangeCount && hoja.contains(s.anchorNode)) rango = s.getRangeAt(0).cloneRange()
      marcarCambio()
      actualizarCinta()
    }

    // ---------- Cinta de opciones (como la pestaña "Inicio" de Word)
    const grupo = (titulo: string, ...hijos: HTMLElement[]) => {
      const g = el('div', 'cd-grupo')
      const fila = el('div', 'cd-fila')
      fila.append(...hijos)
      g.append(fila, el('div', 'cd-grupo-titulo', titulo))
      return g
    }
    const boton = (contenido: string, titulo: string, accion: () => void, clase = '') => {
      const b = el('button', 'cd-boton ' + clase)
      b.innerHTML = contenido
      b.title = titulo
      b.onmousedown = (e) => e.preventDefault()
      b.onclick = accion
      return b
    }

    const selLetra = el('select', 'cd-select letra')
    for (const l of LETRAS) {
      const o = el('option', '', l.nombre)
      o.value = l.nombre
      o.style.fontFamily = l.css
      selLetra.append(o)
    }
    selLetra.onchange = () => comando('fontName', LETRAS.find((l) => l.nombre === selLetra.value)!.css)

    const selTamano = el('select', 'cd-select tamano')
    for (const t of TAMANOS) {
      const o = el('option', '', String(t))
      o.value = String(t)
      selTamano.append(o)
    }
    selTamano.onchange = () => ponerTamano(Number(selTamano.value))

    const bNegrita = boton('<b>N</b>', 'Negrita (Ctrl+B)', () => comando('bold'))
    const bCursiva = boton('<i>K</i>', 'Cursiva (Ctrl+I)', () => comando('italic'))
    const bSubrayado = boton('<u>S</u>', 'Subrayado (Ctrl+U)', () => comando('underline'))
    const bAchicar = boton('A<small>▾</small>', 'Achicar la letra', () => saltoTamano(-1))
    const bAgrandar = boton('A<small>▴</small>', 'Agrandar la letra', () => saltoTamano(1))

    const colores = (titulo: string, lista: string[], cmd: string, muestraTexto: string) => {
      const cont = el('div', 'cd-colores')
      cont.title = titulo
      cont.append(el('span', 'cd-colores-titulo', muestraTexto))
      for (const c of lista) {
        const m = el('span', 'cd-color' + (c === 'transparent' ? ' sin' : ''))
        m.style.background = c === 'transparent' ? '#fff' : c
        if (c === 'transparent') m.textContent = '✕'
        m.onmousedown = (e) => e.preventDefault()
        m.onclick = () => comando(cmd, c)
        cont.append(m)
      }
      return cont
    }

    const bIzq = boton('⫷', 'Alinear a la izquierda', () => comando('justifyLeft'))
    const bCentro = boton('☰', 'Centrar', () => comando('justifyCenter'))
    const bDer = boton('⫸', 'Alinear a la derecha', () => comando('justifyRight'))
    const bLista = boton('•≡', 'Lista con puntos', () => comando('insertUnorderedList'))
    const bNumeros = boton('1≡', 'Lista numerada', () => comando('insertOrderedList'))

    cinta.append(
      grupo('Archivo', boton('💾', 'Guardar (Ctrl+S)', () => guardar(), 'grande'), boton('🖨️', 'Imprimir (Ctrl+P)', () => imprimir(), 'grande')),
      grupo('Letra', selLetra, selTamano, bAchicar, bAgrandar, bNegrita, bCursiva, bSubrayado),
      grupo('Color', colores('Color de la letra', COLORES, 'foreColor', 'A'), colores('Resaltar (como un marcador)', RESALTADOS, 'hiliteColor', '🖍')),
      grupo('Párrafo', bIzq, bCentro, bDer, bLista, bNumeros),
      grupo('Insertar', boton('🖼️', 'Meter una imagen de Mis cosas', () => insertarDibujo(), 'grande')),
    )

    function actualizarCinta() {
      const prender = (b: HTMLElement, cmd: string) => b.classList.toggle('activo', document.queryCommandState(cmd))
      prender(bNegrita, 'bold')
      prender(bCursiva, 'italic')
      prender(bSubrayado, 'underline')
      prender(bIzq, 'justifyLeft')
      prender(bCentro, 'justifyCenter')
      prender(bDer, 'justifyRight')
      prender(bLista, 'insertUnorderedList')
      prender(bNumeros, 'insertOrderedList')
      // Letra y tamaño de donde está el cursor.
      const n = rango?.startContainer
      const e = n && (n.nodeType === 1 ? (n as Element) : n.parentElement)
      if (e && hoja.contains(e)) {
        const cs = getComputedStyle(e)
        const pt = Math.round(parseFloat(cs.fontSize) * 0.75)
        selTamano.value = String(TAMANOS.reduce((a, b) => (Math.abs(b - pt) < Math.abs(a - pt) ? b : a)))
        const fam = cs.fontFamily.toLowerCase()
        const l = LETRAS.find((x) => fam.includes(x.nombre.toLowerCase()))
        if (l) selLetra.value = l.nombre
      }
    }

    // execCommand('fontSize') solo sabe tamaños del 1 al 7: se marca con 7 y se cambia por el tamaño real.
    function ponerTamano(pt: number) {
      tamano = pt
      comando('fontSize', '7', false)
      convertirTamanos()
    }
    function convertirTamanos() {
      // Se cambia el atributo en el mismo elemento: reemplazarlo movería el cursor mientras se escribe.
      hoja.querySelectorAll<HTMLElement>('font[size="7"]').forEach((f) => {
        f.removeAttribute('size')
        f.style.fontSize = tamano + 'pt'
      })
    }
    function saltoTamano(d: number) {
      const i = TAMANOS.indexOf(Number(selTamano.value))
      ponerTamano(TAMANOS[Math.min(TAMANOS.length - 1, Math.max(0, i + d))])
    }

    // ---------- Escribir
    hoja.addEventListener('input', () => {
      convertirTamanos()
      marcarCambio()
    })
    hoja.addEventListener('keydown', (e) => {
      const ctrl = e.ctrlKey || e.metaKey
      if (!ctrl) return
      const k = e.key.toLowerCase()
      if (k === 's') guardar()
      else if (k === 'o') abrirOtro()
      else if (k === 'n') nuevo()
      else if (k === 'p') imprimir()
      else return // Ctrl+B/I/U/Z/Y/C/V/X/A los hace la hoja sola
      e.preventDefault()
    })
    // Al pegar desde afuera, solo el texto (que no se metan estilos raros de otras páginas).
    hoja.addEventListener('copy', () => copiarTexto(getSelection()?.toString() ?? '', 'cuaderno'))
    hoja.addEventListener('cut', () => copiarTexto(getSelection()?.toString() ?? '', 'cuaderno'))
    hoja.addEventListener('paste', (e) => {
      // Un dibujo o una foto copiados en otro programa entran como imagen.
      const otro = deOtro('cuaderno')
      if (otro?.tipo === 'imagen') {
        e.preventDefault()
        document.execCommand('insertHTML', false, `<img src="${otro.url}" alt="Imagen pegada" style="width:320px">&nbsp;`)
        return
      }
      const t = e.clipboardData?.getData('text/plain')
      if (t === undefined) return
      e.preventDefault()
      document.execCommand('insertText', false, t)
    })
    async function pegar() {
      const otro = deOtro('cuaderno')
      if (otro?.tipo === 'imagen') return comando('insertHTML', `<img src="${otro.url}" alt="Imagen pegada" style="width:320px">&nbsp;`)
      if (otro?.tipo === 'texto') return comando('insertText', otro.texto)
      try {
        const t = await navigator.clipboard.readText()
        comando('insertText', t)
      } catch {
        estado.textContent = 'Para pegar, usá Ctrl+V.'
      }
    }

    // ---------- Dibujos
    async function insertarDibujo() {
      const r = rango?.cloneRange()
      const id = await elegirArchivo(PROGRAMAS_CON_IMAGEN, 'Elegí una imagen')
      if (!id) return
      const a = fs.buscar(id)
      if (!a) return
      rango = r ?? null
      const src = await imagenDeMisCosas(id)
      if (!src) return
      comando('insertHTML', `<img src="${src}" alt="${a.nombre.replace(/"/g, '')}" style="width:320px">&nbsp;`)
    }

    const barraImg = el('div', 'cd-img-barra')
    const tamanoImg = (d: number) => {
      if (!imagen) return
      const w = Math.min(640, Math.max(80, imagen.offsetWidth + d))
      imagen.style.width = w + 'px'
      marcarCambio()
      ubicarBarraImg()
    }
    barraImg.append(
      boton('➖', 'Achicar el dibujo', () => tamanoImg(-60)),
      boton('➕', 'Agrandar el dibujo', () => tamanoImg(60)),
      boton('🗑', 'Sacar el dibujo', () => {
        imagen?.remove()
        soltarImagen()
        marcarCambio()
      }),
    )
    zona.append(barraImg)
    function ubicarBarraImg() {
      if (!imagen) return
      barraImg.style.display = 'flex'
      barraImg.style.left = imagen.offsetLeft + hoja.offsetLeft + 'px'
      barraImg.style.top = imagen.offsetTop + hoja.offsetTop - 44 + 'px'
    }
    function soltarImagen() {
      imagen?.classList.remove('elegida')
      imagen = null
      barraImg.style.display = 'none'
    }
    hoja.addEventListener('click', (e) => {
      const t = e.target as HTMLElement
      if (t.tagName === 'IMG') {
        soltarImagen()
        imagen = t as HTMLImageElement
        imagen.classList.add('elegida')
        ubicarBarraImg()
      } else soltarImagen()
    })

    // ---------- Estado
    function marcarCambio() {
      if (!cambios) {
        cambios = true
        ponerTitulo()
      }
      contar()
    }
    function contar() {
      const palabras = (hoja.innerText.match(/[\p{L}\p{N}]+/gu) ?? []).length
      estado.textContent = `Palabras: ${palabras}`
    }
    function ponerTitulo() {
      v.ponerTitulo(`${cambios ? '● ' : ''}${archivo?.nombre ?? 'Sin nombre'} — Cuaderno`)
    }

    // ---------- Archivo
    async function guardar(como = false): Promise<boolean> {
      let nombre = archivo?.nombre
      if (!archivo || como) {
        const sugerido = archivo ? archivo.nombre + ' (copia)' : fs.nombreLibre('Escrito', 'cuaderno')
        const n = await pedirNombre('cuaderno', sugerido, '¿Cómo se va a llamar lo que escribiste?')
        if (!n) return false
        nombre = n
        archivo = null
      }
      soltarImagen()
      const html = hoja.innerHTML
      archivo = fs.guardar({ id: archivo?.id ?? fs.nuevoId(), nombre: nombre!, app: 'cuaderno', miniatura: miniatura(html) }, { html } as Datos)
      cambios = false
      ponerTitulo()
      return true
    }

    async function puedeSeguir(): Promise<boolean> {
      if (!cambios || !hoja.innerText.trim()) return true
      const r = await preguntarSiGuarda('Cuaderno', archivo?.nombre ?? 'Sin nombre')
      if (r === 'cancelar') return false
      if (r === 'si') return guardar()
      return true
    }

    function cargar(id: string) {
      const a = fs.buscar(id)
      const d = fs.leer(id) as Datos | null
      if (!a || !d) return
      archivo = a
      hoja.innerHTML = d.html
      cambios = false
      soltarImagen()
      ponerTitulo()
      contar()
    }

    async function nuevo() {
      if (!(await puedeSeguir())) return
      archivo = null
      hoja.innerHTML = '<p><br></p>'
      cambios = false
      soltarImagen()
      ponerTitulo()
      contar()
      hoja.focus()
    }

    async function abrirOtro() {
      if (!(await puedeSeguir())) return
      const id = await elegirArchivo('cuaderno', 'Abrir un escrito')
      if (id) cargar(id)
    }

    let imprimio = false
    function imprimir() {
      soltarImagen()
      imprimirVentana({
        titulo: archivo?.nombre ?? 'Sin nombre',
        paginas: [{ tipo: 'html', contenido: `<div style="padding:60px 70px;font-family:Nunito,Arial,sans-serif;font-size:16pt;line-height:1.35">${hoja.innerHTML}</div>` }],
      }).then((ok) => ok && (imprimio = true))
    }

    // ---------- Arranque
    hoja.innerHTML = '<p><br></p>'
    document.execCommand('defaultParagraphSeparator', false, 'p')
    if (archivoId) cargar(archivoId)
    ponerTitulo()
    contar()
    setTimeout(() => hoja.focus(), 0)

    return {
      alTecla(e) {
        if (!(e.ctrlKey || e.metaKey)) return false
        const k = e.key.toLowerCase()
        if (k === 's') guardar()
        else if (k === 'o') abrirOtro()
        else if (k === 'n') nuevo()
        else if (k === 'p') imprimir()
        else return false
        return true
      },
      // Para el guía de las misiones.
      api: {
        texto: () => hoja.innerText,
        renglones: () => hoja.innerText.split('\n').filter((l) => l.trim()).length,
        hay: (selector: string) => !!hoja.querySelector(selector),
        cuantos: (selector: string) => [...hoja.querySelectorAll(selector)].filter((e) => (e.textContent ?? '').trim()).length,
        negrita: () => !!hoja.querySelector('b, strong, [style*="font-weight: bold"], [style*="font-weight: 700"]'),
        /** El tamaño de letra más grande que hay (en pt). */
        tamanoMayor: () => Math.max(16, ...[...hoja.querySelectorAll<HTMLElement>('[style*="font-size"]')].filter((e) => (e.textContent ?? '').trim()).map((e) => parseFloat(e.style.fontSize) || 0)),
        colorDeLetra: () => [...hoja.querySelectorAll<HTMLElement>('[style*="color"], font[color]')].some((e) => (e.textContent ?? '').trim() && !/^(rgb\(0, 0, 0\)|#000000|black)$/.test(e.style.color || e.getAttribute('color') || '')),
        centrado: () => !!hoja.querySelector('[style*="text-align: center"]'),
        elegido: () => {
          const s = getSelection()
          return !!s && s.rangeCount > 0 && hoja.contains(s.anchorNode) && s.toString().trim().length > 0
        },
        imprimio: () => imprimio,
        cargar: (html: string) => {
          archivo = null
          hoja.innerHTML = html
          cambios = false
          ponerTitulo()
          contar()
          setTimeout(() => hoja.focus(), 0)
        },
        guardarComo: (n0: string) => {
          let n = n0
          for (let i = 2; fs.existeNombre(n, 'cuaderno'); i++) n = `${n0} ${i}`
          soltarImagen()
          archivo = fs.guardar({ id: fs.nuevoId(), nombre: n, app: 'cuaderno', miniatura: miniatura(hoja.innerHTML) }, { html: hoja.innerHTML } as Datos)
          cambios = false
          ponerTitulo()
          return n
        },
      },
      async alCerrar() {
        const ok = await puedeSeguir()
        if (ok) document.removeEventListener('selectionchange', alCambiarSeleccion)
        return ok
      },
    }
  },
}
