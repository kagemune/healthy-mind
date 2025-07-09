/* ============================
   MENÚ DE HAMBURGUESA
   ============================ */
const nav = document.querySelector("#barra");
const abrir = document.querySelector("#abrir");
const cerrar = document.querySelector("#cerrar");
const logo = document.querySelector("#logo");
const mainContent = document.querySelector("main");

// Funcionalidad del menú hamburguesa
abrir.addEventListener("click", () => {
    nav.classList.add("visible");
    logo.style.display = "none";
    mainContent.style.display = "none";
    
    // Ocultar comentarios cuando se abre el menú
    const commentBoxes = document.querySelectorAll(".caja_comentarios");
    commentBoxes.forEach(comment => comment.style.display = "none");
});

cerrar.addEventListener("click", () => {
    nav.classList.remove("visible");
    logo.style.display = "block";
    mainContent.style.display = "block";
    
    // Mostrar comentarios cuando se cierra el menú
    const commentBoxes = document.querySelectorAll(".caja_comentarios");
    commentBoxes.forEach(comment => comment.style.display = "block");
});

// Animación de iconos en el menú
document.querySelectorAll(".barralista li a").forEach(enlace => {
    enlace.addEventListener("click", (e) => {
        const icono = enlace.querySelector("i");
        if (icono) {
            icono.classList.add("animacion");

            setTimeout(() => {
                icono.classList.remove("animacion");
            }, 300);
        }
    });
});

let currentUser = null;
let verificacionTimeout = null;
let verificacionRespuestaTimeout = null;
const todosLosPosts = [];

/*============================
   INICIALIZACIÓN DE FIREBASE
   ============================ */
function inicializarFirebase() {
    console.log("Iniciando configuración de Firebase...");
    
    // Verificar que Firebase esté disponible
    if (typeof firebase === 'undefined') {
        console.error("Firebase no está disponible");
        setTimeout(inicializarFirebase, 1000);
        return;
    }

    // Inicializar referencias
    db = firebase.firestore();
    auth = firebase.auth();
    
    console.log("Firebase inicializado correctamente");
    
    // CRÍTICO: Esperar a que Firebase verifique el estado de autenticación
    auth.onAuthStateChanged((user) => {
        console.log("Estado de autenticación cambió:", user ? "Autenticado" : "No autenticado");
        
        if (user) {
            currentUser = user.displayName || user.email || "Usuario";
            console.log("Usuario autenticado:", currentUser, "UID:", user.uid);
            
            // SOLO cargar comentarios después de confirmar autenticación
            setTimeout(() => {
                cargarComentarios();
                setupResponseNotifications();
                obtenerComentariosOrdenadosPorReacciones()
                .then(renderizarCarruselReaccionados)
                .catch(console.error);
            }, 500);
            
        } else {
            currentUser = null;
            console.log("Usuario no autenticado - redirigiendo...");
            // El auth-guard.js ya maneja la redirección
        }
    });
}
async function obtenerComentariosOrdenadosPorReacciones() {
    if (!db) {
        console.error("Firestore no disponible para obtener comentarios ordenados.");
        return [];
    }
    try {
        const snapshot = await db.collection('comentarios')
            .where('activo', '==', true)
            .get();
        const comentarios = snapshot.docs.map(doc => {
            const data = doc.data();
            let total = 0;
            if (data.reacciones) {
                Object.values(data.reacciones).forEach(r => {
                    total += (r.count || 0);
                });
            }
            return {
                id: doc.id,
                usuario: data.usuario,
                texto: data.texto,
                hora: data.hora,
                timestamp: data.timestamp,
                avatar: data.avatar || AVATARES_PREDEFINIDOS.default,
                reacciones: data.reacciones || {},
                totalReacciones: total
            };
        });
        comentarios.sort((a, b) => b.totalReacciones - a.totalReacciones);
        return comentarios;
    } catch (error) {
        console.error("Error al obtener comentarios desde Firestore:", error);
        return [];
    }
}

// ---------- Función para renderizar top reaccionados en sección fija ----------
function renderizarTopReaccionados(comentariosOrdenados, topCount = 3) {
    const contenedor = document.getElementById("ultimosPostsContainer");
    if (!contenedor) {
        console.error("Contenedor de más reaccionados no encontrado (id='ultimosPostsContainer').");
        return;
    }
    contenedor.innerHTML = "";
    const top = comentariosOrdenados.slice(0, topCount);
    top.forEach(com => {
        const postElement = document.createElement("div");
        postElement.className = "post-mas-reaccionado"; // clase nueva para estilos

        // Cabecera: avatar, nombre y hora
        const header = document.createElement("div");
        header.className = "post-header";
        const avatar = document.createElement("img");
        avatar.className = "avatar";
aplicarAvatarSeguro(avatar, com.avatar, "Avatar de " + (com.usuario || "Usuario"));
avatar.alt = "Avatar de " + (com.usuario || "Usuario");
avatar.style.width = "40px";
avatar.style.height = "40px";
avatar.style.borderRadius = "50%";
avatar.style.objectFit = "cover";
avatar.style.marginRight = "8px";

        // Si tu lógica tiene avatars, cárgalos aquí

        const nombre = document.createElement("span");
        nombre.className = "nombre";
        nombre.textContent = com.usuario || "Usuario";
        const hora = document.createElement("span");
        hora.className = "tiempo-publicacion";
        hora.textContent = formatearFechaTwitter(com.fechaCreacion) || com.hora || obtenerHoraFormateada();

        header.appendChild(avatar);
        header.appendChild(nombre);
        header.appendChild(hora);

        // Texto del post, con límite de caracteres
        const texto = document.createElement("p");
        const maxLen = 100;
        if (com.texto.length > maxLen) {
            texto.textContent = com.texto.substring(0, maxLen - 3) + "...";
            texto.title = com.texto;
        } else {
            texto.textContent = com.texto;
        }
        texto.className = "texto-post-mas";

        // Info de reacciones
        const reaccionesInfo = document.createElement("div");
reaccionesInfo.className = "info-reacciones";
reaccionesInfo.style.marginTop = "10px";

const reacciones = com.reacciones || {};
const emojis = ["❤️", "😂", "😮", "😢"];

emojis.forEach(emoji => {
    const count = reacciones[emoji]?.count || 0;
    const span = document.createElement("span");
    span.style.marginRight = "8px";
    span.textContent = `${emoji} ${count}`;
    reaccionesInfo.appendChild(span);
});


        // Botón “Ver más” para navegar al comentario
        const boton = document.createElement("button");
        boton.className = "ver-mas-mas-reaccionados";
        boton.textContent = "Ver más";
        boton.onclick = function () {
            // Remover indicador previo de selección si existe
            const previo = document.querySelector('.comentario-seleccionado');
            if (previo) {
                previo.classList.remove('comentario-seleccionado');
                const pinPrevio = previo.querySelector('.pin-indicador');
                if (pinPrevio) pinPrevio.remove();
            }
            // Intentar encontrar el elemento de comentario en la lista principal
            const selector = `[data-id=\"${com.id}\"]`;
            const elemento = document.querySelector(selector);
            if (elemento) {
                // Desplegar respuestas si está colapsado (si aplica)
                // Scroll suave al elemento
                elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Efecto de resaltado temporal
                elemento.classList.add('resaltado-temporal');
                setTimeout(() => elemento.classList.remove('resaltado-temporal'), 2000);
                // Agregar indicación permanente temporal (pin) y clase de seleccionado
                elemento.classList.add('comentario-seleccionado');
                const pin = document.createElement('span');
                pin.className = 'pin-indicador';
                pin.textContent = '📌';
                // Asegurarse de posicionar el pin adecuadamente: prepend al contenedor de comentario
                elemento.prepend(pin);
                // Remover la indicación después de cierto tiempo, p. ej., 5 segundos
                setTimeout(() => {
                    elemento.classList.remove('comentario-seleccionado');
                    const pinRem = elemento.querySelector('.pin-indicador');
                    if (pinRem) pinRem.remove();
                }, 5000);
            } else {
                console.warn('No se encontró el comentario con ID:', com.id);
                // Alternativa: abrir modal con detalle si no está en DOM
            }
        };

        postElement.appendChild(header);
        postElement.appendChild(texto);
        postElement.appendChild(reaccionesInfo);
        postElement.appendChild(boton);
        contenedor.appendChild(postElement);
    });
}
// ---------- Función orquestadora para cargar y renderizar ----------
async function cargarMasReaccionadosYRenderizar(topCount = 5) {
    const ordenados = await obtenerComentariosOrdenadosPorReacciones();
    renderizarTopReaccionados(ordenados, topCount);
    renderizarCarruselReaccionados(ordenados, topCount);
}
/**
 * Renderiza en el carrusel móvil (contenedor id="carruselPosts") los comentarios más reaccionados.
 * @param {Array} comentarios Array de objetos ordenados con propiedad totalReacciones, id, usuario, texto, hora, etc.
 * @param {number} topCount Número de elementos a mostrar en el carrusel.
 */
function renderizarCarruselReaccionados(comentarios, topCount = 5) {
    const carrusel = document.getElementById("carruselPosts");
    if (!carrusel) {
        console.error("Contenedor de carrusel no encontrado (id='carruselPosts').");
        return;
    }
    carrusel.innerHTML = "";  // limpiar contenidos previos

    const top = comentarios.slice(0, topCount);
    top.forEach(com => {
        const card = document.createElement("div");
        card.className = "post";  // coincide con tu CSS .carrusel-contenedor .post

        // Cabecera: avatar, nombre y hora
        const header = document.createElement("div");
        header.className = "post-header";
        const avatar = document.createElement("div");
        avatar.className = "avatar";
        const nombre = document.createElement("span");
        nombre.className = "nombre";
        nombre.textContent = com.usuario || "Usuario";
        const hora = document.createElement("span");
        hora.className = "tiempo-publicacion";
       hora.textContent = formatearFechaTwitter(com.fechaCreacion) || com.hora || obtenerHoraFormateada();

        header.appendChild(avatar);
        header.appendChild(nombre);
        header.appendChild(hora);

        // Texto del post con truncado si es muy largo
        const textoP = document.createElement("p");
        const maxLen = 100;
        if (com.texto && com.texto.length > maxLen) {
            textoP.textContent = com.texto.substring(0, maxLen - 3) + "...";
            textoP.title = com.texto;
        } else {
            textoP.textContent = com.texto || "";
        }

        // Botón “Ver más”
        const boton = document.createElement("button");
        boton.className = "ver-mas";
        boton.textContent = "Ver más";
        boton.onclick = () => {
            // lógica para desplazar al comentario original en la lista principal
            const previo = document.querySelector('.comentario-seleccionado');
            if (previo) {
                previo.classList.remove('comentario-seleccionado');
                const pinPrevio = previo.querySelector('.pin-indicador');
                if (pinPrevio) pinPrevio.remove();
            }
            const selector = `[data-id="${com.id}"]`;
            const elemento = document.querySelector(selector);
            if (elemento) {
                elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
                elemento.classList.add('resaltado-temporal');
                setTimeout(() => elemento.classList.remove('resaltado-temporal'), 2000);
                elemento.classList.add('comentario-seleccionado');
                const pin = document.createElement('span');
                pin.className = 'pin-indicador';
                pin.textContent = '📌';
                elemento.prepend(pin);
                setTimeout(() => {
                    elemento.classList.remove('comentario-seleccionado');
                    const pinRem = elemento.querySelector('.pin-indicador');
                    if (pinRem) pinRem.remove();
                }, 5000);
            } else {
                console.warn('No se encontró el comentario con ID:', com.id);
            }
        };

        // Ensamblar card
        card.appendChild(header);
        card.appendChild(textoP);
        card.appendChild(boton);
        carrusel.appendChild(card);
    });
}


/* ============================
   FUNCIONES DE FIRESTORE
   ============================ */

async function guardarComentario(texto) {
    // Verificar que el usuario esté autenticado
    if (!auth || !auth.currentUser) {
        console.error("Usuario no autenticado para guardar comentario");
        mostrarVentanaEmergente("Debes iniciar sesión para comentar.");
        return null;
    }
    
    if (!db) {
        console.error("Firestore no está disponible");
        mostrarVentanaEmergente("Error de conexión. Inténtalo de nuevo.");
        return null;
    }
    
    try {
        // OBTENER DATOS DEL USUARIO INCLUYENDO AVATAR
        const userDoc = await db.collection('usuarios').doc(auth.currentUser.uid).get();
        const userData = userDoc.exists ? userDoc.data() : {};
        const avatar = userData.perfil?.avatar || AVATARES_PREDEFINIDOS.default;
        const nombreUsuario = userData.nombre || auth.currentUser.displayName || auth.currentUser.email.split('@')[0];
        
        const comentarioData = {
            uid: auth.currentUser.uid,
            usuario: nombreUsuario, // NOMBRE ACTUALIZADO
            avatar: avatar, // NUEVA PROPIEDAD
            texto: texto,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            fechaCreacion: new Date().toISOString(),
            hora: obtenerHoraFormateada(),
            reacciones: {
                "❤️": { count: 0, usuarios: [] },
                "😂": { count: 0, usuarios: [] },
                "😮": { count: 0, usuarios: [] },
                "😢": { count: 0, usuarios: [] }
            },
            activo: true
        };
        
        const docRef = await db.collection('comentarios').add(comentarioData);
        console.log("Comentario guardado con ID:", docRef.id);
        return { id: docRef.id, ...comentarioData };
    } catch (error) {
        console.error("Error al guardar comentario:", error);
        mostrarVentanaEmergente("Error al publicar el comentario. Inténtalo de nuevo.");
        return null;
    }
}

async function guardarRespuesta(comentarioId, texto) {
    // Verificar que el usuario esté autenticado
    if (!auth || !auth.currentUser) {
        console.error("Usuario no autenticado para guardar respuesta");
        mostrarVentanaEmergente("Debes iniciar sesión para responder.");
        return null;
    }
    
    if (!db) {
        console.error("Firestore no está disponible");
        mostrarVentanaEmergente("Error de conexión. Inténtalo de nuevo.");
        return null;
    }
    
    try {
        // OBTENER DATOS DEL USUARIO INCLUYENDO AVATAR
        const userDoc = await db.collection('usuarios').doc(auth.currentUser.uid).get();
        const userData = userDoc.exists ? userDoc.data() : {};
        const avatar = userData.perfil?.avatar || AVATARES_PREDEFINIDOS.default;
        const nombreUsuario = userData.nombre || auth.currentUser.displayName || auth.currentUser.email.split('@')[0];
        
        const respuestaData = {
            uid: auth.currentUser.uid,
            usuario: nombreUsuario, // NOMBRE ACTUALIZADO
            avatar: avatar, // NUEVA PROPIEDAD
            comentarioId: comentarioId,
            texto: texto,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            fechaCreacion: new Date().toISOString(),
            hora: obtenerHoraFormateada(),
            reacciones: {
                "❤️": { count: 0, usuarios: [] },
                "😂": { count: 0, usuarios: [] },
                "😮": { count: 0, usuarios: [] },
                "😢": { count: 0, usuarios: [] }
            },
            activo: true
        };
        
        const docRef = await db.collection('respuestas').add(respuestaData);
        console.log("Respuesta guardada con ID:", docRef.id);
        return { id: docRef.id, ...respuestaData };
    } catch (error) {
        console.error("Error al guardar respuesta:", error);
        mostrarVentanaEmergente("Error al publicar la respuesta. Inténtalo de nuevo.");
        return null;
    }
}

async function cargarComentarios() {
    if (!auth || !auth.currentUser) {
        console.log("Esperando autenticación para cargar comentarios...");
        return;
    }
    
    if (!db) {
        console.error("Firestore no disponible");
        return;
    }
    
    try {
        const listaComentarios = document.getElementById("lista_comentarios");
        if (!listaComentarios) return;
        
        console.log("Cargando comentarios para usuario autenticado:", auth.currentUser.uid);
        
        // Limpiar comentarios existentes
        listaComentarios.innerHTML = "";
        
        const snapshot = await db.collection('comentarios')
            .where('activo', '==', true)
            .orderBy('timestamp', 'desc')
            .get();
        
        for (const doc of snapshot.docs) {
            const comentario = { id: doc.id, ...doc.data() };
            const elementoComentario = await crearElementoEntrada(comentario, "comentario", 0);
            listaComentarios.appendChild(elementoComentario);
        }
        
        console.log(`${snapshot.docs.length} comentarios cargados`);
    } catch (error) {
        console.error("Error al cargar comentarios:", error);
        mostrarVentanaEmergente("Error al cargar comentarios. Recarga la página.");
    }
}
// Cargar respuestas de un comentario específico
async function cargarRespuestas(comentarioId, contenedorRespuestas) {
    if (!db) return;
    
    try {
        const snapshot = await db.collection('respuestas')
            .where('comentarioId', '==', comentarioId)
            .where('activo', '==', true)
            .orderBy('timestamp', 'asc')
            .get();
        
        // Limpiar respuestas existentes
        contenedorRespuestas.innerHTML = "";
        
        for (const doc of snapshot.docs) {
            const respuesta = { id: doc.id, ...doc.data() };
            const elementoRespuesta = await crearElementoEntrada(respuesta, "respuesta");
            contenedorRespuestas.appendChild(elementoRespuesta);
        }
        
        console.log(`${snapshot.docs.length} respuestas cargadas para comentario ${comentarioId}`);
    } catch (error) {
        console.error("Error al cargar respuestas:", error);
    }
}

