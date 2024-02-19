use actix::{Actor, Context, Handler, MessageResult, Recipient};
use std::collections::HashMap;
use uuid::Uuid;

use super::message;
use crate::exchange::ExchangeRates;
use crate::message::Message as ChatMessage;
use ammonia::clean;

pub struct Connection {
    pub id: usize,
    pub recipient: Recipient<message::Reply>,
}

/// Define HTTP actor
pub struct ChatServer {
    pub chat_messages: HashMap<Uuid, ChatMessage>,
    pub clients: HashMap<usize, Connection>,
    pub exchange_rates: ExchangeRates,
    pub paid_messages: Vec<Uuid>,
    pub platforms: HashMap<String, Uuid>,
    pub viewer_counts: HashMap<String, usize>,
}

impl ChatServer {
    pub fn new(exchange_rates: ExchangeRates) -> Self {
        log::info!("Chat actor starting up.");

        Self {
            clients: HashMap::with_capacity(100),
            chat_messages: HashMap::with_capacity(100),
            paid_messages: Vec::with_capacity(100),
            exchange_rates,
            platforms: HashMap::from([
                (
                    "Kick".to_string(),
                    Uuid::from_u128(0x6efe7271da754c2f93fcddf37d02b8a9u128),
                ),
                (
                    "Odysee".to_string(),
                    Uuid::from_u128(0xd80f03bfd30a48e99e9f81616366eefdu128),
                ),
                (
                    "Rumble".to_string(),
                    Uuid::from_u128(0x5ceefcfb4aa5443abea61f8590231471u128),
                ),
                (
                    "Twitch".to_string(),
                    Uuid::from_u128(0x4a342b79e302403a99be669b5f27b152u128),
                ),
                (
                    "X".to_string(),
                    Uuid::from_u128(0x0abb36b843ab40b5be614f2c32a75890u128),
                ),
                (
                    "YouTube".to_string(),
                    Uuid::from_u128(0xfd60ac36d6b549dcaee6b0d87d130582u128),
                ),
            ]),
            viewer_counts: HashMap::with_capacity(100),
        }
    }
}

// conn.recipient.do_send(message::Reply(message.to_owned()));

/// Make actor from `ChatServer`
impl Actor for ChatServer {
    /// We are going to use simple Context, we just need ability to communicate with other actors.
    type Context = Context<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        ctx.set_mailbox_capacity(256);
    }
}

/// Handler for Connect message.
impl Handler<message::Connect> for ChatServer {
    type Result = usize;

    fn handle(&mut self, msg: message::Connect, _: &mut Context<Self>) -> Self::Result {
        log::debug!("New client connected to chat.");
        // random usize
        let id: usize = rand::random();
        self.clients.insert(
            id,
            Connection {
                id,
                recipient: msg.recipient,
            },
        );
        id
    }
}

/// Handler for a new Chat Message from the browser.
impl Handler<message::Content> for ChatServer {
    type Result = ();

    fn handle(&mut self, mut msg: message::Content, _: &mut Context<Self>) -> Self::Result {
        log::debug!("[ChatServer] {}", msg.chat_message.to_console_msg());

        let usd = self
            .exchange_rates
            .get_usd(&msg.chat_message.currency, &msg.chat_message.amount);

        msg.chat_message.message = clean(&msg.chat_message.message);

        let mut chat_msg = msg.chat_message;

        // Check if the userscript failed to generate a UUID.
        if chat_msg.id.is_nil() {
            log::debug!(
                "[ChatServer] Found nil UUID for message: {}",
                chat_msg.to_console_msg()
            );
            chat_msg.id = Uuid::new_v5(
                &self.platforms[&chat_msg.platform],
                chat_msg.message.as_bytes(),
            );
        }
        let id = chat_msg.id.to_owned();

        chat_msg.amount = usd;
        chat_msg.currency = "USD".to_string();

        // Send message to all clients.
        for (_, conn) in &self.clients {
            conn.recipient.do_send(message::Reply(
                serde_json::to_string(&message::ReplyInner {
                    tag: "chat_message".to_owned(),
                    message: chat_msg.to_json(),
                })
                .expect("Failed to serialize chat message reply_inner."),
            ));
        }

        if self.chat_messages.len() >= self.chat_messages.capacity() - 1 {
            self.chat_messages.reserve(100);
        }
        self.chat_messages.insert(id.to_owned(), chat_msg);

        // Backup premium chats to a vector.
        // Performed at the end to avoid having to copy.
        if usd > 0.0 {
            if self.paid_messages.len() >= self.paid_messages.capacity() - 1 {
                self.paid_messages.reserve(100);
            }
            self.paid_messages.push(id);
        }
    }
}

/// Handler for Disconnect message.
impl Handler<message::Disconnect> for ChatServer {
    type Result = ();

    fn handle(&mut self, msg: message::Disconnect, _: &mut Context<Self>) {
        // Remove Client from HashMap.
        self.clients.remove(&msg.id);
    }
}

/// Handler for recent chat messages.
impl<'a> Handler<message::RecentMessages> for ChatServer {
    type Result = MessageResult<message::RecentMessages>;

    fn handle(&mut self, _: message::RecentMessages, _: &mut Context<Self>) -> Self::Result {
        const MAX_MESSAGES: usize = 100;

        let mut last_messages: Vec<ChatMessage> = if self.chat_messages.len() >= MAX_MESSAGES {
            self.chat_messages
                .keys()
                .cloned()
                .skip(self.chat_messages.len() - MAX_MESSAGES)
                .filter_map(|id| self.chat_messages.get(&id).cloned())
                .collect()
        } else {
            self.chat_messages.values().cloned().collect()
        };
        last_messages.sort_by_key(|msg| msg.received_at);

        log::debug!("Sending {} recent messages.", last_messages.len());
        MessageResult(last_messages)
    }
}

/// Handler for all stored Superchats.
impl<'a> Handler<message::PaidMessages> for ChatServer {
    type Result = MessageResult<message::PaidMessages>;

    fn handle(&mut self, _: message::PaidMessages, _: &mut Context<Self>) -> Self::Result {
        let mut super_chats: Vec<ChatMessage> = self
            .paid_messages
            .iter()
            .filter_map(|id| self.chat_messages.get(id).cloned())
            .collect();
        super_chats.sort_by_key(|msg| msg.received_at);
        log::debug!("Sending {} superchats.", super_chats.len());
        MessageResult(super_chats)
    }
}

/// Handler for viewer counts.
impl Handler<message::ViewCount> for ChatServer {
    type Result = ();

    fn handle(&mut self, viewers: message::ViewCount, _: &mut Context<Self>) -> Self::Result {
        if let Some(old) = self.viewer_counts.insert(viewers.platform, viewers.viewers) {
            if old == viewers.viewers {
                return;
            }
        }

        for (_, conn) in &self.clients {
            let new_viewers = self.viewer_counts.clone();
            conn.recipient.do_send(message::Reply(
                serde_json::to_string(&message::ReplyInner {
                    tag: "viewers".to_owned(),
                    message: serde_json::to_string(&new_viewers)
                        .expect("Failed to serialize viewers."),
                })
                .expect("Failed to serialize viewers replyinner"),
            ));
        }
    }
}
