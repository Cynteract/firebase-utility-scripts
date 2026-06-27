const admin = require("firebase-admin");
const prod = require("./prodAccKey.json");
const dev = require("./testAccKey.json");
const assert = require("assert");

key = dev;
// key = prod;
const dryRun = true;
// const dryRun = false;

admin.initializeApp({ credential: admin.credential.cert(key) });

const db = admin.firestore();
let distributorUsersSnapshot = null;
let productKeysSnapshot = null;

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
    const pDoc = productKeysSnapshot.docs.find(
      (doc) => doc.get("Key") === dKey,
    );
    assert(
      pDoc !== undefined,
      `No matching product key doc found for distributor user doc: ${dKey}`,
    );
    const pUserType = pDoc.get("UserType");
    const uDoc = userSnapshot.docs.find(
      (doc) => doc.get("ProductKey") === dKey,
    );
    const uUserType = uDoc?.get("UserType");
    assert(
      uDoc === undefined || uUserType !== undefined,
      `User document for product key ${dKey} does not have a userType field.`,
    );
    matches.push({
      dKeyDoc,
      dKey,
      dName,
      pDoc,
      pId: pDoc.id,
      pUserType,
      uDoc,
      uUserType,
    });
  }

  // migrate database
  for (const match of matches) {
    const { dKeyDoc, dKey, dName, pDoc, pId, pUserType, uDoc, uUserType } =
      match;
    if (uUserType === undefined) {
      // no user document was created with this product key yet, assume Therapist
      console.log(
        `Case 1: No user doc, set distributor doc ${dKey} (${dName}) to Therapist`,
      );
      if (!dryRun) {
        await dKeyDoc.ref.update({ userType: "Therapist" });
      }
    } else if (pUserType === "Patient" && uUserType === "Therapist") {
      // prefer type of already registered user over type defined in ProductKeys, especially for Therapist
      console.log(
        `Case 2: Product key says Patient, but user doc says Therapist. Update distributor doc ${dKey} (${dName}) from user document: ${uUserType}`,
      );
      if (!dryRun) {
        await dKeyDoc.ref.update({ userType: "Therapist" });
      }
    } else if (pUserType === "Therapist" && uUserType === "Patient") {
      // prefer type of already registered user over type defined in ProductKeys, even for Patient; this is different when distributor user type is defined, though
      console.warn(
        `Case 3: Product key says Therapist, but user doc says Patient. Update distributor doc ${dKey} (${dName}) from user document: ${uUserType}`,
      );
      if (!dryRun) {
        await dKeyDoc.ref.update({ userType: "Patient" });
        await pDoc.ref.update({ UserType: "Patient" });
      }
    } else if (pUserType === uUserType) {
      console.log(
        `Case 4: Product key and user doc have the same userType. Update distributor doc ${dKey} (${dName}) from user document: ${uUserType}`,
      );
      if (!dryRun) {
        await dKeyDoc.ref.update({ userType: uUserType });
      }
    } else {
      assert(
        false,
        `Unexpected case for product key ${dKey} (${dName}): [ProductKey UserType: ${pUserType}, User Document UserType: ${uUserType}]`,
      );
    }
  }
}

main().catch(console.error);
