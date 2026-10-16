// El portapapeles de la compu: lo que se copia en un programa se puede pegar en otro
// (un dibujo de Pincel en el Cuaderno, una lista del Cuaderno en el Tablero…).
// Cada programa sigue teniendo su copiar y pegar de adentro; esto es para pasar cosas entre ellos.

export type Contenido = { tipo: 'imagen'; url: string; origen: string } | { tipo: 'texto'; texto: string; origen: string }

let actual: Contenido | null = null

export function copiarImagen(url: string, origen: string) {
  actual = { tipo: 'imagen', url, origen }
  // También al de la computadora de verdad (si deja).
  fetch(url)
    .then((r) => r.blob())
    .then((b) => navigator.clipboard?.write?.([new ClipboardItem({ [b.type]: b })]))
    .catch(() => {})
}

export function copiarTexto(texto: string, origen: string) {
  if (!texto) return
  actual = { tipo: 'texto', texto, origen }
  navigator.clipboard?.writeText(texto).catch(() => {})
}

/** Lo último que se copió, si vino de OTRO programa (lo de uno mismo lo maneja cada programa). */
export function deOtro(yo: string): Contenido | null {
  return actual && actual.origen !== yo ? actual : null
}

export const portapapeles = () => actual
