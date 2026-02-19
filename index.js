const admin = require("firebase-admin");
const serviceAccount = require("./servicaccky.json");
const testaccKey = require("./testaccKey.json");

admin.initializeApp({
  credential: admin.credential.cert(testaccKey),
});

const db = admin.firestore();

async function main() {
  // users with productkey == null and therapistId null
  const usersSnapshot = await db
    .collection("User")
    .where("ProductKey", "==", null)
    .where("TherapistId", "==", null)
    .get();

  const userIds = usersSnapshot.docs.map(doc => doc.id);

  if (userIds.length === 0) {
    console.log("no users found.");
    return;
  }

  console.log("total User IDs:", userIds.length);

  const idToEmail = {};

  for (const uid of userIds) {
    try {
      const userRecord = await auth.getUser(uid);
      idToEmail[uid] = userRecord.email;
    } catch (err) {
      idToEmail[uid] = "no email";
    }
  }

  console.log("Total without emails: ", idToEmail.length);
  let havePlayer = 0;
  let noPlayer = 0;

  // check player collection for each user ID
  for (const uid of userIds) {
    const playerDoc = await db.collection("Player").doc(uid).get();
    if (playerDoc.exists) {
      havePlayer++;
    } else {
      noPlayer++;
    }
  }

  console.log("users with player document:", havePlayer);
  console.log("users without player document:", noPlayer);

  // query player collection for each userId and log
  // for (const id of userIds) {
  //   const playerDoc = await db.collection("Player").doc(id).get();
  //   if (playerDoc.exists) {
  //     console.log("player document:", playerDoc.id);
  //   } else {
  //     console.log("no player found for user ID:", id);
  //   }

  //   if (!playerDoc.exists) {
  //     console.log("no player found for user ID:", id);
  //   }
  // }
}

main().catch(console.error);