// Actualizar reacción en Firestore
async function actualizarReaccion(docId, coleccion, emoji, accion) {
    if (!db || !auth.currentUser) return;
    
    try {
        const docRef = db.collection(coleccion).doc(docId);
        const userId = auth.currentUser.uid;
        
        const doc = await docRef.get();
        if (!doc.exists) return;
        
        const data = doc.data();
        const reacciones = data.reacciones || {};
        
        // Limpiar reacciones previas del usuario
        Object.keys(reacciones).forEach(e => {
            if (reacciones[e].usuarios && reacciones[e].usuarios.includes(userId)) {
                reacciones[e].usuarios = reacciones[e].usuarios.filter(id => id !== userId);
                reacciones[e].count = Math.max(0, reacciones[e].count - 1);
            }
        });
        
        // Agregar nueva reacción si es necesario
        if (accion === 'agregar') {
            if (!reacciones[emoji]) {
                reacciones[emoji] = { count: 0, usuarios: [] };
            }
            if (!reacciones[emoji].usuarios.includes(userId)) {
                reacciones[emoji].usuarios.push(userId);
                reacciones[emoji].count += 1;
            }
        }
        
        await docRef.update({ reacciones });
        console.log("Reacción actualizada");
    } catch (error) {
        console.error("Error al actualizar reacción:", error);
    }
}

/* ============================
   Funciones de Validación
   ============================ */
function contieneURL(texto) {
    const patronURL = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/gi;
    return patronURL.test(texto);
}

function contieneNumeros(texto) {
    const patronNumeros = /\d/;
    return patronNumeros.test(texto);
}

function validarTexto(texto) {
    if (contieneURL(texto)) {
        mostrarVentanaEmergente("⚠️ Por seguridad, no se permiten URLs en los comentarios o respuestas.");
        return false;
    }
    if (contieneNumeros(texto)) {
        mostrarVentanaEmergente("⚠️ No se permiten números en los comentarios o respuestas.");
        return false;
    }
    return true;
}

/* ============================
   Ventana Emergente
   ============================ */
function mostrarVentanaEmergente(mensaje) {
    document.querySelectorAll('.fondo-modal').forEach(el => el.remove());

    const fondoModal = document.createElement('div');
    fondoModal.classList.add('fondo-modal');

    const modal = document.createElement('div');
    modal.classList.add('modal');

    const mensajeP = document.createElement('p');
    mensajeP.textContent = mensaje;

    const botonCerrar = document.createElement('button');
    botonCerrar.textContent = 'Cerrar';
    botonCerrar.classList.add('boton-cerrar');
    botonCerrar.onclick = () => fondoModal.remove();

    modal.appendChild(mensajeP);
    modal.appendChild(botonCerrar);
    fondoModal.appendChild(modal);
    document.body.appendChild(fondoModal);
}

/* ============================
   Formato de Tiempo
   ============================ */
function obtenerHoraFormateada() {
    const fecha = new Date();
    const dia = fecha.getDate().toString().padStart(2, '0');
    const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const año = fecha.getFullYear().toString().slice(-2);
    const horas = fecha.getHours().toString().padStart(2, '0');
    const minutos = fecha.getMinutes().toString().padStart(2, '0');
    
    return `${dia}/${mes}/${año}\n${horas}:${minutos}`;  
}
function formatearFechaTwitter(fechaISO) {
    if (!fechaISO) return obtenerHoraFormateada();
    
    const fecha = new Date(fechaISO);
    const dia = fecha.getDate().toString().padStart(2, '0');
    const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const año = fecha.getFullYear().toString().slice(-2);
    const horas = fecha.getHours().toString().padStart(2, '0');
    const minutos = fecha.getMinutes().toString().padStart(2, '0');
    
     return `${dia}/${mes}/${año}\n${horas}:${minutos}`;
}


/* ============================
   VERIFICACIÓN CON GEMINI API
   ============================ */
async function verificarComentario(texto) {
    console.log("Función verificarComentario llamada con texto:", texto);
    
    const btnPublicar = document.getElementById('btnPublicar');
    const statusIndicator = document.getElementById('statusIndicator');
    const statusIcon = document.getElementById('statusIcon');
    const statusText = document.getElementById('statusText');
    
    // Verificar que todos los elementos existen
    if (!btnPublicar || !statusIndicator || !statusIcon || !statusText) {
        console.error('Elementos del DOM no encontrados para verificación de comentario');
        return;
    }
         
    // Si el texto está vacío, deshabilitar el botón y ocultar el indicador
    if (!texto.trim()) {
        btnPublicar.disabled = true;
        statusIndicator.classList.add('hidden');
        statusText.textContent = '';
        statusIcon.textContent = '';
        return;
    }
         
    // Limpiamos cualquier timeout previo para evitar verificaciones múltiples
    clearTimeout(verificacionTimeout);
         
    // Esperamos 500ms para verificar (evita llamadas a la API en cada tecla)
    verificacionTimeout = setTimeout(async () => {
        console.log("Iniciando verificación de comentario con API");
        
        // Mostrar indicador de carga
        statusIndicator.classList.remove('hidden');
        statusIndicator.className = 'status-indicator status-loading';
        statusIcon.textContent = '⏳';
        statusText.innerHTML = '<span class="loader"></span>Verificando contenido...';
             
        try {
            console.log("Enviando petición a API:", texto);
            const response = await fetch('http://localhost:5000/moderar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contenido: texto })
            });
            
            console.log("Respuesta de la API recibida:", response.status);
            const resultado = await response.json();
            console.log("Resultado de moderación:", resultado);
                 
            // Actualizar UI según el resultado
            if (resultado.clasificacion === 'aprobado') {
                btnPublicar.disabled = false;
                statusIndicator.className = 'status-indicator status-approved';
                statusIcon.textContent = '✅';
                statusText.textContent = 'Contenido apropiado. Puedes publicar tu comentario.';
                console.log("Comentario aprobado");
            } else {
                btnPublicar.disabled = true;
                statusIndicator.className = 'status-indicator status-rejected';
                statusIcon.textContent = '❌';
                statusText.textContent = `Contenido inapropiado: ${resultado.explicacion}`;
                console.log("Comentario rechazado:", resultado.explicacion);
            }
        } catch (error) {
            console.error('Error al verificar contenido:', error);
            statusIndicator.className = 'status-indicator status-rejected';
            statusIcon.textContent = '⚠️';
            statusText.textContent = 'Error al verificar el contenido. Inténtalo de nuevo.';
            btnPublicar.disabled = true;
        }
    }, 500);
}

async function verificarRespuesta(texto, boton, indicador, icono, textoIndicador) {
    // Verificar que todos los elementos existen
    if (!boton || !indicador || !icono || !textoIndicador) {
        console.error('Elementos del DOM no encontrados para verificación de respuesta');
        return;
    }
    
    // Si el texto está vacío, deshabilitar el botón y ocultar el indicador
    if (!texto.trim()) {
        boton.disabled = true;
        indicador.classList.add('hidden');
        textoIndicador.textContent = '';
        icono.textContent = '';
        return;
    }
    
    // Limpiamos cualquier timeout previo para evitar verificaciones múltiples
    clearTimeout(verificacionRespuestaTimeout);
    
    // Esperamos 500ms para verificar (evita llamadas a la API en cada tecla)
    verificacionRespuestaTimeout = setTimeout(async () => {
        // Primera verificación básica
        if (!validarTexto(texto)) {
            boton.disabled = true;
            return;
        }
        
        // Mostrar indicador de carga
        indicador.classList.remove('hidden');
        indicador.className = 'status-indicator status-loading';
        icono.textContent = '⏳';
        textoIndicador.innerHTML = '<span class="loader"></span>Verificando contenido...';
        
        try {
            const response = await fetch('http://localhost:5000/moderar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contenido: texto })
            });
            
            const resultado = await response.json();
            
            // Actualizar UI según el resultado
            if (resultado.clasificacion === 'aprobado') {
                boton.disabled = false;
                indicador.className = 'status-indicator status-approved';
                icono.textContent = '✅';
                textoIndicador.textContent = 'Contenido apropiado. Puedes publicar tu respuesta.';
            } else {
                boton.disabled = true;
                indicador.className = 'status-indicator status-rejected';
                icono.textContent = '❌';
                textoIndicador.textContent = `Contenido inapropiado: ${resultado.explicacion}`;
            }
        } catch (error) {
            console.error('Error al verificar contenido:', error);
            indicador.className = 'status-indicator status-rejected';
            icono.textContent = '⚠️';
            textoIndicador.textContent = 'Error al verificar el contenido. Inténtalo de nuevo.';
            boton.disabled = true;
        }
    }, 500);
}

/* ============================
   Creación de Comentarios y Respuestas
   ============================ */
async function crearElementoEntrada(data, tipo, profundidad = 0) {
    const contenedor = document.createElement("div");
    contenedor.classList.add(tipo);
    contenedor.dataset.id = data.id;
    contenedor.dataset.uid = data.uid;
    
    // Agregar clase de profundidad para estilos
    if (profundidad > 0) {
        contenedor.classList.add(`profundidad-${Math.min(profundidad, 5)}`);
    }

    const cabeceraDiv = document.createElement("div");
    cabeceraDiv.classList.add("cabecera-entrada");

    // CREAR ELEMENTO AVATAR
    const avatarImg = document.createElement("img");
avatarImg.classList.add("avatar-comentario");
aplicarAvatarSeguro(avatarImg, data.avatar, "Avatar de " + (data.usuario || "Usuario"));avatarImg.alt = "Avatar de " + (data.usuario || "Usuario");
avatarImg.style.width = "60px";
avatarImg.style.height = "60px";
avatarImg.style.borderRadius = "50%";
avatarImg.style.marginRight = "8px";
avatarImg.style.objectFit = "cover";
avatarImg.style.cursor = "pointer";
avatarImg.title = "Ver perfil de " + (data.usuario || "Usuario");

// ✨ NUEVA FUNCIONALIDAD: Click inteligente en avatar
avatarImg.onclick = function(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const userData = {
        uid: data.uid,
        usuario: data.usuario,
        nombre: data.usuario,
        avatar: data.avatar
    };
    
    console.log("🖱️ Click en avatar detectado:", userData);
    manejarClickAvatar(userData);
};

cabeceraDiv.appendChild(avatarImg);

    const usuarioSpan = document.createElement("span");
    usuarioSpan.classList.add("nombre-usuario");
    usuarioSpan.textContent = data.usuario || "Usuario";
    cabeceraDiv.appendChild(usuarioSpan);

    const horaSpan = document.createElement("span");
    horaSpan.classList.add("tiempo-publicacion");
    horaSpan.textContent = formatearFechaTwitter(data.fechaCreacion) || data.hora || obtenerHoraFormateada();
    cabeceraDiv.appendChild(horaSpan);

    contenedor.appendChild(cabeceraDiv);

    const textoP = document.createElement("p");
    textoP.innerHTML = data.texto;
    contenedor.appendChild(textoP);

    // Sistema de reacciones (mantener igual)
    const reaccionesDiv = document.createElement("div");
    reaccionesDiv.classList.add("reacciones");
    const reacciones = data.reacciones || {
        "❤️": { count: 0, usuarios: [] },
        "😂": { count: 0, usuarios: [] },
        "😮": { count: 0, usuarios: [] },
        "😢": { count: 0, usuarios: [] }
    };

    let seleccionado = null;
    if (auth && auth.currentUser) {
        Object.keys(reacciones).forEach(emoji => {
            if (reacciones[emoji].usuarios && reacciones[emoji].usuarios.includes(auth.currentUser.uid)) {
                seleccionado = emoji;
            }
        });
    }

    Object.keys(reacciones).forEach(emoji => {
        const span = document.createElement("span");
        span.classList.add("reaccion");
        span.dataset.emoji = emoji;
        span.innerHTML = `${emoji} <span class="like-contador">${reacciones[emoji].count || 0}</span>`;

        if (seleccionado === emoji) {
            span.classList.add("seleccionado");
        }

        span.onclick = () => {
            if (!auth || !auth.currentUser) {
                mostrarVentanaEmergente("Debes iniciar sesión para reaccionar.");
                return;
            }

            const esSeleccionado = seleccionado === emoji;
            const accion = esSeleccionado ? 'quitar' : 'agregar';
            const coleccion = tipo === 'comentario' ? 'comentarios' : 'respuestas';

            if (esSeleccionado) {
                reacciones[emoji].count = Math.max(0, reacciones[emoji].count - 1);
                seleccionado = null;
                span.classList.remove("seleccionado");
            } else {
                if (seleccionado) {
                    const prevSpan = reaccionesDiv.querySelector(`span[data-emoji="${seleccionado}"]`);
                    if (prevSpan) {
                        reacciones[seleccionado].count = Math.max(0, reacciones[seleccionado].count - 1);
                        prevSpan.querySelector(".like-contador").textContent = reacciones[seleccionado].count;
                        prevSpan.classList.remove("seleccionado");
                    }
                }
                reacciones[emoji].count += 1;
                seleccionado = emoji;
                span.classList.add("seleccionado");
            }

            span.querySelector(".like-contador").textContent = reacciones[emoji].count;
            actualizarReaccion(data.id, coleccion, emoji, accion);
        };

        reaccionesDiv.appendChild(span);
    });

  contenedor.appendChild(reaccionesDiv);
    if (auth.currentUser && auth.currentUser.uid === data.uid && tipo === 'comentario') {
    const botonEliminar = document.createElement("button");
    botonEliminar.textContent = "🗑️ Eliminar";
    botonEliminar.classList.add("boton-eliminar-comentario");
    // estilos...
    botonEliminar.onclick = async () => {
        const confirmar = confirm("¿Estás seguro de que quieres eliminar este comentario?");
        if (confirmar) {
            await eliminarComentario(data.id);
            contenedor.remove();
            mostrarVentanaEmergente("Comentario eliminado con éxito.");
        }
    };
    contenedor.appendChild(botonEliminar);
}

  // SISTEMA DE RESPUESTAS MEJORADO con más profundidad
    const PROFUNDIDAD_MAXIMA = 5; // Incrementado de 2 a 5
    
    if (profundidad < PROFUNDIDAD_MAXIMA) {
        const inputRespuesta = document.createElement("input");
        inputRespuesta.type = "text";
        inputRespuesta.placeholder = profundidad === 0 ? "Escribe una respuesta..." : "Responder...";
        inputRespuesta.classList.add("input-respuesta");

        const respuestaStatusIndicator = document.createElement('div');
        respuestaStatusIndicator.className = 'status-indicator hidden';
        
        const respuestaStatusIcon = document.createElement('span');
        respuestaStatusIcon.className = 'status-icon';
        
        const respuestaStatusText = document.createElement('span');
        respuestaStatusText.className = 'status-text';
        
        respuestaStatusIndicator.appendChild(respuestaStatusIcon);
        respuestaStatusIndicator.appendChild(respuestaStatusText);

        const botonRespuesta = document.createElement("button");
        botonRespuesta.textContent = "Responder";
        botonRespuesta.classList.add("boton-responder");
        botonRespuesta.disabled = true;

        // NUEVO: Contenedor de info de respuestas y toggle
        const infoRespuestasDiv = document.createElement("div");
        infoRespuestasDiv.classList.add("info-respuestas");
        
        const toggleRespuestasBtn = document.createElement("span");
        toggleRespuestasBtn.classList.add("toggle-respuestas");
        toggleRespuestasBtn.style.cursor = "pointer";
        toggleRespuestasBtn.title = "Mostrar/Ocultar respuestas";
        
        const contadorRespuestas = document.createElement("span");
        contadorRespuestas.classList.add("contador-respuestas");
        
        infoRespuestasDiv.appendChild(toggleRespuestasBtn);
        infoRespuestasDiv.appendChild(contadorRespuestas);

        const contenedorRespuestas = document.createElement("div");
        contenedorRespuestas.classList.add("respuestas");
        contenedorRespuestas.style.display = "none"; // OCULTO POR DEFECTO

        // Contar y cargar respuestas
        const numRespuestas = await contarRespuestas(data.id);
        actualizarInfoRespuestas(toggleRespuestasBtn, contadorRespuestas, numRespuestas, false);

        toggleRespuestasBtn.onclick = async () => {
    const visible = contenedorRespuestas.style.display === "block";
    
    if (!visible) {
        // Cargar respuestas solo cuando se van a mostrar
        await cargarRespuestasConProfundidad(data.id, contenedorRespuestas, profundidad + 1);
        contenedorRespuestas.style.display = "block";
    } else {
        // Solo ocultar las respuestas, NO tocar el toggle
        contenedorRespuestas.style.display = "none";
    }
    
    // OBTENER EL CONTEO ACTUALIZADO CADA VEZ
    const numRespuestasActual = await contarRespuestas(data.id);
    console.log("Conteo actualizado de respuestas:", numRespuestasActual);
    
    // Actualizar info con el conteo correcto
    actualizarInfoRespuestas(toggleRespuestasBtn, contadorRespuestas, numRespuestasActual, !visible);
};

        inputRespuesta.addEventListener('input', function() {
            verificarRespuesta(this.value, botonRespuesta, respuestaStatusIndicator, respuestaStatusIcon, respuestaStatusText);
        });

        botonRespuesta.onclick = async () => {
    const resp = inputRespuesta.value.trim();
    if (resp && auth && auth.currentUser) { 
        const comentarioIdParaGuardar = obtenerComentarioIdRaiz(data, tipo);
        const respuestaGuardada = await guardarRespuesta(comentarioIdParaGuardar, resp);
        
        if (respuestaGuardada) {
            const nueva = await crearElementoEntrada(respuestaGuardada, "respuesta", profundidad + 1);
            contenedorRespuestas.appendChild(nueva);
            inputRespuesta.value = "";
            
            // OBTENER CONTEO ACTUALIZADO
            const nuevoNumRespuestas = await contarRespuestas(data.id);
            console.log("Nuevo número de respuestas:", nuevoNumRespuestas);
            
            // Asegurar que el contenedor esté visible
            contenedorRespuestas.style.display = "block";
            
            // Actualizar info con el conteo correcto Y visible=true
            actualizarInfoRespuestas(toggleRespuestasBtn, contadorRespuestas, nuevoNumRespuestas, true);
            
            // Asegurar que el toggle esté visible
            toggleRespuestasBtn.style.display = "inline-block";
            toggleRespuestasBtn.style.visibility = "visible";
            
            respuestaStatusIndicator.classList.add('hidden');
            respuestaStatusIcon.textContent = '';
            respuestaStatusText.textContent = '';
            botonRespuesta.disabled = true;
        }
    } else if (!auth || !auth.currentUser) {
        mostrarVentanaEmergente("Debes iniciar sesión para responder.");
    }
};

        contenedor.appendChild(infoRespuestasDiv);
        contenedor.appendChild(inputRespuesta);
        contenedor.appendChild(respuestaStatusIndicator);
        contenedor.appendChild(botonRespuesta);
        contenedor.appendChild(contenedorRespuestas);
    }

    return contenedor;
}

