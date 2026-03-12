const {dynamodb} = require('../utils/aws-helper');

const  TABLE_NAME="Friends";

const FriendRepository= {

  // gửi request
  async createFriendRequest(fromUserId, toUserId, message) {
    const params = {
      TableName: TABLE_NAME,
      Item: {
        fromUserId: Number(fromUserId),
        toUserId: Number(toUserId),
        message: message,
        status: "pending",
        createdAt: Date.now(),
      },
    };

    await dynamodb.put(params).promise();
    return params.Item;
  },

  // lấy danh sách bạn (accepted)
  async getFriends(userId) {
  const params = {
    TableName: TABLE_NAME,
    FilterExpression: "(fromUserId = :uid OR toUserId = :uid) AND #s = :status",
    ExpressionAttributeNames: {
      "#s": "status",
    },
    ExpressionAttributeValues: {
      ":uid": Number(userId),
      ":status": "accepted",
    },
  };

  const result = await dynamodb.scan(params).promise();
  return result.Items;
},

  // lấy danh sách request pending gửi đến userId
  async getPendingRequests(userId) {
    const params = {
      TableName: TABLE_NAME,
      FilterExpression: "toUserId = :uid AND #s = :status",
      ExpressionAttributeNames: {
        "#s": "status",
      },
      ExpressionAttributeValues: {
        ":uid": Number(userId),
        ":status": "pending",
      },
    };

    const result = await dynamodb.scan(params).promise();
    return result.Items;
  },

  // lấy request
  async getFriend(fromUserId, toUserId) {
    const params = {
      TableName: TABLE_NAME,
      Key: {
        fromUserId: Number(fromUserId),
        toUserId: Number(toUserId),
      },
    };

    const result = await dynamodb.get(params).promise();
    return result.Item;
  },

  // accept request
  async acceptRequest(fromUserId, toUserId) {
    const params = {
      TableName: TABLE_NAME,
      Key: {
        fromUserId: Number(fromUserId),
        toUserId: Number(toUserId),
      },
      UpdateExpression: "set #s = :status",
      ExpressionAttributeNames: {
        "#s": "status",
      },
      ExpressionAttributeValues: {
        ":status": "accepted",
      },
    };

    await dynamodb.update(params).promise();
  },
  async getExitingFriend(fromUserId, toUserId) {
    const [direct, reverse] = await Promise.all([
      this.getFriend(fromUserId, toUserId),
      this.getFriend(toUserId, fromUserId),
    ]);

    return direct || reverse || null;
  }
  // async getStatusFriend(userId, friendId,status) {
  //  const result = await dynamodb.scan({
  //   TableName:TABLE_NAME,
  //   FilterExpression:"userId = :userId and friendId =: friendId and status = :status",
  //   ExpressionAttributeValues:{
  //     ":userId": Number(userId),
  //     ":friendId": Number(friendId),
  //     ":status": status
  //   }
  //  }).promise();
  //  return result.Items;
  // }
}

module.exports =  FriendRepository;