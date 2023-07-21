
use anyhow::Result;
use headless_chrome::Tab;
use std::sync::Arc;

use crate::feed::Feeder;

pub struct RumbleFeeder {

}

impl Feeder for RumbleFeeder {
    fn inject_scripts(&self, tab: Arc<Tab>) -> Result<()> {
        tab.evaluate(&self.get_js("rumble")?, false)?;
        Ok(())
    }

    fn prepare(&self, tab: Arc<Tab>) -> Result<()> {
        log::debug!("Searching for likes bar to get video id");
        let likes_el = tab.wait_for_element(".rumbles-vote")?;
        let mut video_id: i64 = 0;
    
        // Attributes and values are itemized in a basic vec.
        if let Some(attrs) = likes_el.get_attributes()? {
            let mut anticipate_video_id = false;
            for attr in attrs {
                if anticipate_video_id {
                    video_id = attr.parse::<i64>()?;
                    break;
                }
                else if attr == "data-id" {
                    anticipate_video_id = true;
                }
            }
        }
    
        if video_id == 0 {
            log::warn!("Rumble video ID not found");
            anyhow::bail!("Could not find video ID");
        }
    
        log::debug!("Switching to Rumble Live Chat");
        tab.navigate_to(format!("https://rumble.com/chat/popup/{}", video_id).as_str())?.wait_until_navigated()?;

        Ok(())
    }
}