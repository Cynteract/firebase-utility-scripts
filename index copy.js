// const admin = require("firebase-admin");
// const fs = require("fs");
// const { URL } = require("url");

// const prod = '/servicaccky.json'
// const dev = '/testaccKey.json'

// admin.initializeApp({
//   credential: admin.credential.cert(require("./" + prod)),
// });

// const auth = admin.auth();
// const db = admin.firestore();


async function deleteOfflineUsers() {
  let nextPageToken = undefined;
  let deletedCount = 0;

  do {
    const listUsersResult = await auth.listUsers(1000, nextPageToken);
    const offlineUsers = listUsersResult.users.filter(user =>
      user.email?.startsWith("offline1-") && user.email.endsWith("@local.cynteract.com")
    );

    for (const user of offlineUsers) {
      const uid = user.uid;

      try {
        await auth.deleteUser(uid);
        console.log(`Deleted Auth user: ${uid} and email: ${user.email}) `);

        await db.collection("User").doc(uid).delete();
        await db.collection("Player").doc(uid).delete();
        console.log(`Deleted Firestore docs for: ${uid}`);
        deletedCount++;
      } catch (error) {
        console.error(`Error deleting ${uid}:`, error.message);
      }
    }

    nextPageToken = listUsersResult.pageToken;
  } while (nextPageToken);

  console.log(`Total users deleted: ${deletedCount}`);
}

async function migrate(collectionName) {
  const users = await db.collection(collectionName).get();
  let count = 0;
  const total = users.size
  for (const doc of users.docs) {
    if (!doc.data().hasOwnProperty("IsDeleted")) {
      await doc.ref.update({ IsDeleted: false });
      console.log(`Updated ${doc.id}`);
      count++
    }
  }
  console.log("total migration count: " + count + "/" + total)
}
async function collectionCount(collectionName) {
  const snapshot = await db.collection(collectionName).get();
  console.log("total " + collectionName + " count: " + snapshot.size)
}

async function generateCustomVerificationLink(email) {
  const record = await auth.getUserByEmail(email);
  console.log("$$$$$$$$$")
  console.log(record.emailVerified)
  console.log("$$$$$$$$$")

  const actionCodeSettings = {
    url: "http://localhost:3000/verify", 
    handleCodeInApp: true,
  };
  const longLink = await admin.auth().generateEmailVerificationLink(email, actionCodeSettings);

    // Parse Firebase’s generated URL
  const url = new URL(longLink);
  const oobCode = url.searchParams.get("oobCode");
  const mode = url.searchParams.get("mode");

  console.log("--------------")
  console.log(longLink);
  console.log("--------------")


  console.log("-=-=-=-=-=-=-=-=-=-=-")
  console.log(oobCode);
  console.log("-=-=-=-=-=-=-=-=-=-=-")


  const customLink = `http://localhost:3000/verify?oobCode=${encodeURIComponent(longLink)}`;
  const newcustom = `http://localhost:3000/verify?oobCode=${oobCode}&mode=${mode}`;
  console.log("***********************")
  console.log(customLink);
  console.log("***********************")
  console.log(newcustom);
}

async function listOfflineUsersOnly() {
  let nextPageToken = undefined;
  let matchCount = 0;

  do {
    const listUsersResult = await auth.listUsers(1000, nextPageToken);
    
    const offlineUsers = listUsersResult.users.filter(user =>
      user.email?.startsWith("offline1-") && user.email.endsWith("@local.cynteract.com")
    );

    for (const user of offlineUsers) {
      console.log(`👤 Found user: ${user.uid} | ${user.email}`);
      matchCount++;
    }

    nextPageToken = listUsersResult.pageToken;
  } while (nextPageToken);

  console.log(`📊 Total matching users: ${matchCount}`);
}


//  RUN-----
// generateCustomVerificationLink("thousand-knruood@local.cynteract.com").catch(console.error);
// migrate("User").then(() => {console.log("*** migration complete ***");});
// collectionCount("User").catch(console.error);

// deleteOfflineUsers().catch(console.error);

// listOfflineUsersOnly().catch(console.error);


// const usersQuery = await db.collection('User').where('ProductKey', '==', null).get();
// const userIds = usersQuery.docs.map(doc => doc.id);   

// const playersQuery = await db.collection('Player')
//   .where(firebase.firestore.FieldPath.documentId(), 'in', userIds)
//   .get();   


// const admin = require("firebase-admin");
// const serviceAccount = require("./servicaccky.json");

// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
// });

// const db = admin.firestore();

// async function main() {
//   // users with ProductKey == null
//   const usersSnapshot = await db
//     .collection("User")
//     .where("ProductKey", "==", null)
//     .where("TherapistId", "==", null)
//     .get();

//   // extract user document IDs
//   const userIds = usersSnapshot.docs.map(doc => doc.id);

//   if (userIds.length === 0) {
//     console.log("no users found.");
//     return;
//   }

//   console.log("total user IDs:", userIds.length);

//   // map to store ID -> email
//   const idToEmail = {};

//   // 3. Fetch emails from Firebase Authentication
//   for (const uid of userIds) {
//     try {
//       const userRecord = await auth.getUser(uid);
//       idToEmail[uid] = userRecord.email;
//     } catch (err) {
//       // console.log(`no auth user for ID: ${uid}`);
//       idToEmail[uid] = "no email";
//     }
//   }

//   // log result
//   // console.log("user ID -> Email mapping:");
//   console.log("total without emails: ", idToEmail.length);

//   let havePlayer = 0;
//   let noPlayer = 0;

//   // check player collection for each user ID
//   for (const uid of userIds) {
//     const playerDoc = await db.collection("Player").doc(uid).get();
//     if (playerDoc.exists) {
//       havePlayer++;
//     } else {
//       noPlayer++;
//     }
//   }

//   // log
//   console.log("users with player document:", havePlayer);
//   console.log("users without player document:", noPlayer);

//   // 3. Query Player collection for each user ID and log
//   // for (const id of userIds) {
//   //   const playerDoc = await db.collection("Player").doc(id).get();
//   //   if (playerDoc.exists) {
//   //     console.log("Player Document:", playerDoc.id);
//   //   } else {
//   //     console.log("no player found for user ID:", id);
//   //   }

//   //   if (!playerDoc.exists) {
//   //     console.log("no player found for user ID:", id);
//   //   }
//   // }
// }

// main().catch(console.error);

//

await admin.auth().generateEmailVerificationLink("test01@cynteract.com");

admin.auth().sendverificationEmail("test01@cynteract.com");

