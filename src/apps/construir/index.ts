// Construir: modelado 3D, la idea de SketchUp en chiquito.
// Enseña: dibujar en el piso un rectángulo o un círculo, Empujar/Tirar para
// levantarlo, escribir la medida exacta (cuadro de Medidas), pintar caras con
// materiales, mover, borrar, orbitar y ver todo. Medidas en cm, con una figura
// de 1,20 m (el tamaño de ella) para comparar.

import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import * as fs from '../../os/archivos'
import { pedirNombre, preguntarSiGuarda } from '../../os/documento'
import { elegirArchivo } from '../../os/selector'
import { aviso, barraMenu, el } from '../../os/ui'
import type { Programa } from '../../os/ventanas'

type Herr = 'seleccionar' | 'rect' | 'circulo' | 'empujar' | 'mover' | 'pintar' | 'borrar' | 'orbitar' | 'mano'
const HERRAMIENTAS: { id: Herr; icono: string; nombre: string; tecla: string; ayuda: string }[] = [
  { id: 'seleccionar', icono: '↖', nombre: 'Seleccionar', tecla: 'Espacio', ayuda: 'Hacé clic en algo para elegirlo. Supr lo borra.' },
  { id: 'rect', icono: '▭', nombre: 'Rectángulo', tecla: 'R', ayuda: 'Clic en una esquina y clic en la otra. O escribí las medidas: 300;200 y Enter.' },
  { id: 'circulo', icono: '◯', nombre: 'Círculo', tecla: 'C', ayuda: 'Clic en el centro y clic para el tamaño. O escribí el radio y Enter.' },
  { id: 'empujar', icono: '⇧', nombre: 'Empujar/Tirar', tecla: 'P', ayuda: 'Clic en una cara, mové el mouse y clic. O escribí cuánto (ej. 250) y Enter.' },
  { id: 'mover', icono: '✥', nombre: 'Mover', tecla: 'M', ayuda: 'Clic en algo, mové el mouse y clic donde va.' },
  { id: 'pintar', icono: '🪣', nombre: 'Pintar', tecla: 'B', ayuda: 'Elegí un material abajo y hacé clic en una cara. Con Ctrl pinta todas las caras.' },
  { id: 'borrar', icono: '🧽', nombre: 'Borrar', tecla: 'E', ayuda: 'Clic en lo que quieras borrar.' },
  { id: 'orbitar', icono: '🔄', nombre: 'Orbitar', tecla: 'O', ayuda: 'Arrastrá para dar vueltas alrededor. (También con la rueda apretada.)' },
  { id: 'mano', icono: '✋', nombre: 'Desplazar', tecla: 'H', ayuda: 'Arrastrá para correr la vista. La rueda acerca y aleja.' },
]

// Materiales: colores, texturas dibujadas acá mismo, y vidrio.
const MATERIALES: { id: string; nombre: string; muestra: string }[] = [
  { id: 'c:#ffffff', nombre: 'Blanco', muestra: '#ffffff' },
  { id: 'c:#bdbdbd', nombre: 'Gris', muestra: '#bdbdbd' },
  { id: 'c:#e53935', nombre: 'Rojo', muestra: '#e53935' },
  { id: 'c:#fdd835', nombre: 'Amarillo', muestra: '#fdd835' },
  { id: 'c:#43a047', nombre: 'Verde', muestra: '#43a047' },
  { id: 'c:#1e88e5', nombre: 'Azul', muestra: '#1e88e5' },
  { id: 'c:#f48fb1', nombre: 'Rosa', muestra: '#f48fb1' },
  { id: 't:ladrillo', nombre: 'Ladrillo', muestra: '#b5532f' },
  { id: 't:madera', nombre: 'Madera', muestra: '#a0703c' },
  { id: 't:pasto', nombre: 'Pasto', muestra: '#5d9b3a' },
  { id: 't:baldosa', nombre: 'Baldosa', muestra: '#cfd2d4' },
  { id: 't:tejas', nombre: 'Tejas', muestra: '#a33b20' },
  { id: 'vidrio', nombre: 'Vidrio', muestra: '#9fd3f5' },
]
const BLANCO = 'c:#f5f5f5'

type Obj =
  | { id: string; tipo: 'caja'; x: number; y: number; z: number; w: number; h: number; d: number; mats: string[] }
  | { id: string; tipo: 'cilindro'; x: number; y: number; z: number; r: number; h: number; mats: string[] }
  | { id: string; tipo: 'persona'; x: number; y: number; z: number }

interface Datos {
  objs: Obj[]
}
const PLANO = 0.1 // lo que mide de alto algo recién dibujado (una cara)

