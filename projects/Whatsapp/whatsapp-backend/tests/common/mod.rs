// common/mod.rs
use chatting_app::database::AppState;
use sqlx::PgPool;
use tokio::sync::Mutex;
use tokio::net::TcpListener;
use std::{collections::HashMap, sync::Arc};
use dotenvy;

pub async fn spawn_app() -> String {
    dotenvy::dotenv().ok();
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .expect("Failed to bind random port");
    let port = listener.local_addr().unwrap().port();

    let connection_string = std::env::var("DATABASE_TEST_URL")
        .expect("DATABASE_TEST_URL not set");

    let db = PgPool::connect(&connection_string)
        .await
        .expect("Failed to connect to test DB");

    // Run migrations to create tables if they don't exist
    sqlx::migrate!("./migrations")
        .run(&db)
        .await
        .expect("Failed to run migrations");

    // Now truncate
    sqlx::query(
        "TRUNCATE TABLE messages, room_members, chat_rooms, users RESTART IDENTITY CASCADE"
    )
    .execute(&db)
    .await
    .expect("Failed to truncate tables");

    let state = AppState {
        db,
        rooms: Arc::new(Mutex::new(HashMap::new())),
    };

    tokio::spawn(chatting_app::run_with_state(listener, state));

    format!("http://127.0.0.1:{}", port)
}

use uuid::Uuid;

pub fn unique_name(base: &str) -> String {
    format!("{}_{}", base, &Uuid::new_v4().to_string()[..8])
}