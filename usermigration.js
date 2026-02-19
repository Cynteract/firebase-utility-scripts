const admin = require("firebase-admin");
const fs = require("fs");
const { URL } = require("url");

const prod = '/servicaccky.json'
const dev = '/testaccKey.json'

admin.initializeApp({
  credential: admin.credential.cert(require("./" + dev)),
});

const auth = admin.auth();
const db = admin.firestore();

async function migrate() {
  const users = await db.collection("User").get();
  let count = 0;
  const total = users.size
  for (const doc of users.docs) {
    if (!doc.data().hasOwnProperty("IsTestAccount")) {
      await doc.ref.update({ IsTestAccount: false });
      console.log(`Updated ${doc.id}`);
      count++
    }
  }
  console.log("total migration count: " + count + "/" + total)
}

migrate()