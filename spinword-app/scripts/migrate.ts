import { getDb } from "../server/db";

const db = getDb();
const migrations = db.prepare("SELECT version, applied_at FROM schema_migrations ORDER BY version").all();
console.log(JSON.stringify({ database: process.env.SPINWORD_DB_PATH || "./data/spinword.db", migrations }, null, 2));
db.close();
