import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { getDeliveryById } from '../../services/API';
// Removed DeliveryMap import

const DeliveryDetails = () => {
  const { id } = useParams();
  const [delivery, setDelivery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Removed agentPosition state
  // Removed trackingActive state
  const refreshIntervalRef = useRef(null);

  useEffect(() => {
    fetchDeliveryDetails();
    
    // Set up periodic refresh for delivery status only when needed
    refreshIntervalRef.current = setInterval(() => {
      if (delivery && delivery.status === 'in_transit') {
        fetchDeliveryDetails();
      }
    }, 30000); // Refresh every 30 seconds
    
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [id]);

  useEffect(() => {
    // Clear and reset interval when delivery status changes
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }
    
    // Only set up interval if delivery is in transit
    if (delivery && delivery.status === 'in_transit') {
      refreshIntervalRef.current = setInterval(() => {
        fetchDeliveryDetails();
      }, 30000); // Refresh every 30 seconds
    }
    
    // Cleanup
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [delivery]);

  // Removed useEffect for agent position tracking

  const fetchDeliveryDetails = async () => {
    try {
      setLoading(true);
      console.log('Fetching delivery details for ID:', id);
      const response = await getDeliveryById(id);
      console.log('Delivery details response:', response);
      
      // Check if response is an error object
      if (response.isAxiosError) {
        throw new Error(response.message || 'Failed to fetch delivery details');
      }
      
      // Check if response has data
      if (!response.data) {
        throw new Error('No data received from server');
      }
      
      setDelivery(response.data);
      
      // Removed tracking activation logic
    } catch (err) {
      console.error('Error fetching delivery details:', err);
      setError('Failed to fetch delivery details: ' + err.message);
    } finally {
      setLoading(false);
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

  // Check if delivery is completed (delivered or cancelled)
  const isDeliveryCompleted = delivery?.status === 'delivered' || delivery?.status === 'cancelled';

  // Removed toggleTracking function

  if (loading && !delivery) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Delivery Details</h3>
        </div>
        <div className="px-4 py-5 sm:px-6">
          <div className="rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-700">
              {error}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!delivery) {
    return (
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Delivery Details</h3>
        </div>
        <div className="px-4 py-5 sm:px-6">
          <p>Delivery not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
        <h3 className="text-lg leading-6 font-medium text-gray-900">Delivery Details</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          Detailed information about your delivery
        </p>
      </div>
      <div className="px-4 py-5 sm:px-6">
        {isDeliveryCompleted && (
          <div className="rounded-md bg-yellow-50 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Delivery Completed
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>
                    This delivery is already {delivery.status} and cannot be modified.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
          <div>
            <h4 className="text-md font-medium text-gray-900 mb-3">Delivery Information</h4>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Delivery ID</dt>
                <dd className="mt-1 text-sm text-gray-900">{delivery._id}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd className="mt-1 text-sm text-gray-900">{getStatusBadge(delivery.status)}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Price</dt>
                <dd className="mt-1 text-sm text-gray-900">${delivery.price?.toFixed(2)}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Created</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(delivery.createdAt).toLocaleString()}
                </dd>
              </div>
            </dl>
          </div>
          
          <div>
            <h4 className="text-md font-medium text-gray-900 mb-3">Package Details</h4>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Weight</dt>
                <dd className="mt-1 text-sm text-gray-900">{delivery.packageDetails?.weightKg || 'N/A'} kg</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Size</dt>
                <dd className="mt-1 text-sm text-gray-900">{delivery.packageDetails?.size || 'N/A'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Description</dt>
                <dd className="mt-1 text-sm text-gray-900">{delivery.packageDetails?.description || 'N/A'}</dd>
              </div>
            </dl>
          </div>
          
          <div>
            <h4 className="text-md font-medium text-gray-900 mb-3">Pickup Location</h4>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Address</dt>
                <dd className="mt-1 text-sm text-gray-900">{delivery.pickupLocation?.address || 'N/A'}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Coordinates</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {delivery.pickupLocation?.lat?.toFixed(6)}, {delivery.pickupLocation?.lng?.toFixed(6)}
                </dd>
              </div>
            </dl>
          </div>
          
          <div>
            <h4 className="text-md font-medium text-gray-900 mb-3">Dropoff Location</h4>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Address</dt>
                <dd className="mt-1 text-sm text-gray-900">{delivery.dropoffLocation?.address || 'N/A'}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-gray-500">Coordinates</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {delivery.dropoffLocation?.lat?.toFixed(6)}, {delivery.dropoffLocation?.lng?.toFixed(6)}
                </dd>
              </div>
            </dl>
          </div>
        </div>
        
        {/* Removed Map Section */}
        
        {/* Removed Tracking Toggle Button */}
      </div>
    </div>
  );
};

export default DeliveryDetails;