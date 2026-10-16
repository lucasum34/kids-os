// Calculadora: como la estándar de Windows.
// Hace cada cuenta apenas se aprieta el siguiente signo (2 + 3 × 4 = 20, igual que Windows),
// funciona con el teclado (también el numérico), y guarda el historial.

import { el } from '../os/ui'
import type { Programa } from '../os/ventanas'

type Op = '+' | '−' | '×' | '÷'

const formato = (n: number): string => {
  if (!Number.isFinite(n)) return 'No se puede dividir por cero'
  const r = Math.round(n * 1e10) / 1e10
  const s = Math.abs(r) >= 1e15 ? r.toExponential(6) : r.toLocaleString('es-AR', { maximumFractionDigits: 10 })
  return s
}

export const calculadora: Programa = {
  id: 'calculadora',
  nombre: 'Calculadora',
  icono: '🧮',
  ancho: 560,
  alto: 560,
  abrir(win) {
    let pantalla = '0' // lo que se está escribiendo, sin puntos de miles (se agregan al mostrarlo)
    let acumulado: number | null = null
    let op: Op | null = null
    let arriba = '' // la cuenta en curso, en chiquito
    let nuevo = true // el próximo número reemplaza lo que hay
    let error = false
    const historia: { cuenta: string; resultado: string }[] = []

    const raiz = el('div', 'calc')
    const izq = el('div', 'calc-izq')
    const linea = el('div', 'calc-arriba')
    const visor = el('div', 'calc-visor')
    const teclas = el('div', 'calc-teclas')
    izq.append(linea, visor, teclas)
    const hist = el('div', 'calc-historia')
    raiz.append(izq, hist)
    win.cuerpo.append(raiz)

    const valor = () => Number(pantalla.replace(/\./g, '').replace(',', '.'))
    const calcular = (a: number, o: Op, b: number) => (o === '+' ? a + b : o === '−' ? a - b : o === '×' ? a * b : a / b)

    function digito(d: string) {
      if (error) limpiar()
      if (nuevo) {
        pantalla = d === ',' ? '0,' : d
        nuevo = false
      } else {
        if (d === ',' && pantalla.includes(',')) return
        if (pantalla.replace(/[^\d]/g, '').length >= 16) return
        pantalla = pantalla === '0' && d !== ',' ? d : pantalla + d
      }
      mostrar()
    }
    function operador(o: Op) {
      if (error) return
      const v = valor()
      if (op && !nuevo && acumulado !== null) acumulado = calcular(acumulado, op, v)
      else if (acumulado === null || !op || !nuevo) acumulado = v
      if (!Number.isFinite(acumulado)) return mostrarError()
      op = o
      arriba = `${formato(acumulado)} ${o}`
      pantalla = formato(acumulado)
      nuevo = true
      mostrar()
    }
    function igual() {
      if (error) return limpiar()
      if (!op || acumulado === null) return
      const b = valor()
      const cuenta = `${formato(acumulado)} ${op} ${formato(b)} =`
      const r = calcular(acumulado, op, b)
      if (!Number.isFinite(r)) return mostrarError()
      historia.unshift({ cuenta, resultado: formato(r) })
      arriba = cuenta
      pantalla = formato(r)
      acumulado = null
      op = null
      nuevo = true
      mostrar()
      dibujarHistoria()
    }
    function unaria(nombre: string, f: (x: number) => number) {
      if (error) return
      const x = valor()
      const r = f(x)
      if (!Number.isFinite(r)) return mostrarError()
      arriba = `${nombre}(${formato(x)})`
      pantalla = formato(r)
      nuevo = true
      mostrar()
    }
    function porcentaje() {
      // Como Windows: 200 + 10 % = 200 + 20.
      const x = valor()
      const r = acumulado !== null && (op === '+' || op === '−') ? (acumulado * x) / 100 : x / 100
      pantalla = formato(r)
      nuevo = true
      mostrar()
    }
    function cambiarSigno() {
      if (pantalla === '0') return
      pantalla = pantalla.startsWith('-') ? pantalla.slice(1) : '-' + pantalla
      mostrar()
    }
    function borrarUno() {
      if (nuevo || error) return
      pantalla = pantalla.length > 1 && !(pantalla.length === 2 && pantalla.startsWith('-')) ? pantalla.slice(0, -1) : '0'
      mostrar()
    }
    function borrarEntrada() {
      pantalla = '0'
      nuevo = true
      error = false
      mostrar()
    }
    function limpiar() {
      pantalla = '0'
      acumulado = null
      op = null
      arriba = ''
      nuevo = true
      error = false
      mostrar()
    }
    function mostrarError() {
      error = true
      pantalla = 'No se puede dividir por cero'
      arriba = ''
      acumulado = null
      op = null
      nuevo = true
      mostrar()
    }

    function mostrar() {
      linea.textContent = arriba
      // Mientras se escribe, se agregan los puntos de los miles (1.234.567,8).
      let t = pantalla
      if (!error && !nuevo && /^-?\d+(,\d*)?$/.test(pantalla)) {
        const [ent, dec] = pantalla.split(',')
        const signo = ent.startsWith('-') ? '-' : ''
        t = signo + Number(ent.replace('-', '')).toLocaleString('es-AR') + (dec !== undefined ? ',' + dec : '')
      }
      visor.textContent = t
      visor.classList.toggle('chico', t.length > 12)
      visor.classList.toggle('error', error)
    }

    const BOTONES: [string, string, () => void][] = [
      ['%', 'fn', porcentaje],
      ['CE', 'fn', borrarEntrada],
      ['C', 'fn', limpiar],
      ['⌫', 'fn', borrarUno],
      ['¹⁄ₓ', 'fn', () => unaria('1/', (x) => 1 / x)],
      ['x²', 'fn', () => unaria('sqr', (x) => x * x)],
      ['²√x', 'fn', () => unaria('√', (x) => (x < 0 ? NaN : Math.sqrt(x)))],
      ['÷', 'op', () => operador('÷')],
      ['7', 'num', () => digito('7')],
      ['8', 'num', () => digito('8')],
      ['9', 'num', () => digito('9')],
      ['×', 'op', () => operador('×')],
      ['4', 'num', () => digito('4')],
      ['5', 'num', () => digito('5')],
      ['6', 'num', () => digito('6')],
      ['−', 'op', () => operador('−')],
      ['1', 'num', () => digito('1')],
      ['2', 'num', () => digito('2')],
      ['3', 'num', () => digito('3')],
      ['+', 'op', () => operador('+')],
      ['+/−', 'num', cambiarSigno],
      ['0', 'num', () => digito('0')],
      [',', 'num', () => digito(',')],
      ['=', 'igual', igual],
    ]
    const porTexto = new Map<string, HTMLButtonElement>()
    for (const [t, clase, f] of BOTONES) {
      const b = el('button', 'calc-tecla ' + clase, t)
      b.onclick = f
      teclas.append(b)
      porTexto.set(t, b)
    }

    function dibujarHistoria() {
      hist.replaceChildren(el('div', 'calc-hist-titulo', 'Historial'))
      if (!historia.length) hist.append(el('div', 'calc-hist-vacio', 'Todavía no hay cuentas.'))
      for (const h of historia.slice(0, 30)) {
        const it = el('div', 'calc-hist-item')
        it.append(el('div', 'calc-hist-cuenta', h.cuenta), el('div', 'calc-hist-res', h.resultado))
        it.title = 'Clic para usar este resultado'
        it.onclick = () => {
          pantalla = h.resultado
          nuevo = true
          mostrar()
        }
        hist.append(it)
      }
      if (historia.length) {
        const b = el('button', 'boton chico', 'Borrar historial')
        b.onclick = () => {
          historia.length = 0
          dibujarHistoria()
        }
        hist.append(b)
      }
    }

    /** Que el botón se vea apretado también cuando se usa el teclado. */
    function apretar(t: string) {
      const b = porTexto.get(t)
      if (!b) return
      b.classList.add('apretada')
      setTimeout(() => b.classList.remove('apretada'), 120)
      b.click()
    }

    mostrar()
    dibujarHistoria()

    return {
      alTecla(e) {
        const k = e.key
        if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'c') {
          navigator.clipboard?.writeText(visor.textContent ?? '').catch(() => {})
          return true
        }
        if (e.ctrlKey || e.metaKey || e.altKey) return false
        if (/^\d$/.test(k)) apretar(k)
        else if (k === ',' || k === '.' || k === 'Decimal') apretar(',')
        else if (k === '+') apretar('+')
        else if (k === '-') apretar('−')
        else if (k === '*' || k === 'x') apretar('×')
        else if (k === '/') apretar('÷')
        else if (k === 'Enter' || k === '=') apretar('=')
        else if (k === 'Backspace') apretar('⌫')
        else if (k === 'Escape') apretar('C')
        else if (k === 'Delete') apretar('CE')
        else if (k === '%') apretar('%')
        else return false
        return true
      },
    }
  },
}
