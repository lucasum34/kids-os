import { defineConfig } from 'vite'

export default defineConfig({
  base: './', // el programa instalado abre los archivos desde app://, no desde la raíz de un servidor
  server: { port: 5207, strictPort: true },
})
