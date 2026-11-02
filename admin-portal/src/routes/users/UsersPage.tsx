import { useEffect, useState } from 'react';
import {
  listUsers,
  suspendUser,
  reinstateUser,
  type AdminUserSummary,
  type UserStatus,
  type UserPlatform,
  type UserRole,
} from '../../api/users';
import { ApiError } from '../../lib/api-client';
import { formatDate } from '../../lib/format';
import { Section } from '../../components/Section';
import { inputStyle, secondaryButtonStyle, dangerButtonStyle, primaryButtonStyle } from '../../components/formStyles';
import { colors, spacing, radii, typography } from '../../theme';

const STATUS_TABS: { label: string; value: Exclude<UserStatus, 'UNKNOWN'> | undefined }[] = [
  { label: 'All', value: undefined },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Suspended', value: 'SUSPENDED' },
  { label: 'Deleted', value: 'DELETED' },
];

const PLATFORM_OPTIONS: { label: string; value: UserPlatform | '' }[] = [
  { label: 'All platforms', value: '' },
  { label: 'iOS', value: 'IOS' },
  { label: 'Android', value: 'ANDROID' },
  { label: 'Web', value: 'WEB' },
  { label: 'No device (unknown)', value: 'UNKNOWN' },
];

const ROLE_OPTIONS: { label: string; value: UserRole | '' }[] = [
  { label: 'All roles', value: '' },
  { label: 'Buyer', value: 'BUYER' },
  { label: 'Seller', value: 'SELLER' },
  { label: 'Admin', value: 'ADMIN' },
];

// Derived platform badge colors — not part of StatusBadge's status mapping because this isn't
// a workflow status.
const PLATFORM_BADGE_COLORS: Record<UserPlatform, { fg: string; bg: string }> = {
  IOS: { fg: colors.brand, bg: colors.brandSoft },
  ANDROID: { fg: colors.success, bg: '#E3F6EC' },
  WEB: { fg: '#553C9A', bg: '#EDEBF7' },
  UNKNOWN: { fg: colors.textSecondary, bg: colors.softCanvas },
};

export function UsersPage() {
  const [status, setStatus] = useState<Exclude<UserStatus, 'UNKNOWN'> | undefined>(undefined);
  const [platform, setPlatform] = useState<UserPlatform | ''>('');
  const [role, setRole] = useState<UserRole | ''>('');
  // Search is committed (Enter or the button) rather than firing a request per keystroke.
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');

  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load(reset: boolean) {
    setLoading(true);
    setError(null);
    try {
      const page = await listUsers({
        q: q || undefined,
        status,
        platform: platform || undefined,
        role: role || undefined,
        cursor: reset ? undefined : (cursor ?? undefined),
      });
      setUsers((prev) => (reset ? page.items : [...prev, ...page.items]));
      setCursor(page.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setUsers([]);
    setCursor(null);
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, platform, role, q]);

  async function applyStatusChange(userId: string, action: 'suspend' | 'reinstate') {
    setBusyId(userId);
    setError(null);
    try {
      const updated =
        action === 'suspend'
          ? await suspendUser(userId)
          : await reinstateUser(userId);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: updated.status as AdminUserSummary['status'] } : u)));
      setConfirmingId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Failed to ${action} user.`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xl }}>
      <h1 style={{ fontSize: typography.section, color: colors.text, margin: 0 }}>Users</h1>

      <Section title="Filter">
        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
          <div style={{ display: 'flex', gap: spacing.md, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setQ(qInput.trim());
              }}
              placeholder="Search email, display name, or user id"
              style={{ ...inputStyle, flex: 1, minWidth: 280 }}
            />
            <button onClick={() => setQ(qInput.trim())} style={primaryButtonStyle}>
              Search
            </button>
          </div>
          <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap', alignItems: 'center' }}>
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.label}
                onClick={() => setStatus(tab.value)}
                style={status === tab.value ? primaryButtonStyle : secondaryButtonStyle}
              >
                {tab.label}
              </button>
            ))}
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as UserPlatform | '')}
              style={inputStyle}
              aria-label="Platform filter"
            >
              {PLATFORM_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole | '')}
              style={inputStyle}
              aria-label="Role filter"
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Section>

      {error && <div style={{ color: colors.urgent, fontSize: typography.body }}>{error}</div>}

      <div style={{ background: colors.canvas, borderRadius: radii.cardLarge, border: `1px solid ${colors.line}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: `1px solid ${colors.line}` }}>
              {['User', 'Role', 'Status', 'Platform', 'Joined', 'Actions'].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: spacing.md,
                    fontSize: typography.meta,
                    color: colors.textSecondary,
                    fontWeight: 600,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isSeller = user.isSeller && user.sellerStatus !== null;
              const busy = busyId === user.id;
              return (
                <tr key={user.id} style={{ borderBottom: `1px solid ${colors.line}` }}>
                  <td style={{ padding: spacing.md }}>
                    <div
                      style={{
                        fontWeight: 600,
                        color: colors.text,
                        display: 'flex',
                        alignItems: 'center',
                        gap: spacing.xs,
                      }}
                    >
                      <span style={{ color: colors.brand, fontWeight: 600 }}>●</span>
                      {user.displayName}
                      {isSeller && (
                        <span
                          style={{
                            marginLeft: spacing.xs,
                            padding: `1px ${spacing.xs}px`,
                            borderRadius: radii.pill,
                            background: colors.softCanvas,
                            color: colors.textSecondary,
                            fontSize: typography.meta,
                            fontWeight: 600,
                            border: `1px solid ${colors.line}`,
                          }}
                        >
                          Seller
                        </span>
                      )}
                    </div>
                    <div style={{ color: colors.textSecondary, fontSize: typography.meta }}>{user.email}</div>
                  </td>
                  <td style={{ padding: spacing.md, fontSize: typography.body, color: colors.text }}>{user.role}</td>
                  <td style={{ padding: spacing.md }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: `2px ${spacing.sm}px`,
                        borderRadius: radii.pill,
                        background:
                          user.status === 'ACTIVE'
                            ? '#E3F6EC'
                            : user.status === 'SUSPENDED'
                              ? '#FFE5E9'
                              : colors.softCanvas,
                        color:
                          user.status === 'ACTIVE'
                            ? colors.success
                            : user.status === 'SUSPENDED'
                              ? colors.urgent
                              : colors.textSecondary,
                        fontSize: typography.meta,
                        fontWeight: 600,
                      }}
                    >
                      {user.status}
                    </span>
                    {user.deletionScheduledAt && (
                      <div
                        title={`Account deletion requested by the user, scheduled for ${formatDate(user.deletionScheduledAt)}`}
                        style={{
                          marginTop: spacing.xs,
                          fontSize: typography.meta,
                          fontWeight: 600,
                          color: colors.warning,
                        }}
                      >
                        Pending deletion
                      </div>
                    )}
                  </td>
                  <td style={{ padding: spacing.md }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: `2px ${spacing.sm}px`,
                        borderRadius: radii.pill,
                        background: PLATFORM_BADGE_COLORS[user.primaryPlatform].bg,
                        color: PLATFORM_BADGE_COLORS[user.primaryPlatform].fg,
                        fontSize: typography.meta,
                        fontWeight: 600,
                      }}
                    >
                      {user.primaryPlatform}
                    </span>
                  </td>
                  <td style={{ padding: spacing.md, fontSize: typography.body, color: colors.textSecondary }}>
                    {formatDate(user.createdAt)}
                  </td>
                  <td style={{ padding: spacing.md }}>
                    {user.status === 'ACTIVE' ? (
                      confirmingId === user.id ? (
                        <div style={{ display: 'flex', gap: spacing.xs, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, color: colors.urgent, fontSize: typography.meta, marginRight: 4 }}>
                            Suspend {user.displayName}?
                          </span>
                          <button onClick={() => applyStatusChange(user.id, 'suspend')} disabled={busy} style={dangerButtonStyle}>
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmingId(null)}
                            disabled={busy}
                            style={secondaryButtonStyle}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmingId(user.id)} style={{ ...secondaryButtonStyle, alignSelf: 'flex-start' }}>
                          Suspend
                        </button>
                      )
                    ) : user.status === 'SUSPENDED' ? (
                      confirmingId === user.id ? (
                        <div style={{ display: 'flex', gap: spacing.xs, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, color: colors.success, fontSize: typography.meta, marginRight: 4 }}>
                            Reinstate {user.displayName}?
                          </span>
                          <button onClick={() => applyStatusChange(user.id, 'reinstate')} disabled={busy} style={primaryButtonStyle}>
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmingId(null)}
                            disabled={busy}
                            style={secondaryButtonStyle}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmingId(user.id)} style={{ ...secondaryButtonStyle, alignSelf: 'flex-start' }}>
                          Reinstate
                        </button>
                      )
                    ) : (
                      <span style={{ color: colors.textSecondary, fontSize: typography.meta }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && !loading && (
              <tr>
                <td colSpan={6} style={{ padding: spacing.xxl, textAlign: 'center', color: colors.textSecondary }}>
                  No users match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: typography.meta, color: colors.textSecondary }}>
        Suspension blocks login and future actions, but does not end any live stream or hold
        payouts — the backend route only flips the status (known gap, flagged in
        admin_progress.md). Every action is audit-logged.
      </div>

      {cursor && (
        <button onClick={() => load(false)} disabled={loading} style={{ ...secondaryButtonStyle, alignSelf: 'flex-start' }}>
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  );
}
