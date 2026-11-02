import * as tokens from '../../theme';
import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import { AppText } from '../../components';
import { Card } from '../../components/ui/Card';
import { colors as c } from '../../theme';
import { Conversation as ConversationMobile } from './ConversationMobile';

// Web only. Below DESKTOP_BREAKPOINT this is the exact same mobile conversation the app uses
// (`ConversationMobile`). At/above it, the chat sits on the left and a short "About direct messages"
// card fills the right column — a chat has no natural second column, so the aside carries real help
// text rather than a forced split.
const DESKTOP_BREAKPOINT = 768;

export function Conversation({ id }: { id?: string }) {
  const { width } = useWindowDimensions();
  if (width < DESKTOP_BREAKPOINT) return <ConversationMobile id={id} />;
  return <DesktopConversation id={id} />;
}

function DesktopConversation({ id }: { id?: string }) {
  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      <View style={{ flex: 1 }}>
        <ConversationMobile id={id} />
      </View>
      <View
        style={{
          width: 320,
          borderLeftWidth: 1,
          borderColor: c.line,
          padding: tokens.spacing.xl,
        }}
      >
        <Card style={{ gap: tokens.spacing.sm }}>
          <AppText bold size={16}>
            About direct messages
          </AppText>
          <AppText muted size={13}>
            Messages are real-time. A seller can only reply within this thread. They can't start a
            new one with you.
          </AppText>
        </Card>
      </View>
    </View>
  );
}
