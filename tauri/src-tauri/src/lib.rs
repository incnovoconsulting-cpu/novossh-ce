mod ssh;
mod ssh_config;
mod sftp;
mod port_forward;
mod session_store;

use ssh::session::SshManager;
use port_forward::PortForwardManager;
use tauri::Emitter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(SshManager::new())
        .manage(PortForwardManager::new())
        .invoke_handler(tauri::generate_handler![
            // SSH
            ssh::session::ssh_connect,
            ssh::session::ssh_execute,
            ssh::session::ssh_disconnect,
            ssh::session::ssh_list_sessions,
            ssh::session::ssh_open_shell,
            ssh::session::ssh_read_output,
            ssh::session::ssh_write_input,
            ssh::session::ssh_resize,
            // SSH Config
            ssh_config::ssh_config_parse,
            ssh_config::ssh_config_resolve,
            // SFTP
            sftp::sftp_list,
            sftp::sftp_download,
            sftp::sftp_upload,
            sftp::sftp_mkdir,
            sftp::sftp_delete,
            sftp::sftp_rename,
            // Port Forwarding
            port_forward::port_forward_local,
            port_forward::port_forward_remote,
            port_forward::port_forward_dynamic,
            port_forward::port_forward_stop,
            port_forward::port_forward_list,
            // Session Store
            session_store::session_store_list,
            session_store::session_store_add,
            session_store::session_store_remove,
        ])
        .setup(|app| {
            // Setup system tray
            #[cfg(desktop)]
            {
                use tauri::Manager;
                use tauri::tray::TrayIconBuilder;

                let _tray = TrayIconBuilder::new()
                    .tooltip("NovoSSH")
                    .build(app)?;
            }

            // Register global shortcuts
            #[cfg(desktop)]
            {
                use tauri::Manager;
                use tauri_plugin_global_shortcut::GlobalShortcutExt;

                let app_handle = app.handle().clone();

                // Ctrl+Shift+N: New terminal tab
                let handle_n = app.handle().clone();
                app.global_shortcut().on_shortcut("ctrl+shift+n", move |_app, _shortcut, _event| {
                    if let Some(window) = handle_n.get_webview_window("main") {
                        let _ = window.emit("global-shortcut", "new-tab");
                    }
                })?;

                // Ctrl+Shift+T: New terminal tab (alternative)
                let handle_t = app.handle().clone();
                app.global_shortcut().on_shortcut("ctrl+shift+t", move |_app, _shortcut, _event| {
                    if let Some(window) = handle_t.get_webview_window("main") {
                        let _ = window.emit("global-shortcut", "new-tab");
                    }
                })?;

                // Ctrl+Shift+H: Quick host connect
                let handle_h = app.handle().clone();
                app.global_shortcut().on_shortcut("ctrl+shift+h", move |_app, _shortcut, _event| {
                    if let Some(window) = handle_h.get_webview_window("main") {
                        let _ = window.emit("global-shortcut", "quick-connect");
                    }
                })?;

                // Ctrl+Shift+S: Open SFTP browser
                let handle_s = app.handle().clone();
                app.global_shortcut().on_shortcut("ctrl+shift+s", move |_app, _shortcut, _event| {
                    if let Some(window) = handle_s.get_webview_window("main") {
                        let _ = window.emit("global-shortcut", "open-sftp");
                    }
                })?;
            }

            // Check for updates on startup
            #[cfg(desktop)]
            {
                use tauri::Manager;
                use tauri_plugin_updater::UpdaterExt;

                let app_handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    if let Ok(updater) = app_handle.updater() {
                        if let Ok(Some(update)) = updater.check().await {
                            let _ = update.download_and_install(|_content_length, _downloaded| {}, || {}).await;
                        }
                    }
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
