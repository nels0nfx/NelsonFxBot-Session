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
<title>NelsonFxBot Session Generator</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',sans-serif;background:linear-gradient(135deg,#0a0a0a,#1a1a2e,#16213e);min-height:100vh;display:flex;align-items:center;justify-content:center;color:white;padding:20px}
.box{max-width:460px;width:100%;text-align:center}
.logo{font-size:50px;margin-bottom:8px}
h1{font-size:28px;font-weight:800;background:linear-gradient(90deg,#25d366,#128c7e);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:6px}
.sub{color:#888;font-size:13px;margin-bottom:26px}
.card{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);border-radius:18px;padding:26px;margin-bottom:14px}
.tabs{display:flex;background:rgba(0,0,0,0.4);border-radius:10px;padding:3px;margin-bottom:20px;gap:3px}
.tab{flex:1;padding:9px;border:none;background:transparent;color:#777;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;transition:all .2s}
.tab.on{background:#25d366;color:white}
.tc{display:none}.tc.on{display:block}
input{width:100%;padding:13px 14px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.11);border-radius:11px;color:white;font-size:14px;margin-bottom:11px;outline:none}
input:focus{border-color:#25d366}
input::placeholder{color:#555}
.btn{width:100%;padding:13px;background:linear-gradient(135deg,#25d366,#128c7e);border:none;border-radius:11px;color:white;font-size:15px;font-weight:700;cursor:pointer}
.btn:disabled{opacity:.5;cursor:not-allowed}
.codebox{display:none;margin-top:16px}
.code{font-size:40px;font-weight:900;letter-spacing:12px;color:#25d366;background:rgba(0,0,0,0.6);border-radius:12px;padding:20px;margin:10px 0;font-family:monospace;border:2px dashed #25d366}
.qrbox{display:none;margin-top:16px}
.qrbox img{width:210px;height:210px;border-radius:12px;border:3px solid #25d366}
.sidbox{display:none;margin-top:18px;background:rgba(37,211,102,0.08);border:2px solid #25d366;border-radius:12px;padding:18px}
.sidbox h3{color:#25d366;margin-bottom:8px;font-size:15px}
.sid{background:rgba(0,0,0,0.5);border-radius:8px;padding:11px;font-size:10px;word-break:break-all;color:#eee;margin:10px 0;font-family:monospace;text-align:left;max-height:120px;overflow-y:auto}
.cbtn{background:#25d366;border:none;border-radius:9px;padding:10px 20px;color:white;font-weight:700;cursor:pointer;font-size:14px}
.m{margin-top:12px;padding:11px;border-radius:9px;font-size:13px;display:none;line-height:1.6}
.m.ok{background:rgba(37,211,102,0.12);color:#25d366;display:block}
.m.er{background:rgba(255,80,80,0.12);color:#ff7070;display:block}
.hint{color:#666;font-size:11px;margin-top:5px;line-height:1.5}
.sp{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,0.2);border-top-color:white;border-radius:50%;animation:sp .7s linear infinite;vertical-align:middle;margin-right:5px}
@keyframes sp{to{transform:rotate(360deg)}}
.foot{color:#444;font-size:12px;margin-top:12px}
.foot a{color:#25d366;text-decoration:none}
</style>
</head>
<body>
<div class="box">
  <div class="logo">🤖</div>
  <h1>NelsonFxBot</h1>
  <p class="sub">Session ID Generator</p>
  <div class="card">
    <div class="tabs">
      <button class="tab on" onclick="sw('p',this)">📱 Pairing Code</button>
      <button class="tab" onclick="sw('q',this)">📷 QR Code</button>
    </div>
    <div class="tc on" id="p-tc">
      <input type="tel" id="ph" placeholder="Phone number with country code e.g 2349138567333"/>
      <p class="hint">⚠️ Must be your bot number, NOT your personal number!</p><br/>
      <button class="btn" id="pb" onclick="doP()">Get Pairing Code</button>
      <div class="codebox" id="cb">
        <p style="color:#aaa;font-size:13px">Enter this code in WhatsApp:</p>
        <div class="code" id="ct"></div>
        <p class="hint">WhatsApp → ⋮ Menu → Linked Devices → Link a Device → Link with phone number</p>
      </div>
      <div class="m" id="pm"></div>
    </div>
    <div class="tc" id="q-tc">
      <p class="hint" style="margin-bottom:12px">⚠️ Must be your bot number, NOT your personal number!</p>
      <button class="btn" id="qb" onclick="doQ()">Generate QR Code</button>
      <div class="qrbox" id="qrb">
        <img id="qi" src="" alt="QR"/>
        <p class="hint" style="margin-top:8px">WhatsApp → ⋮ Menu → Linked Devices → Link a Device → Scan QR</p>
      </div>
      <div class="m" id="qm"></div>
    </div>
    <div class="sidbox" id="sb">
      <h3>✅ Session Generated!</h3>
      <p style="color:#aaa;font-size:12px">Copy your SESSION_ID:</p>
      <div class="sid" id="sd"></div>
      <button class="cbtn" onclick="cp()">📋 Copy SESSION_ID</button>
      <p class="hint" style="margin-top:8px">Paste as SESSION_ID in your config.env</p>
    </div>
  </div>
  <div class="foot">Made with ❤️ by <a href="https://wa.me/2349138567333">NelsonFx</a></div>
</div>
<script>
let csid=null
function sw(t,el){
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on'))
  document.querySelectorAll('.tc').forEach(x=>x.classList.remove('on'))
  el.classList.add('on')
  document.getElementById(t+'-tc').classList.add('on')
}
function sm(id,type,html){
  const e=document.getElementById(id)
  e.className='m '+type
  e.innerHTML=html
}
async function doP(){
  const ph=document.getElementById('ph').value.replace(/[^0-9]/g,'')
  if(!ph||ph.length<7)return sm('pm','er','❌ Enter valid phone number with country code!')
  const btn=document.getElementById('pb')
  btn.disabled=true
  btn.innerHTML='<span class="sp"></span>Connecting...'
  document.getElementById('cb').style.display='none'
  sm('pm','ok','⏳ Connecting to WhatsApp...')
  try{
    const r=await fetch('/pair?phone='+ph)
    const d=await r.json()
    if(d.error)throw new Error(d.error)
    document.getElementById('ct').textContent=d.code
    document.getElementById('cb').style.display='block'
    sm('pm','ok','⏳ Code ready! Enter it in WhatsApp now...')
    poll(d.sid,'pm',btn,'Get Pairing Code')
  }catch(e){
    sm('pm','er','❌ '+e.message)
    btn.disabled=false
    btn.innerHTML='Get Pairing Code'
  }
}
async function doQ(){
  const btn=document.getElementById('qb')
  btn.disabled=true
  btn.innerHTML='<span class="sp"></span>Generating...'
  sm('qm','ok','⏳ Generating QR code...')
  try{
    const r=await fetch('/qr')
    const d=await r.json()
    if(d.error)throw new Error(d.error)
    document.getElementById('qi').src=d.qr
    document.getElementById('qrb').style.display='block'
    sm('qm','ok','📷 Scan now! QR expires in ~60 seconds.')
    poll(d.sid,'qm',btn,'Generate QR Code')
  }catch(e){
    sm('qm','er','❌ '+e.message)
    btn.disabled=false
    btn.innerHTML='Generate QR Code'
  }
}
function poll(sid,mid,btn,bt){
  let n=0
  const t=setInterval(async()=>{
    n++
    if(n>120){
      clearInterval(t)
      sm(mid,'er','❌ Timed out. Please try again.')
      btn.disabled=false;btn.innerHTML=bt
      return
    }
    try{
      const r=await fetch('/status?sid='+sid)
      const d=await r.json()
      if(d.ok){
        clearInterval(t)
        csid=d.session
        document.getElementById('sd').textContent=d.session
        document.getElementById('sb').style.display='block'
        sm(mid,'ok','✅ Connected! Copy your SESSION_ID above.')
        btn.disabled=false;btn.innerHTML=bt
      }
    }catch{}
  },3000)
}
function cp(){
  if(!csid)return
  navigator.clipboard.writeText(csid).then(()=>{
    const b=document.querySelector('.cbtn')
    b.textContent='✅ Copied!'
    setTimeout(()=>b.textContent='📋 Copy SESSION_ID',2500)
  })
}
</script>
</body>
</html>`)
})

// ===========================
// Pairing Code Route
// ===========================
app.get('/pair', async (req, res) => {
  const phone = req.query.phone?.replace(/[^0-9]/g, '')
  if (!phone) return res.json({ error: 'Phone number required' })

  const sid = 'p_' + Date.now()
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
    sessions.set(sid, { sock, state, ok: false, session: null })

    sock.ev.on('connection.update', async (update) => {
      const { connection, qr, lastDisconnect } = update

      // ✅ Official way — request code on connecting or qr event
      if ((connection === 'connecting' || !!qr) && !responded) {
        responded = true
        try {
          const code = await sock.requestPairingCode(phone)
          const fmt = code?.match(/.{1,4}/g)?.join('-') || code
          res.json({ code: fmt, sid })
        } catch (err) {
          res.json({ error: 'Failed to get code: ' + err.message })
          await cleanSession(sid)
        }
      }

      if (connection === 'open') {
        try {
          const session = 'NELSONFX~' + Buffer.from(
            JSON.stringify(state.creds)
          ).toString('base64')
          const s = sessions.get(sid)
          if (s) { s.ok = true; s.session = session }
          setTimeout(() => cleanSession(sid), 120000)
        } catch (err) {
          console.error('Build session error:', err.message)
        }
      }

      if (connection === 'close') {
        const code = new Boom(lastDisconnect?.error)?.output?.statusCode
        if (code === DisconnectReason.loggedOut) await cleanSession(sid)
      }
    })

    // Timeout fallback
    setTimeout(() => {
      if (!responded) {
        responded = true
        cleanSession(sid)
        res.json({ error: 'Connection timeout. Try again.' })
      }
    }, 30000)

  } catch (err) {
    await cleanSession(sid)
    if (!responded) res.json({ error: err.message })
  }
})

// ===========================
// QR Code Route
// ===========================
app.get('/qr', async (req, res) => {
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
    sessions.set(sid, { sock, state, ok: false, session: null })

    sock.ev.on('connection.update', async (update) => {
      const { connection, qr, lastDisconnect } = update

      if (qr && !responded) {
        responded = true
        try {
          const img = await qrcode.toDataURL(qr)
          res.json({ qr: img, sid })
        } catch (err) {
          res.json({ error: err.message })
        }
      }

      if (connection === 'open') {
        try {
          const session = 'NELSONFX~' + Buffer.from(
            JSON.stringify(state.creds)
          ).toString('base64')
          const s = sessions.get(sid)
          if (s) { s.ok = true; s.session = session }
          setTimeout(() => cleanSession(sid), 120000)
        } catch (err) {
          console.error('Build session error:', err.message)
        }
      }

      if (connection === 'close') {
        const code = new Boom(lastDisconnect?.error)?.output?.statusCode
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
// Status Check Route
// ===========================
app.get('/status', (req, res) => {
  const { sid } = req.query
  if (!sid) return res.json({ ok: false })
  const s = sessions.get(sid)
  if (!s) return res.json({ ok: false })
  if (s.ok && s.session) return res.json({ ok: true, session: s.session })
  res.json({ ok: false })
})

// ===========================
// Health Check
// ===========================
app.get('/health', (req, res) => {
  res.json({ status: 'running', sessions: sessions.size })
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