function textura(id: string): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  const azar = (() => {
    let s = 7
    return () => ((s = (s * 9301 + 49297) % 233280) / 233280)
  })()
  if (id === 'ladrillo') {
    g.fillStyle = '#d8cfc4'
    g.fillRect(0, 0, 256, 256)
    for (let f = 0; f < 8; f++)
      for (let k = -1; k < 4; k++) {
        g.fillStyle = `hsl(${12 + azar() * 8}, 55%, ${36 + azar() * 10}%)`
        g.fillRect(k * 80 + (f % 2) * 40 + 3, f * 32 + 3, 74, 26)
      }
  } else if (id === 'madera') {
    g.fillStyle = '#b07d48'
    g.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 40; i++) {
      g.strokeStyle = `rgba(90,55,20,${0.15 + azar() * 0.25})`
      g.lineWidth = 1 + azar() * 3
      const y = azar() * 256
      g.beginPath()
      g.moveTo(0, y)
      g.bezierCurveTo(80, y + azar() * 10 - 5, 170, y + azar() * 10 - 5, 256, y)
      g.stroke()
    }
  } else if (id === 'pasto') {
    g.fillStyle = '#5d9b3a'
    g.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 1800; i++) {
      g.fillStyle = `hsl(${95 + azar() * 25}, 50%, ${28 + azar() * 22}%)`
      g.fillRect(azar() * 256, azar() * 256, 2, 4)
    }
  } else if (id === 'baldosa') {
    for (let f = 0; f < 4; f++)
      for (let k = 0; k < 4; k++) {
        g.fillStyle = (f + k) % 2 ? '#d7dadc' : '#c3c7ca'
        g.fillRect(k * 64, f * 64, 64, 64)
      }
    g.strokeStyle = '#9aa0a4'
    for (let i = 0; i <= 256; i += 64) {
      g.strokeRect(i, -1, 0, 258)
      g.strokeRect(-1, i, 258, 0)
    }
  } else if (id === 'tejas') {
    g.fillStyle = '#7a2a14'
    g.fillRect(0, 0, 256, 256)
    for (let f = 0; f < 8; f++)
      for (let k = -1; k < 9; k++) {
        g.fillStyle = `hsl(${10 + azar() * 6}, 62%, ${34 + azar() * 8}%)`
        g.beginPath()
        g.arc(k * 32 + (f % 2) * 16 + 16, f * 32 + 8, 15, 0, Math.PI)
        g.fill()
      }
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export const construir: Programa = {
  id: 'construir',
  nombre: 'Construir',
  icono: '🏠',
  ancho: 1180,
  alto: 740,
  abrir(win, archivoId) {
    let objs: Obj[] = [{ id: fs.nuevoId(), tipo: 'persona', x: -120, y: 0, z: 120 }]
    let herr: Herr = 'rect'
    let material = 't:ladrillo'
    let elegido: string | null = null
    let archivo: fs.Archivo | null = null
    const hechas = new Set<string>() // lo que ya hizo (para el guía de las misiones)
    const hizo = (a: string) => hechas.add(a)
    let cambios = false
    const atras: string[] = []
    const adelante: string[] = []

    // ---------- Armado
    const raiz = el('div', 'construir')
    const menu = barraMenu([
      {
        titulo: 'Archivo',
        items: [
          { texto: 'Nuevo', atajo: 'Ctrl+N', accion: () => nuevo() },
          { texto: 'Abrir…', atajo: 'Ctrl+O', accion: () => abrirOtro() },
          '-',
          { texto: 'Guardar', atajo: 'Ctrl+S', accion: () => guardar() },
          { texto: 'Guardar como…', accion: () => guardar(true) },
          '-',
          { texto: 'Cerrar', accion: async () => (await puedeSeguir()) && win.cerrar() },
        ],
      },
      {
        titulo: 'Edición',
        items: [
          { texto: 'Deshacer', atajo: 'Ctrl+Z', accion: () => deshacer(), activo: () => atras.length > 0 },
          { texto: 'Rehacer', atajo: 'Ctrl+Y', accion: () => rehacer(), activo: () => adelante.length > 0 },
          '-',
          { texto: 'Borrar', atajo: 'Supr', accion: () => borrarElegido(), activo: () => !!elegido },
        ],
      },
      {
        titulo: 'Cámara',
        items: [
          { texto: 'Ver todo', atajo: 'Mayús+Z', accion: () => verTodo() },
          { texto: 'Desde arriba (planta)', accion: () => vistaDesde('arriba') },
          { texto: 'De frente', accion: () => vistaDesde('frente') },
          { texto: 'En perspectiva', accion: () => vistaDesde('perspectiva') },
        ],
      },
      {
        titulo: 'Herramientas',
        items: HERRAMIENTAS.map((h) => ({ texto: h.nombre, atajo: h.tecla, accion: () => ponerHerr(h.id) })),
      },
    ])
    const barra = el('div', 'cs-barra')
    const cuerpo = el('div', 'cs-cuerpo')
    const zona = el('div', 'cs-zona')
    const materiales = el('div', 'cs-materiales')
    cuerpo.append(zona, materiales)
    const abajo = el('div', 'cs-abajo')
    const ayuda = el('span', 'cs-ayuda')
    const vcbTexto = el('span', 'cs-vcb-texto', 'Medidas')
    const vcb = el('input', 'cs-vcb')
    vcb.spellcheck = false
    abajo.append(ayuda, vcbTexto, vcb)
    raiz.append(menu, barra, cuerpo, abajo)
    win.cuerpo.append(raiz)

    for (const h of HERRAMIENTAS) {
      const b = el('button', 'cs-herr')
      b.dataset.h = h.id
      b.append(el('span', 'cs-herr-icono', h.icono), el('span', 'cs-herr-texto', h.nombre))
      b.title = `${h.nombre} (${h.tecla})`
      b.onclick = () => ponerHerr(h.id)
      barra.append(b)
    }
    const bTodo = el('button', 'cs-herr')
    bTodo.append(el('span', 'cs-herr-icono', '⛶'), el('span', 'cs-herr-texto', 'Ver todo'))
    bTodo.title = 'Ver todo (Mayús+Z)'
    bTodo.onclick = () => verTodo()
    barra.append(bTodo)

    function dibujarMateriales() {
      materiales.replaceChildren(el('div', 'cs-mat-titulo', 'Materiales'))
      for (const m of MATERIALES) {
        const b = el('button', 'cs-mat' + (m.id === material ? ' activo' : ''))
        const mu = el('span', 'cs-mat-muestra')
        if (m.id.startsWith('t:')) mu.style.backgroundImage = `url(${(texturas.get(m.id.slice(2)) ?? obtenerTextura(m.id.slice(2))).image.toDataURL()})`
        else mu.style.background = m.muestra
        if (m.id === 'vidrio') mu.style.opacity = '0.6'
        b.append(mu, el('span', '', m.nombre))
        b.onclick = () => {
          material = m.id
          ponerHerr('pintar')
          dibujarMateriales()
        }
        materiales.append(b)
      }
    }

    // ---------- Escena
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.setPixelRatio(devicePixelRatio)
    zona.append(renderer.domElement)
    const escena = new THREE.Scene()
    escena.background = new THREE.Color('#dce9f5')
    const camara = new THREE.PerspectiveCamera(45, 1, 5, 50000)
    camara.position.set(700, 520, 800)
    const controles = new OrbitControls(camara, renderer.domElement)
    controles.target.set(0, 60, 0)
    controles.enableDamping = false
    controles.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.PAN }
    controles.addEventListener('change', () => pedirDibujo())
    // Solo cuando la mueve ella con el mouse (no cuando el programa acomoda la cámara).
    controles.addEventListener('start', () => hizo('orbitar'))

    escena.add(new THREE.HemisphereLight('#ffffff', '#b9c4a8', 1.6))
    const sol = new THREE.DirectionalLight('#ffffff', 1.8)
    sol.position.set(800, 1500, 600)
    sol.castShadow = true
    sol.shadow.mapSize.set(2048, 2048)
    Object.assign(sol.shadow.camera, { left: -2500, right: 2500, top: 2500, bottom: -2500, near: 10, far: 6000 })
    sol.shadow.bias = -0.0005
    escena.add(sol)
    // Piso con sombras, cuadrícula de 1 m y los ejes (rojo, verde, azul como en SketchUp).
    const piso = new THREE.Mesh(new THREE.PlaneGeometry(20000, 20000), new THREE.ShadowMaterial({ opacity: 0.18 }))
    piso.rotation.x = -Math.PI / 2
    piso.receiveShadow = true
    escena.add(piso)
    const grilla = new THREE.GridHelper(4000, 40, '#b8c4cc', '#cfd8de')
    grilla.position.y = -0.2
    escena.add(grilla)
    const ejes = new THREE.Group()
    const eje = (a: THREE.Vector3, color: string, punteado: boolean) => {
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), a])
      const l = new THREE.Line(g, punteado ? new THREE.LineDashedMaterial({ color, dashSize: 20, gapSize: 15 }) : new THREE.LineBasicMaterial({ color }))
      if (punteado) l.computeLineDistances()
      ejes.add(l)
    }
    eje(new THREE.Vector3(6000, 0, 0), '#e53935', false)
    eje(new THREE.Vector3(-6000, 0, 0), '#e53935', true)
    eje(new THREE.Vector3(0, 0, -6000), '#43a047', false)
    eje(new THREE.Vector3(0, 0, 6000), '#43a047', true)
    eje(new THREE.Vector3(0, 6000, 0), '#1e88e5', false)
    escena.add(ejes)

    const modelo = new THREE.Group()
    escena.add(modelo)
    const ayudas = new THREE.Group() // vistas previas, cara resaltada, puntero
    escena.add(ayudas)

    const texturas = new Map<string, THREE.CanvasTexture>()
    function obtenerTextura(id: string) {
      let t = texturas.get(id)
      if (!t) {
        t = textura(id)
        texturas.set(id, t)
      }
      return t
    }

    /** Material de una cara; las texturas se repiten cada 1 m según el tamaño de la cara. */
    function mat(id: string, ancho: number, alto: number): THREE.Material {
      if (id === 'vidrio') return new THREE.MeshStandardMaterial({ color: '#9fd3f5', transparent: true, opacity: 0.4, roughness: 0.1, depthWrite: false })
      if (id.startsWith('t:')) {
        const t = obtenerTextura(id.slice(2)).clone()
        t.needsUpdate = true
        t.repeat.set(Math.max(0.1, ancho / 100), Math.max(0.1, alto / 100))
        return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 })
      }
      return new THREE.MeshStandardMaterial({ color: id.slice(2), roughness: 0.85 })
    }

    function construirMalla(o: Obj, elegidoAhora: boolean): THREE.Object3D {
      const g = new THREE.Group()
      g.userData.id = o.id
      if (o.tipo === 'persona') {
        // Figura de referencia: 1,20 m.
        const ropa = new THREE.MeshStandardMaterial({ color: '#ec407a' })
        const piel = new THREE.MeshStandardMaterial({ color: '#f1c27d' })
        const pierna = new THREE.MeshStandardMaterial({ color: '#3949ab' })
        const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(15, 19, 42, 20), ropa)
        cuerpo.position.y = 70
        const cabeza = new THREE.Mesh(new THREE.SphereGeometry(13, 20, 16), piel)
        cabeza.position.y = 105
        const p1 = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 50, 12), pierna)
        p1.position.set(-8, 25, 0)
        const p2 = p1.clone()
        p2.position.x = 8
        for (const m of [cuerpo, cabeza, p1, p2]) {
          m.castShadow = true
          m.userData.id = o.id
          g.add(m)
        }
        g.position.set(o.x, o.y, o.z)
        if (elegidoAhora) {
          const caja = new THREE.BoxHelper(g, '#1565c0')
          g.add(caja)
        }
        return g
      }
      let geo: THREE.BufferGeometry
      let mats: THREE.Material[]
      if (o.tipo === 'caja') {
        geo = new THREE.BoxGeometry(o.w, o.h, o.d)
        // Orden de caras de three: +x, -x, +y, -y, +z, -z
        const tam: [number, number][] = [[o.d, o.h], [o.d, o.h], [o.w, o.d], [o.w, o.d], [o.w, o.h], [o.w, o.h]]
        mats = o.mats.map((m, i) => mat(m, ...tam[i]))
      } else {
        geo = new THREE.CylinderGeometry(o.r, o.r, o.h, 48)
        // Orden: costado, tapa de arriba, tapa de abajo.
        mats = [mat(o.mats[0], Math.PI * 2 * o.r, o.h), mat(o.mats[1], o.r * 2, o.r * 2), mat(o.mats[2], o.r * 2, o.r * 2)]
      }
      const malla = new THREE.Mesh(geo, mats)
      malla.castShadow = malla.receiveShadow = true
      malla.userData.id = o.id
      const bordes = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), new THREE.LineBasicMaterial({ color: elegidoAhora ? '#1565c0' : '#1a1a1a' }))
      g.add(malla, bordes)
      if (o.tipo === 'caja') g.position.set(o.x + o.w / 2, o.y + o.h / 2, o.z + o.d / 2)
      else g.position.set(o.x, o.y + o.h / 2, o.z)
      return g
    }

    function reconstruir() {
      for (const h of [...modelo.children]) {
        h.traverse((x) => {
          const m = x as THREE.Mesh
          m.geometry?.dispose()
          const ms = m.material
          if (Array.isArray(ms)) ms.forEach((y) => y.dispose())
          else (ms as THREE.Material | undefined)?.dispose?.()
        })
        modelo.remove(h)
      }
      for (const o of objs) modelo.add(construirMalla(o, o.id === elegido))
      pedirDibujo()
    }

    let pedido = false
    function pedirDibujo() {
      if (pedido) return
      pedido = true
      requestAnimationFrame(() => {
        pedido = false
        renderer.render(escena, camara)
      })
    }
    function medir() {
      const w = zona.clientWidth
      const h = zona.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h)
      camara.aspect = w / h
      camara.updateProjectionMatrix()
      pedirDibujo()
    }
    const obs = new ResizeObserver(medir)
    obs.observe(zona)

    // ---------- Puntería
    const rayo = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    function apuntar(e: { clientX: number; clientY: number }) {
      const r = renderer.domElement.getBoundingClientRect()
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      rayo.setFromCamera(ndc, camara)
    }
    function golpe(): { obj: Obj; cara: number; punto: THREE.Vector3; normal: THREE.Vector3 } | null {
      const hits = rayo.intersectObjects(modelo.children, true).filter((h) => (h.object as THREE.Mesh).isMesh)
      for (const h of hits) {
        const o = objs.find((x) => x.id === h.object.userData.id)
        if (!o) continue
        const cara = h.face?.materialIndex ?? 0
        const normal = h.face ? h.face.normal.clone() : new THREE.Vector3(0, 1, 0)
        return { obj: o, cara, punto: h.point.clone(), normal }
      }
      return null
    }
    const redondear = (n: number, alt: boolean) => (alt ? Math.round(n) : Math.round(n / 10) * 10)
    /** Punto sobre el piso o sobre una cara de arriba (donde se dibuja). Va saltando de a 10 cm. */
    function puntoDeDibujo(e: PointerEvent): { p: THREE.Vector3; y: number } | null {
      apuntar(e)
      const g = golpe()
      if (g && g.obj.tipo !== 'persona' && g.normal.y > 0.9) {
        const y = g.obj.y + (g.obj.tipo === 'caja' ? g.obj.h : g.obj.h)
        return { p: new THREE.Vector3(redondear(g.punto.x, e.altKey), y, redondear(g.punto.z, e.altKey)), y }
      }
      return enPlano(e, 0)
    }
    function enPlano(e: PointerEvent, y: number): { p: THREE.Vector3; y: number } | null {
      apuntar(e)
      const p = new THREE.Vector3()
      if (!rayo.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), p)) return null
      return { p: new THREE.Vector3(redondear(p.x, e.altKey), y, redondear(p.z, e.altKey)), y }
    }

    // ---------- Ayudas visuales
    function limpiarAyudas() {
      for (const h of [...ayudas.children]) {
        h.traverse((x) => (x as THREE.Mesh).geometry?.dispose())
        ayudas.remove(h)
      }
    }
    function puntero(p: THREE.Vector3) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(4, 12, 8), new THREE.MeshBasicMaterial({ color: '#1565c0', depthTest: false }))
      m.position.copy(p)
      m.renderOrder = 10
      ayudas.add(m)
    }
    function resaltarCara(o: Obj, cara: number) {
      if (o.tipo === 'persona') return
      const material = new THREE.MeshBasicMaterial({ color: '#1e88e5', transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthTest: false })
      let m: THREE.Mesh
      if (o.tipo === 'caja') {
        const eje = Math.floor(cara / 2)
        const mas = cara % 2 === 0
        const dims = [o.w, o.h, o.d]
        const geo = eje === 0 ? new THREE.PlaneGeometry(o.d, o.h) : eje === 1 ? new THREE.PlaneGeometry(o.w, o.d) : new THREE.PlaneGeometry(o.w, o.h)
        m = new THREE.Mesh(geo, material)
        const c = new THREE.Vector3(o.x + o.w / 2, o.y + o.h / 2, o.z + o.d / 2)
        const off = (mas ? 1 : -1) * (dims[eje] / 2 + 0.3)
        if (eje === 0) {
          m.rotation.y = Math.PI / 2
          c.x += off
        } else if (eje === 1) {
          m.rotation.x = -Math.PI / 2
          c.y += off
        } else c.z += off
        m.position.copy(c)
      } else {
        if (cara === 0) return
        m = new THREE.Mesh(new THREE.CircleGeometry(o.r, 48), material)
        m.rotation.x = -Math.PI / 2
        m.position.set(o.x, cara === 1 ? o.y + o.h + 0.3 : o.y - 0.3, o.z)
      }
      m.renderOrder = 9
      ayudas.add(m)
    }

    // ---------- Operación en curso (con lo que se escribe en Medidas)
    type Op =
      | { tipo: 'rect'; a: THREE.Vector3; y: number; b: THREE.Vector3 }
      | { tipo: 'circulo'; c: THREE.Vector3; y: number; r: number }
      | { tipo: 'empujar'; obj: Obj; cara: number; antes: Obj; x0: number; y0: number; sx: number; sy: number; dist: number }
      | { tipo: 'mover'; obj: Obj; antes: Obj; base: THREE.Vector3; y: number; d: THREE.Vector3 }
    let op: Op | null = null
    let ultimoEmpuje: { id: string; cara: number; antes: Obj } | null = null
    let bajado: { x: number; y: number } | null = null

    function guardarPaso() {
      atras.push(JSON.stringify(objs))
      if (atras.length > 100) atras.shift()
      adelante.length = 0
      if (!cambios) {
        cambios = true
        ponerTitulo()
      }
    }
    function deshacer() {
      cancelar()
      const p = atras.pop()
      if (p === undefined) return
      adelante.push(JSON.stringify(objs))
      objs = JSON.parse(p)
      elegido = null
      ultimoEmpuje = null
      reconstruir()
    }
    function rehacer() {
      const p = adelante.pop()
      if (p === undefined) return
      atras.push(JSON.stringify(objs))
      objs = JSON.parse(p)
      reconstruir()
    }

    /** Aplica un empuje: la cara se corre `d` cm hacia afuera (negativo = hacia adentro). */
    function empujar(o: Obj, antes: Obj, cara: number, d: number) {
      if (o.tipo === 'caja' && antes.tipo === 'caja') {
        const eje = Math.floor(cara / 2)
        const mas = cara % 2 === 0
        const k = (['w', 'h', 'd'] as const)[eje]
        const pos = (['x', 'y', 'z'] as const)[eje]
        const nuevo = Math.max(PLANO, antes[k] + d)
        o[k] = Math.round(nuevo * 10) / 10
        o[pos] = mas ? antes[pos] : Math.round((antes[pos] + antes[k] - o[k]) * 10) / 10
      } else if (o.tipo === 'cilindro' && antes.tipo === 'cilindro') {
        if (cara === 0) {
          o.r = Math.max(1, Math.round((antes.r + d) * 10) / 10)
        } else {
          o.h = Math.max(PLANO, Math.round((antes.h + d) * 10) / 10)
          o.y = cara === 1 ? antes.y : Math.round((antes.y + antes.h - o.h) * 10) / 10
        }
      }
    }

    function terminarOp() {
      if (!op) return
      if (op.tipo === 'rect') {
        const { a, b, y } = op
        const w = Math.abs(b.x - a.x)
        const d = Math.abs(b.z - a.z)
        if (w >= 1 && d >= 1) {
          guardarPaso()
          const o: Obj = { id: fs.nuevoId(), tipo: 'caja', x: Math.min(a.x, b.x), y, z: Math.min(a.z, b.z), w, h: PLANO, d, mats: Array(6).fill(BLANCO) }
          objs.push(o)
          ayuda.textContent = `Rectángulo de ${w} × ${d} cm. Ahora usá Empujar/Tirar (P) para levantarlo.`
        }
      } else if (op.tipo === 'circulo') {
        if (op.r >= 1) {
          guardarPaso()
          objs.push({ id: fs.nuevoId(), tipo: 'cilindro', x: op.c.x, y: op.y, z: op.c.z, r: op.r, h: PLANO, mats: [BLANCO, BLANCO, BLANCO] })
          ayuda.textContent = `Círculo de radio ${op.r} cm. Ahora usá Empujar/Tirar (P) para levantarlo.`
        }
      } else if (op.tipo === 'empujar') {
        ultimoEmpuje = { id: op.obj.id, cara: op.cara, antes: op.antes }
      }
      op = null
      vcb.value = ''
      limpiarAyudas()
      reconstruir()
    }

    function cancelar() {
      if (op?.tipo === 'empujar' || op?.tipo === 'mover') {
        // Vuelve a como estaba.
        const id = op.obj.id
        const i = objs.findIndex((x) => x.id === id)
        if (i >= 0) objs[i] = op.antes
        atras.pop()
      }
      op = null
      vcb.value = ''
      limpiarAyudas()
      reconstruir()
    }

    // ---------- Mouse
    const lienzo = renderer.domElement
    lienzo.addEventListener('contextmenu', (e) => e.preventDefault())

    lienzo.addEventListener('pointermove', (e) => {
      if (herr === 'orbitar' || herr === 'mano') return
      limpiarAyudas()
      if (op?.tipo === 'rect') {
        const q = enPlano(e, op.y)
        if (q) op.b = q.p
        const w = Math.abs(op.b.x - op.a.x)
        const d = Math.abs(op.b.z - op.a.z)
        if (w && d) {
          const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color: '#1e88e5', transparent: true, opacity: 0.3, side: THREE.DoubleSide }))
          m.rotation.x = -Math.PI / 2
          m.position.set((op.a.x + op.b.x) / 2, op.y + 0.5, (op.a.z + op.b.z) / 2)
          ayudas.add(m)
        }
        vcb.placeholder = `${w};${d}`
      } else if (op?.tipo === 'circulo') {
        const q = enPlano(e, op.y)
        if (q) op.r = Math.round(Math.hypot(q.p.x - op.c.x, q.p.z - op.c.z))
        if (op.r) {
          const m = new THREE.Mesh(new THREE.CircleGeometry(op.r, 48), new THREE.MeshBasicMaterial({ color: '#1e88e5', transparent: true, opacity: 0.3, side: THREE.DoubleSide }))
          m.rotation.x = -Math.PI / 2
          m.position.set(op.c.x, op.y + 0.5, op.c.z)
          ayudas.add(m)
        }
        vcb.placeholder = String(op.r)
      } else if (op?.tipo === 'empujar') {
        // Cuánto se movió el mouse a lo largo de la dirección de la cara (medida en pantalla al empezar).
        const largo = Math.hypot(op.sx, op.sy) || 1
        const mov = ((e.clientX - op.x0) * op.sx + (e.clientY - op.y0) * op.sy) / largo
        op.dist = (e.altKey ? Math.round : (n: number) => Math.round(n / 5) * 5)((mov / largo) * 100)
        empujar(op.obj, op.antes, op.cara, op.dist)
        vcb.placeholder = String(op.dist)
        reconstruir()
        resaltarCara(op.obj, op.cara)
      } else if (op?.tipo === 'mover') {
        const q = enPlano(e, op.y)
        if (q) {
          op.d = q.p.clone().sub(op.base)
          const o = op.obj
          const a = op.antes
          o.x = a.x + op.d.x
          o.z = a.z + op.d.z
          vcb.placeholder = String(Math.round(op.d.length()))
          reconstruir()
        }
      } else if (herr === 'rect' || herr === 'circulo') {
        const q = puntoDeDibujo(e)
        if (q) puntero(q.p)
      } else if (herr === 'empujar' || herr === 'pintar') {
        apuntar(e)
        const g = golpe()
        if (g) resaltarCara(g.obj, g.cara)
      }
      pedirDibujo()
    })

    lienzo.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || herr === 'orbitar' || herr === 'mano') return
      vcb.focus({ preventScroll: true })
      bajado = { x: e.clientX, y: e.clientY }
      if (op) return terminarOp()
      if (herr === 'rect' || herr === 'circulo') {
        const q = puntoDeDibujo(e)
        if (!q) return
        op = herr === 'rect' ? { tipo: 'rect', a: q.p, y: q.y, b: q.p.clone() } : { tipo: 'circulo', c: q.p, y: q.y, r: 0 }
        return
      }
      apuntar(e)
      const g = golpe()
      if (herr === 'seleccionar') {
        elegido = g ? g.obj.id : null
        reconstruir()
      } else if (herr === 'borrar') {
        if (!g) return
        guardarPaso()
        objs = objs.filter((x) => x !== g.obj)
        reconstruir()
      } else if (herr === 'pintar') {
        if (!g || g.obj.tipo === 'persona') return
        guardarPaso()
        if (e.ctrlKey) g.obj.mats = g.obj.mats.map(() => material)
        else g.obj.mats[g.cara] = material
        hizo('pintar:' + material)
        if (e.ctrlKey) hizo('pintar-todo')
        reconstruir()
      } else if (herr === 'empujar') {
        if (!g || g.obj.tipo === 'persona') return
        if (g.obj.tipo === 'cilindro' && g.cara === 0) return void (ayuda.textContent = 'En un cilindro se empuja la tapa de arriba o la de abajo.')
        guardarPaso()
        const eje = g.obj.tipo === 'caja' ? [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)][Math.floor(g.cara / 2)].multiplyScalar(g.cara % 2 === 0 ? 1 : -1) : new THREE.Vector3(0, g.cara === 1 ? 1 : -1, 0)
        // Cuántos píxeles de pantalla son 100 cm en la dirección de la cara, desde el punto tocado.
        const r = lienzo.getBoundingClientRect()
        const p0 = g.punto.clone().project(camara)
        const p1 = g.punto.clone().add(eje.multiplyScalar(100)).project(camara)
        const sx = ((p1.x - p0.x) * r.width) / 2
        const sy = (-(p1.y - p0.y) * r.height) / 2
        op = { tipo: 'empujar', obj: g.obj, cara: g.cara, antes: JSON.parse(JSON.stringify(g.obj)), x0: e.clientX, y0: e.clientY, sx, sy, dist: 0 }
      } else if (herr === 'mover') {
        if (!g) return
        guardarPaso()
        const q = enPlano(e, 0)
        if (!q) return
        op = { tipo: 'mover', obj: g.obj, antes: JSON.parse(JSON.stringify(g.obj)), base: q.p, y: 0, d: new THREE.Vector3() }
      }
    })
    // Si arrastró (en vez de clic, mover, clic), al soltar termina.
    lienzo.addEventListener('pointerup', (e) => {
      if (op && bajado && Math.hypot(e.clientX - bajado.x, e.clientY - bajado.y) > 6) terminarOp()
      bajado = null
    })

    // ---------- Medidas escritas (como la caja de Medidas de SketchUp)
    function aplicarMedida(t: string) {
      hizo('medida')
      const nums = t.split(/[;]/).map((x) => Number(x.trim().replace(',', '.')))
      if (nums.some((n) => !Number.isFinite(n))) return void (ayuda.textContent = 'Escribí números: 300, o 300;200.')
      if (op?.tipo === 'rect') {
        const sx = Math.sign(op.b.x - op.a.x) || 1
        const sz = Math.sign(op.b.z - op.a.z) || 1
        op.b = new THREE.Vector3(op.a.x + sx * nums[0], op.y, op.a.z + sz * (nums[1] ?? nums[0]))
        terminarOp()
      } else if (op?.tipo === 'circulo') {
        op.r = nums[0]
        terminarOp()
      } else if (op?.tipo === 'empujar') {
        op.dist = nums[0] * (op.dist < 0 ? -1 : 1)
        empujar(op.obj, op.antes, op.cara, op.dist)
        terminarOp()
      } else if (op?.tipo === 'mover') {
        const dir = op.d.length() ? op.d.clone().normalize() : new THREE.Vector3(1, 0, 0)
        op.obj.x = (op.antes as { x: number }).x + dir.x * nums[0]
        op.obj.z = (op.antes as { z: number }).z + dir.z * nums[0]
        terminarOp()
      } else if (ultimoEmpuje) {
        // Después de empujar, escribir una medida la corrige (como en SketchUp).
        const o = objs.find((x) => x.id === ultimoEmpuje!.id)
        if (!o) return
        guardarPaso()
        empujar(o, ultimoEmpuje.antes, ultimoEmpuje.cara, nums[0])
        reconstruir()
      }
      vcb.value = ''
    }
    vcb.addEventListener('keydown', (e) => {
      e.stopPropagation()
      if (e.key === 'Enter') {
        e.preventDefault()
        if (vcb.value.trim()) aplicarMedida(vcb.value)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        cancelar()
      } else if (!/^[\d;,.\-]$/.test(e.key) && e.key.length === 1 && !e.ctrlKey) {
        // Las letras son atajos de herramientas, no medidas.
        e.preventDefault()
        teclaGeneral(e)
      } else if (e.ctrlKey || e.key === 'Delete' || e.key.startsWith('F')) {
        if (teclaGeneral(e)) e.preventDefault()
      }
    })

    // ---------- Herramientas
    function ponerHerr(h: Herr) {
      if (op) cancelar()
      herr = h
      controles.mouseButtons = {
        LEFT: h === 'orbitar' ? THREE.MOUSE.ROTATE : h === 'mano' ? THREE.MOUSE.PAN : null,
        MIDDLE: THREE.MOUSE.ROTATE,
        RIGHT: THREE.MOUSE.PAN,
      }
      lienzo.style.cursor = h === 'orbitar' || h === 'mano' ? 'grab' : h === 'seleccionar' ? 'default' : 'crosshair'
      barra.querySelectorAll<HTMLElement>('.cs-herr').forEach((b) => b.classList.toggle('activa', b.dataset.h === h))
      const info = HERRAMIENTAS.find((x) => x.id === h)!
      ayuda.textContent = info.ayuda
      vcbTexto.textContent = h === 'circulo' ? 'Radio' : h === 'empujar' || h === 'mover' ? 'Distancia' : 'Medidas'
      vcb.placeholder = ''
      limpiarAyudas()
      pedirDibujo()
      vcb.focus({ preventScroll: true })
    }

    function borrarElegido() {
      if (!elegido) return
      guardarPaso()
      objs = objs.filter((x) => x.id !== elegido)
      elegido = null
      reconstruir()
    }

    function verTodo() {
      hizo('vertodo')
      // Siempre se ven por lo menos unos metros alrededor, para que la figura de referencia no quede gigante.
      const caja = new THREE.Box3().setFromObject(modelo).union(new THREE.Box3(new THREE.Vector3(-300, 0, -300), new THREE.Vector3(300, 150, 300)))
      const c = caja.getCenter(new THREE.Vector3())
      const r = caja.getSize(new THREE.Vector3()).length() / 2 || 200
      const dir = camara.position.clone().sub(controles.target).normalize()
      const dist = r / Math.sin((camara.fov * Math.PI) / 360) * 1.1
      controles.target.copy(c)
      camara.position.copy(c).add(dir.multiplyScalar(Math.max(dist, 300)))
      controles.update()
      pedirDibujo()
    }
    function vistaDesde(lado: 'arriba' | 'frente' | 'perspectiva') {
      const dir = lado === 'arriba' ? new THREE.Vector3(0, 1, 0.001) : lado === 'frente' ? new THREE.Vector3(0, 0.05, 1) : new THREE.Vector3(0.6, 0.45, 0.7)
      camara.position.copy(controles.target).add(dir.normalize().multiplyScalar(1000))
      controles.update()
      verTodo()
    }

    function teclaGeneral(e: KeyboardEvent): boolean {
      const ctrl = e.ctrlKey || e.metaKey
      const k = e.key.toLowerCase()
      if (ctrl) {
        if (k === 'z') deshacer()
        else if (k === 'y') rehacer()
        else if (k === 's') guardar()
        else if (k === 'o') abrirOtro()
        else if (k === 'n') nuevo()
        else return false
        return true
      }
      if (e.key === 'Delete') borrarElegido()
      else if (e.key === ' ') ponerHerr('seleccionar')
      else if (k === 'z' && e.shiftKey) verTodo()
      else {
        const h = HERRAMIENTAS.find((x) => x.tecla.toLowerCase() === k)
        if (!h) return false
        ponerHerr(h.id)
      }
      return true
    }

    // ---------- Archivo
    async function guardar(como = false): Promise<boolean> {
      let n = archivo?.nombre
      if (!archivo || como) {
        const sugerido = archivo ? archivo.nombre + ' (copia)' : fs.nombreLibre('Construcción', 'construir')
        const x = await pedirNombre('construir', sugerido, '¿Cómo se va a llamar lo que construiste?')
        if (!x) return false
        n = x
        archivo = null
      }
      limpiarAyudas()
      renderer.render(escena, camara)
      const mini = document.createElement('canvas')
      mini.width = 240
      mini.height = Math.round((240 * lienzo.height) / lienzo.width)
      mini.getContext('2d')!.drawImage(lienzo, 0, 0, mini.width, mini.height)
      try {
        archivo = fs.guardar({ id: archivo?.id ?? fs.nuevoId(), nombre: n!, app: 'construir', miniatura: mini.toDataURL('image/jpeg', 0.8) }, { objs } as Datos)
      } catch {
        await aviso('Construir', 'No hay más lugar para guardar.', '⚠️')
        return false
      }
      cambios = false
      ponerTitulo()
      return true
    }
    async function puedeSeguir(): Promise<boolean> {
      if (!cambios) return true
      const r = await preguntarSiGuarda('Construir', archivo?.nombre ?? 'Sin nombre')
      if (r === 'cancelar') return false
      if (r === 'si') return guardar()
      return true
    }
    function cargar(d: Datos, a: fs.Archivo | null) {
      op = null
      objs = d.objs
      archivo = a
      cambios = false
      atras.length = 0
      adelante.length = 0
      elegido = null
      ultimoEmpuje = null
      reconstruir()
      ponerTitulo()
      verTodo()
    }
    async function nuevo() {
      if (!(await puedeSeguir())) return
      cargar({ objs: [{ id: fs.nuevoId(), tipo: 'persona', x: -120, y: 0, z: 120 }] }, null)
    }
    async function abrirOtro() {
      if (!(await puedeSeguir())) return
      const id = await elegirArchivo('construir', 'Abrir')
      const d = id ? (fs.leer(id) as Datos | null) : null
      if (id && d) cargar(d, fs.buscar(id) ?? null)
    }
    function ponerTitulo() {
      win.ponerTitulo(`${cambios ? '● ' : ''}${archivo?.nombre ?? 'Sin nombre'} — Construir`)
    }

    // ---------- Arranque
    dibujarMateriales()
    reconstruir()
    ponerHerr('rect')
    ponerTitulo()
    setTimeout(() => {
      medir()
      if (archivoId) {
        const d = fs.leer(archivoId) as Datos | null
        if (d) cargar(d, fs.buscar(archivoId) ?? null)
      }
    }, 0)

    return {
      alTecla(e) {
        if (/^[\d;,.]$/.test(e.key) && !e.ctrlKey) {
          // Los números van al cuadro de Medidas, sin hacer clic en él.
          vcb.focus({ preventScroll: true })
          vcb.value += e.key
          return true
        }
        if (e.key === 'Escape') {
          cancelar()
          return true
        }
        if (e.key === 'Enter' && vcb.value.trim()) {
          aplicarMedida(vcb.value)
          return true
        }
        return teclaGeneral(e)
      },
      // Para el guía de las misiones.
      api: {
        hizo: (a: string) => hechas.has(a),
        objs: () => objs,
        herramienta: () => herr,
        cargar: () => {
          cargar({ objs: [{ id: fs.nuevoId(), tipo: 'persona', x: -120, y: 0, z: 120 }] }, null)
          ponerHerr('seleccionar')
          hechas.clear()
        },
        guardarComo: (n0: string) => {
          let n = n0
          for (let i = 2; fs.existeNombre(n, 'construir'); i++) n = `${n0} ${i}`
          limpiarAyudas()
          renderer.render(escena, camara)
          const mini = document.createElement('canvas')
          mini.width = 240
          mini.height = Math.round((240 * lienzo.height) / lienzo.width)
          mini.getContext('2d')!.drawImage(lienzo, 0, 0, mini.width, mini.height)
          archivo = fs.guardar({ id: fs.nuevoId(), nombre: n, app: 'construir', miniatura: mini.toDataURL('image/jpeg', 0.8) }, { objs } as Datos)
          cambios = false
          ponerTitulo()
          return n
        },
      },
      async alCerrar() {
        const ok = await puedeSeguir()
        if (ok) {
          obs.disconnect()
          controles.dispose()
          renderer.dispose()
        }
        return ok
      },
    }
  },
}
