import * as tokens from '../../theme';
import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import { AppText, Button, Section } from '../../components';
import { Card } from '../../components/ui/Card';
import { colors as c } from '../../theme';
import { ROUTES } from '../../constants/routes';
import { useApp } from '../../hooks';
import { Inventory as InventoryMobile } from './InventoryMobile';

// Web only. Below DESKTOP_BREAKPOINT this is the exact same mobile Inventory the app uses
// (`InventoryMobile`). At/above it, the inventory list sits on the left and a "Create listing" card
// plus a short note on how listings work fills the right column (founder feedback 16 Oct 2026: split
// every remaining page the same way).
const DESKTOP_BREAKPOINT = 768;

export function Inventory() {
  const { width } = useWindowDimensions();
  if (width < DESKTOP_BREAKPOINT) return <InventoryMobile />;
  return <DesktopInventory />;
}

function DesktopInventory() {
  const app = useApp();
  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      <View style={{ flex: 1 }}>
        <InventoryMobile />
      </View>
      <View
        style={{
          width: 320,
          borderLeftWidth: 1,
          borderColor: c.line,
          padding: tokens.spacing.xl,
        }}
      >
        <Section title="Add a listing" />
        <Card style={{ gap: tokens.spacing.sm, marginBottom: tokens.spacing.lg }}>
          <AppText muted size={13}>
            New finds show up in your inventory.
          </AppText>
          <Button label="Create listing" icon="add" onPress={() => app.navigate(ROUTES.LISTING)} />
        </Card>
        <Section title="Good to know" />
        <AppText muted size={13}>
          Listings are catalog-only for now: pricing and auction/buy-now setup happen when you put
          an item up in a live show.
        </AppText>
      </View>
    </View>
  );
}
