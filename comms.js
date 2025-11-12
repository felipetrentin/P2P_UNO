// --- Configuração ---
const SIGNALING_SERVER_URL = `ws://${window.location.hostname}:8080`;
const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
    ]
};

// --- Variáveis Globais ---
let ws; // Conexão WebSocket
let peerConnections = new Map(); // Mapa para armazenar múltiplas RTCPeerConnections
let dataChannels = new Map(); // Mapa para armazenar múltiplos Data Channels

let userType = null; // 'host' ou 'player'
let roomId = null; // ID da sala para players se conectarem
let myId = null;
let connectedPlayers = new Set(); // Apenas para host: jogadores conectados


const userTypeSelect = document.getElementById('user-type');
const roomIdInput = document.getElementById('room-id');
const createRoomButton = document.getElementById('create-room');
const joinRoomButton = document.getElementById('join-room');
const playerList = document.getElementById('player-list');

const playerSectionDiv = document.getElementById('player-section');
const hostSectionDiv = document.getElementById('host-section');

// --- Interface de Usuário ---

// Mostrar/ocultar elementos baseado no tipo de usuário
userTypeSelect.onchange = () => {
    const type = userTypeSelect.value;
    playerSectionDiv.style.display = (type === 'player' ? 'block' : 'none');
    hostSectionDiv.style.display = (type === 'host' ? 'block' : 'none');
};

createRoomButton.onclick = () => {
    userType = 'host';
    roomId = generateId();
    myId = generateId();
    log(`Host ${myId} criando sala: ${roomId}`, "system");
    connectToSignaling();
};

joinRoomButton.onclick = () => {
    userType = 'player';
    myId = generateId();
    roomId = roomIdInput.value.trim();
    if (!roomId) {
        alert('Por favor, insira um ID de sala');
        return;
    }
    log(`eu, ${myId} entrando na sala: ${roomId}`, "system");
    connectToSignaling();
};

function generateId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// --- Lógica da Sinalização ---

function connectToSignaling() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        console.log('Já conectado ao servidor de sinalização.');
        return;
    }

    console.log('Tentando conectar ao servidor de sinalização...');
    ws = new WebSocket(SIGNALING_SERVER_URL);

    ws.onopen = () => {
        console.log('Conectado ao servidor de sinalização.');

        if (userType === 'host') {
            console.log(`Sala criada: ${roomId}. Aguardando players...`);
            createRoomButton.disabled = true;
            
            // Host anuncia que criou a sala
            sendMessage({
                type: 'host-created',
                roomId: roomId,
                userId: myId
            });
        } else {
            console.log(`Tentando entrar na sala: ${roomId}`);
            joinRoomButton.disabled = true;
            
            // Player pede para entrar na sala
            sendMessage({
                type: 'join-request',
                roomId: roomId,
                userId: myId
            });
        }
    };

    ws.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        console.log('Mensagem recebida:', message);

        try {
            // Ignorar mensagens de outros rooms
            if (message.roomId !== roomId) return;
            
            // Ignorar mensagens de si mesmo
            if (message.userId === myId) return;

            switch (message.type) {
                case 'host-created':
                    handleHostCreated(message);
                    break;
                case 'join-request':
                    handleJoinRequest(message);
                    break;
                case 'join-approved':
                    handleJoinApproved(message);
                    break;
                case 'join-rejected':
                    handleJoinRejected(message);
                    break;
                case 'player-joined':
                    handlePlayerJoined(message);
                    break;
                case 'player-left':
                    handlePlayerLeft(message);
                    break;
                case 'offer':
                    await handleOffer(message);
                    break;
                case 'answer':
                    await handleAnswer(message);
                    break;
                case 'ice-candidate':
                    await handleIceCandidate(message);
                    break;
            }
        } catch (err) {
            console.error('Erro ao processar mensagem:', err);
            log('Erro: ' + err.message, 'system');
        }
    };

    ws.onclose = () => {
        log('Conexão WebSocket fechada.', 'system');
        
        // Notificar que saiu da sala
        if (roomId && myId) {
            sendMessage({
                type: 'player-left',
                roomId: roomId,
                userId: myId
            });
        }
        
        resetConnection();
    };

    ws.onerror = (err) => {
        log('Erro no WebSocket: ' + err.message, 'system');
        console.error('WebSocket Error:', err);
        resetConnection();
    };
}

// --- Handlers de Mensagens ---

function handleHostCreated(message) {
    // Player: host criou uma sala, podemos mostrar que está disponível
    if (userType === 'player') {
        console.log(`Host ${message.userId} criou a sala ${message.roomId}`);
    }
}

