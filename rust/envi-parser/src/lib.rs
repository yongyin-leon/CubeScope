// src/lib.rs

mod error;
mod header;
mod parser;
mod spectral;

use crate::header::{ByteOrder, DataType, EnviHeader, Interleave};
use js_sys::{Float32Array, Object, Reflect};
use std::collections::HashMap;
use wasm_bindgen::prelude::*;
static mut ENABLE_LOG: bool = false;

#[macro_export]
macro_rules! log {
    ( $( $t:tt )* ) => {
        unsafe {
            if crate::ENABLE_LOG {
                web_sys::console::log_1(&format!( $( $t )* ).into());
            }
        }
    }
}
#[wasm_bindgen(start)]
pub fn start() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}
#[wasm_bindgen]
pub fn set_logging_enabled(enabled: bool) {
    unsafe {
        ENABLE_LOG = enabled;
    }
}
#[wasm_bindgen]
pub struct EnviReader {
    header: EnviHeader,
}

fn parse_js_offset(value: f64, field: &str) -> Result<u64, JsValue> {
    if !value.is_finite() || value < 0.0 || value.fract() != 0.0 || value > (u64::MAX as f64) {
        return Err(JsValue::from_str(&format!(
            "{} must be a non-negative integer byte offset.",
            field
        )));
    }

    Ok(value as u64)
}

fn checked_chunk_range(
    absolute_start: u64,
    byte_len: u64,
    chunk_start_offset: u64,
    chunk_len: usize,
    label: &str,
) -> Result<std::ops::Range<usize>, JsValue> {
    let start = absolute_start
        .checked_sub(chunk_start_offset)
        .ok_or_else(|| {
            JsValue::from_str(&format!("{} starts before the provided chunk.", label))
        })?;
    let end = start
        .checked_add(byte_len)
        .ok_or_else(|| JsValue::from_str(&format!("{} byte range overflowed.", label)))?;

    if end > chunk_len as u64 {
        return Err(JsValue::from_str(&format!(
            "{} range [{}..{}] exceeds chunk data length {}",
            label, start, end, chunk_len
        )));
    }

    Ok(start as usize..end as usize)
}
#[wasm_bindgen(getter_with_clone)]
pub struct ExtractedBand {
    /// 波段号 (从 1 开始，与 ENVI 头文件一致)
    #[wasm_bindgen(js_name = band)]
    pub band_number: u32, // u32 实现了 Copy，所以没问题

    /// 该波段的像素数据
    #[wasm_bindgen(js_name = data)]
    pub pixel_data: Float32Array, // Float32Array 没有实现 Copy，这是问题的根源
}
#[wasm_bindgen]
impl EnviReader {
    #[wasm_bindgen(constructor)]
    pub fn new(header_content: &[u8]) -> Result<EnviReader, JsValue> {
        log!("WASM: EnviReader::new() - 開始解析ENVI頭文件...");

        let content =
            std::str::from_utf8(header_content).map_err(|e| JsValue::from_str(&e.to_string()))?;

        let header =
            parser::parse_header_str(content).map_err(|e| JsValue::from_str(&e.to_string()))?;

        log!("WASM: 頭文件解析成功!");
        Ok(EnviReader { header })
    }

    // --- Getters ---
    #[wasm_bindgen(getter)]
    pub fn samples(&self) -> u32 {
        self.header.samples
    }
    #[wasm_bindgen(getter)]
    pub fn lines(&self) -> u32 {
        self.header.lines
    }
    #[wasm_bindgen(getter)]
    pub fn bands(&self) -> u32 {
        self.header.bands
    }
    #[wasm_bindgen(getter)]
    pub fn header_offset(&self) -> usize {
        self.header.header_offset
    }
    #[wasm_bindgen(getter, js_name = bytesPerPixel)]
    pub fn bytes_per_pixel(&self) -> usize {
        self.header.bytes_per_pixel
    }
    #[wasm_bindgen(getter)]
    pub fn interleave(&self) -> Interleave {
        self.header.interleave
    }

    // --- JS Object Conversion ---
    #[wasm_bindgen(js_name = getHeaderAsJsObject)]
    pub fn get_header_as_js_object(&self) -> Result<JsValue, JsValue> {
        self.header.to_js()
    }
    // ====================== [ 光谱曲线提取函数 ] ======================

