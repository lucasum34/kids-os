// Mis cosas: el explorador de archivos, como el de Windows.
// Enseña: carpetas (crear, entrar, volver), elegir y abrir con doble clic, cambiar el nombre (F2),
// arrastrar a una carpeta, cortar / copiar / pegar (Ctrl+X, C, V), la papelera,
// y el pendrive: copiar de y hacia él, y quitarlo de forma segura.

import * as fs from '../os/archivos'
import { abrirPrograma, programa } from '../os/sistema'
import { miniatura } from '../os/selector'
import { sonar } from '../os/sonido'
import { dialogo, el, fechaCorta, menuContextual, type ItemContextual } from '../os/ui'
import type { Programa } from '../os/ventanas'

type Item = { tipo: 'archivo' | 'carpeta'; id: string }
const PAPELERA = '::papelera'
const clave = (i: Item) => `${i.tipo}:${i.id}`

/** Portapapeles de archivos (compartido entre ventanas de Mis cosas, como en Windows). */
let portapapeles: { items: Item[]; cortar: boolean } | null = null

export const misCosas: Programa = {
  id: 'mis-cosas',
  nombre: 'Mis cosas',
  icono: '📁',
  ancho: 820,
  alto: 540,
  abrir(v) {
    let lugar: string = fs.RAIZ // carpeta actual, o PAPELERA
    let elegidos: Item[] = []
    const historia: string[] = []
    let renombrando: Item | null = null

    const raiz = el('div', 'explorador')
    const lado = el('div', 'explorador-lado')
    const principal = el('div', 'explorador-principal')
    const barra = el('div', 'ex-barra')
    const grilla = el('div', 'grilla-archivos')
    const estado = el('div', 'barra-estado')
    principal.append(barra, grilla, estado)
    raiz.append(lado, principal)
    v.cuerpo.append(raiz)

    const enPapelera = () => lugar === PAPELERA
    const esElegido = (i: Item) => elegidos.some((x) => clave(x) === clave(i))

    function ir(a: string, guardarHistoria = true) {
      if (a === lugar) return
      if (guardarHistoria) historia.push(lugar)
      lugar = a
      elegidos = []
      dibujar()
    }
    function subir() {
      if (enPapelera() || lugar === fs.RAIZ || lugar === fs.PENDRIVE) return
      ir(fs.buscarCarpeta(lugar)?.padre ?? fs.RAIZ)
    }
    function atras() {
      const a = historia.pop()
      if (a !== undefined) ir(a, false)
    }

    function abrir(i: Item) {
      if (enPapelera()) return
      if (i.tipo === 'carpeta') return ir(i.id)
      const a = fs.buscar(i.id)
      if (a) abrirPrograma(a.app, a.id)
    }

    // ---------- Acciones
    function nuevaCarpeta() {
      if (enPapelera()) return
      const c = fs.crearCarpeta(fs.nombreCarpetaLibre(lugar), lugar)
      elegidos = [{ tipo: 'carpeta', id: c.id }]
      renombrando = elegidos[0] // como Windows: se escribe el nombre enseguida
      dibujar()
    }

    async function borrar(items: Item[]) {
      if (!items.length) return
      if (!enPapelera()) {
        // En el pendrive no hay papelera: se borra para siempre (como en Windows).
        if (fs.unidad(lugar) === fs.PENDRIVE) {
          const r = await dialogo({
            titulo: 'Borrar',
            icono: '⚠️',
            mensaje: 'En el pendrive no hay papelera: se va a borrar para siempre. ¿Seguro?',
            botones: [
              { texto: 'Borrar', valor: 'si' },
              { texto: 'Cancelar', valor: 'no', principal: true },
            ],
          })
          if (r.boton !== 'si') return
          items.forEach((i) => (i.tipo === 'archivo' ? fs.borrarDefinitivo(i.id) : fs.borrarCarpetaDefinitivo(i.id)))
        } else items.forEach((i) => (i.tipo === 'archivo' ? fs.aPapelera(i.id) : fs.carpetaAPapelera(i.id)))
        elegidos = []
        return
      }
      const r = await dialogo({
        titulo: 'Borrar para siempre',
        icono: '🗑️',
        mensaje: items.length === 1 ? `"${nombreDe(items[0])}" se va a borrar para siempre. No se puede recuperar.` : `${items.length} cosas se van a borrar para siempre.`,
        botones: [
          { texto: 'Borrar', valor: 'si' },
          { texto: 'Cancelar', valor: 'no', principal: true },
        ],
      })
      if (r.boton === 'si') items.forEach((i) => (i.tipo === 'archivo' ? fs.borrarDefinitivo(i.id) : fs.borrarCarpetaDefinitivo(i.id)))
      elegidos = []
    }
    function recuperar(items: Item[]) {
      items.forEach((i) => (i.tipo === 'archivo' ? fs.aPapelera(i.id, false) : fs.carpetaAPapelera(i.id, false)))
      elegidos = []
    }

    function cortarOCopiar(cortar: boolean) {
      if (!elegidos.length || enPapelera()) return
      portapapeles = { items: [...elegidos], cortar }
      estado.textContent = `${cortar ? 'Cortado' : 'Copiado'}. Andá a otra carpeta y apretá Ctrl+V para pegar.`
      dibujar()
    }
    function pegar(destino = lugar) {
      if (!portapapeles || destino === PAPELERA) return
      const { items, cortar } = portapapeles
      let ok = 0
      for (const i of items) ok += Number(cortar ? fs.mover(i.tipo, i.id, destino) : fs.copiar(i.tipo, i.id, destino))
      if (cortar) portapapeles = null
      if (ok) sonar('abrir')
      else estado.textContent = 'No se puede poner una carpeta adentro de sí misma.'
    }
    /** Soltar algo arrastrado: en el mismo disco se mueve; entre Mis cosas y el pendrive se copia (como Windows). */
    function soltar(items: Item[], destino: string) {
      if (destino === PAPELERA) return borrar(items)
      const mismoDisco = items.every((i) => fs.unidad(origenDe(i)) === fs.unidad(destino))
      let ok = 0
      for (const i of items) ok += Number(mismoDisco ? fs.mover(i.tipo, i.id, destino) : fs.copiar(i.tipo, i.id, destino))
      if (ok) sonar('abrir')
    }
    const origenDe = (i: Item) => (i.tipo === 'archivo' ? fs.buscar(i.id)?.carpeta ?? fs.RAIZ : fs.buscarCarpeta(i.id)?.padre ?? fs.RAIZ)
    const nombreDe = (i: Item) => (i.tipo === 'archivo' ? fs.buscar(i.id)?.nombre : fs.buscarCarpeta(i.id)?.nombre) ?? ''

    function quitarPendrive() {
      if (fs.unidad(lugar) === fs.PENDRIVE) ir(fs.RAIZ)
      fs.enchufarPendrive(false)
      document.dispatchEvent(new CustomEvent('kidsos-aviso', { detail: { icono: '🔌', texto: 'Ya podés sacar el pendrive de la compu.' } }))
    }

    // ---------- Cambiar el nombre (F2)
    function renombrar(i: Item) {
      const tarjeta = grilla.querySelector(`[data-clave="${clave(i)}"] .archivo-nombre`) as HTMLElement | null
      if (!tarjeta) return
      const input = el('input', 'campo renombrar')
      input.value = nombreDe(i)
      tarjeta.replaceWith(input)
      input.focus()
      input.select()
      let listo = false
      const terminar = async (aceptar: boolean) => {
        if (listo) return
        listo = true
        renombrando = null
        const nombre = input.value.trim()
        if (aceptar && nombre && nombre !== nombreDe(i)) {
          if (/[\\/:*?"<>|]/.test(nombre)) {
            await dialogo({ titulo: 'Cambiar nombre', icono: '⚠️', mensaje: 'Un nombre no puede tener estos signos: \\ / : * ? " < > |', botones: [{ texto: 'Aceptar', valor: 'ok', principal: true }] })
          } else if (i.tipo === 'archivo') {
            const a = fs.buscar(i.id)!
            if (fs.existeNombre(nombre, a.app, a.id, a.carpeta ?? fs.RAIZ)) await dialogo({ titulo: 'Cambiar nombre', icono: '⚠️', mensaje: `Ya hay otro que se llama "${nombre}" acá.`, botones: [{ texto: 'Aceptar', valor: 'ok', principal: true }] })
            else fs.renombrar(i.id, nombre)
          } else fs.renombrarCarpeta(i.id, nombre)
        }
        dibujar()
      }
      input.onkeydown = (e) => {
        e.stopPropagation()
        if (e.key === 'Enter') terminar(true)
        if (e.key === 'Escape') terminar(false)
      }
      input.onblur = () => terminar(true)
    }

    // ---------- Menús del clic derecho
    function menuDeItem(e: MouseEvent, i: Item) {
      if (!esElegido(i)) elegidos = [i]
      dibujar()
      const items: ItemContextual[] = enPapelera()
        ? [
            { texto: 'Recuperar', accion: () => recuperar(elegidos) },
            { texto: 'Borrar para siempre', atajo: 'Supr', accion: () => borrar(elegidos) },
          ]
        : [
            { texto: 'Abrir', negrita: true, atajo: 'Enter', accion: () => abrir(i) },
            '-',
            { texto: 'Cortar', atajo: 'Ctrl+X', accion: () => cortarOCopiar(true) },
            { texto: 'Copiar', atajo: 'Ctrl+C', accion: () => cortarOCopiar(false) },
            ...(i.tipo === 'carpeta' && portapapeles ? [{ texto: 'Pegar adentro', atajo: '', accion: () => pegar(i.id) }] : []),
            '-',
            ...(fs.pendriveConectado() && fs.unidad(lugar) !== fs.PENDRIVE ? [{ texto: 'Enviar a ▸ PENDRIVE (E:)', accion: () => elegidos.forEach((x) => fs.copiar(x.tipo, x.id, fs.PENDRIVE)) }, '-' as const] : []),
            { texto: 'Cambiar nombre', atajo: 'F2', accion: () => renombrar(i), activo: elegidos.length === 1 },
            { texto: fs.unidad(lugar) === fs.PENDRIVE ? 'Borrar' : 'Mandar a la papelera', atajo: 'Supr', accion: () => borrar(elegidos) },
          ]
      menuContextual(e.clientX, e.clientY, items)
    }
    function menuDelFondo(e: MouseEvent) {
      elegidos = []
      dibujar()
      if (enPapelera()) {
        menuContextual(e.clientX, e.clientY, [{ texto: 'Vaciar la papelera', accion: () => vaciarPapelera() }])
        return
      }
      menuContextual(e.clientX, e.clientY, [
        { texto: 'Nueva carpeta', atajo: 'Ctrl+Mayús+N', accion: () => nuevaCarpeta() },
        { texto: 'Pegar', atajo: 'Ctrl+V', accion: () => pegar(), activo: !!portapapeles },
      ])
    }
    async function vaciarPapelera() {
      const r = await dialogo({
        titulo: 'Vaciar la papelera',
        icono: '🗑️',
        mensaje: 'Todo lo que está en la papelera se va a borrar para siempre.',
        botones: [
          { texto: 'Vaciar', valor: 'si' },
          { texto: 'Cancelar', valor: 'no', principal: true },
        ],
      })
      if (r.boton !== 'si') return
      fs.carpetas().filter((c) => c.enPapelera).forEach((c) => fs.borrarCarpetaDefinitivo(c.id))
      fs.listar().filter((a) => a.enPapelera).forEach((a) => fs.borrarDefinitivo(a.id))
    }

    // ---------- Arrastrar
    function empezarArrastre(e: PointerEvent, i: Item, tarjeta: HTMLElement) {
      if (e.button !== 0) return
      const x0 = e.clientX
      const y0 = e.clientY
      let fantasma: HTMLElement | null = null
      let destino: string | null = null
      const items = esElegido(i) ? [...elegidos] : [i]
      const mov = (m: PointerEvent) => {
        if (!fantasma) {
          if (Math.hypot(m.clientX - x0, m.clientY - y0) < 6) return
          fantasma = el('div', 'ex-fantasma')
          document.body.append(fantasma)
        }
        fantasma.style.left = m.clientX + 14 + 'px'
        fantasma.style.top = m.clientY + 10 + 'px'
        // ¿Sobre qué se suelta? una carpeta, un lugar de la izquierda o una parte del camino de arriba.
        document.querySelectorAll('.ex-destino').forEach((x) => x.classList.remove('ex-destino'))
        const debajo = (document.elementFromPoint(m.clientX, m.clientY) as HTMLElement | null)?.closest('[data-destino]') as HTMLElement | null
        destino = debajo && debajo !== tarjeta && !items.some((x) => x.tipo === 'carpeta' && x.id === debajo.dataset.destino) ? debajo.dataset.destino! : null
        if (destino === lugar) destino = null
        debajo?.classList.toggle('ex-destino', destino !== null)
        const copia = destino !== null && destino !== PAPELERA && items.some((x) => fs.unidad(origenDe(x)) !== fs.unidad(destino!))
        fantasma.textContent = destino === null ? `${items.length === 1 ? '📄' : '📚'} ${items.length === 1 ? nombreDe(items[0]) : items.length + ' cosas'}` : destino === PAPELERA ? '🗑️ Mandar a la papelera' : `${copia ? '➕ Copiar' : '➜ Mover'} a ${destinoNombre(destino)}`
      }
      const fin = () => {
        document.removeEventListener('pointermove', mov)
        document.removeEventListener('pointerup', fin)
        document.querySelectorAll('.ex-destino').forEach((x) => x.classList.remove('ex-destino'))
        fantasma?.remove()
        if (fantasma && destino !== null) soltar(items, destino)
      }
      document.addEventListener('pointermove', mov)
      document.addEventListener('pointerup', fin)
    }
    const destinoNombre = (d: string) => (d === fs.RAIZ ? 'Mis cosas' : d === fs.PENDRIVE ? 'PENDRIVE' : fs.buscarCarpeta(d)?.nombre ?? '')

    // ---------- Dibujar
    function dibujar() {
      // Si la carpeta en la que estaba ya no existe (o sacaron el pendrive), vuelve a Mis cosas.
      if (!enPapelera() && lugar !== fs.RAIZ && (lugar === fs.PENDRIVE ? !fs.pendriveConectado() : !fs.buscarCarpeta(lugar) || fs.buscarCarpeta(lugar)!.enPapelera || (fs.unidad(lugar) === fs.PENDRIVE && !fs.pendriveConectado())))
        lugar = fs.RAIZ

      // Izquierda: los lugares.
      lado.replaceChildren()
      const sitio = (id: string, texto: string, extra?: HTMLElement) => {
        const b = el('div', 'lugar' + (lugar === id || (id !== PAPELERA && !enPapelera() && fs.unidad(lugar) === id && id === fs.PENDRIVE) ? ' activo' : ''))
        b.append(el('span', '', texto))
        if (extra) b.append(extra)
        b.dataset.destino = id
        b.onclick = () => ir(id)
        lado.append(b)
      }
      sitio(fs.RAIZ, '📁 Mis cosas')
      sitio(PAPELERA, '🗑️ Papelera')
      if (fs.pendriveConectado()) {
        lado.append(el('div', 'lugar-titulo', 'Dispositivos'))
        const expulsar = el('button', 'ex-expulsar', '⏏')
        expulsar.title = 'Quitar de forma segura'
        expulsar.onclick = (e) => {
          e.stopPropagation()
          quitarPendrive()
        }
        sitio(fs.PENDRIVE, '🔌 PENDRIVE (E:)', expulsar)
      }

      // Arriba: volver, subir, el camino, y los botones.
      barra.replaceChildren()
      const bAtras = el('button', 'ex-nav', '←')
      bAtras.title = 'Atrás (Alt+←)'
      bAtras.disabled = !historia.length
      bAtras.onclick = atras
      const bSubir = el('button', 'ex-nav', '↑')
      bSubir.title = 'Subir una carpeta (Retroceso)'
      bSubir.disabled = enPapelera() || lugar === fs.RAIZ || lugar === fs.PENDRIVE
      bSubir.onclick = subir
      const ruta = el('div', 'ex-ruta')
      if (enPapelera()) ruta.append(el('span', 'ex-tramo', '🗑️ Papelera'))
      else
        fs.camino(lugar).forEach((t, k, todos) => {
          if (k) ruta.append(el('span', 'ex-flecha', '›'))
          const s = el('span', 'ex-tramo', t.nombre)
          s.dataset.destino = t.id
          if (k < todos.length - 1) s.onclick = () => ir(t.id)
          ruta.append(s)
        })
      barra.append(bAtras, bSubir, ruta)
      const boton = (t: string, titulo: string, f: () => void, activo = true) => {
        const b = el('button', 'ex-boton', t)
        b.title = titulo
        b.disabled = !activo
        b.onmousedown = (e) => e.preventDefault()
        b.onclick = f
        barra.append(b)
      }
      if (enPapelera()) {
        boton('↩ Recuperar', 'Volver a poner donde estaba', () => recuperar(elegidos), elegidos.length > 0)
        boton('Vaciar la papelera', 'Borrar todo para siempre', vaciarPapelera)
      } else {
        boton('📁 Nueva carpeta', 'Nueva carpeta (Ctrl+Mayús+N)', nuevaCarpeta)
        boton('✂', 'Cortar (Ctrl+X)', () => cortarOCopiar(true), elegidos.length > 0)
        boton('⧉', 'Copiar (Ctrl+C)', () => cortarOCopiar(false), elegidos.length > 0)
        boton('📋', 'Pegar (Ctrl+V)', () => pegar(), !!portapapeles)
      }

      // El contenido: primero las carpetas, después los archivos.
      let carpetas: fs.Carpeta[]
      let archivos: fs.Archivo[]
      if (enPapelera()) {
        carpetas = fs.carpetas().filter((c) => c.enPapelera)
        archivos = fs.listar().filter((a) => a.enPapelera)
      } else ({ carpetas, archivos } = fs.contenido(lugar))
      carpetas.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      archivos.sort((a, b) => b.modificado - a.modificado)

      grilla.replaceChildren()
      if (!carpetas.length && !archivos.length)
        grilla.append(el('div', 'vacio', enPapelera() ? 'La papelera está vacía.' : lugar === fs.RAIZ ? 'Todavía no guardaste nada.' : 'Esta carpeta está vacía.'))
      const tarjeta = (i: Item, dibujo: HTMLElement, nombre: string, abajo: string) => {
        const t = el('div', 'archivo' + (esElegido(i) ? ' elegido' : '') + (portapapeles?.cortar && portapapeles.items.some((x) => clave(x) === clave(i)) ? ' cortado' : ''))
        t.dataset.clave = clave(i)
        if (i.tipo === 'carpeta' && !enPapelera()) t.dataset.destino = i.id
        t.append(dibujo, el('div', 'archivo-nombre', nombre), el('div', 'archivo-fecha', abajo))
        t.onpointerdown = (e) => {
          if (e.button === 2) return
          if (e.ctrlKey) elegidos = esElegido(i) ? elegidos.filter((x) => clave(x) !== clave(i)) : [...elegidos, i]
          else if (!esElegido(i)) elegidos = [i]
          grilla.querySelectorAll('.archivo').forEach((x) => x.classList.toggle('elegido', elegidos.some((y) => clave(y) === (x as HTMLElement).dataset.clave)))
          ponerEstado()
          if (!enPapelera()) empezarArrastre(e, i, t)
        }
        t.ondblclick = () => abrir(i)
        t.oncontextmenu = (e) => {
          e.preventDefault()
          e.stopPropagation()
          menuDeItem(e, i)
        }
        grilla.append(t)
      }
      for (const c of carpetas) {
        const d = el('div', 'mini carpeta', '📁')
        const n = fs.contenido(c.id)
        tarjeta({ tipo: 'carpeta', id: c.id }, d, c.nombre, `${n.carpetas.length + n.archivos.length} cosas`)
      }
      for (const a of archivos) {
        const m = miniatura(a.miniatura)
        m.append(el('span', 'mini-app', programa(a.app)?.icono ?? '📄'))
        tarjeta({ tipo: 'archivo', id: a.id }, m, a.nombre, fechaCorta(a.modificado))
      }
      ponerEstado()
      if (renombrando) {
        const r = renombrando
        setTimeout(() => renombrar(r), 0)
      }
      v.ponerTitulo(enPapelera() ? 'Papelera' : fs.camino(lugar).at(-1)!.nombre)

      function ponerEstado() {
        const n = carpetas.length + archivos.length
        if (elegidos.length === 1) {
          const i = elegidos[0]
          estado.textContent = i.tipo === 'carpeta' ? `Carpeta «${nombreDe(i)}»` : `${nombreDe(i)} — ${programa(fs.buscar(i.id)?.app ?? '')?.nombre ?? ''} — guardado ${fechaCorta(fs.buscar(i.id)?.modificado ?? 0)}`
        } else if (elegidos.length > 1) estado.textContent = `${elegidos.length} elegidas`
        else estado.textContent = `${n} ${n === 1 ? 'cosa' : 'cosas'}   ·   Doble clic para abrir · Clic derecho para más opciones`
      }
    }

    grilla.addEventListener('pointerdown', (e) => {
      if (e.target === grilla && e.button === 0) {
        elegidos = []
        dibujar()
      }
    })
    grilla.addEventListener('contextmenu', (e) => {
      if (e.target !== grilla && !(e.target as HTMLElement).classList.contains('vacio')) return
      e.preventDefault()
      menuDelFondo(e)
    })

    const dejar = fs.alCambiar(dibujar)
    dibujar()

    return {
      alTecla(e) {
        const ctrl = e.ctrlKey || e.metaKey
        const k = e.key.toLowerCase()
        if (ctrl && e.shiftKey && k === 'n') nuevaCarpeta()
        else if (ctrl && k === 'x') cortarOCopiar(true)
        else if (ctrl && k === 'c') cortarOCopiar(false)
        else if (ctrl && k === 'v') pegar()
        else if (ctrl && k === 'a') {
          const { carpetas, archivos } = enPapelera() ? { carpetas: fs.carpetas().filter((c) => c.enPapelera), archivos: fs.listar().filter((a) => a.enPapelera) } : fs.contenido(lugar)
          elegidos = [...carpetas.map((c) => ({ tipo: 'carpeta' as const, id: c.id })), ...archivos.map((a) => ({ tipo: 'archivo' as const, id: a.id }))]
          dibujar()
        } else if (e.altKey && e.key === 'ArrowLeft') atras()
        else if (e.key === 'Backspace') subir()
        else if (e.key === 'Enter' && elegidos.length === 1) abrir(elegidos[0])
        else if (e.key === 'F2' && elegidos.length === 1 && !enPapelera()) renombrar(elegidos[0])
        else if (e.key === 'Delete' && elegidos.length) borrar([...elegidos])
        else return false
        return true
      },
      async alCerrar() {
        dejar()
        return true
      },
      // Para el guía de las misiones.
      api: {
        lugar: () => lugar,
        ir: (a: string) => ir(a),
        elegidos: () => elegidos.length,
        portapapeles: () => portapapeles,
      },
    }
  },
}
