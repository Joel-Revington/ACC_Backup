require('dotenv').config();

let { APS_CLIENT_ID, APS_CLIENT_SECRET, APS_CALLBACK_URL, SERVER_SESSION_SECRET, PORT } = process.env;
if (!APS_CLIENT_ID || !APS_CLIENT_SECRET || !APS_CALLBACK_URL || !SERVER_SESSION_SECRET) {
    console.warn('Missing some of the environment variables.');
    process.exit(1);
}
const INTERNAL_TOKEN_SCOPES = ['data:read'];
const PUBLIC_TOKEN_SCOPES = ['viewables:read'];
PORT = PORT || 8080;

// module.exports = {
//     APS_CLIENT_ID,
//     APS_CLIENT_SECRET,
//     APS_CALLBACK_URL,
//     SERVER_SESSION_SECRET,
//     INTERNAL_TOKEN_SCOPES,
//     PUBLIC_TOKEN_SCOPES,
//     PORT
// };

const config = {

    APS_CLIENT_ID,
    APS_CLIENT_SECRET,
    APS_CALLBACK_URL,
    SERVER_SESSION_SECRET,
    INTERNAL_TOKEN_SCOPES,
    PUBLIC_TOKEN_SCOPES,
    PORT,
    user: process.env.DB_USER,       // Your SQL Server username
    password: process.env.DB_PASSWORD, // Your SQL Server password
    server: process.env.DB_SERVER,    // Server name or IP address
    database: process.env.DB_DATABASE, // Database name
    options: {
        encrypt: false,                // Use encryption (recommended)
        trustServerCertificate: true  // Change to true if using a self-signed certificate
    }
}

module.exports = config;