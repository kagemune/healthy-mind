// carga la nota antes de todo esto
// Las referencias de Firebase se usan globalmente (ya están declaradas en otro archivo)
// Usamos: firebase.auth(), firebase.firestore(), firebase.storage()

let usuarioActual = null;
console.log("Usuario actual al publicar:", usuarioActual);

// === DETECTAR USUARIO ===
firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    usuarioActual = user.uid;
    console.log("Usuario autenticado:", user.email);
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
});

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

  if (!title || !content || !usuarioActual) {
    alert("Completa el título, contenido y asegúrate de estar autenticado.");
    return;
  }

  try {
    const nuevaNota = {
      title,
      content,
      privada,
      autores: [usuarioActual],
      color: colorSeleccionado,
      fijada: false,
      favorita: false,
      archivada: false,
      papelera: false,
      timestamp: new Date()
    };

    console.log("Intentando crear nota con usuario:", usuarioActual);
    const docRef = await firebase.firestore().collection("notas").add(nuevaNota);
    console.log("🟩 Nota creada en Firestore:", docRef.id);
    
    await guardarNotaEnStorage(docRef.id, content, title);

    mostrarNotificacion("✔️ Nota publicada correctamente");
    setTimeout(() => {
      window.location.href = "notas.html";
    }, 1500);
    
  } catch (error) {
    console.error("❌ Error al publicar nota:", error);
    if (error.code === 'permission-denied') {
      alert("Error de permisos: Verifica las reglas de Firestore");
    } else {
      alert("Error al publicar la nota: " + error.message);
    }
  }
}

async function cargarNotaParaEdicion(id) {
  const snap = await firebase.firestore().collection("notas").doc(id).get();
  if (!snap.exists) return alert("Nota no encontrada");

  const nota = snap.data();
  document.getElementById("note-title").value = nota.title;
  document.getElementById("note-content").innerHTML = nota.content;
  document.getElementById("note-private").checked = nota.privada;
  
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
}

async function actualizarNota(id) {
  const title = document.getElementById("note-title").value.trim();
  const content = document.getElementById("note-content").innerHTML.trim();
  const privada = document.getElementById("note-private").checked;

  if (!title || !content) return alert("Completa el título y el contenido.");

  await firebase.firestore().collection("notas").doc(id).update({ 
    title, 
    content, 
    privada, 
    color: colorSeleccionado 
  });
  await guardarNotaEnStorage(id, content, title);
  alert("Nota actualizada");
  window.location.href = "notas.html";
}

async function guardarNotaEnStorage(nombreArchivo, contenido, titulo) {
  const user = firebase.auth().currentUser;

  if (!user) {
    console.warn("⚠️ No hay usuario autenticado en Storage.");
    return;
  }

  console.log("➡️ Intentando guardar en Storage:", nombreArchivo);
  console.log("📝 Contenido a guardar:", contenido);
  
  if (!contenido) {
    console.warn("❗ Contenido vacío, no se guarda en Storage.");
    return;
  }

  const archivoBlob = new Blob([contenido], { type: "text/plain" });
  console.log("📦 Blob size:", archivoBlob.size);

  const archivoRef = firebase.storage().ref().child(`notas/${nombreArchivo}.txt`);
  const metadata = { contentType: 'text/plain' };

  try {
    const result = await archivoRef.put(archivoBlob, metadata);
    const url = await archivoRef.getDownloadURL();
    console.log("✅ Subido correctamente a Storage:", result.metadata.fullPath);
    console.log("🌐 URL de descarga:", url);
  } catch (error) {
    console.error("❌ Error al subir a Storage:", error.code, error.message);
    alert("Error al guardar archivo en Storage: " + error.message);
  }
}

function mostrarNotificacion(msg) {
  const noti = document.getElementById("notification");
  if (noti) {
    noti.textContent = msg;
    noti.classList.add("show");
    setTimeout(() => noti.classList.remove("show"), 1500);
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

function obtenerColorAleatorio() {
  const colores = ["blue", "black", "purple", "green", "orange", "pink", "gray"];
  return colores[Math.floor(Math.random() * colores.length)];
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