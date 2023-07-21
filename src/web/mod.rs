mod client;
mod server;
mod message;

pub use client::ChatClient;
pub use server::ChatServer;
pub use message::Content as ChatMessage;

use actix::Addr;
use actix_web::{web, Error, Responder, HttpRequest, HttpResponse, http::header};
use actix_web_actors::ws;
use askama_actix::Template;
use std::time::{Duration, Instant};

const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(1);
const CLIENT_TIMEOUT: Duration = Duration::from_secs(5);

#[derive(Template)]
#[template(path = "index.html")]
struct IndexTemplate {}

#[actix_web::get("/")]
pub async fn index() -> impl Responder {
    IndexTemplate {}
}

#[actix_web::get("/script.js")]
pub async fn javascript() -> impl Responder {
    HttpResponse::Ok()
        .append_header((header::CONTENT_TYPE, "text/javascript"))
        .body(std::fs::read_to_string("public/script.js").unwrap())
}

#[actix_web::get("/style.css")]
pub async fn stylesheet() -> impl Responder {
    HttpResponse::Ok()
        .append_header((header::CONTENT_TYPE, "text/css"))
        .body(std::fs::read_to_string("public/style.css").unwrap())
}

#[actix_web::get("/chat.ws")]
async fn websocket(req: HttpRequest, stream: web::Payload) -> Result<HttpResponse, Error> {
    let server = req
        .app_data::<Addr<ChatServer>>()
        .expect("ChatServer missing in app data!")
        .clone();
    let client = ChatClient {
        id: rand::random(),
        server,
        last_heartbeat_at: Instant::now(),
        last_command_at: Instant::now(),
    };

    let resp = ws::start(client, &req, stream);
    println!("{:?}", resp);
    resp
}