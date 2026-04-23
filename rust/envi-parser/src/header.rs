// src/header.rs
use crate::error::EnviError;
use serde::{Serialize, Deserialize};
use wasm_bindgen::prelude::*;
use std::str::FromStr;
use std::collections::HashMap;

// Interleave 枚举需要暴露给 JS，保留 #[wasm_bindgen]
#[wasm_bindgen]
#[derive(Debug, PartialEq, Eq, Clone, Copy, Serialize, Deserialize)]
pub enum Interleave {
    Bsq,
    Bil,
    Bip,
}

// FromStr trait 实现，让 parser 可以从字符串转换
impl FromStr for Interleave {
    type Err = EnviError;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "bsq" => Ok(Interleave::Bsq),
            "bil" => Ok(Interleave::Bil),
            "bip" => Ok(Interleave::Bip),
            _ => Err(EnviError::InvalidFieldValue {
                field: "interleave".to_string(),
                value: s.to_string(),
            }),
        }
    }
}

// ByteOrder 枚举需要暴露给 JS
#[wasm_bindgen]
#[derive(Debug, PartialEq, Eq, Clone, Copy, Serialize, Deserialize)]
pub enum ByteOrder {
    Lsb,
    Msb,
}

impl ByteOrder {
    pub fn from_code(code: i32) -> Result<Self, EnviError> {
        match code {
            0 => Ok(ByteOrder::Lsb),
            1 => Ok(ByteOrder::Msb),
            _ => Err(EnviError::UnsupportedByteOrder(code)),
        }
    }
}

// DataType 枚举需要暴露给 JS
#[wasm_bindgen]
#[derive(Debug, PartialEq, Eq, Clone, Copy, Serialize, Deserialize)]
pub enum DataType {
    U8, I16, I32, F32, F64, ComplexF32, ComplexF64, U16, U32, I64, U64,
}

impl DataType {
    pub fn from_code(code: i32) -> Result<Self, EnviError> {
        match code {
            1 | 16 => Ok(DataType::U8), 2 => Ok(DataType::I16), 3 => Ok(DataType::I32),
            4 => Ok(DataType::F32), 5 => Ok(DataType::F64), 6 => Ok(DataType::ComplexF32),
            9 => Ok(DataType::ComplexF64), 12 => Ok(DataType::U16), 13 => Ok(DataType::U32),
            14 => Ok(DataType::I64), 15 => Ok(DataType::U64),
            _ => Err(EnviError::UnsupportedDataType(code)),
        }
    }
    pub fn byte_size(&self) -> usize {
        match self {
            DataType::U8 => 1, DataType::I16 | DataType::U16 => 2,
            DataType::I32 | DataType::U32 | DataType::F32 => 4,
            DataType::F64 | DataType::I64 | DataType::U64 | DataType::ComplexF32 => 8,
            DataType::ComplexF64 => 16,
        }
    }
}

// EnviHeader 结构体本身不再需要 #[wasm_bindgen]，因为它将是 EnviReader 的一个私有成员
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnviHeader {
    // 字段设为 pub，以便在 crate 内部的其他模块（如 parser, lib）中访问
    pub samples: u32,
    pub lines: u32,
    pub bands: u32,
    pub data_type: DataType,
    pub interleave: Interleave,
    pub byte_order: ByteOrder,
    pub description: Option<String>,
    pub header_offset: usize,
    pub file_type: Option<String>,
    pub sensor_type: Option<String>,
    pub map_info: Option<String>,
    pub coordinate_system_string: Option<String>,
    pub wavelength: Option<Vec<f64>>,
    #[serde(skip_deserializing)]
    pub bytes_per_pixel: usize,
    // 这个字段将由 serde 自动处理，无需 #[wasm_bindgen(skip)]
    pub custom_fields: HashMap<String, String>,
}

// EnviHeader 不再有 wasm_bindgen 的 impl 块
// 所有暴露给 JS 的功能都将通过 EnviReader 实现
impl EnviHeader {
    // 这个 to_js 方法现在只在 crate 内部使用，由 EnviReader 调用
    pub fn to_js(&self) -> Result<JsValue, JsValue> {
        serde_wasm_bindgen::to_value(self)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }
}
