import React, { useState } from 'react';
import TableDashboard from './components/TableDashboard';
import LogsDashboard from './components/LogsDashboard';

function App() {
  const [currentView, setCurrentView] = useState<'table' | 'logs'>('table');
  
  // Store requests for each view to maintain state when switching
  const [tableRequest, setTableRequest] = useState<any>(null);
  const [logsRequest, setLogsRequest] = useState<any>(null);

  return (
    <>
      {currentView === 'table' ? (
        <TableDashboard 
          onNavigateToLogs={() => setCurrentView('logs')} 
          savedRequest={tableRequest}
          onRequestChange={setTableRequest}
        />
      ) : (
        <LogsDashboard 
          onNavigateToTable={() => setCurrentView('table')} 
          savedRequest={logsRequest}
          onRequestChange={setLogsRequest}
        />
      )}
    </>
  );
}

export default App;