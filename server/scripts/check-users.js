require("dotenv").config();
const AWS = require("aws-sdk");

AWS.config.update({
  region: process.env.REGION,
  accessKeyId: process.env.ACCESS_KEY_ID,
  secretAccessKey: process.env.SECRET_ACCESS_KEY,
});

const dynamodb = new AWS.DynamoDB.DocumentClient();

async function checkUsers() {
    try {
        const result = await dynamodb.scan({ TableName: "User" }).promise();
        console.log("Total users found:", result.Items.length);
        result.Items.forEach(u => {
            console.log(`[USER] Email: ${u.email} | ID: ${u.userId} | Name: ${u.userName}`);
        });
    } catch (e) {
        console.error("Error fetching users:", e);
    }
}

checkUsers();
