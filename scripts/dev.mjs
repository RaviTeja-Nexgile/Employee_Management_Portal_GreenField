// `npm run dev`: seed an empty database, start the API, then start Vite.
//
// The seed step runs first so the three demo logins of the design's
// "Test logins" table exist before the app starts. A database that already
// holds them is left as it is.
import { spawn, spawnSync } from 'node:child_process'
import process from 'node:process'

const isWindows = process.platform === 'win32'
const python = process.env.PYTHON ?? (isWindows ? 'python' : 'python3')
const apiPort = process.env.API_PORT ?? '8000'
const port = process.env.PORT ?? '5173'

const env = { ...process.env, API_PORT: apiPort, PORT: port }

const seed = spawnSync(python, ['backend/seed.py'], { stdio: 'inherit', env })
if (seed.status !== 0) {
  console.error('Seeding the database failed; the app was not started.')
  process.exit(seed.status ?? 1)
}

const children = []

function start(command, args, name) {
  const child = spawn(command, args, { stdio: 'inherit', env, shell: isWindows })
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`${name} exited with code ${code}`)
    }
    shutdown(code ?? 0)
  })
  children.push(child)
  return child
}

let stopping = false
function shutdown(code = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) {
    if (!child.killed) {
      child.kill()
    }
  }
  process.exit(code)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

start(
  python,
  ['-m', 'uvicorn', 'backend.main:app', '--host', '127.0.0.1', '--port', apiPort],
  'API',
)
start('npx', ['vite'], 'Vite')
