// carga la nota antes de todo esto
// Las referencias de Firebase se usan globalmente (ya están declaradas en otro archivo)
// Usamos: firebase.auth(), firebase.firestore(), firebase.storage()

let usuarioActual = null;
let notasPublicadas = []; // Array para almacenar las notas
let todasLasNotas = []; // Array para el buscador

console.log("Usuario actual al publicar:", usuarioActual);

// === DETECTAR USUARIO ===
firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    usuarioActual = user.uid;
    console.log("Usuario autenticado:", user.email);
    // Esperar un poco antes de cargar las notas para asegurar que Firebase esté listo
    setTimeout(() => {
      cargarNotasPublicadas();
    }, 1000);
  } else {
    window.location.href = "/contenido_de_la_pagina/Inicio_de_sesion/Inicio_de_sesion.html";
  }
});

// === INICIALIZACIÓN ===
document.addEventListener("DOMContentLoaded", () => {
  initThemeToggle(); // Inicializar tema PRIMERO
  initEditor();
  bindBotonPublicar();
  initColorSelector();
  initBuscador(); // Inicializar buscador
});

// === INICIALIZAR BUSCADOR ===
function initBuscador() {
  const searchInput = document.getElementById('search-notes');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const termino = e.target.value.trim().toLowerCase();
      filtrarNotas(termino);
    });
  }
}

// === FILTRAR NOTAS ===
function filtrarNotas(termino) {
  if (!termino) {
    mostrarNotas(todasLasNotas);
    return;
  }

  const notasFiltradas = todasLasNotas.filter(nota => {
    const titulo = nota.title?.toLowerCase() || '';
    const contenido = nota.content?.toLowerCase().replace(/<[^>]*>/g, '') || '';
    return titulo.includes(termino) || contenido.includes(termino);
  });

  mostrarNotas(notasFiltradas);
  
  // Mostrar mensaje si no hay resultados
  if (notasFiltradas.length === 0) {
    const container = document.getElementById('notes-container');
    container.innerHTML = `
      <div style="text-align: center; color: #666; padding: 20px;">
        <i class="fas fa-search" style="font-size: 32px; margin-bottom: 10px;"></i>
        <p>No se encontraron notas que coincidan con "${termino}"</p>
      </div>
    `;
  }
}

// === CARGAR NOTAS PUBLICADAS (VERSIÓN MEJORADA) ===
async function cargarNotasPublicadas() {
  if (!usuarioActual) {
    console.warn("⚠️ No hay usuario autenticado para cargar notas");
    return;
  }

  try {
    console.log("🔄 Cargando notas publicadas para usuario:", usuarioActual);
    
    // Consulta más simple y robusta
    const snapshot = await firebase.firestore()
      .collection("notas")
      .where("autores", "array-contains", usuarioActual)
      .get();

    console.log("📊 Documentos encontrados:", snapshot.size);

    if (snapshot.empty) {
      console.log("📝 No hay notas para este usuario");
      todasLasNotas = [];
      notasPublicadas = [];
      mostrarNotas([]);
      return;
    }

    // Filtrar notas que no estén en papelera
    todasLasNotas = snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .filter(nota => !nota.papelera) // Filtrar en el cliente
      .sort((a, b) => {
        // Ordenar por fecha (más recientes primero)
        const fechaA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
        const fechaB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
        return fechaB - fechaA;
      });

    notasPublicadas = todasLasNotas;
    console.log(`✅ ${notasPublicadas.length} notas cargadas correctamente`);
    
    mostrarNotas(notasPublicadas);
    
  } catch (error) {
    console.error("❌ Error cargando notas:", error);
    console.error("Detalles del error:", {
      code: error.code,
      message: error.message,
      details: error.details
    });
    
    // Mostrar error más específico
    const container = document.getElementById('notes-container');
    let mensajeError = "Error desconocido";
    
    if (error.code === 'permission-denied') {
      mensajeError = "Sin permisos para acceder a las notas";
    } else if (error.code === 'failed-precondition') {
      mensajeError = "Falta crear un índice en Firestore";
    } else if (error.message) {
      mensajeError = error.message;
    }
    
    container.innerHTML = `
      <div style="text-align: center; color: #f44336; padding: 20px; background: rgba(244, 67, 54, 0.1); border-radius: 8px;">
        <i class="fas fa-exclamation-triangle" style="font-size: 32px; margin-bottom: 10px;"></i>
        <h4 style="margin-bottom: 10px;">Error al cargar notas</h4>
        <p style="margin-bottom: 15px; color: #666;">${mensajeError}</p>
        <button onclick="cargarNotasPublicadas()" style="padding: 10px 20px; background: #ab4bff; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
          <i class="fas fa-redo" style="margin-right: 5px;"></i> Reintentar
        </button>
        <br><br>
        <button onclick="cargarNotasSinFiltros()" style="padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: pointer; margin-top: 10px;">
          Cargar sin filtros
        </button>
      </div>
    `;
  }
}

