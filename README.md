# kids-os

Una compu para chicos: un escritorio con ventanas y programas que son versiones chicas de los de verdad, para aprender a usar una computadora jugando.

- **Programas:** Pincel (Paint), Trazos (Corel), Foto (Photoshop), Cuaderno (Word), Tablero (Excel), Diapositivas (PowerPoint), Regla (AutoCAD), Construir (SketchUp), Película (DaVinci Resolve), Animar (After Effects), Robotito (programar con bloques), Teclado (mecanografía), Calculadora, Buscaminas, Solitario.
- **Sistema:** Mis cosas (carpetas, papelera, pendrive de práctica), Tienda (instalar y desinstalar con la clave de un adulto), Configuración, Imprimir, copiar y pegar entre programas.
- **Misiones:** un guía que señala el botón de verdad, lee en voz alta y se da cuenta solo de cada paso, organizado por islas.

## Correr

```bash
npm install
npm run dev
```

Se abre en http://localhost:5207.

## Programa para Windows

```bash
npm run app:instalador   # arma release/kids-os-<versión>.exe
npm run app:publicar     # arma y sube la versión a GitHub (las notebooks se actualizan solas)
npm run app:dev          # el programa contra el servidor de desarrollo, en ventana
```

Cómo dejar una notebook compartida con un usuario para ella que abre solo kids-os: [instalar/INSTALAR.md](instalar/INSTALAR.md).
