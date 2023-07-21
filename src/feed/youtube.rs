use std::sync::Arc;
use anyhow::Result;
use headless_chrome::Tab;

use crate::feed::Feeder;

pub struct YouTubeFeeder {

}

impl Feeder for YouTubeFeeder {
    fn inject_scripts(&self, tab: Arc<Tab>) -> Result<()> {
        tab.evaluate(&self.get_js("youtube")?, false)?;
        Ok(())
    }

    fn prepare(&self, tab: Arc<Tab>) -> Result<()> {
        // Accept YouTube Terms of Service
        // No ToS on live chat window??
        // info!("Anticipating Google Terms of Service...");
        // if let Ok(el) = tab.wait_for_element("button[aria-label='Accept all']") {
        //     debug!("Accepting Terms of Service");
        //     el.click()?;
        // }
    
        // Check for YouTube Live Chat's Live / Top Selector
        // This will indicate we've opened the live chat.
        log::debug!("Opening Live Chat mode selector");
        if let Ok(el) = tab.wait_for_element(".yt-dropdown-menu[role='group']") {
            log::debug!("Live Chat mode selector found");
            el.click()?;
            
            log::debug!("Selecting realtime chat mode");
            let chat_modes = tab.wait_for_elements(".yt-simple-endpoint.yt-dropdown-menu")?;
            chat_modes[1].click()?;
        }
        else {
            log::debug!("Could not switch off Top Chat. Cringe!");
        }
    
        Ok(())
    }
}