    /// 提取并返回指定坐标点的高光谱曲线
    ///
    /// @param {Uint8Array} chunk_data - 包含目标像素的二进制数据块。
    ///     为了保证成功提取，这个数据块理论上需要包含整个文件的数据，
    ///     或者至少是经过精心计算的、包含所有波段在该像素位置数据的最小数据范围。
    /// @param {number} chunk_start_offset_in_file - 该数据块在完整ENVI文件中的起始偏移量。
    ///     如果 chunk_data 是完整文件，则此值为 0。
    /// @param {number} x - 目标像素的X坐标 (从0开始)。
    /// @param {number} y - 目标像素的Y坐标 (从0开始)。
    /// @returns {Float32Array} - 一个包含所有波段值的数组，顺序与头文件一致。
    #[wasm_bindgen(js_name = getSpectralProfile)]
    pub fn get_spectral_profile(
        &self,
        chunk_data: &[u8],
        chunk_start_offset_in_file: f64,
        x: u32,
        y: u32,
    ) -> Result<Float32Array, JsValue> {
        let chunk_start_offset =
            parse_js_offset(chunk_start_offset_in_file, "chunk_start_offset_in_file")?;
        log!(
            "RUST[getSpectralProfile]: coord=({}, {}), chunk_len={}, chunk_start={}",
            x,
            y,
            chunk_data.len(),
            chunk_start_offset
        );

        let profile_vec = spectral::extract_spectral_profile(
            self, // 传入 &self，让 spectral 模块可以调用 bytes_to_f32
            chunk_data,
            chunk_start_offset,
            x,
            y,
        )
        .map_err(|e| JsValue::from_str(&e.to_string()))?;

        Ok(Float32Array::from(profile_vec.as_slice()))
    }
    /// [新增] 提取并返回指定坐标点的高光谱曲线，并附带波长信息
    ///
    /// @param {Uint8Array} chunk_data - 包含目标像素的二进制数据块。
    /// @param {number} chunk_start_offset_in_file - 数据块在文件中的起始偏移。
    /// @param {number} x - 目标像素的X坐标 (从0开始)。
    /// @param {number} y - 目标像素的Y坐标 (从0开始)。
    /// @returns {Array<SpectralPoint>} - 一个对象数组，每个对象包含 { wavelength, value }。
    ///     如果没有波长信息，wavelength 字段将使用波段号 (从1开始) 代替。
    #[wasm_bindgen(js_name = getSpectralProfileWithWavelengths)]
    pub fn get_spectral_profile_with_wavelengths(
        &self,
        chunk_data: &[u8],
        chunk_start_offset_in_file: f64,
        x: u32,
        y: u32,
    ) -> Result<JsValue, JsValue> {
        let chunk_start_offset =
            parse_js_offset(chunk_start_offset_in_file, "chunk_start_offset_in_file")?;
        // 1. 调用已有的核心函数获取原始光谱数据
        let profile_vec =
            spectral::extract_spectral_profile(self, chunk_data, chunk_start_offset, x, y)
                .map_err(|e| JsValue::from_str(&e.to_string()))?;

        // 2. 调用新的配对函数，将数据与波长组合
        let spectral_points = spectral::pair_with_wavelengths(&self.header, profile_vec);

        // 3. 将 Rust 结构体Vec转换为 JS 数组
        Ok(serde_wasm_bindgen::to_value(&spectral_points)?)
    }
    // --- Data Extraction Methods (Legacy) ---
    #[wasm_bindgen(js_name = extractRawFromBsqChunk)]
    pub fn extract_raw_from_bsq_chunk(&self, chunk_data: &[u8]) -> Result<Float32Array, JsValue> {
        // ... (保持不变)
        let bpp = self.header.bytes_per_pixel;
        if bpp == 0 || chunk_data.len() % bpp != 0 {
            return Err(JsValue::from_str("Invalid chunk size for BSQ data."));
        }
        let num_pixels = chunk_data.len() / bpp;
        let mut out = Vec::<f32>::with_capacity(num_pixels);
        for i in 0..num_pixels {
            let pixel_bytes = &chunk_data[i * bpp..(i + 1) * bpp];
            out.push(self.bytes_to_f32(pixel_bytes)?);
        }
        Ok(Float32Array::from(out.as_slice()))
    }

