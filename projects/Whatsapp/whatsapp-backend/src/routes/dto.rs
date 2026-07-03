use chrono::{Utc,NaiveDateTime};
use serde::{Serialize, Deserialize};
use uuid::Uuid;
use sqlx::FromRow;

#[derive(Deserialize)]
pub struct CreateMessageRequest {
    pub room_id: Uuid,
    pub sender_id: Uuid,
    pub content: String,
    #[serde(default = "default_message_type")]
    pub message_type: String,
    #[serde(default)]
    pub media_url: Option<String>,
}

fn default_message_type() -> String {
    "text".to_string()
}

#[derive(Serialize)]
pub struct ChatRoomResponse {
    pub id: Uuid,
    pub name: String,
    pub creator_id: Uuid,
}

#[derive(Serialize)]
pub struct MessageResponse {
    pub id: Uuid,
}

#[derive(Deserialize)]
pub struct CreateUserRequest {
    pub username: String,
    pub password: String
}

#[derive(Serialize,Deserialize)]
pub struct ChatRoomRequest {
    pub name: String,
    pub creator_id: Uuid,  
}

#[derive(Deserialize)]
pub struct JoinRoomRequest {
    pub room_id: Uuid,
    pub user_id: Uuid,
}


#[derive(Deserialize)]
pub struct MessageRequest {
    pub room_id: Uuid,
    pub user_id: Uuid
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
}

#[derive(Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Serialize)]
pub struct AuthResponse {
    pub id: Uuid,
    pub token: String,
}

#[derive(Deserialize)]
pub struct WsParams {
    pub token: String,
}

#[derive(Serialize, FromRow, Debug)]
pub struct MessageRow {
    id: Uuid,
    room_id: Uuid,
    sender_id: Uuid,
    content: String,
    #[sqlx(default)]
    pub message_type: String,
    #[sqlx(default)]
    pub media_url: Option<String>,
    #[sqlx(rename = "created_at")]
    pub created_at: chrono::DateTime<Utc>,
}

#[derive(Serialize, Deserialize, FromRow)]
pub struct RoomRow {
    pub id: Uuid,
    pub name: String,
    pub created_at: chrono::DateTime<Utc>,
}

#[derive(Serialize, Deserialize, FromRow)]
pub struct MemberRow {
    pub user_id: Uuid,
    pub username: String,
    pub last_seen_at: chrono::DateTime<Utc>,
}

#[derive(Serialize, Deserialize)]
pub struct UserIdQuery {
    pub user_id: Uuid,
}

#[derive(Serialize, Deserialize)]
pub struct ModifyName {
    pub new_name: String,  // user_id comes from Path, not here
}

#[derive(Serialize, Deserialize, FromRow)]
pub struct UserRow {
    pub id: Uuid,
    pub username: String,
    pub created_at: chrono::DateTime<Utc>,
    #[sqlx(default)]
    pub profile_photo_url: Option<String>, // Added this line
}

#[derive(Debug, Deserialize)]
pub struct GetRoomsParams {
    pub user_id: Uuid,
}

#[derive(Serialize)]
pub struct UploadResponse {
    pub url: String,
    pub filename: String,
}

#[derive(Debug)]
pub enum SocketError {
    Database(sqlx::Error),
    Serialization(serde_json::Error),
    Network(axum::Error),
}

// Implement From traits for easy error propagation using the ? operator
impl From<sqlx::Error> for SocketError {
    fn from(err: sqlx::Error) -> Self { Self::Database(err) }
}
impl From<serde_json::Error> for SocketError {
    fn from(err: serde_json::Error) -> Self { Self::Serialization(err) }
}
impl From<axum::Error> for SocketError {
    fn from(err: axum::Error) -> Self { Self::Network(err) }
}

#[derive(Debug, Deserialize)]
pub struct DiscoverRoomsParams {
    pub user_id: Uuid,
    #[serde(default)]
    pub q: Option<String>,
}

#[derive(Serialize, FromRow)]
pub struct DiscoverRoomRow {
    pub id: Uuid,
    pub name: String,
    pub created_at: chrono::DateTime<Utc>,
    pub member_count: i64,
    pub is_member: bool,
}

#[derive(Deserialize)]
pub struct SearchQuery {
    pub q: String,
}

#[derive(Serialize, Deserialize)]
pub struct UpdateProfileRequest {
    pub profile_photo_url: String,
}
