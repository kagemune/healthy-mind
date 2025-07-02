// Selecciona el ícono del menú hamburguesa y el menú lateral
const hamburgerMenu = document.querySelector('.hamburger-menu');
const mobileNavLinks = document.querySelector('.mobile-nav-links');

// Añadir el evento de clic al menú hamburguesa
hamburgerMenu.addEventListener('click', () => {
  mobileNavLinks.classList.toggle('active'); // Alterna la clase "active" para mostrar/ocultar el menú lateral
});

