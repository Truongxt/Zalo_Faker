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
const DEFAULT_PASSWORD = "123456";

async function getExistingEmails() {
  const emails = new Set();
  let ExclusiveStartKey;

  do {
    const result = await dynamodb
      .scan({
        TableName: TABLE_NAME,
        ProjectionExpression: "email",
        ExclusiveStartKey,
      })
      .promise();

    (result.Items || []).forEach((item) => {
      if (item.email) emails.add(String(item.email).toLowerCase());
    });

    ExclusiveStartKey = result.LastEvaluatedKey;
  } while (ExclusiveStartKey);

  return emails;
}

function buildSeedUsers(hashedPassword) {
  const now = Date.now();
  const users = [];

  for (let i = 1; i <= 10; i += 1) {
    users.push({
      userId: now + i,
      avartarUrl: "https://i.pravatar.cc/300?img=" + (i + 10),
      birthday: `199${i % 10}-0${(i % 9) + 1}-15`,
      createdAt: new Date().toISOString(),
      email: `user${i}@zalo-faker.com`,
      gender: i % 2 === 0 ? "female" : "male",
      password: hashedPassword,
      phone: `09000000${String(i).padStart(2, "0")}`,
      status: "active",
      userName: `Test User ${i}`,
    });
  }

  return users;
}

async function seedUsers() {
  try {
    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    const users = buildSeedUsers(hashedPassword);
    const existingEmails = await getExistingEmails();

    let createdCount = 0;
    let skippedCount = 0;

    for (const user of users) {
      if (existingEmails.has(user.email.toLowerCase())) {
        skippedCount += 1;
        continue;
      }

      await dynamodb
        .put({
          TableName: TABLE_NAME,
          Item: user,
          ConditionExpression: "attribute_not_exists(userId)",
        })
        .promise();

      createdCount += 1;
    }

    console.log(`Seed completed. Created: ${createdCount}, Skipped: ${skippedCount}`);
    console.log("Default password for created users: 123456");
  } catch (error) {
    console.error("Failed to seed users:", error.message);
    process.exitCode = 1;
  }
}

seedUsers();
