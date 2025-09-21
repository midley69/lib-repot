import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  ArrowLeft, 
  MessageCircle, 
  SkipForward,
  UserPlus
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ChatMessage } from '../types';
import SocketService from '../services/socketService';

export function ChatPage() {
  const { setPage, state } = useApp();
  const [currentView, setCurrentView] = useState<'menu' | 'random'>('menu');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [connectedUser, setConnectedUser] = useState<any>(null);
  const [waitingCounts, setWaitingCounts] = useState({
    chat: 0,
    video: 0,
    group: 0
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketService = SocketService.getInstance();

  useEffect(() => {
    // Auto-scroll des messages
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // Initialiser les listeners Socket.io
    const setupListeners = async () => {
      // Obtenir les stats initiales
      const stats = await socketService.getStats();
      setWaitingCounts(stats.waitingCounts);

      // S'abonner aux mises à jour des stats
      socketService.onStatsUpdate((stats) => {
        setWaitingCounts(stats.waitingCounts);
      });

      // S'abonner aux matchs trouvés
      socketService.onMatchFound((data) => {
        console.log('💑 Match trouvé!', data);
        setIsSearching(false);
        setIsConnected(true);
        setCurrentSessionId(data.sessionId);
        setConnectedUser(data.partner);
        
        // Message système
        const sysMessage: ChatMessage = {
          id: `sys_${Date.now()}`,
          userId: 'system',
          username: 'Système',
          message: `Vous êtes maintenant connecté avec ${data.partner.username}`,
          timestamp: new Date(),
          isOwn: false
        };
        setMessages([sysMessage]);
      });

      // S'abonner aux messages reçus
      socketService.onMessageReceive((message) => {
        setMessages(prev => [...prev, message]);
      });

      // S'abonner à la fin de session
      socketService.onSessionEnded(() => {
        handleDisconnect();
      });
    };

    setupListeners();
  }, []);

  const handleConnect = async (type: 'random') => {
    try {
      setCurrentView(type);
      setIsSearching(true);
      setMessages([]);
      
      // Rejoindre la file d'attente
      await socketService.joinQueue('chat');
      
      // Le match sera géré par l'événement 'match:found'
    } catch (error) {
      console.error('❌ Erreur connexion:', error);
      setIsSearching(false);
    }
  };

  const handleSendMessage = async () => {
    if (!currentMessage.trim() || !currentSessionId) return;

    try {
      // Créer le message local
      const newMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        userId: state.user?.id || 'me',
        username: state.user?.username || 'Moi',
        message: currentMessage,
        timestamp: new Date(),
        isOwn: true
      };
      
      // Ajouter immédiatement à l'interface
      setMessages(prev => [...prev, newMessage]);
      
      // Envoyer via Socket.io
      await socketService.sendMessage(currentSessionId, currentMessage);
      
      // Réinitialiser l'input
      setCurrentMessage('');
    } catch (error) {
      console.error('❌ Erreur envoi message:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSkipUser = async () => {
    if (!currentSessionId) return;
    
    try {
      await socketService.skipUser(currentSessionId);
      setIsSearching(true);
      setIsConnected(false);
      setMessages([]);
      setCurrentSessionId(null);
      setConnectedUser(null);
    } catch (error) {
      console.error('❌ Erreur skip:', error);
    }
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setIsSearching(false);
    setCurrentView('menu');
    setMessages([]);
    setCurrentSessionId(null);
    setConnectedUser(null);
    socketService.leaveQueue();
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-sm border-b border-white/10 px-3 sm:px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => currentView === 'menu' ? setPage('home') : handleDisconnect()}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-lg sm:text-xl font-semibold text-white">
                Chat Textuel
              </h1>
              {connectedUser && (
                <p className="text-xs text-gray-400">
                  Connecté avec {connectedUser.username}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {currentView === 'menu' && (
              <div className="text-center">
                <span className="text-xs sm:text-sm text-gray-300">
                  {waitingCounts.chat} en attente
                </span>
              </div>
            )}
            {isConnected && (
              <div className="flex items-center space-x-1 text-green-400 text-xs">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span>Live</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-0">
        {currentView === 'menu' && (
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-6 max-w-2xl mx-auto">
              <div className="text-center">
                <h2 className="text-2xl font-semibold text-white mb-2">
                  Choisissez votre mode
                </h2>
                <p className="text-gray-300">
                  Rencontrez de vraies personnes instantanément
                </p>
              </div>

              {/* Random Chat Option */}
              <button
                onClick={() => handleConnect('random')}
                className="w-full p-6 rounded-xl border border-white/20 bg-white/5 hover:border-cyan-400 hover:bg-cyan-400/10 transition-all duration-300 group"
              >
                <div className="text-center space-y-3">
                  <div className="w-16 h-16 mx-auto bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                    <MessageCircle className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-white">
                    Chat Aléatoire
                  </h3>
                  <p className="text-gray-300">
                    Connectez-vous instantanément avec quelqu'un au hasard
                  </p>
                  <div className="text-cyan-400 text-sm">
                    {waitingCounts.chat} personnes en attente
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Searching State */}
        {isSearching && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-white text-lg">Recherche d'un utilisateur...</p>
              <p className="text-gray-400 text-sm">
                {waitingCounts.chat} personnes disponibles
              </p>
            </div>
          </div>
        )}

        {/* Chat Interface */}
        {isConnected && (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs sm:max-w-sm lg:max-w-md px-4 py-2 rounded-2xl ${
                      message.isOwn
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white'
                        : message.userId === 'system'
                        ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                        : 'bg-white/10 text-white border border-white/20'
                    }`}
                  >
                    {!message.isOwn && message.userId !== 'system' && (
                      <p className="text-xs opacity-70 mb-1">{message.username}</p>
                    )}
                    <p className="text-sm">{message.message}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Controls */}
            <div className="bg-black/10 backdrop-blur-sm border-t border-white/10 px-4 py-2">
              <div className="flex items-center justify-center space-x-4 mb-2">
                <button
                  onClick={handleSkipUser}
                  className="flex items-center space-x-2 px-4 py-2 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-all"
                >
                  <SkipForward className="w-4 h-4" />
                  <span className="text-sm">Suivant</span>
                </button>
              </div>
              
              {/* Message Input */}
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Tapez votre message..."
                  maxLength={500}
                  className="flex-1 bg-white/10 border border-white/20 rounded-full px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!currentMessage.trim()}
                  className="p-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-full hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
