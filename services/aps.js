const axios = require("axios")
const { SdkManagerBuilder } = require('@aps_sdk/autodesk-sdkmanager');
const { AuthenticationClient, Scopes, ResponseType } = require('@aps_sdk/authentication');
const { DataManagementClient } = require('@aps_sdk/data-management');
const { APS_CLIENT_ID, APS_CLIENT_SECRET, APS_CALLBACK_URL } = require('../config.js');

const sdkManager = SdkManagerBuilder.create().build();
const authenticationClient = new AuthenticationClient(sdkManager);
const dataManagementClient = new DataManagementClient(sdkManager);
const service = module.exports = {};
const fs = require('fs')
const path = require('path');

service.getAuthorizationUrl = () => authenticationClient.authorize(APS_CLIENT_ID, ResponseType.Code, APS_CALLBACK_URL, [
    Scopes.DataRead,
    Scopes.DataCreate,
    Scopes.ViewablesRead
]);

service.authCallbackMiddleware = async (req, res, next) => {
    const internalCredentials = await authenticationClient.getThreeLeggedToken(APS_CLIENT_ID, req.query.code, APS_CALLBACK_URL, {
        clientSecret: APS_CLIENT_SECRET
    });
    const publicCredentials = await authenticationClient.getRefreshToken(APS_CLIENT_ID, internalCredentials.refresh_token, {
        clientSecret: APS_CLIENT_SECRET,
        scopes: [Scopes.ViewablesRead]
    });
    req.session.public_token = publicCredentials.access_token;
    req.session.internal_token = internalCredentials.access_token;
    req.session.refresh_token = publicCredentials.refresh_token;
    req.session.expires_at = Date.now() + internalCredentials.expires_in * 2000;
    next();
};

service.authRefreshMiddleware = async (req, res, next) => {
    const { refresh_token, expires_at } = req.session;
    if (!refresh_token) {
        res.status(401).end();
        return;
    }

    if (expires_at < Date.now()) {
        const internalCredentials = await authenticationClient.getRefreshToken(APS_CLIENT_ID, refresh_token, {
            clientSecret: APS_CLIENT_SECRET,
            scopes: [Scopes.DataRead, Scopes.DataCreate]
        });
        const publicCredentials = await authenticationClient.getRefreshToken(APS_CLIENT_ID, internalCredentials.refresh_token, {
            clientSecret: APS_CLIENT_SECRET,
            scopes: [Scopes.ViewablesRead]
        });
        req.session.public_token = publicCredentials.access_token;
        req.session.internal_token = internalCredentials.access_token;
        req.session.refresh_token = publicCredentials.refresh_token;
        req.session.expires_at = Date.now() + internalCredentials.expires_in * 1000;
    }
    req.internalOAuthToken = {
        access_token: req.session.internal_token,
        expires_in: Math.round((req.session.expires_at - Date.now()) / 1000),
    };
    req.publicOAuthToken = {
        access_token: req.session.public_token,
        expires_in: Math.round((req.session.expires_at - Date.now()) / 1000),
    };
    next();
};

service.getUserProfile = async (accessToken) => {
    const resp = await authenticationClient.getUserInfo(accessToken);
    return resp;
};

service.getHubs = async (accessToken) => {
    const resp = await dataManagementClient.getHubs(accessToken);
    return resp.data;
};

service.getProjects = async (hubId, accessToken) => {
    const resp = await dataManagementClient.getHubProjects(accessToken, hubId);
    return resp.data;
};

service.getProjectContents = async (hubId, projectId, folderId, accessToken) => {
    if (!folderId) {
        const resp = await dataManagementClient.getProjectTopFolders(accessToken, hubId, projectId);
        return resp.data;
    } else {
        const resp = await dataManagementClient.getFolderContents(accessToken, projectId, folderId);
        return resp.data;
    }
};

