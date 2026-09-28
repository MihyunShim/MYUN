import React from 'react';
import ReactDOM from 'react-dom/client';
const RootScreen = React.lazy(() => window.location.pathname.replace(/\/$/, '') === '/privacy'
  ? import('./screens/PublicPrivacy')
  : import('./App'));
import { AppErrorBoundary } from './components/AppErrorBoundary';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary><React.Suspense fallback={<p role="status">화면을 불러오는 중...</p>}><RootScreen /></React.Suspense></AppErrorBoundary>
  </React.StrictMode>,
);
