// Configuración de la compu: fondo, color de las ventanas, íconos, puntero, nombre, sonidos.
// Se guarda y se aplica al escritorio entero.

import { imagenDeMisCosas } from './imagenes'

export interface Config {
  fondo: string // un fondo CSS, o "foto:<id de Mis cosas>"
  acento: string
  iconos: 'chico' | 'mediano' | 'grande'
  puntero: 'normal' | 'grande'
  nombre: string
  sonidos: boolean
  reloj24: boolean
  /** La clave que piden la Tienda y lo que necesita permiso de un adulto. */
  clavePadres: string
}

export const FONDOS = [
  { nombre: 'Cielo', css: 'linear-gradient(160deg, #7ec8f0 0%, #b3e0f7 55%, #c8ecc0 100%)' },
  { nombre: 'Atardecer', css: 'linear-gradient(170deg, #ff9a8b 0%, #ff6a88 45%, #ffd36e 100%)' },
  { nombre: 'Mar', css: 'linear-gradient(180deg, #4facfe 0%, #00f2fe 100%)' },
  { nombre: 'Bosque', css: 'linear-gradient(160deg, #a8e063 0%, #56ab2f 100%)' },
  { nombre: 'Noche', css: 'radial-gradient(circle at 70% 20%, #3a4a8a 0%, #141e30 60%, #0b1020 100%)' },
  { nombre: 'Algodón', css: 'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)' },
  { nombre: 'Lavanda', css: 'linear-gradient(160deg, #e0c3fc 0%, #8ec5fc 100%)' },
  { nombre: 'Gris', css: '#78909c' },
]
export const ACENTOS = [
  { nombre: 'Azul', color: '#1e88e5' },
  { nombre: 'Rosa', color: '#d81b60' },
  { nombre: 'Violeta', color: '#8e24aa' },
  { nombre: 'Verde', color: '#2e7d32' },
  { nombre: 'Naranja', color: '#ef6c00' },
  { nombre: 'Turquesa', color: '#00838f' },
]

const CLAVE = 'kidsos.config'
const PREDETERMINADA: Config = { fondo: FONDOS[0].css, acento: ACENTOS[0].color, iconos: 'mediano', puntero: 'normal', nombre: '', sonidos: true, reloj24: true, clavePadres: '1234' }

let actual: Config = leer()
const oyentes = new Set<(c: Config) => void>()

function leer(): Config {
  try {
    return { ...PREDETERMINADA, ...JSON.parse(localStorage.getItem(CLAVE) || '{}') }
  } catch {
    return { ...PREDETERMINADA }
  }
}

export const config = () => actual

export function cambiarConfig(c: Partial<Config>) {
  actual = { ...actual, ...c }
  try {
    localStorage.setItem(CLAVE, JSON.stringify(actual))
  } catch {}
  aplicar()
  oyentes.forEach((f) => f(actual))
}

export function alCambiarConfig(f: (c: Config) => void) {
  oyentes.add(f)
  return () => oyentes.delete(f)
}

export function restablecer() {
  cambiarConfig({ ...PREDETERMINADA })
}

/** Un tono más oscuro del color (para bordes y botones apretados). */
function oscurecer(hex: string, k = 0.78): string {
  const n = parseInt(hex.slice(1), 16)
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => Math.round(x * k))
  return '#' + c.map((x) => x.toString(16).padStart(2, '0')).join('')
}

export async function aplicar() {
  const r = document.documentElement
  r.style.setProperty('--acento', actual.acento)
  r.style.setProperty('--acento-oscuro', oscurecer(actual.acento))
  r.style.setProperty('--icono-escala', actual.iconos === 'chico' ? '0.75' : actual.iconos === 'grande' ? '1.35' : '1')
  document.body.classList.toggle('puntero-grande', actual.puntero === 'grande')
  const esc = document.querySelector('.escritorio') as HTMLElement | null
  if (!esc) return
  if (actual.fondo.startsWith('foto:')) {
    const url = await imagenDeMisCosas(actual.fondo.slice(5))
    esc.style.background = url ? `#222 url("${url}") center / cover no-repeat` : FONDOS[0].css
  } else esc.style.background = actual.fondo
}
