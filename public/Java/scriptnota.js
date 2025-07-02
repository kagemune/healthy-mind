let usuarioActual = null;
let vistaActual = 'notas';
// === NUEVAS VARIABLES PARA BÚSQUEDA ===
let todasLasNotas = []; // Cache de todas las notas cargadas
let notasFiltradas = []; // Notas que coinciden con la búsqueda

// === INICIALIZA LA AUTENTICACIÓN ===
firebase.auth().onAuthStateChanged(async (user) => {
  if (user) {
    console.log("✅ Usuario autenticado:", user.uid);
    usuarioActual = user.uid;
    await actualizarNotasSinAutores();
    await cargarNotas(usuarioActual, 'notas');
    configurarEventosSidebar();
    initThemeToggle();
    // ⭐ NUEVO: Inicializar expansión de notas
    initExpandableNotes();
  } else {
    window.location.href = "/contenido_de_la_pagina/Inicio_de_sesion/Inicio_de_sesion.html";
  }
});

// === ACTUALIZA NOTAS SIN CAMPO 'autores' ===
async function actualizarNotasSinAutores() {
  try {
    const snap = await db.collection('notas').where("autores", "==", null).get();
    const updates = snap.docs.map(d => d.ref.update({ autores: [usuarioActual] }));
    await Promise.all(updates);
  } catch (error) {
    console.error("Error actualizando notas sin autores:", error);
  }
}

// === CARGA NOTAS SEGÚN LA VISTA - MEJORADA CON BÚSQUEDA ===
async function cargarNotas(usuario, vista) {
  try {
    const contenedor = document.getElementById('notes-container');
    if (!contenedor) return;

    let q = db.collection('notas').where('autores', 'array-contains', usuario);
    
    // Filtros específicos por vista
    if (vista === 'archivadas') {
      q = q.where('archivada', '==', true).where('papelera', '==', false);
    } else if (vista === 'papelera') {
      q = q.where('papelera', '==', true);
    } else {
      // Vista normal: no archivadas ni en papelera
      q = q.where('archivada', '==', false).where('papelera', '==', false);
    }

    const snapshot = await q.get();
    const notas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Ordenar notas: fijadas primero, luego por fecha
    notas.sort((a, b) => {
      if (a.fijada && !b.fijada) return -1;
      if (!a.fijada && b.fijada) return 1;
      const fechaA = a.fechaCreacion?.toDate() || new Date(0);
      const fechaB = b.fechaCreacion?.toDate() || new Date(0);
      return fechaB - fechaA;
    });

    console.log("📝 Notas cargadas:", notas);

    // ⭐ NUEVO: Guardar todas las notas en cache para búsqueda
    todasLasNotas = notas;

    // ⭐ NUEVO: Verificar si hay búsqueda activa
    const searchInput = document.getElementById('search-notes');
    const queryActiva = searchInput?.value.trim();
    
    if (queryActiva) {
      // Si hay búsqueda activa, aplicar filtro
      buscarNotas(queryActiva);
    } else {
      // Si no hay búsqueda, mostrar todas las notas
      contenedor.innerHTML = notas.length
        ? notas.map(n => generarHTMLNota(n, vista)).join('')
        : '<p class="no-notes-message">No hay notas disponibles.</p>';
    }

    // ⭐ NUEVO: Inicializar expansión después de renderizar
    setTimeout(() => {
      initExpandableNotes();
    }, 100);
      
  } catch (error) {
    console.error("Error cargando notas:", error);
    document.getElementById('notes-container').innerHTML = '<p class="error-message">Error al cargar las notas.</p>';
  }
}

// === SISTEMA DE BÚSQUEDA ===
function inicializarBusqueda() {
  const searchInput = document.getElementById('search-notes');
  if (!searchInput) return;

  // Búsqueda en tiempo real con debounce
  let timeoutId;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(timeoutId);
    const query = e.target.value.trim();
    
    // Debounce para evitar búsquedas excesivas
    timeoutId = setTimeout(() => {
      if (query.length > 0) {
        buscarNotas(query);
      } else {
        mostrarTodasLasNotas();
      }
    }, 300);
  });

  // Limpiar búsqueda al presionar Escape
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.target.value = '';
      mostrarTodasLasNotas();
    }
  });
}

// Función principal de búsqueda
function buscarNotas(query) {
  if (!todasLasNotas.length) return;

  const queryLower = query.toLowerCase();
  
  notasFiltradas = todasLasNotas.filter(nota => {
    // Buscar en título
    const tituloMatch = (nota.title || '').toLowerCase().includes(queryLower);
    
    // Buscar en contenido
    const contenidoMatch = (nota.content || '').toLowerCase().includes(queryLower);
    
    // Buscar en tags si existen
    const tagsMatch = nota.tags ? 
      nota.tags.some(tag => tag.toLowerCase().includes(queryLower)) : false;
    
    return tituloMatch || contenidoMatch || tagsMatch;
  });

  mostrarResultadosBusqueda(notasFiltradas, query);
}

