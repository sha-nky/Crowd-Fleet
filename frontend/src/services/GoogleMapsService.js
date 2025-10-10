// GoogleMapsService.js
let googleMapsLoaded = false;
let loadingPromise = null;

/**
 * Load Google Maps API script
 * @returns {Promise} Promise that resolves when Google Maps API is loaded
 */
export const loadGoogleMaps = () => {
  console.log('loadGoogleMaps called');
  // If already loaded, return resolved promise
  if (googleMapsLoaded) {
    console.log('Google Maps already loaded');
    return Promise.resolve();
  }
  
  // If already loading, return the existing promise
  if (loadingPromise) {
    console.log('Google Maps already loading');
    return loadingPromise;
  }
  
  // Check if already loaded but not marked as loaded
  if (window.google && window.google.maps) {
    console.log('Google Maps detected in window object');
    googleMapsLoaded = true;
    return Promise.resolve();
  }
  
  console.log('Loading Google Maps API');
  
  // Create new loading promise
  loadingPromise = new Promise((resolve, reject) => {
    // Create script element
    const script = document.createElement('script');
    // Use a placeholder API key - in a real app, this should come from backend
    const apiKey = 'AIzaSyBDXZORqJV_a3XJabuyFn_JcZcv0HW8TxI';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,directions&callback=Function.prototype`;
    script.async = true;
    script.defer = true;
    
    // Resolve promise when script loads
    script.onload = () => {
      console.log('Google Maps script loaded successfully');
      // Check if Google Maps loaded correctly
      if (window.google && window.google.maps) {
        console.log('Google Maps API is available');
        // Add a small delay to ensure API is fully initialized
        setTimeout(() => {
          googleMapsLoaded = true;
          loadingPromise = null;
          console.log('Google Maps fully initialized');
          resolve();
        }, 100);
      } else {
        console.error('Google Maps API not available after script load');
        loadingPromise = null;
        reject(new Error('Google Maps API not available after script load'));
      }
    };
    
    // Reject promise if script fails to load
    script.onerror = (error) => {
      console.error('Failed to load Google Maps script:', error);
      loadingPromise = null;
      reject(new Error('Failed to load Google Maps API'));
    };
    
    // Add script to document
    document.head.appendChild(script);
  });
  
  return loadingPromise;
};

/**
 * Get directions using Google Maps Directions API
 * @param {Object} startLocation - Start location {lat, lng}
 * @param {Object} endLocation - End location {lat, lng}
 * @returns {Promise} Promise that resolves with directions data
 */
export const getDirections = async (startLocation, endLocation) => {
  try {
    console.log('Checking Google Maps API availability');
    if (!window.google || !window.google.maps) {
      throw new Error('Google Maps API not loaded');
    }
    
    if (!window.google.maps.DirectionsService) {
      throw new Error('Google Maps DirectionsService not available');
    }
    
    console.log('Creating DirectionsService instance');
    const directionsService = new window.google.maps.DirectionsService();
    
    return new Promise((resolve, reject) => {
      console.log('Making directions request');
      directionsService.route(
        {
          origin: new window.google.maps.LatLng(startLocation.lat, startLocation.lng),
          destination: new window.google.maps.LatLng(endLocation.lat, endLocation.lng),
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (response, status) => {
          console.log('Directions response received with status:', status);
          if (status === 'OK') {
            console.log('Directions request successful');
            resolve(response);
          } else {
            console.log('Directions request failed with status:', status);
            reject(new Error(`Directions request failed due to ${status}`));
          }
        }
      );
    });
  } catch (error) {
    console.error('Error in getDirections:', error);
    throw error;
  }
};

/**
 * Render directions on the map
 * @param {Object} map - Google Maps instance
 * @param {Object} directions - Directions response from Google Maps
 * @param {Array} polylinesRef - Reference to store polyline instances
 * @param {string} status - Delivery status for color coding
 */
export const renderDirections = (map, directions, polylinesRef, status) => {
  try {
    console.log('renderDirections called with:', { map, directions, status });
    // Clear existing route polylines
    if (polylinesRef && polylinesRef.current) {
      polylinesRef.current.forEach(polyline => {
        if (polyline && typeof polyline.setMap === 'function') {
          polyline.setMap(null);
        }
      });
      polylinesRef.current = [];
    }
    
    // Get route color based on status
    const routeColor = getRouteColor(status);
    console.log('Using route color:', routeColor);
    
    // Check if DirectionsRenderer is available
    if (!window.google.maps.DirectionsRenderer) {
      throw new Error('Google Maps DirectionsRenderer not available');
    }
    
    // Create a directions renderer
    console.log('Creating DirectionsRenderer');
    const directionsRenderer = new window.google.maps.DirectionsRenderer({
      map: map,
      directions: directions,
      suppressMarkers: true, // We'll use our own markers
      polylineOptions: {
        strokeColor: routeColor,
        strokeOpacity: 0.8,
        strokeWeight: 6
      }
    });
    
    console.log('DirectionsRenderer created successfully');
    if (polylinesRef && polylinesRef.current) {
      polylinesRef.current.push(directionsRenderer);
    }
  } catch (error) {
    console.error('Error in renderDirections:', error);
    throw error;
  }
};

/**
 * Get route color based on delivery status
 * @param {string} status - Delivery status
 * @returns {string} Color code
 */
const getRouteColor = (status) => {
  switch (status) {
    case 'assigned': return '#3b82f6'; // blue
    case 'in_transit': return '#f59e0b'; // amber
    case 'delivered': return '#10b981'; // green
    default: return '#6b7280'; // gray
  }
};

/**
 * Initialize traditional Autocomplete widget (more reliable than PlaceAutocompleteElement)
 * @param {HTMLInputElement} input - Input element for the autocomplete
 * @param {Function} onPlaceSelect - Callback function when place is selected
 * @returns {Object} Autocomplete instance
 */
export const initAutocomplete = (input, onPlaceSelect) => {
  if (!window.google || !window.google.maps || !window.google.maps.places) {
    throw new Error('Google Maps Places library not loaded');
  }
  
  // Create Autocomplete instance with broader configuration
  const autocomplete = new window.google.maps.places.Autocomplete(input, {
    // Remove type restrictions to allow more place types
    // types: ['address'], // This was too restrictive
    fields: ['formatted_address', 'geometry', 'name', 'place_id'], // Request more fields
    // Add component restrictions if needed (uncomment and modify as appropriate)
    // componentRestrictions: { country: 'us' } // Example for US only
  });
  
  // Try to bias results toward user's current location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const geolocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        const circle = new window.google.maps.Circle({
          center: geolocation,
          radius: position.coords.accuracy
        });
        autocomplete.setBounds(circle.getBounds());
      },
      (error) => {
        console.log('Geolocation error, continuing without bias:', error);
      }
    );
  }
  
  // Add event listener
  autocomplete.addListener('place_changed', () => {
    const place = autocomplete.getPlace();
    console.log('Place selected:', place);
    
    // Check if place has the required data
    if (!place.geometry || !place.geometry.location) {
      // Place has no geometry
      onPlaceSelect({
        address: place.name || place.formatted_address || '',
        lat: null,
        lng: null
      });
      return;
    }
    
    // Extract location data
    const locationData = {
      address: place.formatted_address || place.name || '',
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng()
    };
    
    console.log('Sending location data to callback:', locationData);
    onPlaceSelect(locationData);
  });
  
  return autocomplete;
};

/**
 * Get current location using browser Geolocation API
 * @returns {Promise} Promise that resolves with current location coordinates
 */
export const getCurrentLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      (error) => {
        reject(new Error(`Geolocation error: ${error.message}`));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      }
    );
  });
};

/**
 * Create a modern marker using AdvancedMarkerElement
 * @param {Object} map - Google Maps instance
 * @param {Object} position - Marker position {lat, lng}
 * @param {Object} options - Marker options
 * @returns {AdvancedMarkerElement} AdvancedMarkerElement instance
 */
export const createAdvancedMarker = (map, position, options = {}) => {
  // Check if AdvancedMarkerElement is available (requires newer Google Maps version)
  if (window.google.maps.marker && window.google.maps.marker.AdvancedMarkerElement) {
    return new window.google.maps.marker.AdvancedMarkerElement({
      map: map,
      position: position,
      ...options
    });
  } else {
    // Fallback to traditional marker for older versions
    return new window.google.maps.Marker({
      map: map,
      position: position,
      ...options
    });
  }
};