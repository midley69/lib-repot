import { io, Socket } from 'socket.io-client';
import { User, ChatMessage } from '../types';

class SocketService {
  private static instance: SocketService;
  private socket: Socket | null = null;
  private currentUser: User | null = null;
  private isConnected: boolean = false;

  static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  // Initialiser la connexion Socket.io
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Déterminer l'URL du serveur
        const serverUrl = window.location.hostname === 'localhost' 
          ? 'http://localhost:3000' 
          : window.location.origin;

        console.log('🔌 Connexion au serveur:', serverUrl);

        this.socket = io(serverUrl, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
        });

        this.socket.on('connect', () => {
          console.log('✅ Connecté au serveur Socket.io');
          this.isConnected = true;
          resolve();
        });

        this.socket.on('disconnect', () => {
          console.log('❌ Déconnecté du serveur');
          this.isConnected = false;
        });

        this.socket.on('connect_error', (error) => {
          console.error('❌ Erreur de connexion:', error);
          reject(error);
        });

      } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation:', error);
        reject(error);
      }
    });
  }

  // Enregistrer un utilisateur
  async registerUser(username?: string, isAnonymous: boolean = true): Promise<User> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket non connecté'));
        return;
      }

      this.socket.emit('user:register', 
        { username, isAnonymous },
        (response: any) => {
          if (response.success) {
            this.currentUser = response.user;
            console.log('👤 Utilisateur enregistré:', this.currentUser);
            resolve(response.user);
          } else {
            reject(new Error(response.error || 'Erreur inscription'));
          }
        }
      );
    });
  }

  // Obtenir les statistiques
  async getStats(): Promise<{ onlineUsers: number, waitingCounts: any }> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        // Valeurs par défaut si pas de connexion
        resolve({
          onlineUsers: 0,
          waitingCounts: { chat: 0, video: 0, group: 0 }
        });
        return;
      }

      this.socket.emit('stats:get', (response: any) => {
        resolve(response);
      });
    });
  }

  // S'abonner aux mises à jour des stats
  onStatsUpdate(callback: (stats: any) => void) {
    if (!this.socket) return;
    this.socket.on('stats:update', callback);
  }

  // Rejoindre une file d'attente
  async joinQueue(type: 'chat' | 'video' | 'group'): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.currentUser) {
        reject(new Error('Non connecté'));
        return;
      }

      this.socket.emit('queue:join', 
        { type, userId: this.currentUser.id },
        (response: any) => {
          if (response.success) {
            console.log(`📋 Rejoint la file ${type}`);
            resolve(true);
          } else {
            reject(new Error(response.error));
          }
        }
      );
    });
  }

  // Quitter la file d'attente
  async leaveQueue(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.currentUser) {
        resolve(false);
        return;
      }

      this.socket.emit('queue:leave', 
        { userId: this.currentUser.id },
        (response: any) => {
          resolve(response.success);
        }
      );
    });
  }

  // S'abonner aux matchs trouvés
  onMatchFound(callback: (data: any) => void) {
    if (!this.socket) return;
    this.socket.on('match:found', callback);
  }

  // S'abonner aux messages reçus
  onMessageReceive(callback: (message: ChatMessage) => void) {
    if (!this.socket) return;
    this.socket.on('message:receive', (data: any) => {
      const message: ChatMessage = {
        id: data.id,
        userId: data.userId,
        username: data.username,
        message: data.message,
        timestamp: new Date(data.timestamp),
        isOwn: false
      };
      callback(message);
    });
  }

  // Envoyer un message
  async sendMessage(sessionId: string, message: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.currentUser) {
        reject(new Error('Non connecté'));
        return;
      }

      this.socket.emit('message:send',
        { 
          sessionId, 
          userId: this.currentUser.id, 
          message 
        },
        (response: any) => {
          if (response.success) {
            resolve(true);
          } else {
            reject(new Error(response.error));
          }
        }
      );
    });
  }

  // Passer au suivant
  async skipUser(sessionId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.currentUser) {
        reject(new Error('Non connecté'));
        return;
      }

      this.socket.emit('chat:skip',
        { sessionId, userId: this.currentUser.id },
        (response: any) => {
          resolve(response.success);
        }
      );
    });
  }

  // S'abonner à la fin de session
  onSessionEnded(callback: () => void) {
    if (!this.socket) return;
    this.socket.on('session:ended', callback);
  }

  // Obtenir l'utilisateur actuel
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  // Vérifier si connecté
  isSocketConnected(): boolean {
    return this.isConnected && this.socket !== null;
  }

  // Déconnexion
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.currentUser = null;
      this.isConnected = false;
    }
  }
}

export default SocketService;
