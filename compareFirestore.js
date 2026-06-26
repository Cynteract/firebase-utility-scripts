// read --dev or --prod from cli
const { program } = require("commander");
const { spawn, spawnSync } = require("child_process");
const { readFileSync, writeFileSync } = require("fs");

// read arguments
program
  .option("--dev", "use dev database")
  .option("--prod", "use prod database")
  .option("--overwrite", "overwrite existing comparison dump");
program.parse(process.argv);
const options = program.opts();

let profile;
if (options.dev) {
  profile = "cynteract-test";
} else if (options.prod) {
  profile = "cynteract-prod";
} else {
  // assign dev if running with debugger
  const inspector = require("inspector");
  if (inspector.url()) {
    profile = "cynteract-test";
  } else {
    throw new Error("Please specify --dev or --prod");
  }
}

// dump database
const args = ["export", "./after_migration", "-P", profile, "--adc"];
if (options.overwrite) {
  args.push("--overwrite");
}

const child = spawnSync("backfire", args, {
  shell: true,
  stdio: "inherit",
});

if (child.error) {
  throw child.error;
}

// compare databases
const before_raw = readFileSync("./before_migration.ndjson", "utf-8");
const after_raw = readFileSync("./after_migration.ndjson", "utf-8");

const before = before_raw
  .split("\n")
  .filter((line) => line.trim() !== "")
  .map((line) => JSON.parse(line));
const after = after_raw
  .split("\n")
  .filter((line) => line.trim() !== "")
  .map((line) => JSON.parse(line));

function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, k) => {
        acc[k] = sortKeysDeep(value[k]);
        return acc;
      }, {});
  }
  return value;
}

const sortedJsonDump = (obj, space = 2) =>
  JSON.stringify(sortKeysDeep(obj), null, space);

writeFileSync("./before_migration.json", sortedJsonDump(before));
writeFileSync("./after_migration.json", sortedJsonDump(after));

spawn("code", ["--diff", "./before_migration.json", "./after_migration.json"], {
  shell: true,
});

// const diff_raw = jsonDiff.diffString(before, after);
// // omit the lines "   ..."
// const diff = diff_raw
//   .toString()
//   .split("\n")
//   .filter((line) => line !== "   ...")
//   .join("\n");

// if (diff.length > 0) {
//   console.log("Differences found between before and after migration:");
//   console.log(diff);
// } else {
//   console.log("No differences found between before and after migration.");
// }
