const express = require('express');
// const session = require('cookie-session');
const { PORT, SERVER_SESSION_SECRET } = require('./config.js');
const session = require('express-session');

let app = express();
app.use(express.static('wwwroot'));
app.use(session({ secret: SERVER_SESSION_SECRET, maxAge: 24 * 60 * 60 * 1000 }));
app.use(require('./routes/auth.js'));
app.use(require('./routes/hubs.js'));
// app.use(session({
//     secret: 'accbackupsecretkey', // Use a strong secret key in production
//     resave: false,
//     saveUninitialized: false,
//     cookie: { secure: false } // Set secure to true in production with HTTPS
// }));
app.listen(PORT, () => console.log(`Server listening on port ${PORT}...`));
