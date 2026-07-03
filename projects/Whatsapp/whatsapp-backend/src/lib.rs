use tokio::net::TcpListener;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
pub mod routes;
pub mod database;
pub mod configurations;
use axum::Router;
use database::AppState;

pub async fn run(listener: TcpListener) -> Result<(), std::io::Error> {
    dotenvy::dotenv().ok();
    let state = database::connect_db().await;
    database::init_database(&state.db)
        .await
        .expect("Failed to initialize database");

    let app = build_app(state);
    axum::serve(listener, app).await
}

pub async fn run_with_state(listener: TcpListener, state: AppState) -> Result<(), std::io::Error> {
    let app = build_app(state);
    axum::serve(listener, app).await
}

fn build_app(state: AppState) -> Router {
    Router::new()
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
}