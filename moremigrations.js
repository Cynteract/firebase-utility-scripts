const admin = require("firebase-admin");
// const fs = require("fs");
// const { URL } = require("url");

const prod = '/prodAccKey.json'
// const dev = '/testAccKey.json'

admin.initializeApp({
  credential: admin.credential.cert(require("./" + prod)),
});

const auth = admin.auth();
const db = admin.firestore();


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

async function isTestAccountMigration(collectionName) {
  const users = await db.collection(collectionName).get();
  let count = 0;
  const total = users.size
  for (const doc of users.docs) {
    if (!doc.data().hasOwnProperty("IsTestAccount")) {
      await doc.ref.update({ IsTestAccount: false });
      console.log(`Updated ${doc.id}`);
      count++
    }
  }
  console.log("total istestAccount migration count: " + count + "/" + total)
}

async function numberOfTestAccounts(collectionName) {
  const users = await db.collection(collectionName).get();
  let count = 0;
  let testAccounts = [];
  const total = users.size
  for (const doc of users.docs) {
    if (doc.data().IsTestAccount) {
      count++

      let email = "no email";
      try {
        const userRecord = await auth.getUser(doc.id);
        email = userRecord.email || "no email";
      } catch (err) {
        email = "no email";
      }

      testAccounts.push({ id: doc.id, email: email })
    }
  }
  console.log("total istestAccount count: " + count + "/" + total)
  for (const acc of testAccounts) {
    console.log("test account ID: " + acc.id + " | email: " + acc.email)
  }
}

async function findUsersByEmailKeywords(keywords) {
  if (!keywords || keywords.length === 0) {
    console.log("no keywords provided");
    return [];
  }

  const needles = keywords.map(k => k.toLowerCase().trim()).filter(Boolean);

  let nextPageToken;
  let scanned = 0;
  const matches = [];

  do {
    const page = await auth.listUsers(1000, nextPageToken);
    scanned += page.users.length;
    for (const u of page.users) {
      if (!u.email) continue;
      const emailLower = u.email.toLowerCase();
      const hit = needles.find(k => emailLower.includes(k));
      if (hit) matches.push({ uid: u.uid, email: u.email, matched: hit });
    }
    nextPageToken = page.pageToken;
  } while (nextPageToken);

  console.log(`scanned ${scanned} users | found ${matches.length} matching:`, keywords);
  for (const m of matches) {
    console.log(`  ${m.uid} | ${m.email} | matched: "${m.matched}"`);
  }
  return matches;
}

async function markTestAccountsByEmail() {
  const emails = [
    "devkwekuabeiku@gmail.com",
    "kwesikwaahayford@gmail.com",
    "Mhiracleebenezer@gmail.com",
    "bnaij554@mtroyal.ca",
    "m.n.wessely@gmail.com",
    "m.wessely@autak.org", 
    "m.wessely@cynteract.com",
    "adam.brunnmeier@gmail.comm",
    "adam.brunnmeier@rwth-aachen.de",
    "a.brunnmeier@cynteract.com",
    "test00@cynteract.com",
    "test01@cynteract.com",
    "test02@cynteract.com",
    "test03@cynteract.com",
    "test04@cynteract.com",
    "test05@cynteract.com",
    "test06@cynteract.com",
    "test07@cynteract.com",
    "test08@cynteract.com",
    "test09@cynteract.com",
    "davidadzato45@gmail.com",
    "mishra.aditi.cynteract@gmail.com",
    "mindy1896@gmail.com",
    "a.jovanovic@help-24.at",
    "a.mishra@cynteract.com",
    "geetham.gsc2@gmail.com",
    "geetham.gsc@gmail.com",
    "lnr@manntel.com",
  ];

  const keywords = [
    "suemmermann",
    " gernot",
    "emeka",
    "aditi",
    "addy",
  ];

  if (keywords.length > 0) {
    const found = await findUsersByEmailKeywords(keywords);
    for (const m of found) emails.push(m.email);
  }

  if (emails.length === 0) {
    console.log("no emails provided");
    return;
  }

  const emailToUid = new Map();
  const notFoundRaw = [];
  for (let i = 0; i < emails.length; i += 100) {
    const chunk = emails.slice(i, i + 100).map(email => ({ email }));
    const result = await auth.getUsers(chunk);
    for (const u of result.users) emailToUid.set(u.email, u.uid);
    for (const id of result.notFound) if (id.email) notFoundRaw.push(id.email);
  }
  console.log(`resolved ${emailToUid.size}/${emails.length} emails to UIDs`);

  const storedByLower = new Map();
  for (const stored of emailToUid.keys()) storedByLower.set(stored.toLowerCase(), stored);

  const trulyNotFound = [];
  for (const input of notFoundRaw) {
    const stored = storedByLower.get(input.toLowerCase());
    if (stored) {
      console.log(`case mismatch | input: ${input} | matched stored email: ${stored}`);
    } else {
      trulyNotFound.push(input);
    }
  }
  if (trulyNotFound.length) console.log("no Auth user for:", trulyNotFound);

  const entries = [...emailToUid.entries()];
  const refs = entries.map(([, uid]) => db.collection("User").doc(uid));
  const snaps = [];
  for (let i = 0; i < refs.length; i += 500) {
    const chunkRefs = refs.slice(i, i + 500);
    const chunkSnaps = await db.getAll(...chunkRefs);
    snaps.push(...chunkSnaps);
  }

  const toUpdate = [];
  const alreadySet = [];
  const missingDoc = [];
  for (let i = 0; i < entries.length; i++) {
    const [email, uid] = entries[i];
    const snap = snaps[i];
    if (!snap.exists) {
      missingDoc.push({ email, uid });
    } else if (snap.data().IsTestAccount === true) {
      alreadySet.push({ email, uid });
    } else {
      toUpdate.push({ email, uid });
    }
  }

  for (const item of alreadySet) {
    console.log(`already set | email: ${item.email} | uid: ${item.uid} | IsTestAccount: true (skipping)`);
  }
  for (const item of missingDoc) {
    console.log(`no User doc | email: ${item.email} | uid: ${item.uid}`);
  }

  const writer = db.bulkWriter();
  writer.onWriteError((err) => {
    if (err.code === 5) return false; // NOT_FOUND: User doc missing, don't retry
    return err.failedAttempts < 3;
  });

  const succeededList = [];
  const failed = [];
  for (const { email, uid } of toUpdate) {
    writer.update(db.collection("User").doc(uid), { IsTestAccount: true })
      .then(() => succeededList.push({ email, uid, IsTestAccount: true }))
      .catch((err) => failed.push({ email, uid, code: err.code }));
  }
  await writer.close();

  for (const item of succeededList) {
    console.log(`updated | email: ${item.email} | uid: ${item.uid} | IsTestAccount: ${item.IsTestAccount}`);
  }
  if (failed.length) console.log("failed updates:", failed);
}

