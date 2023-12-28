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

/// Request for recent chat messages.
pub struct RecentMessages;

impl Message for RecentMessages {
    type Result = Vec<ChatMessage>;
}

/// Request for paid messages.
pub struct PaidMessages;

impl Message for PaidMessages {
    type Result = Vec<ChatMessage>;
}
