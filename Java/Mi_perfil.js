// ====== CONFIGURACIÓN Y CONSTANTES ======
const CONFIG = {
  STORAGE_KEYS: {
    USER_DATA: "userData",
    AVATAR: "avatarSeleccionado",
  },
  DEFAULT_AVATAR: "/Imagenes/Avatares/Avatar1.jpg",
  TABS: ["publicaciones", "notas", "megusta", "respuestas"],
};

// ====== AVATARES PREDEFINIDOS (SINCRONIZADO CON INDEX) ======
const AVATARES_PREDEFINIDOS = {
    default: '/Imagenes/Avatares/Avatar1.jpg',
};

// ====== CLASE PRINCIPAL DEL PERFIL ======
class PerfilUsuario {
  constructor() {
    this.currentUser = null;
    this.firebaseUser = null;
    this.elementos = {};
    this.tabs = new TabManager();
    this.modal = new ModalManager();
    this.init();
  }

  // ====== INICIALIZACIÓN ======
  async init() {
    try {
      this.obtenerElementosDOM();
      this.configurarEventListeners();
      
      // Esperar a que Firebase esté listo
      await this.esperarFirebase();
      
      // Cargar datos del usuario
      await this.cargarDatosUsuario();
      this.actualizarInterfaz();
      
      console.log("✅ Perfil inicializado correctamente");
    } catch (error) {
      console.error("❌ Error al inicializar perfil:", error);
      this.mostrarError("Error al cargar el perfil");
    }
  }

