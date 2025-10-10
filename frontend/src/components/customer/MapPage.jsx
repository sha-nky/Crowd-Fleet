import React, { useState, useEffect, useRef } from 'react';
import { getCustomerDeliveries } from '../../services/API';
import { loadGoogleMaps, createAdvancedMarker } from '../../services/GoogleMapsService';

const MapPage = () => {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [agentPositions, setAgentPositions] = useState({}); // Track agent positions
  const mapRef = useRef(null);
  const googleMapRef = useRef(null);
  const markersRef = useRef([]);
  const agentMarkersRef = useRef({}); // Track agent markers
  const positionUpdateIntervalRef = useRef(null);

  useEffect(() => {
    fetchDeliveries();
    
    // Set up periodic position updates
    positionUpdateIntervalRef.current = setInterval(() => {
      updateAgentPositions();
    }, 30000); // Update every 30 seconds
    
    return () => {
      // Clean up interval on component unmount
      if (positionUpdateIntervalRef.current) {
        clearInterval(positionUpdateIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (deliveries.length > 0 && !loading) {
      initMap();
    }
  }, [deliveries, loading]);

  useEffect(() => {
    // Update agent markers when positions change
    if (googleMapRef.current && Object.keys(agentPositions).length > 0) {
      updateAgentMarkers();
    }
  }, [agentPositions]);

  const fetchDeliveries = async () => {
    try {
      setLoading(true);
      const response = await getCustomerDeliveries();
      
      if (response.data) {
        // Filter for active deliveries (not delivered or cancelled)
        const activeDeliveries = response.data.filter(
          delivery => delivery.status !== 'delivered' && delivery.status !== 'cancelled'
        );
        setDeliveries(activeDeliveries);
      }
    } catch (err) {
      console.error('Error fetching deliveries:', err);
      setError('Failed to load deliveries: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateAgentPositions = async () => {
    // In a real implementation, this would fetch agent positions from the backend
    // For now, we'll simulate agent positions for active deliveries
    const newAgentPositions = {};
    
    deliveries.forEach(delivery => {
      if (delivery.status === 'in_transit' && delivery.agentId) {
        // Simulate agent position moving towards dropoff
        if (delivery.dropoffLocation?.lat && delivery.dropoffLocation?.lng) {
          // This is just a simulation - in a real app, you would get actual agent positions
          newAgentPositions[delivery.agentId] = {
            lat: delivery.dropoffLocation.lat + (Math.random() - 0.5) * 0.01,
            lng: delivery.dropoffLocation.lng + (Math.random() - 0.5) * 0.01
          };
        }
      }
    });
    
    setAgentPositions(newAgentPositions);
  };

  const updateAgentMarkers = () => {
    // Remove existing agent markers
    Object.values(agentMarkersRef.current).forEach(marker => {
      if (marker.setMap) {
        marker.setMap(null);
      }
    });
    agentMarkersRef.current = {};
    
    // Add new agent markers
    Object.entries(agentPositions).forEach(([agentId, position]) => {
      if (position.lat && position.lng) {
        const agentMarker = createAdvancedMarker(googleMapRef.current, position, {
          title: `Agent ${agentId}`,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: '#3b82f6', // Blue color
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2
          }
        });
        
        agentMarkersRef.current[agentId] = agentMarker;
        markersRef.current.push(agentMarker);
      }
    });
  };

  const initMap = async () => {
    try {
      // Load Google Maps API
      await loadGoogleMaps();

      if (!window.google || !window.google.maps) {
        throw new Error('Google Maps API not loaded');
      }

      // Initialize map
      const map = new window.google.maps.Map(mapRef.current, {
        zoom: 10,
        center: { lat: 13.0827, lng: 80.2707 }, // Chennai as default center
        styles: [
          {
            "featureType": "all",
            "elementType": "geometry.fill",
            "stylers": [{"weight": "2.00"}]
          },
          {
            "featureType": "all",
            "elementType": "geometry.stroke",
            "stylers": [{"color": "#9c9c9c"}]
          },
          {
            "featureType": "all",
            "elementType": "labels.text",
            "stylers": [{"visibility": "on"}]
          },
          {
            "featureType": "landscape",
            "elementType": "all",
            "stylers": [{"color": "#f2f2f2"}]
          },
          {
            "featureType": "landscape",
            "elementType": "geometry.fill",
            "stylers": [{"color": "#ffffff"}]
          },
          {
            "featureType": "landscape.man_made",
            "elementType": "geometry.fill",
            "stylers": [{"color": "#ffffff"}]
          },
          {
            "featureType": "poi",
            "elementType": "all",
            "stylers": [{"visibility": "off"}]
          },
          {
            "featureType": "road",
            "elementType": "all",
            "stylers": [{"saturation": -100},{"lightness": 45},{"visibility": "on"}]
          },
          {
            "featureType": "road",
            "elementType": "geometry.fill",
            "stylers": [{"color": "#eeeeee"}]
          },
          {
            "featureType": "road",
            "elementType": "labels.text.fill",
            "stylers": [{"color": "#7b7b7b"}]
          },
          {
            "featureType": "road",
            "elementType": "labels.text.stroke",
            "stylers": [{"color": "#ffffff"}]
          },
          {
            "featureType": "road.highway",
            "elementType": "all",
            "stylers": [{"visibility": "simplified"}]
          },
          {
            "featureType": "road.arterial",
            "elementType": "labels.icon",
            "stylers": [{"visibility": "off"}]
          },
          {
            "featureType": "transit",
            "elementType": "all",
            "stylers": [{"visibility": "off"}]
          },
          {
            "featureType": "water",
            "elementType": "all",
            "stylers": [{"color": "#46bcec"},{"visibility": "on"}]
          },
          {
            "featureType": "water",
            "elementType": "geometry.fill",
            "stylers": [{"color": "#c8d7d4"}]
          },
          {
            "featureType": "water",
            "elementType": "labels.text.fill",
            "stylers": [{"color": "#070707"}]
          },
          {
            "featureType": "water",
            "elementType": "labels.text.stroke",
            "stylers": [{"color": "#ffffff"}]
          }
        ]
      });

      googleMapRef.current = map;

      // Clear existing markers
      markersRef.current.forEach(marker => marker.setMap(null));
      markersRef.current = [];

      // Add markers for each delivery
      const bounds = new window.google.maps.LatLngBounds();
      let hasLocations = false;

      deliveries.forEach(delivery => {
        // Add pickup marker
        if (delivery.pickupLocation?.lat && delivery.pickupLocation?.lng) {
          const pickupMarker = createAdvancedMarker(map, 
            { lat: delivery.pickupLocation.lat, lng: delivery.pickupLocation.lng },
            {
              title: `Pickup: ${delivery.pickupLocation.address}`,
              icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: '#10b981', // Green for pickup
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2
              }
            }
          );
          markersRef.current.push(pickupMarker);
          bounds.extend(new window.google.maps.LatLng(
            delivery.pickupLocation.lat, 
            delivery.pickupLocation.lng
          ));
          hasLocations = true;
        }

        // Add dropoff marker
        if (delivery.dropoffLocation?.lat && delivery.dropoffLocation?.lng) {
          const dropoffMarker = createAdvancedMarker(map,
            { lat: delivery.dropoffLocation.lat, lng: delivery.dropoffLocation.lng },
            {
              title: `Dropoff: ${delivery.dropoffLocation.address}`,
              icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: '#ef4444', // Red for dropoff
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2
              }
            }
          );
          markersRef.current.push(dropoffMarker);
          bounds.extend(new window.google.maps.LatLng(
            delivery.dropoffLocation.lat, 
            delivery.dropoffLocation.lng
          ));
          hasLocations = true;
        }
      });

      // Fit map to show all markers
      if (hasLocations) {
        map.fitBounds(bounds);
      }
    } catch (err) {
      console.error('Error initializing map:', err);
      setError('Failed to initialize map: ' + err.message);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'assigned': return 'bg-blue-500';
      case 'in_transit': return 'bg-indigo-500';
      case 'delivered': return 'bg-green-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
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
          <h3 className="text-lg leading-6 font-medium text-gray-900">Delivery Map</h3>
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

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
        <h3 className="text-lg leading-6 font-medium text-gray-900">My Deliveries Map</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          View all your active deliveries on the map
        </p>
      </div>
      <div className="px-4 py-5 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div 
              ref={mapRef}
              className="w-full h-96 rounded-xl"
              style={{ minHeight: '400px' }}
            />
          </div>
          <div className="lg:col-span-1">
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {deliveries.map((delivery) => (
                  <li key={delivery._id}>
                    <div className="block hover:bg-gray-50">
                      <div className="px-4 py-4 sm:px-6">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-blue-600 truncate">
                            Delivery #{delivery._id?.substring(0, 8)}
                          </p>
                          <div className="ml-2 flex-shrink-0 flex">
                            <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(delivery.status)} text-white`}>
                              {delivery.status.replace('_', ' ')}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 sm:flex sm:justify-between">
                          <div className="sm:flex">
                            <p className="flex items-center text-sm text-gray-500">
                              <svg className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {delivery.pickupLocation?.address?.substring(0, 30) || 'N/A'}...
                            </p>
                          </div>
                          <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                            <svg className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                            {delivery.dropoffLocation?.address?.substring(0, 30) || 'N/A'}...
                          </div>
                        </div>
                        <div className="mt-2">
                          <p className="text-sm text-gray-500">
                            Price: ${delivery.price?.toFixed(2)}
                          </p>
                        </div>
                        {delivery.status === 'in_transit' && delivery.agentId && agentPositions[delivery.agentId] && (
                          <div className="mt-2 text-xs text-gray-500">
                            Agent Location: {agentPositions[delivery.agentId].lat.toFixed(6)}, {agentPositions[delivery.agentId].lng.toFixed(6)}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
                {deliveries.length === 0 && (
                  <li>
                    <div className="px-4 py-4 sm:px-6">
                      <p className="text-sm text-gray-500 text-center">
                        No active deliveries found
                      </p>
                    </div>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapPage;