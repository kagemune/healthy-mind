// ====== PERFIL PÚBLICO - ARCHIVO JAVASCRIPT CORREGIDO ======
// Archivo: Perfil_publico.js

// ====== CONFIGURACIÓN Y CONSTANTES ======
const CONFIG = {
    AVATARES_PREDEFINIDOS: {
        default: '/Imagenes/Avatares/Avatar1.jpg'
    },
    COLLECTION_NAMES: {
        USUARIOS: 'usuarios',
        COMENTARIOS: 'comentarios',
        RESPUESTAS: 'respuestas',
        SEGUIDORES: 'seguidores'
    }
};

// ====== VARIABLES GLOBALES ======
let currentUser = null;
let targetUser = null;
let urlParams = new URLSearchParams(window.location.search);
let targetUid = urlParams.get('uid');
let targetUsername = urlParams.get('user');

// ====== INICIALIZACIÓN ======
document.addEventListener('DOMContentLoaded', function() {
    console.log("🚀 Iniciando perfil público...");
    console.log("UID objetivo:", targetUid);
    console.log("Username objetivo:", targetUsername);
    
    inicializarPerfilPublico();
});

// ====== FUNCIÓN PRINCIPAL DE INICIALIZACIÓN ======
function inicializarPerfilPublico() {
    // Verificar que Firebase esté disponible
    if (typeof firebase === 'undefined') {
        console.error("❌ Firebase no está disponible");
        mostrarError("Error de configuración de Firebase");
        return;
    }

    // Verificar que los servicios estén disponibles
    if (typeof db === 'undefined' || typeof auth === 'undefined') {
        console.error("❌ Servicios de Firebase no disponibles");
        mostrarError("Error de configuración de servicios");
        return;
    }

    console.log("✅ Firebase disponible, configurando autenticación...");

    // ✨ MODIFICACIÓN IMPORTANTE: No redirigir si no hay usuario autenticado
    // El perfil público debe ser visible sin login
    auth.onAuthStateChanged((user) => {
        currentUser = user;
        console.log("Estado de autenticación:", user ? "Autenticado" : "No autenticado");
        
        // Cargar perfil independientemente del estado de autenticación
        cargarPerfilObjetivo();
    });
}

// ====== CARGAR PERFIL OBJETIVO ======
async function cargarPerfilObjetivo() {
    try {
        if (targetUid) {
            console.log("🔍 Cargando perfil por UID:", targetUid);
            await cargarPerfilPorUid(targetUid);
        } else if (targetUsername) {
            console.log("🔍 Cargando perfil por nombre:", targetUsername);
            await cargarPerfilPorUsername(targetUsername);
        } else {
            throw new Error("No se proporcionaron parámetros de usuario válidos");
        }
    } catch (error) {
        console.error("❌ Error al cargar perfil:", error);
        mostrarError(error.message || "Error al cargar el perfil del usuario");
    }
}

// ====== CARGAR PERFIL POR UID ======
async function cargarPerfilPorUid(uid) {
    try {
        console.log("📋 Obteniendo documento del usuario...");
        
        const userDoc = await db.collection(CONFIG.COLLECTION_NAMES.USUARIOS).doc(uid).get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            console.log("✅ Datos del usuario obtenidos:", userData.nombre || "Sin nombre");
            
            targetUser = { 
                id: uid, 
                ...userData 
            };
            
            await mostrarPerfil(targetUser);
        } else {
            throw new Error("Usuario no encontrado en la base de datos");
        }
    } catch (error) {
        console.error("❌ Error al cargar perfil por UID:", error);
        throw error;
    }
}

// ====== CARGAR PERFIL POR NOMBRE DE USUARIO ======
async function cargarPerfilPorUsername(username) {
    try {
        console.log("🔍 Buscando usuario por nombre...");
        
        const snapshot = await db.collection(CONFIG.COLLECTION_NAMES.USUARIOS)
            .where('nombre', '==', username)
            .limit(1)
            .get();
        
        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            const userData = doc.data();
            console.log("✅ Usuario encontrado:", userData.nombre);
            
            targetUser = { 
                id: doc.id, 
                ...userData 
            };
            
            await mostrarPerfil(targetUser);
        } else {
            throw new Error(`Usuario "${username}" no encontrado`);
        }
    } catch (error) {
        console.error("❌ Error al buscar usuario:", error);
        throw error;
    }
}

