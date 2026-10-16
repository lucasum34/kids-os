// Tienda: instalar y desinstalar programas, como la Microsoft Store o el centro de software de Linux.
// Enseña: los programas se instalan (y se desinstalan), tardan un rato en bajarse,
// y para instalar hace falta el permiso de un adulto.

import { pedirClave } from '../os/papa'
import { avisoSistema } from '../os/escritorio'
import { abrirPrograma, alCambiarProgramas, esDelSistema, estaInstalado, ponerInstalado, todosLosProgramas } from '../os/sistema'
import { sonar } from '../os/sonido'
import { dialogo, el } from '../os/ui'
import type { Programa } from '../os/ventanas'

/** Lo que cuenta la Tienda de cada programa. */
const FICHAS: Record<string, { texto: string; categoria: string; tamano: number; estrellas: number }> = {
  pincel: { texto: 'Para pintar con pinceles, aerosol, formas y el balde.', categoria: 'Dibujo', tamano: 18, estrellas: 5 },
  trazos: { texto: 'Dibujo con figuras que se mueven y se agrandan.', categoria: 'Dibujo', tamano: 22, estrellas: 4 },
  foto: { texto: 'Editar fotos con capas y efectos.', categoria: 'Dibujo', tamano: 64, estrellas: 5 },
  cuaderno: { texto: 'Escribir cartas, cuentos y trabajos para el colegio.', categoria: 'Oficina', tamano: 35, estrellas: 5 },
  tablero: { texto: 'Tablas, cuentas que se hacen solas y gráficos.', categoria: 'Oficina', tamano: 40, estrellas: 4 },
  diapositivas: { texto: 'Presentaciones para mostrar en la tele o en el colegio.', categoria: 'Oficina', tamano: 45, estrellas: 5 },
  regla: { texto: 'Planos con medidas de verdad, como los arquitectos.', categoria: 'Diseño', tamano: 80, estrellas: 5 },
  construir: { texto: 'Construir en 3D: casas, muebles, lo que quieras.', categoria: 'Diseño', tamano: 120, estrellas: 5 },
  pelicula: { texto: 'Hacer películas con fotos, videos, títulos y música.', categoria: 'Video', tamano: 150, estrellas: 4 },
  animar: { texto: 'Animar cosas que se mueven, giran y aparecen.', categoria: 'Video', tamano: 90, estrellas: 4 },
  robotito: { texto: 'Aprender a programar con bloques.', categoria: 'Aprender', tamano: 25, estrellas: 5 },
  teclado: { texto: 'Aprender a escribir con los diez dedos.', categoria: 'Aprender', tamano: 12, estrellas: 4 },
  calculadora: { texto: 'Hacer cuentas.', categoria: 'Herramientas', tamano: 5, estrellas: 4 },
  buscaminas: { texto: 'El clásico: encontrá las minas sin pisarlas.', categoria: 'Juegos', tamano: 8, estrellas: 5 },
  solitario: { texto: 'El juego de cartas de siempre.', categoria: 'Juegos', tamano: 10, estrellas: 5 },
}
const CATEGORIAS = ['Todos', 'Juegos', 'Dibujo', 'Oficina', 'Diseño', 'Video', 'Aprender', 'Herramientas']

const permiso = (accion: string) => pedirClave(`Para ${accion} hace falta permiso.`)

