use tauri::Manager;

/// 번들된 읽기 전용 SQLite 데이터베이스를 앱 데이터 디렉터리로 복사하고
/// `tauri-plugin-sql`이 열 수 있는 절대 경로를 반환한다.
///
/// 앱 실행 중 외부 네트워크를 호출하지 않으며, 리소스에 포함된 파일만 사용한다.
#[tauri::command]
fn resolve_database_path(app: tauri::AppHandle) -> Result<String, String> {
    let resource_path = app
        .path()
        .resolve("data/korsub.sqlite3", tauri::path::BaseDirectory::Resource)
        .map_err(|e| format!("리소스 경로를 찾을 수 없습니다: {e}"))?;

    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("앱 데이터 디렉터리를 찾을 수 없습니다: {e}"))?;

    std::fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("앱 데이터 디렉터리 생성 실패: {e}"))?;

    let dest_path = app_data_dir.join("korsub.sqlite3");

    // 매 실행마다 번들 리소스로 갱신한다 (읽기 전용 참조 데이터이므로
    // 사용자가 만든 데이터를 덮어쓸 위험이 없다).
    std::fs::copy(&resource_path, &dest_path)
        .map_err(|e| format!("데이터베이스 복사 실패: {e}"))?;

    dest_path
        .to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "데이터베이스 경로를 문자열로 변환할 수 없습니다".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .invoke_handler(tauri::generate_handler![resolve_database_path])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
