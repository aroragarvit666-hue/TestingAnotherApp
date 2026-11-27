/*
* <license header>
*/

const { generateAccessToken } = require('@adobe/aio-lib-core-auth')
const sdk = require('@adobe/aio-lib-analytics')

// Token (from injected __ims_oauth_s2s) -> discover globalCompanyId -> init the SDK client.
async function initAnalytics (params) {
  const tokenResponse = await generateAccessToken(params) // include-ims-credentials injects creds
  const accessToken = typeof tokenResponse === 'string' ? tokenResponse : tokenResponse.access_token
  const apiKey = params.apiKey // bound to $SERVICE_API_KEY
  const res = await fetch('https://analytics.adobe.io/discovery/me', {
    headers: { Authorization: `Bearer ${accessToken}`, 'x-api-key': apiKey }
  })
  if (!res.ok) {
    throw new Error(`Analytics discovery failed with status ${res.status}`)
  }
  const { imsOrgs } = await res.json()
  const company = imsOrgs?.[0]?.companies?.[0]
  if (!company) {
    throw new Error('No Adobe Analytics company found for this organization')
  }
  const globalCompanyId = company.globalCompanyId
  const client = await sdk.init(globalCompanyId, apiKey, accessToken)
  return { client, accessToken, apiKey, globalCompanyId }
}

module.exports = { initAnalytics }