export const tienda: Programa = {
  id: 'tienda',
  nombre: 'Tienda',
  icono: '🛍️',
  ancho: 960,
  alto: 640,
  abrir(win) {
    let categoria = 'Todos'
    let ficha: string | null = null
    const instalando = new Map<string, number>() // id → porcentaje
    const raiz = el('div', 'tienda')
    win.cuerpo.append(raiz)

    const progs = () => todosLosProgramas().filter((p) => !esDelSistema(p.id) && FICHAS[p.id])

    async function instalarProg(p: Programa) {
      if (!(await permiso(`instalar ${p.nombre}`))) return
      const f = FICHAS[p.id]
      // Primero se baja, después se instala (como de verdad, pero rapidito).
      instalando.set(p.id, 0)
      dibujar()
      const total = 1800 + f.tamano * 15
      const inicio = performance.now()
      await new Promise<void>((listo) => {
        const paso = () => {
          const t = Math.min(1, (performance.now() - inicio) / total)
          instalando.set(p.id, t)
          dibujarProgreso(p.id)
          if (t < 1) requestAnimationFrame(paso)
          else listo()
        }
        requestAnimationFrame(paso)
      })
      instalando.delete(p.id)
      ponerInstalado(p.id, true)
      sonar('bien')
      avisoSistema(p.icono, `Se instaló ${p.nombre}. Lo encontrás en el escritorio y en el menú de inicio.`, () => abrirPrograma(p.id))
    }
    async function desinstalarProg(p: Programa) {
      const r = await dialogo({
        titulo: 'Desinstalar',
        icono: '🗑️',
        mensaje: `¿Desinstalar ${p.nombre}? Se va del escritorio. Las cosas que guardaste con él no se borran.`,
        botones: [
          { texto: 'Desinstalar', valor: 'si' },
          { texto: 'Cancelar', valor: 'no', principal: true },
        ],
      })
      if (r.boton !== 'si' || !(await permiso(`desinstalar ${p.nombre}`))) return
      ponerInstalado(p.id, false)
      avisoSistema('🗑️', `Se desinstaló ${p.nombre}.`)
    }

    function dibujarProgreso(id: string) {
      const b = raiz.querySelector(`[data-progreso="${id}"]`) as HTMLElement | null
      const t = instalando.get(id) ?? 0
      if (!b) return
      ;(b.firstChild as HTMLElement).style.width = Math.round(t * 100) + '%'
      b.nextElementSibling!.textContent = t < 0.6 ? `Descargando… ${Math.round((t / 0.6) * 100)}%` : 'Instalando…'
    }

    function botonDe(p: Programa, grande = false): HTMLElement {
      if (instalando.has(p.id)) {
        const c = el('div', 'td-instalando')
        const barra = el('div', 'td-barra')
        barra.dataset.progreso = p.id
        barra.append(el('div', 'td-barra-lleno'))
        c.append(barra, el('div', 'td-barra-texto', 'Descargando…'))
        setTimeout(() => dibujarProgreso(p.id), 0)
        return c
      }
      const fila = el('div', 'td-botones')
      if (estaInstalado(p.id)) {
        const abrir = el('button', 'boton principal' + (grande ? '' : ' chico'), 'Abrir')
        abrir.onclick = (e) => {
          e.stopPropagation()
          abrirPrograma(p.id)
        }
        fila.append(abrir)
        if (grande) {
          const des = el('button', 'boton', 'Desinstalar')
          des.onclick = () => desinstalarProg(p)
          fila.append(des)
        }
      } else {
        const ins = el('button', 'boton principal td-instalar' + (grande ? '' : ' chico'), 'Instalar')
        ins.onclick = (e) => {
          e.stopPropagation()
          instalarProg(p)
        }
        fila.append(ins)
      }
      return fila
    }

    function dibujar() {
      raiz.replaceChildren()
      const lado = el('div', 'td-lado')
      lado.append(el('div', 'td-titulo', '🛍️ Tienda'))
      for (const c of CATEGORIAS) {
        const b = el('div', 'td-cat' + (c === categoria && !ficha ? ' activa' : ''), c)
        b.onclick = () => {
          categoria = c
          ficha = null
          dibujar()
        }
        lado.append(b)
      }
      const inst = el('div', 'td-cat' + (categoria === 'Instalados' && !ficha ? ' activa' : ''), '✓ Mis programas')
      inst.onclick = () => {
        categoria = 'Instalados'
        ficha = null
        dibujar()
      }
      lado.append(el('div', 'td-sep'), inst)
      const cuerpo = el('div', 'td-cuerpo')
      raiz.append(lado, cuerpo)

      if (ficha) {
        // La página de un programa.
        const p = progs().find((x) => x.id === ficha)!
        const f = FICHAS[p.id]
        const volver = el('button', 'boton chico', '← Volver')
        volver.onclick = () => {
          ficha = null
          dibujar()
        }
        const cab = el('div', 'td-ficha-cab')
        cab.append(el('div', 'td-ficha-icono', p.icono))
        const datos = el('div', 'td-ficha-datos')
        datos.append(el('div', 'td-ficha-nombre', p.nombre), el('div', 'td-estrellas', '★'.repeat(f.estrellas) + '☆'.repeat(5 - f.estrellas)), el('div', 'td-meta', `${f.categoria} · ${f.tamano} MB · Gratis`), botonDe(p, true))
        cab.append(datos)
        cuerpo.append(volver, cab, el('div', 'td-ficha-texto', f.texto), el('div', 'td-ficha-nota', estaInstalado(p.id) ? '✓ Ya está instalado en esta compu.' : 'Para instalarlo vas a necesitar el permiso de papá o mamá.'))
        return
      }

      const lista = progs().filter((p) => (categoria === 'Todos' ? true : categoria === 'Instalados' ? estaInstalado(p.id) : FICHAS[p.id].categoria === categoria))
      cuerpo.append(el('div', 'td-seccion', categoria === 'Instalados' ? 'Mis programas' : categoria === 'Todos' ? 'Programas para tu compu' : categoria))
      const grilla = el('div', 'td-grilla')
      for (const p of lista) {
        const f = FICHAS[p.id]
        const t = el('div', 'td-tarjeta')
        t.dataset.prog = p.id
        t.append(el('div', 'td-icono', p.icono), el('div', 'td-nombre', p.nombre), el('div', 'td-estrellas chicas', '★'.repeat(f.estrellas)), el('div', 'td-meta', f.categoria), botonDe(p))
        t.onclick = () => {
          ficha = p.id
          dibujar()
        }
        grilla.append(t)
      }
      cuerpo.append(grilla)
    }

    const dejar = alCambiarProgramas(dibujar)
    dibujar()
    return {
      async alCerrar() {
        dejar()
        return true
      },
      api: { instalando: () => instalando.size > 0, ficha: () => ficha },
    }
  },
}
