

export class AutoGainControlNode extends AudioWorkletNode {
	constructor(context, _opts) {
		super(context, 'auto-gain-control-processor', {
			numberOfInputs: 1,
			numberOfOutputs: 1,
			channelCount: 2,
			channelCountMode: "explicit",
			channelInterpretation: "discrete",
			outputChannelCount: [2]
		});
	}

	static addModule(context) {
		const processor = (() => {
			// AudioWorkletGlobalScope
			class AutoGainControlProcessor extends AudioWorkletProcessor {
				constructor() {
					super();
					this.gain = 1.0;

					this.rate = 1e-2;
					this.target = Math.pow(10, -30/20);
				}

				process(inputs, outputs, _parameters) {
					const input  = inputs[0];
					const output = outputs[0];
					const length = input[0].length;

					let gain = this.gain;
					const { rate, target } = this;

					for (var i = 0; i < length; i++) {
						const re = input[0][i] * gain;
						const im = input[1][i] * gain;

						gain += rate * (target - Math.hypot(re, im));

						output[0][i] = re;
						output[1][i] = im;
					}

					this.gain = gain;

					return true;
				}
			}

			registerProcessor('auto-gain-control-processor', AutoGainControlProcessor);
		}).toString();

		const url = URL.createObjectURL(new Blob(['(', processor, ')()'], { type: 'application/javascript' }));
		return context.audioWorklet.addModule(url);
	}
}
