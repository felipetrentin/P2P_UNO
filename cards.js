const cardIndex = [
    // --- Linha 1: Vermelho ---
    "red_0", "red_1", "red_2", "red_3", "red_4",
    "red_5", "red_6", "red_7", "red_8", "red_9",
    "red_block", "red_reverse", "red_plus2",
    "wild_plus4",

    // --- Linha 2: Amarelo ---
    "yellow_0", "yellow_1", "yellow_2", "yellow_3", "yellow_4",
    "yellow_5", "yellow_6", "yellow_7", "yellow_8", "yellow_9",
    "yellow_block", "yellow_reverse", "yellow_plus2",
    "wild",

    // --- Linha 3: Verde ---
    "green_0", "green_1", "green_2", "green_3", "green_4",
    "green_5", "green_6", "green_7", "green_8", "green_9",
    "green_block", "green_reverse", "green_plus2",
    "error_card",

    // --- Linha 4: Azul ---
    "blue_0", "blue_1", "blue_2", "blue_3", "blue_4",
    "blue_5", "blue_6", "blue_7", "blue_8", "blue_9",
    "blue_block", "blue_reverse", "blue_plus2",
    "backside_card" // o pimentão verde
];


// gerar cartas
let cards = [];
let last_ucid = 0;
let deck = [];

let currentPlayerIndex = 0;       // índice dentro da lista de players
let playDirection = 1;            // 1 = horário, -1 = anti-horário

let hands = {};                  // hands[playerId] = []
let discardPile = [];
let pendingDraw = 0;
let forcedColor = null;

let partyPlayers = null;

function getPlayerList() {
    const list = Array.from(connectedPlayers);

    if (!list.includes(myId)) {
        list.push(myId);
    }

    return list;
}

function generateDeck() {
    deck = [];

    const colors = ["red", "yellow", "green", "blue"];
    
    // Cartas numéricas e de ação
    for (let color of colors) {

        // 0 -> 1 cópia
        deck.push(`${color}_0`);

        // 1–9 -> 2 cópias
        for (let i = 1; i <= 9; i++) {
            deck.push(`${color}_${i}`);
            deck.push(`${color}_${i}`);
        }

        // Ações (2 cópias cada)
        deck.push(`${color}_block`);
        deck.push(`${color}_block`);

        deck.push(`${color}_reverse`);
        deck.push(`${color}_reverse`);

        deck.push(`${color}_plus2`);
        deck.push(`${color}_plus2`);
    }

    // Wilds (sempre 4 de cada)
    for (let i = 0; i < 4; i++) {
        deck.push("wild");
        deck.push("wild_plus4");
    }
}

function buyCard() {
    if (deck.length === 0) {
        console.warn("Baralho acabou!");
        return null;
    }
    return deck.pop();
}

function getColor(card) {
    return card.split('_')[0];
}

function getValue(card) {
    return card.split('_')[1];
}

function getDiscardTop() {
    return discardPile[discardPile.length - 1] || null;
}

function canPlayCard(card, topCard) {
    // Se não há carta no topo, qualquer carta é válida
    if (!topCard) return true;
    
    // Se há cor forçada (após wild), só pode jogar cartas daquela cor
    if (forcedColor && getColor(card) !== forcedColor) {
        // Exceto wilds, que podem ser jogados em qualquer cor forçada
        return card === "wild" || card === "wild_plus4";
    }
    
    const cardColor = getColor(card);
    const cardValue = getValue(card);
    const topColor = getColor(topCard);
    const topValue = getValue(topCard);
    
    // Wild cards podem ser jogados sempre
    if (card === "wild" || card === "wild_plus4") {
        return true;
    }
    
    // Mesma cor
    if (cardColor === topColor) {
        return true;
    }
    
    // Mesmo valor (incluindo ações como plus2, reverse, block)
    if (cardValue === topValue) {
        return true;
    }
    
    // Casos especiais para cartas de ação com o mesmo tipo
    if ((cardValue === "plus2" && topValue === "plus2") ||
        (cardValue === "reverse" && topValue === "reverse") ||
        (cardValue === "block" && topValue === "block")) {
        return true;
    }
    
    return false;
}

