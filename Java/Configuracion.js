document.addEventListener("DOMContentLoaded", function () {
    const body = document.body;
    const themeStatus = document.getElementById('theme-status');
    const toggleThemeBtn = document.getElementById('toggle-theme');

    // 🔹 Función para cambiar el tema
    function toggleDarkMode() {
        body.classList.toggle('dark-mode');
        const isDarkMode = body.classList.contains('dark-mode');
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        themeStatus.textContent = isDarkMode ? 'Oscuro' : 'Claro';
        
        // Actualizar configuración en Firestore si el usuario está autenticado
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                firebase.firestore().collection('usuarios').doc(user.uid).update({
                    'configuracion.temaOscuro': isDarkMode
                }).catch((error) => {
                    console.error("Error al actualizar tema:", error);
                });
            }
        });
    }

    // 🔹 Cargar el tema guardado al iniciar
    if (localStorage.getItem('theme') === 'dark') {
        body.classList.add('dark-mode');
        themeStatus.textContent = 'Oscuro';
    } else {
        themeStatus.textContent = 'Claro';
    }

    // 🔹 Cambiar tema
    if (toggleThemeBtn) {
        toggleThemeBtn.addEventListener('click', toggleDarkMode);
    }

    // Función para abrir modal
    function openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            // Prevenir scroll del body
            body.classList.add('modal-open');
            modal.classList.add('active');
        }
    }

    // Función para cerrar modal
    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            // Restaurar scroll del body
            body.classList.remove('modal-open');
            modal.classList.remove('active');
        }
    }

    // Botones de configuración
    const securityBtn = document.getElementById('security-btn');
    const privacyBtn = document.getElementById('privacy-btn');
    const termsBtn = document.getElementById('terms-btn');
    const aboutBtn = document.getElementById('about-btn');
    const deactivateBtn = document.getElementById('deactivate-btn');
    const deleteBtn = document.getElementById('delete-btn');
    const changePasswordBtn = document.querySelector('.config_item:nth-child(3)'); 
    const confirmDeactivateBtn = document.querySelector('.confirm-deactivate-btn');
    const confirmDeleteBtn = document.querySelector('.confirm-delete-btn');
    const quienesSomosBtn = document.getElementById('quienes-somos-btn');


    if (securityBtn) {
        securityBtn.addEventListener('click', () => openModal('security-modal'));
    }

    if (privacyBtn) {
        privacyBtn.addEventListener('click', () => openModal('privacy-modal'));
    }

    if (termsBtn) {
        termsBtn.addEventListener('click', () => openModal('terms-modal'));
    }

    if (aboutBtn) {
        aboutBtn.addEventListener('click', () => openModal('about-modal'));
    }

   if (deactivateBtn) {
    deactivateBtn.addEventListener('click', () => openModal('deactivate-modal'));
}
    if (deleteBtn) {
    deleteBtn.addEventListener('click', () => openModal('delete-modal'));
}
  
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', () => openModal('change-password-modal'));
    }

    if (quienesSomosBtn) {
         quienesSomosBtn.addEventListener('click', () => {
            window.location.href = "/contenido_de_la_pagina/Quienes_somos/quienes_somos.html";
            });
    }

    // Cerrar modales con X
    const closeButtons = document.querySelectorAll('.close-btn');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modalId = e.target.getAttribute('data-modal');
            closeModal(modalId);
        });
    });

    // Botones de cancelar en modales de confirmación
    const cancelButtons = document.querySelectorAll('.cancel-btn');
    cancelButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.cambio_modal');
            if (modal) {
                body.classList.remove('modal-open');
                modal.classList.remove('active');
            }
        });
    });

// Event listener para confirmar contraseña
const confirmPasswordBtn = document.querySelector('.confirm-password-btn');
if (confirmPasswordBtn) {
    confirmPasswordBtn.addEventListener('click', () => {
        const password = document.getElementById('current-password').value;
        if (password.trim() === '') {
            alert('Por favor, ingresa tu contraseña actual.');
            return;
        }
        
        // Guardar la contraseña y la acción pendiente
        window.pendingPassword = password;
        closeModal('confirm-password-modal');
        
        // Ejecutar la acción pendiente
        if (window.pendingAction === 'deactivate') {
            executeDeactivateAccount();
        } else if (window.pendingAction === 'delete') {
            executeDeleteAccount();
        }
    });
}

    // Cerrar modal al hacer clic fuera del contenido
    const modals = document.querySelectorAll('.cambio_modal');
    modals.forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                body.classList.remove('modal-open');
                modal.classList.remove('active');
            }
        });
    });
    // Función para reautenticar usuario

async function reauthenticateUser(password) {
    const user = firebase.auth().currentUser;
    if (!user) throw new Error('No hay usuario autenticado');
    
    // Crear credential sin disparar prompt
    const credential = firebase.auth.EmailAuthProvider.credential(user.email, password);
    
    // Re-autenticar de forma silenciosa
    return user.reauthenticateWithCredential(credential);
}

    // 🔹 Función para verificar autenticación con timeout
    function waitForAuth(timeout = 3000) {
        return new Promise((resolve, reject) => {
            const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
                unsubscribe();
                if (user) {
                    resolve(user);
                } else {
                    reject(new Error('Usuario no autenticado'));
                }
            });

            // Timeout de seguridad
            setTimeout(() => {
                unsubscribe();
                reject(new Error('Timeout: Verificación de autenticación'));
            }, timeout);
        });
    }

    // 🔥 FUNCIONALIDAD DESACTIVAR CUENTA
