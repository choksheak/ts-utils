import { http, safeGetText } from "../src/http";
import { nonEmpty } from "../src/nonEmpty";

/**
 * This test case requires internet connectivity, and a working API key in the
 * env, so it is not included in the unit tests. The API key can be obtained
 * for free from https://restful-api.dev/. Once you get the key, set it as:
 *
 *   export RESTFUL_API_KEY=[api-key]
 *
 */
async function main() {
  const response = await http.post(
    "https://api.restful-api.dev/collections/products/objects",
    {
      name: "Widget1",
      data: {
        year: 2019,
        price: 200,
      },
    },
    {
      headers: {
        // @ts-expect-error ts(2591) - process is not defined
        "x-api-key": nonEmpty(process.env.RESTFUL_API_KEY, "RESTFUL_API_KEY"),
      },
    },
  );

  const text = await safeGetText(response);

  console.log(`text:`, text);

  if (!text) {
    throw new Error("Response text not found");
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    throw new Error(`Cannot parse as json: ${e}`);
  }

  if (
    !json ||
    typeof json !== "object" ||
    !("id" in json) ||
    typeof json.id !== "string"
  ) {
    throw new Error(`Not a success response`);
  }

  console.log(`\nSuccess!\n`);
}

main();
