/*
* <license header>
*/

import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import {
  Button,
  Cell,
  Column,
  Content,
  Flex,
  Heading,
  IllustratedMessage,
  InlineAlert,
  Item,
  Picker,
  ProgressCircle,
  Row,
  TableBody,
  TableHeader,
  TableView,
  TabList,
  TabPanels,
  Tabs,
  Text,
  View
} from '@adobe/react-spectrum'
import NotFound from '@spectrum-icons/illustrations/NotFound'

import actions from '../config.json'
import actionWebInvoke from '../utils'

// The CLI writes keys as "<package>/<action>"; accept the bare name too.
const analyticsUrl = actions['dx-excshell-1/analytics'] || actions.analytics

const DATE_RANGES = [
  { id: '7d', name: 'Last 7 days' },
  { id: '30d', name: 'Last 30 days' },
  { id: '90d', name: 'Last 90 days' }
]

const SERIES_COLOR = '#2a78d6'
const numberFormat = new Intl.NumberFormat()
const percentFormat = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 })
const formatNumber = v => numberFormat.format(Math.round(v || 0))
// Analytics returns bounce rate as a 0-1 ratio
const formatPercent = v => percentFormat.format(v || 0)

function AnalyticsDashboard ({ ims }) {
  const [suites, setSuites] = useState([])
  const [suitesLoading, setSuitesLoading] = useState(Boolean(analyticsUrl))
  const [suitesError, setSuitesError] = useState(null)
  const [rsid, setRsid] = useState(null)
  const [range, setRange] = useState('30d')
  const [report, setReport] = useState(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState(null)

  useEffect(() => {
    if (!analyticsUrl) return
    let cancelled = false
    async function loadSuites () {
      setSuitesLoading(true)
      setSuitesError(null)
      try {
        const res = await actionWebInvoke(analyticsUrl, authHeaders(ims), {})
        if (!cancelled) setSuites(res.reportSuites || [])
      } catch (e) {
        if (!cancelled) setSuitesError(e.message)
      } finally {
        if (!cancelled) setSuitesLoading(false)
      }
    }
    loadSuites()
    return () => { cancelled = true }
  }, [ims.token, ims.org])

  async function loadReport () {
    setReportLoading(true)
    setReportError(null)
    try {
      const res = await actionWebInvoke(analyticsUrl, authHeaders(ims), { rsid, range })
      setReport(res)
    } catch (e) {
      setReport(null)
      setReportError(e.message)
    } finally {
      setReportLoading(false)
    }
  }

  const suiteName = report && (suites.find(s => s.rsid === report.rsid)?.name || report.rsid)

  return (
    <View width="100%" UNSAFE_style={{ maxWidth: 1100 }}>
      <Heading level={1}>Analytics Dashboard</Heading>
      <Text>Traffic overview for your Adobe Analytics report suites.</Text>

      {!analyticsUrl && (
        <InlineAlert variant="info" marginTop="size-200">
          <Heading>Backend actions are not live yet</Heading>
          <Content>To use backend actions in the live preview, select a workspace using 'Set deploy target' below, then click 'Test App'. If a workspace is already selected, click 'Test App' to start the backend.</Content>
        </InlineAlert>
      )}

      {suitesError && (
        <InlineAlert variant="negative" marginTop="size-200">
          <Heading>Could not load report suites</Heading>
          <Content>{suitesError}</Content>
        </InlineAlert>
      )}

      <Flex gap="size-200" alignItems="end" wrap marginTop="size-300">
        <Picker
          label="Report suite"
          placeholder={suitesLoading ? 'Loading report suites…' : 'Select a report suite'}
          items={suites}
          selectedKey={rsid}
          onSelectionChange={key => { setRsid(key); setReport(null); setReportError(null) }}
          isDisabled={!analyticsUrl || suitesLoading || suites.length === 0}
          isLoading={suitesLoading}
          width="size-4600"
        >
          {item => <Item key={item.rsid} textValue={item.name}>{item.name}</Item>}
        </Picker>
        <Picker
          label="Date range"
          items={DATE_RANGES}
          selectedKey={range}
          onSelectionChange={setRange}
          isDisabled={!rsid}
          width="size-2400"
        >
          {item => <Item key={item.id}>{item.name}</Item>}
        </Picker>
        <Button variant="accent" onPress={loadReport} isDisabled={!rsid || !range} isPending={reportLoading}>
          Load Report
        </Button>
      </Flex>

      {analyticsUrl && !suitesLoading && !suitesError && suites.length === 0 && (
        <InlineAlert variant="notice" marginTop="size-200">
          <Heading>No report suites found</Heading>
          <Content>The Analytics credential has no access to any report suites in this organization.</Content>
        </InlineAlert>
      )}

      {reportError && (
        <InlineAlert variant="negative" marginTop="size-300">
          <Heading>Could not load report</Heading>
          <Content>{reportError}</Content>
        </InlineAlert>
      )}

      {reportLoading && !report && (
        <Flex alignItems="center" justifyContent="center" height="size-3000">
          <ProgressCircle aria-label="Loading report" isIndeterminate size="L" />
        </Flex>
      )}

      {!report && !reportLoading && !reportError && analyticsUrl && suites.length > 0 && (
        <IllustratedMessage marginTop="size-400">
          <NotFound />
          <Heading>No report loaded</Heading>
          <Content>Select a report suite and date range, then click Load Report.</Content>
        </IllustratedMessage>
      )}

      {report && (
        <View marginTop="size-400">
          <Heading level={2} marginBottom="size-50">{suiteName}</Heading>
          <Text UNSAFE_style={{ color: 'var(--spectrum-global-color-gray-700)' }}>
            {report.startDate} to {report.endDate}
          </Text>

          <Flex gap="size-200" wrap marginTop="size-200">
            <StatTile label="Page views" value={formatNumber(report.totals.pageviews)} />
            <StatTile label="Visits" value={formatNumber(report.totals.visits)} />
            <StatTile label="Unique visitors" value={formatNumber(report.totals.visitors)} />
            <StatTile label="Bounce rate" value={formatPercent(report.totals.bouncerate)} />
          </Flex>

          <Tabs aria-label="Report views" marginTop="size-300">
            <TabList>
              <Item key="trend">Daily trend</Item>
              <Item key="daily">Daily table</Item>
              <Item key="pages">Top pages</Item>
            </TabList>
            <TabPanels>
              <Item key="trend">
                <View paddingTop="size-200">
                  <Heading level={3} marginTop={0}>Page views per day</Heading>
                  {report.daily.length > 0
                    ? <DailyBarChart rows={report.daily} />
                    : <EmptyReport />}
                </View>
              </Item>
              <Item key="daily">
                <View paddingTop="size-200">
                  <MetricsTable ariaLabel="Daily metrics" firstColumn="Day" rows={report.daily} />
                </View>
              </Item>
              <Item key="pages">
                <View paddingTop="size-200">
                  <MetricsTable ariaLabel="Top pages" firstColumn="Page" rows={report.topPages} />
                </View>
              </Item>
            </TabPanels>
          </Tabs>
        </View>
      )}
    </View>
  )
}

function authHeaders (ims) {
  const headers = {}
  if (ims.token) headers.authorization = `Bearer ${ims.token}`
  if (ims.org) headers['x-gw-ims-org-id'] = ims.org
  return headers
}

function StatTile ({ label, value }) {
  return (
    <View
      borderWidth="thin"
      borderColor="gray-300"
      borderRadius="medium"
      padding="size-200"
      minWidth="size-2400"
      flexGrow={1}
      backgroundColor="gray-50"
    >
      <Text UNSAFE_style={{ color: 'var(--spectrum-global-color-gray-700)', fontSize: 13 }}>{label}</Text>
      <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </View>
  )
}

function EmptyReport () {
  return (
    <IllustratedMessage>
      <NotFound />
      <Heading>No data for this period</Heading>
      <Content>Try a longer date range or a different report suite.</Content>
    </IllustratedMessage>
  )
}

function MetricsTable ({ ariaLabel, firstColumn, rows }) {
  return (
    <TableView aria-label={ariaLabel} density="compact" maxHeight="size-6000" renderEmptyState={() => <EmptyReport />}>
      <TableHeader>
        <Column key="label" isRowHeader width="40%">{firstColumn}</Column>
        <Column key="pageviews" align="end">Page views</Column>
        <Column key="visits" align="end">Visits</Column>
        <Column key="visitors" align="end">Visitors</Column>
        <Column key="bouncerate" align="end">Bounce rate</Column>
      </TableHeader>
      <TableBody items={rows.map((r, i) => ({ ...r, key: `${r.id}-${i}` }))}>
        {row => (
          <Row key={row.key}>
            <Cell>{row.label}</Cell>
            <Cell>{formatNumber(row.pageviews)}</Cell>
            <Cell>{formatNumber(row.visits)}</Cell>
            <Cell>{formatNumber(row.visitors)}</Cell>
            <Cell>{formatPercent(row.bouncerate)}</Cell>
          </Row>
        )}
      </TableBody>
    </TableView>
  )
}

// Single-series bar chart: one hue, recessive grid, hover tooltip per day.
function DailyBarChart ({ rows }) {
  const [hover, setHover] = useState(null)
  const width = 900
  const height = 260
  const pad = { top: 12, right: 8, bottom: 28, left: 56 }
  const plotW = width - pad.left - pad.right
  const plotH = height - pad.top - pad.bottom
  const max = niceMax(Math.max(...rows.map(r => r.pageviews), 1))
  const slot = plotW / rows.length
  const gap = Math.min(2, slot * 0.2)
  const barW = Math.max(slot - gap, 1)
  const radius = Math.min(4, barW / 2)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => t * max)
  const labelIdx = new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1])
  const y = v => pad.top + plotH - (v / max) * plotH

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        role="img"
        aria-label={`Page views per day, ${rows.length} days`}
        onMouseLeave={() => setHover(null)}
        style={{ display: 'block', fontFamily: 'inherit' }}
      >
        {ticks.map(t => (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke="#e6e6e3" strokeWidth={1} />
            <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="#52514e">
              {compact(t)}
            </text>
          </g>
        ))}
        {rows.map((r, i) => {
          const x = pad.left + i * slot + gap / 2
          const top = y(r.pageviews)
          const h = pad.top + plotH - top
          return (
            <g key={`${r.id}-${i}`}>
              {h > 0 && (
                <path
                  d={roundedTopBar(x, top, barW, h, Math.min(radius, h))}
                  fill={SERIES_COLOR}
                  opacity={hover === null || hover === i ? 1 : 0.45}
                />
              )}
              {/* full-height hit target, larger than the mark */}
              <rect
                x={pad.left + i * slot}
                y={pad.top}
                width={slot}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
              {labelIdx.has(i) && (
                <text
                  x={x + barW / 2}
                  y={height - 8}
                  textAnchor={i === 0 ? 'start' : i === rows.length - 1 ? 'end' : 'middle'}
                  fontSize={11}
                  fill="#52514e"
                >
                  {r.label}
                </text>
              )}
            </g>
          )
        })}
        <line x1={pad.left} x2={width - pad.right} y1={pad.top + plotH} y2={pad.top + plotH} stroke="#b9b8b3" strokeWidth={1} />
      </svg>
      {hover !== null && rows[hover] && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: `${((pad.left + (hover + 0.5) * slot) / width) * 100}%`,
            transform: `translateX(${hover > rows.length / 2 ? 'calc(-100% - 12px)' : '12px'})`,
            background: '#fff',
            border: '1px solid #d0d0cc',
            borderRadius: 6,
            padding: '8px 10px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            fontSize: 12,
            color: '#0b0b0b',
            pointerEvents: 'none',
            whiteSpace: 'nowrap'
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{rows[hover].label}</div>
          <div>Page views: {formatNumber(rows[hover].pageviews)}</div>
          <div style={{ color: '#52514e' }}>Visits: {formatNumber(rows[hover].visits)}</div>
          <div style={{ color: '#52514e' }}>Visitors: {formatNumber(rows[hover].visitors)}</div>
        </div>
      )}
    </div>
  )
}

function roundedTopBar (x, y, w, h, r) {
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`
}

function niceMax (v) {
  const pow = Math.pow(10, Math.floor(Math.log10(v)))
  const step = [1, 2, 2.5, 5, 10].find(s => s * pow >= v)
  return step * pow
}

function compact (v) {
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(v)
}

AnalyticsDashboard.propTypes = {
  runtime: PropTypes.any,
  ims: PropTypes.any
}

export default AnalyticsDashboard
