/**
 * AudioWorkletProcessor for the Recitation feature: forwards each 128-frame
 * block of the first input channel to the node's port as a transferable
 * Float32Array. All resampling/framing happens on the main thread
 * (js/recitation-audio.js) so this stays trivially small.
 */
class RecitationCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel && channel.length > 0) {
      const copy = new Float32Array(channel.length);
      copy.set(channel);
      this.port.postMessage(copy, [copy.buffer]);
    }
    return true; // keep processor alive
  }
}

registerProcessor('recitation-capture', RecitationCaptureProcessor);
