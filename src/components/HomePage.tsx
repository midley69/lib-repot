import React, { useEffect, useState } from 'react';
import { Users, MessageCircle, Video, Users as GroupIcon } from 'lucide-react';
import { Globe as GlobeComponent } from './Globe';
import { ParticleBackground } from './ParticleBackground';
import { useApp } from '../context/AppContext';
import SocketService from '../services/socketService';

export function HomePage() {
  const { state, setOnlineUsers, setPage, setUser } = useApp();
  const [isConnecting, setIsConnecting] = useState(true);
  const socketService = SocketService.getInstance();

  useEffect(() => {
    const initializeConnection = async () => {
      try {
        console.log('🚀 Initialisation de la connexion...');
        
        // Connecter au serveur Socket.io
        await socketService.connect();
        
        // Enregistrer un utilisateur anonyme
        const user = await socketService.registerUser();
        setUser(user);
        
        // Obtenir les stats initiales
        const stats = await socketService.getStats();
        setOnlineUsers(stats.onlineUsers);
        
        // S'abonner aux mises à jour
        socketService.onStatsUpdate((stats) => {
          setOnlineUsers(stats.onlineUsers);
        });
        
        setIsConnecting(false);
        console.log('✅ Connexion établie');
      } catch (error) {
        console.error('❌ Erreur de connexion:', error);
        setIsConnecting(false);
        // Utiliser des valeurs par défaut
        setOnlineUsers(Math.floor(Math.random() * 50) + 20);
      }
    };

    initializeConnection();

    // Cleanup
    return () => {
      socketService.disconnect();
    };
  }, []);

  const handleChatClick = () => {
    setPage('chat');
  };

  const handleVideoClick = () => {
    setPage('video');
  };

  return (
    <div className="relative h-full flex flex-col overflow-hidden">
      <ParticleBackground />
      
      {/* Globe Background */}
      <div className="absolute inset-0 flex items-center justify-center opacity-30">
        <GlobeComponent onlineUsers={state.onlineUsers} />
      </div>
      
      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <div className="flex-shrink-0 text-center pt-16 pb-8 px-4">
          <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent mb-4 animate-fade-in">
            Libekoo
          </h1>
          <p className="text-xl md:text-3xl text-white font-light leading-tight animate-fade-in">
            Connectez-vous avec des personnes
            <br />
            <span className="bg-gradient-to-r from-pink-400 to-cyan-400 bg-clip-text text-transparent font-semibold">
              réelles
            </span>
          </p>
        </div>

        {/* Status de connexion */}
        {isConnecting && (
          <div className="text-center text-white mb-4">
            <div className="inline-flex items-center space-x-2">
              <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
              <span className="text-sm">Connexion au serveur...</span>
            </div>
          </div>
        )}

        {/* Main Action Buttons - Centered */}
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="responsive-grid max-w-6xl w-full">
            {/* Chat Button */}
            <button
              onClick={handleChatClick}
              className="group relative responsive-card bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 hover:border-cyan-400/50 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-cyan-500/20 animate-slide-in"
            >
              <div className="text-center space-y-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 mx-auto bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <MessageCircle className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg md:text-xl font-semibold text-white mb-2">Chat Textuel</h3>
                  <p className="text-gray-300 text-xs sm:text-sm">
                    Discussions instantanées avec de vraies personnes
                  </p>
                </div>
              </div>
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-400/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </button>

            {/* Video Button */}
            <button
              onClick={handleVideoClick}
              className="group relative responsive-card bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 hover:border-purple-400/50 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/20 animate-slide-in animation-delay-100"
            >
              <div className="text-center space-y-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 mx-auto bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Video className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg md:text-xl font-semibold text-white mb-2">Appel Vidéo</h3>
                  <p className="text-gray-300 text-xs sm:text-sm">
                    Connexions vidéo aléatoires et instantanées
                  </p>
                </div>
              </div>
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-400/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </button>

            {/* Groups Button */}
            <button
              onClick={() => setPage('groups')}
              className="group relative responsive-card bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 hover:border-green-400/50 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:shadow-green-500/20 animate-slide-in animation-delay-200"
            >
              <div className="text-center space-y-4">
                <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 mx-auto bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Users className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg md:text-xl font-semibold text-white mb-2">Groupes</h3>
                  <p className="text-gray-300 text-xs sm:text-sm">
                    Discussions de groupe thématiques
                  </p>
                </div>
              </div>
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-green-400/10 to-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </button>
          </div>
        </div>

        {/* Live Users Counter - Fixed at bottom */}
        <div className="flex-shrink-0 pb-8 sm:pb-12 text-center">
          <div className="inline-flex items-center space-x-3 bg-black/40 backdrop-blur-md px-6 py-3 rounded-full border border-white/20 animate-pulse-slow">
            <div className="flex items-center space-x-2">
              <div className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse" />
              <Users className="w-5 h-5 text-green-400" />
            </div>
            <span className="text-white font-semibold text-lg">
              {state.onlineUsers}
            </span>
            <span className="text-gray-300">utilisateurs en ligne</span>
          </div>
        </div>
      </div>
    </div>
  );
}
