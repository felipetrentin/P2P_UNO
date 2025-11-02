function drawCardFace(g, x, y, w, h, num, color, idx) {
    // fundo carta
    const radius = 10;
    g.fillStyle = color;
    roundRect(g, x, y, w, h, radius, true, false);
    g.strokeStyle = '#222';
    g.lineWidth = 2;
    g.stroke();

    // número principal
    g.fillStyle = '#fff';
    g.font = '24px sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'top';
    g.fillText(num, x + 11, y + 12);

    // underline se for 6 ou 9
    if (num === '6' || num === '9') {
        const textWidth = g.measureText(num).width;
        const underlineY = y + 12 + 24 + 2; // top + fontSize + gap
        g.strokeStyle = '#fff';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x + 11, underlineY);
        g.lineTo(x + 11 + textWidth, underlineY);
        g.stroke();
    }

    // decoration: small index number
    g.fillStyle = 'rgba(0,0,0,0.05)';
    g.font = '110px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(idx.toString(), x + (w / 2), y + (h / 2));
}


function roundRect(ctx, x, y, w, h, r, fill, stroke) {
    if (typeof r === 'undefined') r = 5;
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    if (fill) ctx.fill(); if (stroke) ctx.stroke();
}