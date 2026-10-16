// Fórmulas del Tablero, como el Excel en castellano:
// =A1+B1, =B2*C2, =SUMA(A1:A5), =PROMEDIO(...), =MAX, =MIN, =CONTAR.
// Separador de argumentos ";" y coma decimal, igual que en Argentina.

export type Valor = number | string | { error: string }

export const esError = (v: Valor): v is { error: string } => typeof v === 'object'

export function letraCol(c: number): string {
  let s = ''
  c++
  while (c > 0) {
    const r = (c - 1) % 26
    s = String.fromCharCode(65 + r) + s
    c = Math.floor((c - 1) / 26)
  }
  return s
}
export function numCol(s: string): number {
  let n = 0
  for (const ch of s) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}
export const nombre = (c: number, r: number) => letraCol(c) + (r + 1)

export function leerRef(ref: string): [number, number] | null {
  const m = /^\$?([A-Z]+)\$?(\d+)$/.exec(ref.toUpperCase())
  return m ? [numCol(m[1]), Number(m[2]) - 1] : null
}

/** "3,5" o "3.5" o "1.500" → número; si no es número, null. */
export function aNumero(t: string): number | null {
  const s = t.trim().replace(/^\$\s*/, '')
  if (!s) return null
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) return Number(s.replace(/\./g, '').replace(',', '.'))
  if (/^-?\d+(,\d+)?$/.test(s)) return Number(s.replace(',', '.'))
  if (/^-?\d*\.\d+$/.test(s)) return Number(s)
  return null
}

const FUNCIONES: Record<string, (nums: number[], cuantos: number) => Valor> = {
  SUMA: (n) => n.reduce((a, b) => a + b, 0),
  PROMEDIO: (n) => (n.length ? n.reduce((a, b) => a + b, 0) / n.length : { error: '#DIV/0!' }),
  MAX: (n) => (n.length ? Math.max(...n) : 0),
  MIN: (n) => (n.length ? Math.min(...n) : 0),
  CONTAR: (n) => n.length,
}
export const NOMBRES_FUNCIONES = Object.keys(FUNCIONES)

class ErrorFormula extends Error {
  codigo: string
  constructor(codigo: string) {
    super(codigo)
    this.codigo = codigo
  }
}

type Token = { t: 'num' | 'ref' | 'id' | 'op'; v: string }

function separar(f: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < f.length) {
    const ch = f[i]
    if (ch === ' ') {
      i++
      continue
    }
    const resto = f.slice(i)
    let m = /^\d+(,\d+)?/.exec(resto)
    if (m) {
      tokens.push({ t: 'num', v: m[0].replace(',', '.') })
      i += m[0].length
      continue
    }
    m = /^\$?[A-Za-z]+\$?\d+/.exec(resto)
    if (m) {
      tokens.push({ t: 'ref', v: m[0].toUpperCase() })
      i += m[0].length
      continue
    }
    m = /^[A-Za-zÁÉÍÓÚáéíóú]+/.exec(resto)
    if (m) {
      tokens.push({ t: 'id', v: m[0].toUpperCase() })
      i += m[0].length
      continue
    }
    if ('+-*/():;'.includes(ch)) {
      tokens.push({ t: 'op', v: ch })
      i++
      continue
    }
    throw new ErrorFormula('#NOMBRE?')
  }
  return tokens
}

