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

  // documents = { gstn_details, company_master_details, udhyam_certificate }, meta = session status body
  function parseEntityLockerDev(documents, meta = {}) {
    const gstn    = documents.gstn_details            || {}
    const company = documents.company_master_details  || {}
    const udyam   = documents.udhyam_certificate      || {}
    const pick    = (...vs) => vs.find(v => v && String(v).trim() !== '') ?? ''
    const addr    = gstn.principal_address || gstn.address_details || {}
    const legalName = pick(gstn.legal_name, gstn.legalName, company.company_name, company.name, meta.legal_name)
    return {
      gstin:                   pick(gstn.gstin,               gstn.gstIn,              meta.gstin),
      legalName,
      tradeName:               pick(gstn.trade_name,          gstn.tradeName,          meta.trade_name) || legalName,
      status:                  pick(gstn.status,              gstn.gst_status,         meta.status, 'Active'),
      registrationDate:        pick(gstn.registration_date,   gstn.registrationDate,   meta.registration_date),
      constitutionOfBusiness:  pick(gstn.constitution_of_business, gstn.constitution,  company.company_category, meta.constitution_of_business),
      principalAddress: {
        state:       pick(addr.state,        gstn.state,    company.registered_address?.state,   meta.state),
        district:    pick(addr.district,     addr.city,     gstn.city,   company.registered_address?.city,    meta.city),
        fullAddress: pick(addr.full_address, addr.address,  gstn.address, company.registered_address?.address, meta.address),
      },
      natureOfBusinessActivities: Array.isArray(gstn.nature_of_business_activities)
        ? gstn.nature_of_business_activities : [],
      udyamRegistrationNumber: pick(udyam.udyam_registration_number, udyam.registration_number),
      entityLockerVerified:    true,
      sessionId:               meta.session_id,
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
        if (req.url === '/api/phone-auth/complete-profile' && req.method === 'POST') {
          const session_id = String(req.body?.session_id || '').trim()
          if (!session_id) {
            res.statusCode = 400
            return res.end(JSON.stringify({ error: 'session_id is required.' }))
          }
          try {
            const { adminAuth, adminDb } = await getAdmin()
            const authHeader = req.headers?.authorization || ''
            if (!authHeader.startsWith('Bearer ')) { res.statusCode = 401; return res.end(JSON.stringify({ error: 'Unauthorized' })) }
            const decoded = await adminAuth.verifyIdToken(authHeader.slice(7))
            const uid = decoded.uid

            // Resolve verified business data (real EL or dev mock)
            let biz
            if (API_KEY && SECRET && !session_id.startsWith('dev-session-')) {
              const token = await authenticate()
              const headers = { 'Authorization': token, 'x-api-key': API_KEY, 'x-api-version': '1.0.0' }
              const sid = encodeURIComponent(session_id)
              const documents = {}
              await Promise.allSettled(['gstn_details', 'company_master_details', 'udhyam_certificate'].map(async (dt) => {
                const r = await fetch(`${BASE}/kyc/entitylocker/sessions/${sid}/documents/${dt}`, { headers })
                const b = await r.json().catch(() => ({}))
                if (r.ok || b.code === 200) documents[dt] = b.data ?? b
              }))
              biz = parseEntityLockerDev(documents, { session_id })
            }
            if (!biz || !biz.gstin) {
              biz = {
                gstin: '24CUUPP7030B1ZL', legalName: 'KILO BYTE INDUSTRIES', tradeName: 'KILO BYTE INDUSTRIES',
                status: 'Active', constitutionOfBusiness: 'Proprietorship', registrationDate: '01/07/2017',
                principalAddress: { state: 'Gujarat', district: 'Surat', fullAddress: '123, Industrial Area, Surat, Gujarat – 395001' },
                natureOfBusinessActivities: ['Retail Business'], udyamRegistrationNumber: '',
              }
            }
            const profileData = {
              businessName: biz.tradeName || biz.legalName || '', legalName: biz.legalName || '', tradeName: biz.tradeName || '',
              gst: biz.gstin || '', entityType: biz.constitutionOfBusiness || '', gstStatus: biz.status || '',
              registrationDate: biz.registrationDate || '', state: biz.principalAddress?.state || '',
              city: biz.principalAddress?.district || '', address: biz.principalAddress?.fullAddress || '',
              natureOfBusiness: biz.natureOfBusinessActivities || [], udyamRegistrationNumber: biz.udyamRegistrationNumber || '',
              entityLockerVerified: true, profileComplete: true, onboardingCompleted: true, updatedAt: new Date().toISOString(),
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

        // ---- /api/storage/upload ----
        if (req.url === '/api/storage/upload' && req.method === 'POST') {
          const body = req.body || {}
          const { contentType, userId, filename } = body
          if (!body.fileBase64 || !contentType || !userId || !filename) {
            res.statusCode = 400
            return res.end(JSON.stringify({ error: 'Missing required fields' }))
          }
          // In dev mode, return a placeholder URL (no real upload)
          const mockToken = `dev-${Date.now()}`
          const encodedPath = encodeURIComponent(`trade-documents/${userId}/${filename}`)
          const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/dotko-b2543.firebasestorage.app/o/${encodedPath}?alt=media&token=${mockToken}`
          console.log('[dev-api] Storage upload (mock):', filename)
          return res.end(JSON.stringify({ success: true, downloadUrl }))
        }

        // ---- /api/trade/submit ----
        if (req.url === '/api/trade/submit' && req.method === 'POST') {
          const body = req.body || {}
          const {
            counterpartyGSTIN, counterpartyName, tradeType, invoiceNumber,
            tradeValue, creditPeriod, invoiceDate, paymentDueDate, status,
            submitterGSTIN, submitterName,
          } = body

          // Basic validation
          const gstRe = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
          if (!counterpartyGSTIN || !gstRe.test((counterpartyGSTIN || '').trim().toUpperCase())) {
            res.statusCode = 400
            return res.end(JSON.stringify({ error: 'Valid GSTIN required' }))
          }
          if (!tradeValue || Number(tradeValue) <= 0) {
            res.statusCode = 400
            return res.end(JSON.stringify({ error: 'tradeValue must be > 0' }))
          }

          // Decode uid from JWT (no Admin SDK needed in dev)
          const authHeader = req.headers?.authorization || ''
          let uid = 'dev-user'
          try {
            const tokenStr = authHeader.replace('Bearer ', '')
            const payload = JSON.parse(Buffer.from(tokenStr.split('.')[1], 'base64').toString())
            if (payload.user_id) uid = payload.user_id
          } catch {}

          const tradeId = `dev-trade-${Date.now()}`
          const trade = {
            id: tradeId,
            counterpartyGSTIN: (counterpartyGSTIN || '').trim().toUpperCase(),
            counterpartyName:  (counterpartyName  || '').trim(),
            tradeType:         tradeType  || 'Sale',
            invoiceNumber:     invoiceNumber || '',
            tradeValue:        Number(tradeValue),
            creditPeriod:      Number(creditPeriod || 0),
            invoiceDate:       invoiceDate    || '',
            paymentDueDate:    paymentDueDate || '',
            status:            status || 'Still Pending',
            submittedBy:       uid,
            submitterGSTIN:    (submitterGSTIN || '').trim().toUpperCase(),
            submitterName:     (submitterName  || '').trim(),
            createdAt:         new Date().toISOString(),
            updatedAt:         new Date().toISOString(),
          }
          console.log('[dev-api] Trade submitted:', trade.counterpartyGSTIN, trade.status)
          return res.end(JSON.stringify({ success: true, tradeId, trade }))
        }

        // ---- /api/kyc/entitylocker/sdk/initiate ----
        // Uses the same Sandbox.co.in credentials as GST verification — no new keys needed
        if (req.url === '/api/kyc/entitylocker/sdk/initiate' && req.method === 'POST') {
          if (API_KEY && SECRET) {
            try {
              const token  = await authenticate()
              const upRes  = await fetch(`${BASE}/kyc/entitylocker/sessions/init`, {
                method: 'POST',
                headers: {
                  'Content-Type':  'application/json',
                  'Authorization': token,
                  'x-api-key':     API_KEY,
                  'x-api-version': '1.0.0',
                },
                body: JSON.stringify({
                  '@entity':      'in.co.sandbox.kyc.entitylocker.session.request',
                  'flow':         'signin',
                  'redirect_url': 'http://localhost:5173/dashboard',
                }),
              })
              const upData     = await upRes.json().catch(() => ({}))
              const session_id = upData.data?.id || upData.session_id || upData.data?.session_id || upData.data?.session?.id
              const authorization_url = upData.data?.authorization_url || upData.authorization_url || upData.data?.session?.authorization_url

              if ((upRes.ok || upData.code === 200) && session_id) {
                console.log('[dev-api] EntityLocker initiate OK, session_id:', session_id)
                return res.end(JSON.stringify({ session_id, authorization_url }))
              }
              console.warn('[dev-api] EntityLocker initiate failed:', upRes.status, upData)
            } catch (err) {
              console.warn('[dev-api] EntityLocker initiate error:', err.message, '— falling back to mock')
            }
          }

          // Dev fallback: mock session so the UI is fully testable without live credentials.
          // The completion gate will redirect here; we point back to /dashboard with the
          // mock session id so the flow can be exercised end-to-end.
          const mockSessionId = `dev-session-${Date.now()}`
          console.log('[dev-api] EntityLocker initiate — mock session:', mockSessionId)
          return res.end(JSON.stringify({
            session_id: mockSessionId,
            authorization_url: `http://localhost:5173/dashboard?session_id=${mockSessionId}`,
          }))
        }

        // ---- /api/kyc/entitylocker/sdk/results ----
        if (req.url === '/api/kyc/entitylocker/sdk/results' && req.method === 'POST') {
          const { session_id } = req.body || {}
          if (!session_id) {
            res.statusCode = 400
            return res.end(JSON.stringify({ error: 'session_id is required' }))
          }

          if (API_KEY && SECRET && !session_id.startsWith('dev-session-')) {
            try {
              const token   = await authenticate()
              const headers = { 'Authorization': token, 'x-api-key': API_KEY, 'x-api-version': '1.0.0' }
              const sid     = encodeURIComponent(session_id)

              // 1. Check session status
              const statusRes  = await fetch(`${BASE}/kyc/entitylocker/sessions/${sid}/status`, { method: 'GET', headers })
              const statusBody = await statusRes.json().catch(() => ({}))
              if (!statusRes.ok && statusBody.code !== 200) {
                console.warn('[dev-api] EntityLocker status failed:', statusRes.status, statusBody)
                throw new Error(statusBody.message || 'Status check failed')
              }

              // 2. Fetch documents in parallel
              const DOC_TYPES = ['gstn_details', 'company_master_details', 'udhyam_certificate']
              const documents = {}
              await Promise.allSettled(DOC_TYPES.map(async (docType) => {
                const r = await fetch(`${BASE}/kyc/entitylocker/sessions/${sid}/documents/${docType}`, { method: 'GET', headers })
                const b = await r.json().catch(() => ({}))
                if (r.ok || b.code === 200) {
                  documents[docType] = b.data ?? b
                } else {
                  console.warn(`[dev-api] Doc ${docType} not available (${r.status})`)
                }
              }))

              if (Object.keys(documents).length > 0) {
                const data = parseEntityLockerDev(documents, statusBody.data ?? statusBody)
                console.log('[dev-api] EntityLocker results OK, gstin:', data.gstin)
                return res.end(JSON.stringify({ success: true, data }))
              }
              console.warn('[dev-api] No documents returned — falling back to mock')
            } catch (err) {
              console.warn('[dev-api] EntityLocker results error:', err.message, '— falling back to mock')
            }
          }

          // Dev fallback: plausible mock business data
          const mockData = {
            gstin:                   '24CUUPP7030B1ZL',
            legalName:               'KILO BYTE INDUSTRIES',
            tradeName:               'KILO BYTE INDUSTRIES',
            status:                  'Active',
            constitutionOfBusiness:  'Proprietorship',
            registrationDate:        '01/07/2017',
            principalAddress: {
              state:       'Gujarat',
              district:    'Surat',
              fullAddress: '123, Industrial Area, Surat, Gujarat – 395001',
            },
            natureOfBusinessActivities: ['Retail Business'],
            panNumber:              'CUUPP7030B',
            entityLockerVerified:   true,
            sessionId:              session_id,
          }
          console.log('[dev-api] EntityLocker results — mock data for session:', session_id)
          return res.end(JSON.stringify({ success: true, data: mockData }))
        }

        // Unknown API route
        res.statusCode = 404
        return res.end(JSON.stringify({ error: 'API endpoint not found' }))
      })
    },
  }
}
