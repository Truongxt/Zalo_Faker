require("dotenv").config();
const AWS = require("aws-sdk");
const bcrypt = require("bcryptjs");

AWS.config.update({
  region: process.env.REGION,
  accessKeyId: process.env.ACCESS_KEY_ID,
  secretAccessKey: process.env.SECRET_ACCESS_KEY,
});

const dynamodb = new AWS.DynamoDB.DocumentClient();

async function verifyLogin(email, password) {
    try {
        console.log(`Checking user: ${email}...`);
        const result = await dynamodb.scan({
            TableName: "User",
            FilterExpression: "email = :email",
            ExpressionAttributeValues: { ":email": email }
        }).promise();

        if (result.Items.length === 0) {
            console.log("❌ User not found in database.");
            return;
        }

        const user = result.Items[0];
        console.log(`✅ Found user: ${user.userName} (ID: ${user.userId})`);
        
        console.log("-----------------------------------------");
        console.log("Full Hashed password from DB:", user.password);
        console.log("-----------------------------------------");
        console.log("Comparing password...");
        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            console.log("✅ RESULT: Password matches!");
        } else {
            console.log("❌ RESULT: Password does NOT match.");
            console.log("Input password:", password);
        }
    } catch (e) {
        console.error("Error during verification:", e);
    }
}

const targetEmail = process.argv[2] || "demo1@zalo-faker.com";
const targetPass = process.argv[3] || "123456";

verifyLogin(targetEmail, targetPass);
