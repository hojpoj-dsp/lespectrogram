// Axes overlay drawing (frequency on left, time on bottom) + hover line.
const Axes = (() => {
    const FREQ_AXIS_W = 44;
    const TIME_AXIS_H = 28;

    function hexToRgba(hex, alpha) {
        let r = 255, g = 255, b = 255;
        if (hex && hex.length === 7) {
            r = parseInt(hex.slice(1, 3), 16);
            g = parseInt(hex.slice(3, 5), 16);
            b = parseInt(hex.slice(5, 7), 16);
        }
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function draw(ctx, canvasW, canvasH, opts) {
        const { sampleRate, scale, timeColumns, direction, timeFlip, columnsPerSecond = 60, showNoteGrid, noteGridColor = "#ffffff", noteGridOpacity = 0.1, noteGridCOpacity = 0.4 } = opts;
        ctx.clearRect(0, 0, canvasW, canvasH);

        const halfSampleRate = sampleRate / 2;
        const displayH = canvasH - TIME_AXIS_H;

        if (showNoteGrid && typeof hzToScaleFrac !== "undefined" && typeof midiToHz !== "undefined") {
            ctx.lineWidth = 1;
            for (let midi = 12; midi <= 127; midi++) {
                const hz = midiToHz(midi);
                const frac = hzToScaleFrac(hz, halfSampleRate, scale);
                // frac goes from 0 to 1 (bottom to top freq)
                if (frac > 0 && frac < 1) {
                    const y = (1 - frac) * displayH;

                    const isC = (midi % 12) === 0;
                    ctx.strokeStyle = isC ? hexToRgba(noteGridColor, noteGridCOpacity) : hexToRgba(noteGridColor, noteGridOpacity);

                    ctx.beginPath();
                    ctx.moveTo(FREQ_AXIS_W, y);
                    ctx.lineTo(canvasW, y);
                    ctx.stroke();

                    if (isC) {
                        ctx.fillStyle = hexToRgba(noteGridColor, Math.min(1.0, noteGridCOpacity + 0.1));
                        ctx.textAlign = "right";
                        ctx.textBaseline = "middle";
                        ctx.font = "10px sans-serif";
                        ctx.fillText(`C${Math.floor(midi/12)-1}`, canvasW - 4, y);
                    }
                }
            }
        }

        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.fillRect(0, 0, FREQ_AXIS_W, displayH);
        ctx.fillRect(0, displayH, canvasW, TIME_AXIS_H);

        ctx.fillStyle = "#eee";
        ctx.font = "12px sans-serif";
        ctx.textBaseline = "middle";

        // Frequency axis
        ctx.textAlign = "right";
        const fTicks = 8;
        for (let i = 0; i < fTicks; i++) {
            const frac = i / fTicks;
            const y = frac * displayH;
            const hz = scaleToHz(1 - frac, halfSampleRate, scale);
            const drawY = i === 0 ? y + 8 : y;
            ctx.fillText(formatHz(Math.round(hz)), FREQ_AXIS_W - 4, drawY);
        }

        // Time axis
        ctx.textBaseline = "bottom";
        const seconds = Math.max(1, timeColumns / columnsPerSecond);
        const tTicks = Math.min(12, Math.max(4, Math.round(seconds)));
        const displayW = canvasW - FREQ_AXIS_W;
        for (let i = 0; i <= tTicks; i++) {
            const frac = i / tTicks;
            const x = frac * displayW;
            const s = direction === "right" ? (timeFlip?frac:1-frac) * seconds : (timeFlip?1-frac:frac) * seconds;
            let drawX = x + FREQ_AXIS_W;
            if (i === 0) { ctx.textAlign = "left"; drawX += 4; }
            else if (i === tTicks) { ctx.textAlign = "right"; drawX -= 4; }
            else { ctx.textAlign = "center"; }
            ctx.fillText(`${s.toFixed(1)}s`, drawX, canvasH - 6);
        }
    }

    function drawHoverLine(ctx, y, timeColumns, color = "rgba(255, 0, 0, 0.7)") {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(FREQ_AXIS_W, y);
        ctx.lineTo(timeColumns + FREQ_AXIS_W, y);
        ctx.stroke();
    }

    function formatHz(hz) {
        return hz >= 1000 ? `${(hz / 1000).toFixed(1)}k` : `${hz}`;
    }

    return { FREQ_AXIS_W, TIME_AXIS_H, draw, drawHoverLine, formatHz };
})();
