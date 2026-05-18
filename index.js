'use strict'

const express = require('express')
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
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
// Keeps track of active sessions
// ===========================
const sessions = new Map()

// ===========================
// Clean Old Sessions
// ===========================
const cleanSession = async (sessionId) => {
  try {
    const sessionPath = path.join(__dirname, 'sessions', sessionId)
    if (fs.existsSync(sessionPath)) {
      await fs.remove(sessionPath)
    }
    if (sessions.has(sessionId)) {
      sessions.delete(sessionId)
    }
  } catch {
    // silently fail
  }
}

// ===========================
// Main Page — Beautiful UI
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

    .container {
      max-width: 480px;
      width: 90%;
      text-align: center;
    }

    .logo {
      font-size: 48px;
      margin-bottom: 10px;
    }

    h1 {
      font-size: 28px;
      font-weight: 700;
      background: linear-gradient(90deg, #25d366, #128c7e);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 8px;
    }

    .subtitle {
      color: #aaa;
      font-size: 14px;
      margin-bottom: 30px;
    }

    .card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 20px;
      padding: 30px;
      margin-bottom: 20px;
      backdrop-filter: blur(10px);
    }

    .method-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 20px;
      color: #25d366;
    }

    .tabs {
      display: flex;
      background: rgba(0,0,0,0.3);
      border-radius: 12px;
      padding: 4px;
      margin-bottom: 24px;
    }

    .tab {
      flex: 1;
      padding: 10px;
      border: none;
      background: transparent;
      color: #aaa;
      border-radius: 10px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      transition: all 0.3s;
    }

    .tab.active {
      background: #25d366;
      color: white;
    }

    .tab-content { display: none; }
    .tab-content.active { display: block; }

    input {
      width: 100%;
      padding: 14px 16px;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 12px;
      color: white;
      font-size: 15px;
      margin-bottom: 14px;
      outline: none;
      transition: border 0.3s;
    }

    input:focus {
      border-color: #25d366;
    }

    input::placeholder { color: #666; }

    .btn {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, #25d366, #128c7e);
      border: none;
      border-radius: 12px;
      color: white;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.3s;
      letter-spacing: 0.5px;
    }

    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(37,211,102,0.3);
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }

    .qr-container {
      display: none;
      margin-top: 20px;
    }

    .qr-container img {
      width: 220px;
      height: 220px;
      border-radius: 12px;
      border: 3px solid #25d366;
    }

    .qr-text {
      color: #aaa;
      font-size: 13px;
      margin-top: 10px;
    }

    .session-box {
      display: none;
      margin-top: 20px;
      background: rgba(37,211,102,0.1);
      border: 1px solid #25d366;
      border-radius: 12px;
      padding: 20px;
    }

    .session-box h3 {
      color: #25d366;
      margin-bottom: 10px;
      font-size: 16px;
    }

    .session-id {
      background: rgba(0,0,0,0.4);
      border-radius: 8px;
      padding: 12px;
      font-size: 12px;
      word-break: break-all;
      color: #fff;
      margin-bottom: 12px;
      font-family: monospace;
    }

    .copy-btn {
      background: #25d366;
      border: none;
      border-radius: 8px;
      padding: 10px 20px;
      color: white;
      font-weight: 600;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.3s;
    }

    .copy-btn:hover { background: #128c7e; }

    .status {
      margin-top: 14px;
      padding: 10px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      display: none;
    }

    .status.info {
      background: rgba(37,211,102,0.15);
      color: #25d366;
      display: block;
    }

    .status.error {
      background: rgba(255,50,50,0.15);
      color: #ff6b6b;
      display: block;
    }

    .steps {
      text-align: left;
      margin-top: 20px;
    }

    .step {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 14px;
    }

    .step-num {
      background: #25d366;
      color: white;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .step-text {
      color: #ccc;
      font-size: 13px;
      line-height: 1.5;
    }

    .footer {
      color: #555;
      font-size: 12px;
      margin-top: 20px;
    }

    .footer a {
      color: #25d366;
      text-decoration: none;
    }

    .loader {
      display: inline-block;
      width: 18px;
      height: 18px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      vertical-align: middle;
      margin-right: 8px;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
<div class="container">
  <div class="logo">🤖</div>
  <h1>NelsonFxBot</h1>
  <p class="subtitle">Session ID Generator — Connect your WhatsApp</p>

  <div class="card">
    <div class="method-title">Choose Connection Method</div>

    <div class="tabs">
      <button class="tab active" onclick="switchTab('pairing')">📱 Pairing Code</button>
      <button class="tab" onclick="switchTab('qr')">📷 QR Code</button>
    </div>

    <!-- Pairing Code Tab -->
    <div class="tab-content active" id="pairing-tab">
      <input
        type="tel"
        id="phone-input"
        placeholder="Enter phone number (e.g. 2349138567333)"
        maxlength="15"
      />
      <button class="btn" id="pairing-btn" onclick="getPairingCode()">
        Get Pairing Code
      </button>
      <div class="status" id="pairing-status"></div>
    </div>

    <!-- QR Code Tab -->
    <div class="tab-content" id="qr-tab">
      <button class="btn" id="qr-btn" onclick="getQRCode()">
        Generate QR Code
      </button>
      <div class="qr-container" id="qr-container">
        <img id="qr-image" src="" alt="QR Code" />
        <p class="qr-text">📱 Open WhatsApp → Linked Devices → Link a Device → Scan this QR</p>
      </div>
      <div class="status" id="qr-status"></div>
    </div>

    <!-- Session ID Result -->
    <div class="session-box" id="session-box">
      <h3>✅ Session ID Generated!</h3>
      <div class="session-id" id="session-id-text"></div>
      <button class="copy-btn" onclick="copySession()">📋 Copy Session ID</button>
      <p style="color:#aaa; font-size:12px; margin-top:10px;">
        Paste this SESSION_ID in your config.env file
      </p>
    </div>
  </div>

  <div class="card">
    <div class="method-title">📋 How To Use</div>
    <div class="steps">
      <div class="step">
        <div class="step-num">1</div>
        <div class="step-text">Enter your WhatsApp number or scan the QR code above</div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div class="step-text">Copy the SESSION_ID that appears</div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div class="step-text">Fork NelsonFxBot on GitHub and add your SESSION_ID to config.env</div>
      </div>
      <div class="step">
        <div class="step-num">4</div>
        <div class="step-text">Deploy to Render using the Deploy button in the README</div>
      </div>
    </div>
  </div>

  <div class="footer">
    Made with ❤️ by <a href="https://wa.me/2349138567333">NelsonFx</a> |
    <a href="https://github.com/nels0nfx/NelsonFxBot">GitHub</a>
  </div>
</div>

<script>
  let currentSessionId = null

  function switchTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'))
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'))
    document.getElementById(tab + '-tab').classList.add('active')
    event.target.classList.add('active')
  }

  async function getPairingCode() {
    const phone = document.getElementById('phone-input').value.trim().replace(/[^0-9]/g, '')
    const status = document.getElementById('pairing-status')
    const btn = document.getElementById('pairing-btn')

    if (!phone || phone.length < 10) {
      status.className = 'status error'
      status.textContent = '❌ Enter a valid phone number!'
      return
    }

    btn.disabled = true
    btn.innerHTML = '<span class="loader"></span> Connecting...'
    status.className = 'status info'
    status.textContent = '⏳ Generating pairing code...'

    try {
      const res = await fetch('/pairing?phone=' + phone)
      const data = await res.json()

      if (data.code) {
        status.className = 'status info'
        status.innerHTML = '📱 Your Pairing Code: <strong style="font-size:20px; letter-spacing:2px">' + data.code + '</strong><br><small>Enter this in WhatsApp → Linked Devices → Link with phone number</small>'

        // Poll for session
        pollSession(data.sessionId)
      } else {
        throw new Error(data.error || 'Failed to get pairing code')
      }
    } catch (err) {
      status.className = 'status error'
      status.textContent = '❌ Error: ' + err.message
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

      if (data.qr) {
        document.getElementById('qr-image').src = data.qr
        qrContainer.style.display = 'block'
        status.className = 'status info'
        status.textContent = '📷 Scan the QR code with WhatsApp!'

        // Poll for session
        pollSession(data.sessionId)
      } else {
        throw new Error(data.error || 'Failed to generate QR')
      }
    } catch (err) {
      status.className = 'status error'
      status.textContent = '❌ Error: ' + err.message
      btn.disabled = false
      btn.innerHTML = 'Generate QR Code'
    }
  }

  async function pollSession(sessionId) {
    let attempts = 0
    const maxAttempts = 60

    const interval = setInterval(async () => {
      attempts++
      if (attempts > maxAttempts) {
        clearInterval(interval)
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

    const qrBtn = document.getElementById('qr-btn')
    const pairingBtn = document.getElementById('pairing-btn')
    if (qrBtn) { qrBtn.disabled = false; qrBtn.innerHTML = 'Generate QR Code' }
    if (pairingBtn) { pairingBtn.disabled = false; pairingBtn.innerHTML = 'Get Pairing Code' }
  }

  function copySession() {
    if (!currentSessionId) return
    navigator.clipboard.writeText(currentSessionId).then(() => {
      const btn = document.querySelector('.copy-btn')
      btn.textContent = '✅ Copied!'
      setTimeout(() => { btn.textContent = '📋 Copy Session ID' }, 2000)
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

  const sessionId = 'session_' + Date.now()
  const sessionPath = path.join(__dirname, 'sessions', sessionId)

  try {
    await fs.ensureDir(sessionPath)
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath)
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      browser: ['NelsonFxBot', 'Chrome', '1.0.0']
    })

    sock.ev.on('creds.update', saveCreds)

    // Wait for socket to be ready
    await new Promise(resolve => setTimeout(resolve, 2000))

    const code = await sock.requestPairingCode(phone)
    sessions.set(sessionId, { sock, state, connected: false, sessionId: null })

    sock.ev.on('connection.update', async (update) => {
      const { connection } = update
      if (connection === 'open') {
        // Generate session string
        const creds = JSON.stringify(state.creds)
        const sessionString = 'NELSONFX_' + Buffer.from(creds).toString('base64')
        const sessionData = sessions.get(sessionId)
        if (sessionData) {
          sessionData.connected = true
          sessionData.sessionId = sessionString
        }
        setTimeout(() => cleanSession(sessionId), 60000)
      }

      if (connection === 'close') {
        sessions.delete(sessionId)
        await cleanSession(sessionId)
      }
    })

    res.json({ code, sessionId })
  } catch (err) {
    await cleanSession(sessionId)
    res.json({ error: err.message })
  }
})

// ===========================
// QR Code Route
// ===========================
app.get('/qr', async (req, res) => {
  const sessionId = 'session_' + Date.now()
  const sessionPath = path.join(__dirname, 'sessions', sessionId)

  try {
    await fs.ensureDir(sessionPath)
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath)
    const { version } = await fetchLatestBaileysVersion()

    let qrData = null

    const sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      browser: ['NelsonFxBot', 'Chrome', '1.0.0']
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async (update) => {
      const { connection, qr } = update

      if (qr && !qrData) {
        qrData = await qrcode.toDataURL(qr)
        sessions.set(sessionId, {
          sock,
          state,
          connected: false,
          sessionId: null,
          qr: qrData
        })
      }

      if (connection === 'open') {
        const creds = JSON.stringify(state.creds)
        const sessionString = 'NELSONFX_' + Buffer.from(creds).toString('base64')
        const sessionData = sessions.get(sessionId)
        if (sessionData) {
          sessionData.connected = true
          sessionData.sessionId = sessionString
        }
        setTimeout(() => cleanSession(sessionId), 60000)
      }

      if (connection === 'close') {
        sessions.delete(sessionId)
        await cleanSession(sessionId)
      }
    })

    // Wait for QR to generate
    let waited = 0
    while (!qrData && waited < 15000) {
      await new Promise(resolve => setTimeout(resolve, 500))
      waited += 500
    }

    if (!qrData) {
      await cleanSession(sessionId)
      return res.json({ error: 'QR generation timeout. Try again.' })
    }

    res.json({ qr: qrData, sessionId })
  } catch (err) {
    await cleanSession(sessionId)
    res.json({ error: err.message })
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
// Start Server
// ===========================
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log('╔══════════════════════════════════╗')
  console.log('║   NelsonFxBot Session Generator  ║')
  console.log('║   Running on port ' + PORT + '           ║')
  console.log('║   Made by NelsonFx               ║')
  console.log('╚══════════════════════════════════╝')
})
