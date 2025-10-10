import React, { useState, useEffect, useRef } from 'react';
import { loadGoogleMaps, createAdvancedMarker } from '../../services/GoogleMapsService';
import { getOptimizedRoute, detectRisks } from '../../services/MicroserviceAPI';

const OptimizedRouteMap = ({ delivery, agentPosition, className = "w-full h-80 rounded-lg border border-gray-200" }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeRoute, setActiveRoute] = useState(null);
  const mapRef = useRef(null);
  const googleMapRef = useRef(null);
  const markersRef = useRef([]);
  const polylinesRef = useRef([]);
  const progressIntervalRef = useRef(null);

  useEffect(() => {
    if (delivery && mapRef.current) {
      // Initialize map only if it hasn't been initialized yet
      if (!googleMapRef.current) {
        initMap();
      } else {
        // If map already exists, just update the markers
        updateMarkers();
      }
    }
    
    return () => {
      // Clean up intervals
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [delivery, mapRef.current]);

  useEffect(() => {
    // When delivery or agent position changes, update the route
    if (delivery && agentPosition && googleMapRef.current) {
      updateRouteToDelivery();
    }
    
    // Update agent marker when agent position changes
    if (agentPosition && googleMapRef.current) {
      updateAgentMarker();
    }
  }, [delivery, agentPosition]);

  const updateRouteToDelivery = async () => {
    console.log('updateRouteToDelivery called with:', { agentPosition, delivery });
    
    if (!agentPosition || !delivery.dropoffLocation?.lat || !delivery.dropoffLocation?.lng) {
        console.log('Missing required data for route update:', { 
            agentPosition, 
            dropoffLat: delivery?.dropoffLocation?.lat, 
            dropoffLng: delivery?.dropoffLocation?.lng 
        });
        return;
    }
    
    setLoading(true);
    setError('');
    
    try {
        // Detect risks in the area
        console.log('Calling detectRisks with agent position:', agentPosition);
        const riskData = await detectRisks(agentPosition, 5); // 5km radius
        console.log('Risk detection response received:', riskData);
        
        const riskAlerts = riskData.risks || [];
        console.log('Extracted risk alerts:', riskAlerts);
        
        console.log('Calling getOptimizedRoute with:', {
            startLocation: agentPosition,
            endLocation: { lat: delivery.dropoffLocation.lat, lng: delivery.dropoffLocation.lng },
            riskAlerts
        });
        
        // Get optimized route from agent's current position to delivery dropoff
        const routeData = await getOptimizedRoute(
            agentPosition,
            { lat: delivery.dropoffLocation.lat, lng: delivery.dropoffLocation.lng },
            riskAlerts
        );
        
        console.log('Route data received:', routeData);
        
        if (routeData.routes && routeData.routes.primary) {
            setActiveRoute(routeData.routes.primary);
            renderRoute(routeData.routes.primary);
        } else {
            throw new Error('No route data received');
        }
    } catch (err) {
        console.error('Error updating route:', err);
        setError('Failed to load optimized route: ' + err.message);
        // Render fallback route
        renderFallbackRoute();
    } finally {
        setLoading(false);
    }
  };

  const initMap = async () => {
    try {
      // Load Google Maps API
      await loadGoogleMaps();
      
      if (!window.google || !window.google.maps) {
        throw new Error('Google Maps API not loaded');
      }
      
      // Initialize map only if it doesn't exist
      if (!googleMapRef.current) {
        const map = new window.google.maps.Map(mapRef.current, {
          zoom: 12,
          center: agentPosition || { 
            lat: delivery.pickupLocation?.lat || 40.7128, 
            lng: delivery.pickupLocation?.lng || -74.0060 
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
      }
      
      // Add markers
      addMarkers();
    } catch (err) {
      console.error('Error initializing map:', err);
      setError('Failed to initialize map: ' + err.message);
    }
  };

  const updateMarkers = () => {
    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];
    
    // Add new markers
    addMarkers();
  };

  const addMarkers = () => {
    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];
    
    if (!googleMapRef.current) return;
    
    // Add pickup marker
    if (delivery.pickupLocation?.lat && delivery.pickupLocation?.lng) {
      const pickupMarker = createAdvancedMarker(googleMapRef.current, 
        { lat: delivery.pickupLocation.lat, lng: delivery.pickupLocation.lng },
        {
          title: `Pickup: ${delivery.pickupLocation.address || 'N/A'}`,
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
      const dropoffMarker = createAdvancedMarker(googleMapRef.current,
        { lat: delivery.dropoffLocation.lat, lng: delivery.dropoffLocation.lng },
        {
          title: `Dropoff: ${delivery.dropoffLocation.address || 'N/A'}`,
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
    
    // Add agent marker if position is available
    if (agentPosition) {
      const agentMarker = createAdvancedMarker(googleMapRef.current, agentPosition, {
        title: 'Your Location',
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#3b82f6', // Blue color
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2
        }
      });
      
      markersRef.current.push(agentMarker);
    }
  };

  const updateAgentMarker = () => {
    // Find and update the agent marker
    const agentMarker = markersRef.current.find(marker => 
      marker.getTitle && marker.getTitle() === 'Your Location'
    );
    
    if (agentMarker && agentPosition) {
      // Update existing agent marker position
      if (agentMarker.setPosition) {
        agentMarker.setPosition(agentPosition);
      }
    } else if (agentPosition && googleMapRef.current) {
      // Create new agent marker if it doesn't exist
      const agentMarker = createAdvancedMarker(googleMapRef.current, agentPosition, {
        title: 'Your Location',
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#3b82f6', // Blue color
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2
        }
      });
      
      markersRef.current.push(agentMarker);
    }
  };

  const renderRoute = (route) => {
    // Clear existing route polylines
    polylinesRef.current.forEach(polyline => polyline.setMap(null));
    polylinesRef.current = [];
    
    // Clear any existing progress animation
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    
    // Check if we have proper route points
    let routePath = [];
    if (route.route_points && route.route_points.length > 0) {
      routePath = route.route_points.map(point => ({
        lat: point.lat,
        lng: point.lng
      }));
    } else {
      // Fallback to straight line
      renderFallbackRoute();
      return;
    }
    
    if (routePath.length === 0) {
      renderFallbackRoute();
      return;
    }
    
    // Create route visualization
    const basePolyline = new window.google.maps.Polyline({
      path: routePath,
      geodesic: true,
      strokeColor: getRouteColor(delivery.status),
      strokeOpacity: 0.3,
      strokeWeight: 12
    });
    
    const mainPolyline = new window.google.maps.Polyline({
      path: routePath,
      geodesic: true,
      strokeColor: getRouteColor(delivery.status),
      strokeOpacity: 0.8,
      strokeWeight: 6,
      icons: [{
        icon: {
          path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 2,
          strokeColor: '#ffffff',
          strokeOpacity: 0.8
        },
        offset: '100%',
        repeat: '100px'
      }]
    });
    
    const glowPolyline = new window.google.maps.Polyline({
      path: routePath,
      geodesic: true,
      strokeColor: getRouteColor(delivery.status),
      strokeOpacity: 0.2,
      strokeWeight: 20
    });
    
    basePolyline.setMap(googleMapRef.current);
    mainPolyline.setMap(googleMapRef.current);
    glowPolyline.setMap(googleMapRef.current);
    
    polylinesRef.current.push(basePolyline);
    polylinesRef.current.push(mainPolyline);
    polylinesRef.current.push(glowPolyline);
    
    // Add animated progress indicator
    animateRouteProgress(routePath);
    
    // Fit map to show the route
    if (routePath.length > 0 && googleMapRef.current) {
      const bounds = new window.google.maps.LatLngBounds();
      routePath.forEach(point => {
        bounds.extend(new window.google.maps.LatLng(point.lat, point.lng));
      });
      googleMapRef.current.fitBounds(bounds);
    }
  };

  const renderFallbackRoute = () => {
    // Clear existing route polylines
    polylinesRef.current.forEach(polyline => polyline.setMap(null));
    polylinesRef.current = [];
    
    // Clear any existing progress animation
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    
    if (!agentPosition || !delivery.dropoffLocation?.lat || !delivery.dropoffLocation?.lng) {
      return;
    }
    
    // Create a fallback straight line
    const routePath = [
      { lat: agentPosition.lat, lng: agentPosition.lng },
      { lat: delivery.dropoffLocation.lat, lng: delivery.dropoffLocation.lng }
    ];
    
    // Create route visualization
    const basePolyline = new window.google.maps.Polyline({
      path: routePath,
      geodesic: true,
      strokeColor: getRouteColor(delivery.status),
      strokeOpacity: 0.3,
      strokeWeight: 12
    });
    
    const mainPolyline = new window.google.maps.Polyline({
      path: routePath,
      geodesic: true,
      strokeColor: getRouteColor(delivery.status),
      strokeOpacity: 0.8,
      strokeWeight: 6,
      icons: [{
        icon: {
          path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 2,
          strokeColor: '#ffffff',
          strokeOpacity: 0.8
        },
        offset: '100%',
        repeat: '100px'
      }]
    });
    
    const glowPolyline = new window.google.maps.Polyline({
      path: routePath,
      geodesic: true,
      strokeColor: getRouteColor(delivery.status),
      strokeOpacity: 0.2,
      strokeWeight: 20
    });
    
    basePolyline.setMap(googleMapRef.current);
    mainPolyline.setMap(googleMapRef.current);
    glowPolyline.setMap(googleMapRef.current);
    
    polylinesRef.current.push(basePolyline);
    polylinesRef.current.push(mainPolyline);
    polylinesRef.current.push(glowPolyline);
    
    // Add animated progress indicator
    animateRouteProgress(routePath);
    
    // Fit map to show the route
    if (googleMapRef.current) {
      const bounds = new window.google.maps.LatLngBounds();
      routePath.forEach(point => {
        bounds.extend(new window.google.maps.LatLng(point.lat, point.lng));
      });
      googleMapRef.current.fitBounds(bounds);
    }
  };

  const animateRouteProgress = (routePath) => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    
    let progress = 0;
    const progressMarker = createAdvancedMarker(googleMapRef.current, routePath[0], {
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: getRouteColor(delivery.status),
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2
      }
    });
    
    polylinesRef.current.push(progressMarker);
    
    progressIntervalRef.current = setInterval(() => {
      progress += 0.02;
      if (progress >= 1) {
        progress = 0;
      }
      
      const index = Math.min(
        Math.floor(progress * (routePath.length - 1)),
        routePath.length - 1
      );
      
      if (routePath[index]) {
        if (progressMarker.setPosition) {
          progressMarker.setPosition(routePath[index]);
        }
      }
    }, 100);
  };

  const getRouteColor = (status) => {
    switch (status) {
      case 'assigned': return '#3b82f6'; // blue
      case 'in_transit': return '#f59e0b'; // amber
      case 'delivered': return '#10b981'; // green
      default: return '#6b7280'; // gray
    }
  };

  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}
      
      {error && (
        <div className="absolute top-2 left-2 right-2 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-10">
          {error}
        </div>
      )}
      
      {activeRoute && (
        <div className="absolute top-2 left-2 bg-white bg-opacity-90 rounded-md p-2 text-xs z-10">
          <div>Distance: {activeRoute.distance?.toFixed(2) || 'N/A'} km</div>
          <div>Time: {Math.round(activeRoute.duration_in_traffic || activeRoute.duration || 0)} mins</div>
          {activeRoute.risk_score !== undefined && (
            <div>Risk Score: {activeRoute.risk_score?.toFixed(1) || '0.0'}</div>
          )}
        </div>
      )}
      
      <div 
        ref={mapRef}
        className={className}
      />
    </div>
  );
};

export default OptimizedRouteMap;