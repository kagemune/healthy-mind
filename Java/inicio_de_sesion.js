document.addEventListener('DOMContentLoaded', function() {
    // Llamado de documentos
    const signUp = document.getElementById('signUp');
    const signIn = document.getElementById('signIn');
    const nombreBox = document.getElementById('nombre');
    const termsBox = document.getElementById('terms-box');
    const title = document.getElementById('titulo');
    const submitBtn = document.getElementById('submit-btn');
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const nombreInput = document.querySelector('#nombre input');
    const rememberCheck = document.getElementById('remember');

    // Términos y condiciones
    const termsLink = document.getElementById('terms-open');
    const termsModal = document.getElementById('terms-modal');
    const modalClose = document.getElementById('modal-close');
    const acceptTerms = document.getElementById('accept-terms');
    const termsCheck = document.getElementById('terms');

    // Estado inicial - Inicio de sesión
    let isRegistrationMode = false;

    function setLoginMode() {
        isRegistrationMode = false;
        title.textContent = 'Iniciar Sesión';
        submitBtn.textContent = 'Iniciar sesión';
        nombreBox.classList.add('hidden');
        termsBox.classList.add('hidden');
        signUp.classList.remove('disable');
        signIn.classList.add('disable');
        if (termsCheck) termsCheck.removeAttribute('required');
        if (nombreInput) nombreInput.removeAttribute('required');
    }

    function setRegistrationMode() {
        isRegistrationMode = true;
        title.textContent = 'Registro';
        submitBtn.textContent = 'Registrarme';
        nombreBox.classList.remove('hidden');
        termsBox.classList.remove('hidden');
        signUp.classList.add('disable');
        signIn.classList.remove('disable');
        if (termsCheck) termsCheck.setAttribute('required', 'required');
        if (nombreInput) nombreInput.setAttribute('required', 'required');
    }

    setLoginMode();

    signUp.onclick = function() {
        if (isRegistrationMode) return;
        setRegistrationMode();
    }

    signIn.onclick = function() {
        if (!isRegistrationMode) return;
        setLoginMode();
    }

    function showMessage(message, isError = false) {
        let messageElement = document.getElementById('message-container');
        if (!messageElement) {
            messageElement = document.createElement('div');
            messageElement.id = 'message-container';
            messageElement.style.padding = '10px';
            messageElement.style.margin = '10px 0';
            messageElement.style.borderRadius = '5px';
            messageElement.style.textAlign = 'center';
            messageElement.style.fontWeight = 'bold';
            loginForm.insertBefore(messageElement, submitBtn);
        }
        messageElement.textContent = message;
        messageElement.style.backgroundColor = isError ? 'rgba(255, 100, 100, 0.7)' : 'rgba(100, 255, 100, 0.7)';
        messageElement.style.color = isError ? 'white' : 'black';
        setTimeout(() => {
            messageElement.textContent = '';
            messageElement.style.backgroundColor = 'transparent';
        }, 5000);
    }

    loginForm.addEventListener('submit', function(event) {
        event.preventDefault();

        const email = emailInput.value;
        const password = passwordInput.value;

        if (!email || !password) {
            showMessage('Por favor completa todos los campos', true);
            return;
        }

        if (password.length < 6) {
            showMessage('La contraseña debe tener al menos 6 caracteres', true);
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Procesando...';

        if (isRegistrationMode) {
            // ========================================
            // MODO REGISTRO
            // ========================================
            const nombre = nombreInput ? nombreInput.value.trim() : '';
            if (!nombre) {
                showMessage('Por favor ingresa tu nombre', true);
                submitBtn.disabled = false;
                submitBtn.textContent = 'Registrarme';
                return;
            }
            if (!termsCheck || !termsCheck.checked) {
                showMessage('Debes aceptar los términos y condiciones', true);
                submitBtn.disabled = false;
                submitBtn.textContent = 'Registrarme';
                return;
            }

            // 🔥 REGISTRO con Authentication y Firestore
            firebase.auth().createUserWithEmailAndPassword(email, password)
                .then((userCredential) => {
                    const user = userCredential.user;
                    return user.updateProfile({ displayName: nombre })
                        .then(() => {
                            // Guardar datos en Firestore usando el UID del usuario
                            return db.collection('usuarios').doc(user.uid).set({
                                uid: user.uid,
                                nombre: nombre,
                                email: email,
                                emailVerificado: user.emailVerified,
                                fechaRegistro: firebase.firestore.FieldValue.serverTimestamp(),
                                aceptoTerminos: true,
                                activo: true,
                                tipoUsuario: 'usuario',
                                configuracion: {
                                    notificaciones: true,
                                    temaOscuro: localStorage.getItem("theme") === "dark",
                                    idioma: 'es'
                                },
                                perfil: {
                                    edad: null,
                                    genero: null,
                                    telefono: null,
                                    ubicacion: null,
                                    biografia: null,
                                    avatar: null
                                },
                                estadisticas: {
                                    sesionesChat: 0,
                                    tiempoEnApp: 0,
                                    ultimaActividad: firebase.firestore.FieldValue.serverTimestamp()
                                }
                            });
                        });
                })
                .then(() => {
                    showMessage('¡Registro exitoso! Revisa tu correo para verificar tu cuenta.');
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Registrarme';
                    setTimeout(() => {
                        window.location.href = "/index.html"; // Redirigir al inicio
                    }, 3000);
                })
                .catch((error) => {
                    console.error("Error en registro:", error);
                    let errorMessage;
                    switch (error.code) {
                        case 'auth/email-already-in-use':
                            errorMessage = 'Este correo ya está registrado';
                            break;
                        case 'auth/invalid-email':
                            errorMessage = 'Correo electrónico inválido';
                            break;
                        case 'auth/weak-password':
                            errorMessage = 'La contraseña es demasiado débil (mínimo 6 caracteres)';
                            break;
                        default:
                            errorMessage = 'Error al registrar: ' + (error.message || 'Error desconocido');
                    }
                    showMessage(errorMessage, true);
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Registrarme';
                });

        } else {
            // ========================================
            // MODO INICIO DE SESIÓN
            // ========================================
            firebase.auth().signInWithEmailAndPassword(email, password)
                .then((userCredential) => {
                    const user = userCredential.user;
                    console.log("Inicio de sesión exitoso:", user.email);
                    
                    // Actualizar última actividad en Firestore
                    db.collection('usuarios').doc(user.uid).update({
                        'estadisticas.ultimaActividad': firebase.firestore.FieldValue.serverTimestamp()
                    }).catch((error) => {
                        console.log("Error al actualizar última actividad:", error);
                        // No es crítico, continúa con el inicio de sesión
                    });

                    showMessage('¡Inicio de sesión exitoso!');
                    
                    // Guardar opción "Recordarme" si está marcada
                    if (rememberCheck && rememberCheck.checked) {
                        localStorage.setItem('rememberLogin', 'true');
                    } else {
                        localStorage.removeItem('rememberLogin');
                    }
                    
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Iniciar sesión';
                    
                    setTimeout(() => {
                        window.location.href = "/index.html"; // Redirigir al inicio
                    }, 2000);
                })
                .catch((error) => {
                    console.error("Error en inicio de sesión:", error);
                    let errorMessage;
                    switch (error.code) {
                        case 'auth/user-not-found':
                            errorMessage = 'No existe una cuenta con este correo electrónico';
                            break;
                        case 'auth/wrong-password':
                            errorMessage = 'Contraseña incorrecta';
                            break;
                        case 'auth/invalid-email':
                            errorMessage = 'Correo electrónico inválido';
                            break;
                        case 'auth/user-disabled':
                            errorMessage = 'Esta cuenta ha sido deshabilitada';
                            break;
                        case 'auth/too-many-requests':
                            errorMessage = 'Demasiados intentos fallidos. Intenta más tarde';
                            break;
                        case 'auth/network-request-failed':
                            errorMessage = 'Error de conexión. Verifica tu internet';
                            break;
                        default:
                            errorMessage = 'Error al iniciar sesión: ' + (error.message || 'Error desconocido');
                    }
                    showMessage(errorMessage, true);
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Iniciar sesión';
                });
        }
    });

    // Modal de términos y condiciones
    if (termsLink) {
        termsLink.addEventListener('click', function(e) {
            e.preventDefault();
            termsModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    }

    if (modalClose) {
        modalClose.addEventListener('click', function(){
            termsModal.classList.remove('active');
            document.body.style.overflow = '';
        });
    }

    if (termsModal) {
        termsModal.addEventListener('click', function(e){
            if (e.target === termsModal) {
                termsModal.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    }

    if (acceptTerms) {
        acceptTerms.addEventListener('click', function(){
            if (termsCheck) termsCheck.checked = true;
            termsModal.classList.remove('active');
            document.body.style.overflow = '';
        });
    }
});

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

// ====== SISTEMA DE RECUPERACIÓN DE CONTRASEÑA ======

// Función principal de recuperación
async function recuperarContrasena(email) {
    console.log("🔄 Iniciando recuperación de contraseña para:", email);
    
    if (!firebase.auth) {
        console.error("❌ Firebase Auth no está disponible");
        mostrarMensajeRecuperacion("Error de configuración. Inténtalo más tarde.", "error");
        return false;
    }
    
    if (!email || !esEmailValido(email)) {
        mostrarMensajeRecuperacion("⚠️ Por favor, ingresa un email válido.", "warning");
        return false;
    }
    
    try {
        mostrarCargandoRecuperacion(true);
        
        await firebase.auth().sendPasswordResetEmail(email, {
            url: window.location.origin + '/contenido_de_la_pagina/Inicio_de_sesion/Inicio_de_sesion.html',
            handleCodeInApp: false
        });
        
        console.log("✅ Email de recuperación enviado exitosamente");
        mostrarMensajeRecuperacion(
            "📧 Email de recuperación enviado. Revisa tu bandeja de entrada y spam.",
            "success"
        );
        
        return true;
        
    } catch (error) {
        console.error("❌ Error al enviar email de recuperación:", error);
        
        let mensajeError = "Error al enviar el email. Inténtalo de nuevo.";
        
        switch (error.code) {
            case 'auth/user-not-found':
                mensajeError = "❌ No existe una cuenta con ese email.";
                break;
            case 'auth/invalid-email':
                mensajeError = "❌ El formato del email no es válido.";
                break;
            case 'auth/too-many-requests':
                mensajeError = "⏰ Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";
                break;
            case 'auth/network-request-failed':
                mensajeError = "🌐 Error de conexión. Verifica tu internet.";
                break;
            default:
                mensajeError = `❌ Error: ${error.message}`;
        }
        
        mostrarMensajeRecuperacion(mensajeError, "error");
        return false;
        
    } finally {
        mostrarCargandoRecuperacion(false);
    }
}

// Validación de email
function esEmailValido(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Mostrar/ocultar loading
function mostrarCargandoRecuperacion(mostrar) {
    const btnRecuperar = document.getElementById('btnRecuperar');
    const iconoCarga = document.getElementById('iconoCargaRecuperacion');
    
    if (btnRecuperar) {
        if (mostrar) {
            btnRecuperar.disabled = true;
            btnRecuperar.innerHTML = '<span id="iconoCargaRecuperacion" class="icono-carga">🔄</span> Enviando...';
        } else {
            btnRecuperar.disabled = false;
            btnRecuperar.innerHTML = 'Enviar Email';
        }
    }
}

// Mostrar mensajes en el modal
function mostrarMensajeRecuperacion(mensaje, tipo = "info") {
    const mensajeAnterior = document.querySelector('.mensaje-recuperacion');
    if (mensajeAnterior) {
        mensajeAnterior.remove();
    }
    
    const mensajeDiv = document.createElement('div');
    mensajeDiv.className = `mensaje-recuperacion mensaje-${tipo}`;
    mensajeDiv.innerHTML = `
        <div class="mensaje-contenido">
            <span class="mensaje-icono">${obtenerIconoMensaje(tipo)}</span>
            <span class="mensaje-texto">${mensaje}</span>
            <button class="mensaje-cerrar" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    const modal = document.getElementById('modalRecuperacion');
    const formulario = modal ? modal.querySelector('.formulario-recuperacion') : null;
    
    if (formulario) {
        formulario.insertBefore(mensajeDiv, formulario.firstChild);
    }
    
    if (tipo === 'success') {
        setTimeout(() => {
            if (mensajeDiv.parentElement) {
                mensajeDiv.remove();
            }
        }, 5000);
    }
}

// Obtener iconos para mensajes
function obtenerIconoMensaje(tipo) {
    const iconos = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    return iconos[tipo] || 'ℹ️';
}

// Funciones del modal
function abrirModalRecuperacion() {
    const modal = document.getElementById('modalRecuperacion');
    if (modal) {
        modal.style.display = 'flex';
        
        const emailInput = document.getElementById('emailRecuperacion');
        const emailLogin = document.getElementById('email');
        
        // Pre-llenar con el email del formulario de login si existe
        if (emailInput && emailLogin && emailLogin.value.trim()) {
            emailInput.value = emailLogin.value.trim();
        }
        
        if (emailInput) {
            emailInput.focus();
        }
        
        const mensajeAnterior = document.querySelector('.mensaje-recuperacion');
        if (mensajeAnterior) {
            mensajeAnterior.remove();
        }
    }
}

function cerrarModalRecuperacion() {
    const modal = document.getElementById('modalRecuperacion');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Manejar formulario de recuperación
async function manejarFormularioRecuperacion(event) {
    event.preventDefault();
    
    const emailInput = document.getElementById('emailRecuperacion');
    const email = emailInput ? emailInput.value.trim() : '';
    
    if (!email) {
        mostrarMensajeRecuperacion("⚠️ Por favor, ingresa tu email.", "warning");
        return;
    }
    
    const exito = await recuperarContrasena(email);
    
    if (exito) {
        setTimeout(() => {
            cerrarModalRecuperacion();
        }, 3000);
    }
}

// Inicializar sistema de recuperación
function inicializarSistemaRecuperacion() {
    console.log("🔧 Inicializando sistema de recuperación de contraseña...");
    
    const btnOlvideContrasena = document.getElementById('btnOlvideContrasena');
    if (btnOlvideContrasena) {
        btnOlvideContrasena.addEventListener('click', function(e) {
            e.preventDefault();
            abrirModalRecuperacion();
        });
        console.log("✅ Botón 'Olvidé contraseña' configurado");
    }
    
    const modal = document.getElementById('modalRecuperacion');
    if (modal) {
        const btnCerrar = modal.querySelector('.cerrar-modal');
        if (btnCerrar) {
            btnCerrar.addEventListener('click', cerrarModalRecuperacion);
        }
        
        const formulario = modal.querySelector('.formulario-recuperacion');
        if (formulario) {
            formulario.addEventListener('submit', manejarFormularioRecuperacion);
        }
        
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                cerrarModalRecuperacion();
            }
        });
        
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && modal.style.display === 'flex') {
                cerrarModalRecuperacion();
            }
        });
        
        console.log("✅ Modal de recuperación configurado");
    }
    
    // Validación en tiempo real
    const emailInput = document.getElementById('emailRecuperacion');
    if (emailInput) {
        emailInput.addEventListener('input', function() {
            const email = this.value.trim();
            const btnRecuperar = document.getElementById('btnRecuperar');
            
            if (btnRecuperar) {
                btnRecuperar.disabled = !email || !esEmailValido(email);
            }
        });
    }
    
    console.log("🚀 Sistema de recuperación inicializado");
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        inicializarSistemaRecuperacion();
    }, 500);
});