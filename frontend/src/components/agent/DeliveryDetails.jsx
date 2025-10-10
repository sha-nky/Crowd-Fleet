import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDeliveryById, updateDeliveryStatus } from '../../services/API';
import { loadGoogleMaps, createAdvancedMarker } from '../../services/GoogleMapsService';
import { getOptimizedRoute, detectRisks } from '../../services/MicroserviceAPI';
import OptimizedRouteMap from '../shared/OptimizedRouteMap';

const DeliveryDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [delivery, setDelivery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [agentPosition, setAgentPosition] = useState(null);
  const [distanceToDropoff, setDistanceToDropoff] = useState(null);
  const [activeRoute, setActiveRoute] = useState(null);
  const [trackingActive, setTrackingActive] = useState(false);
  const mapRef = useRef(null);
  const googleMapRef = useRef(null);
  const markersRef = useRef([]);
  const polylinesRef = useRef([]);
  const agentMarkerRef = useRef(null);
  const watchIdRef = useRef(null);
  const routeUpdateIntervalRef = useRef(null);
  const progressIntervalRef = useRef(null);

  useEffect(() => {
    console.log('Main useEffect triggered - id:', id, 'delivery:', delivery);
    fetchDeliveryDetails();
    
    // Set up periodic refresh with longer interval (2 minutes instead of 30 seconds)
    const deliveryInterval = setInterval(() => {
      fetchDeliveryDetails();
    }, 120000); // 2 minutes
    
    // Start watching agent position if delivery is in_transit
    if (delivery && delivery.status === 'in_transit') {
      console.log('Delivery is in_transit, starting agent position tracking');
      startWatchingAgentPosition();
    }
    
    // Clean up on component unmount
    return () => {
      console.log('Cleaning up main useEffect');
      clearInterval(deliveryInterval);
      stopWatchingAgentPosition();
      if (routeUpdateIntervalRef.current) {
        clearInterval(routeUpdateIntervalRef.current);
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [id, delivery?.status]);

  useEffect(() => {
    console.log('useEffect triggered - delivery:', delivery, 'mapRef.current:', mapRef.current);
    // Only initialize map when delivery data is available AND mapRef is attached to DOM
    if (delivery && mapRef.current) {
      console.log('Delivery and mapRef available, checking DOM attachment');
      // Check if the element is actually in the DOM
      if (document.contains(mapRef.current)) {
        console.log('Map container in DOM, initializing map with delay');
        // Initialize map only if it hasn't been initialized yet
        if (!googleMapRef.current) {
          // Small delay to ensure DOM is fully rendered
          const timer = setTimeout(() => {
            initMap();
          }, 100);
          
          return () => clearTimeout(timer);
        }
      } else {
        console.log('Map container not yet in DOM, waiting for render');
        // Try again after a longer delay
        const timer = setTimeout(() => {
          if (document.contains(mapRef.current)) {
            console.log('Map container now in DOM, initializing map');
            // Initialize map only if it hasn't been initialized yet
            if (!googleMapRef.current) {
              initMap();
            }
          } else {
            console.log('Map container still not in DOM');
          }
        }, 500);
        
        return () => clearTimeout(timer);
      }
    } else {
      console.log('Delivery or mapRef not available yet');
    }
  }, [delivery, mapRef.current]);

  useEffect(() => {
    console.log('Agent position useEffect triggered - agentPosition:', agentPosition, 'googleMapRef.current:', googleMapRef.current);
    // Update agent marker position when it changes
    if (agentPosition && googleMapRef.current) {
      console.log('Updating agent marker');
      updateAgentMarker();
      calculateDistanceToDropoff(agentPosition);
    }
  }, [agentPosition, delivery]);

  useEffect(() => {
    // When tracking is active, start continuous route updates
    console.log('Tracking useEffect triggered - trackingActive:', trackingActive, 'agentPosition:', agentPosition, 'delivery:', delivery);
    if (trackingActive && agentPosition && delivery) {
      console.log('Tracking is active, updating route to delivery');
      updateRouteToDelivery(delivery, agentPosition);
      // Set up continuous route updates every 30 seconds (instead of 10)
      if (routeUpdateIntervalRef.current) {
        clearInterval(routeUpdateIntervalRef.current);
      }
      routeUpdateIntervalRef.current = setInterval(() => {
        console.log('Updating route (interval)');
        updateRouteToDelivery(delivery, agentPosition);
      }, 30000); // 30 seconds
    } else if (routeUpdateIntervalRef.current) {
      console.log('Tracking not active or missing data, clearing interval');
      clearInterval(routeUpdateIntervalRef.current);
      routeUpdateIntervalRef.current = null;
    }
    
    // Clean up on unmount or when tracking changes
    return () => {
      if (routeUpdateIntervalRef.current) {
        console.log('Cleaning up route update interval');
        clearInterval(routeUpdateIntervalRef.current);
        routeUpdateIntervalRef.current = null;
      }
      if (progressIntervalRef.current) {
        console.log('Cleaning up progress interval');
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, [trackingActive, agentPosition, delivery]);

  const startWatchingAgentPosition = () => {
    console.log('startWatchingAgentPosition called');
    if (navigator.geolocation) {
      console.log('Geolocation available, getting current position');
      // Get position immediately
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('Current position obtained:', position);
          const newAgentPosition = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setAgentPosition(newAgentPosition);
        },
        (error) => {
          console.error('Error getting position:', error);
          // Set a default position if geolocation fails
          setAgentPosition({ lat: 40.7128, lng: -74.0060 }); // New York as fallback
        },
        {
          enableHighAccuracy: true,
          maximumAge: 10000,
          timeout: 5000
        }
      );
      
      console.log('Setting up position watching');
      // Watch position for updates with relaxed settings
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          console.log('Position updated:', position);
          const newAgentPosition = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setAgentPosition(newAgentPosition);
        },
        (error) => {
          console.error('Error watching position:', error);
        },
        {
          enableHighAccuracy: false, // Less strict for watching
          maximumAge: 60000, // 1 minute
          timeout: 30000 // 30 seconds
        }
      );
      
      // Store watch ID for cleanup
      watchIdRef.current = watchId;
    }
  };

  const stopWatchingAgentPosition = () => {
    console.log('stopWatchingAgentPosition called');
    if (watchIdRef.current && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    
    // Clear agent marker animation if it exists
    if (agentMarkerRef.current && agentMarkerRef.current.animationInterval) {
      clearInterval(agentMarkerRef.current.animationInterval);
      agentMarkerRef.current.animationInterval = null;
    }
    
    // Remove agent marker from map
    if (agentMarkerRef.current && typeof agentMarkerRef.current.setMap === 'function') {
      agentMarkerRef.current.setMap(null);
      agentMarkerRef.current = null;
    }
  };

  const startTracking = () => {
    console.log('startTracking called');
    setTrackingActive(true);
    // Make sure agent position tracking is started
    if (!agentPosition) {
      startWatchingAgentPosition();
    }
  };

  const stopTracking = () => {
    console.log('stopTracking called');
    setTrackingActive(false);
    setActiveRoute(null);
    
    // Clear route visualization
    polylinesRef.current.forEach(polyline => {
      if (polyline && typeof polyline.setMap === 'function') {
        polyline.setMap(null);
      }
    });
    polylinesRef.current = [];
    
    // Clear agent marker animation if it exists
    if (agentMarkerRef.current && agentMarkerRef.current.animationInterval) {
      clearInterval(agentMarkerRef.current.animationInterval);
      agentMarkerRef.current.animationInterval = null;
    }
  };

  const updateAgentMarker = () => {
    console.log('updateAgentMarker called with position:', agentPosition);
    if (!agentMarkerRef.current) {
      console.log('Creating new agent marker');
      // Create agent marker with custom styling
      agentMarkerRef.current = createAdvancedMarker(googleMapRef.current, agentPosition, {
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
      
      // Add pulse animation
      animateAgentMarker();
    } else {
      console.log('Updating existing agent marker position');
      // Update existing agent marker position
      if (agentMarkerRef.current.setPosition) {
        agentMarkerRef.current.setPosition(agentPosition);
      }
    }
  };

  const animateAgentMarker = () => {
    if (!agentMarkerRef.current) return;
    
    // Clear any existing animation interval
    if (agentMarkerRef.current.animationInterval) {
      clearInterval(agentMarkerRef.current.animationInterval);
    }
    
    let scale = 12;
    let opacity = 1;
    const animate = () => {
      // Alternate between scaling and opacity for a more noticeable blink effect
      if (scale === 12) {
        scale = 15;
        opacity = 0.7;
      } else {
        scale = 12;
        opacity = 1;
      }
      
      if (agentMarkerRef.current && agentMarkerRef.current.setIcon) {
        agentMarkerRef.current.setIcon({
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: scale,
          fillColor: '#3b82f6',
          fillOpacity: opacity,
          strokeColor: '#ffffff',
          strokeWeight: 2
        });
      }
    };
    
    // Pulse animation every 1 second for more noticeable effect
    const intervalId = setInterval(animate, 1000);
    agentMarkerRef.current.animationInterval = intervalId;
  };

  const calculateDistanceToDropoff = (position) => {
    console.log('calculateDistanceToDropoff called with position:', position, 'delivery:', delivery);
    if (!delivery || !delivery.dropoffLocation) {
      console.log('Missing delivery or dropoff location');
      return;
    }
    
    if (!position || !position.lat || !position.lng) {
      console.log('Missing agent position');
      return;
    }
    
    const distance = calculateDistance(
      position.lat, position.lng,
      delivery.dropoffLocation.lat, delivery.dropoffLocation.lng
    );
    
    console.log('Calculated distance:', distance);
    setDistanceToDropoff(distance);
    
    // Remove the automatic delivery marking
    // The delivery will only be marked as delivered when the agent manually clicks the button
  };

  // Calculate distance between two points in meters using Haversine formula
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    console.log('calculateDistance called with:', { lat1, lon1, lat2, lon2 });
    if (!lat1 || !lon1 || !lat2 || !lon2) {
      console.log('Missing coordinates for distance calculation');
      return null;
    }
    
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    const distance = R * c;
    console.log('Calculated distance result:', distance);
    return distance;
  };

  const markDeliveryAsDelivered = async () => {
    try {
      // First, get the current agent position
      let currentPosition = agentPosition;
      
      // If we don't have a position, try to get it now
      if (!currentPosition) {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              maximumAge: 10000,
              timeout: 5000
            });
          });
          
          currentPosition = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
        } catch (positionError) {
          console.error('Error getting current position:', positionError);
          // We'll proceed without position - backend will handle validation
        }
      }
      
      const response = await updateDeliveryStatus(id, { 
        status: 'delivered',
        agentLocation: currentPosition
      });
      
      if (response.status === 200) {
        // Refresh the delivery details
        fetchDeliveryDetails();
        stopTracking();
      } else {
        throw new Error(response.message || 'Failed to mark delivery as delivered');
      }
    } catch (error) {
      console.error('Error marking delivery as delivered:', error);
      setError('Failed to mark delivery as delivered: ' + (error.message || error.toString()));
    }
  };

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
      
      console.log('Setting delivery data:', response.data);
      setDelivery(response.data);
    } catch (err) {
      console.error('Error fetching delivery details:', err);
      setError('Failed to fetch delivery details: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateRouteToDelivery = async (deliveryData, agentPos) => {
    try {
      console.log('Attempting to get optimized route from microservice');
      if (!agentPos || !deliveryData.dropoffLocation?.lat || !deliveryData.dropoffLocation?.lng) {
        throw new Error('Missing location data');
      }
      
      // Detect risks in the area
      console.log('Detecting risks...');
      const riskData = await detectRisks(agentPos, 5); // 5km radius
      const riskAlerts = riskData.risks || [];
      console.log('Risk detection complete:', riskAlerts.length, 'risks found');
      
      // Get optimized route from agent's current position to delivery dropoff
      console.log('Requesting optimized route from microservice');
      const routeData = await getOptimizedRoute(
        agentPos,
        { lat: deliveryData.dropoffLocation.lat, lng: deliveryData.dropoffLocation.lng },
        riskAlerts
      );
      console.log('Microservice route response:', routeData);
      
      if (routeData.routes && routeData.routes.primary) {
        console.log('Using microservice route');
        setActiveRoute(routeData.routes.primary);
        renderUniqueRoute(routeData.routes.primary, deliveryData);
      } else {
        throw new Error('No primary route in microservice response');
      }
    } catch (err) {
      console.error('Error updating route with microservice:', err);
      // Fallback to Google Maps Directions API if microservice fails
      try {
        console.log('Falling back to Google Maps Directions API');
        await renderGoogleMapsRoute(deliveryData, agentPos);
      } catch (googleErr) {
        console.error('Error updating route with Google Maps:', googleErr);
        // Final fallback to straight line
        console.log('Falling back to straight line route');
        renderFallbackRoute(deliveryData);
      }
    }
  };

  const renderGoogleMapsRoute = async (deliveryData, agentPos) => {
    console.log('renderGoogleMapsRoute called with:', { deliveryData, agentPos });
    if (!agentPos || !deliveryData.dropoffLocation?.lat || !deliveryData.dropoffLocation?.lng) {
      console.log('Missing location data for route calculation');
      throw new Error('Missing location data for route calculation');
    }
    
    try {
      console.log('Loading Google Maps API');
      // Ensure Google Maps is loaded with directions library
      await loadGoogleMaps();
      
      console.log('Google Maps loaded, checking API availability');
      if (!window.google || !window.google.maps || !window.google.maps.DirectionsService) {
        console.log('Google Maps Directions API not available');
        throw new Error('Google Maps Directions API not available');
      }
      
      console.log('Checking map instance:', googleMapRef.current);
      if (!googleMapRef.current) {
        console.log('Map instance not available');
        throw new Error('Map instance not available');
      }
      
      console.log('Requesting directions from Google Maps');
      // Get directions using Google Maps Directions API
      const directions = await getDirections(
        agentPos,
        { lat: deliveryData.dropoffLocation.lat, lng: deliveryData.dropoffLocation.lng }
      );
      console.log('Google Maps directions response:', directions);
      
      if (directions && directions.routes && directions.routes.length > 0) {
        console.log('Rendering directions on map');
        // Render the directions on the map
        renderDirections(googleMapRef.current, directions, polylinesRef, deliveryData.status);
        
        // Set active route data
        const route = directions.routes[0];
        console.log('Setting active route data:', route);
        setActiveRoute({
          distance: route.legs[0].distance.value / 1000, // Convert to km
          duration: route.legs[0].duration.value / 60, // Convert to minutes
          duration_in_traffic: route.legs[0].duration_in_traffic ? 
            route.legs[0].duration_in_traffic.value / 60 : null // Convert to minutes
        });
      } else {
        console.log('No routes found in Google Maps response');
        throw new Error('No routes found in Google Maps response');
      }
    } catch (error) {
      console.error('Error in renderGoogleMapsRoute:', error);
      throw error;
    }
  };

  const renderUniqueRoute = (route, deliveryData) => {
    // Clear existing route polylines
    polylinesRef.current.forEach(polyline => polyline.setMap(null));
    polylinesRef.current = [];
    
    // Check if we have proper route points from microservice
    if (route.route_points && route.route_points.length > 0) {
      // Use the route points from microservice
      const routePath = route.route_points.map(point => ({
        lat: point.lat,
        lng: point.lng
      }));
      
      renderRoutePath(routePath, deliveryData.status);
    } else if (route.routes && route.routes.length > 0) {
      // If it's a Google Maps Directions response format
      try {
        renderDirections(googleMapRef.current, route, polylinesRef, deliveryData.status);
      } catch (err) {
        console.error('Error rendering directions:', err);
        // Fallback to straight line
        renderFallbackRoute(deliveryData);
      }
    } else {
      // Fallback if no route points
      renderFallbackRoute(deliveryData);
    }
  };

  const renderRoutePath = (routePath, status) => {
    // Create a unique visualization with gradient colors and animated effect
    // Base route
    const basePolyline = new window.google.maps.Polyline({
      path: routePath,
      geodesic: true,
      strokeColor: getRouteColor(status),
      strokeOpacity: 0.3,
      strokeWeight: 12
    });
    
    // Main route with gradient effect
    const mainPolyline = new window.google.maps.Polyline({
      path: routePath,
      geodesic: true,
      strokeColor: getRouteColor(status),
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
    
    // Glow effect
    const glowPolyline = new window.google.maps.Polyline({
      path: routePath,
      geodesic: true,
      strokeColor: getRouteColor(status),
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
    animateRouteProgress(routePath, status);
  };

  const renderFallbackRoute = (deliveryData) => {
    // Clear existing route polylines
    polylinesRef.current.forEach(polyline => polyline.setMap(null));
    polylinesRef.current = [];
    
    if (!agentPosition || !deliveryData.dropoffLocation?.lat || !deliveryData.dropoffLocation?.lng) {
      return;
    }
    
    // Create a fallback straight line with unique styling
    const routePath = [
      { lat: agentPosition.lat, lng: agentPosition.lng },
      { lat: deliveryData.dropoffLocation.lat, lng: deliveryData.dropoffLocation.lng }
    ];
    
    // Create multiple polylines for a unique layered effect
    // Base route
    const basePolyline = new window.google.maps.Polyline({
      path: routePath,
      geodesic: true,
      strokeColor: getRouteColor(deliveryData.status),
      strokeOpacity: 0.3,
      strokeWeight: 12
    });
    
    // Main route with gradient effect
    const mainPolyline = new window.google.maps.Polyline({
      path: routePath,
      geodesic: true,
      strokeColor: getRouteColor(deliveryData.status),
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
    
    // Glow effect
    const glowPolyline = new window.google.maps.Polyline({
      path: routePath,
      geodesic: true,
      strokeColor: getRouteColor(deliveryData.status),
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
    animateRouteProgress(routePath, deliveryData.status);
  };

  const animateRouteProgress = (routePath, status) => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    
    let progress = 0;
    const progressMarker = createAdvancedMarker(googleMapRef.current, routePath[0], {
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: getRouteColor(status),
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

  const initMap = async () => {
    try {
      console.log('initMap called with delivery:', delivery);
      if (!delivery) return;
      
      // Ensure map container is valid
      if (!mapRef.current) {
        console.log('Map container ref is null, waiting for render');
        return;
      }
      
      // Check if the element is actually in the DOM
      if (!document.contains(mapRef.current)) {
        console.log('Map container not yet in DOM, waiting for render');
        return;
      }
      
      // Load Google Maps API
      console.log('Loading Google Maps API');
      await loadGoogleMaps();
      
      if (!window.google || !window.google.maps) {
        console.log('Google Maps API not loaded');
        throw new Error('Google Maps API not loaded');
      }
      
      // Check if mapRef.current is actually attached to DOM
      if (!mapRef.current || !(mapRef.current instanceof HTMLElement)) {
        console.error('Map container is not a valid HTMLElement:', mapRef.current);
        throw new Error('Map container is not valid');
      }
      
      console.log('Initializing map with container:', mapRef.current);
      // Initialize map with custom styling
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
      
      console.log('Map initialized successfully:', map);
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
        const dropoffMarker = createAdvancedMarker(map,
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
        console.log('Adding agent marker to map');
        updateAgentMarker();
      }
      
      // Fit map to show all markers
      if (markersRef.current.length > 0 || agentMarkerRef.current) {
        const bounds = new window.google.maps.LatLngBounds();
        markersRef.current.forEach(marker => {
          if (marker.getPosition) {
            bounds.extend(marker.getPosition());
          }
        });
        if (agentMarkerRef.current && agentMarkerRef.current.getPosition) {
          bounds.extend(agentMarkerRef.current.getPosition());
        }
        map.fitBounds(bounds);
      }
    } catch (err) {
      console.error('Error initializing map:', err);
      // Don't show error to user, just don't show map
      //setError('Failed to initialize map: ' + err.message);
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    try {
      // Block status updates if delivery is already delivered or cancelled
      if (delivery.status === 'delivered' || delivery.status === 'cancelled') {
        setError(`Cannot update status of a ${delivery.status} delivery`);
        return;
      }
      
      // For delivered status, check if agent is within 200m of dropoff
      if (newStatus === 'delivered') {
        if (distanceToDropoff === null) {
          setError('Unable to verify location. Please ensure location services are enabled.');
          return;
        }
        
        if (distanceToDropoff > 200) {
          setError(`You are ${Math.round(distanceToDropoff)} meters from the dropoff point. You must be within 200 meters to mark as delivered.`);
          return;
        }
      }
      
      setUpdating(true);
      // Pass the current agent position when updating status
      const response = await updateDeliveryStatus(id, { 
        status: newStatus, 
        agentLocation: agentPosition 
      });
      
      if (response.status === 200) {
        // Refresh the delivery details
        fetchDeliveryDetails();
      } else {
        setError('Failed to update delivery status');
      }
    } catch (err) {
      console.error('Error updating delivery status:', err);
      setError('Failed to update delivery status: ' + err.message);
    } finally {
      setUpdating(false);
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
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900">Delivery Details</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Detailed information about delivery #{delivery._id?.substring(0, 8)}
            </p>
          </div>
          <button
            onClick={() => navigate('/agent/dashboard')}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
      <div className="px-4 py-5 sm:px-6">
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
              {delivery.status === 'in_transit' && distanceToDropoff !== null && (
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500">Distance to Dropoff</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {Math.round(distanceToDropoff)} meters
                    {distanceToDropoff <= 200 && (
                      <span className="ml-2 text-green-600">✓ Within delivery range</span>
                    )}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        </div>
        
        {/* Map Section */}
        <div className="mt-8">
          <h4 className="text-md font-medium text-gray-900 mb-3">Delivery Route</h4>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h5 className="text-sm font-medium text-gray-900">Real-time Tracking</h5>
                <p className="text-xs text-gray-500">Live route visualization with risk-aware navigation</p>
              </div>
              {delivery.status === 'in_transit' && (
                <div>
                  {trackingActive ? (
                    <button
                      onClick={stopTracking}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      Stop Tracking
                    </button>
                  ) : (
                    <button
                      onClick={startTracking}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Start Tracking
                    </button>
                  )}
                </div>
              )}
            </div>
            
            {trackingActive && activeRoute && (
              <div className="mb-4 p-3 bg-blue-50 rounded-md">
                <div className="text-xs text-blue-800">
                  <div>Estimated time: {Math.round(activeRoute.duration_in_traffic || activeRoute.duration)} mins</div>
                  <div>Distance: {activeRoute.distance.toFixed(2)} km</div>
                </div>
              </div>
            )}
            
            {/* Use the new OptimizedRouteMap component */}
            <OptimizedRouteMap 
              delivery={delivery} 
              agentPosition={agentPosition}
              className="w-full h-80 rounded-lg border border-gray-200"
            />
          </div>
        </div>
        
        {/* Status Update Section */}
        <div className="mt-8">
          <h4 className="text-md font-medium text-gray-900 mb-3">Update Delivery Status</h4>
          {isDeliveryCompleted ? (
            <div className="rounded-md bg-yellow-50 p-4">
              <div className="text-sm text-yellow-700">
                This delivery is already {delivery.status} and cannot be modified.
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {delivery.status !== 'assigned' && (
                <button
                  onClick={() => handleStatusUpdate('assigned')}
                  disabled={updating}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {updating ? 'Updating...' : 'Mark as Assigned'}
                </button>
              )}
              {delivery.status !== 'in_transit' && (
                <button
                  onClick={() => handleStatusUpdate('in_transit')}
                  disabled={updating}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {updating ? 'Updating...' : 'Mark as In Transit'}
                </button>
              )}
              {delivery.status !== 'delivered' && (
                <button
                  onClick={markDeliveryAsDelivered}
                  disabled={updating || (distanceToDropoff !== null && distanceToDropoff > 200)}
                  className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${
                    distanceToDropoff !== null && distanceToDropoff > 200
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                  }`}
                  title={
                    distanceToDropoff !== null && distanceToDropoff > 200
                      ? `You are ${Math.round(distanceToDropoff)} meters from the dropoff point. You must be within 200 meters to mark as delivered.`
                      : updating
                      ? 'Updating...'
                      : 'Mark this delivery as delivered'
                  }
                >
                  {updating ? 'Updating...' : 'Mark as Delivered'}
                </button>
              )}
              {delivery.status !== 'cancelled' && (
                <button
                  onClick={() => handleStatusUpdate('cancelled')}
                  disabled={updating}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                >
                  {updating ? 'Updating...' : 'Cancel Delivery'}
                </button>
              )}
            </div>
          )}
          {delivery.status === 'in_transit' && distanceToDropoff !== null && distanceToDropoff > 200 && (
            <div className="mt-3 text-sm text-yellow-700">
              You are {Math.round(distanceToDropoff)} meters from the dropoff point. You must be within 200 meters to mark as delivered.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeliveryDetails;