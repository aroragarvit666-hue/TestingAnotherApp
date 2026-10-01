/*
* <license header>
*/

/**
 * Lists all available Adobe Analytics report suites so the UI can populate a Picker.
 */

const { Core } = require('@adobe/aio-sdk')
const { errorResponse, stringParameters, checkMissingRequestInputs } = require('../utils')
const { initAnalytics } = require('../lib/analytics')

async function main (params) {
  const logger = Core.Logger('report-suites', { level: params.LOG_LEVEL || 'info' })

  try {
    logger.info('Calling the report-suites action')
    logger.debug(stringParameters(params))

    // only the IMS user token is required from the client
    const requiredParams = []
    const requiredHeaders = ['Authorization']
    const errorMessage = checkMissingRequestInputs(params, requiredParams, requiredHeaders)
    if (errorMessage) {
      return errorResponse(400, errorMessage, logger)
    }

    const { client } = await initAnalytics(params)

    // list report suites for the UI dropdown
    const res = await client.getCollections({ limit: 100 })
    const suites = (res.body.content || []).map((s) => ({ rsid: s.rsid, name: s.name }))

    logger.info(`200: returning ${suites.length} report suites`)
    return {
      statusCode: 200,
      body: { suites }
    }
  } catch (error) {
    // aio-lib throws error objects (not HTTP responses) — surface code/message
    logger.error(error)
    const message = error.sdk ? `${error.code}: ${error.message}` : (error.message || 'server error')
    return errorResponse(500, message, logger)
  }
}

exports.main = main
