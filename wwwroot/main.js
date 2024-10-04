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

function updateBackupSelectedState(){
    if (hubSelect.value && projectSelect.value) {
        backupSelected.disabled = false;
        backupSelected.style.cursor = 'pointer';
    } else {
        backupSelected.disabled = true;
        backupSelected.style.cursor = 'not-allowed';
    }
}

async function fetchHubs() {
    try {
        const response = await fetch('/api/hubs');
        if (response.ok) {
            const hubs = await response.json();
            hubSelect.innerHTML = "";
            const placeholderOption = document.createElement('option');
            placeholderOption.value = '';
            placeholderOption.text = 'Select Hub';
            hubSelect.appendChild(placeholderOption);

            if (hubs.length > 0) {
                hubs.forEach((hub, index) => {
                    const option = document.createElement('option');
                    option.value = hub.id;
                    option.text = hub.attributes.name;
                    hubSelect.appendChild(option);
                });
                hubSelect.value = '';
                projectSelect.innerHTML = '';
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.text = 'Select Project';
                projectSelect.appendChild(defaultOption);
            }
        } else {
            console.error('Failed to fetch hubs');
        }
    } catch (err) {
        console.error('Error fetching hubs:', err);
    }
}

async function fetchProjects(hubId) {
    if (!hubId) {
        // Clear project options if no hub is selected
        projectSelect.innerHTML = '';
        const placeholderOption = document.createElement('option');
        placeholderOption.value = '';
        placeholderOption.text = 'Select Project';
        projectSelect.appendChild(placeholderOption);
        updateBackupSelectedState();
        return;
    }

    try {
        const response = await fetch(`/api/hubs/${hubId}/projects`);
        if (response.ok) {
            const projects = await response.json();
            projectSelect.innerHTML = '';
            const placeholderOption = document.createElement('option');
            placeholderOption.value = '';
            placeholderOption.text = 'Select Project';
            projectSelect.appendChild(placeholderOption);

            if (projects.length > 0) {
                projects.forEach(project => {
                    const option = document.createElement('option');
                    option.value = project.id;
                    option.text = project.attributes.name;
                    projectSelect.appendChild(option);
                });
                // Optionally, select the first project by default
                // projectSelect.value = projects[0].id;
            } else {
                // Handle case where no projects are available
                const noProjectsOption = document.createElement('option');
                noProjectsOption.value = '';
                noProjectsOption.text = 'No Projects Available';
                projectSelect.appendChild(noProjectsOption);
            }
        } else {
            console.error('Failed to fetch projects');
        }
    } catch (err) {
        console.error('Error fetching projects:', err);
    }
    updateBackupSelectedState();
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
    if(!hubId && !projectId){
        alert("Hub or Project not selected")
    } else {
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
}

hubSelect.addEventListener('change', () => {
    fetchProjects(hubSelect.value);
    updateBackupSelectedState()
});
projectSelect.addEventListener('change', updateBackupSelectedState)
backupAll.addEventListener('click', handleBackupAll);
backupSelected.addEventListener('click', handleBackupSelected);

try {
    const resp = await fetch('/api/auth/profile');
    if (resp.ok) {
        const user = await resp.json();
        login.innerText = `Logout (${user.name})`;
        document.getElementById('login-modal').style.display = 'none';
        document.getElementById('header').style.width = '25%'
        document.getElementById('backup').style.width = '75%'
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
