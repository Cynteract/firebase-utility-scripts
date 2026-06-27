const admin = require("firebase-admin");
const prod = require("./prodAccKey.json");
const dev = require("./testAccKey.json");
const assert = require("assert");

// key = dev;
key = prod;
// const dryRun = true;
const dryRun = false;

admin.initializeApp({ credential: admin.credential.cert(key) });
const auth = admin.auth();
const db = admin.firestore();

async function main() {
  const userSnapshot = await db
    .collection("User")
    .select(
      "ProductKey",
      "UserType",
      "TherapistId",
      "Email",
      "LastLogin",
      "PatientName",
    )
    .get();

  let deletedCount = 0;
  let i = 0;
  let size = userSnapshot.size;
  console.log(
    `Start deleting orphaned users (TherapistId null and no auth email), total: ${size}...`,
  );
  for (const uDoc of userSnapshot.docs) {
    const uId = uDoc.id;
    let authEmail;
    try {
      const authEntry = await auth.getUser(uId);
      authEmail = authEntry.email;
    } catch (error) {}
    const uEmail = uDoc.get("Email");
    const uTherapistId = uDoc.get("TherapistId");
    const uLastLogin = uDoc.get("LastLogin");
    const uPatientName = uDoc.get("PatientName");
    if (uTherapistId === null && authEmail === undefined) {
      console.log(
        `Deleting user doc ID: ${uDoc.id}, Email (auth/doc): ${authEmail}/${uEmail}, Therapist ID: ${uTherapistId}, Last Login: ${uLastLogin}, Patient Name: ${uPatientName}`,
      );
      deletedCount++;
      if (!dryRun) {
        await db.collection("User").doc(uId).delete();
      }
    }
    i++;
    if (i % 50 === 0) {
      console.log(`Processed ${i}/${size} users...`);
    }
  }

  console.log(`Total users deleted: ${deletedCount}`);
}

main().catch(console.error);
