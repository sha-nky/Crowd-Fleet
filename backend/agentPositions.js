// backend/agentPositions.js
/**
 * Mock service for agent positions
 * In a real implementation, this would connect to a database or real-time tracking service
 */

// In-memory store for agent positions
const agentPositions = {};

/**
 * Update an agent's position
 * @param {string} agentId - The agent's ID
 * @param {Object} position - The agent's position {lat, lng}
 */
const updateAgentPosition = (agentId, position) => {
  agentPositions[agentId] = {
    ...position,
    timestamp: new Date().toISOString()
  };
};

/**
 * Get an agent's position
 * @param {string} agentId - The agent's ID
 * @returns {Object|null} The agent's position or null if not found
 */
const getAgentPosition = (agentId) => {
  return agentPositions[agentId] || null;
};

/**
 * Get all agent positions
 * @returns {Object} Object with agent IDs as keys and positions as values
 */
const getAllAgentPositions = () => {
  return { ...agentPositions };
};

/**
 * Get positions for specific agents
 * @param {Array} agentIds - Array of agent IDs
 * @returns {Object} Object with agent IDs as keys and positions as values
 */
const getAgentPositionsByIds = (agentIds) => {
  const positions = {};
  agentIds.forEach(id => {
    if (agentPositions[id]) {
      positions[id] = agentPositions[id];
    }
  });
  return positions;
};

module.exports = {
  updateAgentPosition,
  getAgentPosition,
  getAllAgentPositions,
  getAgentPositionsByIds
};