function shuffleDeck() {
    for (let i = deck.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

function getCurrentPlayerId() {
    const list = partyPlayers;
    return list[currentPlayerIndex];
}

function advanceTurn() {
    const list = partyPlayers;
    const count = list.length;

    currentPlayerIndex = (currentPlayerIndex + playDirection + count) % count;
}

function dealInitialCards(amount = 7) {
    const players = partyPlayers;

    players.forEach(pId => {
        hands[pId] = [];
    });

    for (let i = 0; i < amount; i++) {
        players.forEach(pId => {
            let card = buyCard();
            let hand = hands[pId];
            if (card){
                hand.push(card);
                dealCard(pId, card);
            }
        });
    }
}

function drawInitialDiscard() {
    let firstCard = null;

    // Puxa cartas até achar uma válida para iniciar
    while (true) {
        firstCard = deck.pop();

        // Não pode começar com wilds
        if (firstCard === "wild" || firstCard === "wild_plus4") {
            deck.unshift(firstCard); // devolve ao baralho
            continue;
        }
        break;
    }

    // Coloca na pilha de descarte
    discardPile.push(firstCard);

    // Define cor atual com base na primeira carta
    currentColor = firstCard.split("_")[0];

    // Se for número, define valor
    currentValue = firstCard.split("_")[1];

    // Broadcast para todos
    broadcastGameState();
}


function startGame() {
    console.log("Iniciando partida...");
    gameStartBtn.disabled = true;
    partyPlayers = getPlayerList();

    generateDeck();
    shuffleDeck();

    dealInitialCards(7);
    drawInitialDiscard();

    currentPlayerIndex = 0;
    playDirection = 1;
    pendingDraw = 0;
    forcedColor = null;

    broadcastGameState();
}


function playerActionCallback(player, playedCard) {
    const currentPlayerId = getCurrentPlayerId();

    // 1. Jogador tentou jogar fora do turno
    if (player !== currentPlayerId) {
        console.warn("Jogador fora do turno");
        return;
    }

    const hand = hands[player];

    // 2. Jogador não tem essa carta
    if (!hand.includes(playedCard)) {
        console.warn("Jogador não possui essa carta");
        return;
    }

    // 3. Verifica se a jogada é válida
    if (!canPlayCard(playedCard, getDiscardTop())) {
        console.warn("Jogada inválida → jogador compra carta");
        dealCard(player);
        return;
    }

    // 4. Remove a carta da mão
    hand.splice(hand.indexOf(playedCard), 1);
    discardPile.push(playedCard);
    forcedColor = null;

    // 5. Vitória
    if (hand.length === 0) {
        broadcastWinner(player);
        return;
    }

    // 6. Efeitos especiais
    const value = getValue(playedCard);
    const color = getColor(playedCard);

    // +2
    if (value === "plus2") {
        pendingDraw += 2;
        advanceTurn();
        broadcastGameState();
        return;
    }

    // +4
    if (playedCard === "wild_plus4") {
        pendingDraw += 4;
        requestColorChoice(player);
        advanceTurn();
        broadcastGameState();
        return;
    }

    // Wild normal
    if (playedCard === "wild") {
        requestColorChoice(player);
        advanceTurn();
        broadcastGameState();
        return;
    }

    // Reverse
    if (value === "reverse") {
        playDirection *= -1;
        advanceTurn();
        broadcastGameState();
        return;
    }

    // Skip
    if (value === "block") {
        advanceTurn(); // pula um jogador
        advanceTurn();
        broadcastGameState();
        return;
    }

    // Carta numérica → turno normal
    advanceTurn();
    broadcastGameState();
}


function broadcastGameState() {
    let msg = {
        type: "game_state",
        top: getDiscardTop(),
        pendingDraw,
        current: getCurrentPlayerId(),
        direction: playDirection,
        forcedColor
    };

    updateGameStatusUI(msg);

    dataChannels.forEach(map => {
        let ch = map.get("game_events");
        if (ch && ch.readyState === "open") {
            ch.send(JSON.stringify(msg));
        }
    });
}


function dealCard(player, card) {
    const cardMessage = {
        type: "card_dealed",
        card: card,
        ucid: last_ucid
    };

    const backsideMessage = {
        type: "card_dealed",
        card: "backside_card",
        ucid: last_ucid
    };

    // Envia para todos os jogadores
    dataChannels.forEach((channelMap, playerId) => {
        let gameChannel = channelMap.get('game_events');
        if (gameChannel && gameChannel.readyState === 'open') {
            if (playerId === player) {
                // Envia a carta real para o jogador alvo
                gameChannel.send(JSON.stringify(cardMessage));
            } else {
                // Envia backside_card para todos os outros
                gameChannel.send(JSON.stringify(backsideMessage));
            }
        }
        // adiciona a carta pro host
        if (myId === player) {
            addCardAction(cardMessage);
        } else {
            addCardAction(backsideMessage);
        }

    });
    last_ucid++;
    draw();
}