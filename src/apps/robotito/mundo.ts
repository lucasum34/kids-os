// El mundo de Robotito: niveles, bloques y cómo se ejecuta un programa.

export type TipoBloque = 'avanzar' | 'izq' | 'der' | 'pintar' | 'repetir' | 'mientras' | 'si'
export type Condicion = 'adelante' | 'izquierda' | 'derecha'

export interface Bloque {
  id: string
  tipo: TipoBloque
  n?: number // repetir
  cond?: Condicion // si
  color?: string // pintar
  hijos?: Bloque[] // repetir, mientras, si (la parte "si")
  sino?: Bloque[] // si (la parte "si no")
}

export interface Nivel {
  texto: string
  mapa: string[] // '#' árbol, '.' camino, '*' estrella, '>v<^' Robotito mirando para ese lado
  bloques: TipoBloque[]
  maximo?: number // cantidad máxima de bloques
}

const MOV: TipoBloque[] = ['avanzar', 'izq', 'der']

export const NIVELES: Nivel[] = [
  { texto: 'Llevá a Robotito hasta la estrella. Arrastrá bloques al programa y apretá ▶.', bloques: ['avanzar'], mapa: ['######', '#>..*#', '######'] },
  { texto: 'Ahora hay que doblar.', bloques: MOV, mapa: ['######', '#>..##', '###.##', '###*##', '######'] },
  { texto: 'Doblá para el otro lado.', bloques: MOV, mapa: ['#######', '####*##', '####.##', '#>...##', '#######'] },
  { texto: 'Una escalera.', bloques: MOV, mapa: ['#######', '#>.####', '##..###', '###..##', '####*##', '#######'] },
  {
    texto: 'Un camino largo. Con "repetir" alcanzan 2 bloques.',
    bloques: [...MOV, 'repetir'],
    maximo: 2,
    mapa: ['############', '#>........*#', '############'],
  },
  {
    texto: 'La escalera otra vez, más larga. Con "repetir", como máximo 5 bloques.',
    bloques: [...MOV, 'repetir'],
    maximo: 5,
    mapa: ['########', '#>.#####', '##..####', '###..###', '####..##', '#####*##', '########'],
  },
  {
    texto: 'Dar la vuelta. Un "repetir" puede ir adentro de otro. Máximo 6 bloques.',
    bloques: [...MOV, 'repetir'],
    maximo: 6,
    mapa: ['#######', '#.....#', '#.###.#', '#.###.#', '#.###.#', '#^*...#', '#######'],
  },
  {
    texto: 'Robotito tiene que mirar antes de avanzar: "mientras no llegue" y "si hay camino". Máximo 6 bloques.',
    bloques: [...MOV, 'mientras', 'si'],
    maximo: 6,
    mapa: ['#########', '#>..#..*#', '###.#.###', '###...###', '#########'],
  },
  {
    texto: 'Otro camino. ¿Anda el mismo programa?',
    bloques: [...MOV, 'mientras', 'si'],
    maximo: 6,
    mapa: ['##########', '#v#....###', '#.#.##.###', '#...##..*#', '##########'],
  },
]

export const LIBRE: Nivel = {
  texto: 'Taller libre: Robotito pinta. Hacé dibujos con tu programa.',
  bloques: [...MOV, 'pintar', 'repetir', 'si'],
  mapa: Array.from({ length: 9 }, (_, y) => (y === 4 ? '>' : '.') + '.'.repeat(12)),
}

// Direcciones: 0 derecha, 1 abajo, 2 izquierda, 3 arriba.
const DX = [1, 0, -1, 0]
const DY = [0, 1, 0, -1]

export interface Estado {
  x: number
  y: number
  dir: number
  giro: number // ángulo acumulado, para que al girar no dé la vuelta larga
  pintadas: Map<string, string>
}

export function inicio(n: Nivel): Estado {
  for (let y = 0; y < n.mapa.length; y++)
    for (let x = 0; x < n.mapa[y].length; x++) {
      const d = '>v<^'.indexOf(n.mapa[y][x])
      if (d >= 0) return { x, y, dir: d, giro: d * 90, pintadas: new Map() }
    }
  return { x: 0, y: 0, dir: 0, giro: 0, pintadas: new Map() }
}