// Mostrar resultados de búsqueda
function mostrarResultadosBusqueda(notas, query) {
  const contenedor = document.getElementById('notes-container');
  if (!contenedor) return;

  if (notas.length === 0) {
    contenedor.innerHTML = `
      <div class="no-results">
        <h3>🔍 No se encontraron resultados</h3>
        <p>No hay notas que coincidan con "<strong>${query}</strong>"</p>
        <button onclick="limpiarBusqueda()" class="btn-clear-search">
          <i class="fas fa-times"></i> Limpiar búsqueda
        </button>
      </div>
    `;
    return;
  }

  const contadorHTML = `
    <div class="search-results-count">
      <div class="results-info">
        <span>📋 ${notas.length} resultado${notas.length !== 1 ? 's' : ''} para "<strong>${query}</strong>"</span>
        <button onclick="limpiarBusqueda()" class="btn-clear-search">
          <i class="fas fa-times"></i> Limpiar
        </button>
      </div>
    </div>
  `;

  // Resaltar términos de búsqueda en los resultados
  const notasConResaltado = notas.map(nota => ({
    ...nota,
    title: resaltarTexto(nota.title || 'Sin título', query),
    content: resaltarTexto(nota.content || '', query)
  }));

  contenedor.innerHTML = contadorHTML + 
    notasConResaltado.map(n => generarHTMLNota(n, vistaActual)).join('');

  // ⭐ NUEVO: Reinicializar expansión después de mostrar resultados
  setTimeout(() => {
    initExpandableNotes();
  }, 100);
}

// Función para resaltar texto
function resaltarTexto(texto, query) {
  if (!query || !texto) return texto;
  
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return texto.replace(regex, '<mark class="search-highlight">$1</mark>');
}

// Limpiar búsqueda
function limpiarBusqueda() {
  const searchInput = document.getElementById('search-notes');
  if (searchInput) {
    searchInput.value = '';
    searchInput.focus();
  }
  mostrarTodasLasNotas();
}

// Mostrar todas las notas (sin filtro)
function mostrarTodasLasNotas() {
  const contenedor = document.getElementById('notes-container');
  if (!contenedor) return;

  if (todasLasNotas.length === 0) {
    contenedor.innerHTML = '<p class="no-notes-message">No hay notas disponibles.</p>';
    return;
  }

  contenedor.innerHTML = todasLasNotas.map(n => generarHTMLNota(n, vistaActual)).join('');

  // ⭐ NUEVO: Reinicializar expansión
  setTimeout(() => {
    initExpandableNotes();
  }, 100);
}

// === EXPANSIÓN DE NOTAS - INTEGRADA ===
function initExpandableNotes() {
  addExpandListeners();
}

function addExpandListeners() {
  const noteCards = document.querySelectorAll('.note-card');
  
  noteCards.forEach(card => {
    const contentPreview = card.querySelector('.note-content-preview');
    if (contentPreview && !contentPreview.hasAttribute('data-listener-added')) {
      
      // Agregar indicador si el contenido es largo
      addExpandIndicator(contentPreview);
      
      // Agregar listener de click
      contentPreview.addEventListener('click', (e) => {
        // Prevenir que se active si se hace click en botones de acción
        if (e.target.closest('.note-actions') || 
            e.target.closest('.dropdown-menu-icon') ||
            e.target.closest('.expand-btn') ||
            e.target.closest('.read-more-indicator')) {
          return;
        }
        
        toggleNoteExpansion(contentPreview);
      });
      
      // Marcar que ya tiene listener
      contentPreview.setAttribute('data-listener-added', 'true');
    }
  });
}

function addExpandIndicator(contentPreview) {
  // Solo agregar indicador si el contenido es más largo que el contenedor
  const maxHeight = 80; // Altura máxima del preview
  const lineHeight = 20; // Altura aproximada por línea
  const maxLines = Math.floor(maxHeight / lineHeight);
  const textLines = contentPreview.textContent.split('\n').length;
  const shouldAddIndicator = contentPreview.scrollHeight > maxHeight || textLines > maxLines;

  if (shouldAddIndicator) {
    // Crear indicador de "Leer más"
    const readMoreIndicator = document.createElement('div');
    readMoreIndicator.className = 'read-more-indicator';
    readMoreIndicator.innerHTML = '<i class="fas fa-chevron-down"></i> Leer más';
    
    // Agregar después del preview
    const existingIndicator = contentPreview.parentNode.querySelector('.read-more-indicator');
    if (!existingIndicator) {
      contentPreview.parentNode.insertBefore(readMoreIndicator, contentPreview.nextSibling);
      
      // Listener para el indicador
      readMoreIndicator.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleNoteExpansion(contentPreview);
      });
    }
  }
}

