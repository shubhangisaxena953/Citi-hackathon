// This file sets up our "database" — it's really just a JSON file on disk.
// lowdb reads/writes data/db.json for us. No MongoDB, no server setup needed.

const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const adapter = new FileSync('data/db.json');
const db = low(adapter);

// Set default structure the FIRST time this runs (if db.json is empty)
db.defaults({ users: [], transactions: [], goals: [] }).write();

module.exports = db;
