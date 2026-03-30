/**
 * AudioWorklet processor for capturing microphone audio.
 *
 * Runs off the main thread — resamples from the device's native sample rate
 * to 16 kHz, converts Float32 samples to Int16 PCM, computes RMS energy for
 * the visual level indicator, and posts both back to the main thread via the
 * MessagePort.
 *
 * Output message: { pcm: Int16Array, rms: number }
 */
class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // `sampleRate` is a global in AudioWorkletGlobalScope — it reflects the
    // AudioContext's actual sample rate (typically 44100 or 48000).
    this._srcRate = sampleRate;
    this._tgtRate = 16000;
    this._ratio = this._srcRate / this._tgtRate;

    // Buffers
    this._inputBuffer = new Float32Array(0);
    this._outputBuffer = new Float32Array(0);
    this._resampleOffset = 0;

    // Target ~2048 output samples per chunk (matches old ScriptProcessorNode bufferSize)
    this._chunkSize = 2048;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) return true;

    const channelData = input[0];

    // Accumulate source samples
    const newInput = new Float32Array(this._inputBuffer.length + channelData.length);
    newInput.set(this._inputBuffer);
    newInput.set(channelData, this._inputBuffer.length);
    this._inputBuffer = newInput;

    // Resample to 16 kHz via linear interpolation
    const availableOut = Math.floor(
      (this._inputBuffer.length - 1 - this._resampleOffset) / this._ratio,
    );
    if (availableOut <= 0) return true;

    const resampled = new Float32Array(availableOut);
    for (let i = 0; i < availableOut; i++) {
      const srcPos = this._resampleOffset + i * this._ratio;
      const idx = Math.floor(srcPos);
      const frac = srcPos - idx;
      const s0 = this._inputBuffer[idx] || 0;
      const s1 = this._inputBuffer[idx + 1] || 0;
      resampled[i] = s0 + frac * (s1 - s0);
    }

    // Advance and trim consumed input
    const advancedPos = this._resampleOffset + availableOut * this._ratio;
    const consumed = Math.floor(advancedPos);
    this._resampleOffset = advancedPos - consumed;
    this._inputBuffer = this._inputBuffer.slice(consumed);

    // Accumulate resampled output
    const newOutput = new Float32Array(this._outputBuffer.length + resampled.length);
    newOutput.set(this._outputBuffer);
    newOutput.set(resampled, this._outputBuffer.length);
    this._outputBuffer = newOutput;

    // Emit full chunks
    while (this._outputBuffer.length >= this._chunkSize) {
      const chunk = this._outputBuffer.slice(0, this._chunkSize);
      this._outputBuffer = this._outputBuffer.slice(this._chunkSize);

      // RMS energy
      let sumSquares = 0;
      for (let i = 0; i < chunk.length; i++) {
        sumSquares += chunk[i] * chunk[i];
      }
      const rms = Math.sqrt(sumSquares / chunk.length);

      // Convert Float32 → Int16 PCM
      const pcm16 = new Int16Array(chunk.length);
      for (let i = 0; i < chunk.length; i++) {
        const s = Math.max(-1, Math.min(1, chunk[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      this.port.postMessage({ pcm: pcm16, rms }, [pcm16.buffer]);
    }

    return true;
  }
}

registerProcessor("audio-capture-processor", AudioCaptureProcessor);
