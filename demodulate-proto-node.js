
export class DemodulateProtoNode extends AudioWorkletNode {
	constructor(context, _opts) {
		super(context, 'demodulate-proto-processor', {
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
			class DemodulateProtoProcessor extends AudioWorkletProcessor {
				constructor() {
					super();
				}

				process(inputs, outputs, _parameters) {
					const input  = inputs[0];
					const output = outputs[0];
					const length = input[0].length;

					for (var i = 0; i < length; i++) {
						const re = input[0][i];
						const im = input[1][i];


						output[0][i] = re;
						output[1][i] = re;
					}

					return true;
				}
			}

			registerProcessor('demodulate-proto-processor', DemodulateProtoProcessor);
		}).toString();

		const url = URL.createObjectURL(new Blob(['(', processor, ')()'], { type: 'application/javascript' }));
		return context.audioWorklet.addModule(url);
	}
}
