/*
* <license header>
*/

/**
 * Adobe Analytics dashboard action.
 *
 * - No `rsid` param: returns the report suites available to the organization.
 * - With `rsid` + `range` (7d | 30d | 90d): returns totals, a daily trend and top pages.
 */

const { Core } = require('@adobe/aio-sdk')
const { initAnalytics } = require('../lib/analytics')
const { stringParameters } = require('../utils')

const RANGES = { '7d': 7, '30d': 30, '90d': 90 }

const METRICS = [
  { columnId: '0', id: 'metrics/pageviews' },
  { columnId: '1', id: 'metrics/visits' },
  { columnId: '2', id: 'metrics/visitors' },
  { columnId: '3', id: 'metrics/bouncerate' }
]

// Last N full days, ending at the start of today (UTC). The end bound is exclusive.
function buildDateRange (days, now = new Date()) {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000)
  const fmt = d => d.toISOString().slice(0, 10)
  return {
    startDate: fmt(start),
    endDate: fmt(new Date(end.getTime() - 24 * 60 * 60 * 1000)),
    dateRange: `${fmt(start)}T00:00:00.000/${fmt(end)}T00:00:00.000`
  }
}

function buildReportBody (rsid, dateRange, dimension, settings) {
  return {
    rsid,
    globalFilters: [{ type: 'dateRange', dateRange }],
    metricContainer: { metrics: METRICS },
    dimension,
    settings
  }
}

function toRows (report) {
  return (report?.rows || []).map(row => ({
    id: row.itemId,
    label: row.value,
    pageviews: row.data?.[0] ?? 0,
    visits: row.data?.[1] ?? 0,
    visitors: row.data?.[2] ?? 0,
    bouncerate: row.data?.[3] ?? 0
  }))
}

// aio-lib errors carry the HTTP status in the message, e.g. "(403 Forbidden)"
function statusFromError (error) {
  const match = /\b(400|401|403|404|429)\b/.exec(error?.message || '')
  return match ? Number(match[1]) : 500
}

async function main (params) {
  const logger = Core.Logger('analytics', { level: params.LOG_LEVEL || 'info' })
  try {
    logger.info('Calling the analytics action')
    logger.debug(stringParameters(params))

    if (!params.apiKey) {
      return { statusCode: 400, body: { error: 'Missing required params: apiKey (set SERVICE_API_KEY in .env)' } }
    }

    if (params.rsid && !RANGES[params.range]) {
      return { statusCode: 400, body: { error: `Invalid range '${params.range}'. Use one of: ${Object.keys(RANGES).join(', ')}` } }
    }

    const { client } = await initAnalytics(params)

    if (!params.rsid) {
      const res = await client.getCollections({ limit: 100 })
      const reportSuites = (res.body?.content || []).map(s => ({ rsid: s.rsid, name: s.name || s.rsid }))
      logger.info(`Found ${reportSuites.length} report suites`)
      return { statusCode: 200, body: { reportSuites } }
    }

    const { startDate, endDate, dateRange } = buildDateRange(RANGES[params.range])
    const [dailyRes, pagesRes] = await Promise.all([
      client.getReport(buildReportBody(params.rsid, dateRange, 'variables/daterangeday', { limit: 100, page: 0, dimensionSort: 'asc' })),
      client.getReport(buildReportBody(params.rsid, dateRange, 'variables/page', { limit: 10, page: 0 }))
    ])

    const totals = dailyRes.body?.summaryData?.totals || []
    const body = {
      rsid: params.rsid,
      range: params.range,
      startDate,
      endDate,
      totals: {
        pageviews: totals[0] ?? 0,
        visits: totals[1] ?? 0,
        visitors: totals[2] ?? 0,
        bouncerate: totals[3] ?? 0
      },
      daily: toRows(dailyRes.body),
      topPages: toRows(pagesRes.body)
    }

    logger.info('Analytics report loaded')
    return { statusCode: 200, body }
  } catch (error) {
    logger.error('Analytics action failed:', error.message)
    return { statusCode: statusFromError(error), body: { error: error.message } }
  }
}

exports.main = main
exports.buildDateRange = buildDateRange
