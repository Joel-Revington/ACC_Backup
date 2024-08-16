const express = require('express');
const fs = require('fs');
const path = require('path')
const { authRefreshMiddleware, getHubs, getProjects, getProjectContents, getItemVersions, backupData, backupSpecificData } = require('../services/aps.js');

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

// const tmpDir = 'C:\\tmp';

function deleteFile(filePath) {
    return new Promise((resolve, reject) => {
        fs.unlink(filePath, (err) => {
            if (err) {
                console.error('Error deleting file:', err);
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

function deleteFilesInDirectory(directoryPath) {
    return new Promise((resolve, reject) => {
        fs.readdir(directoryPath, (err, files) => {
            if (err) {
                console.error('Error reading directory:', err);
                reject(err);
                return;
            }
            const fileDeletions = files.map(file => {
                const filePath = path.join(directoryPath, file);
                return new Promise((res, rej) => {
                    fs.stat(filePath, (err, stats) => {
                        if (err) {
                            rej(err);
                        } else if (stats.isDirectory()) {
                            deleteFilesInDirectory(filePath).then(res).catch(rej);
                        } else {
                            deleteFile(filePath).then(res).catch(rej);
                        }
                    });
                });
            });
            Promise.all(fileDeletions).then(() => {
                resolve();
            }).catch(reject);
        });
    });
}

function cleanUpTempFiles() {
    deleteFilesInDirectory('./tmp').then(() => {
        console.log('Temporary files cleaned up successfully.');
    }).catch(err => {
        console.error('Error during cleanup:', err);
    });
}

function sanitizeName(name) {
    return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').substring(0, 255);
}

router.get('/api/aps/backup', authRefreshMiddleware, async (req, res, next) => {
    console.log('Backup process initiated');
    try {
        const accessToken = req.internalOAuthToken.access_token;
        let zipFilePath
        if (req.query.hub_id && req.query.project_id) {
            const hubs = await getHubs(accessToken);
            const hub = hubs.find(h => h.id === req.query.hub_id);
            const hubName = hub ? hub.attributes.name : 'backup';
            const sanitizedHubName = sanitizeName(hubName);
            zipFilePath = await backupSpecificData(accessToken, req.query.hub_id, req.query.project_id);
            const zipFileName = `${sanitizedHubName}.zip`
            res.download(zipFilePath, zipFileName, (err) => {
                if(err){
                    res.status(500).send("Error Downloading")
                } else {
                    cleanUpTempFiles()
                }
            })
        } else {
            zipFilePath = await backupData(accessToken);
            res.download(zipFilePath, "backup.zip", (err) => {
                if(err){
                    res.status(500).send("Error Downloading")
                } else {
                    cleanUpTempFiles()
                }
            })
        }
    } catch (err) {
        console.error('Error during backup process:', err);
        res.status(500).send('Backup process encountered an error.');
    }
});

module.exports = router;
