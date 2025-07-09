document.addEventListener('DOMContentLoaded', function() {
    console.log("JavaScript conectado con exito.");
    
    // Llamado de documentos
    const signUp = document.getElementById('signUp');
    const signIn = document.getElementById('signIn');
    const nombreBox = document.getElementById('nombre-box'); // CORREGIDO: Ahora usa el ID correcto
    const termsBox = document.getElementById('terms-box');
    const title = document.getElementById('titulo');
    const submitBtn = document.getElementById('submit-btn');
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const nombreInput = document.querySelector('#nombre'); // CORREGIDO: Selector más específico
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
                            // 📧 NUEVO: Enviar email de verificación
                            return enviarEmailVerificacionSeguro(user);
                        })

                        .then(() => {
                            // Guardar datos en Firestore usando el UID del usuario
                            return db.collection('usuarios').doc(user.uid).set({
                                uid: user.uid,
                                nombre: nombre,
                                email: email,
                                emailVerificado: user.emailVerified, // Será false inicialmente
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
                    showMessage('¡Registro exitoso! 📧 Te hemos enviado un email de verificación. Por favor, verifica tu correo antes de iniciar sesión.');
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Registrarme';
                    
                    // 🔄 NUEVO: Cambiar automáticamente al modo de inicio de sesión
                    setTimeout(() => {
                        setLoginMode();
                        // Opcional: Pre-llenar el email en el formulario de login
                        if (emailInput) emailInput.value = email;
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

                    // Verificar si el email esta verificado
                    if (!user.emailVerified) {
                        // Si el email no esta verificado mostrara opciones
                        mostrarModalVerificacion(user);
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'iniciar sesión'
                        return; //detener el proceso de inicio de sesion
                    }

                    // si: email verificado - continuar con el inicio normalmente
                    //actualizar el estado de verificación en firestore
                    db.collection('usuarios').doc(user.uid).update({
                        emailVerificado: true,
                        'estadisticas.ultimaActividad': firebase.firestore.FieldValue.serverTimestamp()
                    }).catch((error)=>{ 
                        console.log("Error al actualizar estado de verificación", error);
                    });

                    showMessage('¡Inicio de sesión exitoso!')

                    //Guardad opcion "recordarme" si esta es marcada
                    if (rememberCheck && rememberCheck.checked) {
                        localStorage.setItem('rememberLogin', 'true');
                    } else {
                        localStorage.removeItem('rememberLogin')
                    }

                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Iniciar sesión'
                    
                    setTimeout(() => {
                        window.location.href = "/index.html";
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

    //===================================
    // Modal de términos y condiciones
    //=====================================

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

    // Inicializar inmediatamente (sin setTimeout)
    inicializarSistemaRecuperacion();
});

//======================================
// FUNCIONES PARA VERIFICACION DE EMAIL
//======================================

async function enviarEmailVerificacionSeguro(user) {
    console.log("Enviando email de verificacion de forma segura...")

    try{
        //primer intento: sin URL personalizada
        await user.sendEmailVerification();
        console.log("email de verificacion enviado con exito")
        return true;
    } catch (error) {
        console.error("error al enviar email de verificacion", error)

        //si falla, mostrar mensaje pero no bloquear el registro
        if (error.code === 'auth/unauthorized-continue-url'){
            console.log("URL no autorizada, pero usuario registrado existosamente")
        }

        //no lanzar error para no bloquear el flujo de registro
        return false;
    }
}

//========================================
// SISTEMA DE VERIFICACIÓN DE EMAIL
//========================================

//Mostrar modal de verificacion de email
function mostrarModalVerificacion(user){
    console.log("mostrando modal de verificacion para: ", user.email);

    //crear modal
    let modalVerificacion = document.getElementById('modalVerificacion');
    
    //mostrar el modal
    modalVerificacion.style.display = 'flex';

    configurarEventosModalesVerificacion(modalVerificacion, user);
}

//configurar eventos del modal de verificacion
function configurarEventosModalesVerificacion(modal,user) {
    //cerrar modal
    const btnCerrar = document.getElementById('cerrarModalVerificacion');
    if (btnCerrar){
        btnCerrar.addEventListener('click', ()=> {
            console.log("cerrando modal de verificacion")
            modal.style.display = 'none';
        });
    }

    const btnCancelar = document.getElementById('btnCancelarVerificacion');
    if (btnCancelar){
        btnCancelar.addEventListener('click', () =>{
            console.log("cancelando modal de verificacion")
            modal.style.display = 'none';
        })
    }

    //reenviar email de verificacion
    const btnReenviar = document.getElementById('btnReenviarVerificacion');
    if(btnReenviar){
        btnReenviar.addEventListener('click', async () =>{
            await reenviarEmailVerificacionSeguro(user);
        });
    }

    //cerrar al hacer click afuera del modal
    modal.addEventListener('click', (e)=>{
        if (e.target === modal){
            modal.style.display = 'none';
        }
    })
}

//reenviar email de verificacion de forma segura
async function reenviarEmailVerificacionSeguro(user) {
    console.log("Reenviando email de verificacion de forma segura para ", user.email)

    const btnReenviar = document.getElementById('btnReenviarVerificacion');

    try{
        //mostrar loading
        if (btnReenviar) {
            btnReenviar.disabled = true;
            btnReenviar.innerHTML = '<span style="animation: spin 1s linear infinite;">🔄</span> Enviando...';
        }

        //enviar email de verificacion sin URL personalizada 
        await user.sendEmailVerification();

        console.log("email de verificacion reenviado exitosamente ,':)");

        //mostrar mensaje de exito al usuario
        mostrarMensajeModalVerificacion("El email de verificacion ha sido enviado exitosamente. Revisa tu correo.");

    } catch(error) {
        console.log("error al reenviar el email de verificacion", error);

        let mensajeError = "Error al enviar email de verificacion.";

        switch (error.code) {
            case 'auth/too-many-request':
                mensajeError = "Demasiados intentos. espera unos minutos antes de intentar de nuevo";
            break;
            case 'auth/network-request-failed':
                mensajeError = "error de conexion. verifica tu conexion a internet";
            break;
            default:
                mensajeError = "Error: " + error.message;
        }
        mostrarMensajeModalVerificacion(mensajeError, "error")
    } finally {
        //restaurar boton
        if (btnReenviar) {
            btnReenviar.disabled = false;
            btnReenviar.innerHTML = 'Reenviar Email';
        }
    }
}

//mostrar mensaje en el modal de verficacion
function mostrarMensajeModalVerificacion(mensaje, tipo){
    const modal = document.getElementById('modalVerificacion');
    if (!modal) return;

    //elminar mensaje anterior
    const mensajeAnterior = modal.querySelector('.mensaje-verificacion');
    if (mensajeAnterior) {
        mensajeAnterior.remove();
    }

    const mensajeDiv = document.createElement('div');
    mensajeDiv.className = 'mensaje-Verificacion';
    mensajeDiv.style.cssText = `
        margin-bottom: 15px;
        padding: 10px;
        border-radius: 5px;
        font-size: 14px;
        ${tipo === 'success'?
            'backgroun-color: #d4edda; color: #155724; border:':
            'backgroun-color: #f8d7da; color:rgb(255, 255, 255);'
        }
    `;
    mensajeDiv.innerHTML = `
        <span>${mensaje}</span>
        <button onclick="this.parentElement.remove()" style="
            float: right;
            background: none;
            border: none;
            font-size: 16px;
            cursor: pointer;
        ">x</button
    `;

    const modalBody = modal.querySelector('div > div:last-child');
    modalBody.insertBefore(mensajeDiv, modalBody.firstChild);

    //auto eliminar despues de 5 segs
    if (tipo === 'success'){
        setTimeout(()=>{
            if (mensajeDiv.parentElement){
                mensajeDiv.remove();
            }
        }, 5000);
    }
}

//monitor de estado de autenticación
firebase.auth().onAuthStateChanged((user)=>{
    if (user){
        //refrescar informacion del ususario
        user.reload().then(()=>{
            if (user.emailVerified){
                //actualizar estado en firestore si ahora esta verificado
                db.collection('usuarios').doc(user.uid).update({
                    emailVerificado: true
                }). then(()=>{
                    console.log("estado de verificacion actualizdo en firestore");
                });
            }
        });
    }
});

//======================================================
//======= FUNCIONES DE RECUPERACIÓN DE CONTRASEÑA ======
//======================================================
// Función principal de recuperación (CORREGIDA)
async function recuperarContrasena(email) {
    console.log("🔄 Iniciando recuperación de contraseña para:", email);
    
    // Verificar que Firebase esté disponible
    if (!firebase || !firebase.auth) {
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
        
        //Envío simple sin URL personalizada para evitar el error de dominio
        await firebase.auth().sendPasswordResetEmail(email);
        
        console.log("✅ Email de recuperación enviado exitosamente");
        mostrarMensajeRecuperacion(
            "Email de recuperación enviado exitosamente. Revisa tu bandeja de entrada o carpeta de spam.",
            "success"
        );
        
        return true;
        
    } catch (error) {
        console.error("❌ Error al enviar email de recuperación:", error);
        
        let mensajeError = "Error al enviar el email. Inténtalo de nuevo.";
        
        switch (error.code) {
            case 'auth/user-not-found':
                mensajeError = "❌ No existe una cuenta registrada con ese email.";
                break;
            case 'auth/invalid-email':
                mensajeError = "❌ El formato del email no es válido.";
                break;
            case 'auth/too-many-requests':
                mensajeError = "⏰ Demasiados intentos. Espera unos minutos antes de intentar de nuevo.";
                break;
            case 'auth/network-request-failed':
                mensajeError = "🌐 Error de conexión. Verifica tu conexión a internet.";
                break;
            case 'auth/unauthorized-continue-url':
                mensajeError = "⚙️ Error de configuración. El email se enviará a la página por defecto de Firebase.";
                // Intentar envío sin URL personalizada
                try {
                    await firebase.auth().sendPasswordResetEmail(email);
                    mostrarMensajeRecuperacion("📧 Email de recuperación enviado. Revisa tu bandeja.", "success");
                    return true;
                } catch (retryError) {
                    console.error("Error en reintento:", retryError);
                }
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
    
    if (btnRecuperar) {
        if (mostrar) {
            btnRecuperar.disabled = true;
            btnRecuperar.innerHTML = '<span class="icono-carga">🔄</span> Enviando...';
        } else {
            btnRecuperar.disabled = false;
            btnRecuperar.innerHTML = 'Enviar';
        }
    }
}

// Mostrar mensajes en el modal
function mostrarMensajeRecuperacion(mensaje, tipo = "info") {
    // Eliminar mensaje anterior si existe
    const mensajeAnterior = document.querySelector('.mensaje-recuperacion');
    if (mensajeAnterior) {
        mensajeAnterior.remove();
    }
    
    const mensajeDiv = document.createElement('div');
    mensajeDiv.className = `mensaje-recuperacion mensaje-${tipo}`;
    mensajeDiv.innerHTML = `
        <div class="mensaje-contenido">
            <span class="mensaje-texto">${mensaje}</span>
            <button class="mensaje-cerrar" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    const modal = document.getElementById('modalRecuperacion');
    const formulario = modal ? modal.querySelector('.formulario-recuperacion') : null;
    
    if (formulario) {
        formulario.insertBefore(mensajeDiv, formulario.firstChild);
    }
    
    // Auto-eliminar mensajes de éxito después de 5 segundos
    if (tipo === 'success') {
        setTimeout(() => {
            if (mensajeDiv.parentElement) {
                mensajeDiv.remove();
            }
        }, 5000);
    }
}

// Funciones del modal
function abrirModalRecuperacion() {
    console.log("🔓 Abriendo modal de recuperación");
    const modal = document.getElementById('modalRecuperacion');
    if (modal) {
        modal.style.display = 'flex';
        
        // Pre-llenar con el email del formulario de login si existe
        const emailInput = document.getElementById('emailRecuperacion');
        const emailLogin = document.getElementById('email');
        
        if (emailInput && emailLogin && emailLogin.value.trim()) {
            emailInput.value = emailLogin.value.trim();
        }
        
        // Enfocar el input de email
        if (emailInput) {
            setTimeout(() => emailInput.focus(), 100);
        }
        
        // Limpiar mensajes anteriores
        const mensajeAnterior = document.querySelector('.mensaje-recuperacion');
        if (mensajeAnterior) {
            mensajeAnterior.remove();
        }
        
        // Resetear el estado del botón
        mostrarCargandoRecuperacion(false);
    }
}

function cerrarModalRecuperacion() {
    console.log("🔒 Cerrando modal de recuperación");
    const modal = document.getElementById('modalRecuperacion');
    if (modal) {
        modal.style.display = 'none';
        
        // Limpiar el formulario
        const emailInput = document.getElementById('emailRecuperacion');
        if (emailInput) {
            emailInput.value = '';
        }
        
        // Limpiar mensajes
        const mensajeAnterior = document.querySelector('.mensaje-recuperacion');
        if (mensajeAnterior) {
            mensajeAnterior.remove();
        }
    }
}

// CORREGIDO: Manejar formulario de recuperación
async function manejarFormularioRecuperacion(event) {
    event.preventDefault();
    console.log("📝 Procesando formulario de recuperación");
    
    const emailInput = document.getElementById('emailRecuperacion');
    const email = emailInput ? emailInput.value.trim() : '';
    
    if (!email) {
        mostrarMensajeRecuperacion("⚠️ Por favor, ingresa tu email.", "warning");
        return;
    }
    
    // Ejecutar la recuperación
    const exito = await recuperarContrasena(email);
    
    // Si fue exitoso, cerrar el modal después de 3 segundos
    if (exito) {
        setTimeout(() => {
            cerrarModalRecuperacion();
        }, 3000);
    }
}

// CORREGIDO: Inicializar sistema de recuperación
function inicializarSistemaRecuperacion() {
    console.log("Sistema de recuperacion de contraseña activo");
    
    // 1. Configurar botón "Olvidé mi contraseña"
    const btnOlvideContrasena = document.getElementById('btnOlvideContrasena');
    if (btnOlvideContrasena) {
        btnOlvideContrasena.addEventListener('click', function(e) {
            e.preventDefault();
            console.log("🔗 Click en 'Olvidé mi contraseña'");
            abrirModalRecuperacion();
        });
        console.log("✅ Botón 'Olvidé contraseña' configurado");
    } else {
        console.error("❌ No se encontró el botón 'Olvidé contraseña'");
    }
    
    // 2. Configurar modal de recuperación
    const modal = document.getElementById('modalRecuperacion');
    if (modal) {
        // Botón cerrar (X)
        const btnCerrar = modal.querySelector('.cerrar-modal');
        if (btnCerrar) {
            btnCerrar.addEventListener('click', cerrarModalRecuperacion);
            console.log("✅ Botón cerrar modal configurado");
        }
        
        // Botón cancelar
        const btnCancelar = document.getElementById('btnCancelarRecuperacion');
        if (btnCancelar) {
            btnCancelar.addEventListener('click', cerrarModalRecuperacion);
            console.log("✅ Botón cancelar configurado");
        }
        
        // CORREGIDO: Formulario de recuperación
        const formulario = document.getElementById('formularioRecuperacion');
        if (formulario) {
            formulario.addEventListener('submit', manejarFormularioRecuperacion);
            console.log("✅ Formulario de recuperación configurado");
        } else {
            console.error("❌ No se encontró el formulario de recuperación");
        }
        
        // Cerrar modal al hacer click fuera
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                cerrarModalRecuperacion();
            }
        });
        
        // Cerrar modal con tecla Escape
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && modal.style.display === 'flex') {
                cerrarModalRecuperacion();
            }
        });
        
        console.log("✅ Modal de recuperación configurado");
    } else {
        console.error("❌ No se encontró el modal de recuperación");
    }
    
    // 3. Validación en tiempo real del email
    const emailInput = document.getElementById('emailRecuperacion');
    if (emailInput) {
        emailInput.addEventListener('input', function() {
            const email = this.value.trim();
            const btnRecuperar = document.getElementById('btnRecuperar');
            
            if (btnRecuperar) {
                btnRecuperar.disabled = !email || !esEmailValido(email);
            }
        });
        console.log("✅ Validación en tiempo real configurada");
    }
    
    console.log("🚀 Sistema de recuperación inicializado correctamente");
}

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