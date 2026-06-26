const admin = require("firebase-admin");
const prod = require("./prodAccKey.json");
const dev = require("./testAccKey.json");
const assert = require("assert");

admin.initializeApp({ credential: admin.credential.cert(dev) });

const db = admin.firestore();
let distributorUsersSnapshot = null;
let productKeysSnapshot = null;

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
    assert(
      !dKeysSet.has(dKey),
      `Duplicate distributor user doc found for product key: ${dKey}`,
    );
    dKeysSet.add(dKey);
  }

  // get distributor key docs with missing userType field
  const missingUserTypeKeysDocs = distributorUsersSnapshot.docs.filter(
    (doc) =>
      doc.get("userType") === undefined && doc.get("UserType") === undefined,
  );
  if (missingUserTypeKeysDocs.length == 0) {
    console.log(`No distributor user docs with missing userType field found.`);
    return;
  }

  console.log(
    `Distributor user docs with missing userType field: ${missingUserTypeKeysDocs.length}`,
  );

  // assert that all other keys have a valid userType field
  for (const dKeyDoc of distributorUsersSnapshot.docs) {
    if (missingUserTypeKeysDocs.includes(dKeyDoc)) {
      continue;
    }
    const dKey = dKeyDoc.id;
    const dUserType = dKeyDoc.get("userType") || dKeyDoc.get("UserType");
    assert(
      dUserType === "Therapist" || dUserType === "Patient",
      `Distributor user doc has invalid userType field: [Key: ${dKey}, UserType: ${dUserType}]`,
    );
  }

  // match documents from 'ProductKeys' and 'User'
  matches = [];
  for (const dKeyDoc of missingUserTypeKeysDocs) {
    const dKey = dKeyDoc.id;
    const dDoc = await dKeyDoc.ref.parent.parent.get();
    const dName = dDoc.get("Name");
    assert(
      dName !== undefined,
      `Distributor user doc for product key ${dKey} does not have a name field.`,
    );
    const pKeyDoc = productKeysSnapshot.docs.find(
      (doc) => doc.get("Key") === dKey,
    );
    assert(
      pKeyDoc !== undefined,
      `No matching product key doc found for distributor user doc: ${dKey}`,
    );
    const pUserType = pKeyDoc.get("UserType");
    const uDoc = userSnapshot.docs.find(
      (doc) => doc.get("ProductKey") === dKey,
    );
    const uUserType = uDoc?.get("UserType");
    assert(
      uDoc === undefined || uUserType !== undefined,
      `User document for product key ${dKey} does not have a userType field.`,
    );
    matches.push({
      dKey,
      dName,
      pId: pKeyDoc.id,
      pUserType,
      uUserType,
    });
  }

  // migrate database
  for (const match of matches) {
    const { dKey, dName, pId, pUserType, uUserType } = match;
    if (uUserType === undefined) {
      // no user document was created with this product key yet, so we can safely use the product key's userType to update the distributor user doc
      console.log(
        `No user document found, updating distributor user doc ${dKey} (${dName}) with userType from product key: ${pUserType}`,
      );
      // await db.collectionGroup("Users").doc(dKey).update({ userType: pUserType });
    } else if (pUserType === "Patient" && uUserType === "Therapist") {
      // prefer type of already registered user over type defined in ProductKeys, especially for Therapist
      console.log(
        `Updating distributor user doc ${dKey} (${dName}) with userType from user document: ${uUserType}`,
      );
      // await db.collectionGroup("Users").doc(dKey).update({ userType: "Therapist" });
    } else if (pUserType === "Therapist" && uUserType === "Patient") {
      // prefer type of already registered user over type defined in ProductKeys, even for Patient; this is different when distributor user type is defined, though
      console.warn(
        `Updating distributor doc and product key ${dKey} (${dName}) with userType from user document: ${uUserType}`,
      );
      // await db.collectionGroup("Users").doc(dKey).update({ userType: "Patient" });
      // await db.collection("ProductKeys").doc(pId).update({ UserType: "Patient" });
    } else if (pUserType === uUserType) {
      console.log(
        `Updating distributor user doc ${dKey} (${dName}) with userType from user document (same as product key): ${uUserType}`,
      );
      // await db.collectionGroup("Users").doc(dKey).update({ userType: uUserType });
    } else {
      assert(
        false,
        `Unexpected case for product key ${dKey} (${dName}): [ProductKey UserType: ${pUserType}, User Document UserType: ${uUserType}]`,
      );
    }
  }
}

main().catch(console.error);
