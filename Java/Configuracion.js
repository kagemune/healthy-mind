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
    const confirmDeactivateBtn = document.querySelector('.confirm-deactivate-btn');
    if (confirmDeactivateBtn) {
        confirmDeactivateBtn.addEventListener('click', async () => {
            try {
                // Mostrar indicador de carga
                confirmDeactivateBtn.textContent = 'Verificando...';
                confirmDeactivateBtn.disabled = true;

                // Esperar a que Firebase verifique la autenticación
                const user = await waitForAuth();
                
                // Mostrar que está procesando
                confirmDeactivateBtn.textContent = 'Desactivando...';

                // Actualizar el estado del usuario en Firestore
                await firebase.firestore().collection('usuarios').doc(user.uid).update({
                    activo: false,
                    fechaDesactivacion: firebase.firestore.FieldValue.serverTimestamp(),
                    'estadisticas.ultimaActividad': firebase.firestore.FieldValue.serverTimestamp()
                });

                console.log('Cuenta desactivada correctamente');
                
                // Mostrar mensaje de éxito
                alert('Tu cuenta ha sido desactivada correctamente. Podrás reactivarla iniciando sesión nuevamente.');
                
                // Cerrar sesión y redirigir
                await firebase.auth().signOut();
                
                // Limpiar datos locales
                localStorage.removeItem('userSession');
                localStorage.removeItem('theme');
                sessionStorage.clear();
                
                // Redirigir a inicio de sesión
                window.location.href = "/contenido_de_la_pagina/Inicio_de_sesion/Inicio_de_sesion.html";

            } catch (error) {
                console.error('Error al desactivar cuenta:', error);
                
                let errorMessage = 'Error al desactivar la cuenta';
                if (error.message.includes('Timeout')) {
                    errorMessage = 'Por favor, espera un momento y vuelve a intentarlo. La aplicación se está cargando.';
                } else if (error.message.includes('no autenticado')) {
                    errorMessage = 'Sesión expirada. Por favor, inicia sesión nuevamente.';
                } else {
                    errorMessage += ': ' + error.message;
                }
                
                alert(errorMessage);
                
                // Restaurar botón
                confirmDeactivateBtn.textContent = 'Desactivar';
                confirmDeactivateBtn.disabled = false;
            }
        });
    }

    // 🔥 FUNCIONALIDAD ELIMINAR CUENTA
    const confirmDeleteBtn = document.querySelector('.confirm-delete-btn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', async () => {
            // Doble confirmación para eliminar cuenta
            const confirmacion = confirm('⚠️ ÚLTIMA CONFIRMACIÓN: Esta acción eliminará PERMANENTEMENTE todos tus datos. ¿Estás completamente seguro?');
            
            if (!confirmacion) {
                return;
            }

            try {
                // Mostrar indicador de carga
                confirmDeleteBtn.textContent = 'Verificando...';
                confirmDeleteBtn.disabled = true;

                // Esperar a que Firebase verifique la autenticación
                const user = await waitForAuth();
                
                // Mostrar que está procesando
                confirmDeleteBtn.textContent = 'Eliminando...';

                const batch = firebase.firestore().batch();
                const userId = user.uid;

                // 1. Eliminar documento del usuario
                const userRef = firebase.firestore().collection('usuarios').doc(userId);
                batch.delete(userRef);

                // 2. Eliminar configuraciones del usuario
                const configRef = firebase.firestore().collection('configuraciones').doc(userId);
                batch.delete(configRef);

                // 3. Buscar y eliminar comentarios del usuario
                const comentariosSnapshot = await firebase.firestore()
                    .collection('comentarios')
                    .where('uid', '==', userId)
                    .get();

                comentariosSnapshot.forEach((doc) => {
                    batch.delete(doc.ref);
                });

                // 4. Buscar y eliminar respuestas del usuario
                const respuestasSnapshot = await firebase.firestore()
                    .collection('respuestas')
                    .where('uid', '==', userId)
                    .get();

                respuestasSnapshot.forEach((doc) => {
                    batch.delete(doc.ref);
                });

                // 5. Buscar y eliminar mensajes del usuario
                const mensajesSnapshot = await firebase.firestore()
                    .collection('mensajes')
                    .where('autorId', '==', userId)
                    .get();

                mensajesSnapshot.forEach((doc) => {
                    batch.delete(doc.ref);
                });

                // 6. Buscar chats donde el usuario participa y eliminarlo de la lista
                const chatsSnapshot = await firebase.firestore()
                    .collection('chats')
                    .where('participantes', 'array-contains', userId)
                    .get();

                chatsSnapshot.forEach((doc) => {
                    const chatData = doc.data();
                    const participantes = chatData.participantes.filter(p => p !== userId);
                    
                    if (participantes.length === 0) {
                        // Si no quedan participantes, eliminar el chat
                        batch.delete(doc.ref);
                    } else {
                        // Si quedan participantes, solo remover al usuario
                        batch.update(doc.ref, { participantes: participantes });
                    }
                });

                // Ejecutar todas las eliminaciones
                await batch.commit();

                console.log('Datos de Firestore eliminados correctamente');

                // 7. Eliminar cuenta de Authentication
                await user.delete();

                console.log('Cuenta eliminada completamente');
                
                // Limpiar datos locales
                localStorage.clear();
                sessionStorage.clear();
                
                // Mostrar mensaje de confirmación
                alert('Tu cuenta y todos tus datos han sido eliminados permanentemente.');
                
                // Redirigir a inicio de sesión
                window.location.href = "/contenido_de_la_pagina/Inicio_de_sesion/Inicio_de_sesion.html";

            } catch (error) {
                console.error('Error al eliminar cuenta:', error);
                
                let errorMessage = 'Error al eliminar la cuenta';
                
                if (error.message.includes('Timeout')) {
                    errorMessage = 'Por favor, espera un momento y vuelve a intentarlo. La aplicación se está cargando.';
                } else if (error.message.includes('no autenticado')) {
                    errorMessage = 'Sesión expirada. Por favor, inicia sesión nuevamente.';
                } else if (error.code === 'auth/requires-recent-login') {
                    errorMessage = 'Por seguridad, necesitas haber iniciado sesión recientemente. Cierra sesión e inicia sesión nuevamente, luego intenta eliminar tu cuenta.';
                } else if (error.message) {
                    errorMessage += ': ' + error.message;
                }
                
                alert(errorMessage);
                
                // Restaurar botón
                confirmDeleteBtn.textContent = 'Eliminar definitivamente';
                confirmDeleteBtn.disabled = false;
            }
        });
    }

    // 🔹 Función auxiliar para reautenticar usuario (si es necesario)
    async function reauthenticateUser() {
        return new Promise((resolve, reject) => {
            const user = firebase.auth().currentUser;
            const password = prompt('Por favor, confirma tu contraseña actual para continuar:');
            
            if (!password) {
                reject(new Error('Contraseña requerida'));
                return;
            }

            const credential = firebase.auth.EmailAuthProvider.credential(
                user.email,
                password
            );

            user.reauthenticateWithCredential(credential)
                .then(() => resolve())
                .catch((error) => reject(error));
        });
    }
});