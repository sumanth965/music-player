/**
 * pitch-processor.worklet.js
 * Dedicated AudioWorkletProcessor for real-time vocal pitch detection (YIN/autocorrelation).
 * Runs completely off the UI main thread on the browser's audio rendering thread.
 */

class PitchProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.sampleRate = options?.processorOptions?.sampleRate || 44100;
    this.bufferSize = 2048;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
    this.frameSkip = 0;
  }

  autoCorrelate(buf) {
    let sumOfSquares = 0;
    for (let i = 0; i < this.bufferSize; i++) {
      const v = buf[i];
      sumOfSquares += v * v;
    }
    const rms = Math.sqrt(sumOfSquares / this.bufferSize);
    if (rms < 0.015) {
      return { pitch: 0, clarity: 0, rms };
    }

    // Human vocal range: 65 Hz (C2) to 1050 Hz (C6)
    const minPeriod = Math.floor(this.sampleRate / 1050);
    const maxPeriod = Math.floor(this.sampleRate / 65);
    let bestPeriod = -1;
    let bestCorrelation = 0;

    for (let period = minPeriod; period <= maxPeriod; period++) {
      let correlation = 0;
      let normA = 0;
      let normB = 0;
      for (let i = 0; i < this.bufferSize - period; i++) {
        const a = buf[i];
        const b = buf[i + period];
        correlation += a * b;
        normA += a * a;
        normB += b * b;
      }
      const norm = Math.sqrt(normA * normB);
      const normalizedCorr = norm > 0 ? correlation / norm : 0;
      if (normalizedCorr > bestCorrelation && normalizedCorr > 0.6) {
        bestCorrelation = normalizedCorr;
        bestPeriod = period;
      }
    }

    if (bestCorrelation > 0.7 && bestPeriod > 0) {
      const pitch = this.sampleRate / bestPeriod;
      return { pitch, clarity: bestCorrelation, rms };
    }
    return { pitch: 0, clarity: bestCorrelation, rms };
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const channelData = input[0];

    for (let i = 0; i < channelData.length; i++) {
      this.buffer[this.bufferIndex] = channelData[i];
      this.bufferIndex = (this.bufferIndex + 1) % this.bufferSize;
    }

    this.frameSkip++;
    // Process roughly every 4 blocks (512 samples ~= 11.6ms at 44.1kHz)
    if (this.frameSkip >= 4) {
      this.frameSkip = 0;
      const linear = new Float32Array(this.bufferSize);
      for (let i = 0; i < this.bufferSize; i++) {
        linear[i] = this.buffer[(this.bufferIndex + i) % this.bufferSize];
      }
      const res = this.autoCorrelate(linear);
      this.port.postMessage(res);
    }

    return true;
  }
}

registerProcessor('pitch-processor', PitchProcessor);

