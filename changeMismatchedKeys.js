const admin = require("firebase-admin");
const prod = require("./prodAccKey.json");
const dev = require("./testAccKey.json");
const assert = require("assert");

key = dev;
// key = prod;
const dryRun = true;
// const dryRun = false;

admin.initializeApp({ credential: admin.credential.cert(key) });
const auth = admin.auth();
const db = admin.firestore();
let distributorUsersSnapshot = null;
let productKeysSnapshot = null;

async function getMismatchedKeys() {
  const mismatchedKeys = [];
  for (const pDoc of productKeysSnapshot.docs) {
    const pKey = pDoc.get("Key");
    const matchingDKeyDocs = distributorUsersSnapshot.docs.filter(
      (doc) => doc.id === pKey,
    );
    const matchingUDocs = userSnapshot.docs.filter(
      (doc) => doc.get("ProductKey") === pKey,
    );
    assert(
      matchingDKeyDocs.length <= 1,
      `Multiple distributor user docs found for product key: ${pKey}.`,
    );
    // assert(
    //   matchingUDocs.length <= 1,
    //   `Multiple user docs found for product key: ${pKey}.`,
    // );
    if (matchingUDocs.length > 1) {
      console.warn(`Multiple user docs found for product key: ${pKey}.`);
      for (const uDoc of matchingUDocs) {
        const uId = uDoc.id;
        let uEmail;
        try {
          const authEntry = await auth.getUser(uId);
          uEmail = authEntry.email;
        } catch (error) {}
        const uTherapistId = uDoc.get("TherapistId");
        const uLastLogin = uDoc.get("LastLogin");
        console.warn(
          `User doc ID: ${uDoc.id}, Email: ${uEmail}, Therapist ID: ${uTherapistId}, Last Login: ${uLastLogin}`,
        );
      }
    }
    const dKeyDoc = matchingDKeyDocs.at(0);
    const uDoc = matchingUDocs.at(0);

    const pUserType = pDoc.get("UserType");
    const uUserType = uDoc?.get("UserType");
    const dKeyUserType = dKeyDoc?.get("userType");
    assert(
      dKeyDoc === undefined || dKeyUserType !== undefined,
      `Distributor user doc for product key ${pKey} does not have a userType field.`,
    );
    assert(
      uDoc === undefined || uUserType !== undefined,
      `User doc for product key ${pKey} does not have a userType field.`,
    );
    assert(
      pUserType !== undefined,
      `Product key ${pKey} does not have a UserType field.`,
    );

    const dDoc = await dKeyDoc?.ref.parent.parent.get();
    const dId = dDoc?.id;
    const dName = dDoc?.get("Name");
    const dKeyUsed = dKeyDoc?.get("Used") || dKeyDoc?.get("keyUsed");
    const dUsedBy = dKeyDoc?.get("UsedBy") || dKeyDoc?.get("userId");

    if (
      (dDoc !== undefined && pUserType !== dKeyUserType) ||
      (uDoc !== undefined && pUserType !== uUserType)
    ) {
      mismatchedKeys.push({
        pDoc,
        pKey,
        pUserType,
        dDoc,
        dId,
        dName,
        dKeyDoc,
        dKeyUserType,
        dKeyUsed,
        dUsedBy,
        uDoc,
        uUserType,
      });
    }
  }
  return mismatchedKeys;
}

async function assertNoDuplicateKeys() {
  const pKeysSet = new Set();
  for (const productKeyDoc of productKeysSnapshot.docs) {
    const pKey = productKeyDoc.get("Key");
    assert(!pKeysSet.has(pKey), `Duplicate product key found: ${pKey}`);
    pKeysSet.add(pKey);
  }
  const dKeysSet = new Set();
  for (const distributorUserDoc of distributorUsersSnapshot.docs) {
    const dKey = distributorUserDoc.id;
    assert(
      !dKeysSet.has(dKey),
      `Duplicate distributor user doc found for product key: ${dKey}`,
    );
    dKeysSet.add(dKey);
  }
}

async function main() {
  distributorUsersSnapshot = await db
    .collectionGroup("Users")
    .select("userType", "UserType", "Used", "keyUsed", "UsedBy", "userId")
    .get();
  productKeysSnapshot = await db
    .collection("ProductKeys")
    .select("Key", "UserType")
    .get();
  userSnapshot = await db
    .collection("User")
    .select("ProductKey", "UserType")
    .get();

  await assertNoDuplicateKeys();

  // filter mismatched keys
  const mismatchedKeys = await getMismatchedKeys();

  // assert that all other keys are matched
  for (const pKeyDoc of productKeysSnapshot.docs) {
    const pKey = pKeyDoc.get("Key");
    if (mismatchedKeys.some((mismatch) => mismatch.pKey === pKey)) {
      continue;
    }
    const pUserType = pKeyDoc.get("UserType");
    const dDoc = distributorUsersSnapshot.docs.find((doc) => doc.id === pKey);
    const dUserType = dDoc?.get("userType") || dDoc?.get("UserType");
    assert(
      dDoc === undefined || dUserType === pUserType,
      `Product key has mismatched distributor type assignment: [Key: ${pKey}, ProductKey UserType: ${pUserType}, Distributor UserType: ${dUserType}]`,
    );
  }
  for (const dKeyDoc of distributorUsersSnapshot.docs) {
    const dKey = dKeyDoc.id;
    if (mismatchedKeys.some((mismatch) => mismatch.pKey === dKey)) {
      continue;
    }
    const dUserType = dKeyDoc.get("userType") || dKeyDoc.get("UserType");
    const pDoc = productKeysSnapshot.docs.find(
      (doc) => doc.get("Key") === dKey,
    );
    const pUserType = pDoc?.get("UserType");
    assert(
      pDoc === undefined || dUserType === pUserType,
      `Distributor user doc has mismatched product key type assignment: [Key: ${dKey}, ProductKey UserType: ${pUserType}, Distributor UserType: ${dUserType}]`,
    );
  }

  console.log("Mismatched keys: ", mismatchedKeys.length);
  for (const mismatch of mismatchedKeys) {
    if (mismatch.dUsed) {
      console.log(
        `Product key ${mismatch.pKey} has mismatched user types. Product key user type: ${mismatch.pUserType}, Distributor user type: ${mismatch.dUserType}. Distributor ID: ${mismatch.dId}, Distributor Name: ${mismatch.dName}, Used: ${mismatch.dUsed}, Used By: ${mismatch.dUsedBy}`,
      );
    }
  }
}

main().catch(console.error);
