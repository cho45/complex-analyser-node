
export class FrequencyConverterNode extends AudioWorkletNode {
	get loFrequency() {
		return this.parameters.get('loFrequency');
	}

	constructor(context, _opts) {
		super(context, 'frequency-converter-processor', {
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
				static get parameterDescriptors() {
					return [
						{
							name: 'loFrequency',
							defaultValue: 0,
						}
					];
				}

				constructor() {
					super();
					this.phase = 0;
				}

				process(inputs, outputs, parameters) {
					const input  = inputs[0];
					const output = outputs[0];
					const length = input[0].length;

					let phase = this.phase;

					const omega = 2 * Math.PI * (parameters.loFrequency[0] / sampleRate);

					for (var i = 0; i < length; i++) {
						const a = input[0][i], b = input[1][i];
						const c = Math.cos(phase * omega), d = Math.sin(phase * omega);
						output[0][i] = a * c - b * d;
						output[1][i] = b * c + a * d;
						phase++;
					}

					this.phase = phase;

					return true;
				}
			}

			registerProcessor('frequency-converter-processor', AutoGainControlProcessor);
		}).toString();

		const url = URL.createObjectURL(new Blob(['(', processor, ')()'], { type: 'application/javascript' }));
		return context.audioWorklet.addModule(url);
	}
}