    #[wasm_bindgen(js_name = extractRawRgbFromBipChunk)]
    pub fn extract_raw_rgb_from_bip_chunk(
        &self,
        chunk_data: &[u8],
        r_idx: usize,
        g_idx: usize,
        b_idx: usize,
    ) -> Result<Object, JsValue> {
        // ... (保持不变)
        let bpp = self.header.bytes_per_pixel;
        let bands = self.header.bands as usize;
        let bytes_per_full_pixel = bpp * bands;
        if bytes_per_full_pixel == 0 || chunk_data.len() % bytes_per_full_pixel != 0 {
            return Err(JsValue::from_str(&format!(
                "Invalid chunk size {} for BIP data. bpf={}",
                chunk_data.len(),
                bytes_per_full_pixel
            )));
        }
        let num_pixels = chunk_data.len() / bytes_per_full_pixel;
        let mut r_out = Vec::with_capacity(num_pixels);
        let mut g_out = Vec::with_capacity(num_pixels);
        let mut b_out = Vec::with_capacity(num_pixels);
        for i in 0..num_pixels {
            let pixel_start = i * bytes_per_full_pixel;
            r_out.push(self.bytes_to_f32(
                &chunk_data[pixel_start + r_idx * bpp..pixel_start + (r_idx + 1) * bpp],
            )?);
            g_out.push(self.bytes_to_f32(
                &chunk_data[pixel_start + g_idx * bpp..pixel_start + (g_idx + 1) * bpp],
            )?);
            b_out.push(self.bytes_to_f32(
                &chunk_data[pixel_start + b_idx * bpp..pixel_start + (b_idx + 1) * bpp],
            )?);
        }
        self.create_rgb_js_object(r_out, g_out, b_out)
    }

    #[wasm_bindgen(js_name = extractRawRgbFromBilChunk)]
    pub fn extract_raw_rgb_from_bil_chunk(
        &self,
        chunk_data: &[u8],
        r_idx: usize,
        g_idx: usize,
        b_idx: usize,
    ) -> Result<Object, JsValue> {
        // ... (保持不变)
        let bpp = self.header.bytes_per_pixel;
        let samples = self.header.samples as usize;
        let bands = self.header.bands as usize;
        let bytes_per_line_one_band = bpp * samples;
        let bytes_per_full_line = bytes_per_line_one_band * bands;
        if bytes_per_full_line == 0 || chunk_data.len() % bytes_per_full_line != 0 {
            return Err(JsValue::from_str(
                "Invalid chunk size for BIL data. Must be full lines.",
            ));
        }
        let num_lines = chunk_data.len() / bytes_per_full_line;
        let num_pixels = num_lines * samples;
        let mut r_out = Vec::with_capacity(num_pixels);
        let mut g_out = Vec::with_capacity(num_pixels);
        let mut b_out = Vec::with_capacity(num_pixels);
        for line_idx in 0..num_lines {
            let current_line_start = line_idx * bytes_per_full_line;
            let r_band_start_in_line = current_line_start + r_idx * bytes_per_line_one_band;
            let g_band_start_in_line = current_line_start + g_idx * bytes_per_line_one_band;
            let b_band_start_in_line = current_line_start + b_idx * bytes_per_line_one_band;
            for sample_idx in 0..samples {
                let pixel_offset = sample_idx * bpp;
                r_out.push(self.bytes_to_f32(
                    &chunk_data[r_band_start_in_line + pixel_offset
                        ..r_band_start_in_line + pixel_offset + bpp],
                )?);
                g_out.push(self.bytes_to_f32(
                    &chunk_data[g_band_start_in_line + pixel_offset
                        ..g_band_start_in_line + pixel_offset + bpp],
                )?);
                b_out.push(self.bytes_to_f32(
                    &chunk_data[b_band_start_in_line + pixel_offset
                        ..b_band_start_in_line + pixel_offset + bpp],
                )?);
            }
        }
        self.create_rgb_js_object(r_out, g_out, b_out)
    }

