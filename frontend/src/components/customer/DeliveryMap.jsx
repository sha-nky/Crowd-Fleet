import React, { useState, useEffect, useRef } from 'react';
import { loadGoogleMaps, createAdvancedMarker } from '../../services/GoogleMapsService';
import { getOptimizedRoute } from '../../services/MicroserviceAPI';

const DeliveryMap = ({ delivery, agentPosition, trackingActive }) => {
  const mapRef = useRef(null);
  const googleMapRef = useRef(null);
  const markersRef = useRef([]);
  const polylinesRef = useRef([]);
  const agentMarkerRef = useRef(null);
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (delivery && delivery.pickupLocation && delivery.dropoffLocation) {
      initMap();
    }
  }, [delivery]);

  useEffect(() => {
    if (googleMapRef.current && delivery && trackingActive) {
      updateRoute();
    }
  }, [delivery, agentPosition, trackingActive]);

  useEffect(() => {
    if (agentPosition && googleMapRef.current && trackingActive) {
      updateAgentMarker();
    }
  }, [agentPosition, trackingActive]);

  const initMap = async () => {
    try {
      // Load Google Maps API
      await loadGoogleMaps();

      if (!window.google || !window.google.maps) {
        throw new Error('Google Maps API not loaded');
      }

      // Initialize map with custom styling
      const map = new window.google.maps.Map(mapRef.current, {
        zoom: 12,
        center: {
          lat: delivery.pickupLocation.lat,
          lng: delivery.pickupLocation.lng
        },
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

      // Clear existing markers and polylines
      markersRef.current.forEach(marker => marker.setMap(null));
      markersRef.current = [];
      polylinesRef.current.forEach(polyline => polyline.setMap(null));
      polylinesRef.current = [];

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
      }

      // Fit map to show all markers
      if (markersRef.current.length > 0) {
        const bounds = new window.google.maps.LatLngBounds();
        markersRef.current.forEach(marker => {
          if (marker.getPosition) {
            bounds.extend(marker.getPosition());
          }
        });
        map.fitBounds(bounds);
      }
    } catch (err) {
      console.error('Error initializing map:', err);
      setError('Failed to initialize map: ' + err.message);
    }
  };

  const updateRoute = async () => {
    if (!trackingActive || !agentPosition) return;

    try {
      setLoading(true);
      
      // Get optimized route from agent's current position to delivery dropoff
      const routeData = await getOptimizedRoute(
        agentPosition,
        { lat: delivery.dropoffLocation.lat, lng: delivery.dropoffLocation.lng },
        [] // No risk alerts for customer view
      );

      if (routeData.routes && routeData.routes.primary) {
        setRoute(routeData.routes.primary);
        renderRoute(routeData.routes.primary);
      } else if (routeData.route) {
        setRoute(routeData.route);
        renderRoute(routeData.route);
      }
    } catch (err) {
      console.error('Error updating route:', err);
      setError('Failed to update route: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderRoute = (routeData) => {
    // Clear existing route polylines
    polylinesRef.current.forEach(polyline => polyline.setMap(null));
    polylinesRef.current = [];

    // Check if we have proper route points
    let routePath = [];
    if (routeData.route_points && routeData.route_points.length > 0) {
      routePath = routeData.route_points.map(point => ({
        lat: point.lat,
        lng: point.lng
      }));
    } else if (routeData.overview_polyline) {
      // In a real implementation, you would decode the polyline here
      // For now, we'll create a straight line
      routePath = [
        agentPosition,
        { lat: delivery.dropoffLocation.lat, lng: delivery.dropoffLocation.lng }
      ];
    } else {
      // Fallback to straight line
      routePath = [
        agentPosition,
        { lat: delivery.dropoffLocation.lat, lng: delivery.dropoffLocation.lng }
      ];
    }

    if (routePath.length === 0) return;

    // Create route visualization
    const basePolyline = new window.google.maps.Polyline({
      path: routePath,
      geodesic: true,
      strokeColor: '#3b82f6', // Blue
      strokeOpacity: 0.3,
      strokeWeight: 12
    });

    const mainPolyline = new window.google.maps.Polyline({
      path: routePath,
      geodesic: true,
      strokeColor: '#3b82f6', // Blue
      strokeOpacity: 0.8,
      strokeWeight: 6
    });

    basePolyline.setMap(googleMapRef.current);
    mainPolyline.setMap(googleMapRef.current);

    polylinesRef.current.push(basePolyline);
    polylinesRef.current.push(mainPolyline);

    // Fit map to show the route
    if (routePath.length > 0 && googleMapRef.current) {
      const bounds = new window.google.maps.LatLngBounds();
      routePath.forEach(point => {
        bounds.extend(new window.google.maps.LatLng(point.lat, point.lng));
      });
      googleMapRef.current.fitBounds(bounds);
    }
  };

  const updateAgentMarker = () => {
    if (!trackingActive) return;

    if (!agentMarkerRef.current) {
      // Create agent marker with custom styling
      agentMarkerRef.current = createAdvancedMarker(googleMapRef.current, agentPosition, {
        title: 'Agent Location',
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#3b82f6', // Blue color
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2
        }
      });
    } else {
      // Update existing agent marker position
      if (agentMarkerRef.current.setPosition) {
        agentMarkerRef.current.setPosition(agentPosition);
      }
    }
  };

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <h4 className="text-md font-medium text-gray-900 mb-3">Delivery Map</h4>
      <div className="bg-gray-100 rounded-lg overflow-hidden">
        <div 
          ref={mapRef}
          className="w-full h-80 rounded-lg"
          style={{ minHeight: '320px' }}
        />
      </div>
      {trackingActive && (
        <div className="mt-2 text-sm text-gray-500">
          <p>Agent location is being tracked in real-time</p>
        </div>
      )}
      {!trackingActive && (
        <div className="mt-2 text-sm text-gray-500">
          <p>Agent location will be shown when tracking starts</p>
        </div>
      )}
    </div>
  );
};

export default DeliveryMap;