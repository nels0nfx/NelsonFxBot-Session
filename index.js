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
      padding: 20px;
    }
    .container { max-width: 480px; width: 100%; text-align: center; }
    .logo { font-size: 52px; margin-bottom: 10px; }
    h1 {
      font-size: 30px; font-weight: 800;
      background: linear-gradient(90deg, #25d366, #128c7e);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 6px;
    }
    .subtitle { color: #888; font-size: 14px; margin-bottom: 28px; }
    .card {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 20px; padding: 28px;
      margin-bottom: 16px;
    }
    .tabs {
      display: flex;
      background: rgba(0,0,0,0.4);
      border-radius: 12px; padding: 4px;
      margin-bottom: 22px; gap: 4px;
    }
    .tab {
      flex: 1; padding: 10px; border: none;
      background: transparent; color: #777;
      border-radius: 10px; cursor: pointer;
      font-size: 14px; font-weight: 600;
      transition: all 0.2s;
    }
    .tab.active { background: #25d366; color: white; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    input {
      width: 100%; padding: 13px 15px;
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 12px; color: white;
      font-size: 15px; margin-bottom: 12px;
      outline: none; transition: border 0.2s;
    }
    input:focus { border-color: #25d366; }
    input::placeholder { color: #555; }
    .btn {
      width: 100%; padding: 13px;
      background: linear-gradient(135deg, #25d366, #128c7e);
      border: none; border-radius: 12px;
      color: white; font-size: 15px;
      font-weight: 700; cursor: pointer;
      transition: opacity 0.2s;
    }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .code-wrap { display: none; margin-top: 18px; }
    .code-display {
      font-size: 38px; font-weight: 900;
      letter-spacing: 10px; color: #25d366;
      background: rgba(0,0,0,0.5);
      border-radius: 14px; padding: 18px;
      margin: 12px 0; font-family: monospace;
      border: 2px dashed #25d366;
    }
    .qr-wrap { display: none; margin-top: 18px; }
    .qr-wrap img {
      width: 220px; height: 220px;
      border-radius: 14px;
      border: 3px solid #25d366;
    }
    .session-wrap {
      display: none; margin-top: 20px;
      background: rgba(37,211,102,0.08);
      border: 2px solid #25d366;
      border-radius: 14px; padding: 20px;
    }
    .session-wrap h3 { color: #25d366; margin-bottom: 10px; }
    .sid-box {
      background: rgba(0,0,0,0.5);
      border-radius: 10px; padding: 12px;
      font-size: 10.5px; word-break: break-all;
      color: #eee; margin: 12px 0;
      font-family: monospace; text-align: left;
      max-height: 130px; overflow-y: auto;
    }
    .copy-btn {
      background: #25d366; border: none;
      border-radius: 10px; padding: 11px 22px;
      color: white; font-weight: 700;
      cursor: pointer; font-size: 14px;
    }
    .msg {
      margin-top: 14px; padding: 11px;
      border-radius: 10px; font-size: 13px;
      display: none; line-height: 1.6;
    }
    .msg.ok { background: rgba(37,211,102,0.12); color: #25d366; display: block; }
    .msg.err { background: rgba(255,80,80,0.12); color: #ff7070; display: block; }
    .spin {
      display: inline-block; width: 15px; height: 15px;
      border: 2px solid rgba(255,255,255,0.25);
      border-top-color: white; border-radius: 50%;
      animation: sp 0.7s linear infinite;
      vertical-align: middle; margin-right: 6px;
    }
    @keyframes sp { to { transform: rotate(360deg); } }
    .footer { color: #444; font-size: 12px; margin-top: 14px; }
    .footer a { color: #25d366; text-decoration: none; }
    .hint { color: #666; font-size: 11px; margin-top: 6px; line-height: 1.5; }
  </style>
</head>
<body>
<div class="container">
  <div class="logo">🤖</div>
  <h1>NelsonFxBot</h1>
  <p class="subtitle">Session ID Generator</p>

  <div class="card">
    <div class="tabs">
      <button class="tab active" onclick="switchTab('p',this)">📱 Pairing Code</button>
      <button class="tab" onclick="switchTab('q',this)">📷 QR Code</button>
    </div>

    <!-- Pairing -->
    <div class="tab-content active" id="p-tab">
      <input type="tel" id="phone"
        placeholder="e.g. 2349138567333 (with country code, no +)"/>
      <p class="hint">⚠️ Use your bot number, not your main number!</p>
      <br/>
      <button class="btn" id="p-btn" onclick="doPairing()">
        Get Pairing Code
      </button>
      <div class="code-wrap" id="code-wrap">
        <p style="color:#aaa;font-size:13px">Your Pairing Code:</p>
        <div class="code-display" id="code-text"></div>
        <p class="hint">
          Open WhatsApp on your bot number<br>
          Tap ⋮ → Linked Devices → Link a Device<br>
          Tap "Link with phone number" → Enter code above
        </p>
      </div>
      <div class="msg" id="p-msg"></div>
    </div>

    <!-- QR -->
    <div class="tab-content" id="q-tab">
      <p class="hint" style="margin-bottom:14px">
        ⚠️ Use your bot number, not your main number!
      </p>
      <button class="btn" id="q-btn" onclick="doQR()">
        Generate QR Code
      </button>
      <div class="qr-wrap" id="qr-wrap">
        <img id="qr-img" src="" alt="QR Code"/>
        <p class="hint" style="margin-top:8px">
          Open WhatsApp → ⋮ → Linked Devices<br>
          → Link a Device → Scan this QR
        </p>
      </div>
      <div class="msg" id="q-msg"></div>
    </div>

    <!-- Session Result -->
    <div class="session-wrap" id="session-wrap">
      <h3>✅ Session Generated!</h3>
      <p style="color:#aaa;font-size:12px">Your SESSION_ID (copy this):</p>
      <div class="sid-box" id="sid-box"></div>
      <button class="copy-btn" onclick="copySid()">📋 Copy SESSION_ID</button>
      <p class="hint" style="margin-top:10px">
        Paste this as SESSION_ID in your config.env file
      </p>
    </div>
  </div>

  <div class="footer">
    Made with ❤️ by <a href="https://wa.me/2349138567333">NelsonFx</a>
  </div>
</div>

<script>
  let copiedSid = null

  function switchTab(t, el) {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'))
    document.querySelectorAll('.tab-content').forEach(x => x.classList.remove('active'))
    el.classList.add('active')
    document.getElementById(t + '-tab').classList.add('active')
  }

  function msg(id, type, html) {
    const el = document.getElementById(id)
    el.className = 'msg ' + type
    el.innerHTML = html
  }

  async function doPairing() {
    const phone = document.getElementById('phone').value.replace(/[^0-9]/g, '')
    if (!phone || phone.length < 7) {
      return msg('p-msg', 'err', '❌ Enter a valid phone number!')
    }
    const btn = document.getElementById('p-btn')
    btn.disabled = true
    btn.innerHTML = '<span class="spin"></span>Connecting...'
    document.getElementById('code-wrap').style.display = 'none'
    msg('p-msg', 'ok', '⏳ Connecting to WhatsApp...')

    try {
      const r = await fetch('/api/pairing?phone=' + phone)
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      document.getElementById('code-text').textContent = d.code
      document.getElementById('code-wrap').style.display = 'block'
      msg('p-msg', 'ok', '⏳ Enter the code in WhatsApp and wait...')
      poll(d.sid, 'p-msg', btn, 'Get Pairing Code')
    } catch(e) {
      msg('p-msg', 'err', '❌ ' + e.message)
      btn.disabled = false
      btn.innerHTML = 'Get Pairing Code'
    }
  }

  async function doQR() {
    const btn = document.getElementById('q-btn')
    btn.disabled = true
    btn.innerHTML = '<span class="spin"></span>Generating...'
    msg('q-msg', 'ok', '⏳ Generating QR code...')

    try {
      const r = await fetch('/api/qr')
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      document.getElementById('qr-img').src = d.qr
      document.getElementById('qr-wrap').style.display = 'block'
      msg('q-msg', 'ok', '📷 Scan quickly! QR expires in ~60 seconds.')
      poll(d.sid, 'q-msg', btn, 'Generate QR Code')
    } catch(e) {
      msg('q-msg', 'err', '❌ ' + e.message)
      btn.disabled = false
      btn.innerHTML = 'Generate QR Code'
    }
  }

  function poll(sid, msgId, btn, btnText) {
    let n = 0
    const t = setInterval(async () => {
      n++
      if (n > 120) {
        clearInterval(t)
        msg(msgId, 'err', '❌ Timed out. Please try again.')
        btn.disabled = false
        btn.innerHTML = btnText
        return
      }
      try {
        const r = await fetch('/api/check?sid=' + sid)
        const d = await r.json()
        if (d.ready) {
          clearInterval(t)
          copiedSid = d.session
          document.getElementById('sid-box').textContent = d.session
          document.getElementById('session-wrap').style.display = 'block'
          msg(msgId, 'ok', '✅ Connected! Copy your SESSION_ID above.')
          btn.disabled = false
          btn.innerHTML = btnText
        }
      } catch {}
    }, 2500)
  }

  function copySid() {
    if (!copiedSid) return
    navigator.clipboard.writeText(copiedSid).then(() => {
      const b = document.querySelector('.copy-btn')
      b.textContent = '✅ Copied!'
      setTimeout(() => b.textContent = '📋 Copy SESSION_ID', 2500)
    })
  }
</script>
</body>
</html>
  `)
})

// ===========================
// Pairing Code API
// ===========================
app.get('/api/pairing', async (req, res) => {
  const phone = req.query.phone?.replace(/[^0-9]/g, '')
  if (!phone) return res.json({ error: 'Phone number required' })

  const sid = 'p_' + Date.now()
  const sessionPath = path.join(__dirname, 'sessions', sid)

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
      browser: Browsers.macOS('Desktop'),
      syncFullHistory: false,
      markOnlineOnConnect: false
    })

    sock.ev.on('creds.update', saveCreds)
    sessions.set(sid, { sock, state, ready: false, session: null })

    let codeSent = false

    sock.ev.on('connection.update', async (update) => {
      const { connection, qr } = update

      // Request pairing code on connecting or qr event
      if ((connection === 'connecting' || qr) && !codeSent && !sock.authState.creds.registered) {
        codeSent = true
        try {
          await new Promise(r => setTimeout(r, 1500))
          const code = await sock.requestPairingCode(phone)
          const formatted = code?.match(/.{1,4}/g)?.join('-') || code
          if (!res.headersSent) res.json({ code: formatted, sid })
        } catch (err) {
          if (!res.headersSent) res.json({ error: err.message })
          await cleanSession(sid)
        }
      }

      if (connection === 'open') {
        try {
          const session = 'NELSONFX~' + Buffer.from(JSON.stringify(state.creds)).toString('base64')
          const s = sessions.get(sid)
          if (s) { s.ready = true; s.session = session }
          setTimeout(() => cleanSession(sid), 120000)
        } catch (err) {
          console.error('Session build error:', err.message)
        }
      }

      if (connection === 'close') {
        const code = new Boom(update.lastDisconnect?.error)?.output?.statusCode
        if (code === DisconnectReason.loggedOut) await cleanSession(sid)
      }
    })

    // Safety timeout
    setTimeout(() => {
      if (!res.headersSent) res.json({ error: 'Connection timeout. Try again.' })
    }, 30000)

  } catch (err) {
    await cleanSession(sid)
    if (!res.headersSent) res.json({ error: err.message })
  }
})

// ===========================
// QR Code API
// ===========================
app.get('/api/qr', async (req, res) => {
  const sid = 'q_' + Date.now()
  const sessionPath = path.join(__dirname, 'sessions', sid)
  let responded = false

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
      browser: Browsers.macOS('Desktop'),
      syncFullHistory: false,
      markOnlineOnConnect: false
    })

    sock.ev.on('creds.update', saveCreds)
    sessions.set(sid, { sock, state, ready: false, session: null })

    sock.ev.on('connection.update', async (update) => {
      const { connection, qr } = update

      if (qr && !responded) {
        responded = true
        try {
          const qrImg = await qrcode.toDataURL(qr)
          res.json({ qr: qrImg, sid })
        } catch (err) {
          res.json({ error: err.message })
        }
      }

      if (connection === 'open') {
        try {
          const session = 'NELSONFX~' + Buffer.from(JSON.stringify(state.creds)).toString('base64')
          const s = sessions.get(sid)
          if (s) { s.ready = true; s.session = session }
          setTimeout(() => cleanSession(sid), 120000)
        } catch (err) {
          console.error('Session build error:', err.message)
        }
      }

      if (connection === 'close') {
        const code = new Boom(update.lastDisconnect?.error)?.output?.statusCode
        if (code === DisconnectReason.loggedOut) await cleanSession(sid)
      }
    })

    setTimeout(() => {
      if (!responded) {
        responded = true
        cleanSession(sid)
        res.json({ error: 'QR timeout. Try again.' })
      }
    }, 20000)

  } catch (err) {
    await cleanSession(sid)
    if (!responded) res.json({ error: err.message })
  }
})

// ===========================
// Check Session
// ===========================
app.get('/api/check', (req, res) => {
  const { sid } = req.query
  if (!sid) return res.json({ ready: false })
  const s = sessions.get(sid)
  if (!s) return res.json({ ready: false })
  if (s.ready && s.session) return res.json({ ready: true, session: s.session })
  res.json({ ready: false })
})

// ===========================
// Health
// ===========================
app.get('/health', (req, res) => {
  res.json({ status: 'ok', activeSessions: sessions.size })
})

// ===========================
// Start Server
// ===========================
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log('╔══════════════════════════════════╗')
  console.log('║   NelsonFxBot Session Generator  ║')
  console.log('║   Port: ' + PORT + '                    ║')
  console.log('║   Made by NelsonFx               ║')
  console.log('╚══════════════════════════════════╝')
})
