const {dynamodb} = require('../utils/aws-helper');

const  TABLE_NAME="Friends";

const FriendRepository= {

  // gửi request
  async createFriendRequest(userId, friendId) {
    const params = {
      TableName: TABLE_NAME,
      Item: {
        userId: userId,
        friendId: friendId,
        status: "pending",
        createdAt: Date.now(),
      },
    };

    await dynamodb.send(new PutCommand(params));
    return params.Item;
  },

  // lấy danh sách bạn
  async getFriends(userId) {
  const params = {
    TableName: TABLE_NAME,
    KeyConditionExpression: "userId = :uid",
    FilterExpression: "#s = :status",
    ExpressionAttributeNames: {
      "#s": "status",
    },
    ExpressionAttributeValues: {
      ":uid": userId,
      ":status": "accepted",
    },
  };

  const result = await dynamodb.send(new QueryCommand(params));
  return result.Items;
},

  // lấy request
  async getFriend(userId, friendId) {
    const params = {
      TableName: TABLE_NAME,
      Key: {
        userId,
        friendId,
      },
    };

    const result = await dynamodb.send(new GetCommand(params));
    return result.Item;
  },

  // accept request
  async acceptRequest(userId, friendId) {
    const params = {
      TableName: TABLE_NAME,
      Key: {
        userId,
        friendId,
      },
      UpdateExpression: "set #s = :status",
      ExpressionAttributeNames: {
        "#s": "status",
      },
      ExpressionAttributeValues: {
        ":status": "accepted",
      },
    };

    await dynamodb.send(new UpdateCommand(params));
  }
}

module.exports =  FriendRepository;