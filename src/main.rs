extern crate dotenvy;

mod feed;
mod message;
mod web;

use actix::{Actor, Addr};
use actix_web::dev::ServerHandle;
use actix_web::{rt, HttpServer, App};
use anyhow::{Error, Result};
use headless_chrome::{Browser, LaunchOptions};

use crate::feed::Feed;
use crate::web::{ChatClient, ChatServer, ChatMessage};

#[actix_web::main]
async fn main() -> Result<(), Error> {
    dotenvy::dotenv().expect("Could not load .env file");
    env_logger::init();

    let chat = ChatServer::new().start();
    let chat_for_server = chat.clone();

    let server = HttpServer::new(move || {
            App::new()
            .app_data(chat_for_server.clone())
            .service(web::javascript)
            .service(web::stylesheet)
            .service(web::index)
            .service(web::websocket)
        })
        .workers(1)
        .bind(("127.0.0.1", 1350))
        .expect("Could not bind requested address.")
        .run();
    let server_handle = server.handle();
    rt::spawn(server);

    let (browser, mut feeds) = start_browser().await?;

    // Open first tab
    //browser.get_tabs().lock().into_iter().next().unwrap().first_mut().unwrap().navigate_to("http://127.0.0.1:1350")?.bring_to_front()?;
    

    loop {
        for feed in &mut feeds {
            let messages  = feed.feeder.get_messages(feed, feed.tab.clone()).expect("Failed to fetch new messages.");
            feed.set_last_message_time_from_messages(&messages)?;

            for message in messages {
                if let Err(oops) = chat.send(ChatMessage {
                    chat_message: message,
                }).await {
                    log::error!("Could not send message to chat server: {}", oops);
                }
            }
        }

        tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
    }
}

async fn start_browser() -> Result<(Browser, Vec<Feed>), Error> {
    log::info!("Launching Browser for SNEEDing");

    let launch_options = LaunchOptions::default_builder()
        .headless(false)
        .window_size(Some((600, 600)))
        .path(Some(std::path::PathBuf::from("/usr/bin/brave")))
        .build()?;

    let browser = Browser::new(launch_options).expect("Browser did not launch.");
    log::debug!("Browser launched!");

    //let odysee = Feed {
    //    url: "https://odysee.com/$/popout/@mati:c/2023-july-21-mad-at-the-internet:7".to_string(),
    //    tab: browser.new_tab()?,
    //    feeder: Box::new(feed::OdyseeFeeder {}),
    //    last_message_time: 0,
    //};
    let rumble = Feed {
        url: "https://rumble.com/v3199xo-whos-here-tap-in.html".to_string(),
        tab: browser.new_tab()?,
        feeder: Box::new(feed::RumbleFeeder {}),
        last_message_time: 0,
    };
    let youtube = Feed {
        url: "https://www.youtube.com/live_chat?is_popout=1&v=LjIb9Wr-uxE".to_string(),
        tab: browser.new_tab()?,
        feeder: Box::new(feed::YouTubeFeeder {}),
        last_message_time: 0,
    };

    let feeds = vec![rumble, youtube];

    for feed in &feeds {
        log::debug!("Navigating to stream.");
        feed.feeder.open_url(feed.tab.clone(), &feed.url)?;
        log::debug!("Preparing page for reading.");
        feed.feeder.prepare(feed.tab.clone())?;
        log::debug!("Injecting scripts.");
        feed.feeder.inject_scripts(feed.tab.clone())?;
    }

    Ok((browser, feeds))
}