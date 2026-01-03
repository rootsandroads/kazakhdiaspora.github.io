// Import Three.js as ES module
import * as THREE from 'three';

// ===================================
// STUDENT DATA FROM GOOGLE SHEETS
// ===================================
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTyDQgBwDKNy-BOdLYk_WsO35FdNpjBILO97OyHh8K5Tbcsbghz-yKmvOmqBz5Xx4SXNwGeMHF7a7qR/pub?output=csv';

let studentData = [];
let totalStudents = 0;
let totalCountries = 0;
let totalStories = 0;

// Parse CSV text into array of objects using PapaParse
function parseCSV(csvText) {
  // Check if PapaParse is loaded
  if (typeof Papa === 'undefined') {
    throw new Error('PapaParse library not loaded. Please check your internet connection.');
  }

  // Use PapaParse for robust CSV parsing
  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    trimHeaders: true,
    dynamicTyping: false
  });

  console.log('PapaParse result:', {
    errors: parsed.errors,
    meta: parsed.meta,
    dataLength: parsed.data.length
  });

  const data = parsed.data;
  const headers = parsed.meta.fields;

  // Debug: Log headers to see actual column names
  console.log('CSV Headers:', headers);
  console.log('Total columns:', headers.length);

  // Debug: Log first row to see structure
  if (data.length > 0) {
    console.log('First row data sample:', {
      fullName: data[0]['1. Full name '], // Note: has trailing space in actual CSV
      country: data[0]['4. Current City and Country of residence'],
      consent: data[0]['16. Do you consent to having your information displayed on the Roots & Roads website?'],
      latitude: data[0]['Latitude'],
      longitude: data[0]['Longitude']
    });
    console.log('All consent column possibilities:',
      headers.filter(k => k && k.toLowerCase().includes('consent'))
    );
  }

  // Filter data based on consent and valid name
  const filteredData = data.filter(rowData => {
    // More flexible consent checking - check multiple possible column names
    const consentValue =
      rowData['16. Do you consent to having your information displayed on the Roots & Roads website?'] ||
      rowData['25. Do you consent to having your information displayed on the Roots & Roads website?'] ||
      rowData['Do you consent to having your information displayed on the Roots & Roads website?'] ||
      rowData['16. Do you consent to having your information displayed on the Roots &amp; Roads website?'] ||
      rowData['25. Do you consent to having your information displayed on the Roots &amp; Roads website?'] ||
      '';

    // Include row if consent contains 'yes' (case insensitive) or if no consent column exists (assume yes)
    const hasConsent = consentValue.toLowerCase().includes('yes') ||
                       consentValue.toLowerCase().includes('y') ||
                       !headers.some(h => h && h.toLowerCase().includes('consent'));

    // Must have a name - check with and without trailing space
    const hasName = (rowData['1. Full name '] || rowData['1. Full name']) &&
                    (rowData['1. Full name '] || rowData['1. Full name']).trim().length > 0;

    return hasConsent && hasName;
  });

  console.log(`Found ${filteredData.length} valid rows with consent out of ${data.length} total rows`);

  return filteredData;
}

// Update loading status
function updateLoadingStatus(message) {
  const statusElement = document.getElementById('loading-status');
  if (statusElement) {
    statusElement.textContent = message;
  }
}

// Hide loading overlay
function hideLoadingOverlay() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.5s ease';
    setTimeout(() => {
      overlay.style.display = 'none';
    }, 500);
  }
}

// Show error message
function showError(message) {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.innerHTML = `
      <div style="text-align: center; color: white;">
        <p style="font-size: 48px; margin: 0;">⚠️</p>
        <p style="font-size: 20px; font-weight: 600; margin: 20px 0 10px;">Error Loading Data</p>
        <p style="font-size: 14px; opacity: 0.8; margin: 0;">${message}</p>
        <button onclick="location.reload()" style="
          margin-top: 20px;
          padding: 10px 20px;
          background: white;
          color: #667eea;
          border: none;
          border-radius: 5px;
          font-weight: 600;
          cursor: pointer;
        ">Retry</button>
      </div>
    `;
  }
}

