import * as tokens from "../../theme";
import React, { useRef, useCallback } from "react";
import { Pressable, View, Animated, PanResponder, Text } from "react-native";
import { AppText, Avatar, Badge, s } from "../../components";
import { colors as c } from "../../theme";
import { stockImageFor } from "../../utils/stock-image";
import { notificationText, type NotificationItem } from "../../api/notifications";
import type { ConversationView } from "../../api/messaging";

// Shared Inbox row renderers, used by both the mobile single-tab layout and the desktop two-column
// layout so the two can't drift apart.

export function NotificationRow({
  item,
  onPress,
  onDelete,
}: {
  item: NotificationItem;
  onPress: () => void;
  // Optional so a surface can list notifications read-only: the Activity screen passes a delete
  // handler (Phase 4); the desktop Inbox page's two-column Activity section deliberately doesn't.
  onDelete?: () => void;
}) {
  const { title, body } = notificationText(item);
  const unread = item.readAt === null;

  // Swipe-to-delete: Instagram-style left swipe reveals a red delete action.
  const translateX = useRef(new Animated.Value(0)).current;
  const SWIPE_THRESHOLD = -100;

  // `onMoveShouldSetPanResponder` used to return `true` unconditionally, so it claimed the very
  // first touch-move of a vertical list scroll too — the row grabbed the gesture, blocked the
  // ScrollView, and could leave itself stuck mid-swipe (the "odd delete thing" founder feedback,
  // 27 Oct 2026, matched a row frozen half-swiped with the red "Delete" edge peeking out). It now
  // only claims the gesture once the swipe is clearly more horizontal than vertical, so a normal
  // scroll stays a scroll.
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > Math.abs(gesture.dy) && Math.abs(gesture.dx) > 8,
      onPanResponderTerminationRequest: () => true,
      onPanResponderMove: (_, gesture) => {
        // Only allow left swipe; ignore right swipe (positive dx)
        if (gesture.dx < 0) {
          translateX.setValue(gesture.dx);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx < SWIPE_THRESHOLD && onDelete) {
          // Trigger delete when swiped past threshold
          Animated.timing(translateX, {
            toValue: -300,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            onDelete();
            translateX.setValue(0);
          });
        } else {
          // Snap back
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 40,
            friction: 7,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        // The gesture was taken over (e.g. the list claimed a scroll mid-swipe) — snap back rather
        // than leaving the row frozen at whatever offset it was swiped to.
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;

  return (
    <View style={{ overflow: "hidden", borderBottomWidth: 1, borderColor: c.line }}>
      {/* Red delete background revealed during swipe */}
      <View
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: 100,
          backgroundColor: c.live,
          justifyContent: "center",
          alignItems: "flex-end",
          paddingRight: 20,
        }}
      >
        <Text style={{ color: "#FFFFFF", fontWeight: "bold", fontSize: 14 }}>Delete</Text>
      </View>
      <Animated.View
        style={{
          transform: [{ translateX }],
        }}
        {...panResponder.panHandlers}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={title}
          onPress={onPress}
          style={[
            s.row,
            {
              gap: tokens.spacing.md,
              paddingVertical: tokens.spacing.lg,
              backgroundColor: c.canvas,
            },
          ]}
        >
          <View style={{ width: 8, alignItems: "center" }}>
            {unread ? <View style={{ width: 8, height: 8, borderRadius: 8, backgroundColor: c.live }} /> : null}
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <AppText bold={unread}>{title}</AppText>
            {body ? (
              <AppText muted size={13}>
                {body}
              </AppText>
            ) : null}
            <AppText muted size={11}>
              {new Date(item.createdAt).toLocaleString()}
            </AppText>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

export function ConversationRow({
  convo,
  onPress,
}: {
  convo: ConversationView;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Message ${convo.otherParty.displayName}`}
      onPress={onPress}
      style={[
        s.row,
        {
          gap: tokens.spacing.md,
          paddingVertical: tokens.spacing.xl,
          borderBottomWidth: 1,
          borderColor: c.line,
        },
      ]}
    >
      <Avatar uri={stockImageFor(convo.otherParty.id)} size={52} />
      <View style={{ flex: 1, gap: 5 }}>
        <AppText bold={convo.unread}>{convo.otherParty.displayName}</AppText>
        <AppText muted size={13}>
          {convo.lastMessageBody ?? ""}
        </AppText>
      </View>
      <View style={{ alignItems: "flex-end", gap: 6 }}>
        <AppText muted size={11}>
          {new Date(convo.lastMessageAt).toLocaleDateString()}
        </AppText>
        {convo.unread && <Badge label="New" />}
      </View>
    </Pressable>
  );
}
