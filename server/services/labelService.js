const labelModel = require("../models/label");

const createLabel = async (data) => {
    return await labelModel.createLabel(data);
};

const getLabelsByUserId = async (userId) => {
    return await labelModel.getLabelsByUserId(userId);
};

const updateLabel = async (id, data) => {
    return await labelModel.updateLabel(id, data);
};

const deleteLabel = async (id) => {
    return await labelModel.deleteLabel(id);
};

module.exports = {
    createLabel,
    getLabelsByUserId,
    updateLabel,
    deleteLabel
};