// Reemplazar toda la función del botón de desactivar cuenta
async function executeDeactivateAccount() {
    try {
        confirmDeactivateBtn.textContent = 'Verificando contraseña...';
        confirmDeactivateBtn.disabled = true;

        const user = await waitForAuth();
        
        // Reautenticar INMEDIATAMENTE después de obtener el usuario
        await reauthenticateUser(window.pendingPassword);
        
        confirmDeactivateBtn.textContent = 'Desactivando...';

        await firebase.firestore().collection('usuarios').doc(user.uid).update({
            activo: false,
            fechaDesactivacion: firebase.firestore.FieldValue.serverTimestamp(),
            'estadisticas.ultimaActividad': firebase.firestore.FieldValue.serverTimestamp()
        });

        console.log('Cuenta desactivada correctamente');
        alert('Tu cuenta ha sido desactivada correctamente. Podrás reactivarla iniciando sesión nuevamente.');
        
        await firebase.auth().signOut();
        
        // Limpiar storage solo si está disponible
        if (typeof Storage !== 'undefined') {
            localStorage.removeItem('userSession');
            localStorage.removeItem('theme');
            sessionStorage.clear();
        }
        
        window.location.href = "/contenido_de_la_pagina/Inicio_de_sesion/Inicio_de_sesion.html";

    } catch (error) {
        console.error('Error al desactivar cuenta:', error);
        
        let errorMessage = 'Error al desactivar la cuenta';
        if (error.code === 'auth/wrong-password') {
            errorMessage = 'Contraseña incorrecta. Por favor, verifica tu contraseña.';
        } else if (error.code === 'auth/too-many-requests') {
            errorMessage = 'Demasiados intentos fallidos. Intenta nuevamente más tarde.';
        } else if (error.message.includes('no autenticado')) {
            errorMessage = 'Sesión expirada. Por favor, inicia sesión nuevamente.';
        }
        
        alert(errorMessage);
        confirmDeactivateBtn.textContent = 'Desactivar';
        confirmDeactivateBtn.disabled = false;
    }
    
    // Limpiar contraseña temporal
    delete window.pendingPassword;
    delete window.pendingAction;
}

    // 🔥 FUNCIONALIDAD ELIMINAR CUENTA
   // Reemplazar toda la función del botón de eliminar cuenta
if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', () => {



        window.pendingAction = 'delete';
        document.getElementById('current-password').value = '';
        closeModal('delete-modal');
        openModal('confirm-password-modal');
    });
}

if (confirmDeactivateBtn) {
    confirmDeactivateBtn.addEventListener('click', () => {
        window.pendingAction = 'deactivate';
        document.getElementById('current-password').value = '';
        closeModal('deactivate-modal');
        openModal('confirm-password-modal');
    });
}

// Función para ejecutar la eliminación de cuenta
async function executeDeleteAccount() {
    try {
        confirmDeleteBtn.textContent = 'Verificando contraseña...';
        confirmDeleteBtn.disabled = true;

        const user = await waitForAuth();
        
        // Reautenticar INMEDIATAMENTE después de obtener el usuario
        await reauthenticateUser(window.pendingPassword);
        
        confirmDeleteBtn.textContent = 'Eliminando...';

        const batch = firebase.firestore().batch();
        const userId = user.uid;

        // Eliminar datos de Firestore
        const userRef = firebase.firestore().collection('usuarios').doc(userId);
        batch.delete(userRef);

        const configRef = firebase.firestore().collection('configuraciones').doc(userId);
        batch.delete(configRef);

        const comentariosSnapshot = await firebase.firestore()
            .collection('comentarios')
            .where('uid', '==', userId)
            .get();

        comentariosSnapshot.forEach((doc) => {
            batch.delete(doc.ref);
        });

        const respuestasSnapshot = await firebase.firestore()
            .collection('respuestas')
            .where('uid', '==', userId)
            .get();

        respuestasSnapshot.forEach((doc) => {
            batch.delete(doc.ref);
        });

        const mensajesSnapshot = await firebase.firestore()
            .collection('mensajes')
            .where('autorId', '==', userId)
            .get();

        mensajesSnapshot.forEach((doc) => {
            batch.delete(doc.ref);
        });

        const chatsSnapshot = await firebase.firestore()
            .collection('chats')
            .where('participantes', 'array-contains', userId)
            .get();

        chatsSnapshot.forEach((doc) => {
            const chatData = doc.data();
            const participantes = chatData.participantes.filter(p => p !== userId);
            
            if (participantes.length === 0) {
                batch.delete(doc.ref);
            } else {
                batch.update(doc.ref, { participantes: participantes });
            }
        });

        await batch.commit();
        console.log('Datos de Firestore eliminados correctamente');

        await user.delete();
        console.log('Cuenta eliminada completamente');
        
        // Limpiar storage solo si está disponible
        if (typeof Storage !== 'undefined') {
            localStorage.clear();
            sessionStorage.clear();
        }
        
        alert('Tu cuenta y todos tus datos han sido eliminados permanentemente.');
        window.location.href = "/contenido_de_la_pagina/Inicio_de_sesion/Inicio_de_sesion.html";

    } catch (error) {
        console.error('Error al eliminar cuenta:', error);
        
        let errorMessage = 'Error al eliminar la cuenta';
        if (error.code === 'auth/wrong-password') {
            errorMessage = 'Contraseña incorrecta. Por favor, verifica tu contraseña.';
        } else if (error.code === 'auth/too-many-requests') {
            errorMessage = 'Demasiados intentos fallidos. Intenta nuevamente más tarde.';
        } else if (error.message.includes('no autenticado')) {
            errorMessage = 'Sesión expirada. Por favor, inicia sesión nuevamente.';
        }
        
        alert(errorMessage);
        confirmDeleteBtn.textContent = 'Eliminar definitivamente';
        confirmDeleteBtn.disabled = false;
    }
    
    // Limpiar contraseña temporal
    delete window.pendingPassword;
    delete window.pendingAction;
}
});