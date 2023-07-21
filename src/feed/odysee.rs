
use anyhow::Result;
use headless_chrome::Tab;
use std::sync::Arc;

use crate::feed::Feeder;

pub struct OdyseeFeeder { }

impl Feeder for OdyseeFeeder {
    fn inject_scripts(&self, tab: Arc<Tab>) -> Result<()> {
        tab.evaluate(&self.get_js("odysee")?, false)?;
        Ok(())
    }
}