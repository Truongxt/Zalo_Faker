const { uploadFile: uploadFileToStorage } = require("../services/file.service");

const uploadFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }
        
        const { folder = "uploads", subfolder = "chat" } = req.body;
        const fileUrl = await uploadFileToStorage(req.file, { folder, subfolder });
        
        res.json({ 
            url: fileUrl, 
            fileName: req.file.originalname, 
            fileSize: req.file.size,
            mimetype: req.file.mimetype 
        });
        
    } catch (error) {
        console.error("Upload error:", error);
        res.status(500).json({ message: "Failed to upload file", error: error.message });
    }
};

module.exports = {
   uploadFile
};
