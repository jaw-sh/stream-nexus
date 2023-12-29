use actix::{Actor, Context, Handler, MessageResult, Recipient};
use std::collections::HashMap;
use uuid::Uuid;

use super::message;
use crate::exchange::ExchangeRates;
use crate::message::Message as ChatMessage;

pub struct Connection {
    pub id: usize,
    pub recipient: Recipient<message::Reply>,
}

/// Define HTTP actor
pub struct ChatServer {
    pub clients: HashMap<usize, Connection>,
    pub chat_messages: HashMap<Uuid, ChatMessage>,
    pub paid_messages: Vec<Uuid>,
    pub last_message: Option<Uuid>,
    pub exchange_rates: ExchangeRates,
}

impl ChatServer {
    pub fn new(exchange_rates: ExchangeRates) -> Self {
        log::info!("Chat actor starting up.");

        Self {
            clients: HashMap::with_capacity(100),
            chat_messages: HashMap::with_capacity(100),
            paid_messages: Vec::with_capacity(100),
            last_message: None,
            exchange_rates,
        }
    }

    // Check if msg is a duplicate of the previous message.
    fn is_duplicate(&self, msg: &ChatMessage) -> bool {
        if self.last_message.is_none() {
            return false;
        }

        let lm = self.chat_messages.get(&self.last_message.unwrap()).unwrap();
        lm.username == msg.username && lm.message == msg.message
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

    fn handle(&mut self, msg: message::Content, _: &mut Context<Self>) -> Self::Result {
        let mut chat_msg = msg.chat_message;

        // Filter out contiguous duplicate messages to limit spam.
        // Don't filter paid chat messages. Checking this first for efficiency.
        if !chat_msg.is_premium() && self.is_duplicate(&chat_msg) {
            log::info!("Filtering message {}", chat_msg.to_console_msg());
            return;
        }

        log::debug!("[ChatServer] {}", chat_msg.to_console_msg());

        let usd = self
            .exchange_rates
            .get_usd(&chat_msg.currency, &chat_msg.amount);

        let id = chat_msg.id.to_owned();
        chat_msg.amount = usd;
        chat_msg.currency = "USD".to_string();

        // Send message to all clients.
        for (_, conn) in &self.clients {
            conn.recipient.do_send(message::Reply(chat_msg.to_json()));
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
        } else {
            // Only backup free messages for spam filtering.
            self.last_message = Some(id);
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
