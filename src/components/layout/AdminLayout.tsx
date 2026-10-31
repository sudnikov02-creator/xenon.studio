import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { BottomNav } from './BottomNav';
import { useRealtime } from '../../context/RealtimeContext';
import { QuickBookingProvider } from '../../context/QuickBookingContext';

function PageFallback() {
  return (
    <div className="page">
      <div className="skeleton" style={{ width: 220, height: 26, borderRadius: 8 }} />
      <div className="skeleton" style={{ width: 340, height: 12, marginTop: 12 }} />
      <div className="page-skeleton">
        {[0, 1, 2, 3].map((index) => (
          <div className="card" key={index} style={{ height: 128 }} />
        ))}
      </div>
      <div className="page-skeleton page-skeleton--two">
        <div className="card" style={{ height: 260 }} />
        <div className="card" style={{ height: 260 }} />
      </div>
    </div>
  );
}

export function AdminLayout() {
  const location = useLocation();
  const { subscribe } = useRealtime();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname]);

  useEffect(() => {
    return subscribe('booking', () => {
      // Записи получают живые обновления на своих страницах (этап 5).
    });
  }, [subscribe]);

  return (
    <QuickBookingProvider>
      <div className="admin">
        <Sidebar />
        <div className="admin__main">
          <Topbar />
          <main id="main-content">
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
        <BottomNav />
      </div>
    </QuickBookingProvider>
  );
}
