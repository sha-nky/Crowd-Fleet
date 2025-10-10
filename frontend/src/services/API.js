import { commonrequest } from "./APICall";
import { BACKEND_URL } from "./Helper";

// Auth APIs
export const testConnection = async () => {
  return await commonrequest("GET", `${BACKEND_URL}/api/sample`);
};

export const register = async (userData) => {
  return await commonrequest("POST", `${BACKEND_URL}/api/auth/register`, userData);
};

export const login = async (credentials) => {
  return await commonrequest("POST", `${BACKEND_URL}/api/auth/login`, credentials);
};

export const getProfile = async () => {
  console.log('Fetching user profile...');
  const result = await commonrequest("GET", `${BACKEND_URL}/api/profile`, null, {
    Authorization: `Bearer ${localStorage.getItem('token')}`
  });
  console.log('Profile result:', result);
  return result;
};

export const updateProfile = async (profileData) => {
  return await commonrequest("PUT", `${BACKEND_URL}/api/profile`, profileData, {
    Authorization: `Bearer ${localStorage.getItem('token')}`
  });
};

// Delivery APIs
export const createDelivery = async (deliveryData) => {
  console.log('Creating delivery with data:', deliveryData);
  const result = await commonrequest("POST", `${BACKEND_URL}/api/deliveries`, deliveryData, {
    Authorization: `Bearer ${localStorage.getItem('token')}`
  });
  console.log('Create delivery result:', result);
  return result;
};

export const getCustomerDeliveries = async () => {
  console.log('Fetching customer deliveries...');
  const result = await commonrequest("GET", `${BACKEND_URL}/api/deliveries/customer`, null, {
    Authorization: `Bearer ${localStorage.getItem('token')}`
  });
  console.log('Customer deliveries result:', result);
  return result;
};

/**
 * Get agent positions for customer map
 * @returns {Promise} Promise that resolves with agent positions data
 */
export const getAgentPositions = async () => {
  try {
    const response = await api.get('/api/agent-positions');
    return response.data;
  } catch (error) {
    console.error('Error fetching agent positions:', error);
    throw error;
  }
};

// Add an alias for getUserDeliveries to maintain backward compatibility
export const getUserDeliveries = getCustomerDeliveries;

export const getAgentDeliveries = async () => {
  return await commonrequest("GET", `${BACKEND_URL}/api/deliveries/agent`, null, {
    Authorization: `Bearer ${localStorage.getItem('token')}`
  });
};

export const getAvailableDeliveries = async () => {
  return await commonrequest("GET", `${BACKEND_URL}/api/deliveries/available`, null, {
    Authorization: `Bearer ${localStorage.getItem('token')}`
  });
};

export const assignDelivery = async (deliveryId) => {
  return await commonrequest("PUT", `${BACKEND_URL}/api/deliveries/${deliveryId}/assign`, {}, {
    Authorization: `Bearer ${localStorage.getItem('token')}`
  });
};

export const updateDeliveryStatus = async (deliveryId, statusData) => {
  // If marking as delivered and agentLocation is not already provided, get current agent location
  if (statusData.status === 'delivered' && !statusData.agentLocation) {
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          maximumAge: 10000,
          timeout: 5000
        });
      });
      
      statusData.agentLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
    } catch (error) {
      console.error('Error getting agent location:', error);
      // Continue without location - backend will handle the validation
    }
  }
  
  return await commonrequest("PUT", `${BACKEND_URL}/api/deliveries/${deliveryId}/status`, statusData, {
    Authorization: `Bearer ${localStorage.getItem('token')}`
  });
};

export const getDeliveryById = async (deliveryId) => {
  return await commonrequest("GET", `${BACKEND_URL}/api/deliveries/${deliveryId}`, null, {
    Authorization: `Bearer ${localStorage.getItem('token')}`
  });
};

// Analytics APIs
export const getDashboardStats = async () => {
  return await commonrequest("GET", `${BACKEND_URL}/api/analytics/dashboard`, null, {
    Authorization: `Bearer ${localStorage.getItem('token')}`
  });
};

export const getDeliveryAnalytics = async () => {
  return await commonrequest("GET", `${BACKEND_URL}/api/analytics/deliveries`, null, {
    Authorization: `Bearer ${localStorage.getItem('token')}`
  });
};

export const getAgentPerformance = async () => {
  return await commonrequest("GET", `${BACKEND_URL}/api/analytics/agents`, null, {
    Authorization: `Bearer ${localStorage.getItem('token')}`
  });
};

// Risk APIs
export const createRiskAlert = async (riskData) => {
  return await commonrequest("POST", `${BACKEND_URL}/api/risk/alerts`, riskData, {
    Authorization: `Bearer ${localStorage.getItem('token')}`
  });
};

export const getAllRiskAlerts = async () => {
  return await commonrequest("GET", `${BACKEND_URL}/api/risk/alerts`);
};

export const getNearbyRiskAlerts = async (params) => {
  const queryString = new URLSearchParams(params).toString();
  return await commonrequest("GET", `${BACKEND_URL}/api/risk/nearby?${queryString}`);
};

export const getDeliveryAffectedByRisks = async () => {
  return await commonrequest("GET", `${BACKEND_URL}/api/risk/affecting-deliveries`, null, {
    Authorization: `Bearer ${localStorage.getItem('token')}`
  });
};

// Admin APIs
export const getAllUsers = async () => {
  return await commonrequest("GET", `${BACKEND_URL}/api/admin/users`, null, {
    Authorization: `Bearer ${localStorage.getItem('token')}`
  });
};

export const getAllDeliveries = async () => {
  return await commonrequest("GET", `${BACKEND_URL}/api/admin/deliveries`, null, {
    Authorization: `Bearer ${localStorage.getItem('token')}`
  });
};

export const updateUserRole = async (userId, roleData) => {
  return await commonrequest("PUT", `${BACKEND_URL}/api/admin/users/${userId}/role`, roleData, {
    Authorization: `Bearer ${localStorage.getItem('token')}`
  });
};

export const deleteUser = async (userId) => {
  return await commonrequest("DELETE", `${BACKEND_URL}/api/admin/users/${userId}`, null, {
    Authorization: `Bearer ${localStorage.getItem('token')}`
  });
};