const header = document.querySelector('.header');
const content = document.querySelector('.content');

function switchTab(tabId) {
    const tabContents = document.querySelectorAll('.tab-content');
    const navItems = document.querySelectorAll('.nav-item');
    
    // Remove active class from all tab contents
    tabContents.forEach(content => content.classList.remove('active'));
    // Add active class to corresponding tab content
    const targetTab = document.getElementById(tabId);
    if (targetTab) {
        targetTab.classList.add('active');
    }
    
    // Show/hide header based on active tab
    if (tabId === 'home') {
        header.style.display = 'none';
        content.style.paddingTop = '0';
    } else {
        header.style.display = 'flex';
        content.style.paddingTop = '120px';
    }
    
    // Update header nav active state
    navItems.forEach(nav => nav.classList.remove('active'));
    const headerNavItem = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
    if (headerNavItem) {
        headerNavItem.classList.add('active');
    }
}

// Wait for DOM to fully load
document.addEventListener('DOMContentLoaded', function() {
    const navItems = document.querySelectorAll('.nav-item');
    const homeNavItems = document.querySelectorAll('.home-nav-item');
    
    // Header navigation
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const tabId = item.getAttribute('data-tab');
            switchTab(tabId);
        });
    });

    // Home page navigation
    homeNavItems.forEach(item => {
        item.addEventListener('click', () => {
            const tabId = item.getAttribute('data-tab');
            switchTab(tabId);
        });
    });

    // Initialize - hide header on load if home is active
    if (document.getElementById('home').classList.contains('active')) {
        header.style.display = 'none';
        content.style.paddingTop = '0';
    }
});