import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { AppShell } from './components/AppShell';
import { LoginPage } from './routes/login/LoginPage';
import { ApplicationsPage } from './routes/applications/ApplicationsPage';
import { ApplicationDetailPage } from './routes/applications/ApplicationDetailPage';
import { UsersPage } from './routes/users/UsersPage';
import { OrdersPage } from './routes/orders/OrdersPage';
import { OrderDetailPage } from './routes/orders/OrderDetailPage';
import { PayoutsPage } from './routes/payouts/PayoutsPage';
import { StreamsPage } from './routes/streams/StreamsPage';
import { AuditLogPage } from './routes/audit-log/AuditLogPage';
import { AnalyticsPage } from './routes/analytics/AnalyticsPage';
import { ReviewsPage } from './routes/reviews/ReviewsPage';
import { ReportsPage } from './routes/reports/ReportsPage';
import { HelpPage } from './routes/help/HelpPage';

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route index element={<Navigate to="/applications" replace />} />
            <Route path="applications" element={<ApplicationsPage />} />
            <Route path="applications/:id" element={<ApplicationDetailPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="orders/:id" element={<OrderDetailPage />} />
            <Route path="payouts" element={<PayoutsPage />} />
            <Route path="streams" element={<StreamsPage />} />
            <Route path="audit-log" element={<AuditLogPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="reviews" element={<ReviewsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="help" element={<HelpPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
