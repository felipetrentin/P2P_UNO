const canvas = document.getElementById('glcanvas');
const gl = canvas.getContext('webgl2');
canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;
gl.viewport(0, 0, canvas.width, canvas.height);
gl.clearColor(0.0, 0.176, 0.02, 1.0);

// shaders atualizados para suportar alpha
const vsSource = `#version 300 es
in vec2 a_position;
in vec2 a_texcoord;
in float a_cardId;
uniform mat3 u_matrix;
out vec2 v_texcoord;
out float v_cardId;
void main() {
    vec3 pos = u_matrix * vec3(a_position,1.0);
    gl_Position = vec4(pos.xy,0,1);
    v_texcoord = a_texcoord;
    v_cardId = a_cardId;
}`;

const fsSource = `#version 300 es
precision mediump float;
in vec2 v_texcoord;
in float v_cardId;
uniform sampler2D u_texture;
uniform vec2 u_spriteSheetSize;
uniform vec2 u_spriteSize;
out vec4 outColor;
void main() {
    float spriteId = floor(v_cardId);
    float col = mod(spriteId, u_spriteSheetSize.x);
    float row = floor(spriteId / u_spriteSheetSize.x);
    
    vec2 spriteOffset = vec2(col * u_spriteSize.x, row * u_spriteSize.y);
    vec2 spriteCoord = vec2(
        spriteOffset.x + v_texcoord.x * u_spriteSize.x,
        spriteOffset.y + (1.0 - v_texcoord.y) * u_spriteSize.y
    );
    
    vec4 texColor = texture(u_texture, spriteCoord);
    
    outColor = texColor;
}`;

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
    }
    return shader;
}

function createProgram(gl, vs, fs) {
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(program));
    }
    return program;
}

const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
const program = createProgram(gl, vertexShader, fragmentShader);

// look up locations
const positionLoc = gl.getAttribLocation(program, 'a_position');
const texcoordLoc = gl.getAttribLocation(program, 'a_texcoord');
const cardIdLoc = gl.getAttribLocation(program, 'a_cardId');
const matrixLoc = gl.getUniformLocation(program, 'u_matrix');
const textureLoc = gl.getUniformLocation(program, 'u_texture');
const spriteSheetSizeLoc = gl.getUniformLocation(program, 'u_spriteSheetSize');
const spriteSizeLoc = gl.getUniformLocation(program, 'u_spriteSize');

// create quad buffer
const posBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    0, 0,
    1, 0,
    0, 1,
    0, 1,
    1, 0,
    1, 1
]), gl.STATIC_DRAW);


const texBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    0, 0,
    1, 0,
    0, 1,
    0, 1,
    1, 0,
    1, 1
]), gl.STATIC_DRAW);


// buffer que armazena qual carta deve ser desenhada naquele momento
const cardIdBuffer = gl.createBuffer();

// tamanho da carta
const CARD_W = 280/1.5;
const CARD_H = 400/1.5;

// Configuração do sprite sheet
const SPRITE_SHEET_COLS = 14;
const SPRITE_SHEET_ROWS = 4;
const SPRITE_SHEET_SIZE = { cols: SPRITE_SHEET_COLS, rows: SPRITE_SHEET_ROWS };

const SPRITE_SIZE = {
    x: 1.0 / SPRITE_SHEET_COLS,
    y: 1.0 / SPRITE_SHEET_ROWS
};

// Textura única do sprite sheet
let spriteSheetTexture = null;

// Carrega a textura do sprite sheet com suporte a alpha
function loadSpriteSheetTexture(gl, image) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
}

// Carrega a imagem do sprite sheet
function loadSpriteSheet() {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = function() {
        spriteSheetTexture = loadSpriteSheetTexture(gl, image);
        
        // Habilita blending para transparência
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        
        draw();
    };
    
    image.onerror = function() {
        console.error('Erro ao carregar sprite sheet: sprites.png');
    };
    
    image.src = 'sprites.png';
}

// Inicialização
loadSpriteSheet();

//lógica de manipulação de cartas
// coordenadas em screnspace, 0,0 é no centro, negativo para esquerda e para baixo.

let dragCard = null, dragOffset = { x: 0, y: 0 };

// Função para mover carta para o topo (maior zIndex)
function bringCardToTop(card) {
    // Encontra o maior zIndex atual
    const maxZIndex = Math.max(...cards.map(c => c.zIndex));
    
    // Define o zIndex da carta como maior que todos os outros
    card.zIndex = maxZIndex + 1;
    
    // Reordena o array por zIndex (opcional, para organização)
    cards.sort((a, b) => a.zIndex - b.zIndex);
}

// Função auxiliar para obter coordenadas normalizadas
function getNormalizedCoordinates(clientX, clientY) {
    const mx = ((2 * clientX) / canvas.width) - 1;
    const my = ((-2 * clientY) / canvas.height) + 1;
    return { mx, my };
}

// Função para encontrar a carta clicada/tocada
function findCardAt(x, y) {
    const scr_card_w = (CARD_W / canvas.width);
    const scr_card_h = (CARD_H / canvas.height);
    
    // Procura da carta com maior zIndex para a menor (de cima para baixo)
    const sortedCards = [...cards].sort((a, b) => b.zIndex - a.zIndex);
    
    for (let i = 0; i < sortedCards.length; i++) {
        const c = sortedCards[i];
        if (
            x > c.x - scr_card_w / 2 && x < c.x + scr_card_w / 2 &&
            y > c.y - scr_card_h / 2 && y < c.y + scr_card_h / 2
        ) {
            return { card: c, index: cards.indexOf(c) };
        }
    }
    return null;
}

