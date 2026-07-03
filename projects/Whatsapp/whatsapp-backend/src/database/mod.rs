use std::{collections::HashMap, sync::Arc};

use sqlx::{Executor,PgPool, postgres::PgPoolOptions};
use env::var;
use dotenvy;
use tokio::sync::{Mutex, broadcast};
use uuid::Uuid;

#[derive(Clone)]
pub struct AppState {
    pub db: sqlx::PgPool,
    pub rooms: Arc<Mutex<HashMap<Uuid, broadcast::Sender<String>>>>,
}

pub async fn connect_db() -> AppState {
    dotenvy::dotenv().ok();
    let database_url = std::env::var("DATABASE_URL").expect("Env not available");

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Failed to connect");
    AppState {
        db: pool,
        rooms: Arc::new(Mutex::new(HashMap::new())),
    }
}

pub async fn init_database(pool: &PgPool) -> Result<(), sqlx::Error> {
    pool.execute(
        r#"
        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            created_at TIMESTAMP NOT NULL
        );
        "#
    ).await?;

    pool.execute(
        r#"
        CREATE TABLE IF NOT EXISTS chat_rooms (
            id UUID PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            created_at TIMESTAMP NOT NULL
        );
        "#
    ).await?;

    pool.execute(
        r#"
        CREATE TABLE IF NOT EXISTS room_members (
            room_id UUID NOT NULL,
            user_id UUID NOT NULL,

            PRIMARY KEY (room_id, user_id),

            FOREIGN KEY (room_id)
                REFERENCES chat_rooms(id)
                ON DELETE CASCADE,

            FOREIGN KEY (user_id)
                REFERENCES users(id)
                ON DELETE CASCADE
        );
        "#
    ).await?;

    pool.execute(
        r#"
        CREATE TABLE IF NOT EXISTS messages (
            id UUID PRIMARY KEY,

            room_id UUID NOT NULL,
            sender_id UUID NOT NULL,

            content TEXT NOT NULL,

            created_at TIMESTAMP NOT NULL,

            FOREIGN KEY (room_id)
                REFERENCES chat_rooms(id)
                ON DELETE CASCADE,

            FOREIGN KEY (sender_id)
                REFERENCES users(id)
                ON DELETE CASCADE
        );
        "#
    ).await?;

    pool.execute(
        r#"
        ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text';
        "#
    ).await?;

    pool.execute(
        r#"
        ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url TEXT;
        "#
    ).await?;

    pool.execute(
        r#"
        ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;
        "#
    ).await?;

    Ok(())
}