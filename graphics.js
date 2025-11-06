
const canvas = document.getElementById('glcanvas');
const gl = canvas.getContext('webgl2');
canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;
gl.viewport(0, 0, canvas.width, canvas.height);
gl.clearColor(0.0, 0.176, 0.02, 1.0);

// shaders
const vsSource = `#version 300 es
in vec2 a_position;
in vec2 a_texcoord;
uniform mat3 u_matrix;
out vec2 v_texcoord;
void main() {
    vec3 pos = u_matrix * vec3(a_position,1.0);
    gl_Position = vec4(pos.xy,0,1);
    v_texcoord = a_texcoord;
}`;

const fsSource = `#version 300 es
precision mediump float;
in vec2 v_texcoord;
uniform sampler2D u_texture;
out vec4 outColor;
void main() {
    outColor = texture(u_texture, vec2(v_texcoord.x, 1.0 - v_texcoord.y));
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
const matrixLoc = gl.getUniformLocation(program, 'u_matrix');
const textureLoc = gl.getUniformLocation(program, 'u_texture');

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

// tamanho da carta
const CARD_W = 280;
const CARD_H = 400;

// gera textura WebGL para uma carta
function createCardTexture(gl, color, text, idx = 0) {
    // cria canvas temporário
    const c = document.createElement('canvas');
    c.width = CARD_W;
    c.height = CARD_H;
    const ctx = c.getContext('2d');

    // desenha carta
    drawCardFace(ctx, 0, 0, CARD_W, CARD_H, text || 'X', color || 'orange', idx);


    //window.open(c.toDataURL('image/png'), '_blank');


    // cria textura WebGL
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    return tex;
}

// exemplo: gerar cartas
const colors = ['red', 'green', 'blue', 'yellow'];
const nums = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

let cards = [];
let idx = 0;
for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 5; j++) { // 5 cartas por linha
        cards.push({
            x: i * 0.1,
            y: j * 0.2,
            rotation: 0,
            tex: createCardTexture(gl, colors[idx % colors.length], nums[idx % nums.length], idx)
        });
        idx++;
    }
}

//lógica de manipulação de cartas
// coordenadas em screnspace, 0,0 é no centro, negativo para esquerda e para baixo.

let dragCard = null, dragOffset = { x: 0, y: 0 };
canvas.addEventListener('mousedown', (e) => {
    const mx = ((2 * e.clientX) / canvas.width) - 1;
    const my = ((-2 * e.clientY) / canvas.height) + 1;
    console.log("clicked", mx, my, e);
    const scr_card_w = (CARD_W / canvas.width);
    const scr_card_h = (CARD_H / canvas.height);
    for (let i = cards.length - 1; i >= 0; i--) {
        const c = cards[i];
        if (
            mx > c.x - scr_card_w / 2 && mx < c.x + scr_card_w / 2 &&
            my > c.y - scr_card_h / 2 && my < c.y + scr_card_h / 2
        ) {
            dragCard = c;
            dragOffset.x = mx - c.x; dragOffset.y = my - c.y;
            break;
        }
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (dragCard) {
        const mx = ((2 * e.clientX) / canvas.width) - 1;
        const my = ((-2 * e.clientY) / canvas.height) + 1;
        dragCard.x = mx - dragOffset.x;
        dragCard.y = my - dragOffset.y;
        draw();
    }
});
canvas.addEventListener('mouseup', () => { dragCard = null; });

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

// draw function
function draw() {
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);

    gl.enableVertexAttribArray(positionLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    gl.enableVertexAttribArray(texcoordLoc);
    gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
    gl.vertexAttribPointer(texcoordLoc, 2, gl.FLOAT, false, 0, 0);

    for (const c of cards) {
        //console.log(c)
        let scale = [CARD_W / canvas.width, CARD_H / canvas.height];

        let sm = [
            scale[0], 0, 0,
            0, scale[1], 0,
            0, 0, 1];

        let tm_toCenter = translationMatrix(-0.5, -0.5);

        let rm = rotationMatrix(0);

        let tm = translationMatrix(c.x, c.y);

        //let matrix = transpose3x3(multiply(tm, multiply(rm, multiply(sm, tm_toCenter))))
        let matrix = transpose3x3(multiply(tm, multiply(rm, multiply(sm, tm_toCenter))));

        // precisamos transpor pois esse comando utiliza colunas, não linhas
        // colocar o segundo argumento em true resolve, mas não é indicado pela MDN por compatibilidade
        gl.uniformMatrix3fv(matrixLoc, false, matrix);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, c.tex);
        gl.uniform1i(textureLoc, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
}

draw();