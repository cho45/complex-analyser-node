
let wasm;

let cachegetFloat32Memory = null;
function getFloat32Memory() {
    if (cachegetFloat32Memory === null || cachegetFloat32Memory.buffer !== wasm.memory.buffer) {
        cachegetFloat32Memory = new Float32Array(wasm.memory.buffer);
    }
    return cachegetFloat32Memory;
}

let WASM_VECTOR_LEN = 0;

function passArrayF32ToWasm(arg) {
    const ptr = wasm.__wbindgen_malloc(arg.length * 4);
    getFloat32Memory().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

let cachedTextDecoder = new TextDecoder('utf-8');

let cachegetUint8Memory = null;
function getUint8Memory() {
    if (cachegetUint8Memory === null || cachegetUint8Memory.buffer !== wasm.memory.buffer) {
        cachegetUint8Memory = new Uint8Array(wasm.memory.buffer);
    }
    return cachegetUint8Memory;
}

function getStringFromWasm(ptr, len) {
    return cachedTextDecoder.decode(getUint8Memory().subarray(ptr, ptr + len));
}
/**
*/
export class ComplexAnalyserKernel {

    free() {
        const ptr = this.ptr;
        this.ptr = 0;

        wasm.__wbg_complexanalyserkernel_free(ptr);
    }
    /**
    * @param {number} n
    * @param {number} smoothing_time_constant
    * @returns {}
    */
    constructor(n, smoothing_time_constant) {
        this.ptr = wasm.complexanalyserkernel_new(n, smoothing_time_constant);
    }
    /**
    * @returns {number}
    */
    get_n() {
        return wasm.complexanalyserkernel_get_n(this.ptr) >>> 0;
    }
    /**
    * @param {number} val
    * @returns {void}
    */
    set_smoothing_time_constant(val) {
        return wasm.complexanalyserkernel_set_smoothing_time_constant(this.ptr, val);
    }
    /**
    * @param {Float32Array} input_
    * @param {Float32Array} result
    * @param {Float32Array} window
    * @returns {void}
    */
    calculate_frequency_data(input_, result, window) {
        const ptr0 = passArrayF32ToWasm(input_);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArrayF32ToWasm(result);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passArrayF32ToWasm(window);
        const len2 = WASM_VECTOR_LEN;
        try {
            return wasm.complexanalyserkernel_calculate_frequency_data(this.ptr, ptr0, len0, ptr1, len1, ptr2, len2);

        } finally {
            input_.set(getFloat32Memory().subarray(ptr0 / 4, ptr0 / 4 + len0));
            wasm.__wbindgen_free(ptr0, len0 * 4);
            result.set(getFloat32Memory().subarray(ptr1 / 4, ptr1 / 4 + len1));
            wasm.__wbindgen_free(ptr1, len1 * 4);
            wasm.__wbindgen_free(ptr2, len2 * 4);

        }

    }
}

function init(module) {
    if (typeof module === 'undefined') {
        module = import.meta.url.replace(/\.js$/, '_bg.wasm');
    }
    let result;
    const imports = {};
    imports.wbg = {};
    imports.wbg.__wbindgen_throw = function(arg0, arg1) {
        let varg0 = getStringFromWasm(arg0, arg1);
        throw new Error(varg0);
    };

    if (module instanceof URL || typeof module === 'string' || module instanceof Request) {

        const response = fetch(module);
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            result = WebAssembly.instantiateStreaming(response, imports)
            .catch(e => {
                console.warn("`WebAssembly.instantiateStreaming` failed. Assuming this is because your server does not serve wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);
                return response
                .then(r => r.arrayBuffer())
                .then(bytes => WebAssembly.instantiate(bytes, imports));
            });
        } else {
            result = response
            .then(r => r.arrayBuffer())
            .then(bytes => WebAssembly.instantiate(bytes, imports));
        }
    } else {

        result = WebAssembly.instantiate(module, imports)
        .then(result => {
            if (result instanceof WebAssembly.Instance) {
                return { instance: result, module };
            } else {
                return result;
            }
        });
    }
    return result.then(({instance, module}) => {
        wasm = instance.exports;
        init.__wbindgen_wasm_module = module;

        return wasm;
    });
}

export default init;

