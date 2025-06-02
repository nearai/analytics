import React, { useState, useEffect } from 'react';
import TableDashboard from './components/TableDashboard';
import LogsDashboard from './components/LogsDashboard';

function App() {
  const [currentView, setCurrentView] = useState<'table' | 'logs'>('table');

  return (
    <>
      {currentView === 'table' ? (
        <TableDashboard onNavigateToLogs={() => setCurrentView('logs')} />
      ) : (
        <LogsDashboard onNavigateToTable={() => setCurrentView('table')} />
      )}
    </>
  );
}

export default App;