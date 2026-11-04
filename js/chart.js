/* ============================================
   CHART.JS - Lightweight canvas chart for stats
   No dependencies - draws directly on canvas.
   ============================================ */

const Chart = (function () {
    'use strict';

    /**
     * Draw a horizontal bar chart of W/L/D results.
     * @param {HTMLCanvasElement} canvas
     * @param {Array<{result: 'win'|'loss'|'draw', date: number}>} data
     * @param {Object} opts - { accent, win, loss, draw colors }
     */
    function drawResultsBar(canvas, data, opts = {}) {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const cssW = canvas.clientWidth;
        const cssH = canvas.clientHeight;
        canvas.width = cssW * dpr;
        canvas.height = cssH * dpr;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, cssW, cssH);

        if (!data || data.length === 0) {
            ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
            ctx.font = '13px Vazirmatn, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('هنوز بازی‌ای ثبت نشده', cssW / 2, cssH / 2);
            return;
        }

        const accent = opts.accent || '#6366f1';
        const winColor = opts.win || '#10b981';
        const lossColor = opts.loss || '#ef4444';
        const drawColor = opts.draw || '#f59e0b';
        const gap = 4;
        const labelH = 22;
        const barH = cssH - labelH - 8;
        const barW = Math.max(8, (cssW - gap * (data.length - 1)) / Math.max(data.length, 1));

        // Find max streak to scale (or just use 1)
        data.forEach((d, i) => {
            const x = i * (barW + gap);
            const color = d.result === 'win' ? winColor : d.result === 'loss' ? lossColor : drawColor;
            // Pulse animation height: just use full barH
            ctx.fillStyle = color;
            roundRect(ctx, x, 8, barW, barH, 4);
            ctx.fill();
            // Subtle glow on wins
            if (d.result === 'win') {
                ctx.fillStyle = 'rgba(16, 185, 129, 0.18)';
                roundRect(ctx, x, 8, barW, barH + 4, 4);
                ctx.fill();
            }
        });

        // Legend
        ctx.font = '11px Vazirmatn, sans-serif';
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        const items = [
            { label: 'برد', color: winColor },
            { label: 'باخت', color: lossColor },
            { label: 'مساوی', color: drawColor },
        ];
        let x = 0;
        items.forEach(item => {
            ctx.fillStyle = item.color;
            roundRect(ctx, x, cssH - labelH + 4, 10, 10, 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(148, 163, 184, 0.9)';
            ctx.fillText(item.label, x + 14, cssH - labelH + 4);
            x += 14 + ctx.measureText(item.label).width + 16;
        });

        // Title (small, top-left)
        ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
        ctx.font = '10px Vazirmatn, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`آخرین ${data.length} بازی`, cssW, 0);
    }

    /**
     * Draw a donut chart of overall win/loss/draw distribution.
     */
    function drawDonut(canvas, stats, opts = {}) {
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const cssW = canvas.clientWidth;
        const cssH = canvas.clientHeight;
        canvas.width = cssW * dpr;
        canvas.height = cssH * dpr;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, cssW, cssH);

        const total = stats.wins + stats.losses + stats.draws;
        if (total === 0) {
            ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
            ctx.font = '13px Vazirmatn, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('هنوز آماری نیست', cssW / 2, cssH / 2);
            return;
        }

        const cx = cssW / 2;
        const cy = cssH / 2;
        const r = Math.min(cssW, cssH) / 2 - 8;
        const innerR = r * 0.62;

        const segments = [
            { value: stats.wins, color: opts.win || '#10b981' },
            { value: stats.losses, color: opts.loss || '#ef4444' },
            { value: stats.draws, color: opts.draw || '#f59e0b' },
        ];

        let angle = -Math.PI / 2;
        segments.forEach(seg => {
            if (seg.value === 0) return;
            const sliceAngle = (seg.value / total) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, r, angle, angle + sliceAngle);
            ctx.closePath();
            ctx.fillStyle = seg.color;
            ctx.fill();
            angle += sliceAngle;
        });

        // Inner hole
        ctx.beginPath();
        ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
        ctx.fillStyle = opts.bg || '#1a1a2e';
        ctx.fill();

        // Center text
        ctx.fillStyle = opts.textColor || '#f8fafc';
        ctx.font = 'bold 22px Vazirmatn, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(total), cx, cy - 6);
        ctx.font = '11px Vazirmatn, sans-serif';
        ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
        ctx.fillText('بازی', cx, cy + 12);
    }

    function roundRect(ctx, x, y, w, h, r) {
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
        if (r < 0) r = 0;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    return { drawResultsBar, drawDonut };
})();
