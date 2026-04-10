require("dotenv").config();
const AWS = require("aws-sdk");

AWS.config.update({
  region: process.env.REGION,
  accessKeyId: process.env.ACCESS_KEY_ID,
  secretAccessKey: process.env.SECRET_ACCESS_KEY,
});

const dynamodb = new AWS.DynamoDB();
const TABLE_NAME = "AIChatMessages";

async function createAIChatMessagesTable() {
  try {
    const existingTables = await dynamodb.listTables({}).promise();
    if (existingTables.TableNames.includes(TABLE_NAME)) {
      console.log(`Table '${TABLE_NAME}' already exists.`);
      return;
    }

    const params = {
      TableName: TABLE_NAME,
      KeySchema: [
        { AttributeName: "conversationId", KeyType: "HASH" },
        { AttributeName: "chatId", KeyType: "RANGE" },
      ],
      AttributeDefinitions: [
        { AttributeName: "conversationId", AttributeType: "S" },
        { AttributeName: "chatId", AttributeType: "S" },
        { AttributeName: "userId", AttributeType: "S" },
        { AttributeName: "askedAt", AttributeType: "S" },
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: "userId-askedAt-index",
          KeySchema: [
            { AttributeName: "userId", KeyType: "HASH" },
            { AttributeName: "askedAt", KeyType: "RANGE" },
          ],
          Projection: {
            ProjectionType: "ALL",
          },
        },
      ],
      BillingMode: "PAY_PER_REQUEST",
    };

    await dynamodb.createTable(params).promise();
    console.log(`Creating table '${TABLE_NAME}'...`);
    await dynamodb.waitFor("tableExists", { TableName: TABLE_NAME }).promise();
    console.log(`Table '${TABLE_NAME}' created successfully.`);
  } catch (error) {
    console.error("Failed to create table:", error.message);
    process.exitCode = 1;
  }
}

createAIChatMessagesTable();