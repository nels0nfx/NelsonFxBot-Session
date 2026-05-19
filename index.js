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
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>NelsonFxBot — Session Generator</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',sans-serif;background:linear-gradient(135deg,#0a0a0a,#1a1a2e,#16213e);min-height:100vh;display:flex;align-items:center;justify-content:center;color:white;padding:20px}
.box{max-width:460px;width:100%;text-align:center}
.logo{font-size:52px;margin-bottom:8px}
h1{font-size:30px;font-weight:800;background:linear-gradient(90deg,#25d366,#128c7e);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:6px}
.sub{color:#888;font-size:13px;margin-bottom:26px}
.card{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);border-radius:18px;padding:26px;margin-bottom:14px}
.btn{width:100%;padding:14px;background:linear-gradient(135deg,#25d366,#128c7e);border:none;border-radius:12px;color:white;font-size:16px;font-weight:700;cursor:pointer;transition:opacity .2s;margin-bottom:12px}
.btn:disabled{opacity:.5;cursor:not-allowed}
.btn:hover:not(:disabled){opacity:.9}
.qrwrap{display:none;margin-top:18px;flex-direction:column;align-items:center;gap:12px}
.qrwrap img{width:240px;height:240px;border-radius:14px;border:3px solid #25d366;background:white;padding:8px}
.hint{color:#777;font-size:12px;line-height:1.6}
.sidbox{display:none;margin-top:18px;background:rgba(37,211,102,0.08);border:2px solid #25d366;border-radius:14px;padding:20px;text-align:left}
.sidbox h3{color:#25d366;margin-bottom:10px;font-size:15px;text-align:center}
.sid{background:rgba(0,0,0,0.5);border-radius:10px;padding:12px;font-size:10px;word-break:break-all;color:#eee;margin:10px 0;font-family:monospace;max-height:130px;overflow-y:auto}
.cbtn{width:100%;background:#25d366;border:none;border-radius:10px;padding:12px;color:white;font-weight:700;cursor:pointer;font-size:14px;margin-top:4px}
.cbtn:hover{background:#128c7e}
.msg{margin-top:14px;padding:12px;border-radius:10px;font-size:13px;display:none;line-height:1.6;text-align:center}
.msg.ok{background:rgba(37,211,102,0.12);color:#25d366;display:block}
.msg.er{background:rgba(255,80,80,0.12);color:#ff7070;display:block}
.sp{display:inline-block;width:15px;height:15px;border:2px solid rgba(255,255,255,0.2);border-top-color:white;border-radius:50%;animation:sp .7s linear infinite;vertical-align:middle;margin-right:6px}
@keyframes sp{to{transform:rotate(360deg)}}
.steps{text-align:left;margin-bottom:18px}
.step{display:flex;gap:10px;margin-bottom:10px;align-items:flex-start}
.snum{background:#25d366;color:white;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;margin-top:2px}
.stxt{color:#aaa;font-size:12px;line-height:1.5}
.foot{color:#444;font-size:12px;margin-top:14px}
.foot a{color:#25d366;text-decoration:none}
.timer{color:#888;font-size:12px;margin-top:6px}
</style>
</head>
<body>
<div class="box">
  <div class="logo">🤖</div>
  <h1>NelsonFxBot</h1>
  <p class="sub">Session ID Generator</p>

  <div class="card">
    <div class="steps">
      <div class="step">
        <div class="snum">1</div>
        <div class="stxt">Click "Generate QR Code" below</div>
      </div>
      <div class="step">
        <div class="snum">2</div>
        <div class="stxt">Open WhatsApp → tap ⋮ Menu → Linked Devices → Link a Device</div>
      </div>
      <div class="step">
        <div class="snum">3</div>
        <div class="stxt">Scan the QR code that appears</div>
      </div>
      <div class="step">
        <div class="snum">4</div>
        <div class="stxt">Copy your SESSION_ID and paste it in config.env</div>
      </div>
    </div>

    <button class="btn" id="qbtn" onclick="genQR()">
      📷 Generate QR Code
    </button>

    <div class="qrwrap" id="qrwrap">
      <img id="qrimg" src="" alt="QR Code"/>
      <p class="hint">
        ⚠️ Use your <b>bot number</b>, not your personal number!<br/>
        QR expires in 60 seconds — click again if expired
      </p>
      <p class="timer" id="timer"></p>
    </div>

    <div class="msg" id="msg"></div>

    <div class="sidbox" id="sidbox">
      <h3>✅ Connected! Your SESSION_ID:</h3>
      <div class="sid" id="sidtext"></div>
      <button class="cbtn" onclick="copySid()">📋 Copy SESSION_ID</button>
      <p style="color:#777;font-size:11px;margin-top:10px;text-align:center">
        Paste this as SESSION_ID in your config.env file
      </p>
    </div>
  </div>

  <div class="foot">
    Made with ❤️ by <a href="https://wa.me/2349138567333">NelsonFx</a>
  </div>
</div>

<script>
let copiedSid = null
let pollTimer = null
let countdownTimer = null

function setMsg(type, html) {
  const el = document.getElementById('msg')
  el.className = 'msg ' + type
  el.innerHTML = html
}

function startCountdown(seconds) {
  const el = document.getElementById('timer')
  let s = seconds
  clearInterval(countdownTimer)
  countdownTimer = setInterval(() => {
    s--
    if (s <= 0) {
      clearInterval(countdownTimer)
      el.textContent = '⚠️ QR expired! Click Generate again.'
      el.style.color = '#ff7070'
    } else {
      el.textContent = '⏱️ QR expires in ' + s + 's'
    }
  }, 1000)
}

async function genQR() {
  const btn = document.getElementById('qbtn')
  const qrwrap = document.getElementById('qrwrap')

  // Clear previous poll
  if (pollTimer) clearInterval(pollTimer)
  clearInterval(countdownTimer)

  btn.disabled = true
  btn.innerHTML = '<span class="sp"></span>Generating QR...'
  setMsg('ok', '⏳ Connecting to WhatsApp servers...')
  qrwrap.style.display = 'none'
  document.getElementById('timer').textContent = ''
  document.getElementById('timer').style.color = '#888'

  try {
    const res = await fetch('/genqr')
    const data = await res.json()

    if (data.error) throw new Error(data.error)

    document.getElementById('qrimg').src = data.qr
    qrwrap.style.display = 'flex'
    setMsg('ok', '📷 QR ready! Scan it with WhatsApp now.')
    btn.disabled = false
    btn.innerHTML = '🔄 Regenerate QR Code'

    startCountdown(55)
    pollForSession(data.sid)

  } catch(e) {
    setMsg('er', '❌ ' + e.message + '<br/>Please try again.')
    btn.disabled = false
    btn.innerHTML = '📷 Generate QR Code'
  }
}

function pollForSession(sid) {
  let tries = 0
  pollTimer = setInterval(async () => {
    tries++
    if (tries > 100) {
      clearInterval(pollTimer)
      return
    }
    try {
      const res = await fetch('/check?sid=' + sid)
      const data = await res.json()
      if (data.ready) {
        clearInterval(pollTimer)
        clearInterval(countdownTimer)
        copiedSid = data.session
        document.getElementById('sidtext').textContent = data.session
        document.getElementById('sidbox').style.display = 'block'
        document.getElementById('qrwrap').style.display = 'none'
        setMsg('ok', '✅ Successfully connected! Copy your SESSION_ID above.')
        document.getElementById('qbtn').innerHTML = '📷 Generate New QR'
        document.getElementById('timer').textContent = ''
      }
    } catch {}
  }, 2000)
}

function copySid() {
  if (!copiedSid) return
  navigator.clipboard.writeText(copiedSid).then(() => {
    const b = document.querySelector('.cbtn')
    b.textContent = '✅ Copied!'
    setTimeout(() => b.textContent = '📋 Copy SESSION_ID', 2500)
  })
}
</script>
</body>
</html>`)
})

// ===========================
// Generate QR Route
// ===========================
app.get('/genqr', async (req, res) => {
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
        keys: makeCacheableSignalKeyStore(
          state.keys,
          pino({ level: 'silent' })
        )
      },
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      browser: ['NelsonFxBot', 'Chrome', '121.0.0'],
      syncFullHistory: false,
      markOnlineOnConnect: false,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 10000
    })

    sock.ev.on('creds.update', saveCreds)
    sessions.set(sid, {
      sock,
      state,
      ready: false,
      session: null
    })

    sock.ev.on('connection.update', async (update) => {
      const { connection, qr, lastDisconnect } = update

      // Send QR to frontend
      if (qr && !responded) {
        responded = true
        try {
          const qrImage = await qrcode.toDataURL(qr, {
            errorCorrectionLevel: 'H',
            margin: 2,
            width: 300
          })
          res.json({ qr: qrImage, sid })
        } catch (err) {
          if (!res.headersSent) res.json({ error: err.message })
        }
      }

      // Connected successfully
      if (connection === 'open') {
        try {
          // Build session string from credentials
          const creds = JSON.stringify(state.creds)
          const session = 'NELSONFX~' + Buffer.from(creds).toString('base64')
          const s = sessions.get(sid)
          if (s) {
            s.ready = true
            s.session = session
          }
          // Clean up after 2 minutes
          setTimeout(() => cleanSession(sid), 120000)
        } catch (err) {
          console.error('Session error:', err.message)
        }
      }

      // Handle disconnection
      if (connection === 'close') {
        const code = new Boom(lastDisconnect?.error)?.output?.statusCode
        if (code === DisconnectReason.loggedOut) {
          await cleanSession(sid)
        }
        // If QR not yet sent and connection closed, send error
        if (!responded) {
          responded = true
          if (!res.headersSent) res.json({ error: 'Connection closed. Try again.' })
        }
      }
    })

    // Timeout if QR not generated in 20s
    setTimeout(async () => {
      if (!responded) {
        responded = true
        await cleanSession(sid)
        if (!res.headersSent) res.json({ error: 'QR timeout. Please try again.' })
      }
    }, 20000)

  } catch (err) {
    await cleanSession(sid)
    if (!responded && !res.headersSent) res.json({ error: err.message })
  }
})

// ===========================
// Check Session Status
// ===========================
app.get('/check', (req, res) => {
  const { sid } = req.query
  if (!sid) return res.json({ ready: false })
  const s = sessions.get(sid)
  if (!s) return res.json({ ready: false })
  if (s.ready && s.session) {
    return res.json({ ready: true, session: s.session })
  }
  res.json({ ready: false })
})

// ===========================
// Health Check
// ===========================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    bot: 'NelsonFxBot Session Generator',
    sessions: sessions.size,
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
  console.log('║   Port: ' + PORT + '                    ║')
  console.log('║   Made by NelsonFx               ║')
  console.log('╚══════════════════════════════════╝')
})
