// MicroserviceAPI.js
/**
 * Service to communicate with Python microservices for route optimization and risk detection
 */

const MICROSERVICE_BASE_URL = 'http://localhost:5001'; // Route optimizer service
const RISK_SERVICE_URL = 'http://localhost:5002'; // Risk detector service

/**
 * Helper function to make fetch requests with timeout
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise} Promise that resolves with fetch response
 */
const fetchWithTimeout = (url, options, timeout = 10000) => {
  console.log('Making fetch request to:', url);
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => {
        console.log('Fetch request timed out after', timeout, 'ms');
        reject(new Error('Request timeout'));
      }, timeout)
    )
  ]);
};

/**
 * Get optimized route from agent's current location to delivery dropoff point
 * @param {Object} startLocation - Agent's current location {lat, lng}
 * @param {Object} endLocation - Delivery dropoff location {lat, lng}
 * @param {Array} riskAlerts - Array of risk alerts to avoid
 * @returns {Promise} Promise that resolves with optimized route data
 */
export const getOptimizedRoute = async (startLocation, endLocation, riskAlerts = []) => {
  try {
    console.log('Requesting optimized route from', startLocation, 'to', endLocation);
    const requestData = {
      start_location: startLocation,
      end_location: endLocation,
      risk_alerts: riskAlerts,
      risk_aware: true
    };
    
    console.log('Sending request data:', requestData);
    
    const response = await fetchWithTimeout(`${MICROSERVICE_BASE_URL}/optimize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData)
    }, 15000); // 15 second timeout

    if (!response.ok) {
      const errorText = await response.text();
      console.error('HTTP error response:', response.status, errorText);
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const data = await response.json();
    console.log('Optimized route response:', data);
    
    // Ensure the response has the expected structure
    if (!data.routes && !data.route) {
      console.warn('Unexpected route response structure:', data);
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching optimized route:', error);
    throw error;
  }
};

/**
 * Get alternative routes
 * @param {Object} startLocation - Agent's current location {lat, lng}
 * @param {Object} endLocation - Delivery dropoff location {lat, lng}
 * @param {Array} riskAlerts - Array of risk alerts to avoid
 * @returns {Promise} Promise that resolves with alternative routes
 */
export const getAlternativeRoutes = async (startLocation, endLocation, riskAlerts = []) => {
  try {
    const response = await fetchWithTimeout(`${MICROSERVICE_BASE_URL}/alternatives`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        start_location: startLocation,
        end_location: endLocation,
        risk_alerts: riskAlerts
      })
    }, 15000); // 15 second timeout

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching alternative routes:', error);
    throw error;
  }
};

/**
 * Detect risks in the area
 * @param {Object} location - Location to check for risks {lat, lng}
 * @param {number} radiusKm - Radius in kilometers to search for risks
 * @returns {Promise} Promise that resolves with risk data
 */
export const detectRisks = async (location, radiusKm = 10) => {
  try {
    console.log('Detecting risks at location:', location, 'within', radiusKm, 'km');
    const response = await fetchWithTimeout(`${RISK_SERVICE_URL}/detect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        location: location,
        radius_km: radiusKm
      })
    }, 15000); // 15 second timeout

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Risk detection response:', data);
    return data;
  } catch (error) {
    console.error('Error detecting risks:', error);
    // Return empty risks array as fallback
    return { risks: [], count: 0, risk_score: 0 };
  }
};

/**
 * Geocode an address to coordinates
 * @param {string} address - Address to geocode
 * @returns {Promise} Promise that resolves with geocoded location
 */
export const geocodeAddress = async (address) => {
  try {
    const response = await fetchWithTimeout(`${MICROSERVICE_BASE_URL}/geocode`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address: address
      })
    }, 10000); // 10 second timeout

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error geocoding address:', error);
    throw error;
  }
};

/**
 * Reverse geocode coordinates to address
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise} Promise that resolves with reverse geocoded address
 */
export const reverseGeocode = async (lat, lng) => {
  try {
    const response = await fetchWithTimeout(`${MICROSERVICE_BASE_URL}/reverse-geocode`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        lat: lat,
        lng: lng
      })
    }, 10000); // 10 second timeout

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error reverse geocoding:', error);
    throw error;
  }
};

export default {
  getOptimizedRoute,
  getAlternativeRoutes,
  detectRisks,
  geocodeAddress,
  reverseGeocode
};