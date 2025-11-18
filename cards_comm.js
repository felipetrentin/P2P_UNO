
function setupUpdaterDataChannel(channel) {
    channel.onopen = () => {
        console.log('DataChannel updater pronto!');
    };

    channel.onclose = () => {
        log('DataChannel updater fechado.', 'system');
    };

    channel.onmessage = (event) => {
        //console.log(event);
        const update = JSON.parse(event.data);
        if (update.type === "move_card") {
            // console.log(update);
            // para movimentos de cartas
            const card = cards.find(card => card.ucid === update.id);
            if(card){
                if (card.x != update.x || card.y != update.y) {
                    //se a carta realmente foi movida, aplique e redesenhe
                    card.x = update.x;
                    card.y = update.y;
                    draw();
                }
            }
        }
    };
}

function setupEventsDataChannel(channel, playerId) {
    channel.onopen = () => {
        console.log('DataChannel events pronto!');
    };

    channel.onclose = () => {
        log('DataChannel updater fechado.', 'system');
    };

    channel.onmessage = (event) => {
        const action = JSON.parse(event.data);
        console.log(playerId, action);
        if (userType === "host") {
            if(action.type === "card_played"){
                playerActionCallback(playerId, action.card);
            }
        } else {
            if (action.type === "card_dealed") {
                addCardAction(action);
            }
            if (action.type === "card_removed") {
                removeCardLocal(action.ucid);
            }
            if (action.type === "game_state") {
                updateGameStatusUI(action);
                //bringCardToTop(action.top);
            }
        }
    };
}

function addCardAction(action) {
    const card = {
        ucid: action.ucid,
        x: 0,
        y: -0.3,
        idx: cardIndex.indexOf(action.card), // ID da carta no sprite sheet
        rotation: 0,
        zIndex: 0 // Adiciona zIndex para controle de profundidade
    };
    //if invalid place err
    if (card.idx < 0 || card.idx > 55){
        card.idx = 41;
    }
    if(cards.length > 0){
        bringCardToTop(card);
    }
    cards.push(card);
    draw();
}

function removeCardLocal(UCID){
    // Encontrar o índice da carta no array
    const cardIndexToRemove = cards.findIndex(card => card.ucid === UCID);
    
    // Se a carta foi encontrada, removê-la
    if (cardIndexToRemove !== -1) {
        cards.splice(cardIndexToRemove, 1);
        draw(); // Redesenhar após remover a carta
    } else {
        console.warn(`Carta com UCID ${UCID} não encontrada para remoção`);
    }
}

function onCardPlayed(card){
    if(userType === 'host'){
        playerActionCallback(myId, cardIndex[card.idx]);
    }else{
        const hostDC = dataChannels.get(getHostId());
        const events_DC = hostDC.get('game_events');
        const game_event = {
            type: "card_played",
            card: cardIndex[card.idx]
        }
        events_DC.send(JSON.stringify(game_event))
    }
}

function updateGameStatusUI(state) {
    game_card_type = state.top;
    const el = document.getElementById("gameStatus");
    if (!el) return;

    el.innerHTML = `
        <b>Carta do topo:</b> ${state.top}<br>
        <b>Jogador atual:</b> ${state.current}<br>
        <b>Direção:</b> ${state.direction === 1 ? "↻ horário" : "↺ anti-horário"}<br>
        <b>Compra pendente:</b> ${state.pendingDraw}<br>
        <b>Cor forçada:</b> ${state.forcedColor ?? "nenhuma"}<br>
    `;
    draw();
}

function broadcastCardUpdate() {
    if (dragCard) {
        const message = {
            type: "move_card",
            id: dragCard.ucid,
            x: dragCard.x,
            y: dragCard.y
        };
        dataChannels.forEach((channel) => {
            let updatesChannel = channel.get('updates');
            if (updatesChannel) {
                updatesChannel.send(JSON.stringify(message));
            }
        });
    }
}
