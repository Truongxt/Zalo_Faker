const { dynamodb } = require("../utils/aws-helper");
const tableName = "User";

const UserModel = {
  create: async item => {
    await dynamodb.put({
      TableName: tableName,
      Item: item
    }).promise();
    return item;
  },

  getAll: async () => {
    const data = await dynamodb.scan({ TableName: tableName }).promise();
    return data.Items;
  },

  update: async params => {
    const data = await dynamodb.update(params).promise();
    return data.Attributes;
  },

  delete: async userId => {
    await dynamodb.delete({
      TableName: tableName,
      Key: { userId }
    }).promise();
    return { userId };
  },

  getOne: async params => {
    const data = await dynamodb.query(params).promise();
    return data.Items[0];
  }
};

module.exports = UserModel;