import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from '@/app/App';
import { AppProviders } from '@/app/providers/AppProviders';

import 'antd/dist/reset.css';
import '@/app/styles/tokens.css';
import '@/app/styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </React.StrictMode>,
);