async function playersWithIngameCurrency(min) {
  const snap = await db.collection("Player").where("IngameCurrency", ">=", min).get();
  console.log(`found ${snap.size} Player docs with IngameCurrency >= ${min}`);

  const uids = snap.docs.map(d => d.id);

  const uidToEmail = new Map();
  for (let i = 0; i < uids.length; i += 100) {
    const chunk = uids.slice(i, i + 100).map(uid => ({ uid }));
    const result = await auth.getUsers(chunk);
    for (const u of result.users) uidToEmail.set(u.uid, u.email || "no email");
  }

  const userRefs = uids.map(uid => db.collection("User").doc(uid));
  const userSnaps = [];
  for (let i = 0; i < userRefs.length; i += 500) {
    const chunk = userRefs.slice(i, i + 500);
    const chunkSnaps = await db.getAll(...chunk);
    userSnaps.push(...chunkSnaps);
  }
  const testAccountUids = new Set();
  for (const s of userSnaps) {
    if (s.exists && s.data().IsTestAccount === true) testAccountUids.add(s.id);
  }

  const results = [];
  let skipped = 0;
  for (const doc of snap.docs) {
    if (testAccountUids.has(doc.id)) {
      skipped++;
      continue;
    }
    const email = uidToEmail.get(doc.id) || "no email";
    const ingameCurrency = doc.data().IngameCurrency;
    console.log(`  ${doc.id} | email: ${email} | IngameCurrency: ${ingameCurrency}`);
    results.push({ id: doc.id, email, IngameCurrency: ingameCurrency });
  }
  if (skipped > 0) console.log(`skipped ${skipped} test accounts`);

  return results;
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

async function auditTestAccountField(collectionName) {
  const snap = await db.collection(collectionName).get();
  let withField = 0, withoutField = 0;
  const missingIds = [];
  let ids = []
  for (const doc of snap.docs) {
    ids.push(doc.id)
    if (Object.hasOwn(doc.data(), "IsTestAccount")) {
      withField++;
    } else {
      withoutField++;
      if (missingIds.length < 5) missingIds.push(doc.id);
    }
  }
  console.log(`total: ${snap.size}`);
  console.log(`with IsTestAccount: ${withField}`);
  console.log(`without IsTestAccount: ${withoutField}`);
  console.log(`sample missing IDs:`, missingIds);
  console.log("............................")
  for (const id of ids) 
  {
    console.log(id)
  }
}

//  RUN-----
// generateCustomVerificationLink("thousand-knruood@local.cynteract.com").catch(console.error);
// migrate("User").then(() => {console.log("*** migration complete ***");});
// collectionCount("User").catch(console.error);

// deleteOfflineUsers().catch(console.error);
// auditTestAccountField("User").catch(console.error);
// isTestAccountMigration("User").catch(console.error);

// markTestAccountsByEmail().catch(console.error);
// numberOfTestAccounts("User").catch(console.error);
playersWithIngameCurrency(50000).catch(console.error);

// listOfflineUsersOnly().catch(console.error);


// const usersQuery = await db.collection('User').where('ProductKey', '==', null).get();
// const userIds = usersQuery.docs.map(doc => doc.id);   

// const playersQuery = await db.collection('Player')
//   .where(firebase.firestore.FieldPath.documentId(), 'in', userIds)
//   .get();   


// const admin = require("firebase-admin");
// const serviceAccount = require("./prodAccKey.json");

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

// await admin.auth().generateEmailVerificationLink("test01@cynteract.com");

// admin.auth().sendverificationEmail("test01@cynteract.com");

