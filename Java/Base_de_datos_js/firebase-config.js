// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCR2QOp1qGnPC9_EYbx_BJBZYhdiZknqKc",
  authDomain: "healthy-mind-d052a.firebaseapp.com",
  projectId: "healthy-mind-d052a",
  storageBucket: "healthy-mind-d052a.firebasestorage.app",
  messagingSenderId: "157316594591",
  appId: "1:157316594591:web:db9200e589d6a87643dbaa",
  measurementId: "G-EMKLH6L4CH"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Referencias a servicios
const auth = firebase.auth();
const db = firebase.firestore();

// Exportar para uso en otros archivos
const firebaseServices = {
  auth,
  db,
  firebase
};