async function contarRespuestas(comentarioId) {
    if (!db) return 0;
    
    try {
        const snapshot = await db.collection('respuestas')
            .where('comentarioId', '==', comentarioId)
            .where('activo', '==', true)
            .get();
        
        return snapshot.size;
    } catch (error) {
        console.error("Error al contar respuestas:", error);
        return 0;
    }
}

// 3. NUEVA FUNCIÓN para actualizar info de respuestas
function actualizarInfoRespuestas(toggleBtn, contadorSpan, numRespuestas, visible) {
    console.log("actualizarInfoRespuestas llamada:", { numRespuestas, visible });
    
    // Actualizar el icono del toggle
    toggleBtn.innerHTML = visible ? "&#9660;" : "&#9654;";
    
    if (numRespuestas === 0) {
        // Si no hay respuestas, ocultar contador pero NO el toggle
        contadorSpan.textContent = "";
        toggleBtn.style.display = "none";
    } else {
        // Si hay respuestas, SIEMPRE mostrar el toggle
        toggleBtn.style.display = "inline-block";
        toggleBtn.style.visibility = "visible"; // AÑADIR ESTA LÍNEA
        
        // Mostrar contador solo cuando esté colapsado
        if (visible) {
            contadorSpan.textContent = ""; // Ocultar contador cuando está expandido
        } else {
            const texto = numRespuestas === 1 ? "1 respuesta" : `${numRespuestas} respuestas`;
            contadorSpan.textContent = texto; // Mostrar contador cuando está colapsado
        }
    }
}
function obtenerComentarioIdRaiz(data, tipo) {
    if (tipo === 'comentario') {
        return data.id;
    } else {
        // Para respuestas, usar el comentarioId que ya tienen
        return data.comentarioId || data.id;
    }
}
async function cargarRespuestasConProfundidad(comentarioId, contenedorRespuestas, profundidad) {
    if (!db) return;
    
    try {
        const snapshot = await db.collection('respuestas')
            .where('comentarioId', '==', comentarioId)
            .where('activo', '==', true)
            .orderBy('timestamp', 'asc')
            .get();
        
        // Limpiar respuestas existentes
        contenedorRespuestas.innerHTML = "";
        
        for (const doc of snapshot.docs) {
            const respuesta = { id: doc.id, ...doc.data() };
            const elementoRespuesta = await crearElementoEntrada(respuesta, "respuesta", profundidad);
            contenedorRespuestas.appendChild(elementoRespuesta);
        }
        
        console.log(`${snapshot.docs.length} respuestas cargadas para comentario ${comentarioId} con profundidad ${profundidad}`);
    } catch (error) {
        console.error("Error al cargar respuestas:", error);
    }
}

/* ============================
   ÚLTIMOS POSTS
   ============================ */


async function publicarComentario() {
    const textoElement = document.getElementById("comentario");
    const btnPublicar = document.getElementById('btnPublicar');
    
    if (!textoElement || !btnPublicar) {
        console.error('Elementos necesarios no encontrados');
        return;
    }
    
    // PREVENIR MÚLTIPLES CLICS
    if (btnPublicar.disabled || btnPublicar.dataset.publicando === 'true') {
        console.log("Publicación ya en proceso, ignorando...");
        return;
    }
    
    const texto = textoElement.value.trim();

    if (!texto || !validarTexto(texto)) return;

    // Verificar autenticación
    if (!auth || !auth.currentUser) {
        console.error("Usuario no autenticado al intentar publicar");
        mostrarVentanaEmergente("Debes iniciar sesión para comentar.");
        return;
    }

    // MARCAR COMO EN PROCESO
    btnPublicar.dataset.publicando = 'true';
    btnPublicar.disabled = true;
    btnPublicar.textContent = 'Publicando...';

    console.log("Publicando comentario para usuario:", auth.currentUser.uid);

    try {
        // Guardar comentario en Firebase
        const comentarioGuardado = await guardarComentario(texto);
        
        if (comentarioGuardado) {
            const listaComentarios = document.getElementById("lista_comentarios");
            if (listaComentarios) {
                const nuevo = await crearElementoEntrada(comentarioGuardado, "comentario");
                listaComentarios.prepend(nuevo);
            }
            
            textoElement.value = "";
            
            // Ocultar el indicador de estado
            const statusIndicator = document.getElementById('statusIndicator');
            const statusIcon = document.getElementById('statusIcon');
            const statusText = document.getElementById('statusText');
            
            if (statusIndicator) statusIndicator.classList.add('hidden');
            if (statusIcon) statusIcon.textContent = '';
            if (statusText) statusText.textContent = '';

            // ACTUALIZAR últimos posts CON AVATAR
            const hora = obtenerHoraFormateada();
            const userDoc = await db.collection('usuarios').doc(auth.currentUser.uid).get();
            const userData = userDoc.exists ? userDoc.data() : {};
            const nombreUsuario = userData.nombre || auth.currentUser.displayName || auth.currentUser.email.split('@')[0];
            const avatar = userData.perfil?.avatar || AVATARES_PREDEFINIDOS.default;
            
            todosLosPosts.push({ 
                usuario: nombreUsuario, 
                texto, 
                hora,
                avatar: avatar // NUEVA PROPIEDAD
            });
            actualizarUltimosPosts();
            
            console.log("Comentario publicado exitosamente");
        }
    } catch (error) {
        console.error("Error al publicar comentario:", error);
    } finally {
        // RESTAURAR BOTÓN
        btnPublicar.dataset.publicando = 'false';
        btnPublicar.textContent = 'Publicar';
        // El botón permanecerá deshabilitado hasta que se escriba nuevo contenido válido
    }
}
/* ============================
   INICIALIZACIÓN SIMPLE
   ============================ */
document.addEventListener('DOMContentLoaded', function () {
    console.log("DOM cargado");
    cargarMasReaccionadosYRenderizar(5);
    // 1. PRIMERO: Configurar el sistema de verificación SIN esperar Firebase
    configurarSistemaVerificacion();
    
    // 2. SEGUNDO: Inicializar Firebase después (sin bloquear)
    setTimeout(() => {
        inicializarFirebase();
    }, 100);
});

function configurarSistemaVerificacion() {
    const cajaComentarios = document.querySelector(".caja_comentarios");
    const textarea = document.getElementById('comentario');
    const botonPublicar = document.querySelector(".caja_comentarios > button");
    
    if (!cajaComentarios || !textarea || !botonPublicar) {
        setTimeout(configurarSistemaVerificacion, 200);
        return;
    }
    
    // Crear indicador de estado
    let statusIndicator = document.getElementById('statusIndicator');
    if (!statusIndicator) {
        statusIndicator = document.createElement('div');
        statusIndicator.id = 'statusIndicator';
        statusIndicator.className = 'status-indicator hidden';
        
        const statusIcon = document.createElement('span');
        statusIcon.id = 'statusIcon';
        statusIcon.className = 'status-icon';
        
        const statusText = document.createElement('span');
        statusText.id = 'statusText';
        statusText.className = 'status-text';
        
        statusIndicator.appendChild(statusIcon);
        statusIndicator.appendChild(statusText);
        textarea.parentNode.insertBefore(statusIndicator, textarea.nextSibling);
    }
    
    // Configurar botón
    botonPublicar.id = 'btnPublicar';
    botonPublicar.disabled = true;
    
    // VERIFICAR SI YA ESTÁN CONFIGURADOS LOS EVENT LISTENERS
    if (textarea.dataset.configured === 'true' && botonPublicar.dataset.configured === 'true') {
        console.log("Event listeners ya configurados, saltando...");
        return;
    }
    
    // Limpiar event listeners existentes solo si no están marcados como configurados
    if (textarea.dataset.configured !== 'true') {
        const nuevoTextarea = textarea.cloneNode(true);
        textarea.parentNode.replaceChild(nuevoTextarea, textarea);
        nuevoTextarea.dataset.configured = 'true';
        
        nuevoTextarea.addEventListener('input', function(e) {
            verificarComentario(e.target.value);
        });
    }
    
    if (botonPublicar.dataset.configured !== 'true') {
        const nuevoBoton = botonPublicar.cloneNode(true);
        botonPublicar.parentNode.replaceChild(nuevoBoton, botonPublicar);
        nuevoBoton.dataset.configured = 'true';
        nuevoBoton.id = 'btnPublicar';
        nuevoBoton.disabled = true;
        
        nuevoBoton.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            publicarComentario();
        });
    }
    
    // Configurar título
    const titulo = document.querySelector(".post-amigos h3");
    if (titulo) {
        titulo.textContent = "Tendencias";
    }
    console.log("Sistema de verificación configurado");
    // Cargar comentarios después de configurar
    esperarYCargarComentarios();
}

// 2. NUEVA FUNCIÓN para esperar autenticación y cargar comentarios
function esperarYCargarComentarios() {
    console.log("Esperando autenticación para cargar comentarios...");
    
    // Verificar si auth está disponible
    if (!auth) {
        console.log("Auth no disponible, reintentando...");
        setTimeout(esperarYCargarComentarios, 500);
        return;
    }
    // ---------------------------
// Notificaciones de respuestas
// ---------------------------
// ---------------------------
// Notificaciones de respuestas - VERSIÓN CORREGIDA
// ---------------------------
// ============================
// SISTEMA DE NOTIFICACIONES CORREGIDO
// ============================

function setupResponseNotifications() {
    // Verificar autenticación primero
    if (!auth || !auth.currentUser) {
        console.log('⚠️ Usuario no autenticado - no se configuran notificaciones');
        return;
    }

    console.log('🔔 Configurando notificaciones para:', auth.currentUser.uid);

    // 1. SOLICITAR PERMISOS DE NOTIFICACIÓN CORRECTAMENTE
    if (!('Notification' in window)) {
        console.warn('❌ Este navegador no soporta notificaciones.');
        return;
    }

    // Solicitar permisos si no están concedidos
    if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
            console.log('📋 Permiso de notificaciones:', permission);
            if (permission === 'granted') {
                console.log('✅ Permisos de notificación concedidos');
                iniciarListenerNotificaciones();
            } else {
                console.log('❌ Permisos de notificación denegados');
            }
        });
    } else if (Notification.permission === 'granted') {
        console.log('✅ Permisos ya concedidos, iniciando listener');
        iniciarListenerNotificaciones();
    } else {
        console.log('❌ Notificaciones bloqueadas por el usuario');
        return;
    }
}

function iniciarListenerNotificaciones() {
    if (!auth || !auth.currentUser) return;

    console.log('🚀 Iniciando listener de notificaciones - SOLO RESPUESTAS FUTURAS');

    // ✅ GUARDAR TIMESTAMP DEL MOMENTO EXACTO QUE SE CONFIGURA EL LISTENER
    const timestampConfiguracion = Date.now();
    console.log('⏰ Timestamp configuración listener:', new Date(timestampConfiguracion).toLocaleString());

    // ✅ LISTENER QUE SOLO PROCESA RESPUESTAS POSTERIORES A LA CONFIGURACIÓN
    const unsubscribe = db.collection('respuestas')
        .where('activo', '==', true)
        .onSnapshot(snapshot => {
            if (!auth.currentUser) {
                console.log('⚠️ Usuario ya no autenticado - deteniendo listener');
                unsubscribe();
                return;
            }

            console.log('📨 Snapshot recibido con', snapshot.docChanges().length, 'cambios');

            snapshot.docChanges().forEach(async change => {
                // ✅ SOLO PROCESAR RESPUESTAS AÑADIDAS
                if (change.type !== 'added') {
                    console.log('🚫 Cambio ignorado (no es añadido):', change.type);
                    return;
                }

                const resp = change.doc.data();
                const respuestaId = change.doc.id;

                console.log('🔍 Procesando respuesta:', {
                    id: respuestaId,
                    autor: resp.usuario,
                    texto: resp.texto?.substring(0, 30) + '...',
                    timestamp: resp.timestamp?.toDate?.()?.toLocaleString() || 'Sin timestamp',
                    fechaCreacion: resp.fechaCreacion
                });

                // ✅ FILTRO INTELIGENTE: Solo respuestas DESPUÉS de configurar el listener
                let esRespuestaPostConfiguracion = false;
                let fechaRespuesta = null;

                if (resp.timestamp && resp.timestamp.toDate) {
                    // Preferir timestamp de Firestore (más preciso)
                    fechaRespuesta = resp.timestamp.toDate().getTime();
                    esRespuestaPostConfiguracion = fechaRespuesta > timestampConfiguracion;
                    console.log('⏰ Verificación timestamp Firestore:', {
                        respuesta: new Date(fechaRespuesta).toLocaleString(),
                        configuracion: new Date(timestampConfiguracion).toLocaleString(),
                        esPosterior: esRespuestaPostConfiguracion,
                        diferencia: `${((fechaRespuesta - timestampConfiguracion) / 1000).toFixed(2)} segundos`
                    });
                } else if (resp.fechaCreacion) {
                    // Fallback a fechaCreacion
                    fechaRespuesta = new Date(resp.fechaCreacion).getTime();
                    esRespuestaPostConfiguracion = fechaRespuesta > timestampConfiguracion;
                    console.log('⏰ Verificación fechaCreacion:', {
                        respuesta: new Date(fechaRespuesta).toLocaleString(),
                        configuracion: new Date(timestampConfiguracion).toLocaleString(),
                        esPosterior: esRespuestaPostConfiguracion,
                        diferencia: `${((fechaRespuesta - timestampConfiguracion) / 1000).toFixed(2)} segundos`
                    });
                } else {
                    // Sin timestamp - probablemente respuesta muy nueva, procesar
                    esRespuestaPostConfiguracion = true;
                    console.log('⚠️ Sin timestamp válido - procesando como nueva');
                }

                if (!esRespuestaPostConfiguracion) {
                    console.log('🚫 Respuesta anterior a configuración del listener - IGNORANDO');
                    return;
                }

                console.log('✅ Respuesta posterior a configuración - PROCESANDO');

                try {
                    console.log('🔍 Obteniendo comentario original para respuesta:', resp.comentarioId);
                    
                    // Obtener el comentario original
                    const comentarioSnap = await db.collection('comentarios')
                        .doc(resp.comentarioId).get();
                        
                    if (!comentarioSnap.exists) {
                        console.log('❌ Comentario no encontrado:', resp.comentarioId);
                        return;
                    }
                    
                    const comentario = comentarioSnap.data();
                    console.log('📝 Comentario encontrado:', {
                        autor: comentario.usuario,
                        uid: comentario.uid,
                        texto: comentario.texto?.substring(0, 30) + '...'
                    });

                    // Verificar si debo mostrar notificación
                    const esmiComentario = comentario.uid === auth.currentUser.uid;
                    const soyelAutorRespuesta = resp.uid === auth.currentUser.uid;

                    console.log('🎯 Evaluando notificación:', {
                        esmiComentario,
                        soyelAutorRespuesta,
                        deberiaNotificar: esmiComentario && !soyelAutorRespuesta
                    });

                    if (esmiComentario && !soyelAutorRespuesta) {
                        console.log('🔔 ¡Enviando notificación para respuesta NUEVA!');
                        await enviarNotificacion(resp, comentario);
                    } else {
                        console.log('🚫 No enviar notificación:', {
                            razon: !esmiComentario ? 'No es mi comentario' : 'Soy el autor de la respuesta'
                        });
                    }
                    
                } catch (error) {
                    console.error('❌ Error procesando notificación:', error);
                }
            });
        }, error => {
            console.error('❌ Error en listener de respuestas:', error);
            
            // Reconexión automática después de error
            setTimeout(() => {
                if (auth && auth.currentUser) {
                    console.log('🔄 Reintentando configurar notificaciones...');
                    setupResponseNotifications();
                }
            }, 5000);
        });

    // Guardar referencia para limpiar después
    window.notificationsUnsubscribe = unsubscribe;
    console.log('✅ Listener configurado - Solo notificará respuestas POSTERIORES a este momento');
}

