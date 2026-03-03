use std::fs;

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use ebcdic::ebcdic::Ebcdic;
use serde::Serialize;

const RECORD_LEN: usize = 80;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RecordField {
    pub name: String,
    pub start: usize,
    pub end: usize,
    pub value: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ParsedRecord {
    pub id: String,
    pub record_type: String,
    pub record_name: String,
    pub index: usize,
    pub line_number: usize,
    pub raw: String,
    pub fields: Vec<RecordField>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EntryGroup {
    pub id: String,
    pub label: String,
    pub index: usize,
    pub records: Vec<ParsedRecord>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedFile {
    pub file_path: String,
    pub total_records: usize,
    pub file_headers: Vec<ParsedRecord>,
    pub batch_headers: Vec<ParsedRecord>,
    pub entries: Vec<EntryGroup>,
    pub batch_footers: Vec<ParsedRecord>,
    pub file_footers: Vec<ParsedRecord>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordImage {
    pub mime_type: String,
    pub data_base64: String,
    pub byte_len: usize,
    pub record_index: usize,
    pub line_number: usize,
}

pub fn parse_file(file_path: &str) -> Result<ParsedFile, String> {
    let bytes = fs::read(file_path).map_err(|e| format!("failed to read file: {e}"))?;
    if bytes.is_empty() {
        return Err("file is empty".to_string());
    }

    let raw_records = split_record_bytes(&bytes)?;
    let parsed_records = raw_records
        .into_iter()
        .enumerate()
        .map(|(index, (line_number, raw_bytes))| parse_record(raw_bytes, index, line_number))
        .collect::<Vec<_>>();

    let grouped = group_records(parsed_records);
    Ok(ParsedFile {
        file_path: file_path.to_string(),
        total_records: grouped.total_records,
        file_headers: grouped.file_headers,
        batch_headers: grouped.batch_headers,
        entries: grouped.entries,
        batch_footers: grouped.batch_footers,
        file_footers: grouped.file_footers,
    })
}

pub fn get_record_image(
    file_path: &str,
    record_index: usize,
) -> Result<Option<RecordImage>, String> {
    let bytes = fs::read(file_path).map_err(|e| format!("failed to read file: {e}"))?;
    let rows = split_record_bytes(&bytes)?;

    let Some((line_number, record_bytes)) = rows.into_iter().nth(record_index) else {
        return Err(format!("record index {} is out of range", record_index));
    };

    let record_type = detect_record_type(&record_bytes);
    if record_type != "52" {
        return Ok(None);
    }

    let Some((mime_type, image_bytes)) = extract_image_payload(&record_bytes) else {
        return Ok(None);
    };

    Ok(Some(RecordImage {
        mime_type: mime_type.to_string(),
        data_base64: BASE64.encode(image_bytes),
        byte_len: image_bytes.len(),
        record_index,
        line_number,
    }))
}

fn split_record_bytes(bytes: &[u8]) -> Result<Vec<(usize, Vec<u8>)>, String> {
    if let Some(prefixed_records) = split_length_prefixed_records(bytes) {
        return prefixed_records;
    }

    let has_text_newlines = bytes.contains(&b'\n');

    if has_text_newlines {
        let mut rows = Vec::new();
        for (line_number, line) in bytes.split(|b| *b == b'\n').enumerate() {
            if line.is_empty() {
                continue;
            }

            let mut trimmed = line;
            if trimmed.ends_with(&[b'\r']) {
                trimmed = &trimmed[..trimmed.len() - 1];
            }
            if trimmed.is_empty() {
                continue;
            }
            if trimmed.len() < RECORD_LEN {
                return Err(format!("line {} is shorter than 80 bytes", line_number + 1));
            }

            rows.push((line_number + 1, trimmed[..RECORD_LEN].to_vec()));
        }

        if rows.is_empty() {
            return Err("file does not contain parsable records".to_string());
        }

        return Ok(rows);
    }

    if bytes.len() < RECORD_LEN {
        return Err("file does not contain complete 80-byte records".to_string());
    }
    if !bytes.len().is_multiple_of(RECORD_LEN) {
        return Err("file length is not a multiple of 80 bytes".to_string());
    }

    let mut rows = Vec::new();
    let mut line_number = 1;
    for chunk in bytes.chunks(RECORD_LEN) {
        rows.push((line_number, chunk.to_vec()));
        line_number += 1;
    }
    Ok(rows)
}

fn split_length_prefixed_records(bytes: &[u8]) -> Option<Result<Vec<(usize, Vec<u8>)>, String>> {
    if bytes.len() < 8 {
        return None;
    }

    let first_len = u32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]) as usize;
    if first_len < 2 || first_len > bytes.len().saturating_sub(4) {
        return None;
    }

    let first_record_end = 4 + first_len;
    if !looks_like_record_type_prefix(&bytes[4..first_record_end]) {
        return None;
    }

    let mut rows = Vec::new();
    let mut offset = 0;
    let mut line_number = 1;

    while offset < bytes.len() {
        if offset + 4 > bytes.len() {
            return Some(Err("trailing bytes after final record length".to_string()));
        }

        let record_len = u32::from_be_bytes([
            bytes[offset],
            bytes[offset + 1],
            bytes[offset + 2],
            bytes[offset + 3],
        ]) as usize;

        if record_len == 0 {
            return Some(Err(format!("record {} has zero byte length", line_number)));
        }

        let start = offset + 4;
        let end = start + record_len;
        if end > bytes.len() {
            return Some(Err(format!(
                "record {} length ({}) exceeds remaining file bytes",
                line_number, record_len
            )));
        }

        rows.push((line_number, bytes[start..end].to_vec()));
        offset = end;
        line_number += 1;
    }

    Some(Ok(rows))
}

fn looks_like_record_type_prefix(record: &[u8]) -> bool {
    if record.len() < 2 {
        return false;
    }

    let is_ascii_digits = record[0].is_ascii_digit() && record[1].is_ascii_digit();
    let is_ebcdic_digits = (0xF0..=0xF9).contains(&record[0]) && (0xF0..=0xF9).contains(&record[1]);

    is_ascii_digits || is_ebcdic_digits
}

fn parse_record(raw_bytes: Vec<u8>, index: usize, line_number: usize) -> ParsedRecord {
    let record_type = detect_record_type(&raw_bytes);
    let raw = if record_type == "52" {
        let header = decode_record_header(&raw_bytes);
        format!(
            "{} [binary image payload: {} bytes]",
            header,
            raw_bytes.len().saturating_sub(RECORD_LEN)
        )
    } else {
        decode_record(&raw_bytes)
    };
    let record_name = match record_type.as_str() {
        "01" => "File Header",
        "10" => "Cash Letter Header",
        "20" => "Bundle Header",
        "25" => "Check Detail",
        "26" => "Check Detail Addendum A",
        "28" => "Check Detail Addendum C",
        "31" => "Return Record",
        "32" => "Return Addendum A",
        "33" => "Return Addendum B",
        "35" => "Return Addendum D",
        "50" => "Image View Detail",
        "52" => "Image View Data",
        "61" => "Credit Record",
        "62" => "Credit Addendum A",
        "70" => "Bundle Control",
        "90" => "Cash Letter Control",
        "99" => "File Control",
        _ => "Other Record",
    }
    .to_string();

    ParsedRecord {
        id: format!("{}-{}", record_type, index),
        record_type: record_type.clone(),
        record_name,
        index,
        line_number,
        raw: raw.clone(),
        fields: build_fields(&record_type, &raw),
    }
}

fn decode_record(record_bytes: &[u8]) -> String {
    if let Ok(raw_utf8) = std::str::from_utf8(record_bytes) {
        let normalized_utf8 = normalize_record_text(raw_utf8);
        if looks_like_x937_record(&normalized_utf8) {
            return normalized_utf8;
        }
    }

    let mut ascii_bytes = vec![0_u8; record_bytes.len()];
    Ebcdic::ebcdic_to_ascii(
        record_bytes,
        &mut ascii_bytes,
        record_bytes.len(),
        true,
        true,
    );
    normalize_record_text(&String::from_utf8_lossy(&ascii_bytes))
}

fn decode_record_header(record_bytes: &[u8]) -> String {
    let header_len = RECORD_LEN.min(record_bytes.len());
    decode_record(&record_bytes[..header_len])
}

fn detect_record_type(record_bytes: &[u8]) -> String {
    if record_bytes.len() < 2 {
        return "??".to_string();
    }

    if record_bytes[0].is_ascii_digit() && record_bytes[1].is_ascii_digit() {
        return String::from_utf8_lossy(&record_bytes[0..2]).to_string();
    }

    if (0xF0..=0xF9).contains(&record_bytes[0]) && (0xF0..=0xF9).contains(&record_bytes[1]) {
        let digits = [record_bytes[0] - 0xF0, record_bytes[1] - 0xF0];
        return format!("{}{}", digits[0], digits[1]);
    }

    first_n_chars(&decode_record_header(record_bytes), 2)
}

fn extract_image_payload(record_bytes: &[u8]) -> Option<(&'static str, &[u8])> {
    let search_space = if record_bytes.len() > RECORD_LEN {
        &record_bytes[RECORD_LEN..]
    } else {
        &record_bytes[..]
    };

    let signatures: [(&[u8], &str); 4] = [
        (&[0xFF, 0xD8, 0xFF], "image/jpeg"),
        (&[0x49, 0x49, 0x2A, 0x00], "image/tiff"),
        (&[0x4D, 0x4D, 0x00, 0x2A], "image/tiff"),
        (
            &[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
            "image/png",
        ),
    ];

    let mut selected: Option<(usize, &'static str)> = None;
    for (sig, mime) in signatures {
        if let Some(position) = find_subslice(search_space, sig) {
            match selected {
                Some((best, _)) if position >= best => {}
                _ => selected = Some((position, mime)),
            }
        }
    }

    let (start, mime) = selected?;
    Some((mime, &search_space[start..]))
}

fn find_subslice(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    if needle.is_empty() || haystack.len() < needle.len() {
        return None;
    }
    haystack
        .windows(needle.len())
        .position(|window| window == needle)
}

fn normalize_record_text(raw: &str) -> String {
    raw.replace('\u{0000}', " ")
}

fn looks_like_x937_record(raw: &str) -> bool {
    let code = first_n_chars(raw, 2);
    if is_known_record_type(&code) {
        return true;
    }
    code.chars().all(|ch| ch.is_ascii_digit())
}

fn first_n_chars(raw: &str, count: usize) -> String {
    raw.chars().take(count).collect::<String>()
}

fn is_known_record_type(record_type: &str) -> bool {
    matches!(
        record_type,
        "01" | "10"
            | "20"
            | "25"
            | "26"
            | "28"
            | "31"
            | "32"
            | "33"
            | "35"
            | "50"
            | "52"
            | "61"
            | "62"
            | "70"
            | "90"
            | "99"
    )
}

struct GroupedRecords {
    total_records: usize,
    file_headers: Vec<ParsedRecord>,
    batch_headers: Vec<ParsedRecord>,
    entries: Vec<EntryGroup>,
    batch_footers: Vec<ParsedRecord>,
    file_footers: Vec<ParsedRecord>,
}

fn group_records(records: Vec<ParsedRecord>) -> GroupedRecords {
    let mut file_headers = Vec::new();
    let mut batch_headers = Vec::new();
    let mut entries = Vec::new();
    let mut batch_footers = Vec::new();
    let mut file_footers = Vec::new();

    let total_records = records.len();
    let mut current_entry: Vec<ParsedRecord> = Vec::new();
    let mut entry_counter = 1;

    for record in records {
        let record_type = record.record_type.clone();

        if is_entry_start(&record_type) {
            push_entry_if_any(&mut entries, &mut current_entry, &mut entry_counter);
            current_entry.push(record);
            continue;
        }

        if is_entry_continuation(&record_type) {
            current_entry.push(record);
            continue;
        }

        push_entry_if_any(&mut entries, &mut current_entry, &mut entry_counter);

        match record_type.as_str() {
            "01" => file_headers.push(record),
            "10" | "20" => batch_headers.push(record),
            "70" | "90" => batch_footers.push(record),
            "99" => file_footers.push(record),
            _ => batch_headers.push(record),
        }
    }

    push_entry_if_any(&mut entries, &mut current_entry, &mut entry_counter);

    GroupedRecords {
        total_records,
        file_headers,
        batch_headers,
        entries,
        batch_footers,
        file_footers,
    }
}

fn push_entry_if_any(
    entries: &mut Vec<EntryGroup>,
    current_entry: &mut Vec<ParsedRecord>,
    entry_counter: &mut usize,
) {
    if current_entry.is_empty() {
        return;
    }

    let records = std::mem::take(current_entry);
    let label = entry_label(&records, *entry_counter);

    entries.push(EntryGroup {
        id: format!("entry-{}", *entry_counter),
        label,
        index: *entry_counter - 1,
        records,
    });

    *entry_counter += 1;
}

fn entry_label(records: &[ParsedRecord], number: usize) -> String {
    if let Some(first) = records.first() {
        if first.record_type == "25" {
            if let Some(sequence) = first
                .fields
                .iter()
                .find(|field| field.name == "ECE Item Sequence Number")
                .map(|field| field.value.trim())
                .filter(|value| !value.is_empty())
            {
                return format!("Item {}", sequence);
            }
        }
    }

    format!("Entry #{}", number)
}

fn is_entry_start(record_type: &str) -> bool {
    matches!(record_type, "25" | "31" | "61")
}

fn is_entry_continuation(record_type: &str) -> bool {
    matches!(
        record_type,
        "26" | "28" | "32" | "33" | "35" | "50" | "52" | "62"
    )
}

fn build_fields(record_type: &str, raw: &str) -> Vec<RecordField> {
    let mut fields = vec![field(raw, "Record Type Code", 1, 2)];

    let schema = match record_type {
        "01" => vec![
            ("Standard Level", 3, 4),
            ("Test File Indicator", 5, 5),
            ("Immediate Destination Routing", 6, 14),
            ("Immediate Origin Routing", 15, 23),
            ("File Creation Date", 24, 31),
            ("File Creation Time", 32, 35),
            ("Resend Indicator", 36, 36),
            ("Immediate Destination Name", 37, 63),
            ("Immediate Origin Name", 64, 80),
        ],
        "10" => vec![
            ("Collection Type Indicator", 3, 3),
            ("Destination Routing", 4, 12),
            ("ECE Institution Routing", 13, 21),
            ("Cash Letter Business Date", 22, 29),
            ("Cash Letter Creation Date", 30, 37),
            ("Cash Letter Creation Time", 38, 41),
            ("Cash Letter Record Type Indicator", 42, 42),
            ("Cash Letter Documentation Type Indicator", 43, 43),
            ("Cash Letter Identifier", 44, 47),
            ("Originator Contact Name", 48, 61),
            ("Originator Contact Phone", 62, 71),
            ("Work Type", 72, 73),
            ("User Field", 74, 80),
        ],
        "20" => vec![
            ("Collection Type Indicator", 3, 3),
            ("Destination Routing", 4, 12),
            ("ECE Institution Routing", 13, 21),
            ("Bundle Business Date", 22, 29),
            ("Bundle Creation Date", 30, 37),
            ("Cycle Number", 38, 39),
            ("Bundle Identifier", 40, 43),
            ("Return Location Routing", 44, 52),
            ("User Field", 53, 80),
        ],
        "25" => vec![
            ("Auxiliary On-Us", 3, 17),
            ("External Processing Code", 18, 18),
            ("Payor Bank Routing", 19, 27),
            ("On-Us", 28, 47),
            ("Amount", 48, 57),
            ("ECE Item Sequence Number", 58, 72),
            ("Documentation Type Indicator", 73, 73),
            ("Return Acceptance Indicator", 74, 74),
            ("MICR Valid Indicator", 75, 75),
            ("BOFD Indicator", 76, 76),
            ("Archive Type Indicator", 77, 77),
            ("Reserved", 78, 80),
        ],
        "26" => vec![
            ("Check Detail Addendum A Record Number", 3, 3),
            ("BOFD Routing Number", 4, 12),
            ("BOFD Business Date", 13, 20),
            ("BOFD Item Sequence Number", 21, 35),
            ("Deposit Account Number At BOFD", 36, 53),
            ("BOFD Deposit Branch", 54, 58),
            ("Payee Name", 59, 73),
            ("Truncation Indicator", 74, 74),
            ("BOFD Conversion Indicator", 75, 75),
            ("BOFD Correction Indicator", 76, 76),
            ("User Field", 77, 77),
            ("Reserved", 78, 80),
        ],
        "28" => vec![
            ("Image Reference Key Length", 3, 6),
            ("Image Reference Key", 7, 21),
            ("Digital Signature", 22, 26),
            ("Digital Signature Length", 27, 31),
            ("Image Data", 32, 80),
        ],
        "31" => vec![
            ("Payor Bank Routing Number", 3, 11),
            ("Payor Bank Routing Number Check Digit", 12, 12),
            ("On-Us Return Record", 13, 32),
            ("Amount", 33, 42),
            ("Return Reason", 43, 43),
            ("Return Record Addendum Count", 44, 45),
            ("Return Documentation Type Indicator", 46, 46),
            ("Forward Bundle Date", 47, 54),
            ("ECE Item Sequence Number", 55, 69),
            ("External Processing Code", 70, 70),
            ("Return Notification Indicator", 71, 71),
            ("Return Archive Type Indicator", 72, 72),
            ("Reserved", 73, 80),
        ],
        "32" => vec![
            ("Return Addendum A Record Number", 3, 3),
            ("BOFD Routing Number", 4, 12),
            ("BOFD Business Date", 13, 20),
            ("BOFD Item Sequence Number", 21, 35),
            ("Deposit Account Number At BOFD", 36, 53),
            ("BOFD Deposit Branch", 54, 58),
            ("Payee Name", 59, 73),
            ("Truncation Indicator", 74, 74),
            ("BOFD Conversion Indicator", 75, 75),
            ("BOFD Correction Indicator", 76, 76),
            ("User Field", 77, 77),
            ("Reserved", 78, 80),
        ],
        "33" => vec![
            ("Payor Bank Name", 3, 20),
            ("Auxiliary On-Us", 3, 17),
            ("Payor Bank Item Sequence Number", 21, 35),
            ("Payor Bank Business Date", 36, 43),
            ("Payor Account Name", 44, 63),
            ("Reserved", 64, 80),
        ],
        "35" => vec![
            ("Return Addendum D Record Number", 3, 4),
            ("Endorsing Bank Routing Number", 5, 13),
            ("Endorsing Bank Endorsement Date", 14, 21),
            ("Endorsing Bank Item Sequence Number", 22, 36),
            ("Truncation Indicator", 37, 37),
            ("Endorsing Bank Conversion Indicator", 38, 38),
            ("Endorsing Bank Correction Indicator", 39, 39),
            ("Return Reason", 40, 40),
            ("User Field", 41, 59),
            ("Reserved", 60, 80),
        ],
        "50" => vec![
            ("Image Indicator", 3, 3),
            ("Image Creator Routing Number", 4, 12),
            ("Image Creator Date", 13, 20),
            ("Image View Format Indicator", 21, 22),
            ("Image View Compression Algorithm", 23, 24),
            ("Image View Data Size", 25, 31),
            ("View Side Indicator", 32, 32),
            ("View Descriptor", 33, 34),
            ("Digital Signature Indicator", 35, 35),
            ("Digital Signature Method", 36, 37),
            ("Security Key Size", 38, 42),
            ("Start Of Protected Data", 43, 49),
            ("Length Of Protected Data", 50, 56),
            ("Image Recreate Indicator", 57, 57),
            ("User Field", 58, 65),
            ("Image TIF Variance Indicator", 66, 66),
            ("Override Indicator", 67, 67),
            ("Reserved", 68, 80),
        ],
        "52" => vec![
            ("ECE Institution Routing Number", 3, 11),
            ("Bundle Business Date", 12, 19),
            ("Cycle Number", 20, 21),
            ("ECE Institution Item Sequence Number", 22, 36),
            ("Security Originator Name", 37, 52),
            ("Security Authenticator Name", 53, 68),
            ("Security Key Name", 69, 80),
        ],
        "61" => vec![
            ("Auxiliary On-Us", 3, 17),
            ("External Processing Code", 18, 18),
            ("Posting Bank Routing Number", 19, 27),
            ("On-Us", 28, 47),
            ("Amount", 48, 61),
            ("ECE Institution Item Sequence Number", 62, 76),
            ("Documentation Type Indicator", 77, 78),
            ("Account Type Code", 79, 80),
        ],
        "62" => vec![
            ("Credit Addendum A Record Number", 3, 4),
            ("BOFD Routing Number", 5, 13),
            ("BOFD Business Date", 14, 21),
            ("BOFD Item Sequence Number", 22, 36),
            ("Deposit Account Number At BOFD", 37, 54),
            ("BOFD Deposit Branch", 55, 59),
            ("Payee Name", 60, 74),
            ("Truncation Indicator", 75, 75),
            ("BOFD Conversion Indicator", 76, 76),
            ("Reserved", 77, 80),
        ],
        "70" => vec![
            ("Items Within Bundle Count", 3, 6),
            ("Bundle Total Amount", 7, 18),
            ("MICR Valid Total Amount", 19, 30),
            ("Images Within Bundle Count", 31, 35),
            ("User Field", 36, 55),
            ("Reserved", 56, 80),
        ],
        "90" => vec![
            ("Bundle Count", 3, 8),
            ("Items Within Cash Letter Count", 9, 16),
            ("Cash Letter Total Amount", 17, 30),
            ("Images Within Cash Letter Count", 31, 39),
            ("ECE Institution Name", 40, 57),
            ("Settlement Date", 58, 65),
            ("Reserved", 66, 80),
        ],
        "99" => vec![
            ("Cash Letter Count", 3, 8),
            ("Total Record Count", 9, 16),
            ("Total Item Count", 17, 24),
            ("File Total Amount", 25, 40),
            ("Immediate Origin Contact Name", 41, 54),
            ("Immediate Origin Contact Phone Number", 55, 64),
            ("Reserved", 65, 80),
        ],
        _ => generic_schema(),
    };

    for (name, start, end) in schema {
        fields.push(field(raw, name, start, end));
    }

    fields
}

fn generic_schema() -> Vec<(&'static str, usize, usize)> {
    vec![
        ("Data Segment 01", 3, 12),
        ("Data Segment 02", 13, 22),
        ("Data Segment 03", 23, 32),
        ("Data Segment 04", 33, 42),
        ("Data Segment 05", 43, 52),
        ("Data Segment 06", 53, 62),
        ("Data Segment 07", 63, 72),
        ("Data Segment 08", 73, 80),
    ]
}

fn field(raw: &str, name: &str, start: usize, end: usize) -> RecordField {
    RecordField {
        name: name.to_string(),
        start,
        end,
        value: slice_position(raw, start, end),
    }
}

fn slice_position(raw: &str, start: usize, end: usize) -> String {
    let start_index = start.saturating_sub(1);
    if start_index >= end {
        return String::new();
    }

    let width = end.saturating_sub(start_index);
    raw.chars()
        .skip(start_index)
        .take(width)
        .collect::<String>()
        .trim_end()
        .to_string()
}