function toggleNoteExpansion(contentPreview) {
  const isExpanded = contentPreview.classList.contains('expanded');
  const readMoreIndicator = contentPreview.parentNode.querySelector('.read-more-indicator');
  
  if (isExpanded) {
    // Contraer
    contentPreview.classList.remove('expanded');
    
    if (readMoreIndicator) {
      readMoreIndicator.innerHTML = '<i class="fas fa-chevron-down"></i> Leer más';
    }
    
    console.log('📝 Nota contraída');
    
  } else {
    // Expandir
    contentPreview.classList.add('expanded');
    
    if (readMoreIndicator) {
      readMoreIndicator.innerHTML = '<i class="fas fa-chevron-up"></i> Leer menos';
    }
    
    console.log('📖 Nota expandida');
    
    // Scroll suave hacia la nota expandida (opcional)
    setTimeout(() => {
      contentPreview.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'nearest' 
      });
    }, 100);
  }
}

// === GENERA HTML DE UNA NOTA - ACTUALIZADA ===
function generarHTMLNota(nota, vista) {
  const privacidad = nota.privada ? '<div class="privacy-indicator">🔒</div>' : '';
  const estrellas = `${nota.fijada ? '📌' : ''} ${nota.favorita ? '⭐' : ''}`;
  const color = nota.color || obtenerColorAleatorio();
  const opciones = generarOpcionesHTML(vista);

  // ⭐ MEJORADO: No truncar contenido aquí, dejarlo completo para expansión
  const contenidoCompleto = nota.content || 'Sin contenido';

  return `
    <div class="note-card ${color}" data-id="${nota.id}">
      <div class="note-header">
        <h3>${nota.title || 'Sin título'} ${estrellas}</h3>
        ${vista === 'notas' ? `
          <div class="dropdown-menu-icon solo-mobile">
            <i class="fa-solid fa-ellipsis-vertical"></i>
            <ul class="dropdown-options">
              ${opciones}
            </ul>
          </div>` : `
          <div class="dropdown-menu-icon">
            <i class="fa-solid fa-ellipsis-vertical"></i>
            <ul class="dropdown-options">
              ${opciones}
            </ul>
          </div>`}
      </div>
      ${privacidad}
      <div class="note-content-preview" data-id="${nota.id}">
        ${contenidoCompleto}
      </div>
    </div>
  `;
}

function generarOpcionesHTML(vista) {
  switch (vista) {
    case 'archivadas':
      return `
        <li data-action="desarchivar">
          <i class="fas fa-undo"></i> Desarchivar
        </li>
        <li data-action="papelera">
          <i class="fas fa-trash-alt"></i> Mandar a Papelera
        </li>`;
    case 'papelera':
      return `
        <li data-action="restaurar">
          <i class="fas fa-undo"></i> Restaurar
        </li>
        <li data-action="eliminarPermanente">
          <i class="fas fa-trash"></i> Eliminar permanentemente
        </li>`;
    default:
      return `
        <li data-action="favorito">
          <i class="fas fa-star"></i> Favorito
        </li>
        <li data-action="fijar">
          <i class="fas fa-thumbtack"></i> Fijar
        </li>
        <li data-action="editar">
          <i class="fas fa-edit"></i> Editar
        </li>
        <li data-action="archivar">
          <i class="fas fa-archive"></i> Archivar
        </li>
        <li data-action="eliminar">
          <i class="fas fa-trash-alt"></i> Eliminar
        </li>`;
  }
}

// === MANEJO DE EVENTOS DE ACCIONES ===
document.addEventListener("click", async (e) => {
  const target = e.target.closest("[data-action]");
  if (!target) return;

  const accion = target.dataset.action;
  const notaCard = target.closest(".note-card");
  const notaId = notaCard?.dataset.id;
  
  if (!notaId) {
    console.error("No se pudo obtener el ID de la nota");
    return;
  }

  // Mostrar loading (opcional)
  const originalText = target.textContent;
  target.textContent = "⏳ Procesando...";
  target.style.pointerEvents = "none";

  try {
    switch (accion) {
      case 'favorito': 
        await toggleFavorita(notaId); 
        break;
      case 'fijar': 
        await toggleFijada(notaId); 
        break;
      case 'editar': 
        editarNota(notaId); 
        return; // No recargar notas para editar
      case 'archivar': 
        await db.collection('notas').doc(notaId).update({ 
          archivada: true,
          fechaArchivado: firebase.firestore.FieldValue.serverTimestamp()
        }); 
        break;
      case 'eliminar': 
        await mandarAPapelera(notaId); 
        break;
      case 'restaurar': 
        await restaurarNota(notaId); 
        break;
      case 'eliminarPermanente': 
        await eliminarPermanenteNota(notaId); 
        break;
      case 'desarchivar': 
        await desarchivarNota(notaId); 
        break;
      case 'papelera': 
        await mandarAPapelera(notaId); 
        break;
      default:
        console.warn("Acción no reconocida:", accion);
        return;
    }

    // Recargar notas después de la acción
    await cargarNotas(usuarioActual, vistaActual);
    
  } catch (error) {
    console.error(`Error ejecutando acción ${accion}:`, error);
    alert(`Error al ${accion} la nota. Inténtalo de nuevo.`);
  } finally {
    // Restaurar estado del botón
    target.textContent = originalText;
    target.style.pointerEvents = "auto";
  }
});

