const admin = require("firebase-admin");
const prod = require("./prodAccKey.json");
const dev = require("./testAccKey.json");
const assert = require("assert");

admin.initializeApp({credential: admin.credential.cert(prod)});

const db = admin.firestore();
let distributorUsersSnapshot = null;
let productKeysSnapshot = null;

async function main() {
  distributorUsersSnapshot = await db.collectionGroup("Users").select("userType", "UserType", "Used", "keyUsed", "UsedBy", "userId").get();
  productKeysSnapshot = await db.collection("ProductKeys").select("Key", "UserType").get();
  userSnapshot = await db.collection("User").select("ProductKey", "UserType").get();

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

  // get distributor key docs with missing userType field
  const missingUserTypeKeysDocs = distributorUsersSnapshot.docs.filter(doc => doc.get("userType") === undefined && doc.get("UserType") === undefined);
  if (missingUserTypeKeysDocs.length == 0) {
    console.log(`No distributor user docs with missing userType field found.`);
    return;
  }

  console.log(`Distributor user docs with missing userType field: ${missingUserTypeKeysDocs.length}`);

  // assert that all other keys have a valid userType field
  for (const dKeyDoc of distributorUsersSnapshot.docs) {
    if (missingUserTypeKeysDocs.includes(dKeyDoc)) {
      continue;
    }
    const dKey = dKeyDoc.id;
    const dUserType = dKeyDoc.get("userType") || dKeyDoc.get("UserType");
    assert(dUserType === "Therapist" || dUserType === "Patient", `Distributor user doc has invalid userType field: [Key: ${dKey}, UserType: ${dUserType}]`);
  }

  // match documents from 'ProductKeys' and 'User'
  matches = [];
  for (const dKeyDoc of missingUserTypeKeysDocs) {
    const dKey = dKeyDoc.id;
    const pKeyDoc = productKeysSnapshot.docs.find(doc => doc.get("Key") === dKey);
    assert(pKeyDoc !== undefined, `No matching product key doc found for distributor user doc: ${dKey}`);
    const pUserType = pKeyDoc.get("UserType");
    const uDoc = userSnapshot.docs.find(doc => doc.get("ProductKey") === dKey);
    const uUserType = uDoc?.get("UserType");
    matches.push({
      dKey, pUserType, uUserType
    });
  }

  // migrate database
  for (const match of matches) {
    const { dKey, pUserType, uUserType } = match;
    if (pUserType === undefined) {
      // no user document was created with this product key yet, so we can safely use the product key's userType to update the distributor user doc 
      console.log(`No user document found, updating distributor user doc ${dKey} with userType from product key: ${pUserType}`);
      // await db.collectionGroup("Users").doc(dKey).update({ userType: pUserType });
    } else {
      // a user document was already created, we check if the userType matches the product key's userType
      if (pUserType !== uUserType) {
        console.warn(`User document for product key ${dKey} has mismatched userType: [ProductKey UserType: ${pUserType}, User Document UserType: ${uUserType}]`);
      } else {
        console.log(`Updating distributor user doc ${dKey} with userType from user document: ${uUserType}`);
        // await db.collectionGroup("Users").doc(dKey).update({ userType: uUserType });
      }
    }
  }
}

main().catch(console.error);
