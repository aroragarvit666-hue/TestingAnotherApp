/*
* <license header>
*/

import React, { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import {
  View,
  Flex,
  Heading,
  Picker,
  Item,
  Button,
  ProgressCircle,
  InlineAlert,
  Content,
  Text,
  TableView,
  TableHeader,
  TableBody,
  Column,
  Row,
  Cell,
  IllustratedMessage
} from '@adobe/react-spectrum'
import Graph from '@spectrum-icons/workflow/GraphBarVertical'

import allActions from '../config.json'
import actionWebInvoke from '../utils'

// date-range presets offered to the user
const RANGES = [
  { id: '7', name: 'Last 7 days' },
  { id: '30', name: 'Last 30 days' },
  { id: '90', name: 'Last 90 days' }
]

// returns { startDate, endDate } as YYYY-MM-DD strings for the last N days
function rangeToDates (days) {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - Number(days))
  const fmt = (d) => d.toISOString().slice(0, 10)
  return { startDate: fmt(start), endDate: fmt(end) }
}

function AnalyticsDashboard (props) {
  const suitesUrl = allActions['report-suites']
  const reportUrl = allActions['analytics-report']

  const [suites, setSuites] = useState([])
  const [suitesLoading, setSuitesLoading] = useState(false)
  const [suitesError, setSuitesError] = useState(null)

  const [selectedSuite, setSelectedSuite] = useState(null)
  const [selectedRange, setSelectedRange] = useState('30')

  const [report, setReport] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState(null)

  // build the headers used for every backend call (IMS token + org)
  function authHeaders () {
    const headers = {}
    if (props.ims.token) headers.authorization = `Bearer ${props.ims.token}`
    if (props.ims.org) headers['x-gw-ims-org-id'] = props.ims.org
    return headers
  }

  // 1. On load, fetch all available report suites to populate the Picker
  useEffect(() => {
    async function loadSuites () {
      if (!suitesUrl) {
        setSuitesError('Backend not deployed yet — deploy or run the app to load report suites.')
        return
      }
      setSuitesLoading(true)
      setSuitesError(null)
      try {
        const res = await actionWebInvoke(suitesUrl, authHeaders(), {})
        setSuites(res.suites || [])
        if (!res.suites || res.suites.length === 0) {
          setSuitesError('No report suites available for this account.')
        }
      } catch (e) {
        console.error(e)
        setSuitesError(e.message)
      } finally {
        setSuitesLoading(false)
      }
    }
    loadSuites()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 2 + 3. Run the report for the selected suite + date range, then display it
  async function loadReport () {
    if (!reportUrl || !selectedSuite) return
    setReportLoading(true)
    setReportError(null)
    setReport(null)
    try {
      const { startDate, endDate } = rangeToDates(selectedRange)
      const res = await actionWebInvoke(reportUrl, authHeaders(), {
        rsid: selectedSuite,
        startDate,
        endDate
      })
      setReport(res)
    } catch (e) {
      console.error(e)
      setReportError(e.message)
    } finally {
      setReportLoading(false)
    }
  }

  const rangeLabel = RANGES.find((r) => r.id === selectedRange)?.name

  return (
    <View width="100%" maxWidth="size-9000">
      <Flex alignItems="center" gap="size-150" marginBottom="size-200">
        <Graph size="L" aria-hidden="true" />
        <Heading level={1} margin="0">Adobe Analytics Dashboard</Heading>
      </Flex>

      {/* Report-suite picker (populated on load) */}
      <Flex direction="column" gap="size-200" marginBottom="size-300">
        <Flex alignItems="end" gap="size-200" wrap>
          <Picker
            label="Report suite"
            placeholder="Select a report suite"
            isRequired
            width="size-3600"
            isLoading={suitesLoading}
            items={suites}
            selectedKey={selectedSuite}
            onSelectionChange={(key) => { setSelectedSuite(key); setReport(null); setReportError(null) }}
          >
            {(item) => <Item key={item.rsid}>{item.name || item.rsid}</Item>}
          </Picker>

          <Picker
            label="Date range"
            width="size-2400"
            items={RANGES}
            selectedKey={selectedRange}
            onSelectionChange={(key) => setSelectedRange(key)}
          >
            {(item) => <Item key={item.id}>{item.name}</Item>}
          </Picker>

          <Button
            variant="accent"
            onPress={loadReport}
            isPending={reportLoading}
            isDisabled={!selectedSuite || !reportUrl}
          >
            Load Report
          </Button>
        </Flex>

        {suitesError && (
          <InlineAlert variant="notice">
            <Heading>Report suites</Heading>
            <Content>{suitesError}</Content>
          </InlineAlert>
        )}
      </Flex>

      {/* Report display */}
      {reportError && (
        <InlineAlert variant="negative">
          <Heading>Failed to load report</Heading>
          <Content>{reportError}</Content>
        </InlineAlert>
      )}

      {reportLoading && (
        <Flex alignItems="center" justifyContent="center" height="size-3000">
          <ProgressCircle aria-label="Loading report" isIndeterminate size="L" />
        </Flex>
      )}

      {!reportLoading && report && (
        <View>
          {/* summary tiles */}
          <Flex gap="size-200" wrap marginBottom="size-300">
            {report.columns.map((col) => (
              <View
                key={col.id}
                backgroundColor="gray-100"
                borderWidth="thin"
                borderColor="gray-300"
                borderRadius="medium"
                padding="size-200"
                minWidth="size-2000"
              >
                <Text UNSAFE_style={{ fontSize: '0.85rem', color: 'var(--spectrum-global-color-gray-700)' }}>
                  {col.label}
                </Text>
                <Heading level={2} margin="size-50">
                  {formatNumber(report.totals?.[col.id])}
                </Heading>
                <Text UNSAFE_style={{ fontSize: '0.75rem', color: 'var(--spectrum-global-color-gray-600)' }}>
                  {rangeLabel}
                </Text>
              </View>
            ))}
          </Flex>

          {/* daily breakdown table */}
          <TableView
            aria-label="Daily analytics report"
            height="size-4600"
            renderEmptyState={() => (
              <IllustratedMessage>
                <Heading>No data</Heading>
                <Content>No rows were returned for this range.</Content>
              </IllustratedMessage>
            )}
          >
            <TableHeader>
              <Column key="day" allowsResizing>Day</Column>
              {report.columns.map((col) => (
                <Column key={col.id} align="end">{col.label}</Column>
              ))}
            </TableHeader>
            <TableBody items={report.rows.map((r, i) => ({ ...r, _key: i }))}>
              {(row) => (
                <Row key={row._key}>
                  <Cell>{row.day}</Cell>
                  {report.columns.map((col) => (
                    <Cell key={col.id}>{formatNumber(row[col.id])}</Cell>
                  ))}
                </Row>
              )}
            </TableBody>
          </TableView>
        </View>
      )}

      {!reportLoading && !report && !reportError && (
        <IllustratedMessage>
          <Heading>No report loaded</Heading>
          <Content>Select a report suite and date range, then choose Load Report.</Content>
        </IllustratedMessage>
      )}
    </View>
  )

  // formats a metric value with thousands separators
  function formatNumber (value) {
    if (value === null || value === undefined) return '—'
    const n = Number(value)
    if (Number.isNaN(n)) return String(value)
    return n.toLocaleString()
  }
}

AnalyticsDashboard.propTypes = {
  runtime: PropTypes.any,
  ims: PropTypes.any
}

export default AnalyticsDashboard
