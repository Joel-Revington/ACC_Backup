import { initViewer, loadModel } from './viewer.js';
import { initTree } from './sidebar.js';

const login = document.getElementById('login');
const backupAll = document.getElementById('backup-all');
const backupSelected = document.getElementById('backup-selected');
const hubSelect = document.getElementById('hub-select');
const projectSelect = document.getElementById('project-select');
const spinner = document.getElementById('spinner');

function showSpinner() {
    spinner.style.display = 'block';
}

function hideSpinner() {
    spinner.style.display = 'none';
}

async function fetchHubs() {
    try {
        const response = await fetch('/api/hubs');
        if (response.ok) {
            const hubs = await response.json();
            hubs.forEach(hub => {
                const option = document.createElement('option');
                option.value = hub.id;
                option.text = hub.attributes.name;
                hubSelect.appendChild(option);
            });
        } else {
            console.error('Failed to fetch hubs');
        }
    } catch (err) {
        console.error('Error fetching hubs:', err);
    }
}

async function fetchProjects(hubId) {
    try {
        const response = await fetch(`/api/hubs/${hubId}/projects`);
        if (response.ok) {
            const projects = await response.json();
            projectSelect.innerHTML = '';
            projects.forEach(project => {
                const option = document.createElement('option');
                option.value = project.id;
                option.text = project.attributes.name;
                projectSelect.appendChild(option);
            });
        } else {
            console.error('Failed to fetch projects');
        }
    } catch (err) {
        console.error('Error fetching projects:', err);
    }
}

// Function to handle the backup process for all hubs and projects
async function handleBackupAll() {
    console.log('BackUp All button clicked');
    showSpinner();
    try {
        const response = await fetch('/api/aps/backup', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        if (response.ok) {
            const blob = await response.blob(); 
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'backup.zip'; 
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link); 
        } else {
            const errorText = await response.text();
            console.error('Backup failed:', errorText);
        }
    } catch (err) {
        console.error('Error during backup:', err);
    } finally{
        hideSpinner()
    }
}

// Function to handle the backup process for selected hub and project
async function handleBackupSelected() {
    const hubId = hubSelect.value;
    const projectId = projectSelect.value;
    console.log(`BackUp Selected button clicked for hub: ${hubId}, project: ${projectId}`);
    showSpinner()
    try {
        const response = await fetch(`/api/aps/backup?hub_id=${hubId}&project_id=${projectId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        if (response.ok) {
            const blob = await response.blob(); 
            const url = window.URL.createObjectURL(blob); 
            const link = document.createElement('a'); 
            link.href = url;
            link.download = 'backup.zip'; 
            document.body.appendChild(link); 
            link.click();
            document.body.removeChild(link);
        } else {
            const errorText = await response.text();
            console.error('Backup failed:', errorText);
        }
    } catch (err) {
        console.error('Error during backup:', err);
    } finally {
        hideSpinner()
    }
}

hubSelect.addEventListener('change', () => {
    fetchProjects(hubSelect.value);
});

backupAll.addEventListener('click', handleBackupAll);
backupSelected.addEventListener('click', handleBackupSelected);

try {
    const resp = await fetch('/api/auth/profile');
    if (resp.ok) {
        const user = await resp.json();
        login.innerText = `Logout (${user.name})`;
        login.onclick = () => {
            const iframe = document.createElement('iframe');
            iframe.style.visibility = 'hidden';
            iframe.src = 'https://accounts.autodesk.com/Authentication/LogOut';
            document.body.appendChild(iframe);
            iframe.onload = () => {
                window.location.replace('/api/auth/logout');
                document.body.removeChild(iframe);
            };
        }
        const viewer = await initViewer(document.getElementById('preview'));
        initTree('#tree', (id) => loadModel(viewer, window.btoa(id).replace(/=/g, '')));
        await fetchHubs();
    } else {
        login.innerText = 'Login';
        login.onclick = () => window.location.replace('/api/auth/login');
    }
    login.style.visibility = 'visible';
} catch (err) {
    console.error(err);
}
