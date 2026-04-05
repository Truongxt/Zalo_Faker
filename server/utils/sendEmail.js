require("dotenv").config();
const nodemailer = require("nodemailer");


const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});


const sendEmail = async ({ to, subject, html }) => {
  try {
    const info = await transporter.sendMail({
      from: `"Chat App" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log("Email sent:", info.messageId);
    return true;
  } catch (err) {
    console.error("Send email error:", err);
    throw err;
  }
};


const sendOTPEmail = async ({ to, otp }) => {
  const html = `
    <h2>Xác thực tài khoản</h2>
    <p>Mã OTP của bạn là:</p>
    <h1 style="color:blue">${otp}</h1>
    <p>Mã có hiệu lực trong 5 phút.</p>
  `;

  return await sendEmail({
    to,
    subject: "Mã OTP xác thực",
    html,
  });
};

module.exports = {
  sendEmail,
  sendOTPEmail,
};