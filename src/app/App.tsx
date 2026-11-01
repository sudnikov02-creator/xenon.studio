import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import { RealtimeProvider } from '../context/RealtimeContext';
import { SettingsProvider } from '../context/SettingsContext';
import { Splash } from '../components/ui/Splash';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';

const LandingPage = lazy(() => import('../pages/LandingPage').then((m) => ({ default: m.LandingPage })));
const LoginPage = lazy(() => import('../pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('../pages/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));
const ExpiredLinkPage = lazy(() => import('../pages/ExpiredLinkPage').then((m) => ({ default: m.ExpiredLinkPage })));
const BookingLinkPage = lazy(() => import('../pages/BookingLinkPage').then((m) => ({ default: m.BookingLinkPage })));
const BookingPage = lazy(() => import('../pages/BookingPage').then((m) => ({ default: m.BookingPage })));
const AdminLayout = lazy(() => import('../components/layout/AdminLayout').then((m) => ({ default: m.AdminLayout })));
const DashboardPage = lazy(() => import('../pages/admin/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const ProfilePage = lazy(() => import('../pages/admin/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const SectionPreviewPage = lazy(() =>
  import('../pages/admin/SectionPreviewPage').then((m) => ({ default: m.SectionPreviewPage }))
);
const ServicesPage = lazy(() => import('../pages/admin/ServicesPage').then((m) => ({ default: m.ServicesPage })));
const SchedulePage = lazy(() => import('../pages/admin/SchedulePage').then((m) => ({ default: m.SchedulePage })));
const StatusesPage = lazy(() => import('../pages/admin/StatusesPage').then((m) => ({ default: m.StatusesPage })));
const BookingsPage = lazy(() => import('../pages/admin/BookingsPage').then((m) => ({ default: m.BookingsPage })));
const ClientsPage = lazy(() => import('../pages/admin/ClientsPage').then((m) => ({ default: m.ClientsPage })));
const MessagesPage = lazy(() => import('../pages/admin/MessagesPage').then((m) => ({ default: m.MessagesPage })));
const BookingFormSettingsPage = lazy(() =>
  import('../pages/admin/BookingFormSettingsPage').then((m) => ({ default: m.BookingFormSettingsPage }))
);

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <Splash />;
  if (!user) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  return <>{children}</>;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { user, status } = useAuth();
  if (status === 'loading') return <Splash />;
  if (user) return <Navigate to="/admin" replace />;
  return <>{children}</>;
}

const MARKETING_ROUTES: { path: string; section: string }[] = [
  { path: 'marketing/discounts', section: 'discounts' },
  { path: 'marketing/coupons', section: 'coupons' },
  { path: 'marketing/certificates', section: 'certificates' },
  { path: 'marketing/bonuses', section: 'bonuses' }
];

const SETTINGS_ROUTES: { path: string; section: string }[] = [
  { path: 'settings/notifications', section: 'notifications' },
  { path: 'settings/currency', section: 'currency' },
  { path: 'settings/automation', section: 'automation' },
  { path: 'settings/agreement', section: 'agreement' },
  { path: 'settings/seo', section: 'seo' },
  { path: 'settings/appearance', section: 'appearance' },
  { path: 'settings/integrations', section: 'integrations' },
  { path: 'settings/verification', section: 'verification' },
  { path: 'settings/messages', section: 'settings-messages' }
];

const SECTION_ROUTES: { path: string; section: string }[] = [
  { path: 'calendar', section: 'calendar' },
  { path: 'reviews', section: 'reviews' },
  { path: 'analytics', section: 'analytics' },
  { path: 'activity', section: 'activity' },
  { path: 'landing', section: 'landing' }
];

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <RealtimeProvider>
            <SettingsProvider>
              <ErrorBoundary>
              <Suspense fallback={<Splash />}>
                <Routes>
                  <Route path="/" element={<LandingPage />} />
                  <Route
                    path="/login"
                    element={
                      <GuestOnly>
                        <LoginPage />
                      </GuestOnly>
                    }
                  />
                  <Route
                    path="/register"
                    element={
                      <GuestOnly>
                        <RegisterPage />
                      </GuestOnly>
                    }
                  />
                  <Route path="/expired" element={<ExpiredLinkPage />} />
                  <Route path="/b/:code" element={<BookingLinkPage />} />
                  <Route path="/booking" element={<BookingPage />} />

                  <Route
                    path="/admin"
                    element={
                      <RequireAuth>
                        <AdminLayout />
                      </RequireAuth>
                    }
                  >
                    <Route index element={<DashboardPage />} />
                    <Route path="settings/profile" element={<ProfilePage />} />
                    <Route path="services" element={<ServicesPage />} />
                    <Route path="settings/schedule" element={<SchedulePage />} />
                    <Route path="settings/booking-form" element={<BookingFormSettingsPage />} />
                    <Route path="bookings" element={<BookingsPage />} />
                    <Route path="settings/statuses" element={<StatusesPage />} />
                    <Route path="clients" element={<ClientsPage />} />
                    <Route path="messages" element={<MessagesPage />} />
                    {SECTION_ROUTES.map((route) => (
                      <Route
                        key={route.path}
                        path={route.path}
                        element={<SectionPreviewPage sectionKey={route.section} />}
                      />
                    ))}
                    {MARKETING_ROUTES.map((route) => (
                      <Route
                        key={route.path}
                        path={route.path}
                        element={<SectionPreviewPage sectionKey={route.section} />}
                      />
                    ))}
                    {SETTINGS_ROUTES.map((route) => (
                      <Route
                        key={route.path}
                        path={route.path}
                        element={<SectionPreviewPage sectionKey={route.section} />}
                      />
                    ))}
                    <Route path="marketing" element={<Navigate to="/admin/marketing/discounts" replace />} />
                    <Route path="settings" element={<Navigate to="/admin/settings/profile" replace />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Route>

                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Suspense>
              </ErrorBoundary>
            </SettingsProvider>
          </RealtimeProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
