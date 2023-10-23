extern crate dotenvy;
extern crate reqwest;
extern crate serde;
extern crate serde_json;

mod exchange;
mod message;
mod web;

use crate::web::ChatServer;

use actix::Actor;
use actix_web::{App, HttpServer};
use anyhow::Result;
use std::fs;

#[actix_web::main]
async fn main() -> Result<(), std::io::Error> {
    match dotenvy::dotenv() {
        Ok(_) => {}
        Err(_) => {
            fs::copy(".env.default", ".env")?;
            // Try again now that it exists.
            dotenvy::dotenv().expect("Failed to create .env file.");
        }
    }
    env_logger::init();

    let chat = ChatServer::new(
        exchange::fetch_exchange_rates()
            .await
            .expect("Failed to fetch exchange rates."),
    )
    .start();
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
