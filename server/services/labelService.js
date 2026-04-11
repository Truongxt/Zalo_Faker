const labelModel = require("../models/label");

const DEFAULT_LABELS = [
    { name: "Gia đình", color: "#EF4444" },
    { name: "Bạn thân", color: "#8B5CF6" },
    { name: "Bạn bè", color: "#10B981" },
    { name: "Công việc", color: "#F59E0B" }
];

const normalizeLabelName = (value = "") =>
    String(value)
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

const createLabel = async (data) => {
    return await labelModel.createLabel(data);
};

const ensureDefaultLabels = async (userId) => {
    const existingLabels = await labelModel.getLabelsByUserId(userId);
    const existingNames = new Set(
        (existingLabels || []).map((label) => normalizeLabelName(label.name))
    );

    const missingDefaults = DEFAULT_LABELS.filter(
        (label) => !existingNames.has(normalizeLabelName(label.name))
    );

    if (missingDefaults.length === 0) {
        return existingLabels;
    }

    await Promise.all(
        missingDefaults.map((label) =>
            labelModel.createLabel({
                userId,
                name: label.name,
                color: label.color
            })
        )
    );

    return labelModel.getLabelsByUserId(userId);
};

const getLabelsByUserId = async (userId) => {
    const labels = await ensureDefaultLabels(userId);
    const defaultOrder = new Map(
        DEFAULT_LABELS.map((label, index) => [normalizeLabelName(label.name), index])
    );

    return [...(labels || [])].sort((a, b) => {
        const aOrder = defaultOrder.get(normalizeLabelName(a.name));
        const bOrder = defaultOrder.get(normalizeLabelName(b.name));

        if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder;
        if (aOrder !== undefined) return -1;
        if (bOrder !== undefined) return 1;

        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    });
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
    deleteLabel,
    DEFAULT_LABELS
};
