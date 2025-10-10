import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom'; // Import Link from react-router-dom
import { getAvailableDeliveries, getAgentDeliveries, assignDelivery } from '../../services/API';

const AgentDashboard = () => {
  const location = useLocation();
  const [availableDeliveries, setAvailableDeliveries] = useState([]);
  const [myDeliveries, setMyDeliveries] = useState([]);
  const [activeTab, setActiveTab] = useState('available');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [agentPosition, setAgentPosition] = useState(null);

  useEffect(() => {
    // Set default tab based on the route
    if (location.pathname === '/agent/deliveries') {
      setActiveTab('my');
    }
    
    fetchDeliveries();
    
    // Set up periodic refresh every 30 seconds
    const interval = setInterval(() => {
      fetchDeliveries();
    }, 30000);
    
    // Start watching agent position
    startWatchingAgentPosition();
    
    // Clean up interval and position watching on component unmount
    return () => {
      clearInterval(interval);
      stopWatchingAgentPosition();
    };
  }, [location.pathname]);

  const startWatchingAgentPosition = () => {
    if (navigator.geolocation) {
      // Get position immediately
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setAgentPosition({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error('Error getting position:', error);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 10000,
          timeout: 5000
        }
      );
      
      // Watch position for updates
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setAgentPosition({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error('Error watching position:', error);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 10000,
          timeout: 5000
        }
      );
      
      // Store watch ID for cleanup
      window.agentWatchId = watchId;
    }
  };

  const stopWatchingAgentPosition = () => {
    if (window.agentWatchId && navigator.geolocation) {
      navigator.geolocation.clearWatch(window.agentWatchId);
      window.agentWatchId = null;
    }
  };

  // Calculate distance between two points in meters using Haversine formula
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c;
  };

  const fetchDeliveries = async () => {
    try {
      const [availableResponse, myDeliveriesResponse] = await Promise.all([
        getAvailableDeliveries(),
        getAgentDeliveries()
      ]);
      
      setAvailableDeliveries(availableResponse.data);
      setMyDeliveries(myDeliveriesResponse.data);
    } catch (err) {
      setError('Failed to fetch deliveries');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Add a function to refresh deliveries
  const refreshDeliveries = () => {
    setLoading(true);
    fetchDeliveries();
  };

  const handleAssignDelivery = async (deliveryId) => {
    try {
      console.log('Assigning delivery:', deliveryId);
      const response = await assignDelivery(deliveryId);
      console.log('Assign delivery response:', response);
      
      if (response.status === 200) {
        // Refresh the deliveries
        fetchDeliveries();
      } else {
        setError('Failed to assign delivery');
      }
    } catch (err) {
      console.error('Error assigning delivery:', err);
      setError('Failed to assign delivery');
    }
  };

  const getStatusBadge = (status) => {
    const statusClasses = {
      pending: 'bg-yellow-100 text-yellow-800',
      assigned: 'bg-blue-100 text-blue-800',
      in_transit: 'bg-indigo-100 text-indigo-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };

    return (
      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClasses[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.replace('_', ' ')}
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
            <h3 className="text-lg leading-6 font-medium text-gray-900">Agent Dashboard</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Manage your deliveries and available requests
            </p>
          </div>
          <button
            onClick={refreshDeliveries}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="-ml-0.5 mr-2 h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
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
        
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('available')}
              className={`${
                activeTab === 'available'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Available Deliveries
              {availableDeliveries.length > 0 && (
                <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {availableDeliveries.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('my')}
              className={`${
                activeTab === 'my'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              My Deliveries
            </button>
          </nav>
        </div>
        
        <div className="mt-6">
          {activeTab === 'available' && (
            <div>
              {availableDeliveries.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No available deliveries</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Check back later for new delivery requests.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col">
                  <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                    <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
                      <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Delivery ID
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Pickup
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Dropoff
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Price
                              </th>
                              <th scope="col" className="relative px-6 py-3">
                                <span className="sr-only">Actions</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {availableDeliveries.map((delivery) => (
                              <tr key={delivery._id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {delivery._id.substring(0, 8)}...
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {delivery.pickupLocation?.address || 'N/A'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {delivery.dropoffLocation?.address || 'N/A'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  ${delivery.price?.toFixed(2) || 'N/A'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                  <button
                                    onClick={() => handleAssignDelivery(delivery._id)}
                                    className="text-blue-600 hover:text-blue-900"
                                  >
                                    Accept
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'my' && (
            <div>
              {myDeliveries.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No assigned deliveries</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Accept available deliveries to get started.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col">
                  <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                    <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
                      <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Delivery ID
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Pickup
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Dropoff
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Price
                              </th>
                              {agentPosition && (
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Distance
                                </th>
                              )}
                              <th scope="col" className="relative px-6 py-3">
                                <span className="sr-only">Actions</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {myDeliveries.map((delivery) => (
                              <tr key={delivery._id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {delivery._id.substring(0, 8)}...
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {delivery.pickupLocation?.address || 'N/A'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {delivery.dropoffLocation?.address || 'N/A'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {getStatusBadge(delivery.status)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  ${delivery.price?.toFixed(2) || 'N/A'}
                                </td>
                                {agentPosition && delivery.dropoffLocation?.lat && delivery.dropoffLocation?.lng && (
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {Math.round(calculateDistance(
                                      agentPosition.lat, agentPosition.lng,
                                      delivery.dropoffLocation.lat, delivery.dropoffLocation.lng
                                    ))}m
                                  </td>
                                )}
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                  {/* Replace the <a> tag with Link component */}
                                  <Link to={`/agent/deliveries/${delivery._id}`} className="text-blue-600 hover:text-blue-900">
                                    View
                                  </Link>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentDashboard;