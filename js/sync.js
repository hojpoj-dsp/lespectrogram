// Handles Cross-tab synchronization via BroadcastChannel
const Sync = (() => {
    let syncChannel = null;
    let isHandlingSync = false;

    function init(callbacks) {
        if (!window.BroadcastChannel) return;

        // Disconnect old if exists
        reconnect();

        try {
            syncChannel.onmessage = (e) => {
                if (!e.data) return;
                isHandlingSync = true;
                try {
                    const { type, time } = e.data;
                    if (type === 'play' && callbacks.onPlay) callbacks.onPlay();
                    else if (type === 'pause' && callbacks.onPause) callbacks.onPause();
                    else if (type === 'stop' && callbacks.onStop) callbacks.onStop();
                    else if (type === 'seek' && callbacks.onSeek) callbacks.onSeek(time);
                } finally {
                    isHandlingSync = false;
                }
            };
        } catch (e) { /* ignore */ }
    }

    function reconnect() {
        if (syncChannel) {
            syncChannel.close();
            syncChannel = null;
        }

        if (typeof Prefs !== "undefined" && Prefs.get("enableSync")) {
            try {
                syncChannel = new BroadcastChannel('lespectrogram_sync');
            } catch(e) {}
        }
    }

    function post(type, payload = {}) {
        if (syncChannel && !isHandlingSync && typeof Prefs !== "undefined" && Prefs.get("enableSync")) {
            syncChannel.postMessage({ type, ...payload });
        }
    }

    return { init, reconnect, post };
})();

