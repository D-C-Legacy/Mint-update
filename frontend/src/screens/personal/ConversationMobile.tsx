import * as tokens from '../../theme';
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { AppText, Button, EmptyState, Field, Screen } from '../../components';
import { colors as c } from '../../theme';
import { useApp } from '../../context';
import { useRealtime } from '../../hooks/useRealtime';
import { useMessaging } from '../../hooks/useMessaging';
import {
  findConversationBySeller,
  listMessages,
  markConversationRead,
  sendMessage,
  startConversation,
  type ConversationView,
  type MessageView,
} from '../../api/messaging';
import { describeApiError } from '../../api/describe-error';

// The app's own Conversation screen (mobile). The web build has its own 2-column layout
// (`Conversation.web.tsx`); this file is the single source of truth for the mobile layout, reused by
// the web narrow-width path. `id` is the seller id, not a conversation id — there's no "get
// conversation by seller" route, so this finds-or-starts the thread itself (same page-walk
// isFollowing() already uses). Real as of Phase 8; was an in-memory mock before.
export function Conversation({ id: sellerId }: { id?: string }) {
  const app = useApp();
  const realtime = useRealtime();
  const messaging = useMessaging();
  const [conversation, setConversation] = useState<ConversationView | null>(null);
  const [items, setItems] = useState<MessageView[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const otherName = useRef('Seller');

  useEffect(() => {
    if (!sellerId) {
      setStatus('error');
      setError('No seller to message.');
      return;
    }
    let alive = true;
    setStatus('loading');
    findConversationBySeller(sellerId)
      .then(async (found) => {
        if (!alive) return;
        if (!found) {
          setConversation(null);
          setItems([]);
          setStatus('ready');
          return;
        }
        otherName.current = found.otherParty.displayName;
        setConversation(found);
        const page = await listMessages(found.id);
        if (!alive) return;
        setItems(page.items.slice().reverse());
        setStatus('ready');
        if (found.unread) {
          markConversationRead(found.id).catch(() => undefined);
          messaging.refresh();
        }
      })
      .catch((err) => {
        if (!alive) return;
        setError(describeApiError(err));
        setStatus('error');
      });
    return () => {
      alive = false;
    };
  }, [sellerId]);

  useEffect(() => {
    if (!conversation) return;
    return realtime.on('message.created', (payload: unknown) => {
      const p = payload as {
        conversationId?: string;
        messageId?: string;
        body?: string;
        createdAt?: string;
      };
      if (p.conversationId !== conversation.id) return;
      setItems((prev) => [
        ...prev,
        {
          id: p.messageId ?? `${Date.now()}`,
          conversationId: conversation.id,
          body: p.body ?? '',
          mine: false,
          createdAt: p.createdAt ?? new Date().toISOString(),
        },
      ]);
      markConversationRead(conversation.id).catch(() => undefined);
    });
  }, [conversation, realtime]);

  const onSend = async () => {
    const body = text.trim();
    if (!body || !sellerId) return;
    setSending(true);
    try {
      if (!conversation) {
        const started = await startConversation(sellerId, body);
        otherName.current = started.otherParty.displayName;
        setConversation(started);
        const page = await listMessages(started.id);
        setItems(page.items.slice().reverse());
      } else {
        const sent = await sendMessage(conversation.id, body);
        setItems((prev) => [...prev, sent]);
      }
      setText('');
    } catch (err) {
      app.toast(describeApiError(err));
    } finally {
      setSending(false);
    }
  };

  if (status === 'loading') {
    return (
      <Screen title="Messages" onBack={app.back}>
        <AppText muted>Loading…</AppText>
      </Screen>
    );
  }
  if (status === 'error') {
    return (
      <Screen title="Messages" onBack={app.back}>
        <EmptyState title="Couldn't open this conversation" detail={error} />
      </Screen>
    );
  }

  return (
    <Screen title={otherName.current} onBack={app.back}>
      {items.length === 0 ? (
        <AppText muted style={{ textAlign: 'center', marginVertical: tokens.spacing.xxl }}>
          Say hello. Your message starts the conversation.
        </AppText>
      ) : (
        items.map((m) => (
          <View
            key={m.id}
            style={{
              alignSelf: m.mine ? 'flex-end' : 'flex-start',
              backgroundColor: m.mine ? c.brand : c.softCanvas,
              padding: 14,
              borderRadius: tokens.radii.card,
              maxWidth: '85%',
              marginBottom: tokens.spacing.md,
            }}
          >
            <AppText white={m.mine}>{m.body}</AppText>
            <AppText white={m.mine} muted={!m.mine} size={10} style={{ marginTop: 4 }}>
              {new Date(m.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </AppText>
          </View>
        ))
      )}
      <Field placeholder="Write a message…" value={text} onChange={setText} />
      <Button label="Send message" loading={sending} disabled={!text.trim()} onPress={onSend} />
    </Screen>
  );
}