async function enviarNotificacion(respuesta, comentario) {
    try {
        console.log('📢 Preparando notificación:', {
            deAutor: respuesta.usuario,
            texto: respuesta.texto?.substring(0, 30) + '...'
        });

        // ✅ VERIFICAR PERMISOS JUSTO ANTES DE ENVIAR
        if (Notification.permission !== 'granted') {
            console.log('❌ Sin permisos para mostrar notificaciones');
            return;
        }

        // Preparar contenido de la notificación
        const textoCorto = respuesta.texto && respuesta.texto.length > 50
            ? respuesta.texto.slice(0, 47) + '...'
            : respuesta.texto || 'Nueva respuesta';

        const options = {
            body: `${respuesta.usuario || 'Alguien'} respondió: "${textoCorto}"`,
            icon: respuesta.avatar || '/Imagenes/Avatares/Avatar1.jpg',
            badge: '/Imagenes/Avatares/Avatar1.jpg',
            tag: `respuesta-${respuesta.comentarioId}-${Date.now()}`, // Tag único para evitar reemplazos
            requireInteraction: true, // ✅ MANTENER NOTIFICACIÓN HASTA QUE EL USUARIO INTERACTÚE
            silent: false, // Permitir sonido
            timestamp: Date.now(),
            data: {
                comentarioId: respuesta.comentarioId,
                respuestaId: respuesta.id || Date.now(),
                tipo: 'respuesta'
            }
        };

        console.log('🔔 Creando notificación PERSISTENTE con opciones:', options);

        // ✅ CREAR NOTIFICACIÓN
        const notification = new Notification('💬 Nueva respuesta a tu comentario', options);
        
        console.log('✅ Notificación creada exitosamente - PERSISTENTE');

        // Eventos de la notificación
        notification.onclick = function() {
            console.log('👆 Click en notificación');
            window.focus();
            
            // Buscar y hacer scroll al comentario
            const comentarioElement = document.querySelector(`[data-id="${respuesta.comentarioId}"]`);
            if (comentarioElement) {
                comentarioElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            
            notification.close();
        };

        notification.onerror = function(event) {
            console.error('❌ Error en notificación:', event);
        };

        notification.onshow = function() {
            console.log('👁️ Notificación mostrada - PERSISTENTE');
        };

        notification.onclose = function() {
            console.log('❌ Notificación cerrada por usuario');
        };

        // ✅ NO AUTO-CERRAR - La notificación permanece hasta que el usuario la cierre
        console.log('⚡ Notificación configurada para permanecer hasta interacción del usuario');

    } catch (error) {
        console.error('💥 Error al enviar notificación:', error);
    }
}

// ============================
// FUNCIONES DE PRUEBA
// ============================

// Función para probar notificaciones manualmente
window.probarNotificacion = function() {
    if (Notification.permission !== 'granted') {
        console.log('❌ Sin permisos para notificaciones');
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                crearNotificacionPrueba();
            }
        });
    } else {
        crearNotificacionPrueba();
    }
};

function crearNotificacionPrueba() {
    console.log('🧪 Creando notificación de prueba...');
    
    const notification = new Notification('🧪 Notificación de Prueba', {
        body: 'Si ves esto, las notificaciones funcionan correctamente',
        icon: '/Imagenes/Avatares/Avatar1.jpg',
        tag: 'prueba',
        requireInteraction: false
    });

    notification.onclick = () => {
        console.log('✅ Click en notificación de prueba detectado');
        notification.close();
    };

    setTimeout(() => notification.close(), 5000);
}

// Función para verificar estado de notificaciones
window.verificarNotificaciones = function() {
    console.log('=== 🔍 VERIFICACIÓN DE NOTIFICACIONES ===');
    console.log('Soporte del navegador:', 'Notification' in window);
    console.log('Permisos:', Notification.permission);
    console.log('Usuario autenticado:', !!auth?.currentUser);
    console.log('UID usuario:', auth?.currentUser?.uid || 'N/A');
    console.log('Listener activo:', !!window.notificationsUnsubscribe);
    
    if (Notification.permission === 'granted') {
        console.log('✅ Todo listo para notificaciones');
        console.log('💡 Puedes usar probarNotificacion() para hacer una prueba');
    } else {
        console.log('❌ Necesitas conceder permisos de notificación');
    }
};

// ============================
// INICIALIZACIÓN AUTOMÁTICA
// ============================

// Configurar notificaciones cuando el usuario se autentique
if (typeof auth !== 'undefined' && auth) {
    auth.onAuthStateChanged((user) => {
        if (user) {
            console.log('👤 Usuario autenticado, configurando notificaciones...');
            // Esperar un poco para asegurar que todo esté cargado
            setTimeout(() => {
                setupResponseNotifications();
            }, 1000);
        } else {
            console.log('👋 Usuario no autenticado, limpiando notificaciones...');
            if (window.notificationsUnsubscribe) {
                window.notificationsUnsubscribe();
                window.notificationsUnsubscribe = null;
            }
        }
    });
} else {
    console.log('⚠️ Auth no disponible todavía, configurando listener...');
    // Si auth no está disponible, intentar después
    setTimeout(() => {
        if (auth && auth.currentUser) {
            setupResponseNotifications();
        }
    }, 2000);
}
// Configurar listener de autenticación
auth.onAuthStateChanged(async (user) => {
    if (user) {
        console.log("✅ Usuario autenticado, cargando comentarios...");
            
            // Establecer currentUser
            window.currentUser = user.displayName || user.email || "Usuario";
            
            // Cargar comentarios
            await cargarComentarios();
            setupResponseNotifications();

            
        } else {
            console.log("❌ Usuario no autenticado");
            
            // Limpiar comentarios si no hay usuario
            const listaComentarios = document.getElementById("lista_comentarios");
            if (listaComentarios) {
                listaComentarios.innerHTML = '<div class="sin-auth">Debes iniciar sesión para ver los comentarios</div>';
            }
        }
    });
}
document.addEventListener('DOMContentLoaded', function() {
    // ... otras inicializaciones ...
    // Después de asegurarnos de que el carrusel exista:
    const carruselWrapper = document.querySelector(".carrusel-contenedor");
    const btnIzq = document.querySelector(".flecha-carrusel.izquierda");
    const btnDer = document.querySelector(".flecha-carrusel.derecha");
    if (carruselWrapper && btnIzq && btnDer) {
        btnIzq.addEventListener('click', () => {
            carruselWrapper.scrollBy({ left: -carruselWrapper.clientWidth, behavior: 'smooth' });
        });
        btnDer.addEventListener('click', () => {
            carruselWrapper.scrollBy({ left: carruselWrapper.clientWidth, behavior: 'smooth' });
        });
    }
    // Inicializar sistema de perfiles
    console.log("🚀 Inicializando sistema de perfiles...");

    // Exponer funciones globalmente
    window.manejarClickAvatar = manejarClickAvatar;
    window.irAPerfilPublico = irAPerfilPublico;
    window.irAMiPerfil = irAMiPerfil;

    console.log("✅ Sistema de perfiles inicializado");
    
});
// 3. MODIFICAR cargarComentarios para mejor manejo de errores
async function cargarComentarios() {
    if (!db) {
        console.error("Firestore no disponible");
        return;
    }
    
    try {
        const listaComentarios = document.getElementById("lista_comentarios");
        if (!listaComentarios) {
            console.error("Elemento lista_comentarios no encontrado");
            return;
        }
        
        console.log("🔄 Cargando comentarios desde Firestore...");
        
        // Mostrar indicador de carga
        listaComentarios.innerHTML = '<div class="cargando">⏳ Cargando comentarios...</div>';
        
        // Obtener comentarios ACTIVOS ordenados por fecha
        const snapshot = await db.collection('comentarios')
            .where('activo', '==', true)
            .orderBy('timestamp', 'desc')
            .get();
        
        // Limpiar indicador de carga
        listaComentarios.innerHTML = "";
        
        if (snapshot.empty) {
            listaComentarios.innerHTML = '<div class="sin-comentarios">📝 No hay comentarios aún. ¡Sé el primero en comentar!</div>';
            console.log("No se encontraron comentarios en la base de datos");
            return;
        }
        
        console.log(`📊 Encontrados ${snapshot.docs.length} comentarios en la base de datos`);
        
        // Crear elementos para cada comentario
        let comentariosCargados = 0;
        for (const doc of snapshot.docs) {
            const comentario = { id: doc.id, ...doc.data() };
            
            try {
                const elementoComentario = await crearElementoEntrada(comentario, "comentario", 0);
                listaComentarios.appendChild(elementoComentario);
                comentariosCargados++;
                
                console.log(`✅ Comentario cargado: ${comentario.id} - "${comentario.texto?.substring(0, 30)}..."`);
                
            } catch (error) {
                console.error(`❌ Error al crear elemento para comentario ${doc.id}:`, error);
            }
        }
        
        console.log(`🎉 ${comentariosCargados} comentarios cargados exitosamente en la interfaz`);
        
    } catch (error) {
        console.error("💥 Error al cargar comentarios:", error);
        
        const listaComentarios = document.getElementById("lista_comentarios");
        if (listaComentarios) {
            listaComentarios.innerHTML = `
                <div class="error-carga">
                    ⚠️ Error al cargar comentarios: ${error.message}
                    <br>
                    <button onclick="cargarComentarios()" style="margin-top: 10px;">🔄 Reintentar</button>
                </div>
            `;
        }
        
        // Mostrar error específico según el tipo
        if (error.code === 'permission-denied') {
            console.error("🚫 Error de permisos - Verifica las reglas de Firestore");
            mostrarVentanaEmergente("Error de permisos. Verifica las reglas de Firestore.");
        } else if (error.code === 'unavailable') {
            console.error("🌐 Error de conexión - Verifica tu conexión a internet");
            mostrarVentanaEmergente("Error de conexión. Verifica tu conexión a internet.");
        }
    }
}

// 4. MODIFICAR la inicialización para ser más clara
document.addEventListener('DOMContentLoaded', function () {
    console.log("🚀 DOM cargado - Iniciando aplicación de comentarios");
    
    // 1. Configurar sistema de verificación (esto también cargará comentarios)
    configurarSistemaVerificacion();
    
    // 2. Agregar función de debugging disponible globalmente
    window.cargarComentarios = cargarComentarios;
    window.verificarComentarios = () => {
        console.log("=== VERIFICACIÓN DE COMENTARIOS ===");
        console.log("Auth disponible:", !!auth);
        console.log("DB disponible:", !!db);
        console.log("Usuario actual:", auth?.currentUser?.email || "No autenticado");
        console.log("Elemento lista_comentarios:", !!document.getElementById("lista_comentarios"));
        
        if (auth?.currentUser) {
            console.log("🔄 Intentando cargar comentarios...");
            cargarComentarios();
        } else {
            console.log("❌ No se puede cargar comentarios sin autenticación");
        }
    };
    
    console.log("✅ Aplicación de comentarios iniciada");
});

// 5. AGREGAR función para debugging manual
function mostrarEstadoFirestore() {
    console.log("=== ESTADO DE FIRESTORE ===");
    
    if (!db) {
        console.log("❌ DB no disponible");
        return;
    }
    
    // Verificar conexión a Firestore
    db.collection('comentarios').limit(1).get()
        .then(snapshot => {
            console.log("✅ Conexión a Firestore exitosa");
            console.log("Documentos disponibles:", snapshot.size);
            
            if (snapshot.size > 0) {
                const doc = snapshot.docs[0];
                console.log("Ejemplo de documento:", doc.id, doc.data());
            }
        })
        .catch(error => {
            console.log("❌ Error de conexión a Firestore:", error);
        });
}

// Hacer función disponible globalmente
window.mostrarEstadoFirestore = mostrarEstadoFirestore;


// SISTEMA DE AVATAR CON FIREBASE - PARTE CAMILO
// Configuración de avatares predefinidos
const AVATARES_PREDEFINIDOS = {
    default: '/Imagenes/Avatares/Avatar1.jpg', // Cambia por tu ruta
};
// ====== SISTEMA DE REINTENTOS PARA AVATARES ======
// Agregar este código DESPUÉS de la definición de AVATARES_PREDEFINIDOS

/**
 * Función para cargar avatar con reintentos automáticos
 * @param {HTMLImageElement} imgElement - Elemento de imagen
 * @param {string} avatarUrl - URL del avatar
 * @param {number} maxReintentos - Número máximo de reintentos (default: 3)
 * @param {number} delayMs - Delay entre reintentos en ms (default: 1000)
 */
function cargarAvatarConReintentos(imgElement, avatarUrl, maxReintentos = 3, delayMs = 1000) {
    let intentos = 0;
    
    function intentarCarga() {
        intentos++;
        
        // Limpiar eventos previos
        imgElement.onerror = null;
        imgElement.onload = null;
        
        // Configurar evento de éxito
        imgElement.onload = function() {
            console.log(`✅ Avatar cargado exitosamente: ${avatarUrl}`);
        };
        
        // Configurar evento de error con reintentos
        imgElement.onerror = function() {
            console.warn(`❌ Error cargando avatar (intento ${intentos}/${maxReintentos}): ${avatarUrl}`);
            
            if (intentos < maxReintentos) {
                // Esperar y reintentar
                setTimeout(() => {
                    console.log(`🔄 Reintentando carga de avatar: ${avatarUrl}`);
                    intentarCarga();
                }, delayMs * intentos); // Delay progresivo
            } else {
                // ✅ MANTENER LA URL ORIGINAL, solo limpiar cache-busting
                console.log(`🔄 Último intento con URL limpia: ${avatarUrl}`);
                const urlLimpia = avatarUrl.split('?')[0]; // Quitar parámetros
                imgElement.src = urlLimpia;
                
                // Si sigue fallando, usar default como último recurso
                imgElement.onerror = function() {
                    console.log(`❌ Avatar definitivamente no disponible, usando default: ${avatarUrl}`);
                    imgElement.src = AVATARES_PREDEFINIDOS.default;
                };
            }
        };
        
        // Iniciar carga con parámetro de cache-busting
        const timestamp = Date.now();
        const separator = avatarUrl.includes('?') ? '&' : '?';
        imgElement.src = `${avatarUrl}${separator}t=${timestamp}`;
    }
    
    // Iniciar primer intento
    intentarCarga();
}

/**
 * Función para aplicar avatar de forma segura
 * @param {HTMLImageElement} imgElement - Elemento de imagen
 * @param {string} avatarUrl - URL del avatar
 * @param {string} altText - Texto alternativo
 */
