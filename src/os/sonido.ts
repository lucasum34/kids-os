// Soniditos del sistema (se apagan en Configuración).

import { config } from './config'

let ctx: AudioContext | null = null

const NOTAS: Record<string, [number, number][]> = {
  abrir: [[523, 0.06], [784, 0.08]],
  cerrar: [[659, 0.06], [440, 0.08]],
  aviso: [[880, 0.12]],
  bien: [[523, 0.08], [659, 0.08], [784, 0.14]],
  mal: [[220, 0.2]],
}

export function sonar(cual: keyof typeof NOTAS | string) {
  if (!config().sonidos) return
  const notas = NOTAS[cual]
  if (!notas) return
  try {
    ctx ??= new AudioContext()
    let t = ctx.currentTime
    for (const [f, d] of notas) {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = f
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, t + d)
      o.connect(g).connect(ctx.destination)
      o.start(t)
      o.stop(t + d + 0.02)
      t += d
    }
  } catch {}
}