    pub(crate) fn bytes_to_f32(&self, bytes: &[u8]) -> Result<f32, JsValue> {
        // ... (保持不变)
        let is_le = self.header.byte_order == ByteOrder::Lsb;
        macro_rules! from_bytes {
            ($T:ty, $f_le:ident, $f_be:ident) => {{
                let b: [u8; std::mem::size_of::<$T>()] = bytes
                    .try_into()
                    .map_err(|_| JsValue::from_str("Slice to array failed"))?;
                if is_le {
                    <$T>::$f_le(b) as f32
                } else {
                    <$T>::$f_be(b) as f32
                }
            }};
        }
        Ok(match self.header.data_type {
            DataType::U8 => bytes[0] as f32,
            DataType::I16 => from_bytes!(i16, from_le_bytes, from_be_bytes),
            DataType::U16 => from_bytes!(u16, from_le_bytes, from_be_bytes),
            DataType::I32 => from_bytes!(i32, from_le_bytes, from_be_bytes),
            DataType::U32 => from_bytes!(u32, from_le_bytes, from_be_bytes),
            DataType::F32 => {
                let b: [u8; 4] = bytes
                    .try_into()
                    .map_err(|_| JsValue::from_str("Slice to [u8; 4] failed for F32"))?;
                if is_le {
                    f32::from_le_bytes(b)
                } else {
                    f32::from_be_bytes(b)
                }
            }
            DataType::I64 => from_bytes!(i64, from_le_bytes, from_be_bytes),
            DataType::U64 => from_bytes!(u64, from_le_bytes, from_be_bytes),
            DataType::F64 => from_bytes!(f64, from_le_bytes, from_be_bytes),
            _ => {
                return Err(JsValue::from_str(
                    "Complex data types are not supported for raw extraction.",
                ))
            }
        })
    }

    fn create_rgb_js_object(
        &self,
        r: Vec<f32>,
        g: Vec<f32>,
        b: Vec<f32>,
    ) -> Result<Object, JsValue> {
        // ... (保持不变)
        let obj = Object::new();
        Reflect::set(&obj, &"r".into(), &Float32Array::from(r.as_slice()))?;
        Reflect::set(&obj, &"g".into(), &Float32Array::from(g.as_slice()))?;
        Reflect::set(&obj, &"b".into(), &Float32Array::from(b.as_slice()))?;
        Ok(obj)
    }

    #[wasm_bindgen(js_name = extractRawBandFromBipChunk)]
    pub fn extract_raw_band_from_bip_chunk(
        &self,
        chunk_data: &[u8],
        band_idx: usize,
    ) -> Result<Float32Array, JsValue> {
        // ... (保持不变)
        let bpp = self.header.bytes_per_pixel;
        let bands = self.header.bands as usize;
        let bytes_per_full_pixel = bpp * bands;
        if bytes_per_full_pixel == 0 || chunk_data.len() % bytes_per_full_pixel != 0 {
            return Err(JsValue::from_str("Invalid chunk size for BIP data."));
        }
        let num_pixels = chunk_data.len() / bytes_per_full_pixel;
        let mut out = Vec::with_capacity(num_pixels);
        for i in 0..num_pixels {
            let pixel_start = i * bytes_per_full_pixel;
            let band_start = pixel_start + band_idx * bpp;
            out.push(self.bytes_to_f32(&chunk_data[band_start..band_start + bpp])?);
        }
        Ok(Float32Array::from(out.as_slice()))
    }

    #[wasm_bindgen(js_name = extractRawBandFromBilChunk)]
    pub fn extract_raw_band_from_bil_chunk(
        &self,
        chunk_data: &[u8],
        band_idx: usize,
    ) -> Result<Float32Array, JsValue> {
        // ... (保持不变)
        let bpp = self.header.bytes_per_pixel;
        let samples = self.header.samples as usize;
        let bands = self.header.bands as usize;
        let bytes_per_line_one_band = bpp * samples;
        let bytes_per_full_line = bytes_per_line_one_band * bands;
        if bytes_per_full_line == 0 || chunk_data.len() % bytes_per_full_line != 0 {
            return Err(JsValue::from_str("Invalid chunk size for BIL data."));
        }
        let num_lines = chunk_data.len() / bytes_per_full_line;
        let num_pixels = num_lines * samples;
        let mut out = Vec::with_capacity(num_pixels);
        for line_idx in 0..num_lines {
            let current_line_start = line_idx * bytes_per_full_line;
            let band_start_in_line = current_line_start + band_idx * bytes_per_line_one_band;
            for sample_idx in 0..samples {
                let pixel_offset = sample_idx * bpp;
                let start = band_start_in_line + pixel_offset;
                out.push(self.bytes_to_f32(&chunk_data[start..start + bpp])?);
            }
        }
        Ok(Float32Array::from(out.as_slice()))
    }

