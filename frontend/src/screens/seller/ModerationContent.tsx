import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, View, TextInput } from "react-native";
import { AppText, Button, Icon, s } from "../../components";
import { colors as c, spacing, radii } from "../../theme";
import { InitialsAvatar } from "../../components/live/InitialsAvatar";
import {
  addModerator,
  removeModerator,
  listModerators,
  timeoutUser,
  listTimeouts,
  type StreamModerator,
  type ChatTimeout,
} from "../../api/streams";
import { describeApiError } from "../../api/describe-error";

export function ModerationContent({ sessionId }: { sessionId: string }) {
  const [mods, setMods] = useState<StreamModerator[]>([]);
  const [timeouts, setTimeouts] = useState<ChatTimeout[]>([]);
  const [loading, setLoading] = useState(true);
  const [modUserId, setModUserId] = useState("");
  const [modBusy, setModBusy] = useState(false);
  const [showModModal, setShowModModal] = useState(false);
  const [timeoutUserId, setTimeoutUserId] = useState("");
  const [timeoutDuration, setTimeoutDuration] = useState(10);
  const [timeoutReason, setTimeoutReason] = useState<'SPAM' | 'HARASSMENT' | 'INAPPROPRIATE' | 'OTHER'>('OTHER');
  const [timeoutBusy, setTimeoutBusy] = useState(false);

  useEffect(() => {
    loadData();
  }, [sessionId]);

  async function loadData() {
    setLoading(true);
    try {
      const [modsRes, timeoutsRes] = await Promise.all([
        listModerators(sessionId),
        listTimeouts(sessionId, undefined, true),
      ]);
      setMods(modsRes.items);
      setTimeouts(timeoutsRes.items);
    } catch (err) {
      console.warn('[ModerationContent] load failed', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddMod() {
    if (!modUserId.trim() || modBusy) return;
    setModBusy(true);
    try {
      await addModerator(sessionId, modUserId.trim());
      setModUserId("");
      setShowModModal(false);
      loadData();
    } catch (err) {
      alert(describeApiError(err));
    } finally {
      setModBusy(false);
    }
  }

  async function handleRemoveMod(moderatorId: string) {
    if (!confirm("Remove this moderator?")) return;
    try {
      await removeModerator(sessionId, moderatorId);
      setMods((prev) => prev.filter((m) => m.id !== moderatorId));
    } catch (err) {
      alert(describeApiError(err));
    }
  }

  async function handleTimeoutUser() {
    if (!timeoutUserId.trim() || timeoutBusy) return;
    setTimeoutBusy(true);
    try {
      await timeoutUser(sessionId, timeoutUserId.trim(), timeoutDuration, timeoutReason);
      setTimeoutUserId("");
      setTimeoutDuration(10);
      setTimeoutReason('OTHER');
      loadData();
    } catch (err) {
      alert(describeApiError(err));
    } finally {
      setTimeoutBusy(false);
    }
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    if (d < now) return 'Expired';
    const diff = d.getTime() - now.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${mins % 60}m`;
    return `${mins}m`;
  };

  if (loading) {
    return <AppText muted>Loading moderation…</AppText>;
  }

  return (
    <View style={{ gap: spacing.lg }}>
      {/* Current moderators */}
      <View style={{ gap: spacing.md }}>
        <AppText size={18} bold>
          Moderators ({mods.length})
        </AppText>
        {mods.length === 0 ? (
          <AppText muted size={14}>No moderators yet. Add someone to help manage chat.</AppText>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {mods.map((mod) => (
              <View
                key={mod.id}
                style={[s.card, { flexDirection: "row", alignItems: "center", gap: spacing.md }]}
              >
                <InitialsAvatar name={mod.userId} size={40} />
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText bold size={14}>{mod.userId}</AppText>
                  <AppText muted size={11}>Added {new Date(mod.createdAt).toLocaleDateString()}</AppText>
                </View>
                <Pressable
                  onPress={() => handleRemoveMod(mod.id)}
                  style={{ padding: spacing.sm }}
                >
                  <Icon name="trash-outline" size={18} color={c.urgent} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Add moderator form */}
      <Pressable
        onPress={() => setShowModModal(true)}
        style={[s.card, { flexDirection: "row", alignItems: "center", gap: spacing.md }]}
      >
        <Icon name="person-add-outline" size={20} color={c.brand} />
        <AppText bold size={14} style={{ color: c.brand }}>
          Add moderator
        </AppText>
      </Pressable>

      {/* Chat timeouts */}
      {timeouts.length > 0 && (
        <View style={{ gap: spacing.md }}>
          <AppText size={18} bold>
            Active timeouts ({timeouts.length})
          </AppText>
          <View style={{ gap: spacing.sm }}>
            {timeouts.map((t) => (
              <View key={t.id} style={[s.card, { flexDirection: "row", alignItems: "center", gap: spacing.md }]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText bold size={14}>{t.userId}</AppText>
                  <AppText muted size={11}>
                    {t.reason} · Expires in {formatTime(t.expiresAt)}
                  </AppText>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Timeout user form */}
      <View style={[s.card, { gap: spacing.md }]}>
        <AppText size={16} bold>
          Timeout user
        </AppText>
        <View style={{ gap: spacing.sm }}>
          <TextInput
            placeholder="User ID to timeout"
            value={timeoutUserId}
            onChangeText={setTimeoutUserId}
            style={{
              borderWidth: 1,
              borderColor: c.line,
              borderRadius: radii.md,
              padding: spacing.md,
              fontSize: 14,
            }}
          />
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <AppText muted size={12}>Duration (minutes)</AppText>
              <TextInput
                placeholder="10"
                value={String(timeoutDuration)}
                onChangeText={(v) => setTimeoutDuration(parseInt(v) || 10)}
                keyboardType="numeric"
                style={{
                  borderWidth: 1,
                  borderColor: c.line,
                  borderRadius: radii.md,
                  padding: spacing.md,
                  fontSize: 14,
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <AppText muted size={12}>Reason</AppText>
              <TextInput
                placeholder="Reason"
                value={timeoutReason}
                onChangeText={(v) => setTimeoutReason(v as any)}
                style={{
                  borderWidth: 1,
                  borderColor: c.line,
                  borderRadius: radii.md,
                  padding: spacing.md,
                  fontSize: 14,
                }}
              />
            </View>
          </View>
          <View style={{ marginTop: spacing.sm }}>
            <Button
              label={timeoutBusy ? "Timing out…" : "Timeout user"}
              onPress={handleTimeoutUser}
              disabled={timeoutBusy || !timeoutUserId.trim()}
            />
          </View>
        </View>
      </View>
    </View>
  );
}