// Programas: los que trae la compu y los que se instalan desde la Tienda.

import { abrirVentana, type Programa, type Ventana } from './ventanas'

const programas = new Map<string, Programa>()
/** Los del sistema no se pueden desinstalar (Mis cosas, Configuración, la Tienda…). */
const delSistema = new Set<string>()
/** Los que vienen instalados de fábrica (los demás hay que bajarlos de la Tienda). */
const deFabrica = new Set<string>()

const CLAVE = 'kidsos.instalados'
const oyentes = new Set<() => void>()

export function instalar(p: Programa, o: { sistema?: boolean; deFabrica?: boolean } = {}) {
  programas.set(p.id, p)
  if (o.sistema) delSistema.add(p.id)
  if (o.sistema || o.deFabrica !== false) deFabrica.add(p.id)
}

export function programa(id: string) {
  return programas.get(id)
}

function leer(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) || '{}')
  } catch {
    return {}
  }
}

export const esDelSistema = (id: string) => delSistema.has(id)
export function estaInstalado(id: string): boolean {
  if (delSistema.has(id)) return true
  const r = leer()[id]
  return r ?? deFabrica.has(id)
}
export function ponerInstalado(id: string, si: boolean) {
  if (delSistema.has(id)) return
  const r = leer()
  r[id] = si
  try {
    localStorage.setItem(CLAVE, JSON.stringify(r))
  } catch {}
  oyentes.forEach((f) => f())
}
export function alCambiarProgramas(f: () => void) {
  oyentes.add(f)
  return () => oyentes.delete(f)
}

/** Los que están instalados (los del escritorio y el menú de inicio). */
export function listaProgramas() {
  return [...programas.values()].filter((p) => estaInstalado(p.id))
}
/** Todos, instalados o no (para la Tienda). */
export function todosLosProgramas() {
  return [...programas.values()]
}

export function abrirPrograma(id: string, archivoId?: string): Ventana | null {
  const p = programas.get(id)
  return p ? abrirVentana(p, archivoId) : null
}
