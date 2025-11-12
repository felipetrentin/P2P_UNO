
// --- Elementos do DOM ---
const chatContainer = document.getElementById('chat-container');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');

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
    dataChannels.forEach((channel) => {
        let chatChannel = channel.get('chat');
        console.log("mandando para ", chatChannel);
        if (message && chatChannel && chatChannel.readyState === 'open') {
            chatChannel.send(message);
            log(`Você: ${message}`, 'local');
            messageInput.value = '';
        }
    });
}

// --- Data Channel do chat ---

function setupChatDataChannel(channel) {
    channel.onopen = () => {
        log('DataChannel pronto. Chat ativado!', 'system');
        enableChat(true);
    };

    channel.onclose = () => {
        log('DataChannel fechado. Chat desativado.', 'system');
        enableChat(false);
    };

    channel.onmessage = (event) => {
        log(`Par Remoto: ${event.data}`, 'remote');
    };
}


// --- Inicialização ---
enableChat(false);