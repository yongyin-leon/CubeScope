// src/error.rs
use thiserror::Error;
use wasm_bindgen::prelude::*;

#[derive(Error, Debug)]
pub enum EnviError {
    #[error("输入数据不是有效的UTF-8编码: {0}")]
    InvalidUtf8(#[from] std::str::Utf8Error),

    #[error("缺少必需的头文件字段: '{0}'")]
    MissingRequiredField(String),

    #[error("字段 '{field}' 的值无效: '{value}'")]
    InvalidFieldValue { field: String, value: String },

    #[error("不支持的数据类型代码: {0}")]
    UnsupportedDataType(i32),

    #[error("不支持的字节序代码: {0}")]
    UnsupportedByteOrder(i32),
    
    #[error("无效的字节序值: {0}")]
    InvalidByteOrder(i32),

    #[error("不支持的交错类型: `{0}`")]
    UnsupportedInterleave(String),

    #[error("多行值（使用 '{{' 和 '}}'）未正确关闭")]
    UnclosedMultilineValue,

    #[error("无法解析字段 '{field}' 的值: {source}")]
    ParseError {
        field: String,
        #[source]
        source: Box<dyn std::error::Error + Send + Sync>,
    },
}

impl EnviError {
    /// 一个辅助函数，用于将任何解析错误转换为我们的 EnviError::ParseError
    pub fn from_parse_error<E>(source: E, field: &str) -> Self
    where
        E: std::error::Error + Send + Sync + 'static,
    {
        EnviError::ParseError {
            field: field.to_string(),
            source: Box::new(source),
        }
    }
}

// 将我们的Rust错误转换为JavaScript的Error对象
impl From<EnviError> for JsValue {
    fn from(err: EnviError) -> JsValue {
        JsValue::from_str(&err.to_string())
    }
}