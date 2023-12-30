mod exchange;
mod message;
mod sneed_env; // naming it "env" can be confusing.
mod web;

use actix::Actor;
use actix_web::{App, HttpServer};
use anyhow::Result;

#[actix_web::main]
async fn main() -> Result<(), std::io::Error> {
    sneed_env::get_env();
    env_logger::init();

    let rate_api_key =
        dotenvy::var("RATE_API_KEY").expect("Failed to fetch RATE_API_KEY from env.");
    // Print length instead of the key itself to confirm a proper read.
    // Current length of a valid free key is 32.
    log::debug!("Found API key of length {}", rate_api_key.len());

    let chat = web::ChatServer::new(
        exchange::fetch_exchange_rates(rate_api_key.as_str())
            .await
            .expect("Failed to fetch exchange rates."),
    )
    .start();
    let chat_for_server = chat.clone();

    HttpServer::new(move || {
        App::new()
            .app_data(chat_for_server.clone())
            .service(web::javascript)
            .service(web::dashboard_javascript)
            .service(web::stylesheet)
            .service(web::dashboard_stylesheet)
            .service(web::colors)
            .service(web::chat)
            .service(web::dashboard)
            .service(web::websocket)
            .service(web::logo)
    })
    .workers(1)
    .bind(format!(
        "{}:{}",
        dotenvy::var("SERVER_IP").expect("SERVER_IP not defined."),
        dotenvy::var("SERVER_PORT").expect("SERVER_PORT not defined.")
    ))
    .expect("Could not bind requested address.")
    .run()
    .await
}
