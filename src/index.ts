import { env } from './config/env.js'
import { createApp } from './app.js'

const app = createApp()

app.listen(env.port, () => {
  console.log(`Backend TOKE+ escuchando en http://localhost:${env.port}`)
})
