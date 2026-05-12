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
            let key = key.trim().to_ascii_lowercase();
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

    let samples: u32 = get_and_remove_required_field("samples")?
        .parse()
        .map_err(|e| EnviError::from_parse_error(e, "samples"))?;
    let lines: u32 = get_and_remove_required_field("lines")?
        .parse()
        .map_err(|e| EnviError::from_parse_error(e, "lines"))?;
    let bands: u32 = get_and_remove_required_field("bands")?
        .parse()
        .map_err(|e| EnviError::from_parse_error(e, "bands"))?;

    let data_type_code: i32 = get_and_remove_required_field("data type")?
        .parse()
        .map_err(|e| EnviError::from_parse_error(e, "data type"))?;
    let data_type = DataType::from_code(data_type_code)?;

    let interleave_str = get_and_remove_required_field("interleave")?;
    let interleave = Interleave::from_str(&interleave_str)?;

    let byte_order_code: i32 = get_optional_field(&mut processed_fields, "byte order", "0")
        .parse()
        .map_err(|e| EnviError::from_parse_error(e, "byte order"))?;
    let byte_order = ByteOrder::from_code(byte_order_code)?;

    let header_offset: usize = get_optional_field(&mut processed_fields, "header offset", "0")
        .parse()
        .map_err(|e| EnviError::from_parse_error(e, "header offset"))?;

    let description = processed_fields.remove("description");
    let file_type = processed_fields.remove("file type");
    let sensor_type = processed_fields.remove("sensor type");
    let map_info = processed_fields.remove("map info");
    let coordinate_system_string = processed_fields.remove("coordinate system string");

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
        map_info,
        coordinate_system_string,
        wavelength,
        custom_fields,
        bytes_per_pixel,
    })
}

#[cfg(test)]
mod tests {
    use super::parse_header_str;
    use crate::header::{ByteOrder, DataType, Interleave};

    #[test]
    fn rejects_missing_required_fields() {
        let result = parse_header_str(
            "ENVI
samples = 4
lines = 3
data type = 12
interleave = bsq
byte order = 0
",
        );

        assert!(result.is_err());
    }

    #[test]
    fn rejects_invalid_byte_order() {
        let result = parse_header_str(
            "ENVI
samples = 4
lines = 3
bands = 2
data type = 12
interleave = bsq
byte order = 9
",
        );

        assert!(result.is_err());
    }

    #[test]
    fn maps_core_data_type_and_interleave_fields() {
        let header = parse_header_str(
            "ENVI
samples = 4
lines = 3
bands = 2
data type = 4
interleave = bip
byte order = 1
header offset = 128
",
        )
        .expect("header should parse");

        assert_eq!(header.data_type, DataType::F32);
        assert_eq!(header.interleave, Interleave::Bip);
        assert_eq!(header.byte_order, ByteOrder::Msb);
        assert_eq!(header.header_offset, 128);
        assert_eq!(header.bytes_per_pixel, 4);
    }

    #[test]
    fn accepts_case_insensitive_header_field_names() {
        let header = parse_header_str(
            "ENVI
Samples = 4
Lines = 3
Bands = 2
Data Type = 12
Interleave = BSQ
Byte Order = 0
Header Offset = 256
Map Info = {UTM, 1, 1, 500000, 4100000, 30, 30, 50, North, WGS-84, units=Meters}
",
        )
        .expect("mixed-case header should parse");

        assert_eq!(header.samples, 4);
        assert_eq!(header.lines, 3);
        assert_eq!(header.bands, 2);
        assert_eq!(header.data_type, DataType::U16);
        assert_eq!(header.interleave, Interleave::Bsq);
        assert_eq!(header.header_offset, 256);
        assert!(header.map_info.is_some());
    }

    #[test]
    fn defaults_byte_order_and_header_offset() {
        let header = parse_header_str(
            "ENVI
samples = 4
lines = 3
bands = 2
data type = 12
interleave = bil
",
        )
        .expect("header should parse with defaults");

        assert_eq!(header.byte_order, ByteOrder::Lsb);
        assert_eq!(header.header_offset, 0);
        assert_eq!(header.bytes_per_pixel, 2);
    }

    #[test]
    fn parses_map_info_into_first_class_header_field() {
        let header = parse_header_str(
            "ENVI
samples = 4
lines = 3
bands = 2
data type = 12
interleave = bsq
byte order = 0
map info = {UTM, 1, 1, 500000, 4100000, 30, 30, 50, North, WGS-84, units=Meters}
",
        )
        .expect("map info should parse");

        assert_eq!(
            header.map_info.as_deref(),
            Some("UTM, 1, 1, 500000, 4100000, 30, 30, 50, North, WGS-84, units=Meters")
        );
        assert!(!header.custom_fields.contains_key("map info"));
    }

    #[test]
    fn parses_multiline_coordinate_system_string() {
        let header = parse_header_str(
            "ENVI
samples = 4
lines = 3
bands = 2
data type = 12
interleave = bsq
byte order = 0
coordinate system string = {PROJCS[\"WGS 84 / UTM zone 50N\",
GEOGCS[\"WGS 84\"],
UNIT[\"Meter\",1.0]}
",
        )
        .expect("coordinate system string should parse");

        assert_eq!(
            header.coordinate_system_string.as_deref(),
            Some("PROJCS[\"WGS 84 / UTM zone 50N\", GEOGCS[\"WGS 84\"], UNIT[\"Meter\",1.0]")
        );
        assert!(!header
            .custom_fields
            .contains_key("coordinate system string"));
    }
}
