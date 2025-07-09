const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
require('dotenv').config();

const app = express();
exports.app = app;
app.use(express.json());
app.use(cors());

// APII.js (Backend - Firebase Admin SDK)
const admin = require('firebase-admin');

// Configuración desde variables de entorno (mejor práctica)
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

module.exports = {
  auth: admin.auth(),
  db: admin.firestore(),
  admin  // Opcional: exportar el admin completo
};

// Servir archivos estáticos desde la carpeta actual
app.use(express.static(path.join(__dirname, '')));

// Instanciamos la IA de Google Generative
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: 'models/gemini-1.5-flash-8b' }, { apiVersion: 'v1beta' });

// Cache para evitar llamadas duplicadas
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

// Sistema de debounce por usuario/sesión
const pendingRequests = new Map();
const DEBOUNCE_DELAY = 3000; // 3 segundos

// Instrucciones específicas para verificar contenido apropiado
const INSTRUCCION_MODERACION = `
Tu tarea es actuar como un moderador de contenido automático. Analiza el comentario proporcionado y determina si es apropiado para ser publicado o si contiene elementos inapropiados como:

1. Lenguaje ofensivo, insultos o groserías
2. Discurso de odio o discriminación
3. Acoso, amenazas o intimidación
4. Contenido sexual explícito
5. Violencia gráfica o excesiva
6. Promoción de actividades ilegales
7. Spam o contenido comercial no solicitado
8. Información personal identificable (sin consentimiento)
9. Desinformación peligrosa

Responde en formato JSON con estos campos EXACTOS:
- clasificacion: "aprobado" (si el contenido es apropiado) o "rechazado" (si contiene elementos inapropiados)
- explicacion: Si es rechazado, explica muy pero muy brevemente por qué. Si es aprobado, simplemente indica "Contenido apropiado".

Responde SOLO con el JSON, sin texto adicional.
`;

// Función para generar hash simple del contenido
function generateContentHash(content) {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convertir a entero de 32 bits
  }
  return hash.toString();
}

// Función para limpiar cache expirado
function cleanExpiredCache() {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      cache.delete(key);
    }
  }
}

// Función para moderar contenido con optimizaciones
async function moderarContenido(contenido) {
  try {
    // Limpiar contenido
    const contenidoLimpio = contenido.trim();
    if (!contenidoLimpio) {
      return {
        clasificacion: "rechazado",
        explicacion: "El comentario está vacío"
      };
    }

    // Generar hash para cache
    const contentHash = generateContentHash(contenidoLimpio.toLowerCase());
    
    // Verificar cache
    if (cache.has(contentHash)) {
      const cachedResult = cache.get(contentHash);
      if (Date.now() - cachedResult.timestamp < CACHE_DURATION) {
        console.log('Resultado obtenido del cache');
        return cachedResult.result;
      } else {
        cache.delete(contentHash);
      }
    }

    console.log('Enviando petición a Gemini API...');
    
    // Instrucción optimizada para respuestas rápidas y precisas
    const result = await model.generateContent(
      `${INSTRUCCION_MODERACION}
      
      Comentario: "${contenidoLimpio}"`
    );
    
    const response = await result.response;
    const text = response.text().trim();
    
    let moderationResult;
    
    // Intentar parsear la respuesta como JSON
    try {
      // Eliminar cualquier texto que no sea JSON
      const jsonMatch = text.match(/\{.*\}/s);
      if (jsonMatch) {
        const jsonText = jsonMatch[0];
        moderationResult = JSON.parse(jsonText);
      } else {
        // Respuesta por defecto si no se detecta JSON
        moderationResult = {
          clasificacion: "rechazado",
          explicacion: "No se pudo analizar correctamente el contenido. Por precaución, el comentario no será publicado."
        };
      }
    } catch (parseError) {
      console.error("Error al parsear JSON de respuesta:", parseError);
      moderationResult = {
        clasificacion: "rechazado",
        explicacion: "Error en el sistema de moderación. Por precaución, el comentario no será publicado."
      };
    }

    // Guardar en cache
    cache.set(contentHash, {
      result: moderationResult,
      timestamp: Date.now()
    });

    return moderationResult;

  } catch (error) {
    console.error("Error al generar respuesta de moderación:", error);
    throw error;
  }
}

// Endpoint para moderar contenido con debounce y cache
app.post('/moderar', async (req, res) => {
  try {
    const { contenido } = req.body;
    
    if (!contenido || contenido.trim() === '') {
      return res.status(400).json({ 
        clasificacion: "rechazado",
        explicacion: "El comentario está vacío"
      });
    }

    // Identificador único para la sesión (usando IP + contenido hash como clave simple)
    const sessionId = req.ip + '_' + generateContentHash(contenido);
    
    // Cancelar petición pendiente anterior si existe
    if (pendingRequests.has(sessionId)) {
      clearTimeout(pendingRequests.get(sessionId).timeout);
      // Rechazar la promesa anterior
      pendingRequests.get(sessionId).reject(new Error('Request superseded'));
    }

    // Crear nueva promesa con debounce
    const debouncedPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(async () => {
        try {
          console.log(`Procesando petición después de ${DEBOUNCE_DELAY}ms de espera`);
          const resultado = await moderarContenido(contenido);
          
          // Limpiar la petición pendiente
          pendingRequests.delete(sessionId);
          
          resolve(resultado);
        } catch (error) {
          pendingRequests.delete(sessionId);
          reject(error);
        }
      }, DEBOUNCE_DELAY);

      // Guardar la petición pendiente
      pendingRequests.set(sessionId, { timeout, reject });
    });

    // Esperar el resultado del debounce
    const resultado = await debouncedPromise;
    res.json(resultado);

  } catch (error) {
    if (error.message === 'Request superseded') {
      // Esta petición fue cancelada por una nueva, no enviar respuesta
      return;
    }
    
    console.error("Error en endpoint de moderación:", error);
    res.status(500).json({ 
      clasificacion: "rechazado",
      explicacion: "Error en el servidor de moderación" 
    });
  }
});

// Mantener el endpoint original para compatibilidad
app.post('/preguntar', async (req, res) => {
  const { pregunta } = req.body;
  res.json({ 
    respuesta: "Este endpoint ha sido deprecado. Por favor usa /moderar para el sistema de moderación de contenido." 
  });
});

// Ruta para servir la página HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'pagina_principal_Coemntarios_Beta.js'));
});

// Limpiar cache cada 10 minutos
setInterval(cleanExpiredCache, 10 * 60 * 1000);

// Limpiar peticiones pendientes al cerrar servidor
process.on('SIGINT', () => {
  console.log('Cerrando servidor y limpiando peticiones pendientes...');
  for (const [sessionId, request] of pendingRequests.entries()) {
    clearTimeout(request.timeout);
    request.reject(new Error('Server shutting down'));
  }
  pendingRequests.clear();
  process.exit(0);
});

const PORT = process.env.PORT || 5000;

app.listen(PORT,'0.0.0.0', () => {
  console.log(`Servidor de moderación automática corriendo en el puerto ${PORT}`);
  console.log(`Debounce configurado a ${DEBOUNCE_DELAY}ms para optimizar llamadas a la API`);
  console.log(`Cache activado con duración de ${CACHE_DURATION/1000/60} minutos`);
  console.log(`Accede al sistema en http://localhost:${PORT}`);
});