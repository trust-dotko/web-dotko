import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import crypto from 'node:crypto'

export default defineConfig(({ mode }) => {
  // Load ALL env vars (including non-VITE_ ones for the dev API middleware)
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      devApiPlugin(env),
    ],
    // Serve branding assets from public/
    publicDir: 'assets',
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test-setup.js'],
    },
  }
})

// ---------------------------------------------------------------------------
// Dev-only middleware: emulates /api/* Vercel Serverless Functions locally
// so `npm run dev` works without needing `vercel dev`.
// ---------------------------------------------------------------------------
function devApiPlugin(env) {
  const useTest = env.GST_USE_TEST_API === 'true'
  const BASE    = useTest ? 'https://test-api.sandbox.co.in' : 'https://api.sandbox.co.in'
  const API_KEY = useTest ? env.GST_TEST_API_KEY : env.GST_API_KEY
  const SECRET  = useTest ? env.GST_TEST_API_SECRET : env.GST_API_SECRET

  // Expose loaded env to the real serverless handlers (they read process.env),
  // so the dev middleware can delegate to them instead of re-implementing.
  for (const [k, v] of Object.entries(env)) {
    if (process.env[k] === undefined) process.env[k] = v
  }

  let cachedToken = null
  let tokenExpiry = null

  // ── Dev phone-OTP support ──────────────────────────────────────────────────
  // Real Firebase Admin (lazy) so signInWithCustomToken works against the live
  // project, exactly like prod. Requires FIREBASE_* service-account creds in .env.local.
  let _admin = null
  async function getAdmin() {
    if (_admin) return _admin
    const { initializeApp, cert, getApps } = await import('firebase-admin/app')
    const { getFirestore } = await import('firebase-admin/firestore')
    const { getAuth } = await import('firebase-admin/auth')
    if (!getApps().length) {
      initializeApp({
        credential: cert({
          projectId: env.FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID,
          clientEmail: env.FIREBASE_CLIENT_EMAIL,
          privateKey: (env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        }),
      })
    }
    _admin = { adminAuth: getAuth(), adminDb: getFirestore() }
    return _admin
  }

  const devOtps = new Map() // phone -> { otp, expiresAt, attempts }

  async function sendDevOtpWhatsApp(phone, otp) {
    const token = env.WHATSAPP_ACCESS_TOKEN
    const phoneId = env.WHATSAPP_PHONE_NUMBER_ID
    if (!token || !phoneId) return
    const template = env.WHATSAPP_OTP_TEMPLATE || 'dotko_otp'
    const lang = env.WHATSAPP_OTP_TEMPLATE_LANG || 'en'
    try {
      const r = await fetch(`https://graph.facebook.com/v24.0/${phoneId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp', to: `91${phone}`, type: 'template',
          template: { name: template, language: { code: lang }, components: [
            { type: 'body', parameters: [{ type: 'text', text: otp }] },
            { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: otp }] },
          ] },
        }),
      })
      const b = await r.json().catch(() => ({}))
      if (b.error) console.warn('[dev-api] WhatsApp OTP send error:', b.error.message)
    } catch (e) { console.warn('[dev-api] WhatsApp OTP send failed:', e.message) }
  }

  // Persist dev profiles to disk so they survive dev server restarts!
  const profilesPath = path.resolve(process.cwd(), '.dev-profiles.json')
  
  let devProfiles = new Map()
  try {
    if (fs.existsSync(profilesPath)) {
      const data = JSON.parse(fs.readFileSync(profilesPath, 'utf8'))
      devProfiles = new Map(Object.entries(data))
    }
  } catch (e) {
    console.warn('[dev-api] Could not load persisted profiles:', e.message)
  }

  function saveProfiles() {
    try {
      fs.writeFileSync(profilesPath, JSON.stringify(Object.fromEntries(devProfiles)), 'utf8')
    } catch (e) {
      console.warn('[dev-api] Could not save persisted profiles:', e.message)
    }
  }

  async function authenticate() {
    if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) return cachedToken

    console.log(`[dev-api] Authenticating with Sandbox (${useTest ? 'TEST' : 'LIVE'} mode)`)
    console.log(`[dev-api] API Key: ${API_KEY ? API_KEY.substring(0, 12) + '...' : 'MISSING'}`)
    console.log(`[dev-api] API Secret: ${SECRET ? SECRET.substring(0, 14) + '...' : 'MISSING'}`)
    console.log(`[dev-api] Base URL: ${BASE}`)

    if (!API_KEY || !SECRET) {
      throw new Error('GST API credentials missing. Check GST_TEST_API_KEY / GST_TEST_API_SECRET in .env.local')
    }

    const res = await fetch(`${BASE}/authenticate`, {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
        'x-api-secret': SECRET,
        'x-api-version': '1.0',
      },
    })
    const data = await res.json()
    console.log(`[dev-api] Auth response: code=${data.code}, has_token=${!!data.data?.access_token}`)

    if (data.code === 200 && data.data?.access_token) {
      cachedToken = data.data.access_token
      tokenExpiry = Date.now() + 23 * 3600_000
      return cachedToken
    }
    throw new Error(`Sandbox auth failed (code ${data.code}): ${JSON.stringify(data.message || data)}`)
  }

  function parseGSTData(raw) {
    if (!raw) return null
    const parseAddr = (obj) => {
      if (!obj) return null
      const a = obj.addr || {}
      return {
        buildingName: a.bnm || '', street: a.st || '', location: a.loc || '',
        district: a.dst || '', state: a.stcd || '', pincode: a.pncd || '',
        fullAddress: [a.bnm, a.bno, a.flno, a.st, a.loc, a.locality, a.dst, a.stcd, a.pncd]
          .filter(Boolean).join(', '),
        natureOfBusiness: Array.isArray(obj.ntr) ? obj.ntr : [obj.ntr].filter(Boolean),
      }
    }
    return {
      gstin: raw.gstin, legalName: raw.lgnm, tradeName: raw.tradeNam || raw.lgnm,
      status: raw.sts, registrationDate: raw.rgdt,
      constitutionOfBusiness: raw.ctb, taxpayerType: raw.dty,
      natureOfBusinessActivities: raw.nba || [],
      eInvoiceEnabled: raw.einvoiceStatus === 'Yes',
      principalAddress: parseAddr(raw.pradr),
      stateCode: raw.gstin ? raw.gstin.substring(0, 2) : '',
    }
  }

  return {
    name: 'dev-api-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/')) return next()

        // Parse POST body
        if (req.method === 'POST') {
          let body = ''
          for await (const chunk of req) body += chunk
          try { req.body = body ? JSON.parse(body) : {} }
          catch { req.body = {} }
        }

        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

        if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return }

        // ---- /api/gst-verify ----
        if (req.url === '/api/gst-verify') {
          if (req.method !== 'POST') {
            res.statusCode = 405
            return res.end(JSON.stringify({ success: false, error: 'Method not allowed' }))
          }

          const { gstin } = req.body || {}
          if (!gstin) {
            res.statusCode = 400
            return res.end(JSON.stringify({ success: false, error: 'GSTIN is required' }))
          }

          const clean = gstin.trim().toUpperCase()
          if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(clean)) {
            res.statusCode = 400
            return res.end(JSON.stringify({ success: false, error: 'Invalid GSTIN format' }))
          }

          if (!API_KEY || !SECRET) {
            res.statusCode = 500
            return res.end(JSON.stringify({
              success: false,
              error: 'GST API keys not configured. Add GST_API_KEY and GST_API_SECRET to .env.local',
            }))
          }

          try {
            const token = await authenticate()
            const apiRes = await fetch(`${BASE}/gst/compliance/public/gstin/search`, {
              method: 'POST',
              headers: {
                'Authorization': token,
                'x-api-key': API_KEY,
                'x-api-version': '1.0.0',
                'x-accept-cache': 'true',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ gstin: clean }),
            })
            const data = await apiRes.json()

            if (data.code === 200) {
              if (data.data?.error) {
                res.statusCode = 404
                return res.end(JSON.stringify({
                  success: false,
                  error: data.data.error.message || 'GSTIN not found',
                }))
              }
              return res.end(JSON.stringify({
                success: true,
                gstin: clean,
                data: parseGSTData(data.data?.data || data.data),
                transactionId: data.transaction_id,
              }))
            }
            res.statusCode = 502
            return res.end(JSON.stringify({
              success: false,
              error: data.message || 'Failed to verify GSTIN',
            }))
          } catch (err) {
            console.error('[dev-api] GST verify error:', err.message)
            res.statusCode = 500
            return res.end(JSON.stringify({
              success: false,
              error: 'GST verification service error: ' + err.message,
            }))
          }
        }

        // ---- /api/phone-auth/send-otp ----
        if (req.url === '/api/phone-auth/send-otp' && req.method === 'POST') {
          const phone = String(req.body?.phone || '').trim()
          if (!/^[6-9]\d{9}$/.test(phone)) {
            res.statusCode = 400
            return res.end(JSON.stringify({ error: 'Enter a valid 10-digit Indian mobile number.' }))
          }
          const otp = String(crypto.randomInt(100000, 1000000))
          devOtps.set(phone, { otp, expiresAt: Date.now() + 5 * 60 * 1000, attempts: 0 })
          console.log(`\n[dev-api] ============================`)
          console.log(`[dev-api]  OTP for +91 ${phone}: ${otp}`)
          console.log(`[dev-api] ============================\n`)
          await sendDevOtpWhatsApp(phone, otp) // also deliver via WhatsApp if configured
          return res.end(JSON.stringify({ success: true, expiresInSeconds: 300 }))
        }

        // ---- /api/phone-auth/verify-otp ----
        if (req.url === '/api/phone-auth/verify-otp' && req.method === 'POST') {
          const phone = String(req.body?.phone || '').trim()
          const otp = String(req.body?.otp || '').trim()
          const rec = devOtps.get(phone)
          if (!rec || Date.now() > rec.expiresAt) {
            res.statusCode = 400
            return res.end(JSON.stringify({ error: 'No active code. Please request a new one.' }))
          }
          if (rec.otp !== otp) {
            rec.attempts += 1
            res.statusCode = 400
            return res.end(JSON.stringify({ error: 'Incorrect code. Please try again.' }))
          }
          devOtps.delete(phone)
          try {
            const { adminAuth, adminDb } = await getAdmin()
            const uid = `phone_${phone}`
            let isNewUser = false
            try { await adminAuth.getUser(uid) }
            catch { isNewUser = true; await adminAuth.createUser({ uid, displayName: phone }) }

            const userRef = adminDb.collection('users').doc(uid)
            const snap = await userRef.get()
            let profileComplete = false
            if (!snap.exists) {
              await userRef.set({
                mobileNumber: phone, profileComplete: false, onboardingCompleted: false,
                createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
              }, { merge: true })
            } else {
              profileComplete = Boolean(snap.data().profileComplete)
            }
            const token = await adminAuth.createCustomToken(uid, { phone })
            return res.end(JSON.stringify({ success: true, token, isNewUser, profileComplete }))
          } catch (e) {
            console.error('[dev-api] verify-otp admin error:', e.message)
            res.statusCode = 500
            return res.end(JSON.stringify({ error: 'Dev auth needs FIREBASE_* service-account creds in .env.local.' }))
          }
        }

        // ---- /api/phone-auth/complete-profile ----
        // Verify a GSTIN against the public GST registry and write the business
        // details to the user's profile (mirrors api/phone-auth/complete-profile.js).
        if (req.url === '/api/phone-auth/complete-profile' && req.method === 'POST') {
          const clean = String(req.body?.gstin || '').trim().toUpperCase()
          if (!clean) {
            res.statusCode = 400
            return res.end(JSON.stringify({ error: 'GSTIN is required.' }))
          }
          if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(clean)) {
            res.statusCode = 400
            return res.end(JSON.stringify({ error: 'Invalid GSTIN format.' }))
          }
          try {
            const { adminAuth, adminDb } = await getAdmin()
            const authHeader = req.headers?.authorization || ''
            if (!authHeader.startsWith('Bearer ')) { res.statusCode = 401; return res.end(JSON.stringify({ error: 'Unauthorized' })) }
            const decoded = await adminAuth.verifyIdToken(authHeader.slice(7))
            const uid = decoded.uid

            // Duplicate guard: reject if this GST already belongs to a different account.
            const claimed = await adminDb.collection('users').where('gst', '==', clean).limit(2).get()
            if (claimed.docs.some((d) => d.id !== uid)) {
              res.statusCode = 409
              return res.end(JSON.stringify({ error: 'An account already exists for this GST number. Please sign in.' }))
            }

            // Resolve verified business data (real Sandbox search, or dev mock).
            let biz = null
            if (API_KEY && SECRET) {
              try {
                const token = await authenticate()
                const apiRes = await fetch(`${BASE}/gst/compliance/public/gstin/search`, {
                  method: 'POST',
                  headers: {
                    'Authorization': token, 'x-api-key': API_KEY, 'x-api-version': '1.0.0',
                    'x-accept-cache': 'true', 'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ gstin: clean }),
                })
                const data = await apiRes.json()
                if (data.code === 200 && !data.data?.error) {
                  biz = parseGSTData(data.data?.data || data.data)
                } else if (data.data?.error) {
                  res.statusCode = 404
                  return res.end(JSON.stringify({ error: data.data.error.message || 'GSTIN not found.' }))
                }
              } catch (e) {
                console.warn('[dev-api] complete-profile GST search failed, using mock:', e.message)
              }
            }
            if (!biz || !biz.gstin) {
              // Dev fallback so the flow is testable without live GST credentials.
              biz = {
                gstin: clean, legalName: 'KILO BYTE INDUSTRIES', tradeName: 'KILO BYTE INDUSTRIES',
                status: 'Active', constitutionOfBusiness: 'Proprietorship', registrationDate: '01/07/2017',
                principalAddress: { state: 'Gujarat', district: 'Surat', fullAddress: '123, Industrial Area, Surat, Gujarat – 395001' },
                natureOfBusinessActivities: ['Retail Business'],
              }
            }
            const profileData = {
              businessName: biz.tradeName || biz.legalName || '', legalName: biz.legalName || '', tradeName: biz.tradeName || '',
              gst: biz.gstin || clean, entityType: biz.constitutionOfBusiness || '', gstStatus: biz.status || '',
              registrationDate: biz.registrationDate || '', state: biz.principalAddress?.state || '',
              city: biz.principalAddress?.district || '', address: biz.principalAddress?.fullAddress || '',
              natureOfBusiness: biz.natureOfBusinessActivities || [],
              gstVerified: true, profileComplete: true, onboardingCompleted: true, updatedAt: new Date().toISOString(),
            }
            await adminDb.collection('users').doc(uid).set(profileData, { merge: true })
            const merged = (await adminDb.collection('users').doc(uid).get()).data()
            return res.end(JSON.stringify({ success: true, profile: merged }))
          } catch (e) {
            console.error('[dev-api] complete-profile error:', e.message)
            res.statusCode = 502
            return res.end(JSON.stringify({ error: 'Could not complete profile in dev: ' + e.message }))
          }
        }

        // ---- /api/trust-score ----
        if (req.url === '/api/trust-score') {
          if (req.method !== 'POST') {
            res.statusCode = 405
            return res.end(JSON.stringify({ error: 'Method not allowed' }))
          }
          const { userData } = req.body || {}
          if (!userData) {
            res.statusCode = 400
            return res.end(JSON.stringify({ error: 'userData is required' }))
          }
          return res.end(JSON.stringify({ score: 50, label: 'Caution', description: 'Limited verification', color: '#F59E0B' }))
        }

        // NOTE: /api/trade (submit/update/verify) and /api/storage/* are handled
        // by the generic delegation fallback below, which invokes the REAL
        // serverless handlers (single source of truth — no dev/prod drift).

        // ---- Delegate any other /api/* route to the REAL Vercel handler ----
        // Adapts the Node res to the Express-like API the handlers expect, so dev
        // and prod run identical code (trade router, storage upload/download, …).
        try {
          const urlPath = req.url.split('?')[0].replace(/\/$/, '')
          const rel = urlPath.replace(/^\/api\//, '')
          const candidates = [
            path.join(process.cwd(), 'api', `${rel}.js`),
            path.join(process.cwd(), 'api', rel, 'index.js'),
          ]
          const file = candidates.find(f => fs.existsSync(f))
          if (file) {
            const mod = await import(`file://${file.replace(/\\/g, '/')}`)
            res.status = (c) => { res.statusCode = c; return res }
            res.json = (o) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); return res }
            await mod.default(req, res)
            return
          }
        } catch (err) {
          console.error('[dev-api] delegate error:', err)
          res.statusCode = 500
          return res.end(JSON.stringify({ error: `Dev API error: ${err.message}` }))
        }

        // Unknown API route
        res.statusCode = 404
        return res.end(JSON.stringify({ error: 'API endpoint not found' }))
      })
    },
  }
}
