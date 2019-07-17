
import { ComplexAnalyserNode } from "../complex-analyser-node.js";
import { AutoGainControlNode } from "../auto-gain-control-node.js";
import { ComplexBandpassFilterNode } from "../complex-bandpass-filter-node.js";
import { FrequencyConverterNode } from "../frequency-converter-node.js";
import { DemodulateProtoNode } from "../demodulate-proto-node.js";

function convertDecibelToRGB (dB) {
	var r = 0, g = 0, b = 0;
	var p = (dB + 100) / 70;

	switch (true) {
	case p > 5.0/6.0:
		// yellow -> red
		p = (p - (5 / 6.0)) / (1 / 6.0);
		r = 255;
		g = 255 * p;
		b = 255 * p;
		break;
	case p > 4.0/6.0:
		// yellow -> red
		p = (p - (4 / 6.0)) / (1 / 6.0);
		r = 255;
		g = 255 * (1 - p);
		b = 0;
		break;
	case p > 3.0/6.0:
		// green -> yellow
		p = (p - (3 / 6.0)) / (1 / 6.0);
		r = 255 * p;
		g = 255;
		b = 0;
		break;
	case p > 2.0/6.0:
		// light blue -> green
		p = (p - (2 / 6.0)) / (1 / 6.0);
		r = 0;
		g = 255;
		b = 255 * (1 - p);
		break;
	case p > 1.0/6.0:
		// blue -> light blue
		p = (p - (1 / 6.0)) / (1 / 6.0);
		r = 0;
		g = 255 * p;
		b = 255;
		break;
	case p > 0:
		// black -> blue
		p = p / (1 / 6.0);
		r = 0;
		g = 0;
		b = 255 * p;
	}

	return { r: r, g: g, b : b };
}


