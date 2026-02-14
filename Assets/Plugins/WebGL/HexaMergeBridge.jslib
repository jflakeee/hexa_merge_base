mergeInto(LibraryManager.library, {
    SendMessageToJS: function(messagePtr) {
        var message = UTF8ToString(messagePtr);

        // window.SendMessageFromUnity 콜백이 있으면 호출 (WebGL 템플릿 연동)
        if (typeof window.SendMessageFromUnity === 'function') {
            window.SendMessageFromUnity(message);
        }

        // window.onUnityMessage 콜백 (레거시 호환)
        if (typeof window.onUnityMessage === 'function') {
            try { window.onUnityMessage(JSON.parse(message)); } catch(e) {}
        }

        // CustomEvent 발송 (Playwright 테스트용)
        try {
            var data = JSON.parse(message);
            window.dispatchEvent(new CustomEvent('unityMessage', { detail: data }));
        } catch(e) {
            console.warn('[HexaMergeBridge] JSON parse error:', message);
        }
    },

    SetWindowProperty: function(keyPtr, valuePtr) {
        var key = UTF8ToString(keyPtr);
        var value = UTF8ToString(valuePtr);
        try {
            window[key] = JSON.parse(value);
        } catch(e) {
            window[key] = value;
        }
    },

    CallWindowCallback: function(callbackNamePtr, valuePtr) {
        var callbackName = UTF8ToString(callbackNamePtr);
        var value = UTF8ToString(valuePtr);
        if (typeof window[callbackName] === 'function') {
            window[callbackName](value);
        }
    },

    RegisterHexaTestAPI: function() {
        if (window.HexaTest) return;

        var pendingCallbacks = {};
        var callbackId = 0;

        function callUnity(method, param) {
            return new Promise(function(resolve) {
                var id = 'ht_' + (++callbackId);
                pendingCallbacks[id] = resolve;
                var msg = id + '|' + (param !== undefined ? param : '');
                window.unityInstance.SendMessage('HexaTestBridge', method, msg);
            });
        }

        function callUnityVoid(method, param) {
            window.unityInstance.SendMessage('HexaTestBridge', method, param !== undefined ? String(param) : '');
        }

        // Unity 측 응답을 unityMessage 이벤트로 수신
        window.addEventListener('unityMessage', function(e) {
            if (e.detail && e.detail.__hexaTestCallback && e.detail.id) {
                var id = e.detail.id;
                if (pendingCallbacks[id]) {
                    pendingCallbacks[id](e.detail.result);
                    delete pendingCallbacks[id];
                }
            }
        });

        window.HexaTest = {
            triggerSpawnAnimation: function(count) { callUnityVoid('TriggerSpawnAnimation', count); },
            triggerMerge: function(q1, r1, q2, r2) { callUnityVoid('TriggerMerge', q1+','+r1+','+q2+','+r2); },
            triggerCombo: function(count) { callUnityVoid('TriggerCombo', count); },
            triggerWaveAnimation: function(direction) { callUnityVoid('TriggerWaveAnimation', direction); },
            triggerScreenTransition: function(from, to) { callUnityVoid('TriggerScreenTransition', from+','+to); },
            isAnimationPlaying: function() { return callUnity('IsAnimationPlaying', ''); },
            getBlockScale: function(q, r) { return callUnity('GetBlockScale', q+','+r); },
            getBlockAlpha: function(q, r) { return callUnity('GetBlockAlpha', q+','+r); },
            getAnimationState: function() { return callUnity('GetAnimationState', ''); },
            getFPS: function() { return callUnity('GetFPS', ''); },
            setBoardState: function(stateJson) { callUnityVoid('SetBoardState', stateJson); }
        };
    }
});
