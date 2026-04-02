const { dynamodb } = require("../utils/aws-helper");
const { v4: uuidv4 } = require("uuid");

const tableName = "Label";

const LabelModel = {
  createLabel: async (data) => {
    const labelId = uuidv4();
    const item = {
      _id: labelId,
      userId: data.userId,
      name: data.name,
      color: data.color || "#0068ff",
      createdAt: new Date().toISOString()
    };
    const params = {
      TableName: tableName,
      Item: item
    };
    await dynamodb.put(params).promise();
    return item;
  },

  getLabelsByUserId: async (userId) => {
    const params = {
      TableName: tableName,
      FilterExpression: "userId = :userId",
      ExpressionAttributeValues: { ":userId": userId }
    };
    const data = await dynamodb.scan(params).promise();
    return data.Items;
  },

  updateLabel: async (labelId, data) => {
    const updateFields = [];
    const ExpressionAttributeNames = {};
    const ExpressionAttributeValues = {};

    if (data.name !== undefined) {
      updateFields.push("#name = :name");
      ExpressionAttributeNames["#name"] = "name";
      ExpressionAttributeValues[":name"] = data.name;
    }
    if (data.color !== undefined) {
      updateFields.push("#color = :color");
      ExpressionAttributeNames["#color"] = "color";
      ExpressionAttributeValues[":color"] = data.color;
    }

    if (updateFields.length === 0) return null;

    const params = {
      TableName: tableName,
      Key: { _id: labelId },
      UpdateExpression: `set ${updateFields.join(", ")}`,
      ExpressionAttributeNames,
      ExpressionAttributeValues,
      ReturnValues: "ALL_NEW"
    };

    const updated = await dynamodb.update(params).promise();
    return updated.Attributes;
  },

  deleteLabel: async (labelId) => {
    const params = {
      TableName: tableName,
      Key: { _id: labelId }
    };
    await dynamodb.delete(params).promise();
    return { _id: labelId };
  }
};

module.exports = LabelModel;
