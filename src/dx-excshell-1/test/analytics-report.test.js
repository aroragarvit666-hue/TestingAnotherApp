/*
* <license header>
*/

jest.mock('@adobe/aio-sdk', () => ({
  Core: { Logger: jest.fn() }
}))
const { Core } = require('@adobe/aio-sdk')
const mockLoggerInstance = { info: jest.fn(), debug: jest.fn(), error: jest.fn() }
Core.Logger.mockReturnValue(mockLoggerInstance)

jest.mock('../actions/lib/analytics')
const { initAnalytics } = require('../actions/lib/analytics')

const action = require('../actions/analytics-report/index.js')

beforeEach(() => {
  jest.clearAllMocks()
  Core.Logger.mockReturnValue(mockLoggerInstance)
})

const fakeParams = {
  __ow_headers: { authorization: 'Bearer fake' },
  rsid: 'rs1',
  startDate: '2026-09-01',
  endDate: '2026-10-01'
}

describe('analytics-report', () => {
  test('main should be defined', () => {
    expect(action.main).toBeInstanceOf(Function)
  })

  test('missing required params returns 400', async () => {
    const response = await action.main({ __ow_headers: { authorization: 'Bearer fake' } })
    expect(response.error.statusCode).toBe(400)
    expect(response.error.body.error).toContain('rsid')
  })

  test('returns 200 with shaped rows, columns and totals', async () => {
    const getReport = jest.fn().mockResolvedValue({
      body: {
        rows: [
          { value: 'Sep 1, 2026', data: [100, 80, 70] },
          { value: 'Sep 2, 2026', data: [120, 90, 75] }
        ],
        summaryData: { totals: [220, 170, 145] }
      }
    })
    initAnalytics.mockResolvedValue({ client: { getReport } })

    const response = await action.main(fakeParams)
    expect(response.statusCode).toBe(200)
    expect(response.body.rsid).toBe('rs1')
    expect(response.body.columns).toEqual([
      { id: 'metrics/pageviews', label: 'Page Views' },
      { id: 'metrics/visits', label: 'Visits' },
      { id: 'metrics/visitors', label: 'Visitors' }
    ])
    expect(response.body.rows[0]).toEqual({
      day: 'Sep 1, 2026',
      'metrics/pageviews': 100,
      'metrics/visits': 80,
      'metrics/visitors': 70
    })
    expect(response.body.totals['metrics/pageviews']).toBe(220)

    // verify the report body sent to the SDK uses the end-exclusive ISO date range
    const sentBody = getReport.mock.calls[0][0]
    expect(sentBody.rsid).toBe('rs1')
    expect(sentBody.dimension).toBe('variables/daterangeday')
    expect(sentBody.globalFilters[0].dateRange).toBe('2026-09-01T00:00:00.000/2026-10-01T00:00:00.000')
  })

  test('returns 500 when the SDK throws', async () => {
    const fakeError = Object.assign(new Error('bad request'), { sdk: true, code: 'ERR_400' })
    initAnalytics.mockRejectedValue(fakeError)
    const response = await action.main(fakeParams)
    expect(response.error.statusCode).toBe(500)
    expect(response.error.body.error).toContain('ERR_400')
  })
})
