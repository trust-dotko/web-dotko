import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

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

        // ---- /api/auth/register ----
        if (req.url === '/api/auth/register' && req.method === 'POST') {
          const body = req.body || {}
          // In dev mode, store profile in memory (no Firebase Admin SDK needed)
          const profile = {
            email: body.email || '',
            gst: body.gst || '',
            businessName: body.businessName || '',
            legalName: body.legalName || '',
            tradeName: body.tradeName || '',
            entityType: body.entityType || '',
            gstStatus: body.gstStatus || '',
            registrationDate: body.registrationDate || '',
            address: body.address || '',
            state: body.state || '',
            city: body.city || '',
            natureOfBusiness: body.natureOfBusiness || [],
            mobileNumber: body.mobileNumber || '',
            gstOtpVerified: body.gstOtpVerified || false,
            profileComplete: false,
            onboardingComplete: false,
            emailVerified: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
          // Store in dev memory by auth header uid
          const authHeader = req.headers?.authorization || ''
          let uid = 'unknown-user'
          try {
            const tokenStr = authHeader.replace('Bearer ', '')
            const payload = JSON.parse(Buffer.from(tokenStr.split('.')[1], 'base64').toString())
            if (payload.user_id) uid = payload.user_id
          } catch (e) {}

          devProfiles.set(uid, profile)
          saveProfiles() // Persist
          console.log('[dev-api] Profile registered:', profile.businessName || profile.email)
          return res.end(JSON.stringify({ success: true, profile }))
        }

        // ---- /api/auth/profile ----
        if (req.url === '/api/auth/profile') {
          const authHeader = req.headers?.authorization || ''
          let uid = 'unknown-user'
          try {
            const tokenStr = authHeader.replace('Bearer ', '')
            const payload = JSON.parse(Buffer.from(tokenStr.split('.')[1], 'base64').toString())
            if (payload.user_id) uid = payload.user_id
          } catch (e) {}
          
          if (req.method === 'GET') {
            const profile = devProfiles.get(uid) || null
            return res.end(JSON.stringify({ success: true, profile }))
          }
          if (req.method === 'POST') {
            const existing = devProfiles.get(uid) || {}
            const body = req.body || {}
            const allowed = ['businessName', 'gst', 'entityType', 'pan', 'city', 'state', 'establishmentYear', 'profileComplete']
            for (const key of allowed) {
              if (body[key] !== undefined) existing[key] = body[key]
            }
            existing.updatedAt = new Date().toISOString()
            devProfiles.set(uid, existing)
            saveProfiles() // Persist
            return res.end(JSON.stringify({ success: true, profile: existing }))
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

        // ---- /api/gst-otp ----
        if (req.url === '/api/gst-otp') {
          const { gstin, username } = req.body || {}
          const clean = (gstin || '').trim().toUpperCase()
          if (!clean || !username) {
            res.statusCode = 400
            return res.end(JSON.stringify({ success: false, error: 'GSTIN and GST portal username required' }))
          }
          try {
            const token = await authenticate()
            const apiRes = await fetch(`${BASE}/gst/compliance/tax-payer/otp`, {
              method: 'POST',
              headers: {
                'Authorization': token,
                'x-api-key': API_KEY,
                'x-api-version': '1.0.0',
                'x-source': 'primary',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ gstin: clean, username: username.trim() }),
            })
            const data = await apiRes.json()
            console.log('[dev-api] OTP generate response:', data.code, data.message)
            if (data.code === 200) return res.end(JSON.stringify({ success: true, refId: data.data?.ref_id || 'dev-ref' }))
            return res.end(JSON.stringify({ success: false, error: data.message || 'OTP generation failed' }))
          } catch (err) {
            console.warn('[dev-api] OTP generate error:', err.message, '— returning mock success')
            return res.end(JSON.stringify({ success: true, refId: 'dev-mock-ref' }))
          }
        }

        // ---- /api/gst-otp-verify ----
        if (req.url === '/api/gst-otp-verify') {
          const { gstin, username, otp } = req.body || {}
          if (!otp || String(otp).length !== 6) {
            res.statusCode = 400
            return res.end(JSON.stringify({ success: false, error: 'Enter 6-digit OTP' }))
          }
          try {
            const token = await authenticate()
            const apiRes = await fetch(`${BASE}/gst/compliance/tax-payer/otp/verify?otp=${encodeURIComponent(String(otp))}`, {
              method: 'POST',
              headers: {
                'Authorization': token,
                'x-api-key': API_KEY,
                'x-api-version': '1.0.0',
                'x-source': 'primary',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ gstin: (gstin || '').trim().toUpperCase(), username: (username || '').trim() }),
            })
            const data = await apiRes.json()
            console.log('[dev-api] OTP verify response:', data.code, data.message)
            if (data.code === 200) return res.end(JSON.stringify({ success: true }))
            return res.end(JSON.stringify({ success: false, error: data.message || 'Invalid OTP' }))
          } catch (err) {
            console.warn('[dev-api] OTP verify error:', err.message, '— returning mock success')
            return res.end(JSON.stringify({ success: true }))
          }
        }

        // Unknown API route
        res.statusCode = 404
        return res.end(JSON.stringify({ error: 'API endpoint not found' }))
      })
    },
  }
}
