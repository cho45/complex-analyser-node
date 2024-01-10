
ComplexAnalyserNode
===================

WebAudio ComplexAnalyserNode using AudioWorklet and WebAssembly.

![demo](./docs/demo.gif )

Usage
=====

```javascript

import { ComplexAnalyserNode } from './complex-analyser-node.js';

const audioContext = new AudioContext();

// ComplexAnalyserNode
//   input count = 1
//     channel count = 2
//       ch1 = In-phase
//       ch2 = Quadrature
await ComplexAnalyserNode.addModule(audioContext);
const complexAnalyserNode = new ComplexAnalyserNode(audioContext, {
	fftSize: 4096
});

const stream = await navigator.mediaDevices.getUserMedia({
	audio: {
		channelCount: {ideal: 2, min: 2},
		/* required for 2ch input input */
		echoCancelation: false,
		noiseSuppression: false,
		audioGainControl: false,
	}
});
const mediaStreamSource = audioContext.createMediaStreamSource(stream);
mediaStreamSource.connect(complexAnalyserNode);

const gain = audioContext.createGain();
gain.gain.value = 0;
complexAnalyserNode.connect(gain);
gain.connect(audioContext.destination);

const I = new Float32Array(complexAnalyserNode.fftSize);
const Q = new Float32Array(complexAnalyserNode.fftSize);
const buffer = new Float32Array(this.complexAnalyserNode.fftSize);
const render = () => {
	complexAnalyserNode.getFloatTimeDomainData(I, 0);
	complexAnalyserNode.getFloatTimeDomainData(Q, 1);

	drawWaveForms([I, Q]);

	complexAnalyserNode.getFloatFrequencyData(buffer);
	drawSpectrum(buffer);

	requestAnimationFrame(render);
};

requestAnimationFrame(render);
```



Development
=============

init
```
cargo install wasm-pack
cargo install cargo-make
```

```
cargo make build
```

run demo (just run http-server on ./site)
```
npm run serve
```
