use crate::parser::x937;

#[tauri::command]
pub fn parse_x937_file(file_path: String) -> Result<x937::ParsedFile, String> {
    x937::parse_file(&file_path)
}

#[tauri::command]
pub fn get_record_image(
    file_path: String,
    record_index: usize,
) -> Result<Option<x937::RecordImage>, String> {
    x937::get_record_image(&file_path, record_index)
}