export function hayCamino(n: Nivel, x: number, y: number): boolean {
  const c = n.mapa[y]?.[x]
  return c !== undefined && c !== '#'
}

export function estrella(n: Nivel): [number, number] | null {
  for (let y = 0; y < n.mapa.length; y++) {
    const x = n.mapa[y].indexOf('*')
    if (x >= 0) return [x, y]
  }
  return null
}

export function llego(n: Nivel, s: Estado): boolean {
  const e = estrella(n)
  return !!e && e[0] === s.x && e[1] === s.y
}

export function sensor(n: Nivel, s: Estado, c: Condicion): boolean {
  const d = c === 'adelante' ? s.dir : c === 'izquierda' ? (s.dir + 3) % 4 : (s.dir + 1) % 4
  return hayCamino(n, s.x + DX[d], s.y + DY[d])
}

export class Choque extends Error {
  id: string
  constructor(id: string) {
    super('choque')
    this.id = id
  }
}

/** Cada paso devuelve el bloque que se está haciendo y si Robotito se movió (para la animación). */
export interface Paso {
  id: string
  accion: boolean
}

export function* ejecutar(lista: Bloque[], n: Nivel, s: Estado): Generator<Paso> {
  for (const b of lista) {
    switch (b.tipo) {
      case 'avanzar': {
        const x = s.x + DX[s.dir]
        const y = s.y + DY[s.dir]
        if (!hayCamino(n, x, y)) throw new Choque(b.id)
        s.x = x
        s.y = y
        yield { id: b.id, accion: true }
        break
      }
      case 'izq':
        s.dir = (s.dir + 3) % 4
        s.giro -= 90
        yield { id: b.id, accion: true }
        break
      case 'der':
        s.dir = (s.dir + 1) % 4
        s.giro += 90
        yield { id: b.id, accion: true }
        break
      case 'pintar':
        s.pintadas.set(`${s.x},${s.y}`, b.color ?? '#e53935')
        yield { id: b.id, accion: true }
        break
      case 'repetir':
        for (let i = 0; i < (b.n ?? 2); i++) {
          yield { id: b.id, accion: false }
          yield* ejecutar(b.hijos ?? [], n, s)
        }
        break
      case 'mientras':
        while (!llego(n, s)) {
          yield { id: b.id, accion: false }
          yield* ejecutar(b.hijos ?? [], n, s)
        }
        break
      case 'si':
        yield { id: b.id, accion: false }
        yield* ejecutar((sensor(n, s, b.cond ?? 'adelante') ? b.hijos : b.sino) ?? [], n, s)
        break
    }
  }
}

export function contar(lista: Bloque[]): number {
  return lista.reduce((t, b) => t + 1 + contar(b.hijos ?? []) + contar(b.sino ?? []), 0)
}

const TEXTO_COND: Record<Condicion, string> = {
  adelante: 'hay_camino_adelante()',
  izquierda: 'hay_camino_a_la_izquierda()',
  derecha: 'hay_camino_a_la_derecha()',
}

/** El mismo programa escrito como texto, para ir viendo que bloques y código son lo mismo. */
export function aTexto(lista: Bloque[], sangria = ''): string {
  const t = (b: Bloque[]) => (b.length ? aTexto(b, sangria + '    ') : sangria + '    (nada)\n')
  let s = ''
  for (const b of lista) {
    if (b.tipo === 'avanzar') s += sangria + 'avanzar()\n'
    else if (b.tipo === 'izq') s += sangria + 'girar_izquierda()\n'
    else if (b.tipo === 'der') s += sangria + 'girar_derecha()\n'
    else if (b.tipo === 'pintar') s += sangria + `pintar("${b.color}")\n`
    else if (b.tipo === 'repetir') s += sangria + `repetir ${b.n} veces:\n` + t(b.hijos ?? [])
    else if (b.tipo === 'mientras') s += sangria + 'mientras no llegue_a_la_estrella():\n' + t(b.hijos ?? [])
    else if (b.tipo === 'si') {
      s += sangria + `si ${TEXTO_COND[b.cond ?? 'adelante']}:\n` + t(b.hijos ?? [])
      s += sangria + 'si no:\n' + t(b.sino ?? [])
    }
  }
  return s
}