service.getItemContents = async (hubId, projectId, itemId, accessToken) => {
    try {
        const response = await axios.get(`https://developer.api.autodesk.com/data/v1/projects/${projectId}/items/${itemId}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });
        return response.data; // Adjust according to your API response
    } catch (error) {
        console.error("Error fetching item contents:", error);
        throw error;
    }
};

function sanitizeName(name) {
    return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').substring(0, 255);
}

async function downloadFile(url, filePath, accessToken) {
    const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });

    return new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

async function backupFolderContents(hubId, projectId, folderId, folderPath, accessToken, backupData) {
    const folderContents = await service.getProjectContents(hubId, projectId, folderId, accessToken);
    for (const item of folderContents) {
        if (item.type === 'folders') {
            const subFolderId = item.id;
            const sanitizedFolderId = sanitizeName(item.attributes?.name);
            console.log(sanitizedFolderId);
            const subFolderPath = path.join(folderPath, sanitizedFolderId);

            if (!fs.existsSync(subFolderPath)) {
                fs.mkdirSync(subFolderPath, { recursive: true });
            }

            await backupFolderContents(hubId, projectId, subFolderId, subFolderPath, accessToken, backupData);
        } else if (item.type === 'items') {
            const itemId = item.id;
            const itemVersions = await service.getItemVersions(projectId, itemId, accessToken);
            for (const version of itemVersions) {
                console.log("version", version.relationships?.storage);
                const fileName = sanitizeName(version.attributes.name);
                try{
                    const fileUrl = version?.relationships?.storage?.meta?.link?.href;
                    const filePath = path.join(folderPath, fileName);
                    console.log("version", fileName, filePath, fileUrl);
                    await downloadFile(fileUrl, filePath, accessToken);
                } catch(err){
                    console.log(err);
                    continue
                }
            }
        }
    }
}

service.backupData = async (accessToken) => {
    console.log(accessToken);
    const hubs = await service.getHubs(accessToken);
    const backupData = {};

    for (const hub of hubs) {
        const hubId = hub.id;
        const sanitizedHubName = sanitizeName(hub.attributes?.name);
        const projects = await service.getProjects(hubId, accessToken);
        backupData[sanitizedHubName] = projects;

        const hubPath = path.join(__dirname, "..", "backup", sanitizedHubName);
        if (!fs.existsSync(hubPath)) {
            fs.mkdirSync(hubPath, { recursive: true });
        }

        for (const project of projects) {
            const projectId = project.id;
            const sanitizedProjectName = sanitizeName(project.attributes?.name);
            const projectPath = path.join(hubPath, sanitizedProjectName);
            const projectContents = await service.getProjectContents(hubId, projectId, null, accessToken);
            backupData[sanitizedHubName][sanitizedProjectName] = projectContents;

            if (!fs.existsSync(projectPath)) {
                fs.mkdirSync(projectPath, { recursive: true });
            }

            for (const content of projectContents) {
                if (content.type === 'folders') {
                    const folderId = content.id;
                    const sanitizedFolderId = sanitizeName(content.attributes?.name);
                    const folderPath = path.join(projectPath, sanitizedFolderId);
                    // const folderContents = await service.getProjectContents(hubId, projectId, folderId, accessToken);
                    // console.log(folderContents);
                    // backupData[sanitizedHubName][sanitizedProjectName][sanitizedFolderId] = folderContents;

                    if (!fs.existsSync(folderPath)) {
                        fs.mkdirSync(folderPath, { recursive: true });
                    }
                    console.log("project", sanitizedProjectName);
                    await backupFolderContents(hubId, projectId, folderId, folderPath, accessToken, backupData[sanitizedHubName][sanitizedProjectName]);
                }
            }
        }
    }

    fs.writeFileSync('backup.json', JSON.stringify(backupData, null, 2));
    return 'Backup completed successfully.';
};

service.getItemVersions = async (projectId, itemId, accessToken) => {
    const resp = await dataManagementClient.getItemVersions(accessToken, projectId, itemId);
    return resp.data;
};
