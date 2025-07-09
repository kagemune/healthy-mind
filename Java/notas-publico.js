// ====== ARCHIVO: notas-publico.js ======
// Sistema unificado para mostrar notas tanto en "Mi Perfil" como en "Perfil Público"

console.log("🚀 Cargando notas-publico.js...");

// ====== CLASE UNIFICADA PARA AMBOS TIPOS DE PERFIL ======
class NotasPerfilUnificado {
  constructor() {
    this.notasCache = [];
    this.filtroActual = 'todas';
    this.isLoading = false;
    this.tipoPerfilActual = this.detectarTipoPerfil();
    this.usuarioTarget = null;
    this.usuarioActual = null;
    this.init();
  }

  // ====== DETECTAR QUÉ TIPO DE PERFIL ESTAMOS VIENDO ======
  detectarTipoPerfil() {
    // Buscar elementos únicos de cada tipo de perfil
    const esMiPerfil = document.getElementById('btnEditarPerfil') !== null;
    const esPerfilPublico = document.getElementById('btnSeguir') !== null;
    
    if (esMiPerfil) {
      console.log("🏠 Detectado: Mi Perfil");
      return 'mi_perfil';
    } else if (esPerfilPublico) {
      console.log("👤 Detectado: Perfil Público");
      return 'perfil_publico';
    } else {
      console.log("❓ Tipo de perfil no detectado, usando Mi Perfil por defecto");
      return 'mi_perfil';
    }
  }

  // ====== INICIALIZACIÓN ======
  async init() {
    try {
      console.log(`🔧 Inicializando para tipo: ${this.tipoPerfilActual}`);
      
      // Esperar a que Firebase esté listo
      await this.esperarFirebase();
      
      // Configurar según el tipo de perfil
      if (this.tipoPerfilActual === 'mi_perfil') {
        await this.configurarMiPerfil();
      } else {
        await this.configurarPerfilPublico();
      }
      
      // Configurar eventos para cambio de tabs
      this.configurarEventosTabs();
      
      console.log("✅ Sistema unificado inicializado");
      
    } catch (error) {
      console.error("❌ Error inicializando sistema unificado:", error);
    }
  }