// Fetch and process student data from Google Sheets
async function fetchStudentData() {
  try {
    updateLoadingStatus('Connecting to Google Sheets...');
    console.log('Fetching from URL:', CSV_URL);

    const response = await fetch(CSV_URL);
    console.log('Response status:', response.status, response.statusText);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    updateLoadingStatus('Parsing student data...');
    const csvText = await response.text();
    console.log('CSV text length:', csvText.length);
    console.log('First 200 characters:', csvText.substring(0, 200));

    if (!csvText || csvText.trim().length === 0) {
      throw new Error('Received empty data from Google Sheets');
    }

    const rawData = parseCSV(csvText);

    if (rawData.length === 0) {
      console.warn('No student data found with consent. Showing empty map.');
    }

    updateLoadingStatus('Processing student stories...');

    // Transform CSV data into format needed for map
    // Note: '1. Full name ' has a trailing space in the actual CSV header
    studentData = rawData.map(row => ({
      // Basic info
      fullName: (row['1. Full name '] || row['1. Full name']) || 'Anonymous',
      age: row['2. Age'] || '',
      region: row['3. Region in Kazakhstan you are originally from'] || '',
      country: row['4. Current City and Country of residence'] || row['4. Current Country of Residence'] || '',
      city: row['5. Current City of Residence'] || '',

      // Academic/Professional info
      studyOrWork: row['6. Are you studying or working abroad?'] || '',
      institution: row['7. University Name / Workplace'] || '',
      degree: row['8. Degree or Position\n(e.g., Bachelor in International Relations, MA in Economics, Software Engineer)'] ||
              row['8. Degree or Position\n(e.g., Bachelor in International Relations, MA in Economics, Software Engineer)'] || '',
      specialization: row['9. Faculty / Specialization'] || '',
      yearOrStage: row['9. Year of Study / Career Stage'] || row['10. Year of Study / Career Stage'] || '',

      // Story details
      motivation: row['11. What motivated you to study or work abroad?'] || '',
      proud: row['10. Please list your achievements, projects, seminars, or other activities you wish to be listed as your personal achievements on a website)'] ||
             row['12. What are you most proud of academically or professionally?'] || '',
      activities: row['13. Have you participated in any clubs, organizations, awards, conferences, or special projects?'] || '',
      unique: row['14. What makes your journey unique or inspiring?'] || '',
      challenges: row['15. What challenges did you face while living abroad?'] || '',
      overcome: row['16. How did you overcome these challenges?'] || '',
      advice: row['11. What advice would you give to future Kazakh st? ( it will listed as your personal moto/advice )'] ||
              row['13. What advice would you give to young kazakh  students who want to study or work abroad?'] ||
              row['17. What advice would you give to future Kazakh students who want to study/work abroad?'] || '',
      culture: row['18. What do you wish people around the world knew about Kazakhstan or Kazakh culture?'] || '',
      changed: row['19. How has living abroad changed you as a person?'] || '',
      finance: row['12. How did you finance your studies abroad?'] ||
               row['20. How did you finance your studies abroad?'] || '',
      satisfaction: row['13. Rate your satisfaction with your experience abroad'] ||
                    row['21. Rate your satisfaction with your experience abroad'] || '',
      returnPlan: row['22. Do you plan to return to Kazakhstan in the future? Why or why not?'] || '',
      preferredRegion: row['14. Preferred region to live after graduation'] ||
                       row['23. Preferred region to live after graduation'] || '',
      photo: row['15. Upload a photo you would like displayed on the website'] ||
             row['24. Upload a photo you would like displayed on the website'] || '',
      socialMedia: row['17. Optional: Social media links (Instagram/LinkedIn)'] ||
                   row['26. Optional: Social media links (Instagram/LinkedIn)'] || '',

      // Location
      lat: parseFloat(row['Latitude']) || 0,
      lon: parseFloat(row['Longitude']) || 0,

      timestamp: row['Timestamp'] || ''
    }));

    // Calculate statistics
    totalStories = studentData.length;

    // Count unique countries
    const uniqueCountries = new Set(studentData.map(s => s.country).filter(c => c));
    totalCountries = uniqueCountries.size;

    // For student count, use total stories (each entry is one student)
    totalStudents = totalStories;

    updateLoadingStatus(`Loaded ${totalStories} stories successfully!`);

    return studentData;
  } catch (error) {
    console.error('Error fetching student data:', error);
    showError(error.message || 'Failed to load data from Google Sheets');
    throw error; // Re-throw to handle in caller
  }
}

