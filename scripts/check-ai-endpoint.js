import { checkAiEndpoint } from "../src/aiRepository.js";

const result = await checkAiEndpoint();

if (!result.ok) {
  console.error(`AI endpoint check failed: ${result.message || "unknown error"}`);
  if (result.status) {
    console.error(`Status: ${result.status}`);
  }
  process.exitCode = 1;
} else {
  console.log(`AI endpoint check passed for ${result.modelName}.`);
}