function aplicarAvatarSeguro(imgElement, avatarUrl, altText = "Avatar de usuario") {
    if (!imgElement) {
        console.warn("❌ Elemento de imagen no encontrado");
        return;
    }
    
    // Configurar propiedades básicas
    imgElement.alt = altText;
    imgElement.style.objectFit = "cover";
    
    // Usar URL válida o default
const urlFinal = verificarYCorregirAvatar(avatarUrl);
    
    // Aplicar carga con reintentos
    cargarAvatarConReintentos(imgElement, urlFinal);
}

// ====== FUNCIÓN PARA RECARGAR AVATARES FALLIDOS ======
function recargarAvataresFallidos() {
    console.log("🔄 Recargando avatares fallidos...");
    
    // Buscar todas las imágenes de avatar
    const avatares = document.querySelectorAll('.avatar, .avatar-comentario, img[src*="Avatar"]');
    
    avatares.forEach((img, index) => {
        // Verificar si la imagen no se cargó correctamente
        if (img.naturalWidth === 0 && img.naturalHeight === 0 && img.complete) {
            console.log(`🔄 Recargando avatar fallido: ${img.src}`);
            
            // Aplicar un pequeño delay para evitar sobrecarga
            setTimeout(() => {
                cargarAvatarConReintentos(img, img.src);
            }, index * 100); // 100ms entre cada recarga
        }
    });
}

// ====== FUNCIÓN MEJORADA PARA PRECARGAR AVATARES ======
function precargarAvatares() {
    console.log("🚀 Precargando avatares...");
    
    // Lista de avatares comunes para precargar
    const avataresToPreload = [];
    
    // Agregar avatares predefinidos
    for (let i = 1; i <= 30; i++) {
        avataresToPreload.push(`/Imagenes/Avatares/Avatar${i}.jpg`);
    }
    
    // Precargar con delay para evitar sobrecarga
    avataresToPreload.forEach((avatarUrl, index) => {
        setTimeout(() => {
            const img = new Image();
            img.onload = () => console.log(`✅ Avatar precargado: Avatar${index + 1}.jpg`);
            img.onerror = () => console.warn(`❌ Error precargando: Avatar${index + 1}.jpg`);
            img.src = avatarUrl;
        }, index * 50); // 50ms entre cada precarga
    });
}

// ====== AUTO-RECARGA PERIÓDICA ======
let intervalRecarga;

function iniciarAutoRecarga(intervalMs = 30000) {
    console.log("⏰ Iniciando auto-recarga de avatares cada", intervalMs / 1000, "segundos");
    
    if (intervalRecarga) {
        clearInterval(intervalRecarga);
    }
    
    intervalRecarga = setInterval(() => {
        recargarAvataresFallidos();
    }, intervalMs);
}

function detenerAutoRecarga() {
    if (intervalRecarga) {
        clearInterval(intervalRecarga);
        intervalRecarga = null;
        console.log("⏹️ Auto-recarga de avatares detenida");
    }
}

// ====== INICIALIZACIÓN AUTOMÁTICA ======
document.addEventListener("DOMContentLoaded", function() {
    console.log("🎯 Inicializando sistema de avatares mejorado...");
    
    // Precargar avatares después de 2 segundos
    setTimeout(() => {
        precargarAvatares();
    }, 2000);
    
    // Iniciar auto-recarga después de 5 segundos
    setTimeout(() => {
        iniciarAutoRecarga();
    }, 5000);
    
    // Recargar avatares fallidos después de 3 segundos
    setTimeout(() => {
        recargarAvataresFallidos();
    }, 3000);
});

// ====== EXPONER FUNCIONES GLOBALMENTE ======
window.cargarAvatarConReintentos = cargarAvatarConReintentos;
window.aplicarAvatarSeguro = aplicarAvatarSeguro;
window.recargarAvataresFallidos = recargarAvataresFallidos;
window.precargarAvatares = precargarAvatares;
window.iniciarAutoRecarga = iniciarAutoRecarga;
window.detenerAutoRecarga = detenerAutoRecarga;
// ====== FUNCIÓN PARA VERIFICAR Y CORREGIR AVATARES ======
function verificarYCorregirAvatar(avatarUrl) {
    // Si ya es el avatar por defecto, devolverlo
    if (avatarUrl === AVATARES_PREDEFINIDOS.default) {
        return avatarUrl;
    }
    
    // Si la URL contiene "Avatar" pero no es válida, intentar corregirla
    if (avatarUrl && avatarUrl.includes('Avatar')) {
        // Extraer número del avatar
        const match = avatarUrl.match(/Avatar(\d+)/);
        if (match && match[1]) {
            const numeroAvatar = match[1];
            // Reconstruir la URL correcta
            const urlCorregida = `/Imagenes/Avatares/Avatar${numeroAvatar}.jpg`;
            console.log(`🔧 URL corregida: ${avatarUrl} → ${urlCorregida}`);
            return urlCorregida;
        }
    }
    
    return avatarUrl || AVATARES_PREDEFINIDOS.default;
}

// MODO OSCURO 
document.addEventListener("DOMContentLoaded", function () {
    const body = document.body;
    const themeStatus = document.getElementById("theme-status");
    const toggleThemeBtn = document.getElementById("toggle-theme");

    function toggleDarkMode() {
        body.classList.toggle("dark-mode");
        const isDarkMode = body.classList.contains("dark-mode");
        localStorage.setItem("theme", isDarkMode ? "dark" : "light");
    guardarTemaEnFirebase(isDarkMode);

        if (themeStatus) {
            themeStatus.textContent = isDarkMode ? "Oscuro" : "Claro";
        }
    }

// Escuchar cambios de autenticación para cargar tema
  firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            // Usuario autenticado: cargar tema desde Firebase
            cargarTemaDesdeFirebase();
        } else {
            // Usuario no autenticado: usar localStorage
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
        }
    });

    if (toggleThemeBtn) {
        toggleThemeBtn.addEventListener("click", toggleDarkMode);
    }
});
// NUEVA FUNCIÓN: Cargar tema desde Firebase
async function cargarTemaDesdeFirebase() {
    const user = firebase.auth().currentUser;
    if (!user) return;

    try {
        const userDoc = await db.collection('usuarios').doc(user.uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            const temaOscuro = userData.configuracion?.temaOscuro || false;
            
            // Aplicar el tema desde Firebase
            if (temaOscuro) {
                body.classList.add("dark-mode");
                localStorage.setItem("theme", "dark");
                if (themeStatus) {
                    themeStatus.textContent = "Oscuro";
                }
            } else {
                body.classList.remove("dark-mode");
                localStorage.setItem("theme", "light");
                if (themeStatus) {
                    themeStatus.textContent = "Claro";
                }
            }
            
            console.log("Tema cargado desde Firebase:", temaOscuro ? "Oscuro" : "Claro");
        }
    } catch (error) {
        console.error("Error al cargar tema desde Firebase:", error);
    }
}

// FUNCIÓN ACTUALIZADA: Guardar tema en Firebase
async function guardarTemaEnFirebase(temaOscuro) {
    const user = firebase.auth().currentUser;
    if (!user) return;

    try {
        await db.collection('usuarios').doc(user.uid).update({
            'configuracion.temaOscuro': temaOscuro,
            'estadisticas.ultimaActividad': firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log("Tema guardado en Firebase:", temaOscuro ? "Oscuro" : "Claro");
    } catch (error) {
        console.error("Error al guardar tema en Firebase:", error);
    }
}
// SISTEMA DE AVATAR CON FIREBASE - OPTIMIZADO Y CON NOMBRE DE USUARIO
class AvatarManager {
    constructor() {
        this.currentUser = null;
        this.avatarElements = {
            navbar: document.getElementById("avatarSeleccionado"),
            profile: document.getElementById("profileAvatarDisplay")
        };
        this.init();
    }

    init() {
        firebase.auth().onAuthStateChanged((user) => {
            this.currentUser = user;
            if (user) {
                this.cargarAvatarUsuario();
                this.cargarNombreUsuario(); // NUEVA LÍNEA AGREGADA
                this.setupEventListeners();
            }
        });
    }

    async cargarAvatarUsuario() {
        if (!this.currentUser) return;

        try {
            const userDoc = await db.collection('usuarios').doc(this.currentUser.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                const avatarUrl = userData.perfil?.avatar || AVATARES_PREDEFINIDOS.default;
                this.actualizarAvatarDOM(avatarUrl);
                
                if (!userData.perfil?.avatar) {
                    await this.guardarAvatarEnFirestore(AVATARES_PREDEFINIDOS.default);
                }
            }
        } catch (error) {
            console.error("Error al cargar avatar del usuario:", error);
            this.actualizarAvatarDOM(AVATARES_PREDEFINIDOS.default);
        }
    }

    // NUEVO MÉTODO AGREGADO
    async cargarNombreUsuario() {
        if (!this.currentUser) return;

        try {
            const userDoc = await db.collection('usuarios').doc(this.currentUser.uid).get();
            const possibleElements = [
                document.querySelector('.profile-username'),
                document.getElementById('profile-username'),
                document.getElementById('nombre-usuario'),
                document.querySelector('[data-username]'),
                document.querySelector('.username-display')
            ];

            if (userDoc.exists) {
                const userData = userDoc.data();
                const displayName = userData.nombre || this.currentUser.displayName || this.currentUser.email.split('@')[0];
                
                console.log("Nombre a mostrar:", displayName);
                
                possibleElements.forEach(element => {
                    if (element) {
                        element.textContent = displayName;
                        console.log("Nombre actualizado en elemento:", element);
                    }
                });
            } else {
                // Si no existe el documento, usar displayName o email
                const fallbackName = this.currentUser.displayName || this.currentUser.email.split('@')[0];
                
                possibleElements.forEach(element => {
                    if (element) {
                        element.textContent = fallbackName;
                    }
                });
            }
        } catch (error) {
            console.error("Error al cargar nombre del usuario:", error);
            
            // Fallback: usar al menos el email
            const fallbackName = this.currentUser.email ? this.currentUser.email.split('@')[0] : 'Usuario';
            const possibleElements = [
                document.querySelector('.profile-username'),
                document.getElementById('profile-username'),
                document.getElementById('nombre-usuario')
            ];
            
            possibleElements.forEach(element => {
                if (element) {
                    element.textContent = fallbackName;
                }
            });
        }
    }

   actualizarAvatarDOM(avatarUrl) {
    Object.values(this.avatarElements).forEach(element => {
        if (element) {
            aplicarAvatarSeguro(element, avatarUrl, "Avatar del usuario");
        }
    });
}

    async guardarAvatarEnFirestore(avatarUrl) {
        if (!this.currentUser) return false;

        try {
            await db.collection('usuarios').doc(this.currentUser.uid).update({
                'perfil.avatar': avatarUrl,
                'estadisticas.ultimaActividad': firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log("Avatar guardado exitosamente en Firestore");
            return true;
        } catch (error) {
            console.error("Error al guardar avatar:", error);
            return false;
        }
    }

    async cambiarAvatar(nuevaUrl) {
        this.actualizarAvatarDOM(nuevaUrl);
        const exito = await this.guardarAvatarEnFirestore(nuevaUrl);
        
        if (!exito) {
            this.cargarAvatarUsuario();
            alert("Error al cambiar avatar. Inténtalo de nuevo.");
        }
        return exito;
    }

    setupEventListeners() {}
}

class ProfileMenu {
    constructor(avatarManager) {
        this.avatarManager = avatarManager;
        this.profileMenu = document.getElementById("profileMenu");
        this.btnAbrirModal = document.getElementById("abrirModalAvatar");
        this.btnCerrarProfile = document.getElementById("cerrarProfile");
        this.profileUsername = document.querySelector('.profile-username');
        this.init();
        
        // NUEVA LÍNEA: Llamar inmediatamente si ya hay un usuario autenticado
        if (firebase.auth().currentUser) {
            this.cargarDatosUsuario();
        }
    }

    init() {
        this.setupEventListeners();
        this.cargarDatosUsuario();
    }

    // MÉTODO ACTUALIZADO COMPLETAMENTE
    async cargarDatosUsuario() {
        const user = firebase.auth().currentUser;
        if (!user) return;

        try {
            // Buscar múltiples posibles elementos donde mostrar el nombre
            const possibleElements = [
                document.querySelector('.profile-username'),
                document.getElementById('profile-username'),
                document.getElementById('nombre-usuario'),
                document.querySelector('[data-username]'),
                document.querySelector('.username-display')
            ];

            const userDoc = await db.collection('usuarios').doc(user.uid).get();
            
            if (userDoc.exists) {
                const userData = userDoc.data();
                // Prioridad: nombre de Firestore > displayName > email
                const displayName = userData.nombre || user.displayName || user.email.split('@')[0];
                
                console.log("Nombre a mostrar:", displayName);
                
                // Actualizar todos los elementos encontrados
                possibleElements.forEach(element => {
                    if (element) {
                        element.textContent = displayName;
                        console.log("Nombre actualizado en elemento:", element);
                    }
                });
            } else {
                // Si no existe el documento, usar displayName o email
                const fallbackName = user.displayName || user.email.split('@')[0];
                
                possibleElements.forEach(element => {
                    if (element) {
                        element.textContent = fallbackName;
                    }
                });
            }
        } catch (error) {
            console.error("Error al cargar datos del usuario:", error);
            
            // Fallback: usar al menos el email
            const fallbackName = user.email ? user.email.split('@')[0] : 'Usuario';
            const possibleElements = [
                document.querySelector('.profile-username'),
                document.getElementById('profile-username'),
                document.getElementById('nombre-usuario')
            ];
            
            possibleElements.forEach(element => {
                if (element) {
                    element.textContent = fallbackName;
                }
            });
        }
    }

    setupEventListeners() {
        if (this.btnAbrirModal) {
            this.btnAbrirModal.addEventListener("click", (e) => {
                e.preventDefault();
                this.profileMenu.style.display = "flex";
            });
        }

        if (this.btnCerrarProfile) {
            this.btnCerrarProfile.addEventListener("click", () => {
                this.profileMenu.style.display = "none";
            });
        }

        const navegarA = (selector, url) => {
            const btn = document.getElementById(selector);
            if (btn) {
                btn.addEventListener("click", (e) => {
                    e.preventDefault();
                    this.profileMenu.style.display = "none";
                    window.location.href = url;
                });
            }
        };

        navegarA("btnMiPerfil", "/contenido_de_la_pagina/Mi_perfil/Mi_perfil.html");
        navegarA("btnConfiguracion", "/contenido_de_la_pagina/Ajustes/Configuracion.html");

        const btnCerrarSesion = document.getElementById("btnCerrarSesion");
        if (btnCerrarSesion) {
            btnCerrarSesion.addEventListener("click", (e) => {
                e.preventDefault();
                this.cerrarSesion();
            });
        }

        window.addEventListener("click", (e) => {
            if (e.target === this.profileMenu) {
                this.profileMenu.style.display = "none";
            }
        });

        const profileMenuContenido = document.querySelector(".profile-menu-contenido");
        if (profileMenuContenido) {
            profileMenuContenido.addEventListener("click", (e) => e.stopPropagation());
        }

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && this.profileMenu.style.display === "flex") {
                this.profileMenu.style.display = "none";
            }
        });
    }

    async cerrarSesion() {
        if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
            try {
                await firebase.auth().signOut();
                console.log("Sesión cerrada correctamente");
                const theme = localStorage.getItem("theme");
                localStorage.clear();
                if (theme) localStorage.setItem("theme", theme);
                sessionStorage.clear();
                window.location.href = "/contenido_de_la_pagina/Inicio_de_sesion/Inicio_de_sesion.html";
            } catch (error) {
                console.error("Error al cerrar sesión:", error);
                alert("Error al cerrar sesión. Por favor, inténtalo de nuevo.");
            }
        }
        this.profileMenu.style.display = "none";
    }
}

class AvatarModal {
    constructor(avatarManager) {
        this.avatarManager = avatarManager;
        this.modalAvatar = document.getElementById("modalAvatar");
        this.btnCambiarAvatar = document.getElementById("btnCambiarAvatar");
        this.btnCerrarModal = document.getElementById("cerrarModalAvatar");
        this.avatarOpciones = document.querySelectorAll(".avatar-img");
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        if (this.btnCambiarAvatar) {
            this.btnCambiarAvatar.addEventListener("click", (e) => {
                e.preventDefault();
                this.modalAvatar.style.display = "block";
            });
        }

        if (this.btnCerrarModal) {
            this.btnCerrarModal.addEventListener("click", () => {
                this.modalAvatar.style.display = "none";
            });
        }

        this.avatarOpciones.forEach(avatar => {
            avatar.addEventListener("click", async () => {
                avatar.style.opacity = "0.5";
                const exito = await this.avatarManager.cambiarAvatar(avatar.src);
                avatar.style.opacity = "1";
                
                if (exito) this.modalAvatar.style.display = "none";
            });
        });

        window.addEventListener("click", (e) => {
            if (e.target === this.modalAvatar) {
                this.modalAvatar.style.display = "none";
            }
        });
    }
}

