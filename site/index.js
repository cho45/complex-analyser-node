
import { ComplexAnalyserNode } from "../complex-analyser-node.js";
import { AutoGainControlNode } from "../auto-gain-control-node.js";

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
		peaks: []
	},

	created: async function () {
	},

	mounted: async function () {
	},

	methods: {
		run: async function () {
			this.running = true;

			this.audioContext = new AudioContext();
			const sampleRate = 44100; // XXX: this.audioContext.sampleRate is untrusted value....

			await Promise.all([
				AutoGainControlNode.addModule(this.audioContext),
				ComplexAnalyserNode.addModule(this.audioContext),
			]);

			this.autoGainControlNode = new AutoGainControlNode(this.audioContext, {});

			this.complexAnalyserNode = new ComplexAnalyserNode(this.audioContext, {
				fftSize: 4096
			});

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
			mediaStreamSource.connect(this.autoGainControlNode);
			this.autoGainControlNode.connect(this.complexAnalyserNode);

			const gain = this.audioContext.createGain();
			gain.gain.value = 0;
			this.complexAnalyserNode.connect(gain);
			await this.complexAnalyserNode.init();
			gain.connect(this.audioContext.destination);



			const freqResolution = sampleRate / this.complexAnalyserNode.fftSize;
			const timeResolution = this.complexAnalyserNode.fftSize / sampleRate;
			console.log({sampleRate, freqResolution, timeResolution});
			this.freqResolution = freqResolution;
			this.timeResolution = timeResolution;

			const canvas = this.$refs.ffthist;
			canvas.width = HISTORY;
			canvas.height = this.complexAnalyserNode.fftSize;

			this.$refs.fftwave.width = 50;
			this.$refs.fftwave.height = canvas.height;

			this.fftHistory = [];
			this.fftMovingAvg = new Float32Array(canvas.height);
			this.fftHistorySize = 100;


			const ctx = canvas.getContext('2d');
			ctx.fillRect(0, 0, canvas.width, canvas.height);

			this.ctx = ctx;
			this.canvas = canvas;
			this.imageData = ctx.createImageData(1, canvas.height);
			console.log(this.imageData);

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

				requestAnimationFrame(render);
			};

			requestAnimationFrame(render);
		},

		processFrequencyData: function (buffer) {
			const ctx = this.ctx;
			const canvas = this.canvas;

			// shift left current image
			ctx.drawImage(
				canvas,

				1, 0,
				canvas.width - 1, canvas.height,

				0, 0,
				canvas.width - 1, canvas.height
			);

			const imageData = this.imageData;
			const data = imageData.data;

			for (let i = 0, len = canvas.height; i < len; i++) {
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
			ctx.putImageData(imageData, canvas.width - 1, 0);
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
