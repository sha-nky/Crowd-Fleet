import React, { useState, useEffect } from 'react';
import { getAllRiskAlerts, createRiskAlert } from '../../services/API';

const RiskAlerts = () => {
  const [riskAlerts, setRiskAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newRiskAlert, setNewRiskAlert] = useState({
    type: '',
    severity: 'medium',
    description: '',
    location: { lat: '', lng: '' }
  });

  useEffect(() => {
    fetchRiskAlerts();
  }, []);

  const fetchRiskAlerts = async () => {
    try {
      const response = await getAllRiskAlerts();
      setRiskAlerts(response.data);
    } catch (err) {
      setError('Failed to fetch risk alerts');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRiskAlert = async (e) => {
    e.preventDefault();
    try {
      const riskData = {
        ...newRiskAlert,
        location: {
          lat: parseFloat(newRiskAlert.location.lat),
          lng: parseFloat(newRiskAlert.location.lng)
        }
      };
      await createRiskAlert(riskData);
      fetchRiskAlerts(); // Refresh the list
      setShowCreateForm(false);
      setNewRiskAlert({
        type: '',
        severity: 'medium',
        description: '',
        location: { lat: '', lng: '' }
      });
    } catch (err) {
      setError('Failed to create risk alert');
      console.error(err);
    }
  };

  const getSeverityBadge = (severity) => {
    const severityClasses = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-red-100 text-red-800'
    };

    return (
      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${severityClasses[severity] || 'bg-gray-100 text-gray-800'}`}>
        {severity}
      </span>
    );
  };

  const getTypeBadge = (type) => {
    const typeClasses = {
      traffic: 'bg-blue-100 text-blue-800',
      weather: 'bg-indigo-100 text-indigo-800',
      accident: 'bg-red-100 text-red-800',
      construction: 'bg-purple-100 text-purple-800',
      other: 'bg-gray-100 text-gray-800'
    };

    return (
      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${typeClasses[type] || 'bg-gray-100 text-gray-800'}`}>
        {type}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900">Risk Alerts</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Manage risk alerts in the system
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {showCreateForm ? 'Cancel' : 'Create Risk Alert'}
          </button>
        </div>
      </div>
      <div className="px-4 py-5 sm:px-6">
        {error && (
          <div className="rounded-md bg-red-50 p-4 mb-4">
            <div className="text-sm text-red-700">
              {error}
            </div>
          </div>
        )}
        
        {showCreateForm && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h4 className="text-md font-medium text-gray-900 mb-3">Create New Risk Alert</h4>
            <form onSubmit={handleCreateRiskAlert}>
              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Type</label>
                  <select
                    value={newRiskAlert.type}
                    onChange={(e) => setNewRiskAlert({...newRiskAlert, type: e.target.value})}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    required
                  >
                    <option value="">Select type</option>
                    <option value="traffic">Traffic</option>
                    <option value="weather">Weather</option>
                    <option value="accident">Accident</option>
                    <option value="construction">Construction</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Severity</label>
                  <select
                    value={newRiskAlert.severity}
                    onChange={(e) => setNewRiskAlert({...newRiskAlert, severity: e.target.value})}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    value={newRiskAlert.description}
                    onChange={(e) => setNewRiskAlert({...newRiskAlert, description: e.target.value})}
                    rows={3}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={newRiskAlert.location.lat}
                    onChange={(e) => setNewRiskAlert({
                      ...newRiskAlert, 
                      location: {...newRiskAlert.location, lat: e.target.value}
                    })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={newRiskAlert.location.lng}
                    onChange={(e) => setNewRiskAlert({
                      ...newRiskAlert, 
                      location: {...newRiskAlert.location, lng: e.target.value}
                    })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    required
                  />
                </div>
              </div>
              <div className="mt-4">
                <button
                  type="submit"
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Create Risk Alert
                </button>
              </div>
            </form>
          </div>
        )}
        
        <div className="flex flex-col">
          <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
              <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ID
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Severity
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Location
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {riskAlerts.map((alert) => (
                      <tr key={alert._id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {alert._id?.substring(0, 8) || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {getTypeBadge(alert.type)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {getSeverityBadge(alert.severity)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {alert.description?.substring(0, 50) || 'N/A'}
                          {alert.description?.length > 50 ? '...' : ''}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {alert.location?.lat?.toFixed(4)}, {alert.location?.lng?.toFixed(4)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {alert.createdAt ? new Date(alert.createdAt).toLocaleDateString() : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RiskAlerts;