document.addEventListener('DOMContentLoaded', () => {
  setupThemeToggle();

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

function setupThemeToggle() {
  if (document.querySelector('.theme-toggle-btn')) return;

  const systemTheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const storedTheme = localStorage.getItem('theme');
  const initialTheme = storedTheme === 'dark' || storedTheme === 'light' ? storedTheme : systemTheme;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'theme-toggle-btn';
  button.setAttribute('aria-label', 'Toggle dark mode');
  document.body.appendChild(button);

  const applyTheme = (theme) => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
    const isDark = theme === 'dark';
    button.innerHTML = `<i class="fas fa-${isDark ? 'sun' : 'moon'}"></i><span>${isDark ? 'Light mode' : 'Dark mode'}</span>`;
    button.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
  };

  applyTheme(initialTheme);
  button.addEventListener('click', () => {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });
}