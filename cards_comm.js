
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
            console.log(update);
            // para movimentos de cartas
            const card = cards.find(card => card.ucid === update.id);
            if (card.x != update.x || card.y != update.y) {
                //se a carta realmente foi kovida, aplique e redesenhe
                card.x = update.x;
                card.y = update.y;
                draw();
            }
        }
    };
}

function setupEventsDataChannel(channel) {
    channel.onopen = () => {
        console.log('DataChannel events pronto!');
    };

    channel.onclose = () => {
        log('DataChannel updater fechado.', 'system');
    };

    channel.onmessage = (event) => {
        const action = JSON.parse(event.data);
        console.log(action);
        if (userType === "host") {
            return
        } else {
            if (action.type === "card_dealed") {
                addCardAction(action);
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
    bringCardToTop(card);
    cards.push(card);
    draw();
}

function updateGameStatusUI(state) {
    const el = document.getElementById("gameStatus");
    if (!el) return;

    el.innerHTML = `
        <b>Carta do topo:</b> ${state.top}<br>
        <b>Jogador atual:</b> ${state.current}<br>
        <b>Direção:</b> ${state.direction === 1 ? "↻ horário" : "↺ anti-horário"}<br>
        <b>Compra pendente:</b> ${state.pendingDraw}<br>
        <b>Cor forçada:</b> ${state.forcedColor ?? "nenhuma"}<br>
    `;
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
