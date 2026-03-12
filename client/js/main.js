document.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.querySelector('.sidebar');
  const mainContent = document.querySelector('.main-content') || document.querySelector('.content');

  if (sidebar && window.innerWidth <= 1024) {
    const mobileToggle = document.createElement('button');
    mobileToggle.type = 'button';
    mobileToggle.className = 'mobile-menu-btn';
    mobileToggle.setAttribute('aria-label', 'Toggle menu');
    mobileToggle.innerHTML = '☰';
    document.body.appendChild(mobileToggle);

    mobileToggle.addEventListener('click', () => {
      sidebar.classList.toggle('active');
    });

    if (mainContent) {
      mainContent.addEventListener('click', () => {
        sidebar.classList.remove('active');
      });
    }
  }

  const currentPath = window.location.pathname;
  document.querySelectorAll('.sidebar .nav-item').forEach((link) => {
    const href = link.getAttribute('href');
    if (!href) return;
    if (href === currentPath || (href !== '/' && currentPath.startsWith(href))) {
      link.classList.add('active');
    }
  });
});