// Teclado: aprender a escribir con los diez dedos.
// Lecciones de a dos o tres teclas (empezando por F y J, que tienen la rayita),
// un teclado en pantalla que marca la próxima tecla y con qué dedo,
// y un juego (Lluvia de letras) para practicar lo aprendido.

import { el } from '../os/ui'
import type { Programa } from '../os/ventanas'

// Teclado latinoamericano, el de las notebooks que se venden en Argentina.
const FILAS = ['qwertyuiop´+', 'asdfghjklñ{}', '<zxcvbnm,.-']
const SANGRIA = [1.5, 1.8, 1.2] // corrimiento de cada fila, en teclas

const DEDOS = [
  { nombre: 'meñique izquierdo', color: '#f48fb1' },
  { nombre: 'anular izquierdo', color: '#ce93d8' },
  { nombre: 'mayor izquierdo', color: '#90caf9' },
  { nombre: 'índice izquierdo', color: '#a5d6a7' },
  { nombre: 'pulgar', color: '#e0e0e0' },
  { nombre: 'índice derecho', color: '#fff59d' },
  { nombre: 'mayor derecho', color: '#ffcc80' },
  { nombre: 'anular derecho', color: '#bcaaa4' },
  { nombre: 'meñique derecho', color: '#80cbc4' },
]
const DEDO: Record<string, number> = {}
'qaz<'.split('').forEach((c) => (DEDO[c] = 0))
'wsx'.split('').forEach((c) => (DEDO[c] = 1))
'edc'.split('').forEach((c) => (DEDO[c] = 2))
'rfvtgb'.split('').forEach((c) => (DEDO[c] = 3))
DEDO[' '] = 4
'yhnujm'.split('').forEach((c) => (DEDO[c] = 5))
'ik,'.split('').forEach((c) => (DEDO[c] = 6))
'ol.'.split('').forEach((c) => (DEDO[c] = 7))
'pñ´+{}-'.split('').forEach((c) => (DEDO[c] = 8))
const MANO_IZQ = (c: string) => (DEDO[c] ?? 9) < 4

interface Leccion {
  titulo: string
  nuevas: string // las teclas que se aprenden en esta lección
  mayusculas?: boolean
  frases?: boolean
}
const LECCIONES: Leccion[] = [
  { titulo: 'F y J', nuevas: 'fj' },
  { titulo: 'D y K', nuevas: 'dk' },
  { titulo: 'S y L', nuevas: 'sl' },
  { titulo: 'A y Ñ', nuevas: 'añ' },
  { titulo: 'G y H', nuevas: 'gh' },
  { titulo: 'E e I', nuevas: 'ei' },
  { titulo: 'R y U', nuevas: 'ru' },
  { titulo: 'O y T', nuevas: 'ot' },
  { titulo: 'C, N y M', nuevas: 'cnm' },
  { titulo: 'V, B y P', nuevas: 'vbp' },
  { titulo: 'Q, W, Y, Z y X', nuevas: 'qwyzx' },
  { titulo: 'Mayúsculas', nuevas: '', mayusculas: true },
  { titulo: 'Frases', nuevas: ',.', frases: true },
]

const PALABRAS = (
  'ala sal hada falda jaja gala daga salsa lado kilo lila dedo seda sello silla hija hijo fideo ' +
  'faja gallo dale lee ese sea dia idea seis feliz rosa ruta sur risa duro dura regla arde ' +
  'oso ojo todo toro tarde gato pato foto sol luz rio te tio tia oro hola dos tres ' +
  'casa cama mano mono nene nena luna mesa nido cine cuento canto amigo amiga comer cocina ' +
  'vaca boca beso bote pelo perro pan papa piso pelota barco bueno viento vida verde bonito ' +
  'queso yo ya ayer zapato taza zorro lapiz kiwi saxo examen ' +
  'año niño niña uña piña araña sueño mañana montaña baño leña'
).split(' ')
const FRASES = [
  'Mi perro se llama Toto.',
  'Hoy es un dia lindo.',
  'Me gusta pintar, leer y jugar.',
  'La luna sale de noche.',
  'Tengo una amiga que se llama Sol.',
  'El gato duerme en la cama.',
  'Mañana vamos a la plaza.',
  'Mi mama hace una torta de queso.',
]

