const path = require('path');
module.exports = [
	{
		entry: "./index.js",
		output: {
			path: path.resolve(__dirname, "dist"),
			filename: "index.js",
		},
		mode: "development"
	},
	/*
	{
		target: "node",
		entry: "../sketch.js",
		output: {
			path: path.resolve(__dirname, ".."),
			filename: "_sketch.js",
		},
		mode: "development"
	}
	*/
];

