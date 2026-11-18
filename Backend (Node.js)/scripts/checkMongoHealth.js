#!/usr/bin/env node

require('dotenv').config();

const { getMongoDatabase, mongoHealth } = require('../services/mongoClient');

async function main() {
  const started = Date.now();
  const health = await mongoHealth();
  const result = {
    ...health,
    elapsedMs: Date.now() - started,
  };

  if (health.status === 'ok') {
    const database = await getMongoDatabase();
    result.database = database.databaseName;
    result.collections = (await database.listCollections({}, { nameOnly: true }).toArray())
      .map((collection) => collection.name)
      .sort();
  }

  console.log(JSON.stringify(result, null, 2));
  process.exit(health.status === 'ok' || health.status === 'disabled' ? 0 : 1);
}

main().catch((error) => {
  console.error(JSON.stringify({
    configured: Boolean(process.env.MONGODB_URI),
    status: 'error',
    name: error.name,
    message: error.message,
    code: error.code,
    reason: error.reason?.type || error.reason?.constructor?.name || undefined,
  }, null, 2));
  process.exit(1);
});
