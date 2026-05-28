use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct ButtonLayout {
    pub left: Vec<String>,
    pub right: Vec<String>,
    pub style: String, // "macos" | "windows" | "gnome" | "default"
}

fn parse_gnome_layout(value: &str) -> ButtonLayout {
    // Format examples:
    //   "appmenu:minimize,maximize,close"      → buttons on right
    //   "close,minimize,maximize:appmenu"      → buttons on left
    //   "close,minimize,maximize:"             → all on left
    //   ":minimize,maximize,close"             → all on right
    let trimmed = value.trim().trim_matches(|c| c == '\'' || c == '"');
    let (left_str, right_str) = trimmed.split_once(':').unwrap_or(("", trimmed));
    let parse = |s: &str| -> Vec<String> {
        s.split(',')
            .filter_map(|p| {
                let p = p.trim();
                match p {
                    "close" | "minimize" | "maximize" => Some(p.to_string()),
                    _ => None,
                }
            })
            .collect()
    };
    ButtonLayout {
        left: parse(left_str),
        right: parse(right_str),
        style: "gnome".into(),
    }
}

fn read_gnome_layout() -> Option<ButtonLayout> {
    let out = std::process::Command::new("gsettings")
        .args([
            "get",
            "org.gnome.desktop.wm.preferences",
            "button-layout",
        ])
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let value = String::from_utf8(out.stdout).ok()?;
    let layout = parse_gnome_layout(&value);
    if layout.left.is_empty() && layout.right.is_empty() {
        return None;
    }
    Some(layout)
}

#[tauri::command]
pub fn get_window_button_layout() -> ButtonLayout {
    #[cfg(target_os = "macos")]
    {
        return ButtonLayout {
            left: vec![
                "close".into(),
                "minimize".into(),
                "maximize".into(),
            ],
            right: vec![],
            style: "macos".into(),
        };
    }
    #[cfg(target_os = "windows")]
    {
        return ButtonLayout {
            left: vec![],
            right: vec![
                "minimize".into(),
                "maximize".into(),
                "close".into(),
            ],
            style: "windows".into(),
        };
    }
    #[cfg(target_os = "linux")]
    {
        if let Some(layout) = read_gnome_layout() {
            return layout;
        }
    }
    ButtonLayout {
        left: vec![],
        right: vec![
            "minimize".into(),
            "maximize".into(),
            "close".into(),
        ],
        style: "default".into(),
    }
}
