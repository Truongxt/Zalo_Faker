require("dotenv").config();
const AWS = require("aws-sdk");
const bcrypt = require("bcryptjs");

AWS.config.update({
  region: process.env.REGION,
  accessKeyId: process.env.ACCESS_KEY_ID,
  secretAccessKey: process.env.SECRET_ACCESS_KEY,
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = "User";
const DEFAULT_PASSWORD = process.env.DEFAULT_TEST_PASSWORD || "123456nhan123@@";
const TEST_EMAIL_DOMAIN = (process.env.TEST_EMAIL_DOMAIN || "@zalo-faker.com").toLowerCase();

async function scanUsers() {
  const users = [];
  let ExclusiveStartKey;

  do {
    const result = await dynamodb
      .scan({
        TableName: TABLE_NAME,
        ExclusiveStartKey,
      })
      .promise();

    users.push(...(result.Items || []));
    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  return users;
}

async function resetPasswords() {
  try {
    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    const users = await scanUsers();

    const targetUsers = users.filter((user) => {
      const email = String(user.email || "").toLowerCase();
      return email.endsWith(TEST_EMAIL_DOMAIN);
    });

    let updatedCount = 0;

    for (const user of targetUsers) {
      await dynamodb
        .update({
          TableName: TABLE_NAME,
          Key: { userId: String(user.userId) },
          UpdateExpression: "SET #password = :password",
          ExpressionAttributeNames: {
            "#password": "password",
          },
          ExpressionAttributeValues: {
            ":password": hashedPassword,
          },
          ReturnValues: "NONE",
        })
        .promise();

      updatedCount += 1;
    }

    console.log(`Reset password for ${updatedCount} test users.`);
    console.log(`Default password: ${DEFAULT_PASSWORD}`);
    console.log(`Matched email domain: ${TEST_EMAIL_DOMAIN}`);
  } catch (error) {
    console.error("Failed to reset test user passwords:", error.message);
    process.exitCode = 1;
  }
}

resetPasswords();