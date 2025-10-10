import React, { useState, useEffect, useRef } from 'react';
import { getAgentDeliveries, updateDeliveryStatus } from '../../services/API';
import { loadGoogleMaps, createAdvancedMarker } from '../../services/GoogleMapsService';
import { getOptimizedRoute, detectRisks } from '../../services/MicroserviceAPI';

const Map = () => {
  const [deliveries, setDeliveries] = useState([]);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [agentPosition, setAgentPosition] = useState(null);
  const [activeRoute, setActiveRoute] = useState(null);
  const [routeProgress, setRouteProgress] = useState(0);
  const [trackingActive, setTrackingActive] = useState(false);
  const mapRef = useRef(null);
  const googleMapRef = useRef(null);
  const markersRef = useRef([]);
  const polylinesRef = useRef([]);
  const agentMarkerRef = useRef(null);
  const watchIdRef = useRef(null);
  const routeUpdateIntervalRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const trackingIntervalRef = useRef(null);

  useEffect(() => {
    fetchDeliveries();
    
    // Set up periodic refresh with longer interval (2 minutes instead of 30 seconds)
    const deliveryInterval = setInterval(() => {
      fetchDeliveries();
    }, 120000); // 2 minutes
    
    // Start watching agent position
    startWatchingAgentPosition();
    
    // Clean up on component unmount
    return () => {
      clearInterval(deliveryInterval);
      stopWatchingAgentPosition();
      if (routeUpdateIntervalRef.current) {
        clearInterval(routeUpdateIntervalRef.current);
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (deliveries.length > 0 && !loading) {
      // Initialize map only if it hasn't been initialized yet
      if (!googleMapRef.current) {
        initMap();
      } else {
        // If map already exists, just update the markers
        updateMarkers();
      }
    }
  }, [deliveries, loading]);

  useEffect(() => {
    // Update agent marker position when it changes
    if (agentPosition && googleMapRef.current) {
      updateAgentMarker();
      // Check proximity to dropoff points
      checkProximityToDropoffs();
    }
  }, [agentPosition]);

  useEffect(() => {
    // When a delivery is selected and tracking is active, start continuous route updates
    if (selectedDelivery && agentPosition && trackingActive) {
      updateRouteToDelivery(selectedDelivery, agentPosition);
      // Set up continuous route updates every 30 seconds (instead of 10)
      if (routeUpdateIntervalRef.current) {
        clearInterval(routeUpdateIntervalRef.current);
      }
      routeUpdateIntervalRef.current = setInterval(() => {
        updateRouteToDelivery(selectedDelivery, agentPosition);
      }, 30000); // 30 seconds
    } else if (routeUpdateIntervalRef.current) {
      clearInterval(routeUpdateIntervalRef.current);
      routeUpdateIntervalRef.current = null;
    }
    
    // Clean up on unmount or when selection changes
    return () => {
      if (routeUpdateIntervalRef.current) {
        clearInterval(routeUpdateIntervalRef.current);
        routeUpdateIntervalRef.current = null;
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, [selectedDelivery, agentPosition, trackingActive]);

  const startWatchingAgentPosition = () => {
    if (navigator.geolocation) {
      // First get current position
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newAgentPosition = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setAgentPosition(newAgentPosition);
        },
        (error) => {
          console.error('Error getting current position:', error);
          // Set a default position if geolocation fails
          setAgentPosition({ lat: 40.7128, lng: -74.0060 }); // New York as fallback
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      );
      
      // Then start watching position with more relaxed settings
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const newAgentPosition = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setAgentPosition(newAgentPosition);
        },
        (error) => {
          console.error('Error watching position:', error);
          setError('Failed to get agent location: ' + error.message);
          // Continue with last known position or default
        },
        {
          enableHighAccuracy: false, // Less strict for watching
          maximumAge: 60000, // 1 minute
          timeout: 30000 // 30 seconds
        }
      );
    } else {
      setError('Geolocation is not supported by this browser');
      // Set a default position
      setAgentPosition({ lat: 40.7128, lng: -74.0060 }); // New York as fallback
    }
  };

  const stopWatchingAgentPosition = () => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  const startTracking = (delivery) => {
    setSelectedDelivery(delivery);
    setTrackingActive(true);
    
    // Set up continuous tracking every 30 seconds (instead of 15)
    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current);
    }
    trackingIntervalRef.current = setInterval(() => {
      // Force a position update
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const newAgentPosition = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            setAgentPosition(newAgentPosition);
          },
          (error) => {
            console.error('Error getting current position:', error);
          },
          {
            enableHighAccuracy: true,
            maximumAge: 1000,
            timeout: 5000
          }
        );
      }
    }, 30000); // 30 seconds
  };

  const stopTracking = () => {
    setSelectedDelivery(null);
    setTrackingActive(false);
    setActiveRoute(null);
    
    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current);
      trackingIntervalRef.current = null;
    }
    
    // Clear route visualization
    polylinesRef.current.forEach(polyline => polyline.setMap(null));
    polylinesRef.current = [];
  };

  const updateAgentMarker = () => {
    if (!googleMapRef.current) return;
    
    if (!agentMarkerRef.current) {
      // Create agent marker with custom styling and animation
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
      
      // Add pulsing animation to agent marker
      let scale = 1;
      let opacity = 1;
      let increasing = true;
      
      agentMarkerRef.current.animationInterval = setInterval(() => {
        if (increasing) {
          scale += 0.05;
          opacity -= 0.02;
          if (scale >= 1.3) increasing = false;
        } else {
          scale -= 0.05;
          opacity += 0.02;
          if (scale <= 1) increasing = true;
        }
        
        if (agentMarkerRef.current && agentMarkerRef.current.setIcon) {
          agentMarkerRef.current.setIcon({
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 12 * scale,
            fillColor: '#3b82f6',
            fillOpacity: opacity,
            strokeColor: '#ffffff',
            strokeWeight: 2
          });
        }
      }, 1000); // Update every second
    } else {
      // Update existing agent marker position
      if (agentMarkerRef.current.setPosition) {
        agentMarkerRef.current.setPosition(agentPosition);
      }
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
          zoom: 10,
          center: agentPosition || { lat: 13.0827, lng: 80.2707 }, // Chennai as default
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
      
      // Add markers for deliveries
      addMarkers();
    } catch (err) {
      console.error('Error initializing map:', err);
      setError('Failed to initialize map: ' + err.message);
    }
  };

  const updateMarkers = () => {
    // Clear existing markers except agent marker
    markersRef.current.forEach(marker => {
      if (marker !== agentMarkerRef.current) {
        marker.setMap(null);
      }
    });
    
    // Keep only the agent marker
    markersRef.current = agentMarkerRef.current ? [agentMarkerRef.current] : [];
    
    // Add new delivery markers
    addMarkers();
  };

  const addMarkers = () => {
    if (!googleMapRef.current) return;
    
    deliveries.forEach(delivery => {
      // Add pickup marker
      if (delivery.pickupLocation?.lat && delivery.pickupLocation?.lng) {
        const pickupMarker = createAdvancedMarker(googleMapRef.current, 
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
        const dropoffMarker = createAdvancedMarker(googleMapRef.current,
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
    });
    
    // Update map bounds to show all markers
    if (markersRef.current.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      markersRef.current.forEach(marker => {
        if (marker.getPosition) {
          bounds.extend(marker.getPosition());
        }
      });
      googleMapRef.current.fitBounds(bounds);
    }
  };

  const checkProximityToDropoffs = () => {
    if (!agentPosition) return;
    
    deliveries.forEach(delivery => {
      if (delivery.status === 'in_transit' && delivery.dropoffLocation?.lat && delivery.dropoffLocation?.lng) {
        const distance = calculateDistance(
          agentPosition.lat, agentPosition.lng,
          delivery.dropoffLocation.lat, delivery.dropoffLocation.lng
        );
        
        // If within 200 meters, prompt to mark as delivered
        if (distance <= 200) {
          // In a real app, this would show a notification or modal
          console.log(`Delivery ${delivery.id} is within 200m of dropoff point. Ready to mark as delivered.`);
          // For demo purposes, we'll automatically mark as delivered
          // In a real app, you'd want to prompt the user first
          markDeliveryAsDelivered(delivery.id);
          
          // Stop tracking for this delivery
          if (selectedDelivery && selectedDelivery.id === delivery.id) {
            stopTracking();
          }
        }
      }
    });
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

  const markDeliveryAsDelivered = async (deliveryId) => {
    try {
      const response = await updateDeliveryStatus(deliveryId, { status: 'delivered' });
      if (response.status === 200) {
        console.log(`Delivery ${deliveryId} marked as delivered`);
        // Refresh deliveries to update UI
        fetchDeliveries();
      }
    } catch (error) {
      console.error('Error marking delivery as delivered:', error);
      setError('Failed to mark delivery as delivered: ' + error.message);
    }
  };

  const fetchDeliveries = async () => {
    try {
      setLoading(true);
      console.log('Fetching agent deliveries for map...');
      const response = await getAgentDeliveries();
      console.log('Map deliveries response:', response);
      
      if (response.data) {
        // Transform the data to match the expected format
        const transformedDeliveries = response.data.map(delivery => ({
          id: delivery._id,
          pickupLocation: {
            lat: delivery.pickupLocation?.lat,
            lng: delivery.pickupLocation?.lng,
            address: delivery.pickupLocation?.address
          },
          dropoffLocation: {
            lat: delivery.dropoffLocation?.lat,
            lng: delivery.dropoffLocation?.lng,
            address: delivery.dropoffLocation?.address
          },
          status: delivery.status
        }));
        console.log('Transformed deliveries:', transformedDeliveries);
        setDeliveries(transformedDeliveries);
      }
    } catch (err) {
      console.error('Error fetching deliveries for map:', err);
      setError('Failed to load deliveries: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateRouteToDelivery = async (delivery, agentPos) => {
    try {
      if (!agentPos || !delivery.dropoffLocation?.lat || !delivery.dropoffLocation?.lng) {
        return;
      }
      
      console.log('Updating route for delivery:', delivery.id, 'from agent position:', agentPos);
      
      // Detect risks in the area around the agent
      const riskData = await detectRisks(agentPos, 5); // 5km radius
      let riskAlerts = riskData.risks || [];
      
      // Add simulated risk for testing purposes
      // Check if this is the specific route we want to test
      const isTestRoute = 
        (Math.abs(delivery.pickupLocation?.lat - 13.364120) < 0.001 && Math.abs(delivery.pickupLocation?.lng - 80.141430) < 0.001) &&
        (Math.abs(delivery.dropoffLocation?.lat - 13.365132) < 0.001 && Math.abs(delivery.dropoffLocation?.lng - 80.139976) < 0.001);
      
      if (isTestRoute) {
        // Add simulated risk at midpoint between agent and dropoff (not pickup and dropoff)
        const riskLat = (agentPos.lat + delivery.dropoffLocation.lat) / 2;
        const riskLng = (agentPos.lng + delivery.dropoffLocation.lng) / 2;
        
        const simulatedRisk = {
          source: "simulated",
          type: "accident",
          description: "Simulated accident on route for testing",
          severity: "medium",
          location: {
            lat: riskLat,
            lng: riskLng
          },
          timestamp: new Date().toISOString(),
          coordinates: [riskLat, riskLng]
        };
        
        riskAlerts = [...riskAlerts, simulatedRisk];
        console.log("Added simulated risk for testing:", simulatedRisk);
      }
      
      // Get optimized route from agent's current position to delivery dropoff
      const routeData = await getOptimizedRoute(
        agentPos, // This is the agent's current location
        { lat: delivery.dropoffLocation.lat, lng: delivery.dropoffLocation.lng },
        riskAlerts
      );
      
      console.log('Optimized route data received:', routeData);
      
      if (routeData.routes && routeData.routes.primary) {
        setActiveRoute(routeData.routes.primary);
        renderUniqueRoute(routeData.routes.primary, delivery, riskAlerts); // Pass riskAlerts to render function
      } else if (routeData.route) {
        // Handle basic route response
        setActiveRoute(routeData.route);
        renderFallbackRoute(delivery);
      } else {
        // Fallback if no route data
        renderFallbackRoute(delivery);
      }
    } catch (err) {
      console.error('Error updating route:', err);
      // Fallback to straight line if route service fails
      renderFallbackRoute(delivery);
    }
  };

  const renderUniqueRoute = (route, delivery, riskAlerts = []) => {
    // Clear existing route polylines
    polylinesRef.current.forEach(polyline => polyline.setMap(null));
    polylinesRef.current = [];
    
    console.log('Rendering route:', route);
    
    // Check if we have proper route points from microservice
    let routePath = [];
    if (route.route_points && route.route_points.length > 0) {
      // Use the route points from microservice
      routePath = route.route_points.map(point => ({
        lat: point.lat,
        lng: point.lng
      }));
      console.log('Using route points from microservice:', routePath.length, 'points');
    } else if (route.overview_polyline) {
      // If we have a polyline, we need to decode it
      try {
        // This would require a polyline decoding library
        // For now, we'll fall back to a straight line
        console.log('Route has polyline but no decoded points, falling back');
        renderFallbackRoute(delivery);
        return;
      } catch (err) {
        console.error('Error decoding polyline:', err);
        renderFallbackRoute(delivery);
        return;
      }
    } else {
      // Fallback if no route points
      console.log('No route points available, rendering fallback');
      renderFallbackRoute(delivery);
      return;
    }
    
    if (routePath.length === 0) {
      console.log('Route path is empty, rendering fallback');
      renderFallbackRoute(delivery);
      return;
    }
    
    // Create a unique visualization with gradient colors and animated effect
    // Base route
    const basePolyline = new window.google.maps.Polyline({
      path: routePath,
      geodesic: true,
      strokeColor: getRouteColor(delivery.status),
      strokeOpacity: 0.3,
      strokeWeight: 12
    });
    
    // Main route with gradient effect
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
    
    // Glow effect
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
    animateRouteProgress(routePath, delivery.status);
    
    // Add risk markers if any
    // First add any risks from the route data
    if (route.risks_on_route && route.risks_on_route.length > 0) {
      route.risks_on_route.forEach((risk, index) => {
        if (risk.coordinates && risk.coordinates.length >= 2) {
          const riskMarker = createAdvancedMarker(googleMapRef.current,
            { lat: risk.coordinates[0], lng: risk.coordinates[1] },
            {
              title: `${risk.type}: ${risk.description}`,
              icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: risk.severity === 'high' ? '#ef4444' : risk.severity === 'medium' ? '#f59e0b' : '#6b7280',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2
              }
            }
          );
          
          polylinesRef.current.push(riskMarker);
        }
      });
    }
    
    // Then add any additional risk alerts that might not be on the route
    if (riskAlerts && riskAlerts.length > 0) {
      riskAlerts.forEach((risk, index) => {
        // Check if this risk is already displayed
        const isAlreadyDisplayed = route.risks_on_route && route.risks_on_route.some(
          r => r.coordinates && risk.coordinates && 
          Math.abs(r.coordinates[0] - risk.coordinates[0]) < 0.0001 && 
          Math.abs(r.coordinates[1] - risk.coordinates[1]) < 0.0001
        );
        
        if (!isAlreadyDisplayed && risk.coordinates && risk.coordinates.length >= 2) {
          const riskMarker = createAdvancedMarker(googleMapRef.current,
            { lat: risk.coordinates[0], lng: risk.coordinates[1] },
            {
              title: `${risk.type}: ${risk.description}`,
              icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: risk.severity === 'high' ? '#ef4444' : risk.severity === 'medium' ? '#f59e0b' : '#6b7280',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2
              }
            }
          );
          
          polylinesRef.current.push(riskMarker);
        }
      });
    }
    
    // Fit map to show the route
    if (routePath.length > 0 && googleMapRef.current) {
      const bounds = new window.google.maps.LatLngBounds();
      routePath.forEach(point => {
        bounds.extend(new window.google.maps.LatLng(point.lat, point.lng));
      });
      googleMapRef.current.fitBounds(bounds);
    }
  };

  const renderFallbackRoute = (delivery) => {
    // Clear existing route polylines
    polylinesRef.current.forEach(polyline => polyline.setMap(null));
    polylinesRef.current = [];
    
    if (!agentPosition || !delivery.dropoffLocation?.lat || !delivery.dropoffLocation?.lng) {
      return;
    }
    
    // Create a fallback straight line with unique styling
    const routePath = [
      { lat: agentPosition.lat, lng: agentPosition.lng },
      { lat: delivery.dropoffLocation.lat, lng: delivery.dropoffLocation.lng }
    ];
    
    console.log('Rendering fallback route from', agentPosition, 'to', delivery.dropoffLocation);
    
    // Create multiple polylines for a unique layered effect
    // Base route
    const basePolyline = new window.google.maps.Polyline({
      path: routePath,
      geodesic: true,
      strokeColor: getRouteColor(delivery.status),
      strokeOpacity: 0.3,
      strokeWeight: 12
    });
    
    // Main route with gradient effect
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
    
    // Glow effect
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
    animateRouteProgress(routePath, delivery.status);
    
    // Fit map to show the route
    if (googleMapRef.current) {
      const bounds = new window.google.maps.LatLngBounds();
      routePath.forEach(point => {
        bounds.extend(new window.google.maps.LatLng(point.lat, point.lng));
      });
      googleMapRef.current.fitBounds(bounds);
    }
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

  const getStatusColor = (status, forLine = false) => {
    switch (status) {
      case 'assigned': return forLine ? '#3b82f6' : 'bg-blue-500'; // blue
      case 'in_transit': return forLine ? '#f59e0b' : 'bg-yellow-500'; // yellow
      case 'delivered': return forLine ? '#10b981' : 'bg-green-500'; // green
      default: return forLine ? '#6b7280' : 'bg-gray-500'; // gray
    }
  };

  if (loading) {
    return (
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Delivery Map</h3>
        </div>
        <div className="px-4 py-5 sm:px-6">
          <div className="flex justify-center items-center h-96">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
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
        <h3 className="text-lg leading-6 font-medium text-gray-900">Delivery Map</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          Visualize your deliveries and routes
        </p>
        {trackingActive && selectedDelivery && (
          <div className="mt-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Tracking active for delivery #{selectedDelivery.id?.substring(0, 8)}
            </span>
            <button
              onClick={stopTracking}
              className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-red-100 text-red-800 hover:bg-red-200"
            >
              Stop Tracking
            </button>
          </div>
        )}
      </div>
      <div className="px-4 py-5 sm:px-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-2/3">
            <div 
              ref={mapRef}
              className="w-full h-96 rounded-xl"
              style={{ minHeight: '400px' }}
            />
          </div>
          <div className="lg:w-1/3">
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {deliveries.map((delivery) => (
                  <li key={delivery.id}>
                    <div 
                      className={`block hover:bg-gray-50 cursor-pointer ${selectedDelivery?.id === delivery.id ? 'bg-blue-50' : ''}`}
                      onClick={() => {
                        if (trackingActive && selectedDelivery?.id === delivery.id) {
                          stopTracking();
                        } else {
                          startTracking(delivery);
                        }
                      }}
                    >
                      <div className="px-4 py-4 sm:px-6">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-blue-600 truncate">
                            Delivery #{delivery.id?.substring(0, 8)}
                          </p>
                          <div className="ml-2 flex-shrink-0 flex">
                            <p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(delivery.status)} text-white`}>
                              {delivery.status}
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
                              {delivery.pickupLocation?.address || 'N/A'}
                            </p>
                          </div>
                          <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                            <svg className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                            {delivery.dropoffLocation?.address || 'N/A'}
                          </div>
                        </div>
                        {delivery.status === 'in_transit' && delivery.dropoffLocation?.lat && delivery.dropoffLocation?.lng && agentPosition && (
                          <div className="mt-2 text-xs text-gray-500">
                            Distance to dropoff: {Math.round(calculateDistance(
                              agentPosition.lat, agentPosition.lng,
                              delivery.dropoffLocation.lat, delivery.dropoffLocation.lng
                            ))} meters
                          </div>
                        )}
                        {activeRoute && selectedDelivery?.id === delivery.id && (
                          <div className="mt-2 text-xs text-gray-500">
                            <div>Estimated time: {Math.round(activeRoute.duration_in_traffic || activeRoute.duration)} mins</div>
                            <div>Distance: {activeRoute.distance.toFixed(2)} km</div>
                          </div>
                        )}
                        <div className="mt-2">
                          {trackingActive && selectedDelivery?.id === delivery.id ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Tracking Active
                            </span>
                          ) : (
                            <button className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200">
                              {selectedDelivery?.id === delivery.id && trackingActive ? 'Stop Tracking' : 'Start Tracking'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Map;
