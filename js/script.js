// Mobile Menu Toggle Script
document.addEventListener('DOMContentLoaded', function() {
    const menuToggle = document.querySelector('.mobile-menu-toggle');
    const nav = document.querySelector('.nav');
    const body = document.body;
    
    if (menuToggle) {
        menuToggle.addEventListener('click', function() {
            this.classList.toggle('active');
            nav.classList.toggle('active');
            body.classList.toggle('menu-open');
        });
        
        // Close menu when clicking on a nav item
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', function() {
                menuToggle.classList.remove('active');
                nav.classList.remove('active');
                body.classList.remove('menu-open');
            });
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', function(e) {
            if (!nav.contains(e.target) && !menuToggle.contains(e.target) && nav.classList.contains('active')) {
                menuToggle.classList.remove('active');
                nav.classList.remove('active');
                body.classList.remove('menu-open');
            }
        });
    }
});