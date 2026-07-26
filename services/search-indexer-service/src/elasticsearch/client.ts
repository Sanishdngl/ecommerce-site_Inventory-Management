import { Client } from "@elastic/elasticsearch";

let client: Client | null = null;

export function getEsClient(): Client {
  if (client) return client;

  const node = process.env.ES_NODE;
  if (!node) {
    throw new Error("Missing required ES_NODE environment variable");
  }

  client = new Client({ node });
  return client;
}

export async function testEsConnection(): Promise<void> {
  await getEsClient().ping();
}