document.addEventListener("DOMContentLoaded", function () {
    const avatarManager = new AvatarManager();
    const profileMenu = new ProfileMenu(avatarManager);
    const avatarModal = new AvatarModal(avatarManager);
    
    window.avatarSystem = { avatarManager, profileMenu, avatarModal };
});
async function eliminarComentario(comentarioId) {
    if (!db || !auth.currentUser) return;

    try {
        const comentarioRef = db.collection('comentarios').doc(comentarioId);
        const doc = await comentarioRef.get();

        if (!doc.exists) {
            mostrarVentanaEmergente("El comentario ya no existe.");
            return;
        }

        const data = doc.data();
        if (data.uid !== auth.currentUser.uid) {
            mostrarVentanaEmergente("No tienes permiso para eliminar este comentario.");
            return;
        }

        // 🔥 Eliminar el comentario
        await comentarioRef.delete();

        // 🔥 Eliminar todas sus respuestas asociadas
        const respuestasSnapshot = await db.collection('respuestas')
            .where('comentarioId', '==', comentarioId)
            .get();

        const batch = db.batch();
        respuestasSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();

        console.log("Comentario y respuestas eliminados de Firestore.");
    } catch (error) {
        console.error("Error al eliminar comentario:", error);
        mostrarVentanaEmergente("Error al eliminar el comentario.");
    }
}

    //  NUEVAS FUNCIONES PARA EL SISTEMA DE PERFILES

    // Función para ir a perfil público
    // Función para ir a perfil público (actualizada para tu estructura)
    function irAPerfilPublico(uid, nombreUsuario = null) {
        if (!uid) {
            console.error("❌ UID requerido para ir al perfil público");
            mostrarVentanaEmergente("Error: Usuario no válido");
            return;
        }
        
        // ✨ RUTA ACTUALIZADA para tu estructura:
        let url = `/contenido_de_la_pagina/Perfil_publico/Perfil_publico.html?uid=${uid}`;
        
        if (nombreUsuario) {
            url += `&user=${encodeURIComponent(nombreUsuario)}`;
        }
        
        console.log("🔗 Navegando a:", url);
        window.location.href = url;
    }

    // Función para ir a Mi Perfil (actualizada)
    function irAMiPerfil() {
        console.log("👤 Navegando a Mi Perfil");
        window.location.href = "/contenido_de_la_pagina/Mi_perfil/Mi_perfil.html";
    }

    // Función para verificar si es el usuario actual
    function esUsuarioActual(uid) {
        return auth && auth.currentUser && auth.currentUser.uid === uid;
    }

    // Función de debugging
    function debugSistemaPerfiles() {
        console.log("=== 🔍 DEBUG SISTEMA DE PERFILES ===");
        console.log("Usuario actual:", auth?.currentUser?.uid || "No autenticado");
        console.log("Elementos con avatares:", document.querySelectorAll('.avatar-comentario').length);
        console.log("Comentarios con UID:", document.querySelectorAll('[data-uid]').length);
        console.log("Elementos .comentario:", document.querySelectorAll('.comentario').length);
        console.log("Elementos .respuesta:", document.querySelectorAll('.respuesta').length);
    }
    // ====== FUNCIÓN PARA MANEJAR CLICKS EN AVATARES ======
    function manejarClickAvatar(userData) {
        console.log("🎯 Click en avatar:", userData);
        
        // Si es el usuario actual, ir a Mi Perfil
        if (auth && auth.currentUser && userData.uid === auth.currentUser.uid) {
            console.log("👤 Redirigiendo a Mi Perfil");
            window.location.href = "/contenido_de_la_pagina/Mi_perfil/Mi_perfil.html";
            return;
        }
        
        // Si es otro usuario, ir al perfil público
        const perfilUrl = `/contenido_de_la_pagina/Perfil_publico/Perfil_publico.html?uid=${userData.uid}&user=${encodeURIComponent(userData.usuario || userData.nombre)}`;
        console.log("🔗 Redirigiendo a perfil público:", perfilUrl);
        window.location.href = perfilUrl;
    }

    // Hacer función disponible globalmente para debugging
    window.debugSistemaPerfiles = debugSistemaPerfiles;

function limpiarCacheAvatares() {
    avatarCache.clear();
    console.log("Cache de avatares limpiado");
}
// ===========================
// SISTEMA DE BÚSQUEDA DE COMENTARIOS CORREGIDO
// ===========================

let todosLosComentarios = []; // Cache de todos los comentarios cargados
let comentariosFiltrados = []; // Comentarios que coinciden con la búsqueda
let todosLosUsuarios = []; // Cache de usuarios para búsqueda

// ===========================
// INICIALIZACIÓN DE BÚSQUEDA
// ===========================
function inicializarBusquedaComentarios() {
    const searchInput = document.getElementById('search-comentarios');
    if (!searchInput) {
        console.log("Campo de búsqueda no encontrado, creando...");
        crearCampoBusqueda();
        return;
    }

    // Búsqueda en tiempo real con debounce
    let timeoutId;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(timeoutId);
        const query = e.target.value.trim();
        
        // Debounce para evitar búsquedas excesivas
        timeoutId = setTimeout(() => {
            if (query.length > 0) {
                buscarComentarios(query);
            } else {
                mostrarTodosLosComentarios();
            }
        }, 300);
    });

    // Limpiar búsqueda al presionar Escape
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.target.value = '';
            mostrarTodosLosComentarios();
        }
    });

    console.log("✅ Sistema de búsqueda de comentarios inicializado");
}

// ===========================
// CREAR CAMPO DE BÚSQUEDA CON ESTILOS
// ===========================
function crearCampoBusqueda() {
    const cajaComentarios = document.querySelector('.caja_comentarios');
    if (!cajaComentarios) return;

    // Crear estilos CSS si no existen
    if (!document.getElementById('search-styles')) {
        const styles = document.createElement('style');
        styles.id = 'search-styles';
        styles.textContent = `
            .search-comentarios-container {
                margin-bottom: 15px;
                width: 100%;
            }
            
            .search-input-wrapper {
                position: relative;
                display: flex;
                align-items: center;
                background: #ffffff;
                border: 2px solid #e1e5e9;
                border-radius: 25px;
                padding: 12px 20px;
                transition: all 0.3s ease;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            
            .search-input-wrapper:focus-within {
                border-color: #4285f4;
                box-shadow: 0 0 0 3px rgba(66, 133, 244, 0.1);
                transform: translateY(-1px);
            }
            
            .search-icon {
                color: #5f6368;
                margin-right: 12px;
                font-size: 18px;
                transition: color 0.3s ease;
            }
            
            .search-input-wrapper:focus-within .search-icon {
                color: #4285f4;
            }
            
            .search-comentarios-input {
                flex: 1;
                border: none;
                background: transparent;
                outline: none;
                padding: 10px 0;
                font-size: 16px;
                color: #202124;
                font-weight: 400;
            }
            
            .search-comentarios-input::placeholder {
                color: #5f6368;
                font-weight: 400;
            }
            
            .search-results-info {
                margin: 15px 0;
                padding: 15px 20px;
                background: linear-gradient(135deg, #e8f0fe 0%, #f8f9ff 100%);
                border-radius: 12px;
                border-left: 4px solid #4285f4;
                box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            }
            
            .results-summary {
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 12px;
            }
            
            .results-count {
                color: #1a73e8;
                font-weight: 500;
                font-size: 15px;
            }
            
            .btn-clear-search-comentarios {
                background: linear-gradient(135deg, #ea4335 0%, #d33b2c 100%);
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 20px;
                cursor: pointer;
                font-size: 13px;
                font-weight: 500;
                transition: all 0.2s ease;
                box-shadow: 0 2px 4px rgba(234, 67, 53, 0.3);
            }
            
            .btn-clear-search-comentarios:hover {
                background: linear-gradient(135deg, #d33b2c 0%, #b52d20 100%);
                transform: translateY(-1px);
                box-shadow: 0 4px 8px rgba(234, 67, 53, 0.4);
            }
            
            .no-results-comentarios {
                text-align: center;
                padding: 40px 20px;
                color: #5f6368;
            }
            
            .no-results-comentarios h3 {
                margin-bottom: 12px;
                color: #5f6368;
                font-weight: 400;
            }
            
            .search-highlight-comentarios {
                background: linear-gradient(135deg, #fff59d 0%, #ffeb3b 100%);
                color: #1a1a1a;
                padding: 2px 6px;
                border-radius: 4px;
                font-weight: 600;
                box-shadow: 0 1px 3px rgba(255, 235, 59, 0.4);
            }
            
            .separador-respuestas {
                margin: 20px 0;
                padding: 15px;
                background: #f1f3f4;
                border-radius: 8px;
                border-left: 4px solid #4caf50;
            }
            
            .separador-respuestas h3 {
                margin: 0;
                color: #2e7d32;
                font-size: 16px;
            }
            
            .respuesta-con-contexto {
                margin-bottom: 15px;
                border: 1px solid #e0e0e0;
                border-radius: 8px;
                overflow: hidden;
            }
            
            .contexto-padre {
                background: #f5f5f5;
                padding: 8px 15px;
                border-bottom: 1px solid #e0e0e0;
            }
            
            .contexto-padre small {
                color: #666;
                font-style: italic;
            }
            
            /* Modo oscuro */
            body.dark-mode .search-input-wrapper {
                background: #1f2937;
                border-color: #374151;
            }
            
            body.dark-mode .search-input-wrapper:focus-within {
                border-color: #60a5fa;
                box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.1);
            }
            
            body.dark-mode .search-icon {
                color: #9ca3af;
            }
            
            body.dark-mode .search-input-wrapper:focus-within .search-icon {
                color: #60a5fa;
            }
            
            body.dark-mode .search-comentarios-input {
                color: #f9fafb;
            }
            
            body.dark-mode .search-comentarios-input::placeholder {
                color: #9ca3af;
            }
            
            body.dark-mode .search-results-info {
                background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
                border-left-color: #60a5fa;
            }
            
            body.dark-mode .results-count {
                color: #93c5fd;
            }
            
            body.dark-mode .btn-clear-search-comentarios {
                background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
                box-shadow: 0 2px 4px rgba(220, 38, 38, 0.3);
            }
            
            body.dark-mode .btn-clear-search-comentarios:hover {
                background: linear-gradient(135deg, #b91c1c 0%, #991b1b 100%);
                box-shadow: 0 4px 8px rgba(220, 38, 38, 0.4);
            }
            
            body.dark-mode .no-results-comentarios {
                color: #9ca3af;
            }
            
            body.dark-mode .no-results-comentarios h3 {
                color: #9ca3af;
            }
            
            body.dark-mode .search-highlight-comentarios {
                background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
                color: #1f2937;
                box-shadow: 0 1px 3px rgba(251, 191, 36, 0.4);
            }
        `;
        document.head.appendChild(styles);
    }

    // Crear contenedor de búsqueda
    const searchContainer = document.createElement('div');
    searchContainer.className = 'search-comentarios-container';
    searchContainer.innerHTML = `
        <div class="search-input-wrapper">
            <i class="fas fa-search search-icon"></i>
            <input 
                type="text" 
                id="search-comentarios" 
                placeholder="Buscar comentarios o usuarios..." 
                class="search-comentarios-input"
            >
        </div>
        <div id="search-results-info" class="search-results-info" style="display: none;"></div>
    `;

    // Insertar antes del textarea
    const textarea = cajaComentarios.querySelector('textarea');
    cajaComentarios.insertBefore(searchContainer, textarea);

    // Configurar eventos después de crear
    setTimeout(() => {
        inicializarBusquedaComentarios();
    }, 100);
}

// ===========================
// CONFIGURAR BOTÓN LIMPIAR - REMOVIDO
// ===========================
// Ya no necesitamos esta función

// ===========================
// CARGAR COMENTARIOS CON CACHE
// ===========================
async function cargarComentariosConCache() {
    if (!db) {
        console.error("Firestore no disponible");
        return;
    }

    try {
        console.log("🔄 Cargando comentarios para búsqueda...");
        
        // Cargar comentarios
        const comentariosSnapshot = await db.collection('comentarios')
            .where('activo', '==', true)
            .orderBy('timestamp', 'desc')
            .get();

        // Cargar respuestas
        const respuestasSnapshot = await db.collection('respuestas')
            .where('activo', '==', true)
            .orderBy('timestamp', 'asc')
            .get();

        // Procesar comentarios
        const comentarios = comentariosSnapshot.docs.map(doc => ({
            id: doc.id,
            tipo: 'comentario',
            ...doc.data()
        }));

        // Procesar respuestas
        const respuestas = respuestasSnapshot.docs.map(doc => ({
            id: doc.id,
            tipo: 'respuesta',
            ...doc.data()
        }));

        // Combinar y guardar en cache
        todosLosComentarios = [...comentarios, ...respuestas];
        
        // Extraer usuarios únicos
        const usuariosUnicos = new Set();
        todosLosComentarios.forEach(item => {
            if (item.usuario) {
                usuariosUnicos.add(item.usuario.toLowerCase());
            }
        });
        todosLosUsuarios = Array.from(usuariosUnicos);

        console.log(`📝 ${comentarios.length} comentarios y ${respuestas.length} respuestas cargados`);
        console.log(`👥 ${todosLosUsuarios.length} usuarios únicos encontrados`);

    } catch (error) {
        console.error("Error cargando comentarios para búsqueda:", error);
    }
}

// ===========================
// FUNCIÓN PRINCIPAL DE BÚSQUEDA
// ===========================
function buscarComentarios(query) {
    if (!todosLosComentarios.length) {
        console.log("No hay comentarios cargados, cargando...");
        cargarComentariosConCache().then(() => {
            if (query.trim()) buscarComentarios(query);
        });
        return;
    }

    const queryLower = query.toLowerCase();
    
    comentariosFiltrados = todosLosComentarios.filter(item => {
        // Buscar en contenido del comentario/respuesta
        const contenidoMatch = (item.texto || '').toLowerCase().includes(queryLower);
        
        // Buscar en nombre de usuario
        const usuarioMatch = (item.usuario || '').toLowerCase().includes(queryLower);
        
        return contenidoMatch || usuarioMatch;
    });

    // Ordenar resultados: comentarios primero, luego respuestas
    comentariosFiltrados.sort((a, b) => {
        if (a.tipo === 'comentario' && b.tipo === 'respuesta') return -1;
        if (a.tipo === 'respuesta' && b.tipo === 'comentario') return 1;
        
        // Dentro del mismo tipo, ordenar por timestamp
        const fechaA = a.timestamp?.toDate() || new Date(0);
        const fechaB = b.timestamp?.toDate() || new Date(0);
        return fechaB - fechaA;
    });

    mostrarResultadosBusquedaComentarios(comentariosFiltrados, query);
}

// ===========================
// MOSTRAR RESULTADOS DE BÚSQUEDA
// ===========================
function mostrarResultadosBusquedaComentarios(comentarios, query) {
    const listaComentarios = document.getElementById('lista_comentarios');
    const resultadosInfo = document.getElementById('search-results-info');
    
    if (!listaComentarios) return;

    // Mostrar información de resultados
    if (resultadosInfo) {
        resultadosInfo.style.display = 'block';
        
        if (comentarios.length === 0) {
            resultadosInfo.innerHTML = `
                <div class="no-results-comentarios">
                    <h3>🔍 No se encontraron resultados</h3>
                    <p>No hay comentarios que coincidan con "<strong>${escapeHtml(query)}</strong>"</p>
                    <button onclick="limpiarBusquedaComentarios()" class="btn-clear-search-comentarios">
                        <i class="fas fa-times"></i> Limpiar búsqueda
                    </button>
                </div>
            `;
            listaComentarios.innerHTML = '';
            return;
        }

        const comentariosCount = comentarios.filter(c => c.tipo === 'comentario').length;
        const respuestasCount = comentarios.filter(c => c.tipo === 'respuesta').length;
        
        resultadosInfo.innerHTML = `
            <div class="results-summary">
                <div class="results-count">
                    📋 ${comentarios.length} resultado${comentarios.length !== 1 ? 's' : ''} para "<strong>${escapeHtml(query)}</strong>"
                </div>
                <button onclick="limpiarBusquedaComentarios()" class="btn-clear-search-comentarios">
                    <i class="fas fa-times"></i> Limpiar
                </button>
            </div>
        `;
    }

    // Renderizar comentarios con resaltado
    renderizarComentariosFiltrados(comentarios, query);
}

