import { useState, type FormEvent, type CSSProperties } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { ApiError } from '../../lib/api-client';
import { colors, spacing, radii, typography, shadows } from '../../theme';

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    const redirectTo = (location.state as { from?: string } | null)?.from ?? '/';
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Something went wrong. Try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: colors.desktop,
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: 360,
          background: colors.canvas,
          borderRadius: radii.cardLarge,
          boxShadow: shadows.card,
          padding: spacing.xxl,
          display: 'flex',
          flexDirection: 'column',
          gap: spacing.lg,
        }}
      >
        <div>
          <div style={{ fontSize: typography.section, fontWeight: 700, color: colors.text }}>Shopaflo Admin</div>
          <div style={{ fontSize: typography.meta, color: colors.textSecondary, marginTop: spacing.xs }}>
            Platform staff only
          </div>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
          <span style={{ fontSize: typography.meta, color: colors.textSecondary }}>Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
          <span style={{ fontSize: typography.meta, color: colors.textSecondary }}>Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
        </label>

        {error && (
          <div style={{ fontSize: typography.meta, color: colors.urgent }}>{error}</div>
        )}

        <button type="submit" disabled={submitting} style={buttonStyle}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

const inputStyle: CSSProperties = {
  border: `1px solid ${colors.line}`,
  borderRadius: radii.button,
  padding: `${spacing.sm}px ${spacing.md}px`,
  fontSize: typography.body,
  outline: 'none',
};

const buttonStyle: CSSProperties = {
  border: 'none',
  borderRadius: radii.button,
  padding: `${spacing.sm + 2}px ${spacing.md}px`,
  background: colors.brand,
  color: colors.canvas,
  fontSize: typography.body,
  fontWeight: 600,
  cursor: 'pointer',
};
