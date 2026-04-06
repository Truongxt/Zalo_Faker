const bcrypt = require("bcryptjs");

const hash = "$2b$10$efYRtnrwfCMX3SZmhr10YOhWfKW0CbBMd7g8TQavIXfNJNm2ztZlK";
const password = "123456";

bcrypt.compare(password, hash, (err, res) => {
    if (err) {
        console.error("Error:", err);
    } else {
        console.log("Password matches:", res);
    }
});
