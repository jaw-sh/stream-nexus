use crate::message::Message as ChatMessage;
use actix::{Message, Recipient};

/// Client hello message.
pub struct Connect {
    pub recipient: Recipient<Reply>,
}

impl Message for Connect {
    type Result = usize;
}

/// Announce disconnect
pub struct Disconnect {
    pub id: usize,
}

impl Message for Disconnect {
    type Result = ();
}

/// Server response to clients listening to the WebSocket.
/// Usually a serialized JSON string.
pub struct Reply(pub String);

impl Message for Reply {
    type Result = ();
}

/// Content message.
pub struct Content {
    pub chat_message: ChatMessage,
}

impl Message for Content {
    type Result = ();
}

/// For rendering the dashboard
pub struct GetDashboardData;

pub struct DashboardData {
    pub super_chats: Vec<ChatMessage>,
}

impl Message for GetDashboardData {
    type Result = DashboardData;
}