  // ====== ESPERAR A QUE FIREBASE ESTÉ LISTO ======
  async esperarFirebase() {
    return new Promise((resolve) => {
      if (typeof firebase !== 'undefined' && firebase.auth().currentUser) {
        this.usuarioActual = firebase.auth().currentUser;
        resolve();
        return;
      }

      const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
        this.usuarioActual = user;
        unsubscribe();
        resolve();
      });
    });
  }

  // ====== CONFIGURAR PARA "MI PERFIL" ======
  async configurarMiPerfil() {
    if (!this.usuarioActual) {
      console.warn("⚠️ No hay usuario autenticado para Mi Perfil");
      return;
    }
    
    this.usuarioTarget = this.usuarioActual;
    console.log("🏠 Configurado para Mi Perfil - Usuario:", this.usuarioActual.uid);
  }

  // ====== CONFIGURAR PARA "PERFIL PÚBLICO" ======
  async configurarPerfilPublico() {
    // Obtener UID del usuario objetivo desde la URL o variables globales
    const urlParams = new URLSearchParams(window.location.search);
    const targetUid = urlParams.get('uid');
    const targetUsername = urlParams.get('user');
    
    // También intentar obtener desde variables globales si existen
    const uidGlobal = window.targetUser?.id || window.targetUid;
    
    const uidFinal = targetUid || uidGlobal;
    
    if (uidFinal) {
      this.usuarioTarget = { uid: uidFinal };
      console.log("👤 Configurado para Perfil Público - Usuario objetivo:", uidFinal);
    } else if (targetUsername) {
      // Buscar usuario por nombre
      try {
        const userSnapshot = await firebase.firestore()
          .collection('usuarios')
          .where('nombre', '==', targetUsername)
          .limit(1)
          .get();
        
        if (!userSnapshot.empty) {
          const userData = userSnapshot.docs[0];
          this.usuarioTarget = { uid: userData.id, ...userData.data() };
          console.log("👤 Usuario encontrado por nombre:", targetUsername);
        }
      } catch (error) {
        console.error("❌ Error buscando usuario por nombre:", error);
      }
    } else {
      console.warn("⚠️ No se pudo determinar el usuario objetivo para Perfil Público");
    }
  }

  // ====== CARGAR NOTAS SEGÚN EL TIPO DE PERFIL ======
  async cargarNotas() {
    if (this.isLoading || !this.usuarioTarget) return [];
    
    try {
      this.isLoading = true;
      console.log("🔄 Cargando notas...");
      
      const uid = this.usuarioTarget.uid;
      
      // Query base
      let query = firebase.firestore()
        .collection('notas')
        .where('autores', 'array-contains', uid)
        .where('papelera', '==', false);
      
      // Si es perfil público Y no es el usuario actual, solo mostrar públicas
      if (this.tipoPerfilActual === 'perfil_publico' && 
          this.usuarioActual && 
          this.usuarioActual.uid !== uid) {
        query = query.where('privada', '==', false);
        console.log("🔒 Filtrando solo notas públicas para perfil público");
      }
      
      const snapshot = await query.get();
      const notas = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Ordenar notas
      notas.sort((a, b) => {
        if (a.fijada && !b.fijada) return -1;
        if (!a.fijada && b.fijada) return 1;
        
        const fechaA = this.obtenerFechaDeNota(a);
        const fechaB = this.obtenerFechaDeNota(b);
        return fechaB - fechaA;
      });

      console.log(`📝 ${notas.length} notas cargadas`);
      this.notasCache = notas;
      
      // Actualizar estadísticas
      await this.actualizarEstadisticas(notas);
      
      return notas;
      
    } catch (error) {
      console.error("❌ Error cargando notas:", error);
      return [];
    } finally {
      this.isLoading = false;
    }
  }

  // ====== RENDERIZAR NOTAS EN EL TAB ======
  async renderizarNotas() {
    const tabNotas = document.getElementById('tab-notas');
    if (!tabNotas) {
      console.warn("⚠️ Tab de notas no encontrado");
      return;
    }

    try {
      if (this.notasCache.length === 0) {
        await this.cargarNotas();
      }

      const notasParaMostrar = this.aplicarFiltro(this.notasCache);
      
      tabNotas.innerHTML = '';

      if (notasParaMostrar.length === 0) {
        this.mostrarContenidoVacio(tabNotas);
      } else {
        this.mostrarContenidoConNotas(tabNotas, notasParaMostrar);
      }

    } catch (error) {
      console.error("❌ Error renderizando notas:", error);
      this.mostrarError(tabNotas, "Error al cargar las notas");
    }
  }

  // ====== MOSTRAR CONTENIDO VACÍO ======
  mostrarContenidoVacio(container) {
    const mensajes = {
      mi_perfil: {
        titulo: "Sin notas aún",
        descripcion: "Tus notas aparecerán aquí cuando las crees",
        boton: `<a href="/contenido_de_la_pagina/notas/escribirnota.html" class="btn-crear-nota">
                  <i class="bi bi-plus-circle"></i> Crear primera nota
                </a>`
      },
      perfil_publico: {
        titulo: "Sin notas públicas",
        descripcion: "Este usuario no ha compartido notas públicas",
        boton: ""
      }
    };

    const config = mensajes[this.tipoPerfilActual];
    
    container.innerHTML = `
      <div class="contenido-vacio">
        <i class="bi bi-file-earmark-text"></i>
        <h3>${config.titulo}</h3>
        <p>${config.descripcion}</p>
        ${config.boton}
      </div>
    `;
  }

  // ====== MOSTRAR CONTENIDO CON NOTAS ======
  mostrarContenidoConNotas(container, notas) {
    const stats = this.calcularEstadisticas(this.notasCache); // ✨ Usar notasCache para stats correctas
    
    // Filtros diferentes según el tipo de perfil
    const filtrosOptions = this.tipoPerfilActual === 'mi_perfil' ? `
      <option value="todas">Todas las notas</option>
      <option value="publicas">Públicas</option>
      <option value="privadas">Privadas</option>
      <option value="favoritas">Favoritas</option>
      <option value="fijadas">Fijadas</option>
    ` : `
      <option value="todas">Todas las notas</option>
      <option value="favoritas">Favoritas</option>
      <option value="fijadas">Fijadas</option>
    `;
    
    container.innerHTML = `
      <div class="notas-perfil-header">
        <div class="notas-stats">
          <span class="stat-item">📝 ${stats.total} notas</span>
          ${this.tipoPerfilActual === 'mi_perfil' ? 
            `<span class="stat-item">🔒 ${stats.privadas} privadas</span>` : ''}
          <span class="stat-item">⭐ ${stats.favoritas} favoritas</span>
          <span class="stat-item">📌 ${stats.fijadas} fijadas</span>
        </div>
        
        <div class="notas-filtros">
          <select id="filtro-notas-perfil" class="filtro-select">
            ${filtrosOptions}
          </select>
        </div>
      </div>

      <div class="notas-perfil-grid" id="notas-perfil-grid">
        ${notas.map(nota => this.crearTarjetaNota(nota)).join('')}
      </div>
    `;

    // ✨ Configurar eventos después de crear el HTML
    this.configurarEventosFiltro();
    this.configurarEventosNotas();
  }

  // ====== CREAR TARJETA DE NOTA ======
  crearTarjetaNota(nota) {
    const fecha = this.formatearFecha(nota.fechaCreacion || nota.timestamp);
    const contenidoPreview = this.truncarContenido(nota.content || '', 150);
    const indicadores = this.crearIndicadores(nota);
    const colorClass = nota.color || 'purple';

    // Botón de acción diferente según el tipo de perfil
    const botonAccion = this.tipoPerfilActual === 'mi_perfil' ? 
      `<a href="/contenido_de_la_pagina/notas/escribirnota.html?id=${nota.id}" class="btn-editar-nota-mini">
         <i class="bi bi-pencil"></i>
       </a>` :
      `<button class="btn-ver-nota-completa" data-nota-id="${nota.id}">
         <i class="bi bi-eye"></i> Ver
       </button>`;

    return `
      <div class="nota-perfil-card ${colorClass}" data-nota-id="${nota.id}">
        <div class="nota-perfil-header">
          <h4 class="nota-perfil-titulo">${nota.title || 'Sin título'}</h4>
          <div class="nota-perfil-indicadores">${indicadores}</div>
        </div>
        
        <div class="nota-perfil-contenido">
          ${contenidoPreview}
        </div>
        
        <div class="nota-perfil-footer">
          <small class="nota-perfil-fecha">📅 ${fecha}</small>
          ${botonAccion}
        </div>
      </div>
    `;
  }

  // ====== CONFIGURAR EVENTOS PARA TABS ======
  configurarEventosTabs() {
    // Interceptar clicks en tabs de notas
    document.addEventListener('click', (e) => {
      const tabBtn = e.target.closest('[data-tab="notas"]');
      if (tabBtn) {
        console.log("📝 Tab de notas activado");
        setTimeout(() => {
          this.renderizarNotas();
        }, 100);
      }
    });
  }

  // ====== CONFIGURAR EVENTOS DE FILTRO ======
  configurarEventosFiltro() {
    const filtroSelect = document.getElementById('filtro-notas-perfil');
    if (filtroSelect) {
      // ✨ Mantener el filtro actual seleccionado
      filtroSelect.value = this.filtroActual;
      
      // ✨ Remover listener anterior si existe
      filtroSelect.removeEventListener('change', this.handleFiltroChange);
      
      // ✨ Crear función bound para poder removerla después
      this.handleFiltroChange = (e) => {
        console.log(`🔍 Aplicando filtro: ${e.target.value}`);
        this.filtroActual = e.target.value;
        this.aplicarFiltroYRenderizar();
      };
      
      filtroSelect.addEventListener('change', this.handleFiltroChange);
    }
  }

  // ====== APLICAR FILTRO Y RENDERIZAR SOLO EL GRID ======
  aplicarFiltroYRenderizar() {
    const grid = document.getElementById('notas-perfil-grid');
    if (!grid) return;

    const notasParaMostrar = this.aplicarFiltro(this.notasCache);
    console.log(`📋 Mostrando ${notasParaMostrar.length} notas con filtro: ${this.filtroActual}`);

    if (notasParaMostrar.length === 0) {
      grid.innerHTML = `
        <div class="no-resultados-filtro">
          <i class="bi bi-search"></i>
          <h4>No se encontraron notas</h4>
          <p>No hay notas que coincidan con el filtro "${this.obtenerNombreFiltro()}"</p>
          <button onclick="window.notasPublico.cambiarFiltro('todas')" class="btn-ver-todas">
            Ver todas las notas
          </button>
        </div>
      `;
    } else {
      grid.innerHTML = notasParaMostrar.map(nota => this.crearTarjetaNota(nota)).join('');
    }

    // ✨ Reconfigurar eventos de notas después de renderizar
    this.configurarEventosNotas();
  }

  // ====== CONFIGURAR EVENTOS DE NOTAS ======
  configurarEventosNotas() {
    document.addEventListener('click', (e) => {
      if (e.target.closest('.btn-ver-nota-completa')) {
        e.stopPropagation();
        const notaId = e.target.closest('.btn-ver-nota-completa').getAttribute('data-nota-id');
        this.abrirNotaModal(notaId);
      } else if (e.target.closest('.nota-perfil-card') && this.tipoPerfilActual === 'perfil_publico') {
        const card = e.target.closest('.nota-perfil-card');
        const notaId = card.getAttribute('data-nota-id');
        this.abrirNotaModal(notaId);
      }
    });
  }

  // ====== ABRIR MODAL DE NOTA ======
  abrirNotaModal(notaId) {
    const nota = this.notasCache.find(n => n.id === notaId);
    if (!nota) return;

    if (typeof openNoteModal === 'function') {
      openNoteModal(nota.title || 'Sin título', nota.content || 'Sin contenido');
    } else {
      this.crearModalSimple(nota);
    }
  }

  // ====== CREAR MODAL SIMPLE ======
  crearModalSimple(nota) {
    const modalAnterior = document.getElementById('modal-nota-perfil-unificado');
    if (modalAnterior) modalAnterior.remove();

    const modal = document.createElement('div');
    modal.id = 'modal-nota-perfil-unificado';
    modal.className = 'modal-nota-overlay';
    modal.innerHTML = `
      <div class="modal-nota-contenido">
        <div class="modal-nota-header">
          <h2>${nota.title || 'Sin título'}</h2>
          <button class="modal-nota-cerrar">&times;</button>
        </div>
        <div class="modal-nota-body">
          ${nota.content || 'Sin contenido'}
        </div>
        <div class="modal-nota-footer">
          <small>📅 ${this.formatearFecha(nota.fechaCreacion || nota.timestamp)}</small>
          ${this.tipoPerfilActual === 'mi_perfil' ? 
            `<a href="/contenido_de_la_pagina/notas/escribirnota.html?id=${nota.id}" class="btn-editar-nota">
               <i class="bi bi-pencil"></i> Editar
             </a>` : ''}
        </div>
      </div>
    `;

    modal.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.8); z-index: 10000;
      display: flex; align-items: center; justify-content: center;
      padding: 20px;
    `;

    document.body.appendChild(modal);

    modal.querySelector('.modal-nota-cerrar').onclick = () => modal.remove();
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };

    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);
  }

  // ====== UTILIDADES ======
  obtenerFechaDeNota(nota) {
    const campos = ['fechaCreacion', 'timestamp', 'fecha'];
    for (const campo of campos) {
      if (nota[campo]) {
        try {
          return nota[campo].toDate ? nota[campo].toDate() : new Date(nota[campo]);
        } catch (error) {
          continue;
        }
      }
    }
    return new Date(0);
  }

  formatearFecha(timestamp) {
    if (!timestamp) return 'Fecha no disponible';
    try {
      const fecha = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return fecha.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch (error) {
      return 'Fecha no disponible';
    }
  }

  truncarContenido(contenido, limite = 150) {
    if (!contenido) return 'Sin contenido';
    const textoPlano = contenido.replace(/<[^>]*>/g, '');
    if (textoPlano.length <= limite) return textoPlano;
    return textoPlano.substring(0, limite) + '...';
  }

  crearIndicadores(nota) {
    const indicadores = [];
    if (nota.fijada) indicadores.push('<span class="indicador fijada" title="Fijada">📌</span>');
    if (nota.favorita) indicadores.push('<span class="indicador favorita" title="Favorita">⭐</span>');
    if (nota.privada && this.tipoPerfilActual === 'mi_perfil') {
      indicadores.push('<span class="indicador privada" title="Privada">🔒</span>');
    }
    return indicadores.join('');
  }

  // ====== APLICAR FILTRO MEJORADO ======
  aplicarFiltro(notas) {
    console.log(`🔍 Aplicando filtro "${this.filtroActual}" a ${notas.length} notas`);
    
    let notasFiltradas = [];
    
    switch (this.filtroActual) {
      case 'publicas': 
        notasFiltradas = notas.filter(nota => !nota.privada);
        break;
      case 'privadas': 
        notasFiltradas = notas.filter(nota => nota.privada);
        break;
      case 'favoritas': 
        notasFiltradas = notas.filter(nota => nota.favorita === true);
        break;
      case 'fijadas': 
        notasFiltradas = notas.filter(nota => nota.fijada === true);
        break;
      default: 
        notasFiltradas = notas;
    }
    
    console.log(`📋 Resultado del filtro: ${notasFiltradas.length} notas`);
    return notasFiltradas;
  }

  calcularEstadisticas(notas) {
    return {
      total: notas.length,
      publicas: notas.filter(n => !n.privada).length,
      privadas: notas.filter(n => n.privada).length,
      favoritas: notas.filter(n => n.favorita === true).length,
      fijadas: notas.filter(n => n.fijada === true).length
    };
  }

  async actualizarEstadisticas(notas) {
    const stats = this.calcularEstadisticas(notas);
    
    // Actualizar contador principal si existe
    const contadorNotas = document.getElementById('totalNotas');
    if (contadorNotas) {
      contadorNotas.textContent = stats.total;
    }

    console.log("📊 Estadísticas actualizadas:", stats);
  }

  mostrarError(container, mensaje) {
    container.innerHTML = `
      <div class="error-notas">
        <i class="bi bi-exclamation-triangle-fill"></i>
        <h3>Error</h3>
        <p>${mensaje}</p>
        <button onclick="window.notasPublico.renderizarNotas()" class="btn-reintentar">
          Reintentar
        </button>
      </div>
    `;
  }

  // ====== MÉTODOS PÚBLICOS ADICIONALES ======
  cambiarFiltro(filtro) {
    this.filtroActual = filtro;
    const filtroSelect = document.getElementById('filtro-notas-perfil');
    if (filtroSelect) {
      filtroSelect.value = filtro;
    }
    this.aplicarFiltroYRenderizar();
  }

  obtenerNombreFiltro() {
    const nombres = {
      'todas': 'Todas las notas',
      'publicas': 'Públicas',
      'privadas': 'Privadas',
      'favoritas': 'Favoritas',
      'fijadas': 'Fijadas'
    };
    return nombres[this.filtroActual] || this.filtroActual;
  }

  // ====== API PÚBLICA ======
  async recargar() {
    this.notasCache = [];
    await this.renderizarNotas();
  }
}

// ====== INICIALIZACIÓN AUTOMÁTICA ======
function inicializarSistemaUnificado() {
  console.log("🚀 Inicializando sistema unificado...");
  
  // Crear instancia global
  window.notasPublico = new NotasPerfilUnificado();
  
  console.log("✅ notas-publico.js listo");
}

// Ejecutar cuando esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', inicializarSistemaUnificado);
} else {
  inicializarSistemaUnificado();
}

console.log("✅ Archivo notas-publico.js cargado completamente");