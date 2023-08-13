extern crate dotenvy;

mod feed;
mod message;
mod web;

use actix::{Actor, Addr};
use actix_web::{rt, App, HttpServer};
use anyhow::{Error, Result};
use headless_chrome::{Browser, LaunchOptions};

use crate::feed::Feed;
use crate::web::{ChatMessage, ChatServer};

#[actix_web::main]
async fn main() -> Result<(), std::io::Error> {
    dotenvy::dotenv().expect("Could not load .env file");
    env_logger::init();

    let chat = ChatServer::new().start();
    let chat_for_server = chat.clone();

    HttpServer::new(move || {
        App::new()
            .app_data(chat_for_server.clone())
            .service(web::javascript)
            .service(web::stylesheet)
            .service(web::colors)
            .service(web::index)
            .service(web::websocket)
            .service(web::logo)
    })
    .workers(1)
    .bind(("127.0.0.1", 1350))
    .expect("Could not bind requested address.")
    .run()
    .await
}

async fn get_messages(mut feed: Feed, chat: Addr<ChatServer>) -> Result<Feed, Error> {
    let messages = match feed.feeder.get_messages(&feed, feed.tab.clone()) {
        Ok(messages) => messages,
        Err(err) => {
            log::error!("Could not get messages from feed: {}", err);
            return Err(err);
        }
    };
    if let Err(err) = feed.set_last_message_time_from_messages(&messages) {
        log::error!("Could not set last message time from messages: {}", err);
    }

    for message in messages {
        if let Err(err) = chat
            .send(ChatMessage {
                chat_message: message,
            })
            .await
        {
            log::error!("Could not send message to chat server: {}", err);
        }
    }

    Ok(feed)
}

async fn start_browser() -> Result<Vec<Feed>, Error> {
    log::info!("Launching Browser for SNEEDing");

    let launch_options = || {
        LaunchOptions::default_builder()
            .headless(false)
            .window_size(Some((600, 600)))
            .path(Some(std::path::PathBuf::from("/usr/bin/brave")))
            .build()
    };

    //let browser = Browser::new(launch_options()?).expect("Browser did not launch.");
    //let odysee = Feed {
    //    url: "https://odysee.com/$/popout/@mati:c/2023-07-25-mad-at-the-internet:6".to_string(),
    //    tab: browser.new_tab()?,
    //    browser,
    //    feeder: Box::new(feed::OdyseeFeeder {}),
    //    last_message_time: 0,
    //};

    let browser = Browser::new(launch_options()?).expect("Browser did not launch.");
    let rumble = Feed {
        url: "https://rumble.com/v32xd2y-mad-at-the-internet-july-28th-2023.html".to_string(),
        tab: browser.new_tab()?,
        browser,
        feeder: Box::new(feed::RumbleFeeder {}),
        last_message_time: 0,
    };

    let browser = Browser::new(launch_options()?).expect("Browser did not launch.");
    let twitch = Feed {
        url: "https://www.twitch.tv/popout/nyanners/chat?popout=".to_string(),
        tab: browser.new_tab()?,
        browser,
        feeder: Box::new(feed::TwitchFeeder {}),
        last_message_time: 0,
    };

    let browser = Browser::new(launch_options()?).expect("Browser did not launch.");
    let youtube = Feed {
        url: "https://www.youtube.com/live_chat?is_popout=1&v=PXiD-LgI8zI".to_string(),
        tab: browser.new_tab()?,
        browser,
        feeder: Box::new(feed::YouTubeFeeder {}),
        last_message_time: 0,
    };

    let feeds = vec![rumble, youtube];
    let mut futs = Vec::new();

    for feed in feeds {
        futs.push(rt::spawn(async move {
            log::debug!("Navigating to stream.");
            feed.feeder
                .open_url(feed.tab.clone(), &feed.url)
                .expect("Could not open url.");
            log::debug!("Preparing page for reading.");
            feed.feeder
                .prepare(feed.tab.clone())
                .expect("Could not prepare page.");
            log::debug!("Injecting scripts.");
            feed.feeder
                .inject_scripts(feed.tab.clone())
                .expect("Could not inject scripts.");
            log::debug!("Setup complete.");

            feed
        }));
    }
    let feeders = futures::future::join_all(futs)
        .await
        .into_iter()
        .map(|f| f.expect("JoinHandle for Feeder failed."))
        .collect();

    Ok(feeders)
}
