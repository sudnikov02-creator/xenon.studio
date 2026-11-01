import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/layout.css';
import './styles/dashboard.css';
import './styles/services.css';
import './styles/booking.css';
import './styles/bookings.css';
import './styles/client.css';
import './styles/statuses.css';
import './styles/clients.css';
import { App } from './app/App';

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);
