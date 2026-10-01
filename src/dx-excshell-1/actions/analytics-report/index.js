/*
* <license header>
*/

/**
 * Runs an Adobe Analytics report for a given report suite and date range.
 * Returns a daily breakdown of core traffic metrics (page views, visits, visitors).
 */

const { Core } = require('@adobe/aio-sdk')
const { errorResponse, stringParameters, checkMissingRequestInputs } = require('../utils')
const { initAnalytics } = require('../lib/analytics')

// metrics shown in the dashboard table (order matters — matches columnId)
const METRICS = [
  { columnId: '0', id: 'metrics/pageviews', label: 'Page Views' },
  { columnId: '1', id: 'metrics/visits', label: 'Visits' },
  { columnId: '2', id: 'metrics/visitors', label: 'Visitors' }
]

async function main (params) {
  const logger = Core.Logger('analytics-report', { level: params.LOG_LEVEL || 'info' })

  try {
    logger.info('Calling the analytics-report action')
    logger.debug(stringParameters(params))

    const requiredParams = ['rsid', 'startDate', 'endDate']
    const requiredHeaders = ['Authorization']
    const errorMessage = checkMissingRequestInputs(params, requiredParams, requiredHeaders)
    if (errorMessage) {
      return errorResponse(400, errorMessage, logger)
    }

    const { client } = await initAnalytics(params)

    // Analytics 2.0 dateRange format: start/end as ISO, end-exclusive
    const dateRange = `${params.startDate}T00:00:00.000/${params.endDate}T00:00:00.000`

    const reportBody = {
      rsid: params.rsid,
      globalFilters: [
        { type: 'dateRange', dateRange }
      ],
      metricContainer: {
        metrics: METRICS.map(({ columnId, id }) => ({ columnId, id }))
      },
      dimension: 'variables/daterangeday',
      settings: { limit: 400, page: 0, nonesBehavior: 'return-nones' }
    }

    const res = await client.getReport(reportBody)
    const report = res.body

    // shape rows for the UI table: one row per day, keyed metric values
    const rows = (report.rows || []).map((row) => {
      const entry = { day: row.value }
      METRICS.forEach((m, i) => { entry[m.id] = row.data[i] })
      return entry
    })

    // totals across the range for summary tiles
    const totals = {}
    const summaryTotals = report.summaryData?.totals || []
    METRICS.forEach((m, i) => { totals[m.id] = summaryTotals[i] ?? null })

    logger.info(`200: report returned ${rows.length} rows`)
    return {
      statusCode: 200,
      body: {
        rsid: params.rsid,
        columns: METRICS.map(({ id, label }) => ({ id, label })),
        rows,
        totals
      }
    }
  } catch (error) {
    logger.error(error)
    const message = error.sdk ? `${error.code}: ${error.message}` : (error.message || 'server error')
    return errorResponse(500, message, logger)
  }
}

exports.main = main
