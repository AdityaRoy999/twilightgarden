use enigo::{Enigo, Settings, Mouse, Keyboard, Coordinate, Direction, Button, Axis, Key};
use serde::Deserialize;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, State};
use tauri_plugin_dialog::{DialogExt, MessageDialogKind, MessageDialogButtons};
#[derive(Default)]
pub struct ControlState(pub Mutex<Option<Grant>>);
pub struct Grant { call: String, token: String, expires: Instant, last: Instant, input: Enigo }
#[derive(Deserialize)]
#[serde(tag="kind", rename_all="lowercase")]
pub enum Input { Move { x: f64, y: f64 }, Click { x: f64, y: f64 }, Scroll { delta: i32 }, Key { key: String }, Text { text: String } }

#[tauri::command]
pub async fn enable_remote_control(app: AppHandle, state: State<'_, ControlState>, call_id: String, token: String) -> Result<(), String> {
    if call_id.len() != 36 || token.len() != 36 { return Err("Invalid control session".into()); }
    // A remote signaling message cannot grant access: a native consent dialog is mandatory.
    let allowed = app.dialog().message("Allow your partner to use your mouse and keyboard for this screen share? Only share your primary display. Close private windows first. Control expires in five minutes; Stop control or ending the call revokes it immediately.")
        .title("Allow remote control?").kind(MessageDialogKind::Warning).buttons(MessageDialogButtons::OkCancel).blocking_show();
    if !allowed { return Err("Remote control was not approved".into()); }
    let input = Enigo::new(&Settings::default()).map_err(|_| "Allow input/accessibility access in your operating system settings.")?;
    *state.0.lock().map_err(|_| "Control session unavailable")? = Some(Grant { call: call_id, token, expires: Instant::now() + Duration::from_secs(300), last: Instant::now() - Duration::from_secs(1), input });
    Ok(())
}
#[tauri::command]
pub fn revoke_remote_control(state: State<'_, ControlState>) { if let Ok(mut value) = state.0.lock() { *value = None; } }
#[tauri::command]
pub fn apply_remote_input(app: AppHandle, state: State<'_, ControlState>, call_id: String, token: String, input: Input) -> Result<(), String> {
    let mut value = state.0.lock().map_err(|_| "Control session unavailable")?;
    let grant = value.as_mut().ok_or("Control is not approved")?;
    if Instant::now() > grant.expires { *value = None; return Err("Control permission expired".into()); }
    if grant.call != call_id || grant.token != token { return Err("Control session mismatch".into()); }
    // Only coalesce pointer motion. Dropping a click or keystroke after a move
    // makes control unreliable even when the encrypted messages arrive in order.
    if matches!(&input, Input::Move { .. }) && grant.last.elapsed() < Duration::from_millis(30) { return Ok(()); }
    grant.last = Instant::now();
    let click = matches!(&input, Input::Click { .. });
    let result = match input {
        Input::Move { x,y } | Input::Click { x,y } => {
            if !x.is_finite() || !y.is_finite() || !(0.0..=1.0).contains(&x) || !(0.0..=1.0).contains(&y) { return Err("Invalid pointer".into()); }
            let display = app.primary_monitor().map_err(|_| "Display unavailable")?.ok_or("Display unavailable")?;
            grant.input.move_mouse(display.position().x + (x * f64::from(display.size().width.saturating_sub(1))) as i32, display.position().y + (y * f64::from(display.size().height.saturating_sub(1))) as i32, Coordinate::Abs)
                .and_then(|_| if click { grant.input.button(Button::Left, Direction::Click) } else { Ok(()) })
        },
        Input::Scroll { delta } if delta.abs() <= 5 => grant.input.scroll(delta, Axis::Vertical),
        Input::Text { text } if text.chars().count() <= 32 && !text.chars().any(|c| c.is_control()) => grant.input.text(&text),
        Input::Key { key } => {
            let mapped = match key.as_str() { "Enter" => Key::Return, "Tab" => Key::Tab, "Backspace" => Key::Backspace, "ArrowLeft" => Key::LeftArrow, "ArrowRight" => Key::RightArrow, "ArrowUp" => Key::UpArrow, "ArrowDown" => Key::DownArrow, _ => return Err("Unsupported key".into()) };
            grant.input.key(mapped, Direction::Click)
        },
        _ => return Err("Invalid input".into())
    };
    result.map_err(|_| "Operating system rejected remote input".into())
}
