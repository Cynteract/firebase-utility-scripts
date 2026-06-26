const admin = require("firebase-admin");
const prod = require("./prodAccKey.json");
const dev = require("./testAccKey.json");
const assert = require("assert");

admin.initializeApp({credential: admin.credential.cert(prod)});

const db = admin.firestore();
let distributorUsersSnapshot = null;
let productKeysSnapshot = null;

async function getMismatchedKeys() {
  const mismatchedKeys = [];
  for (const productKeyDoc of productKeysSnapshot.docs) {
    const pKey = productKeyDoc.get("Key");
    const pUserType = productKeyDoc.get("UserType");
    const matchingDistributorUsersDocs = distributorUsersSnapshot.docs.filter(doc => doc.id === pKey);
    if (matchingDistributorUsersDocs.length === 0) {}
    else if (matchingDistributorUsersDocs.length > 1) {
      console.log(`Multiple distributor user docs found for product key: ${pKey}`);
    }else {
      const distributorUserDoc = matchingDistributorUsersDocs[0];
      const dUserType = distributorUserDoc.get("userType") || distributorUserDoc.get("UserType")
      const distributorDoc = await distributorUserDoc.ref.parent.parent.get();
      const dName = distributorDoc.get("Name");
      const dUsed = distributorUserDoc.get("Used") || distributorUserDoc.get("keyUsed")
      const dUsedBy = distributorUserDoc.get("UsedBy") || distributorUserDoc.get("userId")

      if (dUserType === undefined) {
        console.warn(`Distributor user doc for product key ${pKey} for distributor ${dName} does not have a userType field.`);
        continue;
      }
      if (pUserType !== dUserType) {
        mismatchedKeys.push({
          distributorId: distributorUserDoc.ref.parent.parent?.id,
          pKey, pUserType, dUserType, dName, dUsed, dUsedBy
        });
      }
    }
  }
  return mismatchedKeys;
}

async function main() {
  distributorUsersSnapshot = await db.collectionGroup("Users").select("userType", "UserType", "Used", "keyUsed", "UsedBy", "userId").get();
  productKeysSnapshot = await db.collection("ProductKeys").select("Key", "UserType").get();

  // assert no duplicate keys
  const pKeysSet = new Set();
  for (const productKeyDoc of productKeysSnapshot.docs) {
    const pKey = productKeyDoc.get("Key");
    assert(!pKeysSet.has(pKey), `Duplicate product key found: ${pKey}`);
    pKeysSet.add(pKey);
  }
  const dKeysSet = new Set();
  for (const distributorUserDoc of distributorUsersSnapshot.docs) {
    const dKey = distributorUserDoc.id;
    assert(!dKeysSet.has(dKey), `Duplicate distributor user doc found for product key: ${dKey}`);
    dKeysSet.add(dKey);
  }

  // filter mismatched keys
  const mismatchedKeys = await getMismatchedKeys();

  // assert that all other keys are matched
  for (const pKeyDoc of productKeysSnapshot.docs) {
    const pKey = pKeyDoc.get("Key");
    if (mismatchedKeys.some(mismatch => mismatch.pKey === pKey)) {
      continue;
    }
    const pUserType = pKeyDoc.get("UserType");
    const dDoc = distributorUsersSnapshot.docs.find(doc => doc.id === pKey);
    const dUserType = dDoc?.get("userType") || dDoc?.get("UserType");
    assert(dDoc === undefined || dUserType === pUserType, `Product key has mismatched distributor type assignment: [Key: ${pKey}, ProductKey UserType: ${pUserType}, Distributor UserType: ${dUserType}]`);
  }
  for (const dKeyDoc of distributorUsersSnapshot.docs) {
    const dKey = dKeyDoc.id;
    if (mismatchedKeys.some(mismatch => mismatch.pKey === dKey)) {
      continue;
    }
    const dUserType = dKeyDoc.get("userType") || dKeyDoc.get("UserType");
    const pDoc = productKeysSnapshot.docs.find(doc => doc.get("Key") === dKey);
    const pUserType = pDoc?.get("UserType");
    assert(pDoc === undefined || dUserType === pUserType, `Distributor user doc has mismatched product key type assignment: [Key: ${dKey}, ProductKey UserType: ${pUserType}, Distributor UserType: ${dUserType}]`);
  }

  console.log("Mismatched keys: ", mismatchedKeys.length);
  for (const mismatch of mismatchedKeys) {
    if (mismatch.dUsed) {
      console.log(`Product key ${mismatch.pKey} has mismatched user types. Product key user type: ${mismatch.pUserType}, Distributor user type: ${mismatch.dUserType}. Distributor ID: ${mismatch.distributorId}, Distributor Name: ${mismatch.dName}, Used: ${mismatch.dUsed}, Used By: ${mismatch.dUsedBy}`);
    }
  }
}

main().catch(console.error);
