// All visualization math AND gesture state live in C++. 
// This file only:
//   * Sizes the canvas + tracks devicePixelRatio.
//   * Each rAF tick, has C++ fill the draw list and walks the commands
//     into Canvas2D (fillRect / strokeRect / fillText).
//   * Forwards mouse events into C++ and applies the cursor it returns.

const WaveRenderer = (() => {
    const CURSORS = ['', 'pointer', 'grab', 'grabbing', 'crosshair'];

    let canvas = null;
    let ctx = null;
    let onSeek = null;
    let rafId = null;
    let cssW = 1, cssH = 1, dpr = 1;
    let cmdsI32 = null, textBytes = null, cmdStrideI32 = 8;
    let dragging = false;

    const decoder = new TextDecoder();

    function init(canvasEl, opts = {}) {
        canvas = canvasEl;
        ctx = canvas.getContext('2d');
        onSeek = opts.onSeek || null;

        canvas.addEventListener('mousedown', onCanvasDown);
        canvas.addEventListener('mousemove', onCanvasMove);
        canvas.addEventListener('mouseleave', () => { if (!dragging) canvas.style.cursor = ''; });
        window.addEventListener('mousemove', onWindowMove);
        window.addEventListener('mouseup', onWindowUp);
    }

    function ensureViews() {
        if (cmdsI32 || !Transport.isReady()) return cmdsI32 != null;
        const exp = Transport.exports;
        const buf = Transport.memory.buffer;
        const cmdsPtr = exp.transport_drawlist_cmds_ptr();
        const textPtr = exp.transport_drawlist_text_ptr();
        const maxCmds = exp.transport_drawlist_max_cmds();
        const textCap = exp.transport_drawlist_text_capacity();
        cmdStrideI32 = exp.transport_drawlist_cmd_stride_i32();
        cmdsI32 = new Int32Array(buf, cmdsPtr, maxCmds * cmdStrideI32);
        textBytes = new Uint8Array(buf, textPtr, textCap);
        return true;
    }

    function ensureCanvasSize() {
        const rect = canvas.getBoundingClientRect();
        cssW = Math.max(1, Math.floor(rect.width));
        cssH = Math.max(1, Math.floor(rect.height));
        dpr = window.devicePixelRatio || 1;
        const W = cssW * dpr, H = cssH * dpr;
        if (canvas.width !== W || canvas.height !== H) {
            canvas.width = W;
            canvas.height = H;
        }
        return { W, H };
    }

    function cssCoords(e) {
        const rect = canvas.getBoundingClientRect();
        return { x: Math.round(e.clientX - rect.left), y: Math.round(e.clientY - rect.top) };
    }

    function onCanvasDown(e) {
        if (e.button !== 0 || !Transport.isReady()) return;
        const { x, y } = cssCoords(e);
        const cur = Transport.exports.transport_mouse_down(x, y, cssW);
        canvas.style.cursor = CURSORS[cur] || '';
        if (Transport.exports.transport_drag_mode() !== 0) dragging = true;
    }
    function onCanvasMove(e) {
        if (dragging || !Transport.isReady()) return;
        const { x, y } = cssCoords(e);
        canvas.style.cursor = CURSORS[Transport.exports.transport_hover_cursor(x, y, cssW)] || '';
    }
    function onWindowMove(e) {
        if (!dragging || !Transport.isReady()) return;
        const { x, y } = cssCoords(e);
        canvas.style.cursor = CURSORS[Transport.exports.transport_mouse_move(x, y, cssW)] || '';
    }
    function onWindowUp(e) {
        if (!dragging || !Transport.isReady()) return;
        const { x, y } = cssCoords(e);
        const playFrame = Transport.exports.transport_mouse_up(x, y, cssW);
        dragging = false;
        canvas.style.cursor = '';
        if (playFrame >= 0 && onSeek) onSeek(playFrame, -1);
    }

    function syncZoomLabel() {
        const el = document.getElementById('transportZoomVal');
        if (!el) return;
        const z = Transport.getDisplayZoom() || 1;
        el.textContent = z >= 10 ? z.toFixed(0) + '×' : z.toFixed(1) + '×';
    }
    function updateTimeDisplay() {
        const el = document.getElementById('transportTime');
        if (!el) return;
        const sr = Transport.getSampleRate() || 1;
        const cur = Transport.getPos() / sr;
        const tot = Transport.getTrackLength() / sr;
        el.textContent = formatTime(cur) + ' / ' + formatTime(tot);
    }
    function formatTime(s) {
        if (!isFinite(s) || s < 0) s = 0;
        const m = Math.floor(s / 60);
        const sec = (s - m * 60).toFixed(2).padStart(5, '0');
        return m + ':' + sec;
    }

    function executeDrawList() {
        const count = Transport.exports.transport_drawlist_count();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        for (let i = 0; i < count; i++) {
            const off = i * cmdStrideI32;
            const type = cmdsI32[off];
            const x = cmdsI32[off + 1], y = cmdsI32[off + 2];
            const w = cmdsI32[off + 3], h = cmdsI32[off + 4];
            const c = cmdsI32[off + 5] >>> 0;
            const css = `rgba(${(c >>> 24) & 0xFF},${(c >>> 16) & 0xFF},${(c >>> 8) & 0xFF},${(c & 0xFF) / 255})`;

            if (type === 1) {
                ctx.fillStyle = css; ctx.fillRect(x, y, w, h);
            } else if (type === 2) {
                const lw = cmdsI32[off + 6];
                ctx.strokeStyle = css; ctx.lineWidth = lw;
                ctx.strokeRect(x + lw / 2, y + lw / 2, w - lw, h - lw);
            } else if (type === 3) {
                const fontPx = w, align = h;
                const tOff = cmdsI32[off + 6], tLen = cmdsI32[off + 7];
                ctx.fillStyle = css;
                ctx.font = fontPx + 'px sans-serif';
                ctx.textAlign = align === 0 ? 'left' : align === 2 ? 'right' : 'center';
                ctx.textBaseline = 'top';
                const copy = new Uint8Array(tLen);
                copy.set(textBytes.subarray(tOff, tOff + tLen));
                ctx.fillText(decoder.decode(copy), x, y);
            }
        }
    }

    function tick() {
        if (!Transport.isReady() || !ensureViews()) {
            rafId = requestAnimationFrame(tick);
            return;
        }
        const { W, H } = ensureCanvasSize();
        Transport.exports.transport_render_drawlist(W, H, dpr);
        executeDrawList();
        updateTimeDisplay();
        syncZoomLabel();
        rafId = requestAnimationFrame(tick);
    }

    function startLoop() { if (!rafId) rafId = requestAnimationFrame(tick); }
    function stopLoop() { if (rafId) cancelAnimationFrame(rafId); rafId = null; }
    function refresh() { startLoop(); }

    return { init, refresh, startLoop, stopLoop };
})();