// ====== MOSTRAR PERFIL ======
async function mostrarPerfil(usuario) {
    console.log("🎨 Renderizando perfil de:", usuario.nombre || "Usuario");
    
    try {
        // Ocultar loading y mostrar contenido
        document.getElementById('loadingIndicator').style.display = 'none';
        document.getElementById('perfilContenido').style.display = 'block';
        
        // Actualizar información básica
        actualizarInformacionBasica(usuario);
        
        // Actualizar estadísticas
        actualizarEstadisticas(usuario);
        
        // Actualizar estado
        actualizarEstado();
        
        // Configurar botones de acción
        configurarBotonesAccion(usuario);
        
        // Cargar contenido del usuario
        await cargarContenidoUsuario(usuario.id);
        
        console.log("✅ Perfil renderizado exitosamente");
        
    } catch (error) {
        console.error("❌ Error al mostrar perfil:", error);
        mostrarError("Error al mostrar la información del perfil");
    }
}

// ====== ACTUALIZAR INFORMACIÓN BÁSICA ======
function actualizarInformacionBasica(usuario) {
    // Título y nombre
    const titulo = `Perfil de ${usuario.nombre || 'Usuario'}`;
    document.getElementById('perfilTitulo').textContent = titulo;
    document.getElementById('perfilNombre').textContent = usuario.nombre || 'Usuario Sin Nombre';
    
    // Biografía - buscar en múltiples campos posibles
    const bio = usuario.biografia || usuario.bio || 'Este usuario no ha agregado una biografía.';
    document.getElementById('perfilBio').textContent = bio;
    
    // Avatar - buscar en múltiples ubicaciones posibles
    const avatar = usuario.perfil?.avatar || usuario.avatar || CONFIG.AVATARES_PREDEFINIDOS.default;
    const avatarElement = document.getElementById('perfilAvatar');
    avatarElement.src = avatar;
    avatarElement.alt = `Avatar de ${usuario.nombre || 'Usuario'}`;
    
    // Fecha de registro
    actualizarFechaRegistro(usuario);
    
    console.log("✅ Información básica actualizada");
}

// ====== ACTUALIZAR FECHA DE REGISTRO ======
function actualizarFechaRegistro(usuario) {
    let fechaTexto = "Fecha de registro no disponible";
    
    if (usuario.fechaRegistro) {
        try {
            const fecha = usuario.fechaRegistro.toDate ? 
                usuario.fechaRegistro.toDate() : 
                new Date(usuario.fechaRegistro);
            
            fechaTexto = `Miembro desde ${fecha.toLocaleDateString("es-ES", {
                year: "numeric",
                month: "long"
            })}`;
        } catch (error) {
            console.warn("⚠️ Error procesando fecha:", error);
            fechaTexto = "Miembro desde hace tiempo";
        }
    }
    
    document.getElementById('perfilFechaRegistro').textContent = fechaTexto;
}

// ====== ACTUALIZAR ESTADÍSTICAS ======
function actualizarEstadisticas(usuario) {
    const stats = usuario.estadisticas || {};
    
    // Estadísticas por defecto
    const statsDefecto = {
        publicaciones: 0,
        notas: 0,
        meGusta: 0,
        respuestas: 0
    };
    
    // Combinar estadísticas
    const estadisticasFinales = { ...statsDefecto, ...stats };
    
    // Actualizar elementos
    document.getElementById('totalPublicaciones').textContent = estadisticasFinales.publicaciones;
    document.getElementById('totalNotas').textContent = estadisticasFinales.notas;
    document.getElementById('totalMeGusta').textContent = estadisticasFinales.meGusta;
    document.getElementById('totalRespuestas').textContent = estadisticasFinales.respuestas;
    
    console.log("📊 Estadísticas actualizadas:", estadisticasFinales);
}

