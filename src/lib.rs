
extern crate wasm_bindgen;

//extern crate wee_alloc;
//// Use `wee_alloc` as the global allocator.
//#[global_allocator]
//static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

//use std::sync::Arc;
use rustfft::FFTplanner;
use rustfft::num_complex::Complex;
//use rustfft::num_traits::Zero;
//use std::mem;
use std::slice;
use std::f32;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[allow(unused_macros)]
macro_rules! console_log {
    // Note that this is using the `log` function imported above during
    // `bare_bones`
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

#[wasm_bindgen]
pub struct ComplexAnalyserKernel {
    n: usize,
    smoothing_time_constant: f32,
    fft: std::sync::Arc<dyn rustfft::FFT<f32>>,
    prev: Box<[f32]>,
}

#[wasm_bindgen]
impl ComplexAnalyserKernel {
    #[allow(clippy::new_without_default)]
    #[wasm_bindgen(constructor)]
    pub fn new(n: usize, smoothing_time_constant: f32) -> Self {
        let fft = FFTplanner::new(false).plan_fft(n);
        let prev = vec![0.0; n].into_boxed_slice();
        Self {
            n,
            smoothing_time_constant,
            fft,
            prev
        }
    }

    pub fn get_n(&self) -> usize {
        self.n
    }

    pub fn set_smoothing_time_constant(&mut self, val: f32) {
        self.smoothing_time_constant = val;
    }


    pub fn calculate_frequency_data(&mut self, input_: &mut [f32], result: &mut [f32], window: &[f32]) {
        let input:  &mut [Complex<f32>] = unsafe { slice::from_raw_parts_mut(input_  as *mut [f32] as *mut Complex<f32>, self.n )};
        let mut output = Vec::<Complex<f32>>::with_capacity(self.n);
        unsafe { output.set_len(self.n); }

        for i in 0..self.n {
            input[i] *= window[i];
        }

        self.fft.process(input, &mut output);

        let half_n = self.n / 2;
        for i in 0..half_n {
            result[i+half_n] = output[i].norm() / (self.n as f32);
        }
        for i in half_n..self.n {
            result[i-half_n] = output[i].norm() / (self.n as f32);
        }

        for i in 0..self.n {
            let x_p = self.prev[i];
            let x_k = result[i];
            result[i] = self.smoothing_time_constant * x_p + (1.0 - self.smoothing_time_constant) * x_k;
        }

        self.prev.copy_from_slice(result);

        for i in 0..self.n {
            result[i] = result[i].log10() * 20.0;
        }
    }

}
