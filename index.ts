import { config } from "dotenv";
config({ path: ".env.local" });

import { generateText } from "ai";

async function main() {
  const { text } = await generateText({
    model: "openai/gpt-5.5",
    prompt: "Invent a new holiday and describe its traditions.",
  });

  console.log(text);
}

main().catch((err) => {
  console.error("Error executing generateText:", err);
  process.exit(1);
});
