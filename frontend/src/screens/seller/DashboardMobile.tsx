import * as tokens from '../../theme';
import { Card } from '../../components/ui/Card';
import React, { useState } from 'react';
import { View } from 'react-native';
import { AppText, Chips, Screen, Section, s } from '../../components';
import { colors as c, formatUSD } from '../../theme';
import { ORDER_STATUS_LABEL, type OrderStatus } from '../../api/orders';
import { useApp } from '../../context';
import { DashboardMenu } from './DashboardMenu';
import {
  DASHBOARD_RANGE_LABELS,
  describeConversion,
  formatCount,
  useSellerDashboard,
} from '../../hooks/useSellerDashboard';

// The app's own Seller dashboard (mobile), reading the real seller analytics endpoints (Phase 2).
// The web build has its own 2-column layout (`Dashboard.web.tsx`); this file is the single source
// of truth for the mobile layout, reused by the web narrow-width path.
export function Dashboard() {
  const app = useApp();
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
    <Screen title="Seller dashboard" onBack={app.back}>
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
        style={[
          s.card,
          {
            height: 180,
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 10,
          },
        ]}
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
      <AppText muted size={12} style={{ marginTop: tokens.spacing.sm }}>
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
      <DashboardMenu />
    </Screen>
  );
}
