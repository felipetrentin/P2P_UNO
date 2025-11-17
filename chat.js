
// --- Elementos do DOM ---
const chatContainer = document.getElementById('chat-container');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const channelSelector = document.getElementById('channel-selector'); // Novo elemento


// --- Funções Auxiliares de UI ---

function log(message, type = 'system') {
    const msgElement = document.createElement('div');
    msgElement.textContent = message;
    if (type === 'system') {
        msgElement.style.fontStyle = 'italic';
        msgElement.style.color = '#888';
    } else if (type === 'local') {
        msgElement.className = 'message-local';
    } else if (type === 'remote') {
        msgElement.className = 'message-remote';
    }
    chatContainer.appendChild(msgElement);
    chatContainer.scrollTop = chatContainer.scrollHeight; // Rola para a última mensagem
}

function enableChat(isEnabled) {
    messageInput.disabled = !isEnabled;
    sendButton.disabled = !isEnabled;
    channelSelector.disabled = !isEnabled;
}

// --- Envio de Mensagens de Chat ---

sendButton.onclick = () => {
    sendChatMessage();
};

messageInput.onkeypress = (e) => {
    if (e.key === 'Enter') {
        sendChatMessage();
    }
};

function sendChatMessage() {
    const message = messageInput.value.trim();
    const selectedChannel = channelSelector.value;
    
    if (!message) return;
    
    log(`Você: ${message}`, 'local');
    messageInput.value = '';
    
    if (selectedChannel === 'all') {
        // Envia para todos os canais de chat
        dataChannels.forEach((channelMap, playerId) => {
            let chatChannel = channelMap.get('chat');
            if (chatChannel && chatChannel.readyState === 'open') {
                chatChannel.send(message);
            }
        });
    } else {
        // Envia para um canal específico
        const targetChannel = dataChannels.get(selectedChannel);
        if (targetChannel) {
            let chatChannel = targetChannel.get('chat');
            if (chatChannel && chatChannel.readyState === 'open') {
                chatChannel.send(message);
            }
        }
    }
}

// --- Data Channel do chat ---

function updateChannelSelector() {
    // Limpa opções existentes
    channelSelector.innerHTML = '';
    
    // Adiciona opção "Todos"
    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'Todos os jogadores';
    channelSelector.appendChild(allOption);
    
    // Adiciona opções para cada data channel disponível
    dataChannels.forEach((channelMap, playerId) => {
        const option = document.createElement('option');
        option.value = playerId;
        option.textContent = playerId;
        channelSelector.appendChild(option);
    });
}

function setupChatDataChannel(channel, playerId) {
    channel.onopen = () => {
        log('DataChannel pronto. Chat ativado!', 'system');
        enableChat(true);
        updateChannelSelector(); // Atualiza o seletor quando um novo canal abre
    };

    channel.onclose = () => {
        log('DataChannel fechado. Chat desativado.', 'system');
        updateChannelSelector(); // Atualiza o seletor quando um canal fecha
        
        // Se não houver mais canais, desativa o chat
        if (dataChannels.size === 0) {
            enableChat(false);
        }
    };

    channel.onmessage = (event) => {
        const playerMsgId = playerId;
        log(`${playerMsgId}: ${event.data}`, 'remote');
    };
}

// --- Inicialização ---
enableChat(false);