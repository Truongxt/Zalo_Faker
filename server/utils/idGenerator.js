const { ulid } = require("ulid");

const generateId = async (prefix = "") => {
  // DynamoDB key type = N → return numeric timestamp-based ID
  return Date.now();
};

exports.generateId = generateId;