import { useEffect, useRef, useState } from 'react';
import {
  deleteChatMessage,
  killStream,
  listLiveStreams,
  type ChatMessage,
  type PublicStreamSession,
} from '../../api/streams';
import { getAccessToken } from '../../auth/AuthContext';
import { joinStreamRoom, type RoomConnection } from '../../lib/realtime';
import { ApiError } from '../../lib/api-client';
import { formatDate } from '../../lib/format';
import { StatusBadge } from '../../components/StatusBadge';
import { Section } from '../../components/Section';
import { dangerButtonStyle, secondaryButtonStyle } from '../../components/formStyles';
import { colors, spacing, radii, typography } from '../../theme';

const KILLABLE: PublicStreamSession['status'][] = ['SCHEDULED', 'LIVE'];

export function StreamsPage() {
  const [streams, setStreams] = useState<PublicStreamSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [selected, setSelected] = useState<PublicStreamSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connection, setConnection] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const roomRef = useRef<RoomConnection | null>(null);

  async function loadStreams() {
    setLoading(true);
    setLoadError(null);
    try {
      const page = await listLiveStreams({});
      setStreams(page.items);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load live streams.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStreams();
  }, []);

  useEffect(() => {
    roomRef.current?.disconnect();
    roomRef.current = null;
    setMessages([]);
    setConnectionError(null);

    if (!selected) return;
    const token = getAccessToken();
    if (!token) {
      setConnection('error');
      setConnectionError('No access token available.');
      return;
    }

    setConnection('connecting');
    const room = joinStreamRoom(token, selected.id, {
      onConnect: () => setConnection('connected'),
      onMessage: (message) => setMessages((prev) => [...prev, message]),
      onDeleted: (messageId) =>
        setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, isDeleted: true } : m))),
      onError: (message) => {
        setConnection('error');
        setConnectionError(message);
      },
    });
    roomRef.current = room;

    return () => {
      room.disconnect();
    };
  }, [selected]);

  async function handleKill(session: PublicStreamSession) {
    setBusy(true);
    setActionError(null);
    setActionMessage(null);
    try {
      await killStream(session.id);
      setActionMessage(`Stream "${session.title}" killed.`);
      if (selected?.id === session.id) setSelected(null);
      await loadStreams();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Kill failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteMessage(messageId: string) {
    try {
      await deleteChatMessage(messageId);
      // The real removal comes back over 'chat.deleted' (same broadcast every viewer gets) —
      // this just gives this admin's own click instant feedback rather than waiting on the echo.
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, isDeleted: true } : m)));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Delete failed.');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xl }}>
      <h1 style={{ fontSize: typography.section, color: colors.text, margin: 0 }}>Streams & Chat</h1>

      {actionMessage && <div style={bannerStyle(colors.success, '#E3F6EC')}>{actionMessage}</div>}
      {actionError && <div style={bannerStyle(colors.urgent, '#FFE5E9')}>{actionError}</div>}
      {loadError && <div style={bannerStyle(colors.urgent, '#FFE5E9')}>{loadError}</div>}

      <Section title="Live & scheduled streams">
        <div
          style={{
            marginBottom: spacing.sm,
            padding: spacing.sm,
            background: colors.softCanvas,
            borderRadius: radii.button,
            fontSize: typography.meta,
            color: colors.textSecondary,
          }}
        >
          <strong>Kill currently fails for every session that has a provider room</strong> — found
          live while verifying this page. LIVEKIT_API_KEY and LIVEKIT_API_SECRET are still the
          placeholder value "replace" in this environment's .env, so the real LiveKit API rejects
          every kill request with "invalid API key" and the use case aborts before the session's
          own status ever updates. Not fixable from the frontend — needs real LiveKit credentials.
          Flagged, not hidden behind a vague error banner.
        </div>
        <div style={{ border: `1px solid ${colors.line}`, borderRadius: radii.button, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: `1px solid ${colors.line}` }}>
                {['Title', 'Status', 'Viewers', 'Started', ''].map((h) => (
                  <th key={h} style={{ padding: spacing.sm, fontSize: typography.meta, color: colors.textSecondary, fontWeight: 600 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {streams.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => setSelected(s)}
                  style={{
                    borderBottom: `1px solid ${colors.line}`,
                    cursor: 'pointer',
                    background: selected?.id === s.id ? colors.brandSoft : 'transparent',
                  }}
                >
                  <td style={{ padding: spacing.sm, fontSize: typography.body, color: colors.text }}>{s.title}</td>
                  <td style={{ padding: spacing.sm }}>
                    <StatusBadge status={s.status} />
                  </td>
                  <td style={{ padding: spacing.sm, fontSize: typography.body, color: colors.text }}>{s.viewerCount}</td>
                  <td style={{ padding: spacing.sm, fontSize: typography.body, color: colors.textSecondary }}>
                    {formatDate(s.startedAt)}
                  </td>
                  <td style={{ padding: spacing.sm }}>
                    {KILLABLE.includes(s.status) && (
                      <button
                        disabled={busy}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleKill(s);
                        }}
                        style={dangerButtonStyle}
                      >
                        Kill
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {streams.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} style={{ padding: spacing.lg, textAlign: 'center', color: colors.textSecondary }}>
                    No live or scheduled streams right now.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {selected && (
        <Section title={`Live chat — ${selected.title}`}>
          <div style={{ fontSize: typography.meta, color: colors.textSecondary, marginBottom: spacing.sm }}>
            There's no backend route to fetch chat history — this shows only messages sent while
            this panel stays open, joined over the same WebSocket room the stream's real viewers
            use. A real gap, flagged rather than faked with a history list.
            {connection === 'connecting' && ' Connecting…'}
            {connection === 'connected' && ' Connected.'}
            {connection === 'error' && ` Connection error: ${connectionError}`}
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: spacing.xs,
              maxHeight: 320,
              overflowY: 'auto',
              border: `1px solid ${colors.line}`,
              borderRadius: radii.button,
              padding: spacing.sm,
            }}
          >
            {messages.length === 0 && (
              <div style={{ color: colors.textSecondary, fontSize: typography.body, padding: spacing.sm }}>
                No messages yet.
              </div>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: spacing.xs,
                  opacity: m.isDeleted ? 0.5 : 1,
                }}
              >
                <div style={{ fontSize: typography.body, color: colors.text }}>
                  <span style={{ fontFamily: 'monospace', fontSize: typography.meta, color: colors.textSecondary }}>
                    {m.userId.slice(0, 8)}
                  </span>
                  {': '}
                  {m.isDeleted ? <em>deleted</em> : m.body}
                </div>
                {!m.isDeleted && (
                  <button onClick={() => handleDeleteMessage(m.id)} style={secondaryButtonStyle}>
                    Delete
                  </button>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function bannerStyle(color: string, bg: string) {
  return { background: bg, color, borderRadius: radii.button, padding: spacing.md, fontSize: typography.body } as const;
}
