document.addEventListener('DOMContentLoaded', () => {
  const hamburgerMenu = document.querySelector('.hamburger-menu');
  const mobileNavLinks = document.querySelector('.mobile-nav-links');
  const closeMenu = document.getElementById('close-menu');

let scrollPosition = 0;

function preventBodyScroll(prevent) {
  if (prevent) {
    document.body.classList.add('menu-open');
  } else {
    document.body.classList.remove('menu-open');
  }
}
function openMenu() {
  if (mobileNavLinks) {
    mobileNavLinks.classList.add('show');
    preventBodyScroll(true);
    mobileNavLinks.setAttribute('aria-hidden', 'false');
      if (hamburgerMenu) {
        hamburgerMenu.setAttribute('aria-expanded', 'true');
      }
    }
  }

  function closeMenuFunction() {
    if (mobileNavLinks) {
      mobileNavLinks.classList.remove('show');
      preventBodyScroll(false);
      mobileNavLinks.setAttribute('aria-hidden', 'true');
      if (hamburgerMenu) {
        hamburgerMenu.setAttribute('aria-expanded', 'false');
      }
    }
  }

  if (hamburgerMenu) {
    hamburgerMenu.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openMenu();
    });
  }

  if (closeMenu) {
    closeMenu.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeMenuFunction();
    });
  }

  document.addEventListener('click', (e) => {
    if (mobileNavLinks && mobileNavLinks.classList.contains('show')) {
      if (!mobileNavLinks.contains(e.target) && !hamburgerMenu.contains(e.target)) {
        closeMenuFunction();
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileNavLinks && mobileNavLinks.classList.contains('show')) {
      closeMenuFunction();
    }
  });

  // ✅ Cerrar el menú y cambiar la vista al hacer clic en enlaces del menú móvil
  if (mobileNavLinks) {
    const navLinks = mobileNavLinks.querySelectorAll('a');
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const id = link.id;

        closeMenuFunction();

        setTimeout(async () => {
          if (id === 'btnNotasMobile') {
            vistaActual = 'notas';
            await cargarNotas(usuarioActual, 'notas');
            actualizarEstadoSidebar('btnNotas');
          } else if (id === 'btnArchivadasMobile') {
            vistaActual = 'archivadas';
            await cargarNotas(usuarioActual, 'archivadas');
            actualizarEstadoSidebar('btnArchivadas');
          } else if (id === 'btnPapeleraMobile') {
            vistaActual = 'papelera';
            await cargarNotas(usuarioActual, 'papelera');
            actualizarEstadoSidebar('btnPapelera');
          }
        }, 200); // espera visual antes de cargar
      });
    });
  }

  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      closeMenuFunction();
    }
  });

  if (mobileNavLinks) {
    mobileNavLinks.addEventListener('touchmove', (e) => {
      if (mobileNavLinks.classList.contains('show')) {
        e.preventDefault();
      }
    }, { passive: false });
  }
});
