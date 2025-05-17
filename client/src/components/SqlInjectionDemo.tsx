import React, { useState } from 'react';
import { api } from '../api';

const SqlInjectionDemo = () => {
  // State for the demo
  const [selectQuery, setSelectQuery] = useState('');
  const [updateQuery, setUpdateQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [executedQuery, setExecutedQuery] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  
  // Update form states
  const [updateResult, setUpdateResult] = useState<any>(null);
  const [isResetting, setIsResetting] = useState(false);

  // Reset all states
  const resetStates = () => {
    setResults([]);
    setError('');
    setExecutedQuery('');
    setUpdateResult(null);
    setResetMessage('');
  };

  // Part A: Unsafe SELECT handler
  const handleUnsafeSelect = async (e: React.FormEvent) => {
    e.preventDefault();
    resetStates();
    
    try {
      const response = await api.get(`/api/sql-injection/unsafe-select?query=${encodeURIComponent(selectQuery)}`);
      setResults(response.data);
      setExecutedQuery(selectQuery);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    }
  };

  // Part B: Unsafe UPDATE handler
  const handleUnsafeUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    resetStates();
    
    try {
      const response = await api.post('/api/sql-injection/unsafe-update', { query: updateQuery });
      setUpdateResult(response.data);
      setExecutedQuery(updateQuery);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    }
  };

  // Part C: Safe SELECT handler
  const handleSafeSelect = async (e: React.FormEvent) => {
    e.preventDefault();
    resetStates();
    
    try {
      const response = await api.get(`/api/sql-injection/safe-select?username=${encodeURIComponent(selectQuery)}`);
      setResults(response.data);
      setExecutedQuery(`Using prepared statement with parameter: "${selectQuery}"`);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    }
  };

  // Reset database handler
  const handleResetDatabase = async () => {
    resetStates();
    setIsResetting(true);
    
    try {
      const response = await api.post('/api/sql-injection/reset');
      const { message, stats } = response.data;
      setResetMessage(`${message}. Users: ${stats.usersRestored}, Permissions: ${stats.userPermissionsRestored}`);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-6">SQL Injection Demonstration</h2>
      
      {/* Reset Database Button */}
      <div className="mb-8 flex justify-end">
        <button 
          onClick={handleResetDatabase}
          disabled={isResetting}
          className="bg-red-500 text-white px-6 py-2 rounded hover:bg-red-600 disabled:opacity-50"
        >
          {isResetting ? 'Resetting...' : 'Reset Database'}
        </button>
      </div>
      
      {resetMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-8">
          <p><strong>Success:</strong> {resetMessage}</p>
        </div>
      )}
      
      {/* Part A: Vulnerable SELECT form */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h3 className="text-xl font-semibold mb-4">Part A: Vulnerable SELECT Query</h3>
        <p className="mb-4 text-gray-700">
          Enter your complete SQL SELECT query. This form is vulnerable to SQL injection.
        </p>
        
        <form onSubmit={handleUnsafeSelect} className="mb-4">
          <div className="mb-4">
            <label htmlFor="select-query" className="block text-gray-700 mb-2">SQL SELECT Query:</label>
            <textarea
              id="select-query"
              value={selectQuery}
              onChange={(e) => setSelectQuery(e.target.value)}
              className="w-full p-2 border rounded font-mono"
              placeholder="Enter your complete SQL SELECT query"
              rows={4}
            />
          </div>
          <button 
            type="submit" 
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Execute Query
          </button>
        </form>
      </div>
      
      {/* Part B: Vulnerable UPDATE form */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h3 className="text-xl font-semibold mb-4">Part B: Vulnerable UPDATE Query</h3>
        <p className="mb-4 text-gray-700">
          Enter your complete SQL UPDATE query. This form is vulnerable to SQL injection.
        </p>
        
        <form onSubmit={handleUnsafeUpdate} className="mb-4">
          <div className="mb-4">
            <label htmlFor="update-query" className="block text-gray-700 mb-2">SQL UPDATE Query:</label>
            <textarea
              id="update-query"
              value={updateQuery}
              onChange={(e) => setUpdateQuery(e.target.value)}
              className="w-full p-2 border rounded font-mono"
              placeholder="Enter your complete SQL UPDATE query"
              rows={4}
            />
          </div>
          <button 
            type="submit" 
            className="bg-amber-500 text-white px-4 py-2 rounded hover:bg-amber-600"
          >
            Execute Query
          </button>
        </form>
      </div>
      
      {/* Part C: Safe SELECT form */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h3 className="text-xl font-semibold mb-4">Part C: Safe SELECT Query (Using Prepared Statement)</h3>
        <p className="mb-4 text-gray-700">
          This form uses prepared statements to prevent SQL injection. Try entering the same SQL code as in Part A.
        </p>
        
        <form onSubmit={handleSafeSelect} className="mb-4">
          <div className="mb-4">
            <label htmlFor="safe-query" className="block text-gray-700 mb-2">SQL Injection Attempt:</label>
            <textarea
              id="safe-query"
              value={selectQuery}
              onChange={(e) => setSelectQuery(e.target.value)}
              className="w-full p-2 border rounded font-mono"
              placeholder="Enter the same SQL injection code as Part A"
              rows={4}
            />
          </div>
          <button 
            type="submit" 
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            Execute Protected Query
          </button>
        </form>
      </div>
      
      {/* Results display */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p><strong>Error:</strong> {error}</p>
        </div>
      )}
      
      {executedQuery && (
        <div className="bg-gray-100 p-4 rounded-lg mb-4">
          <h4 className="font-semibold mb-2">Executed Query:</h4>
          <pre className="bg-gray-800 text-white p-3 rounded overflow-x-auto font-mono">{executedQuery}</pre>
        </div>
      )}
      
      {updateResult && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          <h4 className="font-semibold mb-2">Update Result:</h4>
          <p>Message: {updateResult.message}</p>
          <p>Rows affected: {updateResult.rowsAffected}</p>
          {updateResult.query && (
            <pre className="bg-gray-800 text-white p-3 rounded overflow-x-auto mt-2 font-mono">
              {updateResult.query}
            </pre>
          )}
        </div>
      )}
      
      {results.length > 0 && (
        <div className="overflow-x-auto">
          <h4 className="font-semibold mb-2">Results:</h4>
          <table className="min-w-full bg-white border">
            <thead>
              <tr>
                {Object.keys(results[0]).map((key) => (
                  <th key={key} className="border px-4 py-2 bg-gray-100">{key}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((row, i) => (
                <tr key={i}>
                  {Object.values(row).map((value: any, j) => (
                    <td key={j} className="border px-4 py-2">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SqlInjectionDemo; 