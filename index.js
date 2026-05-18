'use strict'

const express = require('express')
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers
} = require('@whiskeysockets/baileys')
const pino = require('pino')
const { Boom } = require('@hapi/boom')
const fs = require('fs-extra')
const path = require('path')
const qrcode = require('qrcode')
const cors = require('cors')

const app = express()
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ===========================
// Session Store
// ===========================
const sessions = new Map()

const cleanSession = async (id) => {
  try {
    const p = path.join(__dirname, 'sessions', id)
    if (fs.existsSync(p)) await fs.remove(p)
    sessions.delete(id)
  } catch {}
}

// ===========================
// HTML Page
// ===========================
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NelsonFxBot — Session Generator</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #0a0a0a, #1a1a2e, #16213e);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    }
    .container { max-width: 480px; width: 90%; text-align: center; }
    .logo { font-size: 48px; margin-bottom: 10px; }
    h1 {
      font-size: 28px; font-weight: 700;
      background: linear-gradient(90deg, #25d366, #128c7e);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 8px;
    }
    .subtitle { color: #aaa; font-size: 14px; margin-bottom: 30px; }
    .card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 20px; padding: 30px;
      margin-bottom: 20px;
    }
    .tabs {
      display: flex;
      background: rgba(0,0,0,0.3);
      border-radius: 12px; padding: 4px;
      margin-bottom: 24px;
    }
    .tab {
      flex: 1; padding: 10px; border: none;
      background: transparent; color: #aaa;
      border-radius: 10px; cursor: pointer;
      font-size: 14px; font-weight: 600;
      transition: all 0.3s;
    }
    .tab.active { background: #25d366; color: white; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    input {
      width: 100%; padding: 14px 16px;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 12px; color: white;
      font-size: 15px; margin-bottom: 14px;
      outline: none;
    }
    input:focus { border-color: #25d366; }
    input::placeholder { color: #666; }
    .btn {
      width: 100%; padding: 14px;
      background: linear-gradient(135deg, #25d366, #128c7e);
      border: none; border-radius: 12px;
      color: white; font-size: 16px;
      font-weight: 700; cursor: pointer;
      transition: all 0.3s;
    }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .code-display {
      font-size: 36px; font-weight: 900;
      letter-spacing: 10px; color: #25d366;
      background: rgba(0,0,0,0.5);
      border-radius: 12px; padding: 20px;
      margin: 16px 0; font-family: monospace;
      border: 2px dashed #25d366;
    }
    .qr-box { display: none; margin-top: 20px; }
    .qr-box img {
      width: 230px; height: 230px;
      border-radius: 12px;
      border: 3px solid #25d366;
    }
    .session-box {
      display: none; margin-top: 20px;
      background: rgba(37,211,102,0.1);
      border: 2px solid #25d366;
      border-radius: 12px; padding: 20px;
    }
    .session-id {
      background: rgba(0,0,0,0.5);
      border-radius: 8px; padding: 12px;
      font-size: 11px; word-break: break-all;
      color: #fff; margin: 12px 0;
      font-family: monospace;
      max-height: 120px; overflow-y: auto;
      text-align: left;
    }
    .copy-btn {
      background: #25d366; border: none;
      border-radius: 8px; padding: 12px 24px;
      color: white; font-weight: 700;
      cursor: pointer; font-size: 15px;
    }
    .msg {
      margin-top: 14px; padding: 12px;
      border-radius: 8px; font-size: 13px;
      display: none; line-height: 1.6;
    }
    .msg.info { background: rgba(37,211,102,0.15); color: #25d366; display: block; }
    .msg.error { background: rgba(255,80,80,0.15); color: #ff7070; display: block; }
    .loader {
      display: inline-block; width: 16px; height: 16px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: white; border-radius: 50%;
      animation: spin 0.8s linear infinite;
      vertical-align: middle; margin-right: 6px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .footer { color: #444; font-size: 12px; margin-top: 16px; }
    .footer a { color: #25d366; text-decoration: none; }
  </style>
</head>
<body>
<div class="container">
  <div class="logo">🤖</div>
  <h1>NelsonFxBot</h1>
  <p class="subtitle">Session Generator — Connect your WhatsApp</p>

  <div class="card">
    <div class="tabs">
      <button class="tab active" onclick="switchTab('pairing',this)">📱 Pairing Code</button>
      <button class="tab" onclick="switchTab('qr',this)">📷 QR Code</button>
    </div>

    <!-- Pairing Tab -->
    <div class="tab-content active" id="pairing-tab">
      <input type="tel" id="phone" placeholder="Number with country code e.g 2349138567333"/>
      <button class="btn" id="p-btn" onclick="getPairing()">Get Pairing Code</button>
      <div id="code-box" style="display:none">
        <p style="color:#aaa;font-size:13px;margin-top:14px">Enter this code in WhatsApp:</p>
        <div class="code-display" id="code-text"></div>
        <p style="color:#777;font-size:12px">WhatsApp → ⋮ Menu → Linked Devices → Link a Device → Link with phone number</p>
      </div>
      <div class="msg" id="p-msg"></div>
    </div>

    <!-- QR Tab -->
    <div class="tab-content" id="qr-tab">
      <button class="btn" id="q-btn" onclick="getQR()">Generate QR Code</button>
      <div class="qr-box" id="qr-box">
        <img id="qr-img" src="" alt="QR"/>
        <p style="color:#aaa;font-size:12px;margin-top:10px">WhatsApp → ⋮ Menu → Linked Devices → Link a Device → Scan QR</p>
      </div>
      <div class="msg" id="q-msg"></div>
    </div>

    <!-- Session Result -->
    <div class="session-box" id="session-box">
      <h3 style="color:#25d366;margin-bottom:8px">✅ Session Generated!</h3>
      <p style="color:#aaa;font-size:12px">Copy your SESSION_ID below:</p>
      <div class="session-id" id="sid"></div>
      <button class="copy-btn" onclick="copy()">📋 Copy SESSION_ID</button>
      <p style="color:#777;font-size:11px;margin-top:10px">Paste as SESSION_ID in your config.env</p>
    </div>
  </div>

  <div class="footer">
    Made with ❤️ by <a href="https://wa.me/2349138567333">NelsonFx</a>
  </div>
</div>

<script>
  let sid = null

  function switchTab(tab, el) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'))
    el.classList.add('active')
    document.getElementById(tab + '-tab').classList.add('active')
  }

  function setMsg(id, type, text) {
    const el = document.getElementById(id)
    el.className = 'msg ' + type
    el.innerHTML = text
  }

  async function getPairing() {
    const phone = document.getElementById('phone').value.replace(/[^0-9]/g, '')
    if (!phone || phone.length < 10) {
      return setMsg('p-msg', 'error', '❌ Enter valid number with country code!')
    }
    const btn = document.getElementById('p-btn')
    btn.disabled = true
    btn.innerHTML = '<span class="loader"></span>Connecting...'
    document.getElementById('code-box').style.display = 'none'
    setMsg('p-msg', 'info', '⏳ Connecting to WhatsApp servers...')

    try {
      const res = await fetch('/pairing?phone=' + phone)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      document.getElementById('code-text').textContent = data.code
      document.getElementById('code-box').style.display = 'block'
      setMsg('p-msg', 'info', '⏳ Waiting for you to enter the code...')
      poll(data.sid, 'p-msg', btn, 'Get Pairing Code')
    } catch(e) {
      setMsg('p-msg', 'error', '❌ ' + e.message)
      btn.disabled = false
      btn.innerHTML = 'Get Pairing Code'
    }
  }

  async function getQR() {
    const btn = document.getElementById('q-btn')
    btn.disabled = true
    btn.innerHTML = '<span class="loader"></span>Generating...'
    setMsg('q-msg', 'info', '⏳ Generating QR code...')

    try {
      const res = await fetch('/qr')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      document.getElementById('qr-img').src = data.qr
      document.getElementById('qr-box').style.display = 'block'
      setMsg('q-msg', 'info', '📷 Scan now! QR expires in 60 seconds.')
      poll(data.sid, 'q-msg', btn, 'Generate QR Code')
    } catch(e) {
      setMsg('q-msg', 'error', '❌ ' + e.message)
      btn.disabled = false
      btn.innerHTML = 'Generate QR Code'
    }
  }

  function poll(id, msgId, btn, btnText) {
    let tries = 0
    const t = setInterval(async () => {
      tries++
      if (tries > 100) {
        clearInterval(t)
        setMsg(msgId, 'error', '❌ Timeout. Please try again.')
        btn.disabled = false
        btn.innerHTML = btnText
        return
      }
      try {
        const r = await fetch('/check?sid=' + id)
        const d = await r.json()
        if (d.done) {
          clearInterval(t)
          document.getElementById('sid').textContent = d.session
          document.getElementById('session-box').style.display = 'block'
          setMsg(msgId, 'info', '✅ Successfully connected!')
          btn.disabled = false
          btn.innerHTML = btnText
          sid = d.session
        }
      } catch {}
    }, 3000)
  }

  function copy() {
    if (!sid) return
    navigator.clipboard.writeText(sid).then(() => {
      const b = document.querySelector('.copy-btn')
      b.textContent = '✅ Copied!'
      setTimeout(() => b.textContent = '📋 Copy SESSION_ID', 2000)
    })
  }
</script>
</body>
</html>
  `)
})

// ===========================
// Create Socket Helper
// ===========================
const createSocket = async (sessionPath) => {
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(
        state.keys,
        pino({ level: 'silent' })
      )
    },
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: Browsers.macOS('Desktop'),
    syncFullHistory: false,
    markOnlineOnConnect: false,
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 10000,
    retryRequestDelayMs: 250
  })

  sock.ev.on('creds.update', saveCreds)
  return { sock, state, saveCreds }
}

// ===========================
// Build Session String
// ===========================
const buildSessionString = (state) => {
  try {
    const data = JSON.stringify(state.creds)
    return 'NELSONFX~' + Buffer.from(data).toString('base64')
  } catch {
    return null
  }
}

// ===========================
// Pairing Route
// ===========================
app.get('/pairing', async (req, res) => {
  const phone = req.query.phone?.replace(/[^0-9]/g, '')
  if (!phone) return res.json({ error: 'Phone number required' })

  const sid = 'p_' + Date.now()
  const sessionPath = path.join(__dirname, 'sessions', sid)

  try {
    await fs.ensureDir(sessionPath)
    const { sock, state } = await createSocket(sessionPath)

    sessions.set(sid, { sock, state, done: false, session: null })

    // Wait for socket to be ready then request code
    await new Promise(r => setTimeout(r, 3000))

    let code
    try {
      code = await sock.requestPairingCode(phone)
    } catch (err) {
      await cleanSession(sid)
      return res.json({ error: 'Could not get pairing code: ' + err.message })
    }

    // Format code nicely
    const formatted = code?.replace(/(.{4})/g, '$1-').slice(0, -1) || code

    sock.ev.on('connection.update', async ({ connection }) => {
      if (connection === 'open') {
        const session = buildSessionString(state)
        const s = sessions.get(sid)
        if (s) { s.done = true; s.session = session }
        setTimeout(() => cleanSession(sid), 120000)
      }
      if (connection === 'close') {
        sessions.delete(sid)
      }
    })

    res.json({ code: formatted, sid })
  } catch (err) {
    await cleanSession(sid)
    res.json({ error: err.message })
  }
})

// ===========================
// QR Route
// ===========================
app.get('/qr', async (req, res) => {
  const sid = 'q_' + Date.now()
  const sessionPath = path.join(__dirname, 'sessions', sid)
  let responded = false

  try {
    await fs.ensureDir(sessionPath)
    const { sock, state } = await createSocket(sessionPath)

    sessions.set(sid, { sock, state, done: false, session: null })

    sock.ev.on('connection.update', async ({ connection, qr }) => {
      if (qr && !responded) {
        responded = true
        try {
          const qrImage = await qrcode.toDataURL(qr)
          res.json({ qr: qrImage, sid })
        } catch (err) {
          res.json({ error: err.message })
        }
      }

      if (connection === 'open') {
        const session = buildSessionString(state)
        const s = sessions.get(sid)
        if (s) { s.done = true; s.session = session }
        setTimeout(() => cleanSession(sid), 120000)
      }

      if (connection === 'close') {
        sessions.delete(sid)
      }
    })

    // Timeout
    setTimeout(() => {
      if (!responded) {
        responded = true
        cleanSession(sid)
        res.json({ error: 'Timeout generating QR. Try again.' })
      }
    }, 20000)

  } catch (err) {
    await cleanSession(sid)
    if (!responded) res.json({ error: err.message })
  }
})

// ===========================
// Check Session Route
// ===========================
app.get('/check', (req, res) => {
  const { sid } = req.query
  if (!sid) return res.json({ done: false })
  const s = sessions.get(sid)
  if (!s) return res.json({ done: false })
  if (s.done && s.session) return res.json({ done: true, session: s.session })
  res.json({ done: false })
})

// ===========================
// Health Check
// ===========================
app.get('/health', (req, res) => {
  res.json({ status: 'ok', sessions: sessions.size })
})

// ===========================
// Start
// ===========================
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log('╔══════════════════════════════════╗')
  console.log('║   NelsonFxBot Session Generator  ║')
  console.log('║   Port: ' + PORT + '                    ║')
  console.log('║   Made by NelsonFx               ║')
  console.log('╚══════════════════════════════════╝')
})
