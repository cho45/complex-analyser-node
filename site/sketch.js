//#!/usr/bin/env node

"use strict";

const buffers = [
	new Float32Array([1, 2, 3]),
	new Float32Array([4, 5, 6]),
	new Float32Array([7, 8, 9])
];

const out = new Float32Array(5);

for (var i = 0, len = buffers.length; i < len; i++) {
	const buffer = buffers[i];
	out.copyWithin(0, buffer.length);
	out.set(buffer, out.length - buffer.length);
}

console.log(out);