// ===========================
// RENDERIZAR COMENTARIOS FILTRADOS
// ===========================
async function renderizarComentariosFiltrados(comentarios, query) {
    const listaComentarios = document.getElementById('lista_comentarios');
    if (!listaComentarios) return;

    listaComentarios.innerHTML = '';

    // Agrupar por comentarios principales
    const comentariosPrincipales = comentarios.filter(c => c.tipo === 'comentario');
    const respuestas = comentarios.filter(c => c.tipo === 'respuesta');

    // Renderizar comentarios principales
    for (const comentario of comentariosPrincipales) {
        // ✅ CREAR COPIA SEPARADA PARA RENDERIZADO
        const comentarioParaRenderizar = { ...comentario };
        
        // Solo aplicar resaltado en el DOM, no modificar el objeto original
        const elementoComentario = await crearElementoEntradaBusqueda(comentarioParaRenderizar, "comentario", 0, query);
        listaComentarios.appendChild(elementoComentario);
    }

    // Renderizar respuestas sueltas (que coinciden pero su comentario padre no)
    const respuestasSueltas = respuestas.filter(respuesta => {
        return !comentariosPrincipales.some(com => com.id === respuesta.comentarioId);
    });

    if (respuestasSueltas.length > 0) {
        // Cargar comentarios padre para contexto (sin separador)
        for (const respuesta of respuestasSueltas) {
            try {
                const comentarioPadre = await obtenerComentarioPadre(respuesta.comentarioId);
                if (comentarioPadre) {
                    const contenedorRespuesta = document.createElement('div');
                    contenedorRespuesta.className = 'respuesta-con-contexto';

                    const respuestaParaRenderizar = { ...respuesta };
                    const elementoRespuesta = await crearElementoEntradaBusqueda(respuestaParaRenderizar, "respuesta", 1, query);
                    contenedorRespuesta.appendChild(elementoRespuesta);
                    listaComentarios.appendChild(contenedorRespuesta);
                }
            } catch (error) {
                console.warn("Error cargando contexto para respuesta:", respuesta.id, error);
            }
        }
    }
}

// ===========================
// CREAR ELEMENTO PARA BÚSQUEDA - CORREGIDO
// ===========================
async function crearElementoEntradaBusqueda(data, tipo, profundidad = 0, query = '') {
    // Usar la función original pero aplicar resaltado después
    const elemento = await crearElementoEntrada(data, tipo, profundidad);
    
    if (query && elemento) {
        // ✅ APLICAR RESALTADO DESPUÉS DE CREAR EL ELEMENTO
        aplicarResaltadoBusqueda(elemento, query);
    }
    
    return elemento;
}

// ===========================
// APLICAR RESALTADO EN EL DOM - NUEVA FUNCIÓN
// ===========================
function aplicarResaltadoBusqueda(elemento, query) {
    if (!query || !elemento) return;
    
    // Crear regex para búsqueda case-insensitive
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    
    // Elementos donde aplicar resaltado
    const selectores = [
        '.nombre-usuario',    // Nombre de usuario
        'p',                  // Texto del comentario/respuesta
        '.cabecera-entrada span' // Otros textos en cabecera
    ];
    
    selectores.forEach(selector => {
        const elementos = elemento.querySelectorAll(selector);
        elementos.forEach(el => {
            // Solo procesar elementos de texto, no imágenes u otros
            if (el.children.length === 0) {
                const textoOriginal = el.textContent;
                if (textoOriginal && regex.test(textoOriginal)) {
                    el.innerHTML = textoOriginal.replace(regex, '<mark class="search-highlight-comentarios">$1</mark>');
                }
            } else {
                // Para elementos con hijos, procesar solo nodos de texto
                procesarNodosTexto(el, regex);
            }
        });
    });
}

// ===========================
// PROCESAR NODOS DE TEXTO RECURSIVAMENTE
// ===========================
function procesarNodosTexto(elemento, regex) {
    // Obtener todos los nodos hijo
    const nodos = Array.from(elemento.childNodes);
    
    nodos.forEach(nodo => {
        if (nodo.nodeType === Node.TEXT_NODE) {
            // Es un nodo de texto
            const texto = nodo.textContent;
            if (regex.test(texto)) {
                // Crear un span temporal para insertar el HTML
                const span = document.createElement('span');
                span.innerHTML = texto.replace(regex, '<mark class="search-highlight-comentarios">$1</mark>');
                
                // Reemplazar el nodo de texto con el contenido del span
                while (span.firstChild) {
                    elemento.insertBefore(span.firstChild, nodo);
                }
                elemento.removeChild(nodo);
            }
        } else if (nodo.nodeType === Node.ELEMENT_NODE && 
                   !nodo.classList.contains('search-highlight-comentarios')) {
            // Es un elemento, procesar recursivamente (pero no los highlights existentes)
            procesarNodosTexto(nodo, regex);
        }
    });
}

// ===========================
// FUNCIONES AUXILIARES
// ===========================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function truncarTexto(texto, limite = 100) {
    if (!texto) return 'Sin contenido';
    if (texto.length <= limite) return texto;
    return texto.substring(0, limite) + '...';
}

async function obtenerComentarioPadre(comentarioId) {
    try {
        const doc = await db.collection('comentarios').doc(comentarioId).get();
        return doc.exists ? { id: doc.id, ...doc.data() } : null;
    } catch (error) {
        console.error("Error obteniendo comentario padre:", error);
        return null;
    }
}

// ===========================
// LIMPIAR BÚSQUEDA
// ===========================
function limpiarBusquedaComentarios() {
    const searchInput = document.getElementById('search-comentarios');
    const resultadosInfo = document.getElementById('search-results-info');
    
    if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
    }
    
    if (resultadosInfo) {
        resultadosInfo.style.display = 'none';
    }
    
    mostrarTodosLosComentarios();
}

// ===========================
// MOSTRAR TODOS LOS COMENTARIOS
// ===========================
function mostrarTodosLosComentarios() {
    // Recargar comentarios normalmente
    if (typeof cargarComentarios === 'function') {
        cargarComentarios();
    }
}

// ===========================
// INICIALIZACIÓN AUTOMÁTICA
// ===========================
document.addEventListener('DOMContentLoaded', function() {
    console.log("🚀 Iniciando sistema de búsqueda de comentarios corregido...");
    
    // Esperar a que Firebase esté listo
    const inicializarCuandoEsteList = () => {
        if (typeof auth !== 'undefined' && auth && auth.currentUser) {
            setTimeout(() => {
                inicializarBusquedaComentarios();
                
                // Cargar cache inicial
                cargarComentariosConCache();
            }, 1000);
        } else {
            setTimeout(inicializarCuandoEsteList, 500);
        }
    };
    
    inicializarCuandoEsteList();
});

// ===========================
// ACTUALIZAR CACHE AUTOMÁTICAMENTE
// ===========================
// Interceptar la función original para actualizar cache
if (typeof window.cargarComentarios === 'function') {
    const cargarComentariosOriginal = window.cargarComentarios;
    window.cargarComentarios = async function() {
        // Llamar función original
        await cargarComentariosOriginal.apply(this, arguments);
        
        // Actualizar cache para búsqueda
        setTimeout(() => {
            cargarComentariosConCache();
        }, 500);
    };
}

// ===========================
// EXPONER FUNCIONES GLOBALMENTE
// ===========================
window.limpiarBusquedaComentarios = limpiarBusquedaComentarios;
window.buscarComentarios = buscarComentarios;
window.inicializarBusquedaComentarios = inicializarBusquedaComentarios;
window.cargarComentariosConCache = cargarComentariosConCache;

console.log("✅ Sistema de búsqueda de comentarios corregido cargado");
// Variables globales para el sistema de reportes
let reporteModalActivo = null;
let usuarioReportado = null;
let reportesBloqueados = new Set(); // Para evitar duplicados

/* ============================
   INICIALIZACIÓN DEL SISTEMA DE REPORTES
   ============================ */
function inicializarSistemaReportes() {
    console.log("🚨 Inicializando sistema de reportes corregido...");
    
    // Verificar que no esté ya inicializado
    if (document.getElementById('modal-reportes')) {
        console.log("⚠️ Sistema de reportes ya inicializado");
        return;
    }
    
    // Agregar estilos CSS
    agregarEstilosReportes();
    
    // Crear modal de reportes
    crearModalReportes();
    
    // Configurar eventos
    configurarEventosReportes();
    
    console.log("✅ Sistema de reportes inicializado correctamente");
}

/* ============================
   AGREGAR ESTILOS CSS CORREGIDOS
   ============================ */
function agregarEstilosReportes() {
    if (document.getElementById('estilos-reportes')) return;
    
    const estilos = document.createElement('style');
    estilos.id = 'estilos-reportes';
    estilos.textContent = `
        /* Botón de reportar - ÚNICO por comentario */
        .btn-reportar {
            background: linear-gradient(135deg, #ff6b35, #ff8c42);
            color: white;
            border: none;
            padding: 5px 10px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 11px;
            font-weight: 500;
            transition: all 0.2s ease;
            margin-top: 8px;
            box-shadow: 0 1px 3px rgba(255, 107, 53, 0.3);
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }
        
        .btn-reportar:hover {
            background: linear-gradient(135deg, #e55a2e, #ff7a35);
            transform: translateY(-1px);
            box-shadow: 0 2px 6px rgba(255, 107, 53, 0.4);
        }
        
        .btn-reportar:active {
            transform: translateY(0);
        }
        
        /* Evitar múltiples botones */
        .comentario .btn-reportar:not(:first-of-type),
        .respuesta .btn-reportar:not(:first-of-type) {
            display: none !important;
        }
        
        /* Modal de reportes */
        .modal-reportes {
            display: none;
            position: fixed;
            z-index: 1200;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.8);
            justify-content: center;
            align-items: center;
            animation: fadeIn 0.3s ease;
        }
        
        .modal-reportes.activo {
            display: flex;
        }
        
        .modal-contenido-reportes {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border-radius: 16px;
            padding: 25px;
            max-width: 400px;
            width: 90%;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
            animation: modalSlideIn 0.3s ease;
            position: relative;
            color: #2d3436;
            max-height: 90vh;
            overflow-y: auto;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        @keyframes modalSlideIn {
            from { 
                opacity: 0; 
                transform: scale(0.8) translateY(-20px); 
            }
            to { 
                opacity: 1; 
                transform: scale(1) translateY(0); 
            }
        }
        
        .modal-header-reportes {
            display: flex;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid rgba(255, 107, 53, 0.2);
        }
        
        .modal-avatar-reportes {
            width: 45px;
            height: 45px;
            border-radius: 50%;
            background-color: #ddd;
            margin-right: 12px;
            object-fit: cover;
            border: 2px solid #ff6b35;
        }
        
        .modal-usuario-info-reportes {
            text-align: left;
            flex: 1;
        }
        
        .modal-usuario-nombre-reportes {
            font-weight: bold;
            color: #2d3436;
            margin-bottom: 3px;
            font-size: 15px;
        }
        
        .modal-usuario-accion-reportes {
            font-size: 13px;
            color: #636e72;
        }
        
        .modal-cerrar-reportes {
            position: absolute;
            top: 10px;
            right: 15px;
            background: none;
            border: none;
            font-size: 20px;
            color: #636e72;
            cursor: pointer;
            transition: color 0.3s ease;
            width: 25px;
            height: 25px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .modal-cerrar-reportes:hover {
            color: #ff6b35;
            background-color: rgba(255, 107, 53, 0.1);
            border-radius: 50%;
        }
        
        .modal-titulo-reportes {
            color: #2d3436;
            margin-bottom: 18px;
            font-size: 16px;
            font-weight: 600;
        }
        
        .modal-opciones-reportes {
            margin: 15px 0;
            text-align: left;
        }
        
        .opcion-reporte {
            background: white;
            border: 2px solid #e9ecef;
            border-radius: 8px;
            padding: 12px;
            margin: 8px 0;
            cursor: pointer;
            transition: all 0.3s ease;
            font-weight: 500;
            color: #2d3436;
            font-size: 14px;
        }
        
        .opcion-reporte:hover {
            background: #fff5f3;
            border-color: #ff6b35;
            transform: translateX(3px);
            box-shadow: 0 2px 8px rgba(255, 107, 53, 0.2);
        }
        
        .opcion-reporte.seleccionada {
            background: linear-gradient(135deg, #ff6b35, #ff8c42);
            color: white;
            border-color: #ff6b35;
            box-shadow: 0 0 0 2px rgba(255, 107, 53, 0.3);
        }
        
        .opcion-reporte .emoji {
            margin-right: 8px;
            font-size: 14px;
        }
        
        .modal-botones-reportes {
            display: flex;
            gap: 12px;
            margin-top: 20px;
        }
        
        .btn-reportes {
            flex: 1;
            padding: 10px 18px;
            border: none;
            border-radius: 8px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s ease;
            font-size: 13px;
        }
        
        .btn-cancelar-reportes {
            background: #e9ecef;
            color: #6c757d;
            border: 1px solid #dee2e6;
        }
        
        .btn-cancelar-reportes:hover {
            background: #dee2e6;
            color: #495057;
        }
        
        .btn-confirmar-reportes {
            background: linear-gradient(135deg, #ff6b35, #ff8c42);
            color: white;
            box-shadow: 0 2px 8px rgba(255, 107, 53, 0.3);
        }
        
        .btn-confirmar-reportes:hover:not(:disabled) {
            background: linear-gradient(135deg, #e55a2e, #ff7a35);
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(255, 107, 53, 0.4);
        }
        
        .btn-confirmar-reportes:disabled {
            background: #adb5bd;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }
        
        /* Estado de reporte enviado */
        .reporte-enviado {
            opacity: 0.6;
            pointer-events: none;
        }
        
        .reporte-enviado::after {
            content: "✓ Reportado";
            position: absolute;
            top: 0;
            right: 0;
            background: #28a745;
            color: white;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 10px;
            transform: translate(50%, -50%);
        }
        
        /* Modo oscuro */
        .dark-mode .modal-contenido-reportes {
            background: linear-gradient(135deg, #2d3436 0%, #636e72 100%);
            color: #ddd;
        }
        
        .dark-mode .modal-usuario-nombre-reportes {
            color: #fff;
        }
        
        .dark-mode .modal-usuario-accion-reportes {
            color: #b2bec3;
        }
        
        .dark-mode .modal-titulo-reportes {
            color: #fff;
        }
        
        .dark-mode .opcion-reporte {
            background: rgba(255, 255, 255, 0.1);
            border-color: #636e72;
            color: #ddd;
        }
        
        .dark-mode .opcion-reporte:hover {
            background: rgba(255, 255, 255, 0.2);
            border-color: #ff6b35;
        }
        
        .dark-mode .btn-cancelar-reportes {
            background: #636e72;
            color: #ddd;
            border-color: #2d3436;
        }
        
        .dark-mode .btn-cancelar-reportes:hover {
            background: #2d3436;
            color: #fff;
        }
        
        /* Responsive */
        @media (max-width: 480px) {
            .modal-contenido-reportes {
                padding: 20px;
                max-width: 95%;
            }
            
            .modal-header-reportes {
                flex-direction: column;
                text-align: center;
            }
            
            .modal-avatar-reportes {
                margin: 0 0 8px 0;
            }
            
            .modal-botones-reportes {
                flex-direction: column;
            }
            
            .btn-reportar {
                font-size: 10px;
                padding: 4px 8px;
            }
        }
    `;
    
    document.head.appendChild(estilos);
}

/* ============================
   CREAR MODAL DE REPORTES CORREGIDO
   ============================ */