  // ====== ESPERAR FIREBASE ======
  async esperarFirebase() {
    return new Promise((resolve) => {
      // Si Firebase ya está autenticado
      if (firebase.auth().currentUser) {
        this.firebaseUser = firebase.auth().currentUser;
        resolve();
        return;
      }

      // Esperar cambio de estado de autenticación
      const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
        if (user) {
          this.firebaseUser = user;
          unsubscribe();
          resolve();
        }
      });
    });
  }

  obtenerElementosDOM() {
    // Elementos principales
    this.elementos = {
      // Navegación
      btnVolver: document.getElementById("btnVolver"),
      btnEditarPerfil: document.getElementById("btnEditarPerfil"),

      // Información del usuario
      perfilAvatar: document.getElementById("perfilAvatar"),
      perfilNombre: document.getElementById("perfilNombre"),
      perfilBio: document.getElementById("perfilBio"),
      perfilFechaRegistro: document.getElementById("perfilFechaRegistro"),
      perfilStatus: document.getElementById("perfilStatus"),

      // Estadísticas
      stats: {
        publicaciones: document.getElementById("totalPublicaciones"),
        notas: document.getElementById("totalNotas"),
        meGusta: document.getElementById("totalMeGusta"),
        respuestas: document.getElementById("totalRespuestas"),
      },

      // Modal de edición
      modal: {
        container: document.getElementById("modalEditarPerfil"),
        cerrar: document.getElementById("cerrarModalEditar"),
        cancelar: document.getElementById("btnCancelarEditar"),
        formulario: document.getElementById("formularioEditar"),
        campos: {
          nombre: document.getElementById("editarNombre"),
          bio: document.getElementById("editarBio"),
        },
      },

      // Tabs
      tabBtns: document.querySelectorAll(".tab-btn"),
      tabContents: document.querySelectorAll(".tab-content"),
    };
  }

  configurarEventListeners() {
    // Navegación
    this.elementos.btnVolver?.addEventListener("click", () =>
      this.manejarVolver()
    );
    this.elementos.btnEditarPerfil?.addEventListener("click", () =>
      this.modal.abrir()
    );

    // Modal
    this.elementos.modal.cerrar?.addEventListener("click", () =>
      this.modal.cerrar()
    );
    this.elementos.modal.cancelar?.addEventListener("click", () =>
      this.modal.cerrar()
    );
    this.elementos.modal.formulario?.addEventListener("submit", (e) =>
      this.guardarCambiosPerfil(e)
    );
    this.elementos.modal.container?.addEventListener("mousedown", (e) => {
      if (e.target === this.elementos.modal.container) {
        if (!window.getSelection().toString()) {
          this.modal.cerrar();
        }
      }
    });

    this.elementos.modal.container?.addEventListener("click", (e) => {
      if (
        e.target === this.elementos.modal.container &&
        !window.getSelection().toString()
      ) {
        this.modal.cerrar();
      }
    });

    // Tabs
    this.tabs.init(this.elementos.tabBtns);

    // Sincronización de avatar MEJORADA
    this.configurarSincronizacionAvatar();
  }

  // ====== GESTIÓN DE DATOS ======
  async cargarDatosUsuario() {
    try {
      console.log("🔄 Cargando datos del usuario...");
      
      if (!this.firebaseUser) {
        throw new Error("Usuario no autenticado");
      }

      // Cargar datos desde Firestore
      const userDoc = await firebase.firestore()
        .collection('usuarios')
        .doc(this.firebaseUser.uid)
        .get();

      if (userDoc.exists) {
        const userData = userDoc.data();
        console.log("📊 Datos del usuario desde Firestore:", userData);
        
        // Convertir datos de Firestore a nuestro formato
        this.currentUser = await this.procesarDatosFirestore(userData);
      } else {
        console.log("⚠️ No se encontró documento del usuario, creando uno nuevo");
        this.currentUser = await this.crearUsuarioDefecto();
      }

      console.log("✅ Datos de usuario cargados:", this.currentUser.nombre);
    } catch (error) {
      console.error("❌ Error cargando datos:", error);
      this.mostrarError("Error al cargar los datos del usuario");
      // Fallback a datos por defecto
      this.currentUser = this.crearUsuarioDefectoLocal();
    }
  }

  async procesarDatosFirestore(userData) {
    // Procesar fecha de registro
    let fechaRegistroTexto = "Fecha no disponible";
    if (userData.fechaRegistro) {
      try {
        const fecha = userData.fechaRegistro.toDate ? 
          userData.fechaRegistro.toDate() : 
          new Date(userData.fechaRegistro);
        
        fechaRegistroTexto = fecha.toLocaleDateString("es-ES", {
          year: "numeric",
          month: "long",
        });
      } catch (error) {
        console.warn("⚠️ Error procesando fecha de registro:", error);
      }
    }

    // ✨ NUEVO: Obtener avatar sincronizado desde Firestore
    const avatarSincronizado = await this.obtenerAvatarSincronizado(userData);

    return {
      uid: userData.uid || this.firebaseUser.uid,
      nombre: userData.nombre || "Usuario",
      bio: userData.biografia || "",
      email: userData.email || this.firebaseUser.email,
      avatar: avatarSincronizado, // ✨ USAR AVATAR SINCRONIZADO
      tipoUsuario: userData.tipoUsuario || "usuario",
      fechaRegistro: userData.fechaRegistro,
      fechaRegistroTexto: fechaRegistroTexto,
      estadisticas: userData.estadisticas || {
        publicaciones: 0,
        notas: 0,
        meGusta: 0,
        respuestas: 0,
      },
      contenido: userData.contenido || {
        publicaciones: [],
        notas: [],
        meGusta: [],
        respuestas: [],
      },
      configuracion: userData.configuracion || {
        perfilPublico: true,
        notificaciones: true,
        tema: "claro",
      },
    };
  }

  // ✨ NUEVA FUNCIÓN: Obtener avatar sincronizado
  async obtenerAvatarSincronizado(userData) {
    try {
      // 1. Prioridad: Avatar desde Firestore (perfil.avatar o avatar)
      const avatarFirestore = userData.perfil?.avatar || userData.avatar;
      
      // 2. Fallback: Avatar desde localStorage
      const avatarLocalStorage = localStorage.getItem(CONFIG.STORAGE_KEYS.AVATAR);
      
      // 3. Default: Avatar predefinido
      const avatarFinal = avatarFirestore || avatarLocalStorage || AVATARES_PREDEFINIDOS.default;
      
      console.log("🎨 Avatar obtenido:", {
        firestore: avatarFirestore,
        localStorage: avatarLocalStorage,
        final: avatarFinal
      });

      // Si no hay avatar en Firestore pero sí en localStorage, sincronizar
      if (!avatarFirestore && avatarLocalStorage) {
        console.log("🔄 Sincronizando avatar desde localStorage a Firestore...");
        await this.guardarAvatarEnFirestore(avatarLocalStorage);
      }
      
      // Siempre actualizar localStorage con el avatar final
      localStorage.setItem(CONFIG.STORAGE_KEYS.AVATAR, avatarFinal);
      
      return avatarFinal;
      
    } catch (error) {
      console.error("❌ Error obteniendo avatar sincronizado:", error);
      return AVATARES_PREDEFINIDOS.default;
    }
  }

  // ✨ NUEVA FUNCIÓN: Guardar avatar en Firestore
  async guardarAvatarEnFirestore(avatarUrl) {
    if (!this.firebaseUser) return false;

    try {
      await firebase.firestore()
        .collection('usuarios')
        .doc(this.firebaseUser.uid)
        .set({
          'perfil.avatar': avatarUrl,
          'avatar': avatarUrl, // Mantener ambos campos para compatibilidad
          'estadisticas.ultimaActividad': firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      
      console.log("✅ Avatar guardado en Firestore:", avatarUrl);
      return true;
    } catch (error) {
      console.error("❌ Error guardando avatar en Firestore:", error);
      return false;
    }
  }

  async crearUsuarioDefecto() {
    const fechaActual = new Date();
    const avatarInicial = await this.obtenerAvatarSincronizado({});
    
    const usuario = {
      uid: this.firebaseUser.uid,
      nombre: this.firebaseUser.displayName || "Usuario",
      bio: "",
      email: this.firebaseUser.email,
      avatar: avatarInicial, // ✨ USAR AVATAR SINCRONIZADO
      tipoUsuario: "usuario",
      fechaRegistro: firebase.firestore.Timestamp.fromDate(fechaActual),
      fechaRegistroTexto: fechaActual.toLocaleDateString("es-ES", {
        year: "numeric",
        month: "long",
      }),
      estadisticas: {
        publicaciones: 0,
        notas: 0,
        meGusta: 0,
        respuestas: 0,
      },
      contenido: {
        publicaciones: [],
        notas: [],
        meGusta: [],
        respuestas: [],
      },
      configuracion: {
        perfilPublico: true,
        notificaciones: true,
        tema: "claro",
      },
      perfil: {
        avatar: avatarInicial // ✨ AGREGAR CAMPO PERFIL
      }
    };

    // Guardar en Firestore
    try {
      await firebase.firestore()
        .collection('usuarios')
        .doc(this.firebaseUser.uid)
        .set(usuario);
      
      console.log("✅ Usuario creado en Firestore con avatar sincronizado");
    } catch (error) {
      console.error("❌ Error creando usuario en Firestore:", error);
    }

    return usuario;
  }

  crearUsuarioDefectoLocal() {
    const fechaActual = new Date();
    const avatarLocal = this.obtenerAvatarGuardado();
    
    return {
      uid: "local_" + Date.now(),
      nombre: "Usuario",
      bio: "",
      email: "usuario@example.com",
      avatar: avatarLocal,
      tipoUsuario: "usuario",
      fechaRegistro: fechaActual.toISOString(),
      fechaRegistroTexto: fechaActual.toLocaleDateString("es-ES", {
        year: "numeric",
        month: "long",
      }),
      estadisticas: {
        publicaciones: 0,
        notas: 0,
        meGusta: 0,
        respuestas: 0,
      },
      contenido: {
        publicaciones: [],
        notas: [],
        meGusta: [],
        respuestas: [],
      },
      configuracion: {
        perfilPublico: true,
        notificaciones: true,
        tema: "claro",
      },
    };
  }

  obtenerAvatarGuardado() {
    return (
      localStorage.getItem(CONFIG.STORAGE_KEYS.AVATAR) || AVATARES_PREDEFINIDOS.default
    );
  }

  async guardarDatos(datos = null) {
    const datosAGuardar = datos || this.currentUser;

    try {
      if (!this.firebaseUser) {
        throw new Error("Usuario no autenticado");
      }

      // Preparar datos para Firestore con avatar sincronizado
      const datosFirestore = {
        uid: datosAGuardar.uid,
        nombre: datosAGuardar.nombre,
        biografia: datosAGuardar.bio,
        email: datosAGuardar.email,
        avatar: datosAGuardar.avatar, // Campo principal
        tipoUsuario: datosAGuardar.tipoUsuario,
        estadisticas: datosAGuardar.estadisticas,
        contenido: datosAGuardar.contenido,
        configuracion: datosAGuardar.configuracion,
        perfil: {
          avatar: datosAGuardar.avatar // ✨ CAMPO ANIDADO PARA COMPATIBILIDAD
        }
      };

      // Solo agregar fechaRegistro si no existe
      if (!datosAGuardar.fechaRegistro) {
        datosFirestore.fechaRegistro = firebase.firestore.Timestamp.now();
      }

      // Guardar en Firestore
      await firebase.firestore()
        .collection('usuarios')
        .doc(this.firebaseUser.uid)
        .set(datosFirestore, { merge: true });

      // ✨ SINCRONIZAR CON LOCALSTORAGE
      localStorage.setItem(CONFIG.STORAGE_KEYS.AVATAR, datosAGuardar.avatar);
      localStorage.setItem(
        CONFIG.STORAGE_KEYS.USER_DATA,
        JSON.stringify(datosAGuardar)
      );

      console.log("💾 Datos guardados correctamente en Firestore y localStorage sincronizado");
    } catch (error) {
      console.error("❌ Error guardando datos:", error);
      // Intentar guardar solo en localStorage
      localStorage.setItem(
        CONFIG.STORAGE_KEYS.USER_DATA,
        JSON.stringify(datosAGuardar)
      );
      throw error;
    }
  }

  // ====== ACTUALIZACIÓN DE INTERFAZ ======
  actualizarInterfaz() {
    if (!this.currentUser) return;

    this.actualizarInformacionBasica();
    this.actualizarEstadisticas();
    this.actualizarEstado();
    this.tabs.actualizarContenido(this.currentUser.contenido);
  }

  actualizarInformacionBasica() {
    const { nombre, fechaRegistroTexto, avatar, bio, email } = this.currentUser;

    this.elementos.perfilNombre.textContent = nombre;
    this.elementos.perfilFechaRegistro.textContent = `Miembro desde: ${fechaRegistroTexto}`;
    this.elementos.perfilAvatar.src = avatar;
    this.elementos.perfilBio.textContent = bio || "Sin biografía";

    // Mostrar email si está disponible (opcional)
    console.log("📧 Email del usuario:", email);
    console.log("🎨 Avatar actualizado en perfil:", avatar);
  }

  actualizarEstadisticas() {
    const stats = this.currentUser.estadisticas;

    Object.keys(stats).forEach((key) => {
      if (this.elementos.stats[key]) {
        this.elementos.stats[key].textContent = stats[key];
      }
    });
  }

  actualizarEstado() {
    const statusIndicator =
      this.elementos.perfilStatus.querySelector(".status-indicator");
    const statusText =
      this.elementos.perfilStatus.querySelector(".status-text");

    if (statusIndicator && statusText) {
      statusIndicator.className = "status-indicator online";
      statusText.textContent = "En línea";
    }
  }

  // ====== GESTIÓN DE PERFIL ======
  async guardarCambiosPerfil(event) {
    event.preventDefault();

    try {
      const formData = new FormData(event.target);
      const nombre = formData.get("nombre")?.trim();
      const bio = formData.get("bio")?.trim();

      // Validación
      if (!this.validarCamposPerfil(nombre)) return;

      // Mostrar indicador de carga
      this.mostrarNotificacion("💾 Guardando cambios...", "info");

      // Actualizar datos
      this.currentUser.nombre = nombre;
      this.currentUser.bio = bio;

      // Guardar en Firebase
      await this.guardarDatos();

      // Actualizar interfaz
      this.actualizarInterfaz();
      this.modal.cerrar();

      this.mostrarNotificacion(
        "✅ Perfil actualizado correctamente",
        "success"
      );
    } catch (error) {
      console.error("❌ Error guardando perfil:", error);
      this.mostrarError("Error al guardar los cambios. Inténtalo de nuevo.");
    }
  }

  validarCamposPerfil(nombre) {
    if (!nombre) {
      this.mostrarError("El nombre de usuario es obligatorio");
      return false;
    }
    if (nombre.length < 2) {
      this.mostrarError("El nombre debe tener al menos 2 caracteres");
      return false;
    }
    if (nombre.length > 50) {
      this.mostrarError("El nombre no puede tener más de 50 caracteres");
      return false;
    }
    return true;
  }

  // ====== GESTIÓN DE CONTENIDO ======
  async agregarContenido(tipo, item) {
    try {
      if (!this.currentUser.contenido[tipo]) {
        this.currentUser.contenido[tipo] = [];
      }

      // Agregar timestamp si no existe
      if (!item.fecha) {
        item.fecha = new Date().toISOString();
        item.fechaTexto = new Date().toLocaleDateString("es-ES");
      }

      // Agregar al principio del array
      this.currentUser.contenido[tipo].unshift(item);
      this.currentUser.estadisticas[tipo]++;

      // Guardar y actualizar
      await this.guardarDatos();
      this.actualizarInterfaz();

      console.log(`➕ ${tipo} agregado:`, item);
    } catch (error) {
      console.error(`❌ Error agregando ${tipo}:`, error);
      throw error;
    }
  }

  // ====== NAVEGACIÓN ======
  manejarVolver() {
    if (document.referrer) {
      window.history.back();
    } else {
      window.location.href = "/index.html";
    }
  }

  // ====== SINCRONIZACIÓN DE AVATAR MEJORADA ======
  configurarSincronizacionAvatar() {
    // ✨ VERIFICACIÓN BIDIRECCIONAL MEJORADA
    const verificarSincronizacion = async () => {
      try {
        // 1. Verificar cambios desde localStorage
        const avatarLocalStorage = localStorage.getItem(CONFIG.STORAGE_KEYS.AVATAR);
        
        // 2. Verificar cambios desde Firestore si es necesario
        if (this.firebaseUser) {
          const userDoc = await firebase.firestore()
            .collection('usuarios')
            .doc(this.firebaseUser.uid)
            .get();
            
          if (userDoc.exists) {
            const userData = userDoc.data();
            const avatarFirestore = userData.perfil?.avatar || userData.avatar;
            
            // 3. Sincronizar si hay diferencias
            if (avatarFirestore && avatarFirestore !== this.currentUser.avatar) {
              console.log("🔄 Sincronizando avatar desde Firestore...");
              this.currentUser.avatar = avatarFirestore;
              this.elementos.perfilAvatar.src = avatarFirestore;
              localStorage.setItem(CONFIG.STORAGE_KEYS.AVATAR, avatarFirestore);
            } else if (avatarLocalStorage && avatarLocalStorage !== this.currentUser.avatar) {
              console.log("🔄 Sincronizando avatar desde localStorage...");
              this.currentUser.avatar = avatarLocalStorage;
              this.elementos.perfilAvatar.src = avatarLocalStorage;
              await this.guardarAvatarEnFirestore(avatarLocalStorage);
            }
          }
        }
      } catch (error) {
        console.error("❌ Error en verificación de sincronización:", error);
      }
    };

    // Verificar cada 2 segundos (reducido de 1 segundo para mejor rendimiento)
    setInterval(verificarSincronizacion, 2000);

    // ✨ LISTENER DE CAMBIOS EN STORAGE
    window.addEventListener("storage", async (e) => {
      if (e.key === CONFIG.STORAGE_KEYS.AVATAR && e.newValue) {
        console.log("🎨 Avatar cambiado en otra pestaña, sincronizando...");
        this.currentUser.avatar = e.newValue;
        this.elementos.perfilAvatar.src = e.newValue;
        await this.guardarAvatarEnFirestore(e.newValue);
      }
    });

    // ✨ LISTENER PARA CAMBIOS EN TIEMPO REAL DE FIRESTORE
    if (this.firebaseUser) {
      firebase.firestore()
        .collection('usuarios')
        .doc(this.firebaseUser.uid)
        .onSnapshot((doc) => {
          if (doc.exists) {
            const userData = doc.data();
            const avatarFirestore = userData.perfil?.avatar || userData.avatar;
            
            if (avatarFirestore && avatarFirestore !== this.currentUser.avatar) {
              console.log("🔄 Avatar actualizado en tiempo real desde Firestore...");
              this.currentUser.avatar = avatarFirestore;
              this.elementos.perfilAvatar.src = avatarFirestore;
              localStorage.setItem(CONFIG.STORAGE_KEYS.AVATAR, avatarFirestore);
            }
          }
        }, (error) => {
          console.error("Error en listener de Firestore:", error);
        });
    }
  }

  // ====== NOTIFICACIONES ======
  mostrarNotificacion(mensaje, tipo = "info") {
    const notificacion = document.createElement("div");
    notificacion.className = `notificacion notificacion-${tipo}`;
    notificacion.innerHTML = `
            <i class="bi bi-${
              tipo === "success"
                ? "check-circle-fill"
                : tipo === "error"
                ? "exclamation-triangle-fill"
                : "info-circle-fill"
            }"></i>
            <span>${mensaje}</span>
        `;

    this.aplicarEstilosNotificacion(notificacion, tipo);
    document.body.appendChild(notificacion);

    setTimeout(() => (notificacion.style.transform = "translateX(0)"), 100);
    setTimeout(() => {
      notificacion.style.transform = "translateX(100%)";
      setTimeout(() => {
        if (document.body.contains(notificacion)) {
          document.body.removeChild(notificacion);
        }
      }, 300);
    }, 3000);
  }

  aplicarEstilosNotificacion(elemento, tipo) {
    const colores = {
      success: { bg: "#d4edda", text: "#155724" },
      error: { bg: "#f8d7da", text: "#721c24" },
      info: { bg: "#d1ecf1", text: "#0c5460" },
    };

    elemento.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 10000;
            background: ${colores[tipo].bg}; color: ${colores[tipo].text};
            padding: 15px 20px; border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            display: flex; align-items: center; gap: 10px;
            transform: translateX(100%); transition: transform 0.3s ease;
        `;
  }

  mostrarError(mensaje) {
    this.mostrarNotificacion(`❌ ${mensaje}`, "error");
  }

  // ====== API PÚBLICA PARA FIREBASE ======
  static getAPI() {
    return {
      obtenerUsuario: () => window.perfilApp?.currentUser,
      actualizarUsuario: (datos) => window.perfilApp?.guardarDatos(datos),
      agregarPublicacion: (pub) =>
        window.perfilApp?.agregarContenido("publicaciones", pub),
      agregarNota: (nota) => window.perfilApp?.agregarContenido("notas", nota),
      agregarMeGusta: (item) =>
        window.perfilApp?.agregarContenido("meGusta", item),
      agregarRespuesta: (resp) =>
        window.perfilApp?.agregarContenido("respuestas", resp),
      actualizarInterfaz: () => window.perfilApp?.actualizarInterfaz(),
      mostrarNotificacion: (msg, tipo) =>
        window.perfilApp?.mostrarNotificacion(msg, tipo),
      // ✨ NUEVAS FUNCIONES DE API
      sincronizarAvatar: (avatarUrl) => window.perfilApp?.guardarAvatarEnFirestore(avatarUrl),
      obtenerAvatar: () => window.perfilApp?.currentUser?.avatar,
    };
  }
}

// ====== GESTIÓN DE TABS (Sin cambios) ======
class TabManager {
  constructor() {
    this.activeTab = "publicaciones";
  }

  init(tabButtons) {
    tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const tabName = btn.getAttribute("data-tab");
        this.cambiarTab(tabName);
      });
    });
  }

  cambiarTab(tabName) {
    document
      .querySelectorAll(".tab-btn")
      .forEach((btn) => btn.classList.remove("active"));
    document
      .querySelectorAll(".tab-content")
      .forEach((content) => content.classList.remove("active"));

    const btnActivo = document.querySelector(`[data-tab="${tabName}"]`);
    const contentActivo = document.getElementById(`tab-${tabName}`);

    if (btnActivo && contentActivo) {
      btnActivo.classList.add("active");
      contentActivo.classList.add("active");
      this.activeTab = tabName;
    }
  }

  actualizarContenido(contenido) {
    CONFIG.TABS.forEach((tab) => {
      this.actualizarTab(tab, contenido[tab] || []);
    });
  }

  actualizarTab(tipo, items) {
    const tabElement = document.getElementById(`tab-${tipo}`);
    if (!tabElement) return;

    if (items.length === 0) {
      tabElement.innerHTML = this.crearContenidoVacio(tipo);
    } else {
      tabElement.innerHTML = this.crearListaItems(tipo, items);
    }
  }

  crearContenidoVacio(tipo) {
    const iconos = {
      publicaciones: "grid-3x3-gap",
      notas: "file-earmark-text",
      megusta: "heart",
      respuestas: "chat",
    };

    const textos = {
      publicaciones: "Sin publicaciones aún",
      notas: "Sin notas aún",
      megusta: "Sin me gusta aún",
      respuestas: "Sin respuestas aún",
    };

    return `
            <div class="contenido-vacio">
                <i class="bi bi-${iconos[tipo]}"></i>
                <h3>${textos[tipo]}</h3>
                <p>Tu contenido aparecerá aquí</p>
            </div>
        `;
  }

  crearListaItems(tipo, items) {
    const itemsHTML = items
      .map((item) => this.crearItemHTML(tipo, item))
      .join("");
    return `<div class="lista-${tipo}">${itemsHTML}</div>`;
  }

  crearItemHTML(tipo, item) {
    const fecha =
      item.fechaTexto || new Date(item.fecha).toLocaleDateString("es-ES");

    switch (tipo) {
      case "publicaciones":
        return `
                    <div class="item-card">
                        <h4>${item.titulo || "Sin título"}</h4>
                        <p>${item.contenido || item.descripcion || ""}</p>
                        <small>📅 ${fecha}</small>
                    </div>
                `;
      case "notas":
        return `
                    <div class="item-card">
                        <h4>${item.titulo || "Nota sin título"}</h4>
                        <p>${item.contenido}</p>
                        <small>📝 ${fecha}</small>
                    </div>
                `;
      case "megusta":
        return `
                    <div class="item-card">
                        <h4>${item.titulo || "Publicación"}</h4>
                        <p>${item.contenido || ""}</p>
                        <small>❤️ Te gustó el ${fecha}</small>
                    </div>
                `;
      case "respuestas":
        return `
                    <div class="item-card">
                        <p><strong>Respondiste:</strong> ${item.contenido}</p>
                        <small>💬 ${fecha} - En: "${
          item.publicacionOriginal || "Publicación"
        }"</small>
                    </div>
                `;
      default:
        return "";
    }
  }
}

// ====== GESTIÓN DE MODAL ======
class ModalManager {
  constructor() {
    this.modal = document.getElementById("modalEditarPerfil");
    this.campos = {
      nombre: document.getElementById("editarNombre"),
      bio: document.getElementById("editarBio"),
    };
  }

  abrir() {
    if (!this.modal) return;

    const usuario = window.perfilApp?.currentUser;
    if (usuario) {
      this.campos.nombre.value = usuario.nombre || "";
      this.campos.bio.value = usuario.bio || "";
    }

    this.modal.style.display = "block";
    this.campos.nombre.focus();
  }

  cerrar() {
    if (this.modal) {
      this.modal.style.display = "none";
    }
  }
}

// ====== INICIALIZACIÓN ======
document.addEventListener("DOMContentLoaded", () => {
  // Esperar a que Firebase esté completamente cargado
  if (typeof firebase === 'undefined') {
    console.error("❌ Firebase no está cargado");
    return;
  }

  window.perfilApp = new PerfilUsuario();
  window.PerfilAPI = PerfilUsuario.getAPI();

  console.log("🚀 Sistema de perfil integrado con Firebase listo");
  console.log("🎨 Sistema de avatar sincronizado activado");
});

// MODO OSCURO, PARTE CAMILO
document.addEventListener("DOMContentLoaded", function () {
  const body = document.body;
  const themeStatus = document.getElementById("theme-status");
  const toggleThemeBtn = document.getElementById("toggle-theme");

  function toggleDarkMode() {
      body.classList.toggle("dark-mode");
      const isDarkMode = body.classList.contains("dark-mode");
      localStorage.setItem("theme", isDarkMode ? "dark" : "light");

      if (themeStatus) {
          themeStatus.textContent = isDarkMode ? "Oscuro" : "Claro";
      }
  }

  if (localStorage.getItem("theme") === "dark") {
      body.classList.add("dark-mode");
      if (themeStatus) {
          themeStatus.textContent = "Oscuro";
      }
  } else {
      if (themeStatus) {
          themeStatus.textContent = "Claro";
      }
  }

  if (toggleThemeBtn) {
      toggleThemeBtn.addEventListener("click", toggleDarkMode);
  }
});