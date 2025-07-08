import { Dashboard } from '@nearai/analytics-dashboard';
import '@nearai/analytics-dashboard/style.css'

function App() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Analytics Dashboard Test Application</h1>
      <p>
        This is a minimal TypeScript application that tests the correctness of the 
        "@nearai/analytics-dashboard" published npm package.
      </p>
      <p>
        The dashboard below demonstrates model comparison functionality and serves 
        as an example of how to integrate the dashboard into your own website.
      </p>
      
      <div style={{ marginTop: '20px', border: '1px solid #ccc', borderRadius: '8px', padding: '10px' }}>
        <Dashboard config={{
          views: ['model_comparison'],
          metrics_service_url: 'http://localhost:8000/api/v1/',
          viewConfigs: {
            model_comparison: {
              view_type: 'table',
              view_name: 'Compare Models',
              metricSelection: 'COMPARE_MODELS',
              refreshRate: undefined
            }
          }
        }} />
      </div>
    </div>
  );
}

export default App;