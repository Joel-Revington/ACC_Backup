const express = require('express');
const { getAuthorizationUrl, authCallbackMiddleware, authRefreshMiddleware, getUserProfile } = require('../services/aps.js');
const supabase = require('../db.js')
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


// auth.js
router.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        const {data:user, error} = await supabase.from("acc_users").select('*').eq('Email', email).eq('Password', password)
        if (error) {
            console.error('Supabase query error:', error);
            return res.status(500).json({ success: false, message: 'Database query error' });
        }
        if(user && user.length > 0){
            console.log(user);
            return res.json({ success: true, message: 'Login successful' });
        } else {
            // User not found
            return res.status(401).json({ success: false, message: 'Invalid username or password' });
        }
    } catch (err) {
        console.error('Database query error:', err);
        res.status(500).json({ success: false, message: 'Database error' });
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
