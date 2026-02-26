const { ulid } = require("ulid");

const generateId = async (prefix = "") => {
  const id = ulid(); // sortable theo thời gian
  return prefix ? `${prefix}_${id}` : id;
};

exports.generateId = generateId;