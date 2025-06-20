require("./logger");
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { processWebhook } = require("./webhookHandler");

async function main() {
  const argPath = process.argv[2];
  const bodyPath = argPath
    ? path.resolve(argPath)
    : path.join(__dirname, "..", "data", "body-test.json");
  if (!fs.existsSync(bodyPath)) {
    console.error(`File not found: ${bodyPath}`);
    process.exitCode = 1;
    return;
  }

  const bodyData = fs.readFileSync(bodyPath, "utf8");
  const body = JSON.parse(bodyData);

  try {
    const result = await processWebhook({ body });
    console.log(
      "Webhook processed successfully:",
      JSON.stringify(result, null, 2)
    );
  } catch (err) {
    console.error("Error processing webhook:", err);
    process.exitCode = 1;
  }
}

main();
