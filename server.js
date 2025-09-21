const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Configuration CORS pour Socket.io
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:3000", "http://libekoo.me"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Servir les fichiers statiques en production
app.use(express.static(path.join(__dirname, 'dist')));

// ==========================================
// STOCKAGE IN-MEMORY
// ==========================================
const users = new Map(); // userId -> userData
const onlineUsers = new Set(); // Set des userId en ligne
const chatSessions = new Map(); // sessionId -> sessionData
const messages = new Map(); // sessionId -> array of messages
const waitingUsers = {
  chat: [],
  video: [],
  group: []
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================
const generateUserId = () => {
  return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const generateSessionId = () => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const getOnlineCount = () => {
  return onlineUsers.size;
};

const getWaitingCounts = () => {
  return {
    chat: waitingUsers.chat.length,
    video: waitingUsers.video.length,
    group: waitingUsers.group.length
  };
};

// ==========================================
// SOCKET.IO EVENTS
// ==========================================
io.on('connection', (socket) => {
  console.log('✅ Nouveau client connecté:', socket.id);
  
  let currentUserId = null;

  // Inscription/Connexion utilisateur
  socket.on('user:register', (userData, callback) => {
    try {
      const userId = generateUserId();
      const user = {
        id: userId,
        socketId: socket.id,
        username: userData.username || `Anonyme_${Math.floor(Math.random() * 9999)}`,
        isAnonymous: userData.isAnonymous !== false,
        location: userData.location || null,
        avatar: userData.avatar || null,
        createdAt: new Date(),
        status: 'online'
      };
      
      users.set(userId, user);
      onlineUsers.add(userId);
      currentUserId = userId;
      
      console.log(`👤 Nouvel utilisateur: ${user.username} (${userId})`);
      
      // Envoyer la réponse
      callback({ success: true, user });
      
      // Notifier tous les clients du nouveau compte en ligne
      io.emit('stats:update', {
        onlineUsers: getOnlineCount(),
        waitingCounts: getWaitingCounts()
      });
    } catch (error) {
      console.error('❌ Erreur inscription:', error);
      callback({ success: false, error: error.message });
    }
  });

  // Obtenir les statistiques
  socket.on('stats:get', (callback) => {
    callback({
      onlineUsers: getOnlineCount(),
      waitingCounts: getWaitingCounts()
    });
  });

  // Rejoindre la file d'attente
  socket.on('queue:join', ({ type, userId }, callback) => {
    try {
      if (!['chat', 'video', 'group'].includes(type)) {
        throw new Error('Type invalide');
      }
      
      // Vérifier que l'utilisateur n'est pas déjà dans une file
      Object.keys(waitingUsers).forEach(queueType => {
        waitingUsers[queueType] = waitingUsers[queueType].filter(id => id !== userId);
      });
      
      // Ajouter à la file appropriée
      waitingUsers[type].push(userId);
      
      console.log(`📋 ${userId} rejoint la file ${type}`);
      
      // Mettre à jour le statut utilisateur
      const user = users.get(userId);
      if (user) {
        user.status = type;
        users.set(userId, user);
      }
      
      callback({ success: true });
      
      // Notifier tous les clients
      io.emit('stats:update', {
        onlineUsers: getOnlineCount(),
        waitingCounts: getWaitingCounts()
      });
      
      // Essayer de matcher immédiatement
      attemptMatch(type, userId);
    } catch (error) {
      console.error('❌ Erreur queue:join:', error);
      callback({ success: false, error: error.message });
    }
  });

  // Quitter la file d'attente
  socket.on('queue:leave', ({ userId }, callback) => {
    try {
      Object.keys(waitingUsers).forEach(type => {
        waitingUsers[type] = waitingUsers[type].filter(id => id !== userId);
      });
      
      console.log(`🚪 ${userId} quitte la file`);
      
      callback({ success: true });
      
      io.emit('stats:update', {
        onlineUsers: getOnlineCount(),
        waitingCounts: getWaitingCounts()
      });
    } catch (error) {
      callback({ success: false, error: error.message });
    }
  });

  // Envoyer un message
  socket.on('message:send', ({ sessionId, userId, message }, callback) => {
    try {
      const session = chatSessions.get(sessionId);
      if (!session) {
        throw new Error('Session introuvable');
      }
      
      const user = users.get(userId);
      const messageData = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sessionId,
        userId,
        username: user?.username || 'Anonyme',
        message,
        timestamp: new Date(),
        isOwn: false
      };
      
      // Stocker le message
      if (!messages.has(sessionId)) {
        messages.set(sessionId, []);
      }
      messages.get(sessionId).push(messageData);
      
      // Envoyer aux participants
      const otherUserId = session.user1Id === userId ? session.user2Id : session.user1Id;
      const otherUser = users.get(otherUserId);
      
      if (otherUser && otherUser.socketId) {
        io.to(otherUser.socketId).emit('message:receive', messageData);
      }
      
      callback({ success: true, messageId: messageData.id });
    } catch (error) {
      console.error('❌ Erreur message:send:', error);
      callback({ success: false, error: error.message });
    }
  });

  // Passer au suivant
  socket.on('chat:skip', ({ sessionId, userId }, callback) => {
    try {
      endSession(sessionId);
      
      // Remettre l'utilisateur dans la file
      waitingUsers.chat.push(userId);
      
      callback({ success: true });
      
      // Essayer de matcher à nouveau
      setTimeout(() => attemptMatch('chat', userId), 1000);
    } catch (error) {
      callback({ success: false, error: error.message });
    }
  });

  // Déconnexion
  socket.on('disconnect', () => {
    console.log('❌ Client déconnecté:', socket.id);
    
    if (currentUserId) {
      // Retirer des utilisateurs en ligne
      onlineUsers.delete(currentUserId);
      
      // Retirer des files d'attente
      Object.keys(waitingUsers).forEach(type => {
        waitingUsers[type] = waitingUsers[type].filter(id => id !== currentUserId);
      });
      
      // Terminer les sessions actives
      chatSessions.forEach((session, sessionId) => {
        if (session.user1Id === currentUserId || session.user2Id === currentUserId) {
          endSession(sessionId);
        }
      });
      
      // Nettoyer les données utilisateur après 5 minutes
      setTimeout(() => {
        if (!onlineUsers.has(currentUserId)) {
          users.delete(currentUserId);
        }
      }, 5 * 60 * 1000);
      
      // Notifier tous les clients
      io.emit('stats:update', {
        onlineUsers: getOnlineCount(),
        waitingCounts: getWaitingCounts()
      });
    }
  });
});

// ==========================================
// FONCTIONS DE MATCHING
// ==========================================
function attemptMatch(type, userId) {
  if (type !== 'chat') return; // Pour l'instant, on ne gère que le chat
  
  const waitingList = waitingUsers[type];
  const userIndex = waitingList.indexOf(userId);
  
  if (userIndex === -1) return; // L'utilisateur n'est plus dans la file
  
  // Trouver un autre utilisateur disponible
  for (let i = 0; i < waitingList.length; i++) {
    if (i !== userIndex) {
      const otherUserId = waitingList[i];
      
      // Créer une session
      const sessionId = generateSessionId();
      const session = {
        id: sessionId,
        type,
        user1Id: userId,
        user2Id: otherUserId,
        startedAt: new Date(),
        status: 'active'
      };
      
      chatSessions.set(sessionId, session);
      
      // Retirer les deux utilisateurs de la file
      waitingUsers[type] = waitingList.filter(id => id !== userId && id !== otherUserId);
      
      // Notifier les deux utilisateurs
      const user1 = users.get(userId);
      const user2 = users.get(otherUserId);
      
      if (user1 && user1.socketId) {
        io.to(user1.socketId).emit('match:found', {
          sessionId,
          partner: {
            id: otherUserId,
            username: user2?.username || 'Anonyme'
          }
        });
      }
      
      if (user2 && user2.socketId) {
        io.to(user2.socketId).emit('match:found', {
          sessionId,
          partner: {
            id: userId,
            username: user1?.username || 'Anonyme'
          }
        });
      }
      
      console.log(`💑 Match créé: ${userId} <-> ${otherUserId}`);
      
      // Mettre à jour les stats
      io.emit('stats:update', {
        onlineUsers: getOnlineCount(),
        waitingCounts: getWaitingCounts()
      });
      
      break;
    }
  }
}

function endSession(sessionId) {
  const session = chatSessions.get(sessionId);
  if (!session) return;
  
  session.status = 'ended';
  
  // Notifier les participants
  const user1 = users.get(session.user1Id);
  const user2 = users.get(session.user2Id);
  
  if (user1 && user1.socketId) {
    io.to(user1.socketId).emit('session:ended', { sessionId });
  }
  
  if (user2 && user2.socketId) {
    io.to(user2.socketId).emit('session:ended', { sessionId });
  }
  
  // Supprimer la session après 1 minute
  setTimeout(() => {
    chatSessions.delete(sessionId);
    messages.delete(sessionId);
  }, 60000);
}

// ==========================================
// ROUTES API REST
// ==========================================
app.get('/api/stats', (req, res) => {
  res.json({
    onlineUsers: getOnlineCount(),
    waitingCounts: getWaitingCounts(),
    totalSessions: chatSessions.size
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Route catch-all pour le SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// ==========================================
// DÉMARRAGE DU SERVEUR
// ==========================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`📡 Socket.io prêt pour les connexions`);
});
