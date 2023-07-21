use actix::{Actor, Context, Handler, Recipient};
use std::collections::HashMap;

use super::message;

pub struct Connection {
    pub id: usize,
    pub recipient: Recipient<message::Reply>,
}

/// Define HTTP actor
pub struct ChatServer {
    pub clients: HashMap<usize, Connection>
}

impl ChatServer {
    pub fn new() -> Self {
        log::info!("Chat actor starting up.");
        
        Self {
            clients: HashMap::new(),
        }
    }
}

// conn.recipient.do_send(message::Reply(message.to_owned()));

/// Make actor from `ChatServer`
impl Actor for ChatServer {
    /// We are going to use simple Context, we just need ability to communicate with other actors.
    type Context = Context<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        ctx.set_mailbox_capacity(32);
    }
}

/// Handler for Connect message.
impl Handler<message::Connect> for ChatServer {
    type Result = usize;

    fn handle(&mut self, msg: message::Connect, _: &mut Context<Self>) -> Self::Result {
        log::debug!("New client connected to chat.");
        // random usize
        let id: usize = rand::random();
        self.clients.insert(id, Connection {
            id,
            recipient: msg.recipient
        });
        id
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

/// Handler for a new Chat Message from the browser.
impl Handler<message::Content> for ChatServer {
    type Result = ();

    fn handle(&mut self, msg: message::Content, _: &mut Context<Self>) -> Self::Result {
        log::debug!("[ChatServer] {}", msg.chat_message.to_console_msg());
        // Send message to all clients.
        for (_, conn) in &self.clients {
            conn.recipient.do_send(message::Reply(msg.chat_message.to_html()));
        }
    }
}