// === CARGAR NOTAS SIN FILTROS (FALLBACK) ===
async function cargarNotasSinFiltros() {
  if (!usuarioActual) return;

  try {
    console.log("🔄 Intentando cargar notas sin filtros...");
    
    // Consulta más básica sin orderBy
    const snapshot = await firebase.firestore()
      .collection("notas")
      .where("autores", "array-contains", usuarioActual)
      .get();

    todasLasNotas = snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .filter(nota => !nota.papelera);

    notasPublicadas = todasLasNotas;
    console.log(`✅ ${notasPublicadas.length} notas cargadas sin filtros`);
    
    mostrarNotas(notasPublicadas);
    
  } catch (error) {
    console.error("❌ Error even sin filtros:", error);
    const container = document.getElementById('notes-container');
    container.innerHTML = `
      <div style="text-align: center; color: #f44336; padding: 20px;">
        <i class="fas fa-exclamation-triangle" style="font-size: 32px; margin-bottom: 10px;"></i>
        <h4>Error persistente</h4>
        <p style="color: #666; margin: 10px 0;">No se pueden cargar las notas en este momento</p>
        <p style="color: #888; font-size: 12px;">Revisa la configuración de Firebase</p>
      </div>
    `;
  }
}

// === MOSTRAR NOTAS ===
function mostrarNotas(notas) {
  const container = document.getElementById('notes-container');
  
  if (!container) {
    console.warn("Container de notas no encontrado");
    return;
  }

  if (notas.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: #666; padding: 40px;">
        <i class="fas fa-file-alt" style="font-size: 48px; margin-bottom: 15px; color: #ab4bff;"></i>
        <h3 style="margin-bottom: 10px; color: #ab4bff;">Sin notas aún</h3>
        <p>Tus notas aparecerán aquí después de publicarlas</p>
      </div>
    `;
    return;
  }

  container.innerHTML = notas.map(nota => crearTarjetaNota(nota)).join('');
}

// === CREAR TARJETA DE NOTA ===
function crearTarjetaNota(nota) {
  const fecha = formatearFecha(nota.timestamp);
  const contenidoPreview = truncarContenido(nota.content || '', 120);
  const colorClass = nota.color || 'purple';
  const indicadores = crearIndicadores(nota);

  return `
    <div class="note-card ${colorClass}" data-nota-id="${nota.id}">
      <div class="note-header">
        <h3>${nota.title || 'Sin título'}</h3>
        <div class="note-indicators">${indicadores}</div>
      </div>
      
      <div class="note-content-preview">
        ${contenidoPreview}
      </div>
      
      <div class="note-footer" style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
        <small style="color: #666;">📅 ${fecha}</small>
        <div class="note-actions" style="display: flex; gap: 8px;">
          <button class="btn-edit" onclick="editarNota('${nota.id}')" title="Editar" style="background: none; border: none; color: #4caf50; cursor: pointer; padding: 5px;">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn-delete" onclick="eliminarNota('${nota.id}')" title="Eliminar" style="background: none; border: none; color: #f44336; cursor: pointer; padding: 5px;">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    </div>
  `;
}

// === CREAR INDICADORES ===
function crearIndicadores(nota) {
  const indicadores = [];
  
  if (nota.fijada) {
    indicadores.push('<span class="indicator pinned" title="Fijada" style="margin-right: 5px;">📌</span>');
  }
  
  if (nota.favorita) {
    indicadores.push('<span class="indicator favorite" title="Favorita" style="margin-right: 5px;">⭐</span>');
  }
  
  if (nota.privada) {
    indicadores.push('<span class="indicator private" title="Privada" style="margin-right: 5px;">🔒</span>');
  }
  
  return indicadores.join('');
}

// === TRUNCAR CONTENIDO ===
function truncarContenido(contenido, limite = 120) {
  if (!contenido) return 'Sin contenido';
  
  // Remover etiquetas HTML
  const textoPlano = contenido.replace(/<[^>]*>/g, '');
  
  if (textoPlano.length <= limite) return textoPlano;
  return textoPlano.substring(0, limite) + '...';
}

// === FORMATEAR FECHA ===
function formatearFecha(timestamp) {
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

// === EDITAR NOTA ===
function editarNota(id) {
  window.location.href = `escribirnota.html?id=${id}`;
}

// === ELIMINAR NOTA ===
async function eliminarNota(id) {
  if (!confirm('¿Estás seguro de que quieres eliminar esta nota?')) {
    return;
  }

  try {
    console.log("🗑️ Eliminando nota:", id);
    
    // Mover a papelera en lugar de eliminar completamente
    await firebase.firestore().collection("notas").doc(id).update({
      papelera: true,
      fechaEliminacion: firebase.firestore.FieldValue.serverTimestamp()
    });

    mostrarNotificacion("✔️ Nota movida a la papelera");
    
    // Recargar notas
    await cargarNotasPublicadas();
    
  } catch (error) {
    console.error("❌ Error eliminando nota:", error);
    mostrarNotificacion("❌ Error al eliminar la nota", "error");
  }
}

// === SELECTOR DE COLOR ===
let colorSeleccionado = 'purple'; // Color por defecto

function initColorSelector() {
  const colorOptions = document.querySelectorAll('.color-option');
  
  colorOptions.forEach(option => {
    option.addEventListener('click', () => {
      // Remover selección anterior
      colorOptions.forEach(opt => opt.classList.remove('selected'));
      
      // Agregar selección al nuevo color
      option.classList.add('selected');
      
      // Guardar color seleccionado
      colorSeleccionado = option.getAttribute('data-color');
      
      console.log('Color seleccionado:', colorSeleccionado);
      
      // Opcional: Mostrar preview del color en el título
      updateColorPreview();
    });
  });
}

function updateColorPreview() {
  const titleInput = document.getElementById('note-title');
  if (titleInput) {
    titleInput.style.borderLeft = `4px solid var(--color-${colorSeleccionado}, #b900d9)`;
  }
}

function bindBotonPublicar() {
  const btn = document.getElementById("publish-btn");
  if (!btn) return;

  const id = new URLSearchParams(window.location.search).get("id");
  if (id) {
    cargarNotaParaEdicion(id);
    btn.textContent = "Actualizar";
    btn.onclick = () => actualizarNota(id);
  } else {
    btn.onclick = () => publicarNota();
  }
}

async function publicarNota() {
  const title = document.getElementById("note-title").value.trim();
  const content = document.getElementById("note-content").innerHTML.trim();
  const privada = document.getElementById("note-private").checked;
  
  // ✨ OBTENER NUEVOS CAMPOS
  const favorita = document.getElementById("note-favorite")?.checked || false;
  const fijada = document.getElementById("note-pinned")?.checked || false;

  if (!title || !content || !usuarioActual) {
    mostrarNotificacion("❌ Completa el título y contenido", "error");
    return;
  }

  try {
    mostrarNotificacion("💾 Publicando nota...", "info");
    
    const nuevaNota = {
      title,
      content,
      privada,
      autores: [usuarioActual],
      color: colorSeleccionado,
      fijada: fijada,
      favorita: favorita,
      archivada: false,
      papelera: false,
      fechaCreacion: firebase.firestore.FieldValue.serverTimestamp(),
      timestamp: new Date()
    };

    console.log("Intentando crear nota con usuario:", usuarioActual);
    
    const docRef = await firebase.firestore().collection("notas").add(nuevaNota);
    console.log("🟩 Nota creada en Firestore:", docRef.id);
    
    await guardarNotaEnStorage(docRef.id, content, title);

    mostrarNotificacion("✔️ Nota publicada correctamente");
    
    // Limpiar formulario
    limpiarFormulario();
    
    // Recargar notas publicadas
    await cargarNotasPublicadas();
    
  } catch (error) {
    console.error("❌ Error al publicar nota:", error);
    if (error.code === 'permission-denied') {
      mostrarNotificacion("❌ Error de permisos: Verifica las reglas de Firestore", "error");
    } else {
      mostrarNotificacion("❌ Error al publicar la nota: " + error.message, "error");
    }
  }
}

// === LIMPIAR FORMULARIO ===
function limpiarFormulario() {
  document.getElementById("note-title").value = "";
  document.getElementById("note-content").innerHTML = "";
  document.getElementById("note-private").checked = false;
  
  const favoriteCheckbox = document.getElementById("note-favorite");
  const pinnedCheckbox = document.getElementById("note-pinned");
  
  if (favoriteCheckbox) favoriteCheckbox.checked = false;
  if (pinnedCheckbox) pinnedCheckbox.checked = false;
  
  // Resetear color a púrpura
  document.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
  document.querySelector('[data-color="purple"]')?.classList.add('selected');
  colorSeleccionado = 'purple';
  
  // Limpiar preview de color
  const titleInput = document.getElementById('note-title');
  if (titleInput) {
    titleInput.style.borderLeft = '';
  }
}

async function cargarNotaParaEdicion(id) {
  try {
    const snap = await firebase.firestore().collection("notas").doc(id).get();
    if (!snap.exists) {
      mostrarNotificacion("❌ Nota no encontrada", "error");
      return;
    }

    const nota = snap.data();
    document.getElementById("note-title").value = nota.title;
    document.getElementById("note-content").innerHTML = nota.content;
    document.getElementById("note-private").checked = nota.privada;
    
    // ✨ CARGAR CAMPOS ADICIONALES
    const favoriteCheckbox = document.getElementById("note-favorite");
    const pinnedCheckbox = document.getElementById("note-pinned");
    
    if (favoriteCheckbox) {
      favoriteCheckbox.checked = nota.favorita || false;
    }
    
    if (pinnedCheckbox) {
      pinnedCheckbox.checked = nota.fijada || false;
    }
    
    // Cargar el color seleccionado si existe
    if (nota.color) {
      colorSeleccionado = nota.color;
      const colorOption = document.querySelector(`[data-color="${nota.color}"]`);
      if (colorOption) {
        document.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
        colorOption.classList.add('selected');
        updateColorPreview();
      }
    }
  } catch (error) {
    console.error("❌ Error cargando nota:", error);
    mostrarNotificacion("❌ Error al cargar la nota", "error");
  }
}

async function actualizarNota(id) {
  const title = document.getElementById("note-title").value.trim();
  const content = document.getElementById("note-content").innerHTML.trim();
  const privada = document.getElementById("note-private").checked;
  
  // ✨ OBTENER NUEVOS CAMPOS PARA ACTUALIZACIÓN
  const favorita = document.getElementById("note-favorite")?.checked || false;
  const fijada = document.getElementById("note-pinned")?.checked || false;

  if (!title || !content) {
    mostrarNotificacion("❌ Completa el título y el contenido", "error");
    return;
  }

  try {
    mostrarNotificación("💾 Actualizando nota...", "info");
    
    await firebase.firestore().collection("notas").doc(id).update({ 
      title, 
      content, 
      privada, 
      color: colorSeleccionado,
      favorita: favorita,
      fijada: fijada,
      fechaModificacion: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    await guardarNotaEnStorage(id, content, title);
    
    mostrarNotificacion("✔️ Nota actualizada correctamente");
    
    setTimeout(() => {
      window.location.href = "notas.html";
    }, 1500);
    
  } catch (error) {
    console.error("❌ Error al actualizar nota:", error);
    mostrarNotificacion("❌ Error al actualizar la nota: " + error.message, "error");
  }
}

async function guardarNotaEnStorage(nombreArchivo, contenido, titulo) {
  const user = firebase.auth().currentUser;

  if (!user) {
    console.warn("⚠️ No hay usuario autenticado en Storage.");
    return;
  }

  console.log("➡️ Intentando guardar en Storage:", nombreArchivo);
  
  if (!contenido) {
    console.warn("❗ Contenido vacío, no se guarda en Storage.");
    return;
  }

  try {
    const archivoBlob = new Blob([contenido], { type: "text/plain" });
    const archivoRef = firebase.storage().ref().child(`notas/${nombreArchivo}.txt`);
    const metadata = { contentType: 'text/plain' };

    const result = await archivoRef.put(archivoBlob, metadata);
    const url = await archivoRef.getDownloadURL();
    console.log("✅ Subido correctamente a Storage:", result.metadata.fullPath);
  } catch (error) {
    console.error("❌ Error al subir a Storage:", error.code, error.message);
    console.warn("⚠️ Nota guardada en Firestore pero no en Storage");
  }
}

function mostrarNotificacion(msg, tipo = "success") {
  const noti = document.getElementById("notification");
  if (noti) {
    noti.textContent = msg;
    noti.className = `notification ${tipo}`;
    noti.classList.add("show");
    setTimeout(() => noti.classList.remove("show"), 3000);
  }
}

function initEditor() {
  document.querySelectorAll(".format-btn").forEach((btn) => {
    btn.onclick = () => {
      if (btn.title.includes("Alinear") || btn.title.includes("Centrar")) {
        document.querySelectorAll(
          '.format-btn[title*="Alinear"], .format-btn[title="Centrar"]'
        ).forEach((b) => b.classList.remove("active"));
      }
      btn.classList.toggle("active");
      formatText(btn.getAttribute("onclick").match(/'(.+?)'/)[1]);
    };
  });
}

function formatText(command) {
  document.execCommand(command, false, null);
  document.getElementById("note-content").focus();
}

// === FUNCIÓN DE TEMA CORREGIDA ===
function initThemeToggle() {
  const body = document.body;
  const toggle = document.getElementById("toggle-theme");
  const status = document.getElementById("theme-status");

  // Función para aplicar el tema
  const setTheme = (isDark) => {
    if (isDark) {
      body.classList.add("dark-mode");
    } else {
      body.classList.remove("dark-mode");
    }
    localStorage.setItem("theme", isDark ? "dark" : "light");
    if (status) {
      status.textContent = isDark ? "Oscuro" : "Claro";
    }
    console.log("Tema aplicado:", isDark ? "oscuro" : "claro");
  };

  // Cargar tema guardado
  const savedTheme = localStorage.getItem("theme");
  const isDarkMode = savedTheme === "dark";
  
  // Aplicar tema inmediatamente
  setTheme(isDarkMode);

  // Configurar el toggle
  if (toggle) {
    toggle.onclick = () => {
      const currentIsDark = body.classList.contains("dark-mode");
      setTheme(!currentIsDark);
    };
  }
}