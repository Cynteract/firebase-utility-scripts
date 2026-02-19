const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

const prod = require("./servicaccky.json");
const dev = require("./testaccKey.json");


admin.initializeApp({credential: admin.credential.cert(dev)});

// smtp server
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "email@email.com", // ...has to be changed if u need to use it
    pass: "password", // same here 
  },
});

async function sendVerificationEmail(email) {
  const verificationLink =
    await admin.auth().generateEmailVerificationLink(email);

  await transporter.sendMail({
    from: "email@gemail.com", // should reflect what is up in 14
    to: email,
    subject: "Verify your email",
    html: `
      <p>Welcome to Cynteract </p>
      <p>Please verify your email by clicking the link below:</p>
      <a href="${verificationLink}">Verify Email</a>
      <p>If you didn’t request this, ignore this email.</p>
    `,
  });

  console.log("verification email sent to:", email);
}

sendVerificationEmail("test01@cynteract.com")
  .then(() => process.exit(0))
  .catch(err => {
    console.error("___error:", err);
    process.exit(1);
  });