function handleJoinRequest(message) {
    // Host: recebeu pedido de entrada de um player
    if (userType === 'host') {
        const playerId = message.userId;
        console.log(`Player ${playerId} quer entrar na sala`);
        
        // Verificar se aceita o player (aqui pode-se implementar lógica de limite de players)
        const acceptPlayer = true;
        
        if (acceptPlayer) {
            // Aprovar entrada do player
            sendMessage({
                type: 'join-approved',
                roomId: roomId,
                userId: myId,
                targetUserId: playerId
            });
            
            // Notificar todos que um novo player entrou
            sendMessage({
                type: 'player-joined',
                roomId: roomId,
                userId: playerId
            });
            
            // Adicionar à lista e criar conexão
            connectedPlayers.add(playerId);
            updatePlayerList(Array.from(connectedPlayers));
            createPeerConnectionForPlayer(playerId);
        } else {
            // Rejeitar entrada do player
            sendMessage({
                type: 'join-rejected',
                roomId: roomId,
                userId: myId,
                targetUserId: playerId,
                reason: 'Sala cheia'
            });
        }
    }
}

function handleJoinApproved(message) {
    // Player: foi aprovado para entrar na sala
    if (userType === 'player' && message.targetUserId === myId) {
        console.log('Entrada na sala aprovada!');
        enableChat(false); // Chat será habilitado quando a conexão WebRTC estabelecer
    }
}

function handleJoinRejected(message) {
    // Player: entrada foi rejeitada
    if (userType === 'player' && message.targetUserId === myId) {
        console.log(`Entrada rejeitada: ${message.reason}`);
        alert(`Não foi possível entrar na sala: ${message.reason}`);
        resetConnection();
    }
}

function handlePlayerJoined(message) {
    const playerId = message.userId;
    
    if (userType === 'host') {
        // Host já processou este player em handleJoinRequest
        return;
    }
    
    // Player: outro player entrou na sala
    if (userType === 'player' && playerId !== myId) {
        console.log(`Player ${playerId} entrou na sala`);
    }
}

function handlePlayerLeft(message) {
    const playerId = message.userId;
    console.log(`Player ${playerId} saiu da sala`);
    
    if (userType === 'host') {
        connectedPlayers.delete(playerId);
        updatePlayerList(Array.from(connectedPlayers));
        
        // Fechar conexão com o player
        if (peerConnections.has(playerId)) {
            peerConnections.get(playerId).close();
            peerConnections.delete(playerId);
        }
        
        // Remover data channels desse player
        if (dataChannels.has(playerId)) {
            dataChannels.get(playerId).forEach(channel => channel.close());
            dataChannels.delete(playerId);
        }
    } else {
        // Player: se o host saiu, resetar conexão
        if (playerId === getHostId()) {
            console.log('Host saiu da sala. Desconectando...');
            resetConnection();
        }
    }
}

async function handleOffer(message) {
    // Player recebe oferta do host
    if (message.targetUserId !== myId){
        console.log("ignorando offer que não é meu...");
        return;
    }
    const fromUserId = message.userId;
    
    if (!peerConnections.has(fromUserId)) {
        createPeerConnectionForPlayer(fromUserId);
    }
    
    const pc = peerConnections.get(fromUserId);

    await pc.setRemoteDescription(new RTCSessionDescription(message.session));
    console.log(`Oferta recebida de ${fromUserId}. Criando resposta...`);
    
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    
    // Enviar resposta
    sendMessage({
        type: 'answer',
        roomId: roomId,
        userId: myId,
        targetUserId: fromUserId,
        session: pc.localDescription
    });
}

async function handleAnswer(message) {
    if (message.targetUserId !== myId){
        console.log("ignorando answer que não é meu...");
        return;
    }
    // Host recebe resposta do player
    const fromUserId = message.userId;
    
    if (peerConnections.has(fromUserId)) {
        const pc = peerConnections.get(fromUserId);
        console.log(`Resposta recebida do player ${fromUserId}`);
        await pc.setRemoteDescription(new RTCSessionDescription(message.session));
    }
}

async function handleIceCandidate(message) {
    if (message.targetUserId !== myId){
        console.log("ignorando candidato ICE que não é meu...");
        return;
    }
    // Processar candidato ICE
    const fromUserId = message.userId;
    
    if (peerConnections.has(fromUserId) && message.candidate) {
        const pc = peerConnections.get(fromUserId);
        console.log(`adicionando a ${fromUserId}`, message.candidate);
        await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
        console.log(`Candidato ICE adicionado de ${fromUserId}`);
    }
}

