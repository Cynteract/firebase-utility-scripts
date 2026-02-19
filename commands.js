const { Command } = require("commander");
const program = new Command();
import { migrate } from "./index.js";


program
    .command("add field")
    .description("add a field to a document")
    .requiredOption("-c, --collection <name>", "collection name")
    .action(migrate(optioins.collection).then(()=>{console.log("migration complete")}));