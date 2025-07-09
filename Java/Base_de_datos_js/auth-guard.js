// Archivo auth-guard.js
document.addEventListener('DOMContentLoaded', function() {
    firebase.auth().onAuthStateChanged(function(user) {
        if (!user) {
            console.log("Usuario no autenticado, redirigiendo...");
            window.location.href = "/contenido_de_la_pagina/Inicio_de_sesion/Inicio_de_sesion.html";
        } else {
            console.log("Usuario autenticado:", user.email);
            
            // NUEVA LÍNEA: Cargar datos del usuario incluyendo configuración de tema
            firebase.firestore().collection('usuarios').doc(user.uid).get()
                .then((doc) => {
                    if (doc.exists) {
                        const userData = doc.data();
                        console.log("Datos del usuario:", userData);
                        
                        // Mostrar nombre del usuario
                        const nombreUsuarioElement = document.getElementById('nombre-usuario');
                        if (nombreUsuarioElement && userData.nombre) {
                            nombreUsuarioElement.textContent = userData.nombre;
                        }
                        
                        // NUEVA SECCIÓN: Aplicar configuración de tema
                        const temaOscuro = userData.configuracion?.temaOscuro || false;
                        const body = document.body;
                        const themeStatus = document.getElementById("theme-status");
                        
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
                        
                        console.log("Tema aplicado desde Firebase:", temaOscuro ? "Oscuro" : "Claro");
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
            e.preventDefault();
            
            if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
                firebase.auth().signOut()
                    .then(() => {
                        console.log("Sesión cerrada correctamente");
                        
                        // CAMBIO: Preservar solo el tema en localStorage
                        const theme = localStorage.getItem("theme");
                        localStorage.clear();
                        if (theme) localStorage.setItem("theme", theme);
                        sessionStorage.clear();
                        
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