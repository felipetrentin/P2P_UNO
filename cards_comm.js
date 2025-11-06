
function setupUpdaterDataChannel(channel) {
    channel.onopen = () => {
        console.log('DataChannel updater pronto!', 'system');
    };

    channel.onclose = () => {
        log('DataChannel updater fechado.', 'system');
    };

    channel.onmessage = (event) => {
        //console.log(event);
        const update = JSON.parse(event.data);
        if(update.type === "move_card"){
            // para movimentos de cartas
            const card = cards[update.id];
            if(card.x != update.x || card.y != update.y){
                //se a carta realmente foi kovida, aplique e redesenhe
                card.x = update.x;
                card.y = update.y;
                draw();
            }
        }
    };
}

function broadcastCardUpdate() {
    const updatesChannel = dataChannels.get('updates');
    if (dragCard) {
        const message = {
            type: "move_card",
            id: dragCard.idx,
            x: dragCard.x,
            y: dragCard.y
        };
        updatesChannel.send(JSON.stringify(message));
    }
}