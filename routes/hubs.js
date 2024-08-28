const express = require('express');
const { authRefreshMiddleware, getHubs, getProjects, getProjectContents, getItemVersions, backupData, backupSpecificData } = require('../services/aps.js');
const { PassThrough } = require('stream');

let router = express.Router();

router.use('/api/hubs', authRefreshMiddleware);

router.get('/api/hubs', async function (req, res, next) {
    try {
        const hubs = await getHubs(req.internalOAuthToken.access_token);
        res.json(hubs);
    } catch (err) {
        next(err);
    }
});

router.get('/api/hubs/:hub_id/projects', async function (req, res, next) {
    try {
        const projects = await getProjects(req.params.hub_id, req.internalOAuthToken.access_token);
        res.json(projects);
    } catch (err) {
        next(err);
    }
});

router.get('/api/hubs/:hub_id/projects/:project_id/contents', async function (req, res, next) {
    try {
        const contents = await getProjectContents(req.params.hub_id, req.params.project_id, req.query.folder_id, req.internalOAuthToken.access_token);
        res.json(contents);
    } catch (err) {
        next(err);
    }
});

router.get('/api/hubs/:hub_id/projects/:project_id/contents/:item_id/versions', async function (req, res, next) {
    try {
        const versions = await getItemVersions(req.params.project_id, req.params.item_id, req.internalOAuthToken.access_token);
        res.json(versions);
    } catch (err) {
        next(err);
    }
});

function sanitizeName(name) {
    return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').substring(0, 255);
}

router.get('/api/aps/backup', authRefreshMiddleware, async (req, res, next) => {
    console.log('Backup process initiated');
    try {
        const accessToken = req.internalOAuthToken.access_token;
        // const passThrough = new PassThrough();

        res.setHeader('Content-Disposition', 'attachment; filename=backup.zip');
        res.setHeader('Content-Type', 'application/zip');

        if (req.query.hub_id && req.query.project_id) {
            const hubs = await getHubs(accessToken);
            const hub = hubs.find(h => h.id === req.query.hub_id);
            const hubName = hub ? hub.attributes.name : 'backup';
            const sanitizedHubName = sanitizeName(hubName);

            // Directly stream the ZIP for the specific hub and project
            await backupSpecificData(req, res, accessToken, req.query.hub_id, req.query.project_id);
            // passThrough.pipe(res).on('finish', () => {
            //     console.log('Backup process completed successfully.');
            // });
        } else {
            // Directly stream the ZIP for all hubs and projects
            await backupData(req, res, accessToken);
        }
    } catch (err) {
        console.error('Error during backup process:', err);
        res.status(500).send('Backup process encountered an error.');
    }
});

module.exports = router;
