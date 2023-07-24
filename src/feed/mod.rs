mod odysee;
mod rumble;
mod youtube;

pub use odysee::OdyseeFeeder;
pub use rumble::RumbleFeeder;
pub use youtube::YouTubeFeeder;

use crate::message::Message;

use anyhow::Result;
use headless_chrome::{Browser, Tab};
use std::sync::Arc;

pub struct Feed {
    pub url: String, // User-supplied URL.
    pub browser: Browser,
    pub tab: Arc<Tab>,
    pub feeder: Box<dyn Feeder>,
    pub last_message_time: i64,
}

impl Feed {
    pub fn set_last_message_time_from_messages(&mut self, messages: &Vec<Message>) -> Result<()> {
        if messages.len() == 0 {
            return Ok(());
        }

        for message in messages {
            if message.received_at > self.last_message_time {
                self.last_message_time = message.received_at;
            }
        }

        self.tab
            .set_storage("SNEED_MESSAGES_READ_AT", self.last_message_time)?;
        Ok(())
    }
}

pub trait Feeder {
    fn open_url(&self, tab: Arc<Tab>, url: &str) -> Result<()> {
        tab.navigate_to(url)?.wait_until_navigated()?;
        Ok(())
    }

    fn prepare(&self, _tab: Arc<Tab>) -> Result<()> {
        Ok(())
    }

    fn inject_scripts(&self, tab: Arc<Tab>) -> Result<()>;

    fn get_messages(&self, feed: &Feed, tab: Arc<Tab>) -> Result<Vec<Message>> {
        let last_set_time: i64 = match tab.get_storage("SNEED_MESSAGES_LAST_SET") {
            Ok(last_set_time) => last_set_time,
            Err(err) => {
                log::error!("[{}] Could not get last set time: {}", feed.url, err);
                return Err(err);
            }
        };
        if last_set_time <= feed.last_message_time {
            return Ok(Vec::new());
        }

        let message_json: String = match tab.get_storage("SNEED_CHAT_MESSAGES") {
            Ok(message_json) => message_json,
            Err(err) => {
                log::error!("[{}] Could not get message json: {}", feed.url, err);
                return Err(err);
            }
        };
        let messages: Vec<Message> = match serde_json::from_str(&message_json) {
            Ok(messages) => messages,
            Err(err) => {
                log::error!("Could not deserialize messages: {}", err);
                Vec::new()
            }
        };

        //for message in &messages {
        //    log::info!("{}", message.to_console_msg());
        //}

        Ok(messages)
    }

    fn get_js(&self, feed: &str) -> Result<String> {
        let feed_js = std::fs::read_to_string(format!("js/feed/{}.js", feed))?;
        let obs_js = std::fs::read_to_string("js/observer.js")?;
        Ok(format!("{}{}", feed_js, obs_js))
    }
}
