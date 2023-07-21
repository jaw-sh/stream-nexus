use askama::Template;
use serde::{Serialize, Deserialize};
use uuid::Uuid;
use actix::prelude::Message as ActixMessage;


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
    pub sent_at: i64, // Display timestamp
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

impl Message {
    pub fn to_console_msg(&self) -> String {
        format!("[{}] {}: {}", self.platform, self.username, self.message)
    }

    pub fn to_html(&self) -> String {
        MessageTemplate { message: &self }.render().expect("Failed to render chat message.")
    }    
}