const HISTORY = 1024;
const app = new Vue({
	el: '#app',
	data: {
		fps: 0,
		running: false,
		predicted: '',
		snr: 0,
		lsb: false,
		bandpass: {
			bandwidth: "3000",
			freq: "1700",
		},
		converter: {
			freq: "1700",
		},
		peaks: []
	},

	created: async function () {
	},

	mounted: async function () {
		this.$watch('bandpass', (newVal, oldVal) => {
			console.log('bandpass params changes', newVal);
			this.updateBandpassCoeffs();
		}, { deep: true });
		this.$watch('lsb', (newVal, oldVal) => {
			this.updateBandpassCoeffs();
		});
	},

	methods: {
		run: async function () {
			this.running = true;

			this.audioContext = new AudioContext();
			const sampleRate = 44100; // XXX: this.audioContext.sampleRate is untrusted value....

			await Promise.all([
				AutoGainControlNode.addModule(this.audioContext),
				ComplexAnalyserNode.addModule(this.audioContext),
				ComplexBandpassFilterNode.addModule(this.audioContext),
				FrequencyConverterNode.addModule(this.audioContext),
				DemodulateProtoNode.addModule(this.audioContext),
			]);

			this.autoGainControlNode = new AutoGainControlNode(this.audioContext, {});
			this.complexBandpassFilterNode = new ComplexBandpassFilterNode(this.audioContext, {
				coeffs: []
			});

			this.complexAnalyserNode = new ComplexAnalyserNode(this.audioContext, {
				fftSize: 4096
			});

			this.demodulateNode = new DemodulateProtoNode(this.audioContext);

			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					channelCount: {ideal: 2, min: 1},
					echoCancelation: false,
					noiseSuppression: false,
					audioGainControl: false,
				}
			});
			console.log(stream);
			const mediaStreamSource = this.audioContext.createMediaStreamSource(stream);
			console.log(mediaStreamSource);
			const gain = this.audioContext.createGain();
			gain.gain.value = 3;

			const freqConv = true;
			if (freqConv) {
				this.frequencyConverterNode = new FrequencyConverterNode(this.audioContext);
				this.frequencyConverterNode.loFrequency.value = -Number(this.bandpass.freq);

				this.complexBandpassFilterNode2 = new ComplexBandpassFilterNode(this.audioContext, {
					coeffs: []
				});

				this.complexAnalyserNode2 = new ComplexAnalyserNode(this.audioContext, {
					fftSize: 4096
				});

				const nodes = [
					mediaStreamSource,
					this.autoGainControlNode,
					this.complexAnalyserNode,
					this.complexBandpassFilterNode,
					this.frequencyConverterNode,
					this.complexAnalyserNode2,
					this.complexBandpassFilterNode2,
					this.demodulateNode
				];

				for (let i = 1; i < nodes.length; i++) {
					nodes[i-1].connect(nodes[i]);
				}
			} else {
				mediaStreamSource.connect(this.autoGainControlNode);
				this.autoGainControlNode.connect(this.complexBandpassFilterNode);
				this.complexBandpassFilterNode.connect(this.complexAnalyserNode);
				this.complexAnalyserNode.connect(this.demodulateNode);
			}

			this.demodulateNode.connect(gain);
			gain.connect(this.audioContext.destination);

			this.updateBandpassCoeffs();


			const freqResolution = sampleRate / this.complexAnalyserNode.fftSize;
			const timeResolution = this.complexAnalyserNode.fftSize / sampleRate;
			console.log({sampleRate, freqResolution, timeResolution});
			this.freqResolution = freqResolution;
			this.timeResolution = timeResolution;

			const canvasHist = this.$refs.ffthist;
			canvasHist.width = HISTORY;
			canvasHist.height = this.complexAnalyserNode.fftSize;
			const ctxHist = canvasHist.getContext('2d');
			ctxHist.fillRect(0, 0, canvasHist.width, canvasHist.height);
			this.canvasHist = canvasHist;
			this.ctxHist = ctxHist;

			const canvasHist2 = this.$refs.ffthist2;
			canvasHist2.width = HISTORY / 2;
			canvasHist2.height = this.complexAnalyserNode2.fftSize;
			const ctxHist2 = canvasHist2.getContext('2d');
			ctxHist2.fillRect(0, 0, canvasHist2.width, canvasHist2.height);
			this.canvasHist2 = canvasHist2;
			this.ctxHist2 = ctxHist2;

			const canvasWave = this.$refs.fftwave;
			canvasWave.width = 50;
			canvasWave.height = canvasHist.height;

			const ctxWave = canvasWave.getContext('2d');
			this.canvasWave = canvasWave;
			this.ctxWave = ctxWave;

			this.imageData = ctxHist.createImageData(1, canvasHist.height);

			this.fftHistory = [];
			this.fftMovingAvg = new Float32Array(canvasHist.height);
			this.fftHistorySize = 100;

			const buffer = new Float32Array(this.complexAnalyserNode.fftSize);

			console.log('run');
			let atime = this.audioContext.currentTime;
			let ptime = performance.now();
			const render = () => {
				const aElapsed = this.audioContext.currentTime - atime;
				atime = this.audioContext.currentTime;

				const pElapsed = performance.now() - ptime;
				ptime = performance.now();
				this.fps = Math.round(1000/pElapsed);

				const I = new Float32Array(this.complexAnalyserNode.fftSize);
				this.complexAnalyserNode.getFloatTimeDomainData(I, 0);
				const Q = new Float32Array(this.complexAnalyserNode.fftSize);
				this.complexAnalyserNode.getFloatTimeDomainData(Q, 1);
				this.drawWaveForms('waveform', [I, Q]);

				this.complexAnalyserNode.getFloatFrequencyData(buffer);
				this.processFrequencyData(buffer);

				this.complexAnalyserNode2.getFloatFrequencyData(buffer);
				this.processFrequencyData2(buffer);

				requestAnimationFrame(render);
			};

			requestAnimationFrame(render);
		},

		updateBandpassCoeffs: function () {
			const sampleRate = this.audioContext.sampleRate;
			if (this.complexBandpassFilterNode) {
				console.log({sampleRate}, this.bandpass);

				let lFreq, hFreq;
				if (!this.lsb) {
					lFreq = Number(this.bandpass.freq);
					hFreq = Number(this.bandpass.freq) + Number(this.bandpass.bandwidth);
				} else {
					lFreq = Number(this.bandpass.freq) - Number(this.bandpass.bandwidth);
					hFreq = Number(this.bandpass.freq);
				}

				this.complexBandpassFilterNode.coeffs = ComplexBandpassFilterNode.calculateCoeffs(
					711,
					sampleRate,
					lFreq,
					hFreq,
					function (x) {
						return 0.54 - 0.46 * Math.cos(2 * Math.PI * x);
					}
				);
			}
			if (this.complexBandpassFilterNode2) {
				this.complexBandpassFilterNode2.coeffs = ComplexBandpassFilterNode.calculateCoeffs(
					711,
					sampleRate,
					-Number(20000 || this.bandpass.bandwidth),
					+Number(20000 || this.bandpass.bandwidth),
					function (x) {
						return 0.54 - 0.46 * Math.cos(2 * Math.PI * x);
					}
				);
				this.frequencyConverterNode.loFrequency.value = -Number(this.bandpass.freq);
			}
		},

		processFrequencyData: function (buffer) {
			const { canvasHist, ctxHist, canvasWave, ctxWave } = this;

			ctxWave.fillStyle = '#000000';
			ctxWave.strokeStyle = '#ffffff';
			ctxWave.fillRect(0, 0, canvasWave.width, canvasWave.height);
			ctxWave.beginPath();
			ctxWave.moveTo(0, 0);

			// shift left current image
			ctxHist.drawImage(
				canvasHist,

				1, 0,
				canvasHist.width - 1, canvasHist.height,

				0, 0,
				canvasHist.width - 1, canvasHist.height
			);

			const imageData = this.imageData;
			const data = imageData.data;

			for (let i = 0, len = canvasHist.height; i < len; i++) {
				const index = (len-i);

				// const dB = (buffer[index] / 255) * (this.analyserNode.maxDecibels - this.analyserNode.minDecibels) + this.analyserNode.minDecibels;
				const dB = buffer[index];
				const rgb = convertDecibelToRGB(dB);
				const n = i * 4;
				data[n + 0] = rgb.r;
				data[n + 1] = rgb.g;
				data[n + 2] = rgb.b;
				data[n + 3] = 255;

				ctxWave.lineTo( (dB + 100) / 70 * canvasWave.width, i);
			}
			ctxHist.putImageData(imageData, canvasHist.width - 1, 0);

			ctxWave.lineWidth = 1;
			ctxWave.stroke();

			const freqLines = [0, Number(this.bandpass.freq), Number(this.bandpass.freq) + (Number(this.bandpass.bandwidth) * (this.lsb ? -1 : 1))];
			for (let freq of freqLines) {
				const pos = freq / this.freqResolution;

				ctxWave.strokeStyle = '#ff0000';
				ctxWave.beginPath();
				ctxWave.moveTo(0, canvasWave.height / 2 - pos);
				ctxWave.lineTo(canvasWave.width, canvasWave.height / 2 - pos);
				ctxWave.lineWidth = 5;
				ctxWave.stroke();
			}

			ctxWave.fillStyle = 'rgba(100, 100, 255, 0.5)';
			ctxWave.fillRect(
				0, (canvasWave.height / 2) - (Number(this.bandpass.freq) / this.freqResolution),
				canvasWave.width,  (Number(this.bandpass.bandwidth) / this.freqResolution * (this.lsb ? 1 : -1)),
			);
		},

		processFrequencyData2: function (buffer) {
			const { canvasHist2: canvasHist, ctxHist2: ctxHist } = this;
			// shift left current image
			ctxHist.drawImage(
				canvasHist,

				1, 0,
				canvasHist.width - 1, canvasHist.height,

				0, 0,
				canvasHist.width - 1, canvasHist.height
			);

			const imageData = this.imageData;
			const data = imageData.data;

			for (let i = 0, len = canvasHist.height; i < len; i++) {
				const index = (len-i);

				// const dB = (buffer[index] / 255) * (this.analyserNode.maxDecibels - this.analyserNode.minDecibels) + this.analyserNode.minDecibels;
				const dB = buffer[index];
				const rgb = convertDecibelToRGB(dB);
				const n = i * 4;
				data[n + 0] = rgb.r;
				data[n + 1] = rgb.g;
				data[n + 2] = rgb.b;
				data[n + 3] = 255;
			}
			ctxHist.putImageData(imageData, canvasHist.width - 1, 0);
		},

		processTimeDomainData: function (buffer) {
			this.worker.receiveData(buffer);
		},

		drawWaveForms: function (ref, buffers) {
			const canvas = this.$refs[ref];
			canvas.height = 200;
			canvas.width  = 1024; // buffers[0].length;

			const ctx = canvas.getContext('2d');

			ctx.fillStyle = "#ffffff";
			ctx.fillRect(0, 0, canvas.width, canvas.height);

			ctx.save();
			ctx.translate(0, canvas.height / 2);

			ctx.strokeStyle = "#cccccc";
			ctx.beginPath();
			ctx.moveTo(0, 0);
			ctx.lineTo(canvas.width, 0);
			ctx.stroke();

			const colors = [
				"#6666CC",
				"#66CC66",
				"#CC5566",
			];

			const gain = 10;
			for (let [n, buffer] of buffers.entries()) {
				ctx.beginPath();
				ctx.moveTo(0, 0);
				for (let i = 0, len = buffer.length; i < len; i++) {
					ctx.lineTo(i, (buffer[i] * gain / -2) * canvas.height);
				}
				ctx.strokeStyle = colors[ n % colors.length ];
				ctx.stroke();
			}
			ctx.restore();
		},

		frequencyToBinIndex: function (freq) {
			return Math.round( (freq - LOWER_FREQ) / this.freqResolution)
		},

		binIndexToFrequency: function (index) {
			return index * this.freqResolution;
		}
	},
});