/** Calcula una fórmula (sin el "="). `celda` devuelve el valor de otra celda. */
export function calcular(formula: string, celda: (c: number, r: number) => Valor): Valor {
  let tokens: Token[]
  try {
    tokens = separar(formula)
  } catch (e) {
    return { error: (e as ErrorFormula).codigo }
  }
  let p = 0
  const ver = () => tokens[p]
  const es = (v: string) => ver()?.t === 'op' && ver().v === v
  const pedir = (v: string) => {
    if (!es(v)) throw new ErrorFormula('#ERROR')
    p++
  }

  const numeroDe = (v: Valor): number => {
    if (esError(v)) throw new ErrorFormula(v.error)
    if (typeof v === 'number') return v
    if (v === '') return 0
    const n = aNumero(v)
    if (n === null) throw new ErrorFormula('#VALOR!')
    return n
  }

  function expr(): number {
    let a = termino()
    while (es('+') || es('-')) {
      const op = tokens[p++].v
      const b = termino()
      a = op === '+' ? a + b : a - b
    }
    return a
  }
  function termino(): number {
    let a = factor()
    while (es('*') || es('/')) {
      const op = tokens[p++].v
      const b = factor()
      if (op === '/' && b === 0) throw new ErrorFormula('#DIV/0!')
      a = op === '*' ? a * b : a / b
    }
    return a
  }
  function factor(): number {
    const t = ver()
    if (!t) throw new ErrorFormula('#ERROR')
    if (es('-')) {
      p++
      return -factor()
    }
    if (es('+')) {
      p++
      return factor()
    }
    if (es('(')) {
      p++
      const v = expr()
      pedir(')')
      return v
    }
    if (t.t === 'num') {
      p++
      return Number(t.v)
    }
    if (t.t === 'ref') {
      p++
      if (es(':')) throw new ErrorFormula('#VALOR!') // un rango suelto, sin función
      const r = leerRef(t.v)!
      return numeroDe(celda(r[0], r[1]))
    }
    if (t.t === 'id') {
      p++
      const f = FUNCIONES[t.v]
      if (!f) throw new ErrorFormula('#NOMBRE?')
      pedir('(')
      const nums: number[] = []
      let cuantos = 0
      if (!es(')')) {
        for (;;) {
          argumento(nums, () => cuantos++)
          if (es(';')) {
            p++
            continue
          }
          break
        }
      }
      pedir(')')
      const r = f(nums, cuantos)
      if (esError(r)) throw new ErrorFormula(r.error)
      return r as number
    }
    throw new ErrorFormula('#ERROR')
  }
  // Dentro de una función: un rango (A1:A5) o una cuenta. En los rangos, lo que no es número no cuenta.
  function argumento(nums: number[], contar: () => void) {
    const t = ver()
    if (t?.t === 'ref' && tokens[p + 1]?.t === 'op' && tokens[p + 1].v === ':') {
      const a = leerRef(t.v)!
      const bt = tokens[p + 2]
      if (bt?.t !== 'ref') throw new ErrorFormula('#ERROR')
      const b = leerRef(bt.v)!
      p += 3
      for (let r = Math.min(a[1], b[1]); r <= Math.max(a[1], b[1]); r++)
        for (let c = Math.min(a[0], b[0]); c <= Math.max(a[0], b[0]); c++) {
          const v = celda(c, r)
          if (esError(v)) throw new ErrorFormula(v.error)
          const n = typeof v === 'number' ? v : aNumero(v)
          if (n !== null) {
            nums.push(n)
            contar()
          }
        }
      return
    }
    nums.push(expr())
    contar()
  }

  try {
    const v = expr()
    if (p < tokens.length) throw new ErrorFormula('#ERROR')
    return Number.isFinite(v) ? v : { error: '#NUM!' }
  } catch (e) {
    if (e instanceof ErrorFormula) return { error: e.codigo }
    throw e
  }
}

/** Corre las referencias de una fórmula (para copiar y rellenar). Las que tienen $ quedan fijas. */
export function moverFormula(f: string, dc: number, dr: number): string {
  return f.replace(/(\$?)([A-Z]+)(\$?)(\d+)/g, (todo, fc: string, col: string, ff: string, fila: string) => {
    const c = fc ? numCol(col) : numCol(col) + dc
    const r = ff ? Number(fila) - 1 : Number(fila) - 1 + dr
    if (c < 0 || r < 0) return '#REF!'
    void todo
    return fc + letraCol(c) + ff + (r + 1)
  })
}

/** Hoja completa: valores calculados de todas las celdas, con detección de ciclos. */
export function calcularHoja(entradas: Record<string, string>): Map<string, Valor> {
  const valores = new Map<string, Valor>()
  const calculando = new Set<string>()
  const valorDe = (ref: string): Valor => {
    if (valores.has(ref)) return valores.get(ref)!
    const t = entradas[ref] ?? ''
    let v: Valor
    if (t.startsWith('=')) {
      if (calculando.has(ref)) return { error: '#CICLO!' }
      if (t.includes('#REF!')) {
        valores.set(ref, { error: '#REF!' })
        return valores.get(ref)!
      }
      calculando.add(ref)
      v = calcular(t.slice(1).toUpperCase(), (c, r) => valorDe(nombre(c, r)))
      calculando.delete(ref)
    } else {
      const n = aNumero(t)
      v = n !== null ? n : t
    }
    valores.set(ref, v)
    return v
  }
  for (const ref of Object.keys(entradas)) valorDe(ref)
  return valores
}
