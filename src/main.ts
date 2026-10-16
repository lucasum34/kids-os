// Primero que todo: en el programa instalado, lo guardado va a archivos (ver os/compu.ts).
import './os/compu'
// La letra va adentro del programa: tiene que andar sin internet.
import '@fontsource/nunito/400.css'
import '@fontsource/nunito/600.css'
import '@fontsource/nunito/700.css'
import '@fontsource/nunito/800.css'
import './estilos.css'
import { armarEscritorio } from './os/escritorio'
import { instalar } from './os/sistema'
import { migrar } from './os/archivos'
import { misCosas } from './apps/mis-cosas'
import { pincel } from './apps/pincel'
import { trazos } from './apps/trazos'
import { robotito } from './apps/robotito'
import { cuaderno } from './apps/cuaderno'
import { teclado } from './apps/teclado'
import { tablero } from './apps/tablero'
import { regla } from './apps/regla'
import { foto } from './apps/foto'
import { pelicula } from './apps/pelicula'
import { construir } from './apps/construir'
import { diapositivas } from './apps/diapositivas'
import { animar } from './apps/animar'
import { calculadora } from './apps/calculadora'
import { buscaminas } from './apps/buscaminas'
import { solitario } from './apps/solitario'
import { configuracion } from './apps/configuracion'
import { misiones } from './apps/misiones'
import { tienda } from './apps/tienda'

instalar(misiones, { sistema: true })
instalar(misCosas, { sistema: true })
instalar(cuaderno)
instalar(tablero)
instalar(diapositivas)
instalar(pincel)
instalar(trazos)
instalar(regla)
instalar(foto)
instalar(pelicula)
instalar(animar)
instalar(construir)
instalar(robotito)
instalar(teclado)
instalar(calculadora)
// Los juegos no vienen instalados: se bajan de la Tienda (así se aprende a instalar).
instalar(buscaminas, { deFabrica: false })
instalar(solitario, { deFabrica: false })
instalar(tienda, { sistema: true })
instalar(configuracion, { sistema: true })

migrar()
armarEscritorio(document.getElementById('app')!)