    // ====================== [ 瓦片读取函数区域 ] ======================

    #[wasm_bindgen(js_name = extractBilTileRaw)]
    pub fn extract_bil_tile_raw(
        &self,
        chunk_data: &[u8],
        chunk_start_offset_in_file: f64,
        band_index: u32,
        tile_x_index: u32,
        tile_y_index: u32,
        tile_width: u32,
        tile_height: u32,
    ) -> Result<Float32Array, JsValue> {
        // [新增] 诊断日志
        log!(
            "RUST[extractBilTileRaw]: band={}, tile=({}, {}), chunk_len={}, chunk_start={}",
            band_index,
            tile_x_index,
            tile_y_index,
            chunk_data.len(),
            chunk_start_offset_in_file
        );

        let chunk_start_offset =
            parse_js_offset(chunk_start_offset_in_file, "chunk_start_offset_in_file")?;
        let bpp = self.header.bytes_per_pixel as u64;
        let bpp_usize = self.header.bytes_per_pixel;
        let image_width = self.header.samples;
        let image_height = self.header.lines;
        let num_bands = self.header.bands;
        let header_offset = self.header.header_offset as u64;

        if band_index >= num_bands {
            return Err(JsValue::from_str("Band index out of bounds."));
        }
        let start_px_x = tile_x_index * tile_width;
        let start_px_y = tile_y_index * tile_height;
        let effective_tile_width = (start_px_x + tile_width).min(image_width) - start_px_x;
        let effective_tile_height = (start_px_y + tile_height).min(image_height) - start_px_y;
        if effective_tile_width == 0 || effective_tile_height == 0 {
            return Ok(Float32Array::new_with_length(0));
        }

        let mut tile_pixels =
            Vec::<f32>::with_capacity((effective_tile_width * effective_tile_height) as usize);
        let bytes_per_line_per_band = u64::from(image_width) * bpp;
        let bytes_per_full_line = bytes_per_line_per_band * u64::from(num_bands);

        for y_offset in 0..effective_tile_height {
            let current_line_y = start_px_y + y_offset;
            let full_line_start_offset =
                header_offset + (u64::from(current_line_y) * bytes_per_full_line);
            let target_band_in_line_start_offset =
                full_line_start_offset + (u64::from(band_index) * bytes_per_line_per_band);
            let tile_part_start_in_band_offset =
                target_band_in_line_start_offset + (u64::from(start_px_x) * bpp);
            let tile_range = checked_chunk_range(
                tile_part_start_in_band_offset,
                u64::from(effective_tile_width) * bpp,
                chunk_start_offset,
                chunk_data.len(),
                "Error (BIL)",
            )?;

            let tile_line_bytes = &chunk_data[tile_range];
            for i in 0..effective_tile_width as usize {
                let pixel_bytes = &tile_line_bytes[i * bpp_usize..(i + 1) * bpp_usize];
                tile_pixels.push(self.bytes_to_f32(pixel_bytes)?);
            }
        }
        Ok(Float32Array::from(tile_pixels.as_slice()))
    }

