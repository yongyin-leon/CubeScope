// src/spectral.rs

use crate::error::EnviError;
use crate::header::{EnviHeader, Interleave};
use crate::EnviReader; // 引入 EnviReader 以便访问其辅助方法
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

fn checked_chunk_start(
    absolute_offset: u64,
    chunk_start_offset: u64,
    interleave: &str,
) -> Result<u64, EnviError> {
    absolute_offset
        .checked_sub(chunk_start_offset)
        .ok_or_else(|| EnviError::InvalidFieldValue {
            field: "chunk_data".to_string(),
            value: format!("{} read starts before the provided chunk", interleave),
        })
}

/// 根据给定的数据块和坐标，提取单点的高光谱曲线
///
/// # Arguments
/// * `reader` - EnviReader的实例，用于访问头文件信息和辅助函数
/// * `chunk_data` - 包含目标像素数据的二进制数据块
/// * `chunk_start_offset_in_file` - 该数据块在完整ENVI文件中的起始偏移量
/// * `x` - 目标像素的X坐标 (从0开始)
/// * `y` - 目标像素的Y坐标 (从0开始)
///
/// # Returns
/// * `Result<Vec<f32>, EnviError>` - 一个包含所有波段在该点像素值的浮点数向量
pub fn extract_spectral_profile(
    reader: &EnviReader,
    chunk_data: &[u8],
    chunk_start_offset_in_file: u64,
    x: u32,
    y: u32,
) -> Result<Vec<f32>, EnviError> {
    let header = &reader.header;
    let bpp = header.bytes_per_pixel as u64;
    let samples = u64::from(header.samples);
    let lines = u64::from(header.lines);
    let bands = u64::from(header.bands);
    let header_offset = header.header_offset as u64;
    let x_offset = u64::from(x);
    let y_offset = u64::from(y);

    // 坐标边界检查
    if x_offset >= samples || y_offset >= lines {
        return Err(EnviError::InvalidFieldValue {
            field: "coordinates".to_string(),
            value: format!("({}, {}) out of bounds ({}, {})", x, y, samples, lines),
        });
    }

    let mut spectral_curve = Vec::with_capacity(bands as usize);

    // 根据不同的交错格式进行计算
    match header.interleave {
        Interleave::Bsq => {
            // BSQ: Band Sequential
            // 数据布局: (b1, b2, b3, ...), 每个b是完整的二维图像
            let single_band_size = samples * lines * bpp;
            for i in 0..bands {
                let band_offset = i * single_band_size;
                let pixel_offset_in_band = (y_offset * samples + x_offset) * bpp;
                let absolute_pixel_offset = header_offset + band_offset + pixel_offset_in_band;

                // 转换为数据块内的相对偏移
                let start_in_chunk =
                    checked_chunk_start(absolute_pixel_offset, chunk_start_offset_in_file, "BSQ")?;
                let end_in_chunk = start_in_chunk + bpp;

                if end_in_chunk > chunk_data.len() as u64 {
                    return Err(EnviError::InvalidFieldValue {
                        field: "chunk_data".to_string(),
                        value: format!(
                            "BSQ read for band {} at offset {} exceeds chunk length",
                            i, end_in_chunk
                        ),
                    });
                }

                let pixel_bytes = &chunk_data[start_in_chunk as usize..end_in_chunk as usize];
                // 使用 reader 内部的辅助函数
                let value = reader.bytes_to_f32(pixel_bytes).map_err(|js_err| {
                    EnviError::InvalidFieldValue {
                        field: "pixel_data".to_string(),
                        value: js_err.as_string().unwrap_or_default(),
                    }
                })?;
                spectral_curve.push(value);
            }
        }
        Interleave::Bil => {
            // BIL: Band Interleaved by Line
            // 数据布局: (line1, line2, ...), 每个line包含所有波段的数据 (l1b1, l1b2, ..., l2b1, l2b2, ...)
            let bytes_per_line_per_band = samples * bpp;
            let bytes_per_full_line = bytes_per_line_per_band * bands;

            for i in 0..bands {
                let line_start_offset = y_offset * bytes_per_full_line;
                let band_start_in_line_offset = i * bytes_per_line_per_band;
                let pixel_start_in_band_offset = x_offset * bpp;

                let absolute_pixel_offset = header_offset
                    + line_start_offset
                    + band_start_in_line_offset
                    + pixel_start_in_band_offset;

                let start_in_chunk =
                    checked_chunk_start(absolute_pixel_offset, chunk_start_offset_in_file, "BIL")?;
                let end_in_chunk = start_in_chunk + bpp;

                if end_in_chunk > chunk_data.len() as u64 {
                    return Err(EnviError::InvalidFieldValue {
                        field: "chunk_data".to_string(),
                        value: format!(
                            "BIL read for band {} at offset {} exceeds chunk length",
                            i, end_in_chunk
                        ),
                    });
                }

                let pixel_bytes = &chunk_data[start_in_chunk as usize..end_in_chunk as usize];
                let value = reader.bytes_to_f32(pixel_bytes).map_err(|js_err| {
                    EnviError::InvalidFieldValue {
                        field: "pixel_data".to_string(),
                        value: js_err.as_string().unwrap_or_default(),
                    }
                })?;
                spectral_curve.push(value);
            }
        }
        Interleave::Bip => {
            // BIP: Band Interleaved by Pixel
            // 数据布局: (pixel1, pixel2, ...), 每个pixel包含所有波段的值 (p1b1, p1b2, ..., p2b1, p2b2, ...)
            let bytes_per_full_pixel = bands * bpp;
            let pixel_index = y_offset * samples + x_offset; // 第几个像素
            let pixel_group_start_offset = pixel_index * bytes_per_full_pixel;

            for i in 0..bands {
                let band_offset_in_pixel = i * bpp;
                let absolute_pixel_offset =
                    header_offset + pixel_group_start_offset + band_offset_in_pixel;

                let start_in_chunk =
                    checked_chunk_start(absolute_pixel_offset, chunk_start_offset_in_file, "BIP")?;
                let end_in_chunk = start_in_chunk + bpp;

                if end_in_chunk > chunk_data.len() as u64 {
                    return Err(EnviError::InvalidFieldValue {
                        field: "chunk_data".to_string(),
                        value: format!(
                            "BIP read for band {} at offset {} exceeds chunk length",
                            i, end_in_chunk
                        ),
                    });
                }

                let pixel_bytes = &chunk_data[start_in_chunk as usize..end_in_chunk as usize];
                let value = reader.bytes_to_f32(pixel_bytes).map_err(|js_err| {
                    EnviError::InvalidFieldValue {
                        field: "pixel_data".to_string(),
                        value: js_err.as_string().unwrap_or_default(),
                    }
                })?;
                spectral_curve.push(value);
            }
        }
    }

    Ok(spectral_curve)
}
/// 用于将单个光谱点（波长和值）传递给JS的结构体
#[wasm_bindgen(getter_with_clone)]
#[derive(Serialize, Deserialize)]
pub struct SpectralPoint {
    pub wavelength: f64,
    pub value: f32,
}

/// 将原始光谱曲线与波长信息（如果存在）进行配对
pub fn pair_with_wavelengths(header: &EnviHeader, spectral_curve: Vec<f32>) -> Vec<SpectralPoint> {
    // 检查头文件中是否有波长信息，并且数量是否与波段数匹配
    if let Some(wavelengths) = &header.wavelength {
        if wavelengths.len() == spectral_curve.len() {
            // 将波长和值打包在一起
            return wavelengths
                .iter()
                .zip(spectral_curve.iter())
                .map(|(&w, &v)| SpectralPoint {
                    wavelength: w,
                    value: v,
                })
                .collect();
        }
    }

    // 如果没有波长信息或数量不匹配，则使用波段索引作为替代
    // (注意：这里返回的 wavelength 字段实际上是 band_index + 1)
    spectral_curve
        .iter()
        .enumerate()
        .map(|(i, &v)| SpectralPoint {
            wavelength: (i + 1) as f64,
            value: v,
        })
        .collect()
}
