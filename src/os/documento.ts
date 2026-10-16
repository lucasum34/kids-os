// Diálogos de documento que comparten todos los programas:
// "¿Cómo se va a llamar?" y "¿Guardás los cambios?".

import * as fs from './archivos'
import { dialogo } from './ui'

/** Pide un nombre. Si ya existe, ofrece reemplazar (y borra el viejo). null = canceló. */
export async function pedirNombre(app: string, sugerido: string, pregunta: string): Promise<string | null> {
  for (;;) {
    const r = await dialogo({
      titulo: 'Guardar',
      icono: '💾',
      mensaje: pregunta,
      campo: sugerido,
      botones: [
        { texto: 'Guardar', valor: 'ok', principal: true },
        { texto: 'Cancelar', valor: 'cancelar' },
      ],
    })
    if (r.boton !== 'ok') return null
    if (!r.texto) continue
    if (fs.existeNombre(r.texto, app)) {
      const q = await dialogo({
        titulo: 'Guardar',
        icono: '⚠️',
        mensaje: `Ya hay uno que se llama "${r.texto}". ¿Lo reemplazás?`,
        botones: [
          { texto: 'Reemplazar', valor: 'si' },
          { texto: 'Elegir otro nombre', valor: 'no', principal: true },
        ],
      })
      if (q.boton !== 'si') {
        sugerido = r.texto
        continue
      }
      const viejo = fs.listar().find((a) => a.app === app && !a.enPapelera && (a.carpeta ?? fs.RAIZ) === fs.RAIZ && a.nombre.toLowerCase() === r.texto.toLowerCase())
      if (viejo) fs.borrarDefinitivo(viejo.id)
    }
    return r.texto
  }
}

/** "¿Guardás los cambios de X?" → 'si' | 'no' | 'cancelar'. */
export async function preguntarSiGuarda(programa: string, nombre: string): Promise<string> {
  const r = await dialogo({
    titulo: programa,
    icono: '💾',
    mensaje: `¿Guardás los cambios de "${nombre}"?`,
    botones: [
      { texto: 'Guardar', valor: 'si', principal: true },
      { texto: 'No guardar', valor: 'no' },
      { texto: 'Cancelar', valor: 'cancelar' },
    ],
  })
  return r.boton
}
