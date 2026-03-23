/* ============================================================
   VIAJES LA MAR — Backend Server (Estable)
   ============================================================ */

'use strict';

const express = require('express');
const fsP     = require('fs').promises;
const path    = require('path');
const os      = require('os');

const app  = express();
const PORT = process.env.PORT || 3000;

const ROOT        = __dirname;
const DATA_FILE   = path.join(ROOT, 'js', 'data.json');
const BACKUP_FILE = path.join(ROOT, 'js', 'data.backup.json');
const ADMIN_HTML  = path.join(ROOT, 'admin', 'index.html');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

/* ── Mutex ── */
let writeLock = false;
const writeQueue = [];
function acquireLock() {
    return new Promise(resolve => {
        if (!writeLock) { writeLock = true; resolve(); }
        else { writeQueue.push(resolve); }
    });
}
function releaseLock() {
    if (writeQueue.length > 0) { writeQueue.shift()(); }
    else { writeLock = false; }
}

/* ── Escritura atómica ── */
async function atomicWriteJSON(filePath, data) {
    const tmp = path.join(os.tmpdir(), `viajes-lamar-${Date.now()}.tmp.json`);
    await fsP.writeFile(tmp, JSON.stringify(data, null, 4), 'utf8');
    await fsP.rename(tmp, filePath);
}

/* ── Middleware ── */
app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString().substring(11,19)}] ${req.method} ${req.path}`);
    next();
});
app.use(express.static(ROOT));

/* ── Rutas ── */
app.get('/admin', (_req, res) => res.sendFile(ADMIN_HTML));

app.get('/api/data', async (_req, res) => {
    try {
        const raw = await fsP.readFile(DATA_FILE, 'utf8');
        res.json(JSON.parse(raw));
    } catch (err) {
        console.error('[GET /api/data]', err.message);
        res.status(500).json({ error: 'No se pudo leer data.json' });
    }
});

app.post('/api/auth', (req, res) => {
    const { password } = req.body || {};
    if (password === ADMIN_PASSWORD) res.json({ ok: true });
    else res.status(401).json({ ok: false, error: 'Contraseña incorrecta' });
});

app.post('/api/data', async (req, res) => {
    const { password, data } = req.body || {};
    if (password !== ADMIN_PASSWORD)
        return res.status(401).json({ error: 'Contraseña incorrecta' });
    if (!data || typeof data !== 'object')
        return res.status(400).json({ error: 'Datos inválidos o vacíos' });

    let lockAcquired = false;
    try {
        await acquireLock(); lockAcquired = true;
        try { await fsP.copyFile(DATA_FILE, BACKUP_FILE); } catch {}
        await atomicWriteJSON(DATA_FILE, data);
        res.json({ success: true, message: 'Datos actualizados correctamente' });
    } catch (err) {
        console.error('[POST /api/data]', err.message);
        res.status(500).json({ error: 'Error al guardar los datos.' });
    } finally {
        if (lockAcquired) releaseLock();
    }
});

app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
app.use((err, _req, res, _next) => {
    console.error('[Error global]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
});

process.on('uncaughtException', err => console.error('[uncaughtException]', err));
process.on('unhandledRejection', reason => console.error('[unhandledRejection]', reason));

function shutdown(sig) {
    console.log(`\n[${sig}] Apagando servidor...`);
    server.close(() => { console.log('Servidor cerrado.'); process.exit(0); });
    setTimeout(() => process.exit(1), 5000).unref();
}

const server = app.listen(PORT, () => {
    console.log('╔══════════════════════════════════════╗');
    console.log('║  Viajes La Mar — Servidor Estable    ║');
    console.log(`║  http://localhost:${PORT}               ║`);
    console.log(`║  http://localhost:${PORT}/admin         ║`);
    console.log('╚══════════════════════════════════════╝');
}).on('error', err => {
    if (err.code === 'EADDRINUSE') console.error(`Puerto ${PORT} en uso.`);
    else console.error('[server error]', err.message);
    process.exit(1);
});

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
