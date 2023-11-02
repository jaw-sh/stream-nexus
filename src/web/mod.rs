mod client;
mod message;
mod server;

pub use client::ChatClient;
pub use message::Content as ChatMessage;
pub use message::GetDashboardData;
pub use server::ChatServer;

use actix::Addr;
use actix_web::{http::header, web, Error, HttpRequest, HttpResponse, Responder};
use actix_web_actors::ws;
use askama_actix::Template;
use std::time::{Duration, Instant};

const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(1);
const CLIENT_TIMEOUT: Duration = Duration::from_secs(5);

#[derive(Template)]
#[template(path = "index.html")]
struct IndexTemplate {}

#[derive(Template)]
#[template(path = "dashboard.html")]
struct DashboardTemplate {
    super_chats: String,
}

#[actix_web::get("/")]
pub async fn index() -> impl Responder {
    IndexTemplate {}
}

#[actix_web::get("/dashboard")]
pub async fn dashboard(req: HttpRequest) -> impl Responder {
    let chat_server = req
        .app_data::<Addr<ChatServer>>()
        .expect("ChatServer missing in app data!")
        .clone();

    let chat_data = chat_server.send(message::GetDashboardData).await.unwrap();

    let mut super_chats = String::new();
    for msg in chat_data.super_chats.iter() {
        super_chats.push_str(&msg.to_html());
    }
    DashboardTemplate { super_chats }
}

#[actix_web::get("/dashboard.js")]
pub async fn dashboard_javascript() -> impl Responder {
    HttpResponse::Ok()
        .append_header((header::CONTENT_TYPE, "text/javascript"))
        .body(std::fs::read_to_string("public/dashboard.js").unwrap())
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

#[actix_web::get("/dashboard.css")]
pub async fn dashboard_stylesheet() -> impl Responder {
    HttpResponse::Ok()
        .append_header((header::CONTENT_TYPE, "text/css"))
        .body(std::fs::read_to_string("public/dashboard.css").unwrap())
}

#[actix_web::get("/user-colors.css")]
pub async fn colors() -> impl Responder {
    HttpResponse::Ok()
        .append_header((header::CONTENT_TYPE, "text/css"))
        .body(std::fs::read_to_string("public/user-colors.css").unwrap())
}

#[actix_web::get("/logo/{platform}.svg")]
pub async fn logo(path: web::Path<String>) -> impl Responder {
    let path = format!("public/logo/{}.svg", path.to_owned());
    match std::fs::read_to_string(&path) {
        Ok(svg) => HttpResponse::Ok()
            .append_header((header::CONTENT_TYPE, "image/svg+xml"))
            .body(svg),
        Err(_) => HttpResponse::NotFound().body("Not found"),
    }
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