// ===================================
// 3D GLOBE WITH THREE.JS
// ===================================
let scene, camera, renderer, globe, controls;
let isGlobeDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let rotation = { x: 0, y: 0 };

function initGlobe() {
  const container = document.getElementById('globe');
  if (!container) return;

  // Scene
  scene = new THREE.Scene();

  // Camera
  const width = container.clientWidth;
  const height = container.clientHeight;
  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.z = 2.5;

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);
  renderer.domElement.id = 'globe-canvas';

  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 3, 5);
  scene.add(directionalLight);

  // Create Earth sphere
  const geometry = new THREE.SphereGeometry(1, 64, 64);

  // Load Earth texture
  const textureLoader = new THREE.TextureLoader();
  const earthTexture = textureLoader.load(
    'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg'
  );

  const material = new THREE.MeshPhongMaterial({
    map: earthTexture,
    shininess: 15
  });

  globe = new THREE.Mesh(geometry, material);
  scene.add(globe);

  // Add markers for each country
  addCountryMarkers();

  // Mouse controls
  setupGlobeControls(container);

  // Animation loop
  animateGlobe();
}

function addCountryMarkers() {
  if (!studentData || studentData.length === 0) return;

  studentData.forEach(data => {
    // Skip entries without valid coordinates
    if (!data.lat || !data.lon || data.lat === 0 || data.lon === 0) return;

    // Convert lat/lon to 3D coordinates
    const phi = (90 - data.lat) * (Math.PI / 180);
    const theta = (data.lon + 180) * (Math.PI / 180);

    const radius = 1.02; // Slightly above globe surface
    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);

    // Create marker
    const markerGeometry = new THREE.SphereGeometry(0.02, 16, 16);
    const markerMaterial = new THREE.MeshBasicMaterial({
      color: 0x9ad0ff,
      emissive: 0x4a9fff,
      emissiveIntensity: 0.5
    });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.set(x, y, z);

    // Store data for interaction
    marker.userData = data;

    globe.add(marker);

    // Pulsing animation
    let scale = 1;
    let growing = true;
    marker.onBeforeRender = () => {
      if (growing) {
        scale += 0.01;
        if (scale >= 1.3) growing = false;
      } else {
        scale -= 0.01;
        if (scale <= 1) growing = true;
      }
      marker.scale.set(scale, scale, scale);
    };
  });
}

function setupGlobeControls(container) {
  container.addEventListener('mousedown', (e) => {
    isGlobeDragging = true;
    previousMousePosition = { x: e.clientX, y: e.clientY };
  });

  window.addEventListener('mousemove', (e) => {
    if (isGlobeDragging) {
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      rotation.y += deltaX * 0.005;
      rotation.x += deltaY * 0.005;

      // Limit vertical rotation
      rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotation.x));

      previousMousePosition = { x: e.clientX, y: e.clientY };
    }
  });

  window.addEventListener('mouseup', () => {
    isGlobeDragging = false;
  });

  // Touch support
  container.addEventListener('touchstart', (e) => {
    isGlobeDragging = true;
    previousMousePosition = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
  });

  window.addEventListener('touchmove', (e) => {
    if (isGlobeDragging && e.touches.length > 0) {
      const deltaX = e.touches[0].clientX - previousMousePosition.x;
      const deltaY = e.touches[0].clientY - previousMousePosition.y;

      rotation.y += deltaX * 0.005;
      rotation.x += deltaY * 0.005;
      rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotation.x));

      previousMousePosition = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
    }
  });

  window.addEventListener('touchend', () => {
    isGlobeDragging = false;
  });

  // Click to navigate to map
  container.addEventListener('click', (e) => {
    // Only navigate if not dragging
    if (!isGlobeDragging) {
      showMapPage();
    }
  });
}