// ====== ACTUALIZAR ESTADO ======
function actualizarEstado() {
    const statusIndicator = document.querySelector('.status-indicator');
    const statusText = document.querySelector('.status-text');
    
    if (statusIndicator && statusText) {
        statusIndicator.style.background = '#28a745';
        statusText.textContent = 'En línea';
    }
}

// ====== CONFIGURAR BOTONES DE ACCIÓN ======
function configurarBotonesAccion(usuario) {
    const btnSeguir = document.getElementById('btnSeguir');
    
    // Si es el mismo usuario, ocultar botón y mostrar mensaje
    if (currentUser && currentUser.uid === usuario.id) {
        btnSeguir.style.display = 'none';
        
        // Cambiar título para indicar que es su propio perfil
        document.getElementById('perfilTitulo').textContent = 'Mi Perfil Público';
        
        console.log("👤 Es el perfil del usuario actual");
        return;
    }
    
    // Si no hay usuario autenticado, ocultar botón
    if (!currentUser) {
        btnSeguir.style.display = 'none';
        console.log("🔒 Usuario no autenticado, ocultando botones");
        return;
    }
    
    // Configurar botón seguir
    btnSeguir.onclick = () => toggleSeguir(usuario.id);
    
    // Verificar si ya sigue al usuario
    verificarSeguimiento(usuario.id);
}

// ====== SISTEMA DE SEGUIMIENTO ======
async function verificarSeguimiento(targetUid) {
    if (!currentUser) return;
    
    try {
        const followId = `${currentUser.uid}_${targetUid}`;
        const followDoc = await db.collection(CONFIG.COLLECTION_NAMES.SEGUIDORES).doc(followId).get();
        
        const btnSeguir = document.getElementById('btnSeguir');
        const span = btnSeguir.querySelector('span');
        const icon = btnSeguir.querySelector('i');
        
        if (followDoc.exists) {
            btnSeguir.classList.add('btn-siguiendo');
            span.textContent = 'Siguiendo';
            icon.className = 'bi bi-person-check-fill';
        } else {
            btnSeguir.classList.remove('btn-siguiendo');
            span.textContent = 'Seguir';
            icon.className = 'bi bi-person-plus-fill';
        }
        
        console.log("👥 Estado de seguimiento verificado");
        
    } catch (error) {
        console.error("❌ Error verificando seguimiento:", error);
    }
}

async function toggleSeguir(targetUid) {
    if (!currentUser) {
        mostrarNotificacion('Debes iniciar sesión para seguir usuarios', 'error');
        return;
    }
    
    try {
        const followId = `${currentUser.uid}_${targetUid}`;
        
        // 🔍 DEBUG: Verificar datos antes de enviar
        console.log('🔍 Datos que se envían:', {
            followId: followId,
            currentUserUid: currentUser.uid,
            targetUid: targetUid,
            seguidor: currentUser.uid,
            siguiendo: targetUid
        });
        
        const followDoc = await db.collection(CONFIG.COLLECTION_NAMES.SEGUIDORES).doc(followId).get();
        
        if (followDoc.exists) {
            // Dejar de seguir
            console.log('🗑️ Eliminando seguimiento...');
            await db.collection(CONFIG.COLLECTION_NAMES.SEGUIDORES).doc(followId).delete();
            mostrarNotificacion('Has dejado de seguir a este usuario', 'info');
        } else {
            // Seguir - DATOS EXACTOS QUE ESPERA FIREBASE
            console.log('➕ Creando seguimiento...');
            
            const datosCompletos = {
                seguidor: currentUser.uid,                    // ← Campo que verifican las reglas
                siguiendo: targetUid,
                fechaSeguimiento: firebase.firestore.FieldValue.serverTimestamp(),
                seguidorNombre: currentUser.displayName || currentUser.email?.split('@')[0] || 'Usuario',
                siguiendoNombre: targetUser.nombre || 'Usuario',
                activo: true                                  // ← Campo adicional por si acaso
            };
            
            console.log('📤 Enviando datos:', datosCompletos);
            
            await db.collection(CONFIG.COLLECTION_NAMES.SEGUIDORES).doc(followId).set(datosCompletos);
            mostrarNotificacion('Ahora sigues a este usuario', 'success');
        }
        
        // Actualizar botón
        await verificarSeguimiento(targetUid);
        
    } catch (error) {
        console.error("❌ Error al cambiar seguimiento:", error);
        console.error("❌ Detalles del error:", {
            code: error.code,
            message: error.message,
            details: error
        });
        mostrarNotificacion('Error al procesar la solicitud: ' + error.message, 'error');
    }
}
// ====== CARGAR CONTENIDO DEL USUARIO ======
async function cargarContenidoUsuario(uid) {
    try {
        console.log("📄 Cargando contenido público del usuario...");
        
        // Cargar comentarios públicos
        await cargarComentariosPublicos(uid);
        
        // Cargar respuestas públicas
        await cargarRespuestasPublicas(uid);
        
        console.log("✅ Contenido cargado exitosamente");
        
    } catch (error) {
        console.error("❌ Error cargando contenido:", error);
    }
}

// ====== CARGAR COMENTARIOS PÚBLICOS ======
async function cargarComentariosPublicos(uid) {
    try {
        const comentariosSnapshot = await db.collection(CONFIG.COLLECTION_NAMES.COMENTARIOS)
            .where('uid', '==', uid)
            .where('activo', '==', true)
            .orderBy('timestamp', 'desc')
            .limit(20)
            .get();
        
        if (!comentariosSnapshot.empty) {
            mostrarComentarios(comentariosSnapshot.docs);
            console.log(`📝 ${comentariosSnapshot.docs.length} comentarios públicos cargados`);
        } else {
            console.log("📝 No se encontraron comentarios públicos");
        }
        
    } catch (error) {
        console.error("❌ Error cargando comentarios:", error);
    }
}

// ====== CARGAR RESPUESTAS PÚBLICAS ======
async function cargarRespuestasPublicas(uid) {
    try {
        const respuestasSnapshot = await db.collection(CONFIG.COLLECTION_NAMES.RESPUESTAS)
            .where('uid', '==', uid)
            .where('activo', '==', true)
            .orderBy('timestamp', 'desc')
            .limit(20)
            .get();
        
        if (!respuestasSnapshot.empty) {
            mostrarRespuestas(respuestasSnapshot.docs);
            console.log(`💬 ${respuestasSnapshot.docs.length} respuestas públicas cargadas`);
        } else {
            console.log("💬 No se encontraron respuestas públicas");
        }
        
    } catch (error) {
        console.error("❌ Error cargando respuestas:", error);
    }
}

// ====== MOSTRAR COMENTARIOS ======
function mostrarComentarios(comentarios) {
    const tabPublicaciones = document.getElementById('tab-publicaciones');
    
    if (comentarios.length === 0) {
        return;
    }
    
    let html = '';
    comentarios.forEach(doc => {
        const comentario = doc.data();
        const fecha = formatearFecha(comentario.timestamp) || comentario.hora || 'Sin fecha';
        const texto = escaparHTML(comentario.texto || 'Sin contenido');
        
        // Calcular total de reacciones
        let totalReacciones = 0;
        if (comentario.reacciones) {
            Object.values(comentario.reacciones).forEach(reaccion => {
                totalReacciones += reaccion.count || 0;
            });
        }
        
        html += `
            <div class="item-card">
                <h4>💬 Comentario público</h4>
                <p>${texto}</p>
                <div class="item-meta">
                    <small>📅 ${fecha}</small>
                    ${totalReacciones > 0 ? `<small>❤️ ${totalReacciones} reacciones</small>` : ''}
                </div>
            </div>
        `;
    });
    
    tabPublicaciones.innerHTML = html;
}

