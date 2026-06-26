const admin = require("firebase-admin");
const prod = require("./prodAccKey.json");
const dev = require("./testAccKey.json");


admin.initializeApp({credential: admin.credential.cert(dev)});

const db = admin.firestore();

function generateProductKey() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let key = "";
  for (let i = 0; i < 8; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key.slice(0, 4) + "-" + key.slice(4);
}

async function populateProductKeys(count = 10) {
  const productTypes = ["Strap", "Glove", "Cushion"];

  for (let i = 0; i < count; i++) {
    const docRef = db.collection("ProductKeys").doc();
    await docRef.set({
      Distributor: "Cynteract",
      Key: generateProductKey(),
      ProductType: productTypes[Math.floor(Math.random() * productTypes.length)],
      Purpose: "Development",
      Sent: false,
      Used: false,
      UsedBy: "",
      UserType: "Patient"
    });
    console.log(`....added productkey ${i + 1}`);
  }
  console.log("Done populating ProductKeys!");
}


populateProductKeys(5000); 
