
export class ComplexAnalyserNode extends AudioWorkletNode {

	set fftSize(value) {
		this._fftSize = value;
		this.buffer = new Float32Array(this._fftSize * 2);
		this.prev   = new Float32Array(this._fftSize * 2);
		this.window = new Float32Array(this._fftSize);

		this._createWindow();
		this._createKernel();
	}

	get fftSize() { return this._fftSize }

	/**
	 * ComplexAnalyserNode compute all values so return just fftSize
	 */
	get frequencyBinCount() { return this._fftSize }

	set smoothingTimeConstant(value) {
		this._smoothingTimeConstant = value;
		if (this.kernel) {
			this.kernel.set_smoothing_time_constant(value);
		}
	}

	get smoothingTimeConstant() {
		return this._smoothingTimeConstant;
	}

	/**
	 * Note: AnalyserNode does not have this property
	 */
	set windowFunction(func) {
		this._windowFunction = func;
		this._createWindow();
	}

	get windowFunction() {
		return this._windowFunction;
	}

	constructor(context, opts) {
		if (!opts) opts = {};

		super(context, 'complex-analyser-processor', {
			numberOfInputs: 1,
			numberOfOutputs: 1,
			channelCount: 2,
			channelCountMode: "explicit",
			channelInterpretation: "discrete",
			outputChannelCount: [2]
		});
		this.maxDecibels = typeof opts.maxDecibels !== 'undefined' ? opts.maxDecibels : -30;
		this.minDecibels = typeof opts.minDecibels !== 'undefined' ? opts.minDecibels : -100;
		this.smoothingTimeConstant = typeof opts.smoothingTimeConstant !== 'undefined' ? opts.smoothingTimeConstant : 0.8;
		this.windowFunction = opts.windowFunction || function (x) {
			// blackman window
			const alpha = 0.16;
			const a0 = (1.0 - alpha) / 2.0;
			const a1 = 1.0 / 2.0;
			const a2 = alpha / 2.0;
			return  a0 - a1 * Math.cos(2 * Math.PI * x) + a2 * Math.cos(4 * Math.PI * x);
		};
		this.fftSize = opts.fftSize || 2048; /* 32 - 32768 */
		this.initialized = false;

		this.port.onmessage = (e) => {
			const buffers = e.data.buffers;
			for (var i = 0, len = buffers.length; i < len; i++) {
				const buffer = buffers[i];
				this.buffer.copyWithin(0, buffer.length);
				this.buffer.set(buffer, this.buffer.length - buffer.length);
			}
		};

		this.timer = setInterval( () => {
			this.port.postMessage({});
		}, 24);
	}

	async init() {
		const base = import.meta.url.replace(/[^/]+$/, '');
		const wasm = base + "./web/wa_dsp_bg.wasm";

		console.log('compiling wasm module', wasm);
		const module = await WebAssembly.compile(await (await fetch(wasm)).arrayBuffer())
		console.log('load wasm bridge', module);
		this.lib = await import(base + "./web/wa_dsp.js");
		console.log('initialize wasm module', this.lib);
		await this.lib.default(module);
		console.log('initialized module');

		// this.lib = await import("./browser/wa_dsp.js");

		this.initialized = true;
		this._createKernel();
	}

	_createKernel() {
		if (!this.initialized) return;

		if (this.kernel) {
			if (this.kernel.get_n() === this.fftSize) {
				// nothing to do
				return;
			} else {
				this.kernel.free();
			}
		}

		this.kernel = new this.lib.ComplexAnalyserKernel(this.fftSize, this.smoothingTimeConstant);
		console.log('New Kernel instanciated', this.kernel, this.fftSize);
	}

	_createWindow() {
		const { window } = this;

		const func = this.windowFunction;
		const N = this.fftSize;

		for (var n = 0; n < N; n++) {
			window[n] = func(n / N);
		}
	}

	getFloatFrequencyData(result) {
		if (!this.kernel) {
			throw "call init() before getFloatFrequencyData";
		}
		const { window, buffer } = this;

		const input = new Float32Array(buffer);

		this.kernel.calculate_frequency_data(input, result, window);
	}

	getByteFrequencyData(result) {
		const N = this.fftSize;
		const { maxDecibels, minDecibels } = this;

		this.getFloatFrequencyData(result);

		for (var i = 0; i < N; i++) {
			const dB = result[i];
			let byte = Math.round( (dB - minDecibels) * (255 / ( maxDecibels - minDecibels )) );
			if (byte < 0) byte = 0;
			if (byte > 255) byte = 255;
			result[i] = byte;
		}
	}

	getFloatTimeDomainData(result, ch) {
		if (!ch) ch = 0;
		for (var i = 0, len = this.fftSize; i < len; i++) {
			result[i] = this.buffer[i*2+ch];
		}
	}

	getByteTimeDomainData(result, ch) {
		const buffer = new Float32Array(this.fftSize);
		this.getFloatTimeDomainData(buffer, ch);
		for (var i = 0, len = this.fftSize; i < len; i++) {
			const byte = Math.round((1 + buffer[i]) * 128);
			if (byte < 0) byte = 0;
			if (byte > 255) byte = 255;
			result[i] = byte;
		}
	}

	free() {
		if (this.kernel) {
			this.kernel.free();
		}
		clearInterval(this.timer);
	}

	static addModule(context) {
		const processor = (() => {
			// AudioWorkletGlobalScope
			class ComplexAnalyserProcessor extends AudioWorkletProcessor {
				constructor() {
					super();

					this.buffers = [];
					this.info = {};
					this.port.onmessage = (_e) => {
						this.port.postMessage({
							info: this.info,
							buffers: this.buffers
						});
						this.buffers.length = 0;
					};
				}

				process(inputs, outputs, _parameters) {
					const input  = inputs[0];
					const output = outputs[0];
					const length = input[0].length;
					const buffer = new Float32Array(length * 2);


					for (var i = 0; i < length; i++) {
						buffer[i*2+0] = input[0][i];
						buffer[i*2+1] = input[1][i];

						input[0][i] = output[0][i];
						input[1][i] = output[1][i];
					}

					this.info = { inputCount: input.length, channelCount: input[0].length, channelLength: input[0][0].length };
					this.buffers.push(buffer);
					return true;
				}
			}

			registerProcessor('complex-analyser-processor', ComplexAnalyserProcessor);
		}).toString();

		const url = URL.createObjectURL(new Blob(['(', processor, ')()'], { type: 'application/javascript' }));
		return context.audioWorklet.addModule(url);
	}
}

