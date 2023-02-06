import React from 'react';
import ReactDOM from 'react-dom';
import { HashRouter, Routes, Route } from 'react-router-dom';

import { Auth0Provider } from '@auth0/auth0-react';

import App from './App';
import { AppProvider } from './AppProvider';
import TheButton from './components/TheButton';
import config from './config';
import './index.css';
import reportWebVitals from './reportWebVitals';
import * as Posthog from './services/posthog';
import * as Sentry from './services/sentry';

Posthog.init();
Sentry.init();

const isDarkMode = localStorage.theme === 'dark';
if (isDarkMode) {
  document.documentElement.classList.add('dark');
} else {
  document.documentElement.classList.remove('dark');
}

const body = (
  <AppProvider>
    <HashRouter>
      <Routes>
        <Route path='/' element={<App />} />
        <Route path='/button/:title/:query' element={<TheButton />} />
        <Route path='/button/:query' element={<TheButton />} />
      </Routes>
    </HashRouter>
  </AppProvider>
);

ReactDOM.render(
  <React.StrictMode>
    {config.auth ? <Auth0Provider {...config.auth}>{body}</Auth0Provider> : body}
  </React.StrictMode>,
  document.getElementById('root'),
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