const CLAVE = 'kidsos.teclado.progreso'
interface Progreso {
  estrellas: number[]
  record: number
}

function leerProgreso(): Progreso {
  try {
    const p = JSON.parse(localStorage.getItem(CLAVE) || 'null')
    if (p) return p
  } catch {}
  return { estrellas: [], record: 0 }
}
function guardarProgreso(p: Progreso) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(p))
  } catch {}
}

const azar = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)]

/** Letras que ya se saben al llegar a la lección i (incluida). */
function letrasHasta(i: number): string {
  return LECCIONES.slice(0, i + 1)
    .map((l) => l.nuevas)
    .join('')
    .replace(/[,.]/g, '')
}

/** Arma el texto para practicar. */
function textoLeccion(i: number): string {
  const l = LECCIONES[i]
  if (l.frases) {
    const f = [...FRASES].sort(() => Math.random() - 0.5)
    return f.slice(0, 3).join(' ')
  }
  const sabidas = letrasHasta(i)
  const palabras = PALABRAS.filter((p) => [...p].every((c) => sabidas.includes(c)))
  const partes: string[] = []
  if (l.mayusculas) {
    for (let k = 0; k < 10; k++) {
      const p = azar(palabras)
      partes.push(p[0].toUpperCase() + p.slice(1))
    }
    return partes.join(' ')
  }
  // Primero las teclas nuevas solas, después mezcladas con las conocidas, y palabras si hay.
  const nuevas = l.nuevas
  for (const c of nuevas) partes.push(c.repeat(3))
  for (let k = 0; k < 4; k++) partes.push(Array.from({ length: 3 }, () => azar([...nuevas])).join(''))
  for (let k = 0; k < 4; k++) partes.push(Array.from({ length: 3 + (k % 2) }, () => azar([...sabidas])).join(''))
  if (palabras.length >= 4) for (let k = 0; k < 5; k++) partes.push(azar(palabras))
  else for (let k = 0; k < 4; k++) partes.push(Array.from({ length: 4 }, () => azar([...sabidas])).join(''))
  return partes.join(' ')
}

function estrellasPor(precision: number) {
  return precision >= 0.95 ? 3 : precision >= 0.85 ? 2 : 1
}

