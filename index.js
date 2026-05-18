'use strict'

const express = require('express')
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore
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

const sessions = new Map()

const cleanSession = async (sessionId) => {
  try {
    const sessionPath = path.join(__dirname, 'sessions', sessionId)
    if (fs.existsSync(sessionPath)) {
      await fs.remove(sessionPath)
    }
    sessions.delete(sessionId)
  } catch {
    // silently fail
  }
}

// ===========================
// Main Page
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
      background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    }
    .container { max-width: 480px; width: 90%; text-align: center; }
    .logo { font-size: 48px; margin-bottom: 10px; }
    h1 {
      font-size: 28px;
      font-weight: 700;
      background: linear-gradient(90deg, #25d366, #128c7e);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 8px;
    }
    .subtitle { color: #aaa; font-size: 14px; margin-bottom: 30px; }
    .card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 20px;
      padding: 30px;
      margin-bottom: 20px;
      backdrop-filter: blur(10px);
    }
    .method-title { font-size: 18px; font-weight: 600; margin-bottom: 20px; color: #25d366; }
    .tabs {
      display: flex;
      background: rgba(0,0,0,0.3);
      border-radius: 12px;
      padding: 4px;
      margin-bottom: 24px;
    }
    .tab {
      flex: 1; padding: 10px; border: none;
      background: transparent; color: #aaa;
      border-radius: 10px; cursor: pointer;
      font-size: 14px; font-weight: 600; transition: all 0.3s;
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
      outline: none; transition: border 0.3s;
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
    .btn:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(37,211,102,0.3); }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
    .qr-container { display: none; margin-top: 20px; }
    .qr-container img { width: 220px; height: 220px; border-radius: 12px; border: 3px solid #25d366; }
    .qr-text { color: #aaa; font-size: 13px; margin-top: 10px; }
    .session-box {
      display: none; margin-top: 20px;
      background: rgba(37,211,102,0.1);
      border: 1px solid #25d366;
      border-radius: 12px; padding: 20px;
    }
    .session-box h3 { color: #25d366; margin-bottom: 10px; font-size: 16px; }
    .session-id {
      background: rgba(0,0,0,0.4); border-radius: 8px;
      padding: 12px; font-size: 11px;
      word-break: break-all; color: #fff;
      margin-bottom: 12px; font-family: monospace;
      max-height: 100px; overflow-y: auto;
    }
    .copy-btn {
      background: #25d366; border: none;
      border-radius: 8px; padding: 10px 20px;
      color: white; font-weight: 600;
      cursor: pointer; font-size: 14px; transition: all 0.3s;
    }
    .copy-btn:hover { background: #128c7e; }
    .status {
      margin-top: 14px; padding: 12px;
      border-radius: 8px; font-size: 13px;
      font-weight: 600; display: none;
      line-height: 1.6;
    }
    .status.info { background: rgba(37,211,102,0.15); color: #25d366; display: block; }
    .status.error { background: rgba(255,50,50,0.15); color: #ff6b6b; display: block; }
    .pairing-code-display {
      font-size: 32px;
      font-weight: 900;
      letter-spacing: 8px;
      color: #25d366;
      background: rgba(0,0,0,0.4);
      border-radius: 12px;
      padding: 16px;
      margin: 12px 0;
      font-family: monospace;
    }
    .footer { color: #555; font-size: 12px; margin-top: 20px; }
    .footer a { color: #25d366; text-decoration: none; }
    .loader {
      display: inline-block; width: 18px; height: 18px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: white; border-radius: 50%;
      animation: spin 0.8s linear infinite;
      vertical-align: middle; margin-right: 8px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
<div class="container">
  <div class="logo">🤖</div>
  <h1>NelsonFxBot</h1>
  <p class="subtitle">Session ID Generator</p>

  <div class="card">
    <div class="method-title">Choose Connection Method</div>
    <div class="tabs">
      <button class="tab active" onclick="switchTab('pairing', this)">📱 Pairing Code</button>
      <button class="tab" onclick="switchTab('qr', this)">📷 QR Code</button>
    </div>

    <!-- Pairing Tab -->
    <div class="tab-content active" id="pairing-tab">
      <input
        type="tel"
        id="phone-input"
        placeholder="Number with country code e.g 2349138567333"
      />
      <button class="btn" id="pairing-btn" onclick="getPairingCode()">
        Get Pairing Code
      </button>
      <div id="pairing-code-box" style="display:none">
        <p style="color:#aaa; font-size:13px; margin-top:14px;">Your Pairing Code:</p>
        <div class="pairing-code-display" id="pairing-code-text"></div>
        <p style="color:#aaa; font-size:12px;">
          WhatsApp → Linked Devices → Link with phone number → Enter code above
        </p>
      </div>
      <div class="status" id="pairing-status"></div>
    </div>

    <!-- QR Tab -->
    <div class="tab-content" id="qr-tab">
      <button class="btn" id="qr-btn" onclick="getQRCode()">
        Generate QR Code
      </button>
      <div class="qr-container" id="qr-container">
        <img id="qr-image" src="" alt="QR Code"/>
        <p class="qr-text">WhatsApp → Linked Devices → Link a Device → Scan QR</p>
      </div>
      <div class="status" id="qr-status"></div>
    </div>

    <!-- Session Result -->
    <div class="session-box" id="session-box">
      <h3>✅ Connected! Copy Your SESSION_ID</h3>
      <div class="session-id" id="session-id-text"></div>
      <button class="copy-btn" onclick="copySession()">📋 Copy SESSION_ID</button>
      <p style="color:#aaa; font-size:12px; margin-top:10px;">
        Paste this in your config.env as SESSION_ID
      </p>
    </div>
  </div>

  <div class="footer">
    Made with ❤️ by <a href="https://wa.me/2349138567333">NelsonFx</a>
  </div>
</div>

<script>
  let currentSessionId = null

  function switchTab(tab, el) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'))
    document.getElementById(tab + '-tab').classList.add('active')
    el.classList.add('active')
  }

  async function getPairingCode() {
    const phone = document.getElementById('phone-input').value.trim().replace(/[^0-9]/g, '')
    const status = document.getElementById('pairing-status')
    const btn = document.getElementById('pairing-btn')
    const codeBox = document.getElementById('pairing-code-box')

    if (!phone || phone.length < 10) {
      status.className = 'status error'
      status.textContent = '❌ Enter a valid phone number with country code!'
      return
    }

    btn.disabled = true
    btn.innerHTML = '<span class="loader"></span> Connecting to WhatsApp...'
    status.className = 'status info'
    status.textContent = '⏳ Please wait, connecting...'
    codeBox.style.display = 'none'

    try {
      const res = await fetch('/pairing?phone=' + phone)
      const data = await res.json()

      if (data.error) throw new Error(data.error)

      if (data.code) {
        document.getElementById('pairing-code-text').textContent = data.code
        codeBox.style.display = 'block'
        status.className = 'status info'
        status.textContent = '⏳ Waiting for you to enter the code in WhatsApp...'
        btn.innerHTML = '<span class="loader"></span> Waiting for connection...'
        pollSession(data.sessionId)
      }
    } catch (err) {
      status.className = 'status error'
      status.textContent = '❌ ' + err.message
      btn.disabled = false
      btn.innerHTML = 'Get Pairing Code'
    }
  }

  async function getQRCode() {
    const status = document.getElementById('qr-status')
    const btn = document.getElementById('qr-btn')
    const qrContainer = document.getElementById('qr-container')

    btn.disabled = true
    btn.innerHTML = '<span class="loader"></span> Generating QR...'
    status.className = 'status info'
    status.textContent = '⏳ Generating QR code...'

    try {
      const res = await fetch('/qr')
      const data = await res.json()

      if (data.error) throw new Error(data.error)

      if (data.qr) {
        document.getElementById('qr-image').src = data.qr
        qrContainer.style.display = 'block'
        status.className = 'status info'
        status.textContent = '📷 Scan the QR code now! It expires in 60 seconds.'
        btn.innerHTML = '<span class="loader"></span> Waiting for scan...'
        pollSession(data.sessionId)
      }
    } catch (err) {
      status.className = 'status error'
      status.textContent = '❌ ' + err.message
      btn.disabled = false
      btn.innerHTML = 'Generate QR Code'
    }
  }

  async function pollSession(sessionId) {
    let attempts = 0
    const maxAttempts = 80

    const interval = setInterval(async () => {
      attempts++
      if (attempts > maxAttempts) {
        clearInterval(interval)
        const status = document.getElementById('pairing-status') || document.getElementById('qr-status')
        if (status) {
          status.className = 'status error'
          status.textContent = '❌ Timeout! Please try again.'
        }
        const btn = document.getElementById('pairing-btn') || document.getElementById('qr-btn')
        if (btn) { btn.disabled = false; btn.innerHTML = 'Try Again' }
        return
      }

      try {
        const res = await fetch('/session?id=' + sessionId)
        const data = await res.json()
        if (data.sessionId) {
          clearInterval(interval)
          showSession(data.sessionId)
        }
      } catch {
        // keep polling
      }
    }, 3000)
  }

  function showSession(id) {
    currentSessionId = id
    document.getElementById('session-id-text').textContent = id
    document.getElementById('session-box').style.display = 'block'

    const pStatus = document.getElementById('pairing-status')
    const qStatus = document.getElementById('qr-status')
    if (pStatus) { pStatus.className = 'status info'; pStatus.textContent = '✅ Connected successfully!' }
    if (qStatus) { qStatus.className = 'status info'; qStatus.textContent = '✅ Connected successfully!' }

    const pBtn = document.getElementById('pairing-btn')
    const qBtn = document.getElementById('qr-btn')
    if (pBtn) { pBtn.disabled = false; pBtn.innerHTML = 'Get Pairing Code' }
    if (qBtn) { qBtn.disabled = false; qBtn.innerHTML = 'Generate QR Code' }
  }

  function copySession() {
    if (!currentSessionId) return
    navigator.clipboard.writeText(currentSessionId).then(() => {
      const btn = document.querySelector('.copy-btn')
      btn.textContent = '✅ Copied!'
      setTimeout(() => { btn.textContent = '📋 Copy SESSION_ID' }, 2000)
    })
  }
</script>
</body>
</html>
  `)
})

// ===========================
// Pairing Code Route
// ===========================
app.get('/pairing', async (req, res) => {
  const phone = req.query.phone?.replace(/[^0-9]/g, '')
  if (!phone) return res.json({ error: 'Phone number required' })

  const sessionId = 'sess_' + Date.now()
  const sessionPath = path.join(__dirname, 'sessions', sessionId)

  try {
    await fs.ensureDir(sessionPath)
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath)
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
      },
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      browser: ['NelsonFxBot', 'Safari', '3.0'],
      markOnlineOnConnect: true,
      keepAliveIntervalMs: 30000,
    })

    sock.ev.on('creds.update', saveCreds)

    sessions.set(sessionId, {
      sock,
      state,
      connected: false,
      sessionId: null
    })

    // Request pairing code after socket ready
    setTimeout(async () => {
      try {
        if (!sock.authState.creds.registered) {
          const code = await sock.requestPairingCode(phone)
          const formatted = code?.match(/.{1,4}/g)?.join('-') || code
          res.json({ code: formatted, sessionId })
        } else {
          res.json({ error: 'Number already registered. Use QR method.' })
        }
      } catch (err) {
        res.json({ error: err.message })
        await cleanSession(sessionId)
      }
    }, 3000)

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update

      if (connection === 'open') {
        try {
          const creds = JSON.stringify(state.creds)
          const sessionString = 'NELSONFX_' + Buffer.from(creds).toString('base64')
          const sessionData = sessions.get(sessionId)
          if (sessionData) {
            sessionData.connected = true
            sessionData.sessionId = sessionString
          }

          // Send session to bot number
          await sock.sendMessage(sock.user.id, {
            text:
              `✅ *NelsonFxBot Session Generated!*\n\n` +
              `Your SESSION_ID:\n\n` +
              `${sessionString}\n\n` +
              `_Save this safely — do not share it!_`
          })

          setTimeout(() => cleanSession(sessionId), 120000)
        } catch (err) {
          console.error('Session save error:', err.message)
        }
      }

      if (connection === 'close') {
        const code = new Boom(lastDisconnect?.error)?.output?.statusCode
        if (code !== DisconnectReason.loggedOut) {
          // reconnect silently
        } else {
          await cleanSession(sessionId)
        }
      }
    })

  } catch (err) {
    await cleanSession(sessionId)
    if (!res.headersSent) res.json({ error: err.message })
  }
})

// ===========================
// QR Code Route
// ===========================
app.get('/qr', async (req, res) => {
  const sessionId = 'sess_' + Date.now()
  const sessionPath = path.join(__dirname, 'sessions', sessionId)

  try {
    await fs.ensureDir(sessionPath)
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath)
    const { version } = await fetchLatestBaileysVersion()

    let qrSent = false

    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
      },
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      browser: ['NelsonFxBot', 'Safari', '3.0'],
      markOnlineOnConnect: true,
      keepAliveIntervalMs: 30000,
    })

    sock.ev.on('creds.update', saveCreds)

    sessions.set(sessionId, {
      sock, state,
      connected: false,
      sessionId: null
    })

    sock.ev.on('connection.update', async (update) => {
      const { connection, qr } = update

      if (qr && !qrSent) {
        qrSent = true
        try {
          const qrImage = await qrcode.toDataURL(qr)
          const sessionData = sessions.get(sessionId)
          if (sessionData) sessionData.qr = qrImage
          if (!res.headersSent) res.json({ qr: qrImage, sessionId })
        } catch (err) {
          if (!res.headersSent) res.json({ error: err.message })
        }
      }

      if (connection === 'open') {
        try {
          const creds = JSON.stringify(state.creds)
          const sessionString = 'NELSONFX_' + Buffer.from(creds).toString('base64')
          const sessionData = sessions.get(sessionId)
          if (sessionData) {
            sessionData.connected = true
            sessionData.sessionId = sessionString
          }

          await sock.sendMessage(sock.user.id, {
            text:
              `✅ *NelsonFxBot Session Generated!*\n\n` +
              `Your SESSION_ID:\n\n` +
              `${sessionString}\n\n` +
              `_Save this safely — do not share it!_`
          })

          setTimeout(() => cleanSession(sessionId), 120000)
        } catch (err) {
          console.error('Session save error:', err.message)
        }
      }
    })

    // Timeout if no QR generated
    setTimeout(async () => {
      if (!qrSent && !res.headersSent) {
        await cleanSession(sessionId)
        res.json({ error: 'QR generation timeout. Try again.' })
      }
    }, 15000)

  } catch (err) {
    await cleanSession(sessionId)
    if (!res.headersSent) res.json({ error: err.message })
  }
})

// ===========================
// Session Status Route
// ===========================
app.get('/session', (req, res) => {
  const { id } = req.query
  if (!id) return res.json({ error: 'Session ID required' })

  const sessionData = sessions.get(id)
  if (!sessionData) return res.json({ waiting: true })

  if (sessionData.connected && sessionData.sessionId) {
    return res.json({ sessionId: sessionData.sessionId })
  }

  res.json({ waiting: true })
})

// ===========================
// Health Check
// ===========================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    bot: 'NelsonFxBot Session Generator',
    uptime: process.uptime()
  })
})

// ===========================
// Start Server
// ===========================
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log('╔══════════════════════════════════╗')
  console.log('║   NelsonFxBot Session Generator  ║')
  console.log('║   Running on port ' + PORT + '          ║')
  console.log('║   Made by NelsonFx               ║')
  console.log('╚══════════════════════════════════╝')
})
