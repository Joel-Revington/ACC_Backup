// db.js
const sql = require('mssql');
const config = require('./config');

async function connectToDatabase() {
    try {
        await sql.connect(config);
        console.log('Connected to SQL Server successfully!');
    } catch (err) {
        console.error('Database connection failed:', err);
    }
}

module.exports = { connectToDatabase, sql };