const { s3 } = require("../utils/aws-helper");
const { v4: uuidv4 } = require("uuid");

const uploadFile = async (file) => {
    // Generate unique name
    const originalName = file.originalname || "unnamed";
    // Get extension safely
    const fileExtension = originalName.includes('.') ? originalName.split(".").pop() : "bin";
    const fileName = `${uuidv4()}.${fileExtension}`;
    
    const params = {
        Bucket: process.env.S3_BUCKET_NAME || "zalo-faker-dev",
        Key: `uploads/${fileName}`,
        Body: file.buffer,
        ContentType: file.mimetype
    };

    const data = await s3.upload(params).promise();
    return data.Location; // Trả về public url
};

module.exports = {
    uploadFile
};
