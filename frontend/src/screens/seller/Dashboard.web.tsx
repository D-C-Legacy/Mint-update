import * as tokens from '../../theme';
import { Card } from '../../components/ui/Card';
import React, { useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import { AppText, Chips, Section, s } from '../../components';
import { colors as c, formatUSD } from '../../theme';
import { ORDER_STATUS_LABEL, type OrderStatus } from '../../api/orders';
import { DashboardMenu } from './DashboardMenu';
import { Dashboard as DashboardMobile } from './DashboardMobile';
import {
  DASHBOARD_RANGE_LABELS,
  describeConversion,
  formatCount,
  useSellerDashboard,
} from '../../hooks/useSellerDashboard';

// Web only. Below DESKTOP_BREAKPOINT this is the exact same mobile Seller dashboard the app uses
// (`DashboardMobile`). At/above it, the dashboard splits like the Seller studio: the stats, range
// chips and chart on the left, the management menu in a right column (founder feedback 16 Oct 2026:
// split every remaining page the same way).
const DESKTOP_BREAKPOINT = 768;

export function Dashboard() {
  const { width } = useWindowDimensions();
  if (width < DESKTOP_BREAKPOINT) return <DashboardMobile />;
  return <DesktopDashboard />;
}

function DesktopDashboard() {
  const [range, setRange] = useState<string>('Last 30 days');
  const { state } = useSellerDashboard(range);
  const d = state.status === 'ready' ? state.data : null;

  const cards: Array<[string, string]> = d
    ? [
        [formatUSD(d.salesMinor / 100), 'Sales'],
        [formatCount(d.orderCount), 'Orders'],
        [formatCount(d.totalPeakViewers), 'Viewers'],
        [`${describeConversion(d.conversionRate)}%`, 'Conversion'],
      ]
    : [
        ['N/A', 'Sales'],
        ['N/A', 'Orders'],
        ['N/A', 'Viewers'],
        ['N/A', 'Conversion'],
      ];

  // Bar scale: tallest real day. Zero days show a 2px stub so the week's labels stay put.
  const bestRevenue = d ? Math.max(...d.week.map((w) => w.revenue), 0) : 0;
  const week = d ? d.week : Array.from({ length: 7 }, () => ({ day: '', revenue: 0 }));
  const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: tokens.spacing.xl, gap: tokens.spacing.md }}
      >
        <AppText size={28} bold>
          Seller dashboard
        </AppText>
        <Chips items={[...DASHBOARD_RANGE_LABELS]} value={range} onChange={setRange} />
        {state.status === 'error' && (
          <AppText muted size={12}>
            Couldn't load analytics: {state.message}
          </AppText>
        )}
        <View style={s.grid}>
          {cards.map(([value, label]) => (
            <Card key={label} style={[s.card, { width: '48%', marginBottom: tokens.spacing.md }]}>
              <AppText size={25} bold>
                {value}
              </AppText>
              <AppText muted size={12}>
                {label}
              </AppText>
            </Card>
          ))}
        </View>
        <Section title="Daily sales" />
        <Card
          style={[s.card, { height: 180, flexDirection: 'row', alignItems: 'flex-end', gap: 10 }]}
        >
          {week.map((w, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
              <View
                style={{
                  width: '100%',
                  height: w.revenue === 0 ? 2 : (w.revenue / (bestRevenue || 1)) * 130,
                  backgroundColor:
                    d && w.revenue === bestRevenue && bestRevenue > 0
                      ? c.brand
                      : tokens.colors.chartSoft,
                  borderRadius: 6,
                }}
              />
              <AppText muted size={10}>
                {w.day
                  ? WEEKDAY_LABELS[new Date(`${w.day}T00:00:00.000Z`).getUTCDay()]
                  : WEEKDAY_LABELS[i]}
              </AppText>
            </View>
          ))}
        </Card>
        <AppText muted size={12}>
          Daily revenue · last 7 days, best day highlighted
        </AppText>
        <Section title="Order status" />
        <AppText muted size={12}>
          {d
            ? d.statusCounts.length > 0
              ? `All time · ${d.statusCounts
                  .map(
                    (x) => `${ORDER_STATUS_LABEL[x.status as OrderStatus] ?? x.status}: ${x.count}`,
                  )
                  .join(' · ')}`
              : 'All time · no orders yet'
            : 'All time'}
        </AppText>
      </ScrollView>

      <View
        style={{
          width: 320,
          borderLeftWidth: 1,
          borderColor: c.line,
          padding: tokens.spacing.xl,
        }}
      >
        <DashboardMenu />
      </View>
    </View>
  );
}
