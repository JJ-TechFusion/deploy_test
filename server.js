import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import pg from 'pg'

const port = Number(process.env.PORT ?? 3000)
const startedAt = new Date().toISOString()
let pool

function databaseConfig() {
  const url = new URL(process.env.DATABASE_URL)
  const mode = process.env.PGSSLMODE ?? url.searchParams.get('sslmode') ?? 'disable'
  for (const param of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey']) url.searchParams.delete(param)
  let ssl = false
  if (process.env.PGSSLROOTCERT) ssl = { ca: readFileSync(process.env.PGSSLROOTCERT, 'utf8') }
  else if (mode !== 'disable') ssl = true
  return { connectionString: url.toString(), ssl, max: 3, connectionTimeoutMillis: 5000 }
}

function database() {
  if (!process.env.DATABASE_URL) return null
  pool ??= new pg.Pool(databaseConfig())
  return pool
}

async function checkDatabase() {
  const db = database()
  if (!db) return { status: 503, body: { attached: false, message: 'No database attached: DATABASE_URL is not set.' } }
  await db.query(`CREATE TABLE IF NOT EXISTS visits (id serial PRIMARY KEY, visited_at timestamptz NOT NULL DEFAULT now())`)
  await db.query('INSERT INTO visits DEFAULT VALUES')
  const { rows } = await db.query(`SELECT (SELECT count(*)::int FROM visits) AS visits, version() AS version, current_database() AS database, (SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()) AS tls`)
  return { status: 200, body: { attached: true, ...rows[0] } }
}

function send(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json' })
  response.end(JSON.stringify(body, null, 2) + '\n')
}

createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname
  try {
    if (path === '/healthz') return send(response, 200, { ok: true })
    if (path === '/db') {
      const result = await checkDatabase()
      return send(response, result.status, result.body)
    }
    if (path === '/') {
      return send(response, 200, {
        app: 'stackshift-deploy-test',
        node: process.version,
        started_at: startedAt,
        database_attached: Boolean(process.env.DATABASE_URL),
        routes: ['/healthz', '/db'],
      })
    }
    send(response, 404, { error: 'not found' })
  } catch (error) {
    console.error(error)
    send(response, 500, { error: error.message })
  }
}).listen(port, '0.0.0.0', () => console.log(`listening on 0.0.0.0:${port}`))