export const teclado: Programa = {
  id: 'teclado',
  nombre: 'Teclado',
  icono: '⌨️',
  ancho: 980,
  alto: 680,
  abrir(v) {
    const raiz = el('div', 'teclado')
    v.cuerpo.append(raiz)
    let progreso = leerProgreso()
    // Lo que hace cada pantalla con las teclas.
    let alTecla: ((e: KeyboardEvent) => boolean) | null = null
    let alSalir: (() => void) | null = null

    function cambiarPantalla(armar: () => void) {
      alSalir?.()
      alSalir = null
      alTecla = null
      // Que el espacio no "apriete" el último botón que quedó con foco.
      ;(document.activeElement as HTMLElement | null)?.blur()
      raiz.replaceChildren()
      armar()
    }

    // ---------- Teclado en pantalla
    function dibujarTeclado(): { marcar: (c: string | null) => void; apretar: (c: string, bien: boolean) => void } {
      const t = el('div', 'tc-teclado')
      const teclas = new Map<string, HTMLElement>()
      FILAS.forEach((fila, i) => {
        const f = el('div', 'tc-fila')
        if (i === 2) {
          const sh = el('div', 'tc-tecla ancha shift-izq', '⇧')
          sh.style.background = DEDOS[0].color
          teclas.set('shift-izq', sh)
          f.append(sh)
        } else {
          const relleno = el('div', 'tc-hueco')
          relleno.style.width = `calc(var(--tc) * ${SANGRIA[i]})`
          f.append(relleno)
        }
        for (const c of fila) {
          const k = el('div', 'tc-tecla', c === '´' ? '´' : c.toUpperCase())
          k.style.background = DEDOS[DEDO[c] ?? 8].color
          if (c === 'f' || c === 'j') k.classList.add('rayita')
          teclas.set(c, k)
          f.append(k)
        }
        if (i === 2) {
          const sh = el('div', 'tc-tecla ancha shift-der', '⇧')
          sh.style.background = DEDOS[8].color
          teclas.set('shift-der', sh)
          f.append(sh)
        }
        t.append(f)
      })
      const fe = el('div', 'tc-fila')
      const esp = el('div', 'tc-tecla espacio', 'espacio')
      esp.style.background = DEDOS[4].color
      teclas.set(' ', esp)
      fe.append(esp)
      t.append(fe)

      const manos = el('div', 'tc-manos')
      const dedos = DEDOS.map((d, i) => {
        const x = el('div', 'tc-dedo' + (i === 4 ? ' pulgar' : ''))
        x.style.background = d.color
        x.title = d.nombre
        manos.append(x)
        return x
      })
      const ayuda = el('div', 'tc-ayuda')
      const caja = el('div', 'tc-caja-teclado')
      caja.append(t, manos, ayuda)
      raiz.append(caja)

      return {
        marcar(c) {
          teclas.forEach((k) => k.classList.remove('siguiente'))
          dedos.forEach((d) => d.classList.remove('activo'))
          if (c === null) {
            ayuda.textContent = ''
            return
          }
          const base = c.toLowerCase()
          teclas.get(base)?.classList.add('siguiente')
          const d = DEDO[base]
          if (d !== undefined) dedos[d].classList.add('activo')
          let texto = c === ' ' ? 'Espacio: con el pulgar' : `${c}: dedo ${DEDOS[d ?? 8].nombre}`
          if (c !== base) {
            // Mayúscula: Shift con la otra mano.
            const lado = MANO_IZQ(base) ? 'shift-der' : 'shift-izq'
            teclas.get(lado)?.classList.add('siguiente')
            dedos[lado === 'shift-der' ? 8 : 0].classList.add('activo')
            texto += ` · mantené apretado ⇧ con el meñique ${lado === 'shift-der' ? 'derecho' : 'izquierdo'}`
          }
          ayuda.textContent = texto
        },
        apretar(c, bien) {
          const k = teclas.get(c.toLowerCase())
          if (!k) return
          k.classList.remove('bien', 'mal')
          void k.offsetWidth
          k.classList.add(bien ? 'bien' : 'mal')
        },
      }
    }

    // ---------- Menú principal
    function menu() {
      cambiarPantalla(() => {
        raiz.append(el('div', 'tc-titulo', '⌨️ Aprender a escribir con los diez dedos'))
        raiz.append(el('div', 'tc-sub', 'Poné los dedos índice sobre la F y la J: tienen una rayita para encontrarlas sin mirar.'))
        const grilla = el('div', 'tc-lecciones')
        LECCIONES.forEach((l, i) => {
          const abierta = i === 0 || (progreso.estrellas[i - 1] ?? 0) > 0
          const e = progreso.estrellas[i] ?? 0
          const c = el('button', 'tc-leccion' + (abierta ? '' : ' cerrada'))
          c.append(
            el('div', 'tc-num', abierta ? String(i + 1) : '🔒'),
            el('div', 'tc-nombre', l.titulo),
            el('div', 'tc-estrellas', '★'.repeat(e) + '☆'.repeat(3 - e)),
          )
          c.disabled = !abierta
          c.onclick = () => leccion(i)
          grilla.append(c)
        })
        raiz.append(grilla)
        const juego = el('button', 'tc-juego')
        juego.append(el('div', 'tc-juego-icono', '🌧️'), el('div', '', 'Lluvia de letras'), el('div', 'tc-record', progreso.record ? `Récord: ${progreso.record}` : ''))
        juego.onclick = lluvia
        raiz.append(juego)
      })
    }

    // ---------- Una lección
    function leccion(i: number) {
      cambiarPantalla(() => {
        const texto = textoLeccion(i)
        let pos = 0
        let errores = 0
        let errorAca = false
        let inicio = 0

        const cabeza = el('div', 'tc-cabeza')
        const volver = el('button', 'boton chico', '← Volver')
        volver.onclick = menu
        const datos = el('div', 'tc-datos')
        cabeza.append(volver, el('div', 'tc-nombre-leccion', `Lección ${i + 1}: ${LECCIONES[i].titulo}`), datos)
        const renglon = el('div', 'tc-texto')
        const letras = [...texto].map((c) => {
          const s = el('span', 'tc-letra' + (c === ' ' ? ' esp' : ''), c === ' ' ? '·' : c)
          renglon.append(s)
          return s
        })
        raiz.append(cabeza, renglon)
        const kb = dibujarTeclado()

        const pintar = () => {
          letras.forEach((s, k) => {
            s.classList.toggle('hecha', k < pos)
            s.classList.toggle('actual', k === pos)
          })
          kb.marcar(pos < texto.length ? texto[pos] : null)
          const escritas = pos + errores
          const prec = escritas ? pos / escritas : 1
          const min = inicio ? (Date.now() - inicio) / 60000 : 0
          datos.textContent = `Bien: ${Math.round(prec * 100)}%` + (min > 0.05 ? ` · ${Math.round(pos / min)} letras por minuto` : '')
          letras[pos]?.scrollIntoView({ block: 'nearest' })
        }
        pintar()

        alTecla = (e) => {
          if (e.ctrlKey || e.altKey || e.metaKey || e.key.length !== 1) return e.key === ' '
          if (!inicio) inicio = Date.now()
          const esperado = texto[pos]
          const bien = e.key === esperado
          kb.apretar(e.key, bien)
          if (bien) {
            if (errorAca) letras[pos].classList.add('fallada')
            errorAca = false
            pos++
            if (pos >= texto.length) {
              terminar()
              return true
            }
          } else if (!errorAca) {
            // Se cuenta un error por letra: si se equivoca tres veces en la misma, es uno.
            errores++
            errorAca = true
            letras[pos].classList.add('error')
            setTimeout(() => letras[pos]?.classList.remove('error'), 300)
          }
          pintar()
          return true
        }

        function terminar() {
          const prec = pos / (pos + errores)
          const min = (Date.now() - inicio) / 60000
          const ppm = Math.round(pos / Math.max(min, 0.01))
          const est = estrellasPor(prec)
          progreso.estrellas[i] = Math.max(progreso.estrellas[i] ?? 0, est)
          guardarProgreso(progreso)
          resultado(i, est, prec, ppm)
        }
      })
    }

    function resultado(i: number, est: number, prec: number, ppm: number) {
      cambiarPantalla(() => {
        const c = el('div', 'tc-resultado')
        c.append(
          el('div', 'tc-gran-estrellas', '★'.repeat(est) + '☆'.repeat(3 - est)),
          el('div', 'tc-res-titulo', est === 3 ? '¡Excelente!' : est === 2 ? '¡Muy bien!' : '¡Bien! Probá de nuevo despacito, sin mirar las manos.'),
          el('div', 'tc-res-datos', `Acertaste el ${Math.round(prec * 100)}% · ${ppm} letras por minuto`),
        )
        const botones = el('div', 'tc-res-botones')
        const otra = el('button', 'boton', '↻ Otra vez')
        otra.onclick = () => leccion(i)
        const menuB = el('button', 'boton', 'Lecciones')
        menuB.onclick = menu
        botones.append(otra, menuB)
        if (i + 1 < LECCIONES.length) {
          const sig = el('button', 'boton principal', 'Siguiente →')
          sig.onclick = () => leccion(i + 1)
          botones.append(sig)
        }
        c.append(botones)
        raiz.append(c)
        alTecla = (e) => {
          if (e.key === 'Enter') (botones.lastElementChild as HTMLElement).click()
          return e.key === 'Enter'
        }
      })
    }

    // ---------- Lluvia de letras
    function lluvia() {
      cambiarPantalla(() => {
        // Letras de las lecciones que ya tienen estrella (como mínimo F y J).
        let hechas = 0
        while ((progreso.estrellas[hechas] ?? 0) > 0 && hechas < LECCIONES.length) hechas++
        const letrasJuego = [...letrasHasta(Math.max(0, hechas - 1))]

        const cabeza = el('div', 'tc-cabeza')
        const volver = el('button', 'boton chico', '← Volver')
        volver.onclick = menu
        const marcador = el('div', 'tc-datos')
        cabeza.append(volver, el('div', 'tc-nombre-leccion', '🌧️ Lluvia de letras'), marcador)
        const cielo = el('div', 'tc-cielo')
        raiz.append(cabeza, cielo)
        raiz.append(el('div', 'tc-sub', `Escribí cada letra antes de que toque el piso. Letras: ${letrasJuego.join(' ').toUpperCase()}`))

        type Gota = { c: string; x: number; y: number; e: HTMLElement }
        let gotas: Gota[] = []
        let puntos = 0
        let vidas = 3
        let velocidad = 40 // píxeles por segundo
        let cada = 1800 // ms entre gotas
        let ultima = 0
        let antes = performance.now()
        let vivo = true
        let cuadro = 0

        const ponerMarcador = () => (marcador.textContent = `Puntos: ${puntos} · ${'❤️'.repeat(vidas)}${'🤍'.repeat(3 - vidas)}`)
        ponerMarcador()

        const tic = (ahora: number) => {
          if (!vivo) return
          const dt = Math.min(0.1, (ahora - antes) / 1000)
          antes = ahora
          if (v.minimizada) {
            cuadro = requestAnimationFrame(tic)
            return
          }
          if (ahora - ultima > cada) {
            ultima = ahora
            const c = azar(letrasJuego)
            const e = el('div', 'tc-gota', c.toUpperCase())
            const x = 20 + Math.random() * Math.max(10, cielo.clientWidth - 80)
            e.style.left = x + 'px'
            cielo.append(e)
            gotas.push({ c, x, y: -50, e })
          }
          const piso = cielo.clientHeight - 50
          for (const g of gotas) {
            g.y += velocidad * dt
            g.e.style.transform = `translateY(${g.y}px)`
            if (g.y >= piso) {
              g.e.classList.add('cayo')
              setTimeout(() => g.e.remove(), 400)
              vidas--
              ponerMarcador()
            }
          }
          gotas = gotas.filter((g) => g.y < piso)
          if (vidas <= 0) return fin()
          cuadro = requestAnimationFrame(tic)
        }
        cuadro = requestAnimationFrame(tic)

        alTecla = (e) => {
          if (e.ctrlKey || e.altKey || e.key.length !== 1) return false
          // Se lleva la gota más baja de esa letra.
          const g = gotas.filter((x) => x.c === e.key.toLowerCase()).sort((a, b) => b.y - a.y)[0]
          if (!g) return true
          g.e.classList.add('reventada')
          setTimeout(() => g.e.remove(), 300)
          gotas = gotas.filter((x) => x !== g)
          puntos++
          if (puntos % 5 === 0) {
            velocidad *= 1.12
            cada = Math.max(600, cada * 0.9)
          }
          ponerMarcador()
          return true
        }

        function fin() {
          vivo = false
          const record = puntos > progreso.record
          if (record) {
            progreso.record = puntos
            guardarProgreso(progreso)
          }
          const c = el('div', 'tc-fin')
          c.append(el('div', 'tc-res-titulo', record ? `¡Récord nuevo: ${puntos}!` : `Hiciste ${puntos} puntos`))
          const b = el('div', 'tc-res-botones')
          const otra = el('button', 'boton principal', '↻ Jugar otra vez')
          otra.onclick = lluvia
          const m = el('button', 'boton', 'Lecciones')
          m.onclick = menu
          b.append(otra, m)
          c.append(b)
          cielo.append(c)
          alTecla = (e) => {
            if (e.key === 'Enter') lluvia()
            return e.key === 'Enter'
          }
        }

        alSalir = () => {
          vivo = false
          cancelAnimationFrame(cuadro)
        }
      })
    }

    menu()

    return {
      alTecla: (e) => alTecla?.(e) ?? false,
      async alCerrar() {
        alSalir?.()
        return true
      },
    }
  },
}
