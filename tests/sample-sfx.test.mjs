import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const source = await readFile(new URL('../src/audio/SampleSFX.js', import.meta.url), 'utf8');
const { SampleSFX } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('iOS audio retries activation, restores interruptions and preserves mute', async () => {
    const listeners = new Map();
    let contexts = 0;
    let allowResume = false;
    let resumes = 0;
    let starts = 0;
    globalThis.document = {
        visibilityState: 'visible',
        addEventListener(name, handler) {
            const handlers = listeners.get(name) || [];
            handlers.push(handler);
            listeners.set(name, handlers);
        },
    };
    Object.defineProperty(globalThis.navigator, 'audioSession', {
        configurable: true, value: { type: 'auto' },
    });
    globalThis.window = { AudioContext: class {
        constructor() { contexts++; this.state = 'suspended'; this.sampleRate = 44100; }
        resume() {
            resumes++;
            if (!allowResume) return Promise.reject(new Error('Gesture required'));
            this.state = 'running';
            return Promise.resolve();
        }
        createBuffer() { return {}; }
        createBufferSource() {
            return { connect() {}, disconnect() {}, start() { starts++; }, playbackRate: { value: 1 } };
        }
        createGain() { return { gain: { value: 1 }, connect() {} }; }
    } };
    const sfx = new SampleSFX();
    let loads = 0;
    sfx._load = () => { loads++; };
    sfx.init();
    await Promise.resolve();
    assert.equal(sfx.audioContext.state, 'suspended');
    assert.equal(navigator.audioSession.type, 'playback');
    allowResume = true;
    listeners.get('touchend')[0]();
    assert.equal(sfx.audioContext.state, 'running');
    sfx.init();
    assert.equal(contexts, 1);
    assert.equal(loads, 5);
    assert.equal(listeners.get('touchend').length, 1);
    sfx.audioContext.state = 'interrupted';
    listeners.get('visibilitychange')[0]();
    assert.equal(sfx.audioContext.state, 'running');
    sfx.buffers.merge = {};
    sfx.audioContext.state = 'interrupted';
    sfx.play('mergeStep');
    assert.equal(sfx.audioContext.state, 'running');
    const beforeMute = starts;
    sfx.setMuted(true);
    sfx.play('mergeStep');
    assert.equal(starts, beforeMute);
    sfx.audioContext.state = 'closed';
    const beforeClosed = resumes;
    sfx.unlock();
    assert.equal(resumes, beforeClosed);
    delete navigator.audioSession;
    const legacy = new SampleSFX();
    legacy._load = () => {};
    assert.doesNotThrow(() => legacy.init());
});