    #[wasm_bindgen(js_name = extractBsqTileRaw)]
    pub fn extract_bsq_tile_raw(
        &self,
        chunk_data: &[u8],
        chunk_start_offset_in_file: f64,
        band_index: u32,
        tile_x_index: u32,
        tile_y_index: u32,
        tile_width: u32,
        tile_height: u32,
    ) -> Result<Float32Array, JsValue> {
        // [新增] 诊断日志
        log!(
            "RUST[extractBsqTileRaw]: band={}, tile=({}, {}), chunk_len={}, chunk_start={}",
            band_index,
            tile_x_index,
            tile_y_index,
            chunk_data.len(),
            chunk_start_offset_in_file
        );

        let chunk_start_offset =
            parse_js_offset(chunk_start_offset_in_file, "chunk_start_offset_in_file")?;
        let bpp = self.header.bytes_per_pixel as u64;
        let bpp_usize = self.header.bytes_per_pixel;
        let image_width = self.header.samples;
        let image_height = self.header.lines;
        let header_offset = self.header.header_offset as u64;
        if band_index >= self.header.bands {
            return Err(JsValue::from_str("Band index out of bounds."));
        }

        let start_px_x = tile_x_index * tile_width;
        let start_px_y = tile_y_index * tile_height;
        let effective_tile_width = (start_px_x + tile_width).min(image_width) - start_px_x;
        let effective_tile_height = (start_px_y + tile_height).min(image_height) - start_px_y;
        if effective_tile_width == 0 || effective_tile_height == 0 {
            return Ok(Float32Array::new_with_length(0));
        }

        let mut tile_pixels =
            Vec::<f32>::with_capacity((effective_tile_width * effective_tile_height) as usize);
        let bytes_per_line = u64::from(image_width) * bpp;
        let single_band_size = bytes_per_line * u64::from(image_height);
        let band_start_absolute_offset = header_offset + (u64::from(band_index) * single_band_size);

        for y_offset in 0..effective_tile_height {
            let current_line_y = start_px_y + y_offset;
            let line_start_absolute_offset =
                band_start_absolute_offset + (u64::from(current_line_y) * bytes_per_line);
            let tile_part_start_absolute_offset =
                line_start_absolute_offset + (u64::from(start_px_x) * bpp);
            let tile_range = checked_chunk_range(
                tile_part_start_absolute_offset,
                u64::from(effective_tile_width) * bpp,
                chunk_start_offset,
                chunk_data.len(),
                "Error (BSQ)",
            )?;

            let tile_line_bytes = &chunk_data[tile_range];
            for i in 0..effective_tile_width as usize {
                let pixel_bytes = &tile_line_bytes[i * bpp_usize..(i + 1) * bpp_usize];
                tile_pixels.push(self.bytes_to_f32(pixel_bytes)?);
            }
        }
        Ok(Float32Array::from(tile_pixels.as_slice()))
    }

