import { createClient } from '@libsql/client';
const url = process.env.TURSO_DATABASE_URL;
const token = process.env.TURSO_AUTH_TOKEN;
const client = createClient({ url, authToken: token });
const result = await client.execute("DELETE FROM _meta WHERE key = 'maxrouter_seed_v1'");
console.log('Deleted rows:', result.rowsAffected);
process.exit(0);