// --- Lógica do WebRTC ---

function createPeerConnectionForPlayer(playerId) {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnections.set(playerId, pc);
    console.log(`RTCPeerConnection criado para ${playerId}`);

    // Coletar Candidatos ICE
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            sendMessage({
                type: 'ice-candidate',
                roomId: roomId,
                userId: myId,
                targetUserId: playerId,
                candidate: event.candidate
            });
        }
    };

    // Configurar Data Channels para quem recebe
    pc.ondatachannel = (event) => {
        const channel = event.channel;
        setupDataChannel(channel, playerId);
        
        if (!dataChannels.has(playerId)) {
            dataChannels.set(playerId, new Map());
        }
        dataChannels.get(playerId).set(channel.label, channel);
        
        console.log(`DataChannel ${channel.label} recebido de ${playerId}`);
    };

    // Monitorar estado da conexão
    pc.oniceconnectionstatechange = () => {
        console.log(`Estado da Conexão ICE com ${playerId}: ${pc.iceConnectionState}`);
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
            console.log(`Conexão WebRTC estabelecida com ${playerId}!`);
            
            if (userType === 'player') {
                enableChat(true);
            }
        } else if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed' || pc.iceConnectionState === 'disconnected') {
            console.log(`Conexão WebRTC com ${playerId} falhou ou foi fechada.`);
            
            if (userType === 'player') {
                enableChat(false);
            }
        }
    };

    // Host cria Data Channels e oferta para o player
    if (userType === 'host') {
        createDataChannelsForPlayer(pc, playerId);
        
        // Criar e enviar oferta
        setTimeout(async () => {
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);

                sendMessage({
                    type: 'offer',
                    roomId: roomId,
                    userId: myId,
                    targetUserId: playerId,
                    session: pc.localDescription
                });
                
                console.log(`Oferta enviada para ${playerId}`);
            } catch (err) {
                console.error('Erro ao criar oferta:', err);
                log('Erro ao criar oferta: ' + err.message, 'system');
            }
        }, 1000);
    }
}

function createDataChannelsForPlayer(pc, playerId) {
    if (userType !== 'host') return;
    
    // Data Channel principal para chat
    const chatChannel = pc.createDataChannel('chat');
    setupDataChannel(chatChannel, playerId);
    
    // Data Channel para atualizações em tempo real
    const updatesChannel = pc.createDataChannel('updates', {
        ordered: false,
        maxRetransmits: 0
    });
    setupDataChannel(updatesChannel, playerId);
    
    // Armazenar os data channels
    if (!dataChannels.has(playerId)) {
        dataChannels.set(playerId, new Map());
    }
    dataChannels.get(playerId).set('chat', chatChannel);
    dataChannels.get(playerId).set('updates', updatesChannel);
}

function setupDataChannel(channel, playerId) {
    if (channel.label === 'chat') {
        setupChatDataChannel(channel, playerId);
    } else if (channel.label === 'updates') {
        setupUpdaterDataChannel(channel, playerId);
    }
}

// --- Funções auxiliares ---

// mandar mensagem no websocket
function sendMessage(message) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    } else {
        console.error('WebSocket não conectado');
    }
}

function getHostId() {
    // Em uma implementação real, você precisaria rastrear quem é o host
    // Por simplicidade, assumimos que o primeiro peer connection é com o host
    if (userType === 'player' && peerConnections.size > 0) {
        return Array.from(peerConnections.keys())[0];
    }
    return null;
}

function updatePlayerList(players) {
    if (userType === 'host') {
        playerList.innerHTML = '';
        players.forEach(playerId => {
            const li = document.createElement('li');
            li.textContent = `Player: ${playerId}`;
            li.id = `player-${playerId}`;
            playerList.appendChild(li);
        });
    }
}

function resetConnection() {
    createRoomButton.disabled = false;
    joinRoomButton.disabled = false;
    enableChat(false);
    
    // Fechar todas as conexões peer
    peerConnections.forEach((pc, playerId) => {
        pc.close();
    });
    peerConnections.clear();
    
    // Fechar todos os data channels
    dataChannels.forEach((channels) => {
        channels.forEach(channel => channel.close());
    });
    dataChannels.clear();
    
    connectedPlayers.clear();
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
    }
    
    userType = null;
    roomId = null;
    myId = null;
}

// Event listener para fechar a conexão quando a página for fechada
window.addEventListener('beforeunload', () => {
    if (roomId && myId) {
        sendMessage({
            type: 'player-left',
            roomId: roomId,
            userId: myId
        });
    }
});