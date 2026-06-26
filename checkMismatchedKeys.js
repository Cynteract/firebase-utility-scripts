const admin = require("firebase-admin");
const serviceAccount = require("./servicaccky.json");
const testaccKey = require("./testaccKey.json");

admin.initializeApp({
  credential: admin.credential.cert(testaccKey),
});

const db = admin.firestore();

async function main() {
  const distributorUsersSnapshot = await db.collectionGroup("Users").select("userType", "UserType", "Used", "keyUsed", "UsedBy", "userId").get();
  const productKeysSnapshot = await db.collection("ProductKeys").select("Key", "UserType").get();

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
        console.log(`Distributor user doc for product key ${pKey} for distributor ${dName} does not have a userType field.`);
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
  console.log("Mismatched keys: ", mismatchedKeys.length);
  for (const mismatch of mismatchedKeys) {
    if (mismatch.dUsed) {
      console.log(`Product key ${mismatch.pKey} has mismatched user types. Product key user type: ${mismatch.pUserType}, Distributor user type: ${mismatch.dUserType}. Distributor ID: ${mismatch.distributorId}, Distributor Name: ${mismatch.dName}, Used: ${mismatch.dUsed}, Used By: ${mismatch.dUsedBy}`);
    }
  }
}

main().catch(console.error);