function animateGlobe() {
  requestAnimationFrame(animateGlobe);

  // Apply rotation from user interaction
  globe.rotation.y = rotation.y;
  globe.rotation.x = rotation.x;

  // Auto-rotate when not dragging
  if (!isGlobeDragging) {
    rotation.y += 0.001;
  }

  renderer.render(scene, camera);
}

// ===================================
// LEAFLET MAP
// ===================================
let map = null;
let currentHighlight = null;

function initLeafletMap() {
  const container = document.getElementById('map-container');
  if (!container || map) return;

  // Initialize map
  map = L.map('map-container').setView([48, 15], 2);

  // Add light blue tile layer to match website style
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors © CARTO',
    maxZoom: 18,
    subdomains: 'abcd'
  }).addTo(map);

  // Add markers for each student
  studentData.forEach(data => {
    // Skip entries without valid coordinates
    if (!data.lat || !data.lon || data.lat === 0 || data.lon === 0) return;

    const marker = L.marker([data.lat, data.lon]).addTo(map);

    // Create detailed popup with student information
    const popupContent = `
      <div style="font-family: 'Montserrat', sans-serif; max-width: 300px;">
        <h3 style="margin: 0 0 10px; font-size: 18px; color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 5px;">
          ${data.fullName}
        </h3>

        <div style="margin-bottom: 10px;">
          <p style="margin: 3px 0; font-size: 13px;"><strong>📍 Location:</strong> ${data.city}, ${data.country}</p>
          ${data.age ? `<p style="margin: 3px 0; font-size: 13px;"><strong>🎂 Age:</strong> ${data.age}</p>` : ''}
          ${data.region ? `<p style="margin: 3px 0; font-size: 13px;"><strong>🏠 From:</strong> ${data.region}, Kazakhstan</p>` : ''}
        </div>

        ${data.institution ? `
          <div style="margin-bottom: 10px; padding: 8px; background: #f5f7fa; border-radius: 5px;">
            <p style="margin: 3px 0; font-size: 13px;"><strong>🎓 ${data.studyOrWork}:</strong></p>
            <p style="margin: 3px 0; font-size: 12px;">${data.institution}</p>
            ${data.degree ? `<p style="margin: 3px 0; font-size: 12px;"><em>${data.degree}</em></p>` : ''}
            ${data.specialization ? `<p style="margin: 3px 0; font-size: 12px;">${data.specialization}</p>` : ''}
            ${data.yearOrStage ? `<p style="margin: 3px 0; font-size: 12px;">${data.yearOrStage}</p>` : ''}
          </div>
        ` : ''}

        ${data.motivation ? `
          <div style="margin-bottom: 8px;">
            <p style="margin: 3px 0; font-size: 12px; font-weight: bold; color: #555;">💭 Motivation:</p>
            <p style="margin: 3px 0; font-size: 11px; color: #666; line-height: 1.4;">${data.motivation.substring(0, 150)}${data.motivation.length > 150 ? '...' : ''}</p>
          </div>
        ` : ''}

        ${data.advice ? `
          <div style="margin-bottom: 8px;">
            <p style="margin: 3px 0; font-size: 12px; font-weight: bold; color: #555;">💡 Advice:</p>
            <p style="margin: 3px 0; font-size: 11px; color: #666; line-height: 1.4;">${data.advice.substring(0, 150)}${data.advice.length > 150 ? '...' : ''}</p>
          </div>
        ` : ''}

        ${data.socialMedia ? `
          <p style="margin-top: 10px; font-size: 12px;">
            <a href="${data.socialMedia}" target="_blank" style="color: #667eea; text-decoration: none;">
              🔗 Connect on Social Media
            </a>
          </p>
        ` : ''}

        <button onclick="showStudentStory('${data.fullName}')" style="
          margin-top: 10px;
          width: 100%;
          padding: 8px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          font-size: 12px;
          font-weight: bold;
        ">
          Read Full Story
        </button>
      </div>
    `;

    marker.bindPopup(popupContent, { maxWidth: 350 });

    // Customize marker icon
    const customIcon = L.divIcon({
      className: 'custom-marker',
      html: `<div style="
        width: 30px;
        height: 30px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 18px;
      ">📍</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    marker.setIcon(customIcon);

    // Add click event to highlight country boundaries
    marker.on('click', () => {
      highlightCountry(data.country);
    });
  });

  // Update dashboard stats
  updateDashboardStats();
}

// Function to show full student story (can be expanded later)
function showStudentStory(studentName) {
  const student = studentData.find(s => s.fullName === studentName);
  if (!student) return;

  // For now, just alert with full info. You can create a modal later
  alert(`Full story for ${studentName}:\n\n${student.unique || 'Story coming soon...'}`);
}

// Make function globally accessible for popup button clicks
window.showStudentStory = showStudentStory;

// Highlight country boundaries
async function highlightCountry(countryName) {
  // Remove previous highlight
  if (currentHighlight) {
    map.removeLayer(currentHighlight);
    currentHighlight = null;
  }

  // Map country names to ISO codes for the API
  const countryMap = {
    'United States': 'USA',
    'United Kingdom': 'GBR',
    'Germany': 'DEU',
    'Canada': 'CAN',
    'Turkey': 'TUR',
    'Russia': 'RUS',
    'South Korea': 'KOR',
    'China': 'CHN',
    'UAE': 'ARE',
    'Australia': 'AUS',
    'Poland': 'POL',
    'Czech Republic': 'CZE'
  };

  const isoCode = countryMap[countryName];
  if (!isoCode) return;

  try {
    // Fetch country GeoJSON from REST Countries API
    const response = await fetch(`https://restcountries.com/v3.1/alpha/${isoCode}`);
    const data = await response.json();

    if (data && data[0]) {
      // Get borders from OpenStreetMap Nominatim (alternative approach)
      const nominatimResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?country=${countryName}&polygon_geojson=1&format=json&limit=1`
      );
      const geoData = await nominatimResponse.json();

      if (geoData && geoData[0] && geoData[0].geojson) {
        // Create GeoJSON layer
        currentHighlight = L.geoJSON(geoData[0].geojson, {
          style: {
            color: '#9ad0ff',
            weight: 3,
            opacity: 0.8,
            fillColor: '#667eea',
            fillOpacity: 0.3
          }
        }).addTo(map);

        // Zoom to country bounds
        map.fitBounds(currentHighlight.getBounds(), { padding: [50, 50] });
      }
    }
  } catch (error) {
    console.log('Could not load country boundaries for', countryName);
  }
}

function updateDashboardStats() {
  // Animate counting up
  animateCount('total-students', totalStudents);
  animateCount('total-countries', totalCountries);
  animateCount('latest-story', totalStories);
}

function animateCount(elementId, target) {
  const element = document.getElementById(elementId);
  if (!element) return;

  let current = 0;
  const increment = target / 50;
  const timer = setInterval(() => {
    current += increment;
    if (current >= target) {
      element.textContent = target;
      clearInterval(timer);
    } else {
      element.textContent = Math.floor(current);
    }
  }, 20);
}

// ===================================
// PAGE NAVIGATION
// ===================================
function showMapPage() {
  document.body.classList.add('show-map');

  // Initialize map when shown
  setTimeout(() => {
    if (!map) {
      initLeafletMap();
    } else {
      map.invalidateSize();
    }
  }, 100);
}

function hideMapPage() {
  document.body.classList.remove('show-map');
}

// ===================================
// PAGE INITIALIZATION
// ===================================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Show loading state
    console.log('Loading student data...');

    // Check if required libraries are loaded
    console.log('Checking dependencies...');
    console.log('- THREE.js:', typeof THREE !== 'undefined' ? '✓ Loaded' : '✗ Missing');
    console.log('- Leaflet:', typeof L !== 'undefined' ? '✓ Loaded' : '✗ Missing');
    console.log('- PapaParse:', typeof Papa !== 'undefined' ? '✓ Loaded' : '✗ Missing');

    // Fetch student data from Google Sheets
    await fetchStudentData();

    console.log(`Loaded ${studentData.length} student stories from ${totalCountries} countries`);

    // Initialize 3D globe
    initGlobe();

    // Hide loading overlay after a short delay
    setTimeout(() => {
      hideLoadingOverlay();
    }, 1000);
  } catch (error) {
    console.error('Failed to initialize application:', error);
    // Error is already displayed by showError() function
    return;
  }

  // Navigation buttons
  const backBtn = document.getElementById('back-btn');
  const globeElement = document.getElementById('globe');
  const mapLinks = document.querySelectorAll('a[href="#map-page"], .map-link');

  // Note: Contribute button now links directly to Google Forms, no JS needed

  // Handle map page navigation
  mapLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      showMapPage();
    });
  });

  if (backBtn) {
    backBtn.addEventListener('click', hideMapPage);
  }

  // Flip Cards functionality
  const flipCards = document.querySelectorAll('.flip-card');

  flipCards.forEach(card => {
    card.addEventListener('click', function(e) {
      // Prevent flipping if clicking a link inside the card
      if (e.target.tagName === 'A') {
        return;
      }

      // Toggle the flipped class
      this.classList.toggle('flipped');
    });

    // Also add keyboard support for accessibility
    card.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.classList.toggle('flipped');
      }
    });

    // Make cards focusable for keyboard navigation
    card.setAttribute('tabindex', '0');
  });

  // Handle window resize for globe
  window.addEventListener('resize', () => {
    if (renderer && camera) {
      const container = document.getElementById('globe');
      if (container) {
        const width = container.clientWidth;
        const height = container.clientHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      }
    }
  });

  // ===================================
  // MOBILE NAVIGATION
  // ===================================
  const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
  const mobileNavDrawer = document.getElementById('mobile-nav-drawer');
  const mobileNavOverlay = document.getElementById('mobile-nav-overlay');
  const mobileNavClose = document.getElementById('mobile-nav-close');
  const mobileContributeBtn = document.getElementById('mobile-contribute-btn');

  function openMobileNav() {
    mobileNavDrawer.classList.add('active');
    mobileNavOverlay.classList.add('active');
    document.body.classList.add('mobile-nav-open');
    mobileMenuToggle.setAttribute('aria-expanded', 'true');

    // Focus first link for accessibility
    const firstLink = mobileNavDrawer.querySelector('.mobile-nav-link');
    if (firstLink) {
      setTimeout(() => firstLink.focus(), 300);
    }
  }

  function closeMobileNav() {
    mobileNavDrawer.classList.remove('active');
    mobileNavOverlay.classList.remove('active');
    document.body.classList.remove('mobile-nav-open');
    mobileMenuToggle.setAttribute('aria-expanded', 'false');
    mobileMenuToggle.focus();
  }

  if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener('click', openMobileNav);
  }

  if (mobileNavClose) {
    mobileNavClose.addEventListener('click', closeMobileNav);
  }

  if (mobileNavOverlay) {
    mobileNavOverlay.addEventListener('click', closeMobileNav);
  }

  // Mobile contribute button now links directly to Google Forms
  // Just close the nav when clicked (link will open in new tab)
  if (mobileContributeBtn) {
    mobileContributeBtn.addEventListener('click', () => {
      closeMobileNav();
    });
  }

  // Close mobile nav when clicking on a link
  const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');
  mobileNavLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');

      // If it's the map link, close nav and open map
      if (href === '#map-page') {
        e.preventDefault();
        closeMobileNav();
        setTimeout(() => showMapPage(), 300); // Wait for drawer to close
      } else if (!href.startsWith('#')) {
        // External links, just close nav and let them navigate
        closeMobileNav();
      }
    });
  });

  // ESC key to close mobile nav
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileNavDrawer.classList.contains('active')) {
      closeMobileNav();
    }
  });

  // Prevent scroll on body when mobile nav is open (iOS fix)
  let scrollPosition = 0;
  const preventScroll = () => {
    scrollPosition = window.pageYOffset;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollPosition}px`;
    document.body.style.width = '100%';
  };

  const allowScroll = () => {
    document.body.style.removeProperty('overflow');
    document.body.style.removeProperty('position');
    document.body.style.removeProperty('top');
    document.body.style.removeProperty('width');
    window.scrollTo(0, scrollPosition);
  };

  // Update when nav opens/closes
  const observer = new MutationObserver(() => {
    if (document.body.classList.contains('mobile-nav-open')) {
      preventScroll();
    } else {
      allowScroll();
    }
  });

  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['class']
  });
});
