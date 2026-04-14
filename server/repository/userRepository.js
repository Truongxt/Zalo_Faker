const { get } = require("../models/refreshTokenModel");
const { dynamodb } = require("../utils/aws-helper");
const User = require("../models/userModel");
const tableName = "User";
const userRepository = {
    async register(user) {
        const normalizedUser = new User(user);
        await dynamodb.put({
            TableName: tableName,
            Item: normalizedUser
        }).promise();
        return normalizedUser;
    },
    async getAll() {
        const result = await dynamodb.scan({
            TableName: tableName
        }).promise();
        return result.Items;
    },
    async getByEmail(email) {
        const result = await dynamodb.scan({
            TableName: tableName,
            FilterExpression: "email = :email",
            ExpressionAttributeValues: {
                ":email": email
            }
        }).promise();
        return result.Items[0];
    },
    async getByPhone(phone) {
        const result = await dynamodb.scan({
            TableName: tableName,
            FilterExpression: "phone = :phone",
            ExpressionAttributeValues: {
                ":phone": phone
            }
        }).promise();
        return result.Items[0];
    },
    async getById(userId) {
        const result = await dynamodb.get({
            TableName: tableName,
            Key: { userId: String(userId) }
        }).promise();

        return result.Item;
    },
    async update(params) {
        const result = await dynamodb.update(params).promise();
        return result.Attributes;
    },
    async updateUser(userId, userData) {
        const user = await dynamodb.get({
            TableName: tableName,
            Key: { userId: String(userId) }
        }).promise();

        if (!user.Item) {
            throw new Error("User not found");
        }
        const newUser = { ...user.Item, ...userData };
        await dynamodb.put({
            TableName: tableName,
            Item: newUser
        }).promise();
    },
    //     async getFriends(userId) {

    //     const user = await this.getById(userId);

    //     if (!user.Item) {
    //         throw new Error("User not found");
    //     }

    //     const friendIds = user.Item.friends || [];

    //     const friends = await Promise.all(
    //         friendIds.map(async (id) => {
    //             const result = await dynamodb.get({
    //                 TableName: tableName,
    //                 Key: { userId: id }
    //             }).promise();

    //             return result.Item;
    //         })
    //     );

    //     return friends;
    // }



}

module.exports = userRepository;
