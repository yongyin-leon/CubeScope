// src/parser.rs
use crate::error::EnviError;
use crate::header::{ByteOrder, DataType, EnviHeader, Interleave};
use std::collections::HashMap;
use std::str::FromStr;

pub fn parse_header_str(content: &str) -> Result<EnviHeader, EnviError> {
    let mut fields: HashMap<String, String> = HashMap::new();
    let mut current_key = String::new();
    let mut multiline_buffer = String::new();
    let mut in_multiline = false;

    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with(';') {
            continue;
        }

        if in_multiline {
            if let Some(end_pos) = line.rfind('}') {
                multiline_buffer.push_str(&line[..end_pos]);
                fields.insert(current_key.clone(), multiline_buffer.trim().to_string());
                in_multiline = false;
                multiline_buffer.clear();
            } else {
                multiline_buffer.push_str(line);
                multiline_buffer.push(' ');
            }
        } else if let Some((key, value)) = line.split_once('=') {
            let key = key.trim().to_string();
            let value = value.trim();

            if value.starts_with('{') {
                if let Some(end_pos) = value.rfind('}') {
                    fields.insert(key, value[1..end_pos].trim().to_string());
                } else {
                    in_multiline = true;
                    current_key = key;
                    multiline_buffer.push_str(&value[1..]);
                    multiline_buffer.push(' ');
                }
            } else {
                fields.insert(key, value.to_string());
            }
        }
    }

    if in_multiline {
        return Err(EnviError::UnclosedMultilineValue);
    }

    let mut processed_fields = fields;

    let mut get_and_remove_required_field = |key: &str| {
        processed_fields
            .remove(key)
            .ok_or_else(|| EnviError::MissingRequiredField(key.to_string()))
    };
    
    let get_optional_field = |fields: &mut HashMap<String, String>, key: &str, default: &str| {
        fields.remove(key).unwrap_or_else(|| default.to_string())
    };

    let samples: u32 = get_and_remove_required_field("samples")?.parse().map_err(|e| EnviError::from_parse_error(e, "samples"))?;
    let lines: u32 = get_and_remove_required_field("lines")?.parse().map_err(|e| EnviError::from_parse_error(e, "lines"))?;
    let bands: u32 = get_and_remove_required_field("bands")?.parse().map_err(|e| EnviError::from_parse_error(e, "bands"))?;
    
    let data_type_code: i32 = get_and_remove_required_field("data type")?.parse().map_err(|e| EnviError::from_parse_error(e, "data type"))?;
    let data_type = DataType::from_code(data_type_code)?;
    
    let interleave_str = get_and_remove_required_field("interleave")?;
    let interleave = Interleave::from_str(&interleave_str)?;
    
    let byte_order_code: i32 = get_optional_field(&mut processed_fields, "byte order", "0").parse().map_err(|e| EnviError::from_parse_error(e, "byte order"))?;
    let byte_order = ByteOrder::from_code(byte_order_code)?;

    let header_offset: usize = get_optional_field(&mut processed_fields, "header offset", "0").parse().map_err(|e| EnviError::from_parse_error(e, "header offset"))?;

    let description = processed_fields.remove("description");
    let file_type = processed_fields.remove("file type");
    let sensor_type = processed_fields.remove("sensor type");

    let wavelength = processed_fields.remove("wavelength").and_then(|s| {
        s.split(',')
         .map(|v| v.trim().parse::<f64>())
         .collect::<Result<Vec<f64>, _>>()
         .ok()
    });
    
    let custom_fields = processed_fields; 
    let bytes_per_pixel = data_type.byte_size();

    Ok(EnviHeader {
        samples,
        lines,
        bands,
        data_type,
        interleave,
        byte_order,
        header_offset,
        description,
        file_type,
        sensor_type,
        wavelength,
        custom_fields,
        bytes_per_pixel,
    })
}