// Configuración: como la de Windows. Secciones a la izquierda, opciones a la derecha.
// Enseña: que la compu se ajusta a gusto (fondo, colores, tamaño de las cosas,
// mouse, sonidos, hora) y que los cambios se ven al instante.

import * as fs from '../os/archivos'
import { ACENTOS, cambiarConfig, config, FONDOS, restablecer, type Config } from '../os/config'
import { PROGRAMAS_CON_IMAGEN } from '../os/imagenes'
import { elegirArchivo } from '../os/selector'
import { sonar } from '../os/sonido'
import { dialogo, el } from '../os/ui'
import type { Programa } from '../os/ventanas'

const SECCIONES = [
  { id: 'personalizar', icono: '🎨', nombre: 'Personalización' },
  { id: 'pantalla', icono: '🖥️', nombre: 'Pantalla' },
  { id: 'mouse', icono: '🖱️', nombre: 'Mouse' },
  { id: 'cuenta', icono: '🙂', nombre: 'Cuenta' },
  { id: 'sonido', icono: '🔊', nombre: 'Sonido' },
  { id: 'hora', icono: '🕒', nombre: 'Fecha y hora' },
  { id: 'acerca', icono: 'ℹ️', nombre: 'Acerca de' },
]

export const configuracion: Programa = {
  id: 'configuracion',
  nombre: 'Configuración',
  icono: '⚙️',
  ancho: 860,
  alto: 600,
  abrir(win) {
    let seccion = 'personalizar'
    const raiz = el('div', 'config')
    const lado = el('div', 'cf-lado')
    const panel = el('div', 'cf-panel')
    raiz.append(lado, panel)
    win.cuerpo.append(raiz)

    function dibujarLado() {
      lado.replaceChildren()
      const n = config().nombre.trim()
      const yo = el('div', 'cf-yo')
      yo.append(el('div', 'cf-avatar', n ? n[0].toUpperCase() : '🙂'), el('div', 'cf-yo-nombre', n || 'Sin nombre'))
      lado.append(yo)
      for (const s of SECCIONES) {
        const b = el('div', 'cf-seccion' + (s.id === seccion ? ' activa' : ''))
        b.append(el('span', 'cf-sec-icono', s.icono), el('span', '', s.nombre))
        b.onclick = () => {
          seccion = s.id
          dibujar()
        }
        lado.append(b)
      }
    }

    const titulo = (t: string) => el('div', 'cf-titulo', t)
    const tarjeta = (t: string, ayuda: string, ...hijos: HTMLElement[]) => {
      const c = el('div', 'cf-tarjeta')
      const cab = el('div', 'cf-tarjeta-cab')
      cab.append(el('div', 'cf-tarjeta-titulo', t), el('div', 'cf-ayuda', ayuda))
      c.append(cab, ...hijos)
      return c
    }
    /** Botones de "elegí uno" (como los del Windows). */
    function opciones<T extends string>(lista: { valor: T; texto: string }[], actual: T, poner: (v: T) => void) {
      const f = el('div', 'cf-opciones')
      for (const o of lista) {
        const b = el('button', 'cf-opcion' + (o.valor === actual ? ' activa' : ''), o.texto)
        b.onclick = () => {
          poner(o.valor)
          dibujar()
        }
        f.append(b)
      }
      return f
    }
    /** Interruptor de prendido / apagado. */
    function interruptor(prendido: boolean, poner: (v: boolean) => void) {
      const b = el('button', 'cf-switch' + (prendido ? ' on' : ''))
      b.append(el('span', 'cf-switch-bola'), el('span', 'cf-switch-texto', prendido ? 'Activado' : 'Desactivado'))
      b.onclick = () => {
        poner(!prendido)
        dibujar()
      }
      return b
    }
    const cambiar = (c: Partial<Config>) => cambiarConfig(c)

    function dibujar() {
      dibujarLado()
      panel.replaceChildren()
      const c = config()
      if (seccion === 'personalizar') {
        panel.append(titulo('Personalización'))
        const fondos = el('div', 'cf-fondos')
        for (const f of FONDOS) {
          const b = el('button', 'cf-fondo' + (c.fondo === f.css ? ' activo' : ''))
          b.style.background = f.css
          b.title = f.nombre
          b.append(el('span', 'cf-fondo-nombre', f.nombre))
          b.onclick = () => {
            cambiar({ fondo: f.css })
            dibujar()
          }
          fondos.append(b)
        }
        const foto = el('button', 'cf-fondo foto' + (c.fondo.startsWith('foto:') ? ' activo' : ''))
        foto.append(el('span', 'cf-fondo-icono', '🖼️'), el('span', 'cf-fondo-nombre', 'Una foto mía…'))
        foto.onclick = async () => {
          const id = await elegirArchivo(PROGRAMAS_CON_IMAGEN, 'Elegí el fondo de pantalla')
          if (id) {
            cambiar({ fondo: 'foto:' + id })
            dibujar()
          }
        }
        fondos.append(foto)
        panel.append(tarjeta('Fondo de pantalla', 'Lo que se ve detrás de las ventanas.', fondos))
        const colores = el('div', 'cf-colores')
        for (const a of ACENTOS) {
          const b = el('button', 'cf-color' + (c.acento === a.color ? ' activo' : ''))
          b.style.background = a.color
          b.title = a.nombre
          b.onclick = () => {
            cambiar({ acento: a.color })
            dibujar()
          }
          colores.append(b)
        }
        panel.append(tarjeta('Color', 'El color de la ventana que está al frente y de los botones.', colores))
      } else if (seccion === 'pantalla') {
        panel.append(
          titulo('Pantalla'),
          tarjeta(
            'Tamaño de los íconos del escritorio',
            'Más grandes se ven mejor; más chicos entran más.',
            opciones([{ valor: 'chico', texto: 'Chicos' }, { valor: 'mediano', texto: 'Medianos' }, { valor: 'grande', texto: 'Grandes' }], c.iconos, (v) => cambiar({ iconos: v })),
          ),
        )
      } else if (seccion === 'mouse') {
        const prueba = el('div', 'cf-prueba', 'Pasá el mouse por acá para probar')
        panel.append(
          titulo('Mouse'),
          tarjeta(
            'Tamaño del puntero',
            'La flechita que se mueve con el mouse.',
            opciones([{ valor: 'normal', texto: 'Normal' }, { valor: 'grande', texto: 'Grande' }], c.puntero, (v) => cambiar({ puntero: v })),
            prueba,
          ),
          tarjeta('Doble clic', 'Para abrir algo hay que hacer dos clics rápidos. Probá acá:', dobleClic()),
        )
      } else if (seccion === 'cuenta') {
        const campo = el('input', 'campo cf-campo')
        campo.value = c.nombre
        campo.placeholder = 'Escribí tu nombre'
        campo.maxLength = 20
        campo.oninput = () => {
          cambiar({ nombre: campo.value })
          dibujarLado()
        }
        const bClave = el('button', 'boton', '🔒 Cambiar la clave…')
        bClave.onclick = async () => {
          const a = config().clavePadres ? await dialogo({ titulo: 'Clave de papá o mamá', icono: '🔒', mensaje: 'Escribí la clave de ahora.', campo: '', clave: true, botones: [{ texto: 'Seguir', valor: 'ok', principal: true }, { texto: 'Cancelar', valor: 'no' }] }) : { boton: 'ok', texto: '' }
          if (a.boton !== 'ok') return
          if (a.texto !== config().clavePadres) {
            await dialogo({ titulo: 'Clave de papá o mamá', icono: '❌', mensaje: 'Esa no es la clave.', botones: [{ texto: 'Aceptar', valor: 'ok', principal: true }] })
            return
          }
          const b = await dialogo({ titulo: 'Clave de papá o mamá', icono: '🔒', mensaje: 'Escribí la clave nueva (por lo menos 4 letras o números).', campo: '', clave: true, botones: [{ texto: 'Guardar', valor: 'ok', principal: true }, { texto: 'Cancelar', valor: 'no' }] })
          if (b.boton !== 'ok' || b.texto.length < 4) return
          cambiar({ clavePadres: b.texto })
          await dialogo({ titulo: 'Clave de papá o mamá', icono: '✅', mensaje: 'Listo, la clave cambió.', botones: [{ texto: 'Aceptar', valor: 'ok', principal: true }] })
        }
        panel.append(
          titulo('Cuenta'),
          tarjeta('Tu nombre', 'Aparece en el menú de inicio para saludarte.', campo),
          tarjeta('Clave de papá o mamá', 'La pide la Tienda para instalar o desinstalar programas. Solo la sabe un adulto.', bClave),
        )
      } else if (seccion === 'sonido') {
        const probar = el('button', 'boton', '🔔 Probar')
        probar.onclick = () => sonar('bien')
        panel.append(
          titulo('Sonido'),
          tarjeta('Sonidos de la compu', 'Un sonidito al abrir y cerrar ventanas.', interruptor(c.sonidos, (v) => cambiar({ sonidos: v })), probar),
        )
      } else if (seccion === 'hora') {
        const ahora = new Date()
        panel.append(
          titulo('Fecha y hora'),
          tarjeta('Hoy es', '', el('div', 'cf-grande', ahora.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))),
          tarjeta(
            'Formato de la hora',
            '24 horas: 15:30. 12 horas: 3:30 p. m.',
            opciones([{ valor: '24', texto: '24 horas' }, { valor: '12', texto: '12 horas (a. m. / p. m.)' }], c.reloj24 ? '24' : '12', (v) => cambiar({ reloj24: v === '24' })),
          ),
        )
      } else if (seccion === 'acerca') {
        let bytes = 0
        try {
          for (const k of Object.keys(localStorage)) if (k.startsWith('kidsos.')) bytes += (localStorage.getItem(k)?.length ?? 0) * 2
        } catch {}
        const usado = Math.min(1, bytes / (5 * 1024 * 1024))
        const barra = el('div', 'cf-uso')
        const lleno = el('div', 'cf-uso-lleno')
        lleno.style.width = Math.round(usado * 100) + '%'
        if (usado > 0.8) lleno.classList.add('alto')
        barra.append(lleno)
        const cosas = fs.listar()
        const reset = el('button', 'boton', 'Volver a como venía')
        reset.onclick = async () => {
          const r = await dialogo({
            titulo: 'Configuración',
            icono: '⚙️',
            mensaje: 'Fondo, colores, tamaños y sonidos vuelven a como venían. Tus cosas guardadas no se tocan.',
            botones: [
              { texto: 'Restablecer', valor: 'si' },
              { texto: 'Cancelar', valor: 'no', principal: true },
            ],
          })
          if (r.boton === 'si') {
            restablecer()
            dibujar()
          }
        }
        panel.append(
          titulo('Acerca de esta compu'),
          tarjeta('Mi compu', 'Versión 0.1', el('div', 'cf-ayuda', `${cosas.filter((a) => !a.enPapelera).length} cosas guardadas · ${cosas.filter((a) => a.enPapelera).length} en la papelera`)),
          tarjeta('Espacio para guardar', `Usado: ${(bytes / 1024 / 1024).toFixed(1)} MB de 5 MB. Si se llena, vaciá la papelera.`, barra),
          tarjeta('Restablecer', 'Deshace todos los cambios de Configuración.', reset),
        )
      }
    }

    function dobleClic() {
      const caja = el('div', 'cf-doble', '📁')
      let n = 0
      caja.ondblclick = () => {
        n++
        caja.textContent = n % 2 ? '📂' : '📁'
        caja.title = '¡Bien! Se abrió.'
        sonar('bien')
      }
      return caja
    }

    dibujar()
    return {}
  },
}
