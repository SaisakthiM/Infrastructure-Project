pub mod routes;
pub mod database;
use std::env;
pub mod configurations;
use tower_http::cors::{CorsLayer, AllowOrigin};
use axum::http::Method;

use axum::Router;
#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    let state = database::connect_db().await;
    database::init_database(&state.db)
        .await
        .expect("Failed to initialize database");

    // Add CORS layer
    let cors = CorsLayer::permissive();
    

    let app = Router::new()
        .merge(routes::home())
        .merge(routes::message())
        .merge(routes::user())
        .merge(routes::room())
        .merge(routes::joinRoom())
        .merge(routes::getMessage())
        .merge(routes::login())
        .merge(routes::ws())
        .merge(routes::room_routes())
        .merge(routes::media_routes())
        .with_state(state)
        .layer(cors); // Add this line

    println!("DATABASE_URL = {:?}", env::var("DATABASE_URL"));

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8000")
        .await
        .unwrap();

    println!("Server running on http://localhost:8000");

    axum::serve(listener, app).await.unwrap();
}