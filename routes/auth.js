const express = require('express');
const { getAuthorizationUrl, authCallbackMiddleware, authRefreshMiddleware, getUserProfile } = require('../services/aps.js');
const sql = require('mssql');
const config = require('./../config.js');
let router = express.Router();
router.use(express.json());
router.get('/api/auth/login', function (req, res) {
    res.redirect(getAuthorizationUrl());
});

router.get('/api/auth/logout', function (req, res) {
    req.session = null;
    res.redirect('/');
});

router.get('/api/auth/callback', authCallbackMiddleware, function (req, res) {
    res.redirect('/');
});

router.get('/api/auth/token', authRefreshMiddleware, function (req, res) {
    res.json(req.publicOAuthToken);
});

router.get('/api/auth/profile', authRefreshMiddleware, async function (req, res, next) {
    try {
        const profile = await getUserProfile(req.internalOAuthToken.access_token);
        res.json({ name: `${profile.name}` });
    } catch (err) {
        next(err);
    }
});

// router.get('/api/data', async (req, res) => {
//     try {
//         await sql.connect(config);
//         const result = await sql.query`SELECT * FROM logindetails`; // Replace with your actual query
//         res.json(result.recordset);
//     } catch (err) {
//         console.error('SQL Server connection error:', err);
//         res.status(500).send('Database error');
//     } finally {
//         await sql.close(); // Ensure to close the connection
//     }
// });

// auth.js
router.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        await sql.connect(config);
        const result = await sql.query`SELECT * FROM logindetails WHERE email = ${email} AND password = ${password}`; // Adjust the query based on your DB structure

        if (result.recordset.length > 0) {
            // User found
            const user = result.recordset[0]; // Assuming the first record is the user data
            // req.session.user = { id: user.id, email: user.email }; // Store user info in session
            return res.json({ success: true, message: 'Login successful' });
        } else {
            // User not found
            return res.status(401).json({ success: false, message: 'Invalid username or password' });
        }
    } catch (err) {
        console.error('Database query error:', err);
        res.status(500).json({ success: false, message: 'Database error' });
    } finally {
        await sql.close(); // Ensure to close the connection
    }
});


// Check login status
router.get('/api/auth/status', (req, res) => {
    if (req.session && req.session.user) {
        // User is logged in
        return res.json({ loggedIn: true, user: req.session.user });
    }
    // User is not logged in
    res.json({ loggedIn: false });
});

module.exports = router;
