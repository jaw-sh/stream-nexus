use actix::prelude::Message as ActixMessage;
use askama::Template;
use serde::{Deserialize, Serialize};
use std::time::SystemTime;
use uuid::Uuid;

#[derive(Template)]
#[template(path = "message.html")]
struct MessageTemplate<'a> {
    message: &'a Message,
}

#[derive(Serialize, Deserialize, Debug, ActixMessage)]
#[rtype(result = "()")]
pub struct Message {
    pub id: Uuid,
    pub platform: String,
    pub message: String,
    pub sent_at: i64,     // Display timestamp
    pub received_at: i64, // Our system received timestamp
    pub username: String,
    pub avatar: String, // URL
    // Superchat
    pub is_premium: bool,
    pub amount: f64,
    pub currency: String,
    // Display
    pub is_verified: bool,
    pub is_sub: bool,
    pub is_mod: bool,
    pub is_owner: bool,
    pub is_staff: bool,
}

#[derive(Debug, Serialize)]
struct JsonWrapper<'a> {
    #[serde(flatten)]
    message: &'a Message,
    html: String,
}

impl Default for Message {
    fn default() -> Self {
        let time = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64;

        Message {
            id: Uuid::new_v4(),
            platform: "NONE".to_string(),
            message: "DEFAULT_MESSAGE".to_string(),
            sent_at: time,
            received_at: time,
            username: "NO_USERNAME".to_string(),
            avatar: "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="
                .to_string(),
            is_premium: false,
            amount: 0.0,
            currency: "ZWL".to_string(),
            is_verified: false,
            is_sub: false,
            is_mod: false,
            is_owner: false,
            is_staff: false,
        }
    }
}

impl Message {
    pub fn to_console_msg(&self) -> String {
        format!("[{}] {}: {}", self.platform, self.username, self.message)
    }

    pub fn to_html(&self) -> String {
        MessageTemplate { message: &self }
            .render()
            .expect("Failed to render chat message.")
    }

    pub fn to_json(&self) -> String {
        serde_json::to_string(&JsonWrapper {
            message: self,
            html: self.to_html(),
        })
        .expect("Failed to serialize chat message wrapper.")
    }
}