function crearModalReportes() {
    if (document.getElementById('modal-reportes')) return;
    
    const modal = document.createElement('div');
    modal.id = 'modal-reportes';
    modal.className = 'modal-reportes';
    modal.innerHTML = `
        <div class="modal-contenido-reportes">
            <button class="modal-cerrar-reportes" onclick="cerrarModalReportes()">&times;</button>
            
            <div class="modal-header-reportes">
                <img class="modal-avatar-reportes" id="reporte-avatar" src="/Imagenes/Avatares/Avatar1.jpg" alt="Avatar">
                <div class="modal-usuario-info-reportes">
                    <div class="modal-usuario-nombre-reportes" id="reporte-nombre">Usuario</div>
                    <div class="modal-usuario-accion-reportes">Reportar contenido</div>
                </div>
            </div>
            
            <h3 class="modal-titulo-reportes">¿Por qué reportas este contenido?</h3>
            
            <div class="modal-opciones-reportes" id="opciones-reporte">
                <div class="opcion-reporte" data-razon="spam">
                    <span class="emoji">📢</span> Spam o contenido repetitivo
                </div>
                <div class="opcion-reporte" data-razon="acoso">
                    <span class="emoji">😠</span> Acoso o intimidación
                </div>
                <div class="opcion-reporte" data-razon="contenido">
                    <span class="emoji">🚫</span> Contenido inapropiado
                </div>
                <div class="opcion-reporte" data-razon="lenguaje">
                    <span class="emoji">🤬</span> Lenguaje ofensivo
                </div>
                <div class="opcion-reporte" data-razon="otro">
                    <span class="emoji">❓</span> Otro motivo
                </div>
            </div>
            
            <div class="modal-botones-reportes">
                <button class="btn-reportes btn-cancelar-reportes" onclick="cerrarModalReportes()">
                    Cancelar
                </button>
                <button class="btn-reportes btn-confirmar-reportes" id="btn-confirmar-reporte" disabled onclick="enviarReporte()">
                    Reportar
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

/* ============================
   CONFIGURAR EVENTOS CORREGIDOS
   ============================ */
function configurarEventosReportes() {
    // Configurar eventos de opciones de reporte
    document.addEventListener('click', (e) => {
        if (e.target.matches('.opcion-reporte') || e.target.closest('.opcion-reporte')) {
            const opcion = e.target.closest('.opcion-reporte') || e.target;
            
            // Deseleccionar todas las opciones
            document.querySelectorAll('.opcion-reporte').forEach(opt => {
                opt.classList.remove('seleccionada');
            });
            
            // Seleccionar la opción clickeada
            opcion.classList.add('seleccionada');
            
            // Habilitar botón de confirmar
            const btnConfirmar = document.getElementById('btn-confirmar-reporte');
            if (btnConfirmar) {
                btnConfirmar.disabled = false;
            }
        }
    });
    
    // Cerrar modal con Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            cerrarModalReportes();
        }
    });
    
    // Cerrar modal al hacer click fuera
    document.addEventListener('click', (e) => {
        const modal = document.getElementById('modal-reportes');
        if (e.target === modal) {
            cerrarModalReportes();
        }
    });
}

/* ============================
   FUNCIONES DEL MODAL CORREGIDAS
   ============================ */
function abrirModalReportes(uid, nombre, avatar, tipoContenido = 'comentario', contenidoId = null) {
    if (!auth || !auth.currentUser) {
        mostrarVentanaEmergente("Debes iniciar sesión para reportar contenido.");
        return;
    }
    
    // Verificar que no sea el usuario actual
    if (uid === auth.currentUser.uid) {
        mostrarVentanaEmergente("No puedes reportar tu propio contenido.");
        return;
    }
    
    // Crear clave única para evitar reportes duplicados
    const claveReporte = `${uid}-${contenidoId}-${auth.currentUser.uid}`;
    if (reportesBloqueados.has(claveReporte)) {
        mostrarVentanaEmergente("Ya has reportado este contenido anteriormente.");
        return;
    }
    
    usuarioReportado = { 
        uid, 
        nombre, 
        avatar: verificarYCorregirAvatar(avatar),
        tipoContenido,
        contenidoId,
        claveReporte
    };
    
    // Actualizar datos en el modal
    document.getElementById('reporte-nombre').textContent = nombre;
    
    // Configurar avatar con manejo de errores
    const avatarImg = document.getElementById('reporte-avatar');
    aplicarAvatarSeguro(avatarImg, usuarioReportado.avatar, `Avatar de ${nombre}`);
    
    // Resetear selección
    document.querySelectorAll('.opcion-reporte').forEach(opcion => {
        opcion.classList.remove('seleccionada');
    });
    document.getElementById('btn-confirmar-reporte').disabled = true;
    
    // Mostrar modal
    document.getElementById('modal-reportes').classList.add('activo');
    console.log("🚨 Modal de reportes abierto para:", nombre);
}

function cerrarModalReportes() {
    const modal = document.getElementById('modal-reportes');
    if (modal) {
        modal.classList.remove('activo');
    }
    usuarioReportado = null;
    console.log("❌ Modal de reportes cerrado");
}

async function enviarReporte() {
    if (!usuarioReportado || !auth || !auth.currentUser) return;
    
    const razonSeleccionada = document.querySelector('.opcion-reporte.seleccionada');
    if (!razonSeleccionada) return;
    
    const razon = razonSeleccionada.dataset.razon;
    const btnConfirmar = document.getElementById('btn-confirmar-reporte');
    
    try {
        // Deshabilitar botón para evitar múltiples envíos
        btnConfirmar.disabled = true;
        btnConfirmar.textContent = 'Enviando...';
        
        // Verificar permisos de Firebase antes de enviar
        if (!db) {
            throw new Error('Base de datos no disponible');
        }
        
        // Verificar si ya existe un reporte similar
        const reportesExistentes = await db.collection('reportes')
            .where('reportadoPor', '==', auth.currentUser.uid)
            .where('usuarioReportado', '==', usuarioReportado.uid)
            .where('contenidoId', '==', usuarioReportado.contenidoId)
            .get();
        
        if (!reportesExistentes.empty) {
            mostrarVentanaEmergente("Ya has reportado este contenido anteriormente.");
            cerrarModalReportes();
            return;
        }
        
        // Preparar datos del reporte
        const reporteData = {
            reportadoPor: auth.currentUser.uid,
            reportadorNombre: auth.currentUser.displayName || auth.currentUser.email.split('@')[0],
            usuarioReportado: usuarioReportado.uid,
            nombreReportado: usuarioReportado.nombre,
            tipoContenido: usuarioReportado.tipoContenido,
            contenidoId: usuarioReportado.contenidoId || 'sin-id',
            razon: razon,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            fecha: new Date().toISOString(),
            estado: 'pendiente',
            revisado: false
        };
        
        // Intentar guardar en Firebase
        await db.collection('reportes').add(reporteData);
        
        // Marcar como reportado para evitar duplicados
        reportesBloqueados.add(usuarioReportado.claveReporte);
        
        // Marcar visualmente el contenido como reportado
        marcarContenidoReportado(usuarioReportado.contenidoId);
        
        console.log(`✅ Reporte enviado: ${usuarioReportado.nombre} por ${razon}`);
        mostrarVentanaEmergente(`Reporte enviado correctamente. Gracias por ayudar a mantener la comunidad segura.`);
        
        cerrarModalReportes();
        
    } catch (error) {
        console.error('Error al enviar reporte:', error);
        
        // Mensaje de error más específico
        let mensajeError = 'Error al enviar el reporte. ';
        if (error.code === 'permission-denied') {
            mensajeError += 'No tienes permisos para realizar esta acción.';
        } else if (error.code === 'unavailable') {
            mensajeError += 'Servicio no disponible. Inténtalo más tarde.';
        } else {
            mensajeError += 'Inténtalo de nuevo.';
        }
        
        mostrarVentanaEmergente(mensajeError);
        
        // Restaurar botón
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = 'Reportar';
    }
}

/* ============================
   FUNCIONES DE UTILIDAD CORREGIDAS
   ============================ */
function marcarContenidoReportado(contenidoId) {
    if (!contenidoId) return;
    
    const elemento = document.querySelector(`[data-id="${contenidoId}"]`);
    if (elemento) {
        const botonReportar = elemento.querySelector('.btn-reportar');
        if (botonReportar) {
            botonReportar.textContent = '✓ Reportado';
            botonReportar.disabled = true;
            botonReportar.style.background = '#28a745';
            botonReportar.onclick = null;
        }
    }
}

// FUNCIÓN CORREGIDA para agregar botones sin duplicados
function agregarBotonReportar(contenedor, data, tipo) {
    // Verificaciones de seguridad
    if (!contenedor || !data || !data.uid) return;
    if (!auth || !auth.currentUser || data.uid === auth.currentUser.uid) return;
    
    // Verificar si ya existe un botón de reportar
    if (contenedor.querySelector('.btn-reportar')) {
        console.log("⚠️ Botón de reportar ya existe, saltando...");
        return;
    }
    
    // Crear botón de reportar
    const btnReportar = document.createElement('button');
    btnReportar.className = 'btn-reportar';
    btnReportar.innerHTML = '🚨 Reportar';
    btnReportar.title = `Reportar ${tipo}`;
    
    btnReportar.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        abrirModalReportes(
            data.uid,
            data.usuario || 'Usuario',
            data.avatar,
            tipo,
            data.id
        );
    };
    
    // Insertar después de las reacciones o al final
    const reacciones = contenedor.querySelector('.reacciones');
    if (reacciones) {
        reacciones.parentNode.insertBefore(btnReportar, reacciones.nextSibling);
    } else {
        contenedor.appendChild(btnReportar);
    }
    
    console.log(`✅ Botón de reportar agregado a ${tipo} de ${data.usuario}`);
}

/* ============================
   INICIALIZACIÓN AUTOMÁTICA CORREGIDA
   ============================ */
document.addEventListener('DOMContentLoaded', () => {
    // Esperar a que Firebase esté listo
    const inicializar = () => {
        if (typeof auth !== 'undefined' && auth) {
            auth.onAuthStateChanged((user) => {
                if (user) {
                    setTimeout(() => {
                        inicializarSistemaReportes();
                    }, 1000);
                }
            });
        } else {
            setTimeout(inicializar, 500);
        }
    };
    
    inicializar();
});

/* ============================
   EXPONER FUNCIONES GLOBALMENTE
   ============================ */
window.abrirModalReportes = abrirModalReportes;
window.cerrarModalReportes = cerrarModalReportes;
window.enviarReporte = enviarReporte;
window.agregarBotonReportar = agregarBotonReportar;
window.marcarContenidoReportado = marcarContenidoReportado;

console.log("✅ Sistema de reportes corregido cargado");
/* ============================
   INTEGRACIÓN CORREGIDA SISTEMA DE REPORTES
   Agregar este código al FINAL de pagina_principal_Coemntarios_Beta.js
   ============================ */

// Variable para evitar múltiples integraciones
let sistemaReportesIntegrado = false;

// Función mejorada para agregar botones sin duplicados
function agregarBotonReportarSeguro(contenedor, data, tipo) {
    // Verificaciones exhaustivas
    if (!contenedor || !data || !data.uid) return;
    if (!auth || !auth.currentUser || data.uid === auth.currentUser.uid) return;
    
    // Verificar si ya existe botón
    if (contenedor.querySelector('.btn-reportar')) return;
    
    // Verificar que el sistema de reportes esté cargado
    if (typeof agregarBotonReportar !== 'function') {
        console.log("⚠️ Sistema de reportes no disponible");
        return;
    }
    
    // Llamar función del sistema de reportes
    agregarBotonReportar(contenedor, data, tipo);
}

// Interceptar función original una sola vez
if (!sistemaReportesIntegrado && typeof window.crearElementoEntrada === 'function') {
    console.log("🔧 Integrando sistema de reportes (versión corregida)...");
    
    // Guardar referencia original
    const crearElementoEntradaOriginal = window.crearElementoEntrada;
    
    // Sobrescribir función
    window.crearElementoEntrada = async function(data, tipo, profundidad = 0) {
        // Llamar función original
        const elemento = await crearElementoEntradaOriginal.call(this, data, tipo, profundidad);
        
        // Agregar botón de reportar después de un pequeño delay
        if (elemento && data.uid) {
            setTimeout(() => {
                agregarBotonReportarSeguro(elemento, data, tipo);
            }, 200);
        }
        
        return elemento;
    };
    
    sistemaReportesIntegrado = true;
    console.log("✅ Sistema de reportes integrado correctamente");
}

// Función para actualizar comentarios existentes (mejorada)
function actualizarComentariosConReportesSeguro() {
    if (!auth || !auth.currentUser) return;
    
    const comentarios = document.querySelectorAll('.comentario[data-uid], .respuesta[data-uid]');
    let agregados = 0;
    
    comentarios.forEach(comentario => {
        // Verificar múltiples condiciones
        const tieneBoton = comentario.querySelector('.btn-reportar');
        const uid = comentario.dataset.uid;
        const esPropio = uid === auth.currentUser.uid;
        
        if (!tieneBoton && !esPropio && uid) {
            const userData = {
                uid: uid,
                usuario: comentario.querySelector('.nombre-usuario')?.textContent || 'Usuario',
                avatar: comentario.querySelector('.avatar-comentario')?.src || '/Imagenes/Avatares/Avatar1.jpg',
                id: comentario.dataset.id || `temp-${Math.random().toString(36).substr(2, 9)}`
            };
            
            const tipo = comentario.classList.contains('comentario') ? 'comentario' : 'respuesta';
            
            agregarBotonReportarSeguro(comentario, userData, tipo);
            agregados++;
        }
    });
    
    if (agregados > 0) {
        console.log(`✅ ${agregados} botones de reporte agregados (sin duplicados)`);
    }
}

// Configurar observador mejorado
function configurarObservadorReportesSeguro() {
    const listaComentarios = document.getElementById('lista_comentarios');
    if (!listaComentarios) return;
    
    let timeoutId;
    
    const observer = new MutationObserver((mutations) => {
        // Usar debounce para evitar múltiples llamadas
        clearTimeout(timeoutId);
        
        let hayNuevosComentarios = false;
        
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE && 
                        (node.classList?.contains('comentario') || node.classList?.contains('respuesta'))) {
                        hayNuevosComentarios = true;
                    }
                });
            }
        });
        
        if (hayNuevosComentarios) {
            timeoutId = setTimeout(() => {
                actualizarComentariosConReportesSeguro();
            }, 300);
        }
    });
    
    observer.observe(listaComentarios, {
        childList: true,
        subtree: true
    });
    
    // Guardar referencia para poder limpiar después
    window.observadorReportes = observer;
    
    console.log("👁️ Observador de reportes configurado (versión segura)");
}

// Función para limpiar sistema si es necesario
function limpiarSistemaReportes() {
    // Remover botones duplicados
    const botonesDuplicados = document.querySelectorAll('.btn-reportar:not(:first-of-type)');
    botonesDuplicados.forEach(boton => boton.remove());
    
    // Limpiar observador si existe
    if (window.observadorReportes) {
        window.observadorReportes.disconnect();
        window.observadorReportes = null;
    }
    
    console.log("🧹 Sistema de reportes limpiado");
}

// Inicialización segura
function inicializarIntegracionReportes() {
    // Verificar que Firebase esté listo
    if (!auth || !auth.currentUser) {
        setTimeout(inicializarIntegracionReportes, 500);
        return;
    }
    
    // Verificar que el sistema de reportes esté cargado
    if (typeof agregarBotonReportar !== 'function') {
        setTimeout(inicializarIntegracionReportes, 500);
        return;
    }
    
    console.log("🚀 Iniciando integración segura de reportes...");
    
    // Limpiar cualquier duplicado existente
    limpiarSistemaReportes();
    
    // Configurar observador
    setTimeout(() => {
        configurarObservadorReportesSeguro();
    }, 500);
    
    // Actualizar comentarios existentes
    setTimeout(() => {
        actualizarComentariosConReportesSeguro();
    }, 1000);
    
    console.log("✅ Integración de reportes completada");
}

// Auto-inicialización cuando Firebase esté listo
if (typeof auth !== 'undefined' && auth) {
    auth.onAuthStateChanged((user) => {
        if (user) {
            setTimeout(inicializarIntegracionReportes, 1500);
        }
    });
} else {
    // Si auth no está disponible, esperar
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(inicializarIntegracionReportes, 2000);
    });
}

// Funciones de utilidad para debugging
window.debugReportes = function() {
    console.log("=== 🐛 DEBUG SISTEMA DE REPORTES ===");
    console.log("Sistema integrado:", sistemaReportesIntegrado);
    console.log("Usuario actual:", auth?.currentUser?.uid || "No autenticado");
    console.log("Botones existentes:", document.querySelectorAll('.btn-reportar').length);
    console.log("Comentarios con UID:", document.querySelectorAll('[data-uid]').length);
    console.log("Función disponible:", typeof agregarBotonReportar);
    console.log("Modal existe:", !!document.getElementById('modal-reportes'));
};

window.limpiarReportes = limpiarSistemaReportes;
window.actualizarReportes = actualizarComentariosConReportesSeguro;

// Función para recargar avatares fallidos (corregida)
function recargarAvataresFallidosReportes() {
    const avatares = document.querySelectorAll('.modal-avatar-reportes');
    avatares.forEach(avatar => {
        if (avatar.naturalWidth === 0 && avatar.complete) {
            const src = avatar.src;
            avatar.src = '';
            setTimeout(() => {
                avatar.src = verificarYCorregirAvatar(src);
            }, 100);
        }
    });
}

// Ejecutar recarga de avatares cada 30 segundos
setInterval(recargarAvataresFallidosReportes, 30000);

console.log("✅ Integración de reportes cargada (versión corregida y sin duplicados)");