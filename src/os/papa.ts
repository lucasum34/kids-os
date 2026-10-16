// Lo de papá o mamá: la clave (se elige la primera vez, no viene ninguna puesta),
// y el menú secreto (Ctrl+Alt+Mayús+P) con las actualizaciones y la salida de kids-os.

import { cambiarConfig, config } from './config'
import { esPrograma, puente, type EstadoActualizacion } from './compu'
import { sonar } from './sonido'
import { dialogo, el } from './ui'

/** La primera vez que se abre kids-os, un adulto elige la clave. */
export async function asegurarClave() {
  if (config().clavePadres) return
  for (;;) {
    const a = await dialogo({
      titulo: 'Bienvenidos a kids-os',
      icono: '🔒',
      mensaje: 'Esto lo hace papá o mamá: elegí una clave (de 4 letras o números como mínimo). Se va a pedir para instalar programas y para salir de kids-os.',
      campo: '',
      clave: true,
      botones: [{ texto: 'Seguir', valor: 'ok', principal: true }],
    })
    if (a.texto.length < 4) continue
    const b = await dialogo({ titulo: 'Bienvenidos a kids-os', icono: '🔒', mensaje: 'Escribila otra vez, para estar seguros.', campo: '', clave: true, botones: [{ texto: 'Guardar', valor: 'ok', principal: true }] })
    if (b.texto !== a.texto) {
      await dialogo({ titulo: 'Bienvenidos a kids-os', icono: '❌', mensaje: 'No eran iguales. Probemos de nuevo.', botones: [{ texto: 'Aceptar', valor: 'ok', principal: true }] })
      continue
    }
    cambiarConfig({ clavePadres: a.texto })
    return
  }
}

/** Pide la clave. true si la escribieron bien. */
export async function pedirClave(motivo: string): Promise<boolean> {
  await asegurarClave()
  for (;;) {
    const r = await dialogo({
      titulo: 'Permiso de un adulto',
      icono: '🔒',
      mensaje: `${motivo} Pedile a papá o mamá que escriba su clave.`,
      campo: '',
      clave: true,
      botones: [
        { texto: 'Aceptar', valor: 'ok', principal: true },
        { texto: 'Cancelar', valor: 'no' },
      ],
    })
    if (r.boton !== 'ok') return false
    if (r.texto === config().clavePadres) return true
    sonar('mal')
    await dialogo({ titulo: 'Permiso de un adulto', icono: '❌', mensaje: 'Esa no es la clave.', botones: [{ texto: 'Probar otra vez', valor: 'ok', principal: true }] })
  }
}

const TEXTO_ACTUALIZACION: Record<EstadoActualizacion['estado'], string> = {
  nada: 'Todavía no se buscaron actualizaciones.',
  buscando: 'Buscando…',
  bajando: 'Hay una versión nueva y se está bajando.',
  lista: 'Hay una versión nueva lista: se instala al apagar o cerrar sesión.',
  'al-dia': 'Está al día.',
  error: 'No se pudo buscar (¿hay internet?).',
}

/** El menú de papá o mamá (Ctrl+Alt+Mayús+P). */
export async function menuPapa() {
  if (!(await pedirClave('Esto es solo para grandes.'))) return
  const caja = el('div', 'papa')
  const version = esPrograma ? puente!.sistema.version() : 'versión de prueba (navegador)'
  const estado = el('div', 'papa-estado', esPrograma ? '' : 'En el navegador no hay actualizaciones: eso es del programa instalado.')
  const ponerEstado = (e: EstadoActualizacion) => {
    estado.textContent = TEXTO_ACTUALIZACION[e.estado] + (e.version && e.estado !== 'al-dia' ? ` (${e.version})` : '')
    instalar.style.display = e.estado === 'lista' ? '' : 'none'
  }
  const fila = (t: string, f: () => void, peligro = false) => {
    const b = el('button', 'boton' + (peligro ? '' : ''), t)
    b.onclick = f
    return b
  }
  const buscar = fila('🔄 Buscar actualizaciones ahora', async () => {
    estado.textContent = 'Buscando…'
    ponerEstado(await puente!.sistema.buscarActualizaciones())
  })
  const instalar = fila('⬆ Instalar la actualización ahora (se reinicia kids-os)', () => puente!.sistema.instalarActualizacionYa())
  instalar.style.display = 'none'
  const salir = fila('🚪 Salir de kids-os', () => puente!.sistema.salir())
  const sesion = fila('↪ Cerrar sesión', () => puente!.sistema.cerrarSesion())
  caja.append(el('div', 'papa-version', `kids-os ${version}`), estado)
  if (esPrograma) {
    caja.append(buscar, instalar, sesion, salir)
    puente!.sistema.estadoActualizacion().then(ponerEstado)
    puente!.sistema.alActualizacion(ponerEstado)
  }
  caja.append(el('div', 'papa-nota', 'La clave se cambia en Configuración → Cuenta.'))
  await dialogo({ titulo: 'Para papá o mamá', icono: '👨‍👩‍👧', contenido: caja, botones: [{ texto: 'Cerrar', valor: 'ok', principal: true }] })
}
