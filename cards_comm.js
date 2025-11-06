
function setupCardsUpdaterDataChannel(channel) {
    channel.onopen = () => {
        console.log('DataChannel updater pronto!', 'system');
    };

    channel.onclose = () => {
        log('DataChannel updater fechado.', 'system');
    };

    channel.onmessage = (event) => {
        console.log(event);
    };
}

function setupCardsUpdaterDataChannel(channel) {
    channel.onopen = () => {
        console.log('DataChannel updater pronto!', 'system');
    };

    channel.onclose = () => {
        log('DataChannel updater fechado.', 'system');
    };

    channel.onmessage = (event) => {
        console.log(event);
    };
}