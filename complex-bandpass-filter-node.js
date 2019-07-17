
export class ComplexBandpassFilterNode extends AudioWorkletNode {
	set coeffs(val) {
		this.port.postMessage({
			id: 0,
			method: 'setCoeffs',
			params: { coeffs: val }
		});
	}

	constructor(context, opts) {
		super(context, 'complex-bandpass-filter-processor', {
			numberOfInputs: 1,
			numberOfOutputs: 1,
			channelCount: 2,
			channelCountMode: "explicit",
			channelInterpretation: "discrete",
			outputChannelCount: [2],
			processorOptions: {
				coeffs: opts.coeffs
			}
		});
	}

	static addModule(context) {
		const processor = (() => {
			// AudioWorkletGlobalScope
			class ComplexBandpassFilterProcessor extends AudioWorkletProcessor {
				constructor(opts) {
					super();
					this.call_setCoeffs({
						coeffs: opts.processorOptions.coeffs,
					});

					this.port.onmessage = async (e) => {
						const { method, params, id }  = e.data;
						const f = this['call_' + method];
						if (f) {
							const result = await f.call(this, params);
							this.port.postMessage({ id, result });
						} else {
							throw `no such method ${method}`
						}
					};
				}

				call_setCoeffs(params) {
					const coeffs = params.coeffs;
					if (!coeffs) throw "coeffs must be not null";
					this.coeffs = coeffs;
					this.ntaps = Math.floor(this.coeffs.length / 2);
					this.hist = new Float32Array(this.coeffs.length);
				}

				process(inputs, outputs, _parameters) {
					const input  = inputs[0];
					const output = outputs[0];
					const length = input[0].length;

					for (var i = 0; i < length; i++) {
						const re = input[0][i];
						const im = input[1][i];

						const [yRe, yIm] = this.doStep(re, im);

						output[0][i] = yRe;
						output[1][i] = yIm;
					}

					return true;
				}

				doStep(re, im) {
					const { coeffs, hist, ntaps } = this;
					hist.copyWithin(2, 0);
					hist[0] = re;
					hist[1] = im;

					let yRe = 0, yIm = 0;
					for (var i = 0; i < ntaps; i++) {
						const [a, b] = [hist[i*2+0], hist[i*2+1]];
						const [c, d] = [coeffs[i*2+0], coeffs[i*2+1]];
						yRe += (a * c - b * d);
						yIm += (b * c + a * d);
					}

					return [yRe, yIm];
				}
			}

			registerProcessor('complex-bandpass-filter-processor', ComplexBandpassFilterProcessor);
		}).toString();

		const url = URL.createObjectURL(new Blob(['(', processor, ')()'], { type: 'application/javascript' }));
		return context.audioWorklet.addModule(url);
	}

	static calculateCoeffs(ntaps, samplingFreq, lFreq, hFreq, windowFunction) {
		function lowpassPrototype (ntaps, samplingFreq, cutoffFreq, windowFunction) {
			const coeffs = new Float32Array(ntaps);
			const window = new Float32Array(ntaps);
			for (let n = 0; n < ntaps; n++) {
				window[n] = windowFunction(n / ntaps);
			}


			const half = (ntaps - 1) / 2;
			const omega = 2 * Math.PI * cutoffFreq / samplingFreq;
			for (let n = -half; n < half; n++) {
				const i = half + n;
				if (n === 0) {
					coeffs[i] = omega / Math.PI * window[i];
				}
				else {
					coeffs[i] = Math.sin(omega * n) / (n * Math.PI) * window[i];
				}
			}
			return coeffs;
		}

		const bandWidth = hFreq - lFreq;

		const proto = lowpassPrototype(
			ntaps,
			samplingFreq,
			bandWidth / 2,
			windowFunction
		);

		const centerFreq = (lFreq + bandWidth / 2) / samplingFreq;
		console.log({centerFreq, bandWidth, lFreq, hFreq});

		// complex
		const coeffs = new Float32Array(ntaps * 2);

		// shift 0Hz to centerFreq
		for (let n = 0; n < ntaps; n++) {
			const theta = 2 * Math.PI * centerFreq * n;
			coeffs[n*2+0] = proto[n] * Math.cos(theta);
			coeffs[n*2+1] = proto[n] * Math.sin(theta);
		}

		return coeffs;
	}
}
