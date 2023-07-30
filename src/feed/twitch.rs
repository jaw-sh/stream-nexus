use anyhow::Result;
use headless_chrome::Tab;
use std::sync::Arc;

use crate::feed::Feeder;

pub struct TwitchFeeder {}

impl Feeder for TwitchFeeder {
    fn inject_scripts(&self, tab: Arc<Tab>) -> Result<()> {
        tab.evaluate(&self.get_js("twitch")?, false)?;
        Ok(())
    }
}
