document.addEventListener('DOMContentLoaded', () => {
  const hamburgerMenu = document.querySelector('.hamburger-menu');
  const mobileNavLinks = document.querySelector('.mobile-nav-links');
  const closeMenu = document.getElementById('close-menu');

  if (hamburgerMenu) {
    hamburgerMenu.addEventListener('click', (e) => {
      e.preventDefault();
      mobileNavLinks.classList.add('show'); // Activar el menú
    });
  }

  if (closeMenu) {
    closeMenu.addEventListener('click', (e) => {
      e.preventDefault();
      mobileNavLinks.classList.remove('show'); // Desactivar el menú
    });
  }
});
