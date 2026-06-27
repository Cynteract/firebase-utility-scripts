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
    assert(
      matchingUDocs.length <= 1,
      `Multiple user docs found for product key: ${pKey}. Run script deleteOrphans.js to delete orphaned user docs before running this script.`,
    );
    const dKeyDoc = matchingDKeyDocs.at(0);
    const uDoc = matchingUDocs.at(0);
    if (dKeyDoc === undefined && uDoc === undefined) {
      // there is only one value, skip matching
      continue;
    }

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
    const uEmail = uDoc?.get("Email");
    const uLastLogin = uDoc?.get("LastLogin");
    const uPatientName = uDoc?.get("PatientName");
    const uTherapistId = uDoc?.get("TherapistId");

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
        uEmail,
        uLastLogin,
        uPatientName,
        uTherapistId,
      });
    }
  }
  return mismatchedKeys;
}

async function getEmailForUserId(uId) {
  let authEmail;
  try {
    const authEntry = await auth.getUser(uId);
    authEmail = authEntry.email;
  } catch (error) {}
  return authEmail;
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
    .select(
      "ProductKey",
      "UserType",
      "TherapistId",
      "Email",
      "LastLogin",
      "PatientName",
    )
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
    const dKeyDoc = distributorUsersSnapshot.docs.find(
      (doc) => doc.id === pKey,
    );
    const dUserType = dKeyDoc?.get("userType") || dKeyDoc?.get("UserType");
    assert(
      dKeyDoc === undefined || dUserType === pUserType,
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
    const {
      dUsed,
      dUsedBy,
      dId,
      dName,
      pDoc,
      pKey,
      pUserType,
      dKeyUserType,
      uDoc,
      uUserType,
      uEmail,
      uLastLogin,
      uPatientName,
      uTherapistId,
    } = mismatch;
    assert(
      pUserType !== undefined,
      `Product key ${pKey} does not have a UserType field.`,
    );
    assert(
      dKeyUserType !== undefined || uUserType !== undefined,
      `Distributor user doc and user doc for product key ${pKey} do not have a userType field.`,
    );
    if (dKeyUserType === pUserType) {
      console.warn(
        `Case 1: product key ${pKey}: distributor matches product key, but user does not match. Product key user type: ${pUserType}, Distributor user type: ${dKeyUserType}, User user type: ${uUserType}. Distributor name: ${dName}.`,
      );
    } else if (uUserType === dKeyUserType) {
      console.log(
        `Case 2: product key ${pKey}: user matches distributor. Updating product key to ${uUserType}`,
      );
      if (!dryRun) {
        await pDoc.ref.update({ UserType: uUserType });
      }
    } else if (uUserType === undefined) {
      console.log(
        `Case 3: product key ${pKey}: user does not exist yet, distributor does not match product key. Updating product key to ${dKeyUserType}`,
      );
      if (!dryRun) {
        await pDoc.ref.update({ UserType: dKeyUserType });
      }
    } else if (
      dKeyUserType !== undefined &&
      uUserType !== undefined &&
      dKeyUserType !== uUserType
    ) {
      const authEmail = await getEmailForUserId(uDoc.id);
      console.warn(
        `Case 4: product key ${pKey}: user does not match distributor. Resolve manually. Product key id: ${pDoc.id}, Product key user type: ${pUserType}, Distributor user type: ${dKeyUserType}, User user type: ${uUserType}. Distributor name: ${dName}, Auth email: ${authEmail}.`,
      );
    } else if (dKeyUserType === undefined) {
      const authEmail = await getEmailForUserId(uDoc.id);
      console.warn(
        `Case 5: product key ${pKey}: no distributor, still mismatch. Resolve manually: Product key id: ${pDoc.id}, Product key user type: ${pUserType}, User user type: ${uUserType}, User email: ${uEmail}, User last login: ${uLastLogin}, User patient name: ${uPatientName}, User therapist ID: ${uTherapistId}, Auth email: ${authEmail}.`,
      );
    } else {
      assert.fail(
        `Unexpected case for product key ${pKey}: product key user type: ${pUserType}, distributor user type: ${dKeyUserType}, user user type: ${uUserType}.`,
      );
    }
  }
}

main().catch(console.error);
