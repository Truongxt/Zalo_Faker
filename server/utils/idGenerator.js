const { ulid } = require("ulid");

const generateId = async (prefix = "") => {
  return String(Date.now());
};

exports.generateId = generateId;