// === FUNCIONES AUXILIARES ===
async function desarchivarNota(id) {
  await db.collection('notas').doc(id).update({ 
    archivada: false,
    fechaDesarchivado: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function mandarAPapelera(id) {
  await db.collection('notas').doc(id).update({ 
    papelera: true,
    fechaPapelera: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function restaurarNota(id) {
  await db.collection('notas').doc(id).update({ 
    papelera: false,
    archivada: false, // También se desarchivar al restaurar
    fechaRestaurado: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function eliminarPermanenteNota(id) {
  const confirmar = confirm("⚠️ ¿Estás seguro de eliminar esta nota permanentemente? Esta acción no se puede deshacer.");
  if (!confirmar) return;

  try {
    // 1. Eliminar de Firestore
    await db.collection('notas').doc(id).delete();
    console.log(`🗑️ Nota eliminada de Firestore: ${id}`);

    // 2. Intentar eliminar el archivo de Storage (si existe)
    try {
      const archivoRef = storage.ref().child(`notas/${id}.txt`);
      await archivoRef.delete();
      console.log(`🗑️ Archivo eliminado de Storage: notas/${id}.txt`);
    } catch (storageError) {
      // No es crítico si el archivo no existe
      console.warn("Archivo de storage no encontrado o ya eliminado:", storageError);
    }

    alert("✅ Nota eliminada permanentemente");
  } catch (error) {
    console.error("❌ Error al eliminar permanentemente:", error);
    if (error.code === 'permission-denied') {
      alert("❌ No tienes permisos para eliminar esta nota");
    } else {
      alert("❌ Error al eliminar nota permanentemente. Inténtalo de nuevo.");
    }
    throw error; // Re-throw para que el catch principal lo maneje
  }
}

async function toggleFavorita(id) {
  const ref = db.collection('notas').doc(id);
  const snap = await ref.get();
  if (snap.exists) {
    const esFavorita = snap.data().favorita || false;
    await ref.update({ 
      favorita: !esFavorita,
      fechaModificacion: firebase.firestore.FieldValue.serverTimestamp()
    });
  } else {
    throw new Error("La nota no existe");
  }
}

async function toggleFijada(id) {
  const ref = db.collection('notas').doc(id);
  const snap = await ref.get();
  if (snap.exists) {
    const estaFijada = snap.data().fijada || false;
    await ref.update({ 
      fijada: !estaFijada,
      fechaModificacion: firebase.firestore.FieldValue.serverTimestamp()
    });
  } else {
    throw new Error("La nota no existe");
  }
}

function editarNota(id) {
  window.location.href = `escribirnota.html?id=${id}`;
}

function obtenerColorAleatorio() {
  const colores = ['blue', 'black', 'purple', 'green', 'orange', 'pink', 'gray'];
  return colores[Math.floor(Math.random() * colores.length)];
}

// === CONFIGURACIÓN DEL SIDEBAR - MEJORADA ===
function configurarEventosSidebar() {
  const btnNotas = document.getElementById("btnNotas");
  const btnArchivadas = document.getElementById("btnArchivadas");
  const btnPapelera = document.getElementById("btnPapelera");

  if (btnNotas) {
    btnNotas.addEventListener("click", async () => {
      vistaActual = 'notas';
      await cargarNotas(usuarioActual, vistaActual);
      actualizarEstadoSidebar('btnNotas');
    });
  }

  if (btnArchivadas) {
    btnArchivadas.addEventListener("click", async () => {
      vistaActual = 'archivadas';
      await cargarNotas(usuarioActual, vistaActual);
      actualizarEstadoSidebar('btnArchivadas');
    });
  }

  if (btnPapelera) {
    btnPapelera.addEventListener("click", async () => {
      vistaActual = 'papelera';
      await cargarNotas(usuarioActual, vistaActual);
      actualizarEstadoSidebar('btnPapelera');
    });
  }

  // ⭐ NUEVO: Inicializar sistema de búsqueda
  inicializarBusqueda();
}

function actualizarEstadoSidebar(botonActivo) {
  // Remover clase activa de todos los botones
  document.querySelectorAll('.sidebar-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Agregar clase activa al botón seleccionado
  const boton = document.getElementById(botonActivo);
  if (boton) {
    boton.classList.add('active');
  }
}

// === MANEJO DE TEMA OSCURO ===
function initThemeToggle() {
  const body = document.body;
  const toggle = document.getElementById('toggle-theme');
  const status = document.getElementById('theme-status');

  const setTheme = isDark => {
    body.classList.toggle('dark-mode', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    if (status) status.textContent = isDark ? 'Oscuro' : 'Claro';
  };

  // Aplicar tema guardado o por defecto
  const temaGuardado = localStorage.getItem('theme');
  const esTemaOscuro = temaGuardado === 'dark' || (!temaGuardado && window.matchMedia('(prefers-color-scheme: dark)').matches);
  setTheme(esTemaOscuro);

  // Toggle manual del tema
  if (toggle) {
    toggle.onclick = () => setTheme(!body.classList.contains('dark-mode'));
  }

  // === MANEJO DE MENÚS DESPLEGABLES ===
  document.addEventListener("click", function (e) {
    const icon = e.target.closest(".dropdown-menu-icon i");
    const dentroDeMenu = e.target.closest(".dropdown-options");
    const menuIcon = e.target.closest(".dropdown-menu-icon");

    // Si hace clic fuera del menú, cerrar todos los menús abiertos
    if (!icon && !dentroDeMenu && !menuIcon) {
      document.querySelectorAll(".dropdown-options.show").forEach(menu => {
        menu.classList.remove("show");
      });
      return;
    }

    // Si hace clic en el ícono de los tres puntos
    if (icon) {
      e.preventDefault();
      e.stopPropagation();
      
      // Cerrar otros menús abiertos
      document.querySelectorAll(".dropdown-options.show").forEach(menu => {
        if (menu !== icon.parentElement.querySelector(".dropdown-options")) {
          menu.classList.remove("show");
        }
      });
      
      // Toggle del menú actual
      const dropdown = icon.parentElement.querySelector(".dropdown-options");
      if (dropdown) {
        dropdown.classList.toggle("show");
      }
    }

    // Si hace clic en una opción del menú, cerrar el menú
    if (e.target.closest("[data-action]")) {
      document.querySelectorAll(".dropdown-options.show").forEach(menu => {
        menu.classList.remove("show");
      });
    }
  }, true);
}

// === INICIALIZACIÓN ===
document.addEventListener('DOMContentLoaded', function() {
  // Verificar que Firebase esté inicializado
  if (typeof firebase === 'undefined') {
    console.error("❌ Firebase no está cargado");
    alert("Error: Firebase no está disponible. Verifica la configuración.");
    return;
  }

  if (typeof db === 'undefined') {
    console.error("❌ Firestore no está inicializado");
    alert("Error: Base de datos no disponible. Verifica la configuración de Firestore.");
    return;
  }

  console.log("✅ Script de notas iniciado correctamente");
});

console.log("✅ Script de notas con expansión integrada correctamente");
// === REEMPLAZAR LA FUNCIÓN initExpandableNotes() EN TU ARCHIVO PRINCIPAL ===

function initExpandableNotes() {
  addExpandListeners();
  createModalIfNotExists();
}

// === REEMPLAZAR LA FUNCIÓN addExpandListeners() EN TU ARCHIVO PRINCIPAL ===

function addExpandListeners() {
  const noteCards = document.querySelectorAll('.note-card');
  
  noteCards.forEach(card => {
    const contentPreview = card.querySelector('.note-content-preview');
    const titleElement = card.querySelector('h3');
    
    if (contentPreview && !contentPreview.hasAttribute('data-listener-added')) {
      
      // Verificar si el contenido es largo
      const isLongContent = isContentLong(contentPreview);
      
      if (isLongContent) {
        // Para contenido largo: usar modal
        contentPreview.classList.add('has-modal');
        addModalIndicator(contentPreview);
        
        contentPreview.addEventListener('click', (e) => {
          if (e.target.closest('.note-actions') || 
              e.target.closest('.dropdown-menu-icon') ||
              e.target.closest('.read-more-indicator')) {
            return;
          }
          
          const noteTitle = titleElement ? titleElement.textContent.trim() : 'Sin título';
          const noteContent = getFullNoteContent(card);
          openNoteModal(noteTitle, noteContent);
        });
        
      } else {
        // Para contenido corto: expansión inline normal
        addExpandIndicator(contentPreview);
        
        contentPreview.addEventListener('click', (e) => {
          if (e.target.closest('.note-actions') || 
              e.target.closest('.dropdown-menu-icon') ||
              e.target.closest('.read-more-indicator')) {
            return;
          }
          
          toggleNoteExpansion(contentPreview);
        });
      }
      
      contentPreview.setAttribute('data-listener-added', 'true');
    }
  });
}

// === NUEVAS FUNCIONES A AGREGAR AL FINAL DE TU ARCHIVO ===

function createModalIfNotExists() {
  if (document.getElementById('note-modal-overlay')) return;
  
  const modalHTML = `
    <div id="note-modal-overlay" class="note-modal-overlay">
      <div class="note-modal">
        <div class="note-modal-header">
          <h2 id="note-modal-title" class="note-modal-title"></h2>
          <button id="note-modal-close" class="note-modal-close">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div id="note-modal-content" class="note-modal-content"></div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  const overlay = document.getElementById('note-modal-overlay');
  const closeBtn = document.getElementById('note-modal-close');
  
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeNoteModal();
  });
  
  closeBtn.addEventListener('click', closeNoteModal);
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('show')) {
      closeNoteModal();
    }
  });
}

function isContentLong(contentElement) {
  const textLength = contentElement.textContent.length;
  const hasLongLines = textLength > 300; // Más de 300 caracteres = modal
  const exceedsHeight = contentElement.scrollHeight > 120;
  
  return hasLongLines || exceedsHeight;
}

function getFullNoteContent(noteCard) {
  const contentElement = noteCard.querySelector('.note-content-preview');
  return contentElement ? contentElement.innerHTML : 'Sin contenido';
}

function addModalIndicator(contentPreview) {
  const readMoreIndicator = document.createElement('div');
  readMoreIndicator.className = 'read-more-indicator';
  readMoreIndicator.innerHTML = '<i class="fas fa-expand-alt"></i> Ver completo';
  readMoreIndicator.style.cssText = `
    margin-top: 10px;
    color: rgba(123, 0, 230, 0.7);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 5px;
    transition: color 0.3s ease;
  `;
  
  readMoreIndicator.addEventListener('click', (e) => {
    e.stopPropagation();
    const noteCard = contentPreview.closest('.note-card');
    const titleElement = noteCard.querySelector('h3');
    const noteTitle = titleElement ? titleElement.textContent.trim() : 'Sin título';
    const noteContent = getFullNoteContent(noteCard);
    openNoteModal(noteTitle, noteContent);
  });
  
  readMoreIndicator.addEventListener('mouseenter', () => {
    readMoreIndicator.style.color = 'rgba(123, 0, 230, 1)';
  });
  
  readMoreIndicator.addEventListener('mouseleave', () => {
    readMoreIndicator.style.color = 'rgba(123, 0, 230, 0.7)';
  });
  
  const existingIndicator = contentPreview.parentNode.querySelector('.read-more-indicator');
  if (!existingIndicator) {
    contentPreview.parentNode.insertBefore(readMoreIndicator, contentPreview.nextSibling);
  }
}

function openNoteModal(title, content) {
  const overlay = document.getElementById('note-modal-overlay');
  const titleElement = document.getElementById('note-modal-title');
  const contentElement = document.getElementById('note-modal-content');
  
  if (!overlay || !titleElement || !contentElement) return;
  
  titleElement.textContent = title;
  contentElement.innerHTML = content;
  
  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';
  
  console.log('📖 Modal de nota abierto:', title);
}

function closeNoteModal() {
  const overlay = document.getElementById('note-modal-overlay');
  if (!overlay) return;
  
  overlay.classList.remove('show');
  document.body.style.overflow = '';
  
  console.log('📝 Modal de nota cerrado');
}

// parte de las notas, pero en js
class NotasPerfilManager {
  constructor(perfilApp) {
    this.perfilApp = perfilApp;
    this.notasCache = [];
    this.filtroActual = 'todas';
    this.templates = {
      conContenido: null,
      notaCard: null,
      vacio: null
    };
    this.initTemplates();
  }

  // Inicializar templates
  initTemplates() {
    this.templates.conContenido = document.getElementById('template-notas-con-contenido');
    this.templates.notaCard = document.getElementById('template-nota-perfil-card');
    this.templates.vacio = document.getElementById('template-notas-vacias');
  }

  // Cargar notas reales desde Firebase
  async cargarNotasUsuario() {
    try {
      if (!this.perfilApp.firebaseUser) {
        console.warn("⚠️ No hay usuario autenticado para cargar notas");
        return [];
      }

      console.log("🔄 Cargando notas del usuario desde Firebase...");
      
      // Mostrar loading
      this.mostrarLoading(true);

      const q = firebase.firestore()
        .collection('notas')
        .where('autores', 'array-contains', this.perfilApp.firebaseUser.uid)
        .where('papelera', '==', false);

      const snapshot = await q.get();
      const notas = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Ordenar notas: fijadas primero, luego por fecha
      notas.sort((a, b) => {
        if (a.fijada && !b.fijada) return -1;
        if (!a.fijada && b.fijada) return 1;
        
        const fechaA = a.timestamp?.toDate() || a.fechaCreacion?.toDate() || new Date(0);
        const fechaB = b.timestamp?.toDate() || b.fechaCreacion?.toDate() || new Date(0);
        return fechaB - fechaA;
      });

      console.log(`📝 ${notas.length} notas cargadas para el perfil`);
      this.notasCache = notas;

      // Actualizar estadísticas
      await this.actualizarEstadisticasNotas(notas);
      
      // Ocultar loading
      this.mostrarLoading(false);
      
      return notas;
    } catch (error) {
      console.error("❌ Error cargando notas del perfil:", error);
      this.mostrarLoading(false);
      return [];
    }
  }

  // Mostrar/ocultar loading
  mostrarLoading(mostrar) {
    const loadingElement = document.getElementById('notas-loading');
    if (loadingElement) {
      loadingElement.style.display = mostrar ? 'block' : 'none';
    }
  }

  // Actualizar estadísticas de notas
  async actualizarEstadisticasNotas(notas) {
    const stats = {
      total: notas.length,
      publicas: notas.filter(n => !n.privada).length,
      privadas: notas.filter(n => n.privada).length,
      favoritas: notas.filter(n => n.favorita).length,
      fijadas: notas.filter(n => n.fijada).length,
      archivadas: notas.filter(n => n.archivada).length
    };

    // Actualizar contador en la interfaz principal
    if (this.perfilApp.elementos.stats.notas) {
      this.perfilApp.elementos.stats.notas.textContent = stats.total;
    }

    // Actualizar estadísticas detalladas en el header de notas
    this.actualizarStatsHeader(stats);

    // Actualizar datos del usuario
    if (this.perfilApp.currentUser) {
      this.perfilApp.currentUser.estadisticas.notas = stats.total;
      this.perfilApp.currentUser.estadisticasNotas = stats;
    }

    console.log("📊 Estadísticas de notas actualizadas:", stats);
  }

  // Actualizar estadísticas en el header
  actualizarStatsHeader(stats) {
    const elements = {
      total: document.getElementById('stat-total-notas'),
      privadas: document.getElementById('stat-notas-privadas'),
      favoritas: document.getElementById('stat-notas-favoritas')
    };

    if (elements.total) {
      elements.total.textContent = `📝 ${stats.total} notas`;
    }
    if (elements.privadas) {
      elements.privadas.textContent = `🔒 ${stats.privadas} privadas`;
    }
    if (elements.favoritas) {
      elements.favoritas.textContent = `⭐ ${stats.favoritas} favoritas`;
    }
  }

  // Renderizar notas en el tab
  renderizarNotasEnPerfil(notas = null) {
    const notasParaMostrar = notas || this.aplicarFiltro(this.notasCache);
    const tabNotas = document.getElementById('tab-notas');
    
    if (!tabNotas) return;

    // Limpiar contenido
    tabNotas.innerHTML = '';

    if (notasParaMostrar.length === 0) {
      this.mostrarContenidoVacio(tabNotas);
      return;
    }

    this.mostrarContenidoConNotas(tabNotas, notasParaMostrar);
  }

  // Mostrar contenido vacío
  mostrarContenidoVacio(container) {
    if (!this.templates.vacio) return;
    
    const clone = this.templates.vacio.content.cloneNode(true);
    container.appendChild(clone);
  }

  // Mostrar contenido con notas
  mostrarContenidoConNotas(container, notas) {
    if (!this.templates.conContenido) return;

    // Clonar template principal
    const clone = this.templates.conContenido.content.cloneNode(true);
    container.appendChild(clone);

    // Actualizar estadísticas
    this.actualizarStatsHeader({
      total: this.notasCache.length,
      privadas: this.notasCache.filter(n => n.privada).length,
      favoritas: this.notasCache.filter(n => n.favorita).length
    });

    // Renderizar notas individuales
    this.renderizarNotasIndividuales(notas);

    // Configurar eventos
    this.configurarEventos();
  }

  // Renderizar notas individuales
  renderizarNotasIndividuales(notas) {
    const grid = document.getElementById('notas-perfil-grid');
    if (!grid || !this.templates.notaCard) return;

    grid.innerHTML = '';

    notas.forEach(nota => {
      const clone = this.templates.notaCard.content.cloneNode(true);
      
      // Configurar datos de la nota
      this.configurarTarjetaNota(clone, nota);
      
      grid.appendChild(clone);
    });
  }

  // Configurar una tarjeta de nota individual
  configurarTarjetaNota(clone, nota) {
    const card = clone.querySelector('.nota-perfil-card');
    const titulo = clone.querySelector('.nota-perfil-titulo');
    const indicadores = clone.querySelector('.nota-perfil-indicadores');
    const contenido = clone.querySelector('.nota-perfil-contenido');
    const fecha = clone.querySelector('.nota-perfil-fecha');
    const btnVer = clone.querySelector('.btn-ver-nota-completa');

    if (card) {
      card.setAttribute('data-nota-id', nota.id);
      card.className = `nota-perfil-card ${nota.color || 'purple'}`;
    }

    if (titulo) {
      titulo.textContent = nota.title || 'Sin título';
    }

    if (indicadores) {
      indicadores.innerHTML = this.crearIndicadoresNota(nota);
    }

    if (contenido) {
      contenido.textContent = this.truncarContenido(nota.content || '', 100);
    }

    if (fecha) {
      fecha.textContent = this.formatearFecha(nota.timestamp || nota.fechaCreacion);
    }

    if (btnVer) {
      btnVer.setAttribute('data-nota-id', nota.id);
    }
  }

  // Crear indicadores visuales de la nota
  crearIndicadoresNota(nota) {
    const indicadores = [];
    
    if (nota.fijada) indicadores.push('<span class="indicador fijada" title="Fijada">📌</span>');
    if (nota.favorita) indicadores.push('<span class="indicador favorita" title="Favorita">⭐</span>');
    if (nota.privada) indicadores.push('<span class="indicador privada" title="Privada">🔒</span>');
    if (nota.archivada) indicadores.push('<span class="indicador archivada" title="Archivada">📁</span>');
    
    return indicadores.join('');
  }

  // Configurar eventos
  configurarEventos() {
    this.configurarFiltroNotas();
    this.configurarClicksNotas();
  }

  // Configurar filtro de notas
  configurarFiltroNotas() {
    const filtroSelect = document.getElementById('filtro-notas-perfil');
    if (!filtroSelect) return;

    filtroSelect.value = this.filtroActual;
    
    // Remover listeners anteriores
    filtroSelect.removeEventListener('change', this.handleFiltroChange);
    
    // Agregar nuevo listener
    this.handleFiltroChange = (e) => {
      this.filtroActual = e.target.value;
      this.renderizarNotasEnPerfil();
    };
    
    filtroSelect.addEventListener('change', this.handleFiltroChange);
  }

  // Aplicar filtro a las notas
  aplicarFiltro(notas) {
    switch (this.filtroActual) {
      case 'publicas':
        return notas.filter(nota => !nota.privada);
      case 'privadas':
        return notas.filter(nota => nota.privada);
      case 'favoritas':
        return notas.filter(nota => nota.favorita);
      case 'fijadas':
        return notas.filter(nota => nota.fijada);
      default:
        return notas;
    }
  }

  // Configurar clicks en las notas
  configurarClicksNotas() {
    // Remover listeners anteriores
    document.removeEventListener('click', this.handleNotaClick);
    
    // Agregar listener delegado
    this.handleNotaClick = (e) => {
      // Click en botón ver completa
      if (e.target.closest('.btn-ver-nota-completa')) {
        e.stopPropagation();
        const notaId = e.target.closest('.btn-ver-nota-completa').getAttribute('data-nota-id');
        this.abrirNotaCompleta(notaId);
        return;
      }

      // Click en tarjeta completa
      const card = e.target.closest('.nota-perfil-card');
      if (card) {
        const notaId = card.getAttribute('data-nota-id');
        this.abrirNotaCompleta(notaId);
      }
    };
    
    document.addEventListener('click', this.handleNotaClick);
  }

  // Abrir nota completa en modal
  abrirNotaCompleta(notaId) {
    const nota = this.notasCache.find(n => n.id === notaId);
    if (!nota) return;

    // Reutilizar el modal que ya creamos para las notas
    if (typeof openNoteModal === 'function') {
      openNoteModal(nota.title || 'Sin título', nota.content || 'Sin contenido');
    } else {
      // Fallback: abrir en nueva ventana
      window.open(`/contenido_de_la_pagina/notas.html?highlight=${notaId}`, '_blank');
    }
  }

  // Utilidades
  formatearFecha(timestamp) {
    if (!timestamp) return 'Fecha no disponible';
    
    try {
      const fecha = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return fecha.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch (error) {
      return 'Fecha no disponible';
    }
  }

  truncarContenido(contenido, limite = 100) {
    if (!contenido) return 'Sin contenido';
    
    // Remover HTML tags si existen
    const textoPlano = contenido.replace(/<[^>]*>/g, '');
    
    if (textoPlano.length <= limite) return textoPlano;
    
    return textoPlano.substring(0, limite) + '...';
  }

  // Recargar notas (útil cuando se actualiza desde otra página)
  async recargarNotas() {
    await this.cargarNotasUsuario();
    this.renderizarNotasEnPerfil();
    console.log("🔄 Notas del perfil recargadas");
  }

  // Cleanup - remover event listeners
  cleanup() {
    if (this.handleFiltroChange) {
      const filtroSelect = document.getElementById('filtro-notas-perfil');
      if (filtroSelect) {
        filtroSelect.removeEventListener('change', this.handleFiltroChange);
      }
    }
    
    if (this.handleNotaClick) {
      document.removeEventListener('click', this.handleNotaClick);
    }
  }
}

// ====== MODIFICACIONES A CLASES EXISTENTES ======

// Modificar TabManager para manejar notas
TabManager.prototype.cambiarTab = function(tabName) {
  document.querySelectorAll(".tab-btn").forEach((btn) => btn.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach((content) => content.classList.remove("active"));

  const btnActivo = document.querySelector(`[data-tab="${tabName}"]`);
  const contentActivo = document.getElementById(`tab-${tabName}`);

  if (btnActivo && contentActivo) {
    btnActivo.classList.add("active");
    contentActivo.classList.add("active");
    this.activeTab = tabName;

    // Si se cambia al tab de notas, renderizar las notas
    if (tabName === 'notas' && window.perfilApp?.notasManager) {
      window.perfilApp.notasManager.renderizarNotasEnPerfil();
    }
  }
};

// Método para agregar a PerfilUsuario
PerfilUsuario.prototype.cargarYMostrarNotas = async function() {
  try {
    await this.notasManager.cargarNotasUsuario();
    
    // Si el tab de notas está activo, renderizar inmediatamente
    const tabNotas = document.getElementById('tab-notas');
    if (tabNotas && tabNotas.classList.contains('active')) {
      this.notasManager.renderizarNotasEnPerfil();
    }
  } catch (error) {
    console.error("❌ Error cargando notas para el perfil:", error);
  }
};

// Cleanup al salir
window.addEventListener('beforeunload', () => {
  if (window.perfilApp?.notasManager) {
    window.perfilApp.notasManager.cleanup();
  }
});

// ====== INICIALIZACIÓN ======
document.addEventListener('DOMContentLoaded', () => {
  const initNotasManager = () => {
    if (window.perfilApp && window.perfilApp.firebaseUser) {
      window.notasPerfilManager = new NotasPerfilManager(window.perfilApp);
      console.log("✅ Manager de notas para perfil inicializado");
    } else {
      setTimeout(initNotasManager, 500);
    }
  };
  
  setTimeout(initNotasManager, 1000);
});