// Archivo auth-guard.js
document.addEventListener('DOMContentLoaded', function() {
    // Verificar si el usuario está autenticado
    firebase.auth().onAuthStateChanged(function(user) {
        if (!user) {
            // Usuario no autenticado, redirigir a la página de inicio de sesión
            console.log("Usuario no autenticado, redirigiendo...");
            window.location.href = "/contenido_de_la_pagina/Inicio_de_sesion/Inicio_de_sesion.html"; // Corregida la ruta
        } else {
            // Usuario autenticado, permitir acceso a la página
            console.log("Usuario autenticado:", user.email);
            
            // Opcional: Cargar datos del usuario desde Firestore
            firebase.firestore().collection('usuarios').doc(user.uid).get()
                .then((doc) => {
                    if (doc.exists) {
                        const userData = doc.data();
                        console.log("Datos del usuario:", userData);
                        
                        // Puedes usar estos datos para personalizar la página
                        // Por ejemplo, mostrar el nombre del usuario
                        const nombreUsuarioElement = document.getElementById('nombre-usuario');
                        if (nombreUsuarioElement && userData.nombre) {
                            nombreUsuarioElement.textContent = userData.nombre;
                        }
                    }
                })
                .catch((error) => {
                    console.error("Error al obtener datos del usuario:", error);
                });
        }
    });
    
    // Agregar funcionalidad para cerrar sesión
    const cerrarSesionBtn = document.getElementById('cerrar-sesion');
    if (cerrarSesionBtn) {
        cerrarSesionBtn.addEventListener('click', function(e) {
            e.preventDefault(); // Prevenir comportamiento por defecto
            
            // Confirmar antes de cerrar sesión
            if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
                firebase.auth().signOut()
                    .then(() => {
                        console.log("Sesión cerrada correctamente");
                        // Limpiar cualquier dato almacenado localmente
                        localStorage.removeItem('userSession');
                        sessionStorage.clear();
                        
                        // Redirigir a la página de inicio de sesión
                        window.location.href = "/contenido_de_la_pagina/Inicio_de_sesion/Inicio_de_sesion.html";
                    })
                    .catch((error) => {
                        console.error("Error al cerrar sesión:", error);
                        alert("Error al cerrar sesión. Por favor, inténtalo de nuevo.");
                    });
            }
        });
    }
    
    // También buscar otros posibles botones de cerrar sesión
    const logoutButtons = document.querySelectorAll('[data-action="logout"], .logout-btn, .cerrar-sesion');
    logoutButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            
            if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
                firebase.auth().signOut()
                    .then(() => {
                        console.log("Sesión cerrada correctamente");
                        localStorage.removeItem('userSession');
                        sessionStorage.clear();
                        window.location.href = "/contenido_de_la_pagina/Inicio_de_sesion/Inicio_de_sesion.html";
                    })
                    .catch((error) => {
                        console.error("Error al cerrar sesión:", error);
                        alert("Error al cerrar sesión. Por favor, inténtalo de nuevo.");
                    });
            }
        });
    });
});