    #[wasm_bindgen(js_name = extractBipTileRaw)]
    pub fn extract_bip_tile_raw(
        &self,
        chunk_data: &[u8],
        chunk_start_offset_in_file: f64,
        band_index: u32,
        tile_x_index: u32,
        tile_y_index: u32,
        tile_width: u32,
        tile_height: u32,
    ) -> Result<Float32Array, JsValue> {
        // [新增] 诊断日志
        log!(
            "RUST[extractBipTileRaw]: band={}, tile=({}, {}), chunk_len={}, chunk_start={}",
            band_index,
            tile_x_index,
            tile_y_index,
            chunk_data.len(),
            chunk_start_offset_in_file
        );

        let chunk_start_offset =
            parse_js_offset(chunk_start_offset_in_file, "chunk_start_offset_in_file")?;
        let bpp = self.header.bytes_per_pixel as u64;
        let image_width = self.header.samples;
        let image_height = self.header.lines;
        let num_bands = self.header.bands;
        let header_offset = self.header.header_offset as u64;
        if band_index >= num_bands {
            return Err(JsValue::from_str("Band index out of bounds."));
        }

        let start_px_x = tile_x_index * tile_width;
        let start_px_y = tile_y_index * tile_height;
        let effective_tile_width = (start_px_x + tile_width).min(image_width) - start_px_x;
        let effective_tile_height = (start_px_y + tile_height).min(image_height) - start_px_y;
        if effective_tile_width == 0 || effective_tile_height == 0 {
            return Ok(Float32Array::new_with_length(0));
        }

        let mut tile_pixels =
            Vec::<f32>::with_capacity((effective_tile_width * effective_tile_height) as usize);
        let bytes_per_full_pixel = u64::from(num_bands) * bpp;
        let bytes_per_full_line = u64::from(image_width) * bytes_per_full_pixel;

        for y_offset in 0..effective_tile_height {
            let current_line_y = start_px_y + y_offset;
            let line_start_absolute_offset =
                header_offset + (u64::from(current_line_y) * bytes_per_full_line);
            let tile_line_start_absolute_offset =
                line_start_absolute_offset + (u64::from(start_px_x) * bytes_per_full_pixel);

            let last_pixel_x_offset = effective_tile_width.saturating_sub(1);
            let last_pixel_absolute_offset = tile_line_start_absolute_offset
                + u64::from(last_pixel_x_offset) * bytes_per_full_pixel;
            checked_chunk_range(
                last_pixel_absolute_offset + (u64::from(band_index) * bpp),
                bpp,
                chunk_start_offset,
                chunk_data.len(),
                "Error (BIP)",
            )?;

            for x_offset in 0..effective_tile_width {
                let pixel_start_absolute_offset =
                    tile_line_start_absolute_offset + (u64::from(x_offset) * bytes_per_full_pixel);
                let band_start_absolute_offset =
                    pixel_start_absolute_offset + (u64::from(band_index) * bpp);
                let pixel_range = checked_chunk_range(
                    band_start_absolute_offset,
                    bpp,
                    chunk_start_offset,
                    chunk_data.len(),
                    "Error (BIP)",
                )?;
                let pixel_bytes = &chunk_data[pixel_range];
                tile_pixels.push(self.bytes_to_f32(pixel_bytes)?);
            }
        }
        Ok(Float32Array::from(tile_pixels.as_slice()))
    }
    #[wasm_bindgen(js_name = extractBipTileForBandsRaw)]
    pub fn extract_bip_tile_for_bands_raw(
        &self,
        chunk_data: &[u8],
        chunk_start_offset_in_file: f64,
        bands_js: JsValue, // 接收 JS 数组
        tile_x_index: u32,
        tile_y_index: u32,
        tile_width: u32,
        tile_height: u32,
    ) -> Result<js_sys::Array, JsValue> {
        // --- 1. 参数解析与验证 ---

        // 将 JS 数组转换为 Rust Vec<u32>
        let requested_bands: Vec<u32> = serde_wasm_bindgen::from_value(bands_js)
            .map_err(|e| JsValue::from_str(&format!("Failed to parse bands array: {}", e)))?;

        log!(
            "RUST[extractBipTileForBandsRaw]: bands={:?}, tile=({}, {}), chunk_len={}, chunk_start={}",
            requested_bands, tile_x_index, tile_y_index, chunk_data.len(), chunk_start_offset_in_file
        );

        let chunk_start_offset =
            parse_js_offset(chunk_start_offset_in_file, "chunk_start_offset_in_file")?;
        let bpp = self.header.bytes_per_pixel as u64;
        let image_width = self.header.samples;
        let image_height = self.header.lines;
        let num_bands = self.header.bands;
        let header_offset = self.header.header_offset as u64;

        // 验证所有请求的波段号是否有效 (波段号从1开始)
        for &band_num in &requested_bands {
            if band_num == 0 || band_num > num_bands {
                return Err(JsValue::from_str(&format!(
                    "Band number {} is out of bounds (1..{}).",
                    band_num, num_bands
                )));
            }
        }

        let start_px_x = tile_x_index * tile_width;
        let start_px_y = tile_y_index * tile_height;
        let effective_tile_width = (start_px_x + tile_width).min(image_width) - start_px_x;
        let effective_tile_height = (start_px_y + tile_height).min(image_height) - start_px_y;

        if effective_tile_width == 0 || effective_tile_height == 0 {
            return Ok(js_sys::Array::new()); // 返回空数组
        }

        // --- 2. 初始化数据结构 ---

        let tile_pixel_count = (effective_tile_width * effective_tile_height) as usize;
        // 使用 HashMap 来存储每个请求波段的数据向量
        // key: 波段号 (从1开始), value: 像素数据 Vec<f32>
        let mut band_data_map: HashMap<u32, Vec<f32>> = requested_bands
            .iter()
            .map(|&band_num| (band_num, Vec::with_capacity(tile_pixel_count)))
            .collect();

        let bytes_per_full_pixel = u64::from(num_bands) * bpp;
        let bytes_per_full_line = u64::from(image_width) * bytes_per_full_pixel;

        // --- 3. 核心处理逻辑：单次遍历，提取多波段 ---

        for y_offset in 0..effective_tile_height {
            let current_line_y = start_px_y + y_offset;
            let line_start_absolute_offset =
                header_offset + (u64::from(current_line_y) * bytes_per_full_line);
            let tile_line_start_absolute_offset =
                line_start_absolute_offset + (u64::from(start_px_x) * bytes_per_full_pixel);

            // 遍历当前瓦片行中的每个像素
            for x_offset in 0..effective_tile_width {
                let pixel_start_absolute_offset =
                    tile_line_start_absolute_offset + (u64::from(x_offset) * bytes_per_full_pixel);

                // 对于每个像素，检查所有我们需要的波段
                for &band_num in &requested_bands {
                    let band_index = band_num - 1; // 转换为从0开始的索引
                    let band_start_absolute_offset =
                        pixel_start_absolute_offset + (u64::from(band_index) * bpp);
                    let band_range = checked_chunk_range(
                        band_start_absolute_offset,
                        bpp,
                        chunk_start_offset,
                        chunk_data.len(),
                        "Error (BIP Multi-Band)",
                    )?;

                    let pixel_bytes = &chunk_data[band_range];

                    // 解析像素值并存入对应的 Vec
                    let value = self.bytes_to_f32(pixel_bytes)?;
                    if let Some(data_vec) = band_data_map.get_mut(&band_num) {
                        data_vec.push(value);
                    }
                }
            }
        }

        // --- 4. 组装返回结果 ---

        let result_array = js_sys::Array::new();
        for (band_num, pixel_data_vec) in band_data_map {
            let extracted_band = ExtractedBand {
                band_number: band_num,
                pixel_data: Float32Array::from(pixel_data_vec.as_slice()),
            };
            // 将 Rust 结构体转换为 JsValue 并推入 JS 数组
            result_array.push(&JsValue::from(extracted_band));
        }

        Ok(result_array)
    }
}

