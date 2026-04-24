import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

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
  const devProfiles = new Map() // In-memory profile store for dev mode

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
            profileComplete: false,
            onboardingComplete: false,
            emailVerified: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
          // Store in dev memory by auth header token hash (simple approach)
          const authHeader = req.headers?.authorization || ''
          devProfiles.set(authHeader, profile)
          console.log('[dev-api] Profile registered:', profile.businessName || profile.email)
          return res.end(JSON.stringify({ success: true, profile }))
        }

        // ---- /api/auth/profile ----
        if (req.url === '/api/auth/profile') {
          const authHeader = req.headers?.authorization || ''
          if (req.method === 'GET') {
            const profile = devProfiles.get(authHeader) || null
            return res.end(JSON.stringify({ success: true, profile }))
          }
          if (req.method === 'POST') {
            const existing = devProfiles.get(authHeader) || {}
            const body = req.body || {}
            const allowed = ['businessName', 'gst', 'entityType', 'pan', 'city', 'state', 'establishmentYear', 'profileComplete']
            for (const key of allowed) {
              if (body[key] !== undefined) existing[key] = body[key]
            }
            existing.updatedAt = new Date().toISOString()
            devProfiles.set(authHeader, existing)
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

        // Unknown API route
        res.statusCode = 404
        return res.end(JSON.stringify({ error: 'API endpoint not found' }))
      })
    },
  }
}
