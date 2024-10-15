const axios = require("axios");
const { SdkManagerBuilder } = require("@aps_sdk/autodesk-sdkmanager");
const {
  AuthenticationClient,
  Scopes,
  ResponseType,
} = require("@aps_sdk/authentication");
const { DataManagementClient } = require("@aps_sdk/data-management");
const {
  APS_CLIENT_ID,
  APS_CLIENT_SECRET,
  APS_CALLBACK_URL,
} = require("../config.js");

const sdkManager = SdkManagerBuilder.create().build();
const authenticationClient = new AuthenticationClient(sdkManager);
const dataManagementClient = new DataManagementClient(sdkManager);
const service = (module.exports = {});
const archiver = require("archiver");
const { PassThrough } = require("stream");
const JSZip = require("jszip");

service.getAuthorizationUrl = () =>
  authenticationClient.authorize(
    APS_CLIENT_ID,
    ResponseType.Code,
    APS_CALLBACK_URL,
    [Scopes.DataRead, Scopes.DataCreate, Scopes.ViewablesRead]
  );

service.authCallbackMiddleware = async (req, res, next) => {
  const internalCredentials = await authenticationClient.getThreeLeggedToken(
    APS_CLIENT_ID,
    req.query.code,
    APS_CALLBACK_URL,
    {
      clientSecret: APS_CLIENT_SECRET,
    }
  );
  const publicCredentials = await authenticationClient.getRefreshToken(
    APS_CLIENT_ID,
    internalCredentials.refresh_token,
    {
      clientSecret: APS_CLIENT_SECRET,
      scopes: [Scopes.ViewablesRead],
    }
  );
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
    const internalCredentials = await authenticationClient.getRefreshToken(
      APS_CLIENT_ID,
      refresh_token,
      {
        clientSecret: APS_CLIENT_SECRET,
        scopes: [Scopes.DataRead, Scopes.DataCreate],
      }
    );
    const publicCredentials = await authenticationClient.getRefreshToken(
      APS_CLIENT_ID,
      internalCredentials.refresh_token,
      {
        clientSecret: APS_CLIENT_SECRET,
        scopes: [Scopes.ViewablesRead],
      }
    );
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

service.getProjectContents = async (
  hubId,
  projectId,
  folderId,
  accessToken
) => {
  if (!folderId) {
    const resp = await dataManagementClient.getProjectTopFolders(
      accessToken,
      hubId,
      projectId
    );
    return resp.data;
  } else {
    const resp = await dataManagementClient.getFolderContents(
      accessToken,
      projectId,
      folderId
    );
    return resp.data;
  }
};

service.getItemContents = async (hubId, projectId, itemId, accessToken) => {
  try {
    const response = await axios.get(
      `https://developer.api.autodesk.com/data/v1/projects/${projectId}/items/${itemId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    return response.data; // Adjust according to your API response
  } catch (error) {
    console.error("Error fetching item contents:", error);
    throw error;
  }
};

function sanitizeName(name) {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").substring(0, 255);
}

const withTimeout = (promise, timeoutMs) => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Operation timed out"));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeout);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timeout);
        reject(err);
      });
  });
};

const downloadFile = async (url, accessToken) => {
  const response = await axios.get(url, {
    responseType: "stream",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return response.data;
};

const backupAllFileContent = async (
  hubId,
  projectId,
  itemId,
  archive,
  projectName,
  accessToken
) => {
  try {
    console.log("path", projectName);

    const itemVersions = await service.getItemVersions(
      projectId,
      itemId,
      accessToken
    );
    // Iterate over each version and back it up
    for (const [index, version] of itemVersions.entries()) {
      const versionName = sanitizeName(version.attributes.name);
      const url = version?.relationships?.storage?.meta?.link?.href;
      if (url === undefined) {
        console.error(
          `No download URL found for version of file ${versionName}. Skipping...`
        );
        continue;
      } else {
        const response = await withTimeout(
          downloadFile(url, accessToken),
          15000
        );
        if (!response) {
          console.log(
            `Failed to download file for version of ${versionName}. Skipping...`
          );
          continue;
        }
        // Add each version of the file to the zip archive with a unique name
        archive.append(response, { name: `${projectName}/${versionName}` });
        console.log(`Added ${versionName} to archive.`);
        // zip.file(`${projectName}/${version?.attributes?.name}`, response);
      }
    }
  } catch (error) {
    console.error(`Error backing up file with ID ${itemId}:`, error);
  }
};

const backupAllFolderContents = async (
  hubId,
  projectId,
  folderId,
  archive,
  basePath,
  accessToken
) => {
  try {
    const folderContents = await withTimeout(
      service.getProjectContents(hubId, projectId, folderId, accessToken),
      15000
    );
    for (const item of folderContents) {
      const itemName = sanitizeName(item.attributes?.displayName);
      const itemPath = basePath ? `${basePath}/${itemName}` : itemName;
      console.log("base", basePath);
      console.log("item", itemPath);

      if (item.type === "folders") {
        await backupAllFolderContents(
          hubId,
          projectId,
          item.id,
          archive,
          itemPath,
          accessToken
        );
      } else if (item.type === "items") {
        await withTimeout(
          backupAllFileContent(
            hubId,
            projectId,
            item.id,
            archive,
            itemPath,
            accessToken
          ),
          15000
        );
      }
    }
  } catch (error) {
    console.error("Error backing up folder contents:", error);
  }
};

service.backupData = async (req, res, accessToken) => {
  if (!accessToken) {
    res.status(401).json({ error: "Access token is missing." });
    return;
  }
  const archive = archiver("zip", { zlib: { level: 9 } });
  res.setHeader("Content-Disposition", "attachment; filename=backup.zip");
  res.setHeader("Content-Type", "application/zip");
  archive.on("error", (err) => {
    throw err;
  });
  // Pipe the archive data to the response
  archive.pipe(res);

  try {
    const hubs = await service.getHubs(accessToken);
    for (const hub of hubs) {
      const sanitizedHubName = sanitizeName(hub.attributes.name);
      const projects = await service.getProjects(hub.id, accessToken);
      if (projects.length === 0) {
        archive.append(null, { name: `${sanitizedHubName}/` });
        console.log(`No projects found for hub: ${sanitizedHubName}`);
        continue;
      } else {
        for (const project of projects) {
          const sanitizedProjectName = sanitizeName(project.attributes.name);
          const projectContents = await service.getProjectContents(
            hub.id,
            project.id,
            null,
            accessToken
          );
          for (const content of projectContents) {
            if (content.type === "folders") {
              await backupAllFolderContents(
                hub.id,
                project.id,
                content.id,
                archive,
                `${sanitizedHubName}/${sanitizedProjectName}`,
                accessToken
              );
            } else if (content.type === "items") {
              await backupAllFileContent(
                hub.id,
                project.id,
                content.id,
                archive,
                `${sanitizedHubName}/${sanitizedProjectName}`,
                accessToken
              );
            }
          }
        }
      }
    }
    console.log("archiving");
    archive.finalize();
  } catch (error) {
    console.error("Error during backup data:", error);
  }
};

const backupFileContent = async (
  hubId,
  projectId,
  itemId,
  archive,
  projectName,
  accessToken
) => {
  try {
    const itemVersions = await service.getItemVersions(
      projectId,
      itemId,
      accessToken
    );
    // Iterate over each version and back it up
    for (const [index, version] of itemVersions.entries()) {
      const versionName = sanitizeName(version.attributes.name);
      const url = version?.relationships?.storage?.meta?.link?.href;

      if (!url) {
        console.error(
          `No download URL found for file ${versionName}. Skipping...`
        );
        continue;
      }

      // Download the file using the URL and the access token
      const response = await withTimeout(downloadFile(url, accessToken), 15000);

      if (!response) {
        console.log(`Failed to download file: ${versionName}. Skipping...`);
        continue;
      }

      // Append the file content to the archive directly (as a stream)
      archive.append(response, { name: `${projectName}/${versionName}` });
      console.log(`Added ${versionName} to archive.`);
    }
  } catch (error) {
    console.error(`Error backing up file with ID ${itemId}:`, error);
  }
};

const backupFolderContents = async (
  hubId,
  projectId,
  folderId,
  archive,
  basePath,
  accessToken
) => {
  try {
    const folderContents = await withTimeout(
      service.getProjectContents(hubId, projectId, folderId, accessToken),
      15000
    );
    for (const item of folderContents) {
      const itemName = sanitizeName(item.attributes?.displayName);
      const itemPath = basePath ? `${basePath}/${itemName}` : itemName;
      if (item.type === "folders") {
        // Recursively back up folder contents
        await backupFolderContents(
          hubId,
          projectId,
          item.id,
          archive,
          itemPath,
          accessToken
        );
      } else if (item.type === "items") {
        // Back up the file contents
        await withTimeout(
          backupFileContent(
            hubId,
            projectId,
            item.id,
            archive,
            itemPath,
            accessToken
          ),
          15000
        );
      }
    }
  } catch (error) {
    console.error("Error backing up folder contents:", error);
  }
};

service.backupSpecificData = async (
  req,
  res,
  accessToken,
  hubId,
  projectId
) => {
  if (!accessToken) {
    res.status(401).json({ error: "Access token is missing." });
    return;
  }

  const archive = archiver("zip", { zlib: { level: 9 } });
  res.setHeader("Content-Disposition", "attachment; filename=backup.zip");
  res.setHeader("Content-Type", "application/zip");

  archive.on("error", (err) => {
    console.error("Archive error:", err);
    throw err;
  });

  archive.pipe(res);

  try {
    const hub = (await service.getHubs(accessToken)).find(
      (h) => h.id === hubId
    );
    const project = (await service.getProjects(hubId, accessToken)).find(
      (p) => p.id === projectId
    );
    const sanitizedProjectName = sanitizeName(project.attributes.name);
    const projectContents = await service.getProjectContents(
      hubId,
      projectId,
      null,
      accessToken
    );

    for (const content of projectContents) {
      if (content.type === "folders") {
        await backupFolderContents(
          hubId,
          projectId,
          content.id,
          archive,
          sanitizedProjectName,
          accessToken
        );
      } else if (content.type === "items") {
        await withTimeout(
          backupFileContent(
            hubId,
            projectId,
            content.id,
            archive,
            sanitizedProjectName,
            accessToken
          ),
          15000
        );
      }
    }

    await archive.finalize();
    console.log("Backup completed and archive finalized.");
  } catch (error) {
    console.error("Error during backup:", error);
    res.status(500).json({ error: "Failed to backup specific data." });
  }
};

service.getItemVersions = async (projectId, itemId, accessToken) => {
  try {
    const resp = await withTimeout(
      dataManagementClient.getItemVersions(accessToken, projectId, itemId),
      15000
    );
    return resp.data;
  } catch (err) {
    console.log(err);
  }
};