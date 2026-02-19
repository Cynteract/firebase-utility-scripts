// for command line

const { program } = require('commander');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const admin = require('firebase-admin');
admin.initializeApp();
const db = getFirestore();

// command: firestore:add-field ---
program
  .command('add-field <collection>')
  .description('Adds a new field to every document in a Firestore collection.')
  .requiredOption('-f, --field <fieldName>', 'The name of the field to add.')
  .requiredOption('-v, --value <value>', 'The value to set for the new field.')
  .option('-d, --dry-run', 'Simulate the operation without writing any changes.', false)
  .action(async (collection, options) => {
    try {
      console.log(`Starting operation on collection '${collection}'...`);
      if (options.dryRun) {
        console.log('*** DRY RUN - NO CHANGES WILL BE WRITTEN ***');
      }

      const snapshot = await db.collection(collection).get();
      console.log(`Found ${snapshot.size} documents.`);

      const updateData = { [options.field]: options.value };
      
      if (options.dryRun) 
    {
        const firstDoc = snapshot.docs[0];
        if (firstDoc) {
          console.log(`[DRY RUN] Example update for document '${firstDoc.id}':`, updateData);
        }
        console.log(`[DRY RUN] Would add field '${options.field}' to ${snapshot.size} documents.`);
        return;
      }

      const writePromises = [];
      snapshot.forEach(doc => {
        writePromises.push(doc.ref.update(updateData));
      });

      await Promise.all(writePromises);
      console.log(`Success! Added field '${options.field}' to ${snapshot.size} documents.`);

    } catch (error) {
      console.error(' Error:', error.message);
    }
  });

//  command: firestore:delete-field ---
program
  .command('delete-field <collection>')
  .description('Deletes a field from every document in a Firestore collection.')
  .requiredOption('-f, --field <fieldName>', 'The name of the field to delete.')
  .option('-d, --dry-run', 'Simulate the operation without writing any changes.', false)
  .action(async (collection, options) => {
    try {
      console.log(`Starting operation on collection '${collection}'...`);
      if (options.dryRun) {
        console.log('*** DRY RUN - NO CHANGES WILL BE WRITTEN ***');
      }

      const snapshot = await db.collection(collection).get();
      console.log(`Found ${snapshot.size} documents.`);

      const updateData = { [options.field]: FieldValue.delete() };
      
      if (options.dryRun) {
        const firstDoc = snapshot.docs[0];
        if (firstDoc) {
          console.log(`[DRY RUN] Example update for document '${firstDoc.id}':`, `Delete field '${options.field}'`);
        }
        console.log(`[DRY RUN] Would delete field '${options.field}' from ${snapshot.size} documents.`);
        return;
      }

      const writePromises = [];
      snapshot.forEach(doc => {
        writePromises.push(doc.ref.update(updateData));
      });

      await Promise.all(writePromises);
      console.log(` Success! Deleted field '${options.field}' from ${snapshot.size} documents.`);

    } catch (error) {
      console.error('Error:', error.message);
    }
  });

// command: firestore:update-field ---
program
  .command('update-field <collection>')
  .description('Updates a field for every document in a Firestore collection.')
  .requiredOption('-f, --field <fieldName>', 'The name of the field to update.')
  .requiredOption('-v, --value <value>', 'The new value for the field.')
  .option('-d, --dry-run', 'Simulate the operation without writing any changes.', false)
  .action(async (collection, options) => {
    try {
      console.log(`Starting operation on collection '${collection}'...`);
      if (options.dryRun) {
        console.log('*** DRY RUN - NO CHANGES WILL BE WRITTEN ***');
      }

      const snapshot = await db.collection(collection).get();
      console.log(`Found ${snapshot.size} documents.`);

      const updateData = { [options.field]: options.value };
      
      if (options.dryRun) {
        const firstDoc = snapshot.docs[0];
        if (firstDoc) {
          console.log(`[DRY RUN] Example update for document '${firstDoc.id}':`, updateData);
        }
        console.log(`[DRY RUN] Would update field '${options.field}' on ${snapshot.size} documents.`);
        return;
      }

      const writePromises = [];
      snapshot.forEach(doc => {
        writePromises.push(doc.ref.update(updateData));
      });

      await Promise.all(writePromises);
      console.log(` success! Updated field '${options.field}' on ${snapshot.size} documents.`);

    } catch (error) {
      console.error(' error:', error.message);
    }
  });

module.exports = program;