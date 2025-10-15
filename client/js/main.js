document.addEventListener('DOMContentLoaded', () => {
  const toggles = document.querySelectorAll('.toggle');
  toggles.forEach(btn => {
    btn.addEventListener('click', () => {
      document.body.classList.toggle('sidebar-open');
    });
  });
});