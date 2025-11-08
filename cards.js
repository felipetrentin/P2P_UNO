// exemplo: gerar cartas
let cards = [];
let idx = 0;
for (let i = 0; i < 7; i++) {
    for (let j = 0; j < 8; j++) { // 5 cartas por linha
        cards.push({
            x: i * 0.2 - 0.9,
            y: j * 0.2 - 0.7,
            idx: idx % 56, // ID da carta no sprite sheet
            rotation: 0,
            zIndex: idx // Adiciona zIndex para controle de profundidade
        });
        idx++;
    }
}