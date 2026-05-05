export default async function handler(req, res) {
  const API_KEY = process.env.GST_API_KEY;
  const SECRET = process.env.GST_API_SECRET;
  const BASE_URL = "https://api.sandbox.co.in";

  const authRes = await fetch(`${BASE_URL}/authenticate`, {
    method: 'POST',
    headers: { 'x-api-key': API_KEY, 'x-api-secret': SECRET, 'x-api-version': '1.0' }
  });
  const auth = await authRes.json();
  const token = auth.data.access_token;

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': token,
    'x-api-key': API_KEY,
    'x-api-version': '1.0.0',
  };

  const results = {};

  // Test 1: Standard API
  const res1 = await fetch(`${BASE_URL}/kyc/entitylocker/sessions/init`, {
    method: 'POST', headers,
    body: JSON.stringify({
      "@entity": "in.co.sandbox.kyc.entitylocker.session.request",
      "flow": "signin",
      "redirect_url": "https://dotko.in"
    })
  });
  results.test1_standard = await res1.json().catch(e => e.message);

  // Test 2: SDK API with original fields but corrected entity
  const res2 = await fetch(`${BASE_URL}/kyc/entitylocker-sdk/sessions/create`, {
    method: 'POST', headers,
    body: JSON.stringify({
      "@entity": "in.co.sandbox.kyc.entitylocker.session.request",
      "redirect_url": "https://dotko.in",
      "brand": { "name": "Dotko", "logo_url": "https://dotko.in/icon.png" }
    })
  });
  results.test2_sdk_correct_entity = await res2.json().catch(e => e.message);

  // Test 3: SDK API with 'in.co.sandbox.kyc.entitylocker_sdk.session.request'
  const res3 = await fetch(`${BASE_URL}/kyc/entitylocker-sdk/sessions/create`, {
    method: 'POST', headers,
    body: JSON.stringify({
      "@entity": "in.co.sandbox.kyc.entitylocker_sdk.session.request",
      "redirect_url": "https://dotko.in",
      "brand": { "name": "Dotko", "logo_url": "https://dotko.in/icon.png" }
    })
  });
  results.test3_sdk_underscore = await res3.json().catch(e => e.message);

  res.status(200).json(results);
}
