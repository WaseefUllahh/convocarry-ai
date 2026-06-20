import React from 'react';
import ReactDOM from 'react-dom/client';

const Options = () => (
  <div style={{ textAlign: 'center' }}>
    <h1>ConvoCarry AI Options</h1>
    <p>Manage your account, preferences, and local storage limits here.</p>
  </div>
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>
);