#[wasm_bindgen(js_name = normalizeBandInPlace)]
pub fn normalize_band_in_place(
    data: &mut [f32],
    low_percent: f32,
    high_percent: f32,
) -> Result<(), JsValue> {
    // ... (保持不变)
    if data.is_empty() {
        return Ok(());
    }
    let mut sorted = data.to_vec();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let n = sorted.len();
    let p_low_idx = ((n as f32) * (low_percent / 100.0)).floor() as usize;
    let p_high_idx = ((n as f32) * (high_percent / 100.0)).ceil() as usize;
    let min_val = sorted[p_low_idx.min(n - 1)];
    let max_val = sorted[p_high_idx.min(n - 1)];
    let range = (max_val - min_val).max(1e-9);
    for raw_value in data.iter_mut() {
        *raw_value = ((*raw_value - min_val) / range).clamp(0.0, 1.0);
    }
    Ok(())
}

#[wasm_bindgen(js_name = normalizeBandInPlaceWithStats)]
pub fn normalize_band_in_place_with_stats(
    data: &mut [f32],
    min_val: f32,
    max_val: f32,
) -> Result<(), JsValue> {
    // ... (保持不变)
    if data.is_empty() {
        return Ok(());
    }
    let range = (max_val - min_val).max(1e-9);
    for raw_value in data.iter_mut() {
        let norm_value = (*raw_value - min_val) / range;
        *raw_value = norm_value.clamp(0.0, 1.0);
    }
    Ok(())
}
// ====================== [ 新增：高性能统计计算区域 ] ======================

/// 结构体，用于将统计结果传递给JS
#[wasm_bindgen]
pub struct BandStats {
    pub min: f64,
    pub max: f64,
}

/// 从一个f32数据块中高效计算统计数据（均值±2倍标准差）。
/// 这个函数避免了在JS中进行昂贵的排序操作。
#[wasm_bindgen(js_name = calculateStatistics)]
pub fn calculate_statistics(data: &Float32Array) -> Result<BandStats, JsValue> {
    let data_vec = data.to_vec();
    if data_vec.is_empty() {
        // 如果没有数据，返回一个安全的默认值
        return Ok(BandStats {
            min: 0.0,
            max: 255.0,
        });
    }

    let mut sum = 0.0;
    let mut sum_sq = 0.0;
    let mut finite_count = 0;

    // 第一次遍历：计算总和和平方和，同时忽略 NaN 或 无穷大的值
    for &val in data_vec.iter() {
        let val_f64 = val as f64;
        if val_f64.is_finite() {
            sum += val_f64;
            sum_sq += val_f64 * val_f64;
            finite_count += 1;
        }
    }

    // 如果所有值都是无效的，也返回默认值
    if finite_count == 0 {
        return Ok(BandStats {
            min: 0.0,
            max: 255.0,
        });
    }

    let count_f64 = finite_count as f64;
    let mean = sum / count_f64;
    // 使用更稳定的方法计算方差，避免浮点数精度问题
    let variance = (sum_sq - (sum * sum) / count_f64) / count_f64;

    // 确保方差不会因精度问题变成微小的负数
    let std_dev = if variance > 0.0 { variance.sqrt() } else { 0.0 };

    // 定义拉伸范围为 均值 ± 2倍标准差
    let min_val = mean - 2.0 * std_dev;
    let max_val = mean + 2.0 * std_dev;

    Ok(BandStats {
        min: min_val,
        max: max_val,
    })
}