// Eventos de mouse
canvas.addEventListener('mousedown', (e) => {
    const { mx, my } = getNormalizedCoordinates(e.clientX, e.clientY);
    //console.log("clicked", mx, my, e);
    
    const found = findCardAt(mx, my);
    if (found) {
        dragCard = found.card;
        dragOffset.x = mx - found.card.x;
        dragOffset.y = my - found.card.y;
        
        // Move a carta para o topo quando clicada
        bringCardToTop(found.card);
        draw();
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (dragCard) {
        const { mx, my } = getNormalizedCoordinates(e.clientX, e.clientY);
        dragCard.x = mx - dragOffset.x;
        dragCard.y = my - dragOffset.y;
        broadcastCardUpdate();
        draw();
    }
});

canvas.addEventListener('mouseup', () => { 
    dragCard = null; 
});

// Eventos de touch
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Prevenir scroll
    const touch = e.touches[0];
    const { mx, my } = getNormalizedCoordinates(touch.clientX, touch.clientY);
    console.log("touch started", mx, my, e);
    
    const found = findCardAt(mx, my);
    if (found) {
        dragCard = found.card;
        dragOffset.x = mx - found.card.x;
        dragOffset.y = my - found.card.y;
        
        // Move a carta para o topo quando tocada
        bringCardToTop(found.card);
        draw();
    }
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault(); // Prevenir scroll
    if (dragCard) {
        const touch = e.touches[0];
        const { mx, my } = getNormalizedCoordinates(touch.clientX, touch.clientY);
        dragCard.x = mx - dragOffset.x;
        dragCard.y = my - dragOffset.y;
        broadcastCardUpdate();
        draw();
    }
});

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    dragCard = null;
});

canvas.addEventListener('touchcancel', (e) => {
    e.preventDefault();
    dragCard = null;
});

// matrizes de transformação
function translationMatrix(tx, ty) {
    return [1, 0, tx,
        0, 1, ty,
        0, 0, 1];
}
function rotationMatrix(a) {
    const c = Math.cos(a), s = Math.sin(a);
    return [
        c, -s, 0,
        s, c, 0,
        0, 0, 1];
}

function multiply(a, b) {
    let r = new Array(9);
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            r[i * 3 + j] = 0;
            for (let k = 0; k < 3; k++) {
                r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
            }
        }
    }
    return r;
}

function transpose3x3(m) {
    return [
        m[0], m[3], m[6],
        m[1], m[4], m[7],
        m[2], m[5], m[8],
    ];
}
// Globalmente
const cardVAO = gl.createVertexArray();

function setupGraphics(){
    gl.useProgram(program);

    // 1. Vincule o VAO
    gl.bindVertexArray(cardVAO);

    // 2. Configure todos os atributos DENTRO do VAO
    
    // Posição
    gl.enableVertexAttribArray(positionLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    // Coordenada de Textura
    gl.enableVertexAttribArray(texcoordLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
    gl.vertexAttribPointer(texcoordLoc, 2, gl.FLOAT, false, 0, 0);
    
    // ID da Carta (VAO armazena o ponteiro, mas o buffer de dados mudará!)
    gl.enableVertexAttribArray(cardIdLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, cardIdBuffer);
    gl.vertexAttribPointer(cardIdLoc, 1, gl.FLOAT, false, 0, 0);

    // Selecionamos a textura uma vez
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, spriteSheetTexture);
    gl.uniform1i(textureLoc, 0);

    gl.uniform2f(spriteSheetSizeLoc, SPRITE_SHEET_COLS, SPRITE_SHEET_ROWS);
    gl.uniform2f(spriteSizeLoc, SPRITE_SIZE.x, SPRITE_SIZE.y);
    
    // 3. Desvincule o VAO (opcional, mas boa prática)
    gl.bindVertexArray(null); 
}

// draw function
function draw() {
    if (!spriteSheetTexture) return; // Aguarda carregamento
    
    gl.clear(gl.COLOR_BUFFER_BIT);

    // 1. Vincule o VAO: Restaura o estado completo dos atributos (pos, texcoord, cardId)
    gl.bindVertexArray(cardVAO);

    // Ordena as cartas por zIndex para desenhar as de menor zIndex primeiro
    const sortedCards = [...cards].sort((a, b) => a.zIndex - b.zIndex); 

    // Agora desenha cada carta
    for (const c of sortedCards) {
        let scale = [CARD_W / canvas.width, CARD_H / canvas.height];

        const cardIds = new Float32Array(6);

        for (let j = 0; j < 6; j++) {
            cardIds[j] = c.idx;
        }

        // 2. Atualiza o Buffer de IDs
        // O bindBuffer é necessário porque estamos MUDANDO o CONTEÚDO do buffer,
        // mesmo que o ponteiro (gl.vertexAttribPointer) já tenha sido definido pelo VAO.
        gl.bindBuffer(gl.ARRAY_BUFFER, cardIdBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, cardIds, gl.DYNAMIC_DRAW);

        // 3. Calcula e Envia a Matriz (Uniform)
        let sm = [
            scale[0], 0, 0,
            0, scale[1], 0,
            0, 0, 1];

        let tm_toCenter = translationMatrix(-0.5, -0.5);
        let rm = rotationMatrix(c.rotation);
        let tm = translationMatrix(c.x, c.y);

        let matrix = transpose3x3(multiply(tm, multiply(rm, multiply(sm, tm_toCenter))));

        gl.uniformMatrix3fv(matrixLoc, false, matrix);
        
        // 4. Desenha 6 vertices (1 carta)
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    
    // 5. Desvincule o VAO (boa prática)
    gl.bindVertexArray(null);
}

setupGraphics();