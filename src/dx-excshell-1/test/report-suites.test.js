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

const action = require('../actions/report-suites/index.js')

beforeEach(() => {
  jest.clearAllMocks()
  Core.Logger.mockReturnValue(mockLoggerInstance)
})

const fakeParams = { __ow_headers: { authorization: 'Bearer fake' } }

describe('report-suites', () => {
  test('main should be defined', () => {
    expect(action.main).toBeInstanceOf(Function)
  })

  test('missing Authorization header returns 400', async () => {
    const response = await action.main({})
    expect(response).toEqual({
      error: { statusCode: 400, body: { error: "missing header(s) 'authorization'" } }
    })
  })

  test('returns 200 with the list of report suites', async () => {
    initAnalytics.mockResolvedValue({
      client: {
        getCollections: jest.fn().mockResolvedValue({
          body: { content: [{ rsid: 'rs1', name: 'Suite One' }, { rsid: 'rs2', name: 'Suite Two' }] }
        })
      }
    })
    const response = await action.main(fakeParams)
    expect(response.statusCode).toBe(200)
    expect(response.body.suites).toEqual([
      { rsid: 'rs1', name: 'Suite One' },
      { rsid: 'rs2', name: 'Suite Two' }
    ])
  })

  test('returns 500 when the SDK throws', async () => {
    const fakeError = Object.assign(new Error('no access'), { sdk: true, code: 'ERR_403' })
    initAnalytics.mockRejectedValue(fakeError)
    const response = await action.main(fakeParams)
    expect(response.error.statusCode).toBe(500)
    expect(response.error.body.error).toContain('ERR_403')
    expect(mockLoggerInstance.error).toHaveBeenCalledWith(fakeError)
  })
})
