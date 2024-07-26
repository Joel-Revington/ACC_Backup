import { initViewer, loadModel } from './viewer.js';
import { initTree } from './sidebar.js';

const login = document.getElementById('login');

// Async function to fetch JSON data from a given URL
async function getJSON(url) {
    try {
        const resp = await fetch(url);
        if (!resp.ok) {
            alert('Could not load data. See console for more details.');
            console.error(await resp.text());
            return [];
        }
        return await resp.json();
    } catch (err) {
        console.log(err);
        return [];
    }
}

// Function to populate a dropdown with options
function populateDropdown(dropdown, items, defaultOptionText) {
    dropdown.innerHTML = `<option value="">${defaultOptionText}</option>`;
    items.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.attributes.name || item.attributes.displayName || item.attributes.createTime;
        dropdown.appendChild(option);
    });
}

// Function to populate a container with checkboxes
function populateCheckboxContainer(container, items) {
    container.innerHTML = '';
    items.forEach(item => {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = item.id;
        checkbox.id = `project_${item.id}`;

        const label = document.createElement('label');
        label.htmlFor = `project_${item.id}`;
        label.textContent = item.attributes.name;

        const div = document.createElement('div');
        div.appendChild(checkbox);
        div.appendChild(label);
        container.appendChild(div);
    });
}

// Function to load hubs and populate the hubs dropdown
async function loadHubs() {
    const hubs = await getJSON('/api/hubs');
    console.log('Hubs:', hubs);
    const hubsDropdown = document.getElementById('hubsDropdown');
    populateDropdown(hubsDropdown, hubs, 'Select Hub');
}

// Function to load projects and populate the projects container
async function loadProjects(hubId) {
    if (!hubId) return;
    const projects = await getJSON(`/api/hubs/${hubId}/projects`);
    console.log('Projects:', projects);
    const projectsContainer = document.getElementById('projectsContainer');
    populateCheckboxContainer(projectsContainer, projects);
}

// Function to load contents based on selected projects
async function loadContents() {
    const selectedProjectIds = Array.from(document.querySelectorAll('#projectsContainer input:checked')).map(input => input.value);
    if (selectedProjectIds.length === 0) return;

    const hubId = document.getElementById('hubsDropdown').value;
    let allContents = [];
    for (const projectId of selectedProjectIds) {
        const contents = await getJSON(`/api/hubs/${hubId}/projects/${projectId}/contents`);
        allContents = allContents.concat(contents);
    }
    console.log('Contents:', allContents);
    const contentsDropdown = document.getElementById('contentsDropdown');
    populateDropdown(contentsDropdown, allContents, 'Select Content');
}

// Function to load versions based on selected content
async function loadVersions(itemId) {
    if (!itemId) return;
    const hubId = document.getElementById('hubsDropdown').value;
    const projectId = document.querySelector('#projectsContainer input:checked').value;
    const versions = await getJSON(`/api/hubs/${hubId}/projects/${projectId}/contents/${itemId}/versions`);
    console.log('Versions:', versions);
    const versionsDropdown = document.getElementById('versionsDropdown');
    populateDropdown(versionsDropdown, versions, 'Select Version');
}

document.getElementById('hubsDropdown').addEventListener('change', function () {
    loadProjects(this.value);
});

document.getElementById('projectsContainer').addEventListener('change', function () {
    loadContents();
});

document.getElementById('contentsDropdown').addEventListener('change', function () {
    loadVersions(this.value);
});


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
        // Initial load of hubs
        loadHubs();

        // Load the selected model when a version is selected
        document.getElementById('versionsDropdown').addEventListener('change', function () {
            const versionId = this.value;
            if (versionId) {
                loadModel(viewer, window.btoa(versionId).replace(/=/g, ''));
            }
        });
    } else {
        login.innerText = 'Login';
        login.onclick = () => window.location.replace('/api/auth/login');
    }
    login.style.visibility = 'visible';
} catch (err) {
    alert('Could not initialize the application. See console for more details.');
    console.error(err);
}