// ====== MOSTRAR RESPUESTAS ======
function mostrarRespuestas(respuestas) {
    const tabRespuestas = document.getElementById('tab-respuestas');
    
    if (respuestas.length === 0) {
        return;
    }
    
    let html = '';
    respuestas.forEach(doc => {
        const respuesta = doc.data();
        const fecha = formatearFecha(respuesta.timestamp) || respuesta.hora || 'Sin fecha';
        const texto = escaparHTML(respuesta.texto || 'Sin contenido');
        
        // Calcular total de reacciones
        let totalReacciones = 0;
        if (respuesta.reacciones) {
            Object.values(respuesta.reacciones).forEach(reaccion => {
                totalReacciones += reaccion.count || 0;
            });
        }
        
        html += `
            <div class="item-card">
                <h4>💭 Respuesta pública</h4>
                <p>${texto}</p>
                <div class="item-meta">
                    <small>📅 ${fecha}</small>
                    ${totalReacciones > 0 ? `<small>❤️ ${totalReacciones} reacciones</small>` : ''}
                </div>
            </div>
        `;
    });
    
    tabRespuestas.innerHTML = html;
}

// ====== GESTIÓN DE TABS ======
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('tab-btn') || e.target.closest('.tab-btn')) {
        const tabBtn = e.target.classList.contains('tab-btn') ? e.target : e.target.closest('.tab-btn');
        const tabName = tabBtn.getAttribute('data-tab');
        cambiarTab(tabName);
    }
});

function cambiarTab(tabName) {
    // Remover clase active de todos los botones y contenidos
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Agregar clase active al botón y contenido seleccionado
    const btnActivo = document.querySelector(`[data-tab="${tabName}"]`);
    const contentActivo = document.getElementById(`tab-${tabName}`);
    
    if (btnActivo && contentActivo) {
        btnActivo.classList.add('active');
        contentActivo.classList.add('active');
    }
    
    console.log(`🔄 Tab cambiado a: ${tabName}`);
}

// ====== BOTÓN VOLVER ======
document.getElementById('btnVolver').addEventListener('click', function() {
    if (document.referrer && document.referrer.includes(window.location.hostname)) {
        window.history.back();
    } else {
        window.location.href = '/index.html';
    }
});

// ====== UTILIDADES ======
function formatearFecha(timestamp) {
    try {
        if (!timestamp) return null;
        
        const fecha = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return fecha.toLocaleDateString("es-ES", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    } catch (error) {
        return null;
    }
}

function escaparHTML(texto) {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
}

// ====== MANEJO DE ERRORES ======
function mostrarError(mensaje) {
    console.error("💥 Mostrando error:", mensaje);
    
    document.getElementById('loadingIndicator').style.display = 'none';
    document.getElementById('perfilContenido').style.display = 'none';
    document.getElementById('errorMessage').style.display = 'block';
    
    const errorText = document.getElementById('errorMessage').querySelector('p');
    if (errorText) {
        errorText.textContent = mensaje;
    }
}

// ====== SISTEMA DE NOTIFICACIONES ======
function mostrarNotificacion(mensaje, tipo = 'info') {
    const notificacion = document.createElement('div');
    notificacion.className = `notificacion ${tipo}`;
    notificacion.textContent = mensaje;
    
    // Aplicar estilos
    const colores = {
        success: '#28a745',
        error: '#dc3545',
        info: '#17a2b8',
        warning: '#ffc107'
    };

    notificacion.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1000;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        background: ${colores[tipo]};
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        transform: translateX(100%);
        transition: transform 0.3s ease;
        max-width: 300px;
        word-wrap: break-word;
    `;
    
    document.body.appendChild(notificacion);
    
    // Mostrar con animación
    setTimeout(() => {
        notificacion.style.transform = 'translateX(0)';
    }, 100);
    
    // Ocultar después de 3 segundos
    setTimeout(() => {
        notificacion.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (document.body.contains(notificacion)) {
                document.body.removeChild(notificacion);
            }
        }, 300);
    }, 3000);
}

// ====== API PÚBLICA ======
window.PerfilPublicoAPI = {
    obtenerUsuarioActual: () => currentUser,
    obtenerUsuarioTarget: () => targetUser,
    mostrarNotificacion: mostrarNotificacion,
    recargarPerfil: cargarPerfilObjetivo
};

console.log("✅ Sistema de perfil público inicializado");

// Modo Oscuro
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