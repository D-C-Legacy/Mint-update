import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { colors, spacing, radii, typography } from '../theme';

const NAV_ITEMS = [
  { to: '/applications', label: 'Applications' },
  { to: '/users', label: 'Users' },
  { to: '/orders', label: 'Orders' },
  { to: '/payouts', label: 'Payouts' },
  { to: '/streams', label: 'Streams & Chat' },
  { to: '/reviews', label: 'Reviews' },
  { to: '/reports', label: 'Reports' },
  { to: '/help', label: 'Help content' },
  { to: '/audit-log', label: 'Audit Log' },
  { to: '/analytics', label: 'Analytics' },
];

export function AppShell() {
  const { user, logout } = useAuth();

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: colors.desktop }}>
      <aside
        style={{
          width: 220,
          background: colors.canvas,
          borderRight: `1px solid ${colors.line}`,
          display: 'flex',
          flexDirection: 'column',
          padding: spacing.lg,
          gap: spacing.xxl,
        }}
      >
        <div style={{ fontSize: typography.product, fontWeight: 700, color: colors.text }}>Shopaflo Admin</div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                padding: `${spacing.sm}px ${spacing.md}px`,
                borderRadius: radii.button,
                fontSize: typography.body,
                color: isActive ? colors.brand : colors.text,
                background: isActive ? colors.brandSoft : 'transparent',
                fontWeight: isActive ? 600 : 400,
                textDecoration: 'none',
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
          <div style={{ fontSize: typography.meta, color: colors.textSecondary }}>{user?.displayName}</div>
          <button
            onClick={logout}
            style={{
              border: `1px solid ${colors.line}`,
              background: 'transparent',
              borderRadius: radii.button,
              padding: `${spacing.xs}px ${spacing.md}px`,
              fontSize: typography.meta,
              color: colors.textSecondary,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, padding: spacing.section }}>
        <Outlet />
      </main>
    </div>
  );
}
