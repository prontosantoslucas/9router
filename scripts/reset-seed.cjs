const libsql = require('libsql');
const url = process.env.TURSO_DATABASE_URL;
const token = process.env.TURSO_AUTH_TOKEN;
const db = new libsql('/tmp/reset-seed.db', { syncUrl: url, authToken: token });
db.sync();
db.exec("DELETE FROM _meta WHERE key = 'maxrouter_seed_v1'");
db.sync();
console.log('Seed marker deleted');
process.exit(0);
