use crate::{database::AppState, routes::dto::{self, ChatRoomRequest}};
use axum::{
    Json, Router, extract::{Multipart, Path, Query, State, ws::{Message, WebSocket, WebSocketUpgrade, close_code::STATUS}}, handler::{HandlerService, HandlerWithoutStateExt}, http::StatusCode, response::{IntoResponse, Response}, routing::{any, get, post}
};

use serde_json;
use futures_util::{SinkExt, StreamExt, TryStreamExt};
use bcrypt::{DEFAULT_COST, hash, verify};
use jsonwebtoken::{EncodingKey, DecodingKey, Header, Validation, encode, decode};
use sqlx::Row;
use tokio::sync::broadcast;
use uuid::Uuid;
use chrono::{Duration, Utc};
use minio::s3::{MinioClient, MinioClientBuilder, creds::StaticProvider, http::BaseUrl, response::BucketExistsResponse, types::S3Api};
use minio::s3::types::BucketName;


pub async fn chat_home() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "name": "Chatting App API",
        "version": "1.0.0",
        "endpoints": {
            "auth": {
                "POST /users": "Register a new user",
                "POST /login": "Login and get JWT token"
            },
            "users": {
                "GET /users/{user_id}": "Get user details",
                "PUT /users/{user_id}": "Update username",
                "DELETE /users/{user_id}": "Delete user"
            },
            "rooms": {
                "POST /room": "Create a room",
                "POST /room/join": "Join a room",
                "GET /rooms?user_id=": "List rooms for a user",
                "GET /room/{room_id}/members": "List members in a room"
            },
            "messages": {
                "POST /message": "Send a message",
                "GET /message?room_id=&user_id=": "Get messages in a room"
            },
            "websocket": {
                "WS /ws/{room_id}?token=": "Real-time chat"
            }
        }
    }))
}


pub async fn create_message(
    State(state): State<AppState>,
    Json(request): Json<dto::CreateMessageRequest>,
) -> Result<Json<dto::MessageResponse>, StatusCode> {
    let id = Uuid::new_v4();
    let timestamp = Utc::now();

    let result = sqlx::query(
        r#"
        INSERT INTO messages (
            id,
            room_id,
            sender_id,
            content,
            message_type,
            media_url,
            created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        "#
    )
    .bind(id)
    .bind(request.room_id)
    .bind(request.sender_id)
    .bind(&request.content)
    .bind(&request.message_type)
    .bind(&request.media_url)
    .bind(timestamp)
    .execute(&state.db)
    .await;

    println!("{:?}", result);

    result.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(dto::MessageResponse { id }))
}

pub async fn create_user(
    State(state): State<AppState>,
    Json(request): Json<dto::CreateUserRequest>,
) -> Result<Json<dto::AuthResponse>, StatusCode> {
    let id = Uuid::new_v4();
    let timestamp = Utc::now();

    let password_hash = hash(&request.password, DEFAULT_COST)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let result = sqlx::query(
        r#"
        INSERT INTO users (id, username, password_hash, created_at)
        VALUES ($1, $2, $3, $4)
        "#
    )
    .bind(id)
    .bind(&request.username)
    .bind(&password_hash)
    .bind(timestamp)
    .execute(&state.db)
    .await;

    println!("{:?}", result);

    result.map_err(|e| {
        println!("DB Error: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let token = create_token(id).map_err(|e| {
        println!("JWT Error: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(dto::AuthResponse { id, token }))
}

pub async fn create_room(
    State(pool): State<AppState>,
    Json(payload): Json<dto::ChatRoomRequest>,
) -> Result<Json<dto::ChatRoomResponse>, (StatusCode, String)> {
    let room_id = Uuid::new_v4();

    let mut tx = match pool.db.begin().await {
        Ok(tx) => tx,
        Err(e) => {
            eprintln!("DB begin error: {:?}", e);
            return Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string()));
        }
    };

    if let Err(e) = sqlx::query("INSERT INTO chat_rooms (id, name, created_at) VALUES ($1, $2, now())")
        .bind(room_id)
        .bind(&payload.name)
        .execute(&mut *tx)
        .await
    {
        eprintln!("Insert chat_rooms error: {:?}", e);
        return Err((StatusCode::BAD_REQUEST, e.to_string()));
    }

    if let Err(e) = sqlx::query(
        "INSERT INTO room_members (room_id, user_id, last_seen_at) VALUES ($1, $2, now())"
    )
    .bind(room_id)
    .bind(payload.creator_id)
    .execute(&mut *tx)
    .await
    {
        eprintln!("Insert room_members error: {:?}", e);
        return Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string()));
    }

    let row = match sqlx::query("SELECT name FROM chat_rooms WHERE id=$1")
        .bind(room_id)
        .fetch_one(&mut *tx)
        .await
    {
        Ok(row) => row,
        Err(e) => {
            eprintln!("Select chat_rooms error: {:?}", e);
            return Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string()));
        }
    };

    if let Err(e) = tx.commit().await {
        eprintln!("Commit error: {:?}", e);
        return Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string()));
    }

    Ok(Json(dto::ChatRoomResponse {
        id: room_id,
        name: row.get("name"),
        creator_id: payload.creator_id,
    }))
}


// Join room endpoint
pub async fn join_room(
    State(pool): State<AppState>,
    Json(payload): Json<dto::JoinRoomRequest>,
) -> Result<StatusCode, (StatusCode, String)> {
    let mut tx = match pool.db.begin().await {
        Ok(tx) => tx,
        Err(e) => return Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    };
    sqlx::query(
        "INSERT INTO room_members (room_id, user_id, last_seen_at)
         VALUES ($1, $2, now())
         ON CONFLICT (room_id, user_id) DO UPDATE SET last_seen_at = now()"
    )
    .bind(payload.room_id)
    .bind(payload.user_id)
    .execute(&pool.db)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::CREATED)
}


pub async fn get_message(
    State(state): State<AppState>,
    Query(request): Query<dto::MessageRequest>,
) -> Result<Json<Vec<dto::MessageRow>>, StatusCode> {
    let messages = sqlx::query_as::<_, dto::MessageRow>(
        r#"
        SELECT m.id, m.room_id, m.sender_id, m.content, m.message_type, m.media_url, m.created_at
        FROM messages m
        JOIN room_members rm ON rm.room_id = m.room_id
        WHERE m.room_id = $1 AND rm.user_id = $2
        ORDER BY m.created_at ASC;
        "#
    )
    .bind(request.room_id)
    .bind(request.user_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        eprintln!("DB Error: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(messages))
}

pub fn create_token(user_id: Uuid) -> Result<String, jsonwebtoken::errors::Error> {
    let expiration = Utc::now()
        .checked_add_signed(Duration::hours(24))
        .unwrap()
        .timestamp() as usize;

    let claims = dto::Claims {
        sub: user_id.to_string(),
        exp: expiration,
    };

    let secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "secret".to_string());

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
}

pub async fn login(
    State(state): State<AppState>,
    Json(request): Json<dto::LoginRequest>,
) -> Result<Json<dto::AuthResponse>, StatusCode> {
    let row: (Uuid, String) = sqlx::query_as(
        r#"
        SELECT id, password_hash
        FROM users
        WHERE username = $1
        "#
    )
    .bind(&request.username)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        println!("DB Error: {:?}", e);
        StatusCode::UNAUTHORIZED
    })?;

    let (user_id, password_hash) = row;

    let valid = verify(&request.password, &password_hash)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if !valid {
        return Err(StatusCode::UNAUTHORIZED);
    }

    let token = create_token(user_id).map_err(|e| {
        println!("JWT Error: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(dto::AuthResponse { id: user_id, token }))
}


pub async fn handler(
    ws: WebSocketUpgrade,
    Path(room_id): Path<Uuid>,
    Query(params): Query<dto::WsParams>,
    State(state): State<AppState>,
) -> Response {
    let secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| "secret".to_string());

    let token_data = decode::<dto::Claims>(
        &params.token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    );

    let user_id = match token_data {
        Ok(data) => match Uuid::parse_str(&data.claims.sub) {
            Ok(id) => id,
            Err(_) => return StatusCode::UNAUTHORIZED.into_response(),
        },
        Err(_) => return StatusCode::UNAUTHORIZED.into_response(),
    };

    // Extractors end here. We move raw data types (Uuid, AppState) into the socket closure.
    ws.on_upgrade(move |socket| handle_socket(socket, user_id, room_id, state))
}

// 3. The Connection Coordinator (Converts Socket Worker Result into void)
async fn handle_socket(socket: WebSocket, user_id: Uuid, room_id: Uuid, state: AppState) {
    // Pass the actual upgraded raw socket and variables into our core logic
    match handle_socket_core(socket, user_id, room_id, state).await {
        Ok(_) => println!("User {} cleanly disconnected from room {}", user_id, room_id),
        Err(e) => eprintln!("Socket error occurred for user {} in room {}: {:?}", user_id, room_id, e),
    }
}

// 4. The Fallible Core Worker (NO Extractors, Plain Rust arguments only!)

async fn handle_socket_core(
    socket: WebSocket, 
    user_id: Uuid, 
    room_id: Uuid, 
    state: AppState
) -> Result<(), dto::SocketError> {
    
    // Now socket.split() works perfectly!
    let (mut sender, mut receiver) = socket.split();

    // 1. Get/Create Room Channel
    let tx = {
        let mut rooms = state.rooms.lock().await;
        rooms.entry(room_id)
            .or_insert_with(|| broadcast::channel(32).0)
            .clone()
    };
    let mut rx = tx.subscribe();

    // 2. Fetch history & update last seen
    let last_seen: (chrono::DateTime<Utc>,) = sqlx::query_as(
        "SELECT last_seen_at FROM room_members WHERE room_id = $1 AND user_id = $2"
    )
    .bind(room_id)
    .bind(user_id)
    .fetch_one(&state.db)
    .await
    .unwrap_or((chrono::DateTime::from_timestamp(0, 0).unwrap(),));

    sqlx::query("UPDATE room_members SET last_seen_at = now() WHERE room_id = $1 AND user_id = $2")
        .bind(room_id)
        .bind(user_id)
        .execute(&state.db)
        .await?; // <-- using ? now

    let missed = sqlx::query_as::<_, dto::MessageRow>(
        r#"SELECT id, room_id, sender_id, content, created_at FROM messages 
           WHERE room_id = $1 AND created_at > $2 ORDER BY created_at ASC"#
    )
    .bind(room_id)
    .bind(last_seen.0)
    .fetch_all(&state.db)
    .await?; // <-- using ? now

    for msg in missed {
        let json = serde_json::to_string(&msg)?;
        sender.send(Message::Text(json.into())).await?; // <-- using ? now
    }

    // 3. Spawn Broadcast-to-Client Task (with heartbeat ping to keep connection alive)
    let mut send_task = tokio::spawn(async move {
        let mut ping_interval = tokio::time::interval(std::time::Duration::from_secs(20));
        ping_interval.tick().await; // skip immediate tick

        loop {
            tokio::select! {
                msg = rx.recv() => {
                    match msg {
                        Ok(text) => {
                            if sender.send(Message::Text(text.into())).await.is_err() {
                                break;
                            }
                        }
                        Err(broadcast::error::RecvError::Lagged(_)) => {
                            // We missed some messages because the buffer overflowed.
                            // Skip them instead of killing the connection.
                            continue;
                        }
                        Err(broadcast::error::RecvError::Closed) => {
                            break;
                        }
                    }
                }
                _ = ping_interval.tick() => {
                    if sender.send(Message::Ping(Vec::new().into())).await.is_err() {
                        break;
                    }
                }
            }
        }
    });

    let state2 = state.clone();
    let tx_clone = tx.clone();

    // 4. Spawn Client-to-Room Task
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            match msg {
                Message::Text(text) => {
                    let mut content = text.to_string();
                    let mut message_type = "text".to_string();
                    let mut media_url: Option<String> = None;

                    if text.trim_start().starts_with('{') {
                        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) {
                            if v.get("type").and_then(|t| t.as_str()) == Some("ping") {
                                continue;
                            }

                            if let Some(t) = v.get("type").and_then(|t| t.as_str()) {
                                if t == "image" {
                                    message_type = "image".to_string();
                                    media_url = v.get("media_url")
                                        .and_then(|u| u.as_str())
                                        .map(|s| s.to_string());
                                    content = v.get("content")
                                        .and_then(|c| c.as_str())
                                        .unwrap_or("")
                                        .to_string();
                                }
                            }
                        }
                    }

                    let msg_id = Uuid::new_v4();
                    let timestamp = Utc::now();

                    let _ = sqlx::query(
                        r#"INSERT INTO messages (id, room_id, sender_id, content, message_type, media_url, created_at)
                           VALUES ($1, $2, $3, $4, $5, $6, $7)"#
                    )
                    .bind(msg_id)
                    .bind(room_id)
                    .bind(user_id)
                    .bind(&content)
                    .bind(&message_type)
                    .bind(&media_url)
                    .bind(timestamp)
                    .execute(&state2.db)
                    .await;

                    let payload = serde_json::json!({
                        "id": msg_id,
                        "room_id": room_id,
                        "sender_id": user_id,
                        "content": content,
                        "message_type": message_type,
                        "media_url": media_url,
                        "created_at": timestamp,
                    }).to_string();

                    let _ = tx_clone.send(payload);
                }
                Message::Close(_) => break,
                _ => {}
            }
        }
    });

    // 5. Race tasks
    tokio::select! {
        _ = &mut send_task => recv_task.abort(),
        _ = &mut recv_task => send_task.abort(),
    }

    // 6. Update last seen upon exit
    sqlx::query("UPDATE room_members SET last_seen_at = now() WHERE room_id = $1 AND user_id = $2")
        .bind(room_id)
        .bind(user_id)
        .execute(&state.db)
        .await?;

    Ok(())
}


pub async fn get_user_rooms(
    State(pool): State<AppState>,
    Query(params): Query<dto::GetRoomsParams>,
) -> Result<Json<Vec<dto::RoomRow>>, (StatusCode, String)> {
    let mut tx = match pool.db.begin().await {
        Ok(tx) => tx,
        Err(e) => return Err((StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    };
    let rooms = sqlx::query_as::<_, dto::RoomRow>(
        "SELECT DISTINCT cr.id, cr.name, cr.created_at 
         FROM chat_rooms cr
         LEFT JOIN room_members rm ON cr.id = rm.room_id
         WHERE rm.user_id = $1 OR cr.id IN (
             SELECT room_id FROM room_members WHERE user_id = $1
         )
         ORDER BY cr.created_at DESC"
    )
    .bind(params.user_id)
    .fetch_all(&mut *tx)
    .await
    .map_err(|e| {
        eprintln!("Database error: {:?}", e);
        (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
    })?;

    Ok(Json(rooms))
}



pub async fn discover_rooms(
    State(state): State<AppState>,
    Query(params): Query<dto::DiscoverRoomsParams>,
) -> Result<Json<Vec<dto::DiscoverRoomRow>>, StatusCode> {
    let search_term = format!("%{}%", params.q.unwrap_or_default());

    let rooms = sqlx::query_as::<_, dto::DiscoverRoomRow>(
        r#"
        SELECT
            cr.id,
            cr.name,
            cr.created_at,
            (SELECT COUNT(*) FROM room_members rm2 WHERE rm2.room_id = cr.id) AS member_count,
            EXISTS (
                SELECT 1 FROM room_members rm3
                WHERE rm3.room_id = cr.id AND rm3.user_id = $2
            ) AS is_member
        FROM chat_rooms cr
        WHERE cr.name ILIKE $1
        ORDER BY cr.created_at DESC
        LIMIT 50
        "#
    )
    .bind(search_term)
    .bind(params.user_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        eprintln!("DB Error: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(rooms))
}

pub async fn get_room_members(
    State(state): State<AppState>,
    Path(room_id): Path<Uuid>,
) -> Result<Json<Vec<dto::MemberRow>>, StatusCode> {
    let members = sqlx::query_as::<_, dto::MemberRow>(
        r#"
        SELECT rm.user_id, u.username, rm.last_seen_at
        FROM room_members rm
        JOIN users u ON u.id = rm.user_id
        WHERE rm.room_id = $1
        ORDER BY u.username ASC
        "#
    )
    .bind(room_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        println!("DB Error: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(members))
}

pub async fn delete_user(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let result = sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(user_id)
        .execute(&state.db)
        .await
        .map_err(|e| {
            println!("DB Error: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::NO_CONTENT)
}


pub async fn modify_user(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
    Json(body): Json<dto::ModifyName>,
) -> Result<StatusCode, StatusCode> {
    let result = sqlx::query("UPDATE users SET username=$1 WHERE id=$2")
        .bind(&body.new_name)
        .bind(user_id)
        .execute(&state.db)
        .await
        .map_err(|e| {
            println!("DB Error: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::NO_CONTENT)
}

pub async fn get_user(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
) -> Result<Json<dto::UserRow>, StatusCode> {
    let user = sqlx::query_as::<_, dto::UserRow>(
        "SELECT id, username, created_at FROM users WHERE id = $1"
    )
    .bind(user_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| {
        println!("DB Error: {:?}", e);
        StatusCode::NOT_FOUND
    })?;

    Ok(Json(user))
}


pub const MEDIA_BUCKET: &str = "chat-media";

pub async fn upload_image(
    mut multipart: Multipart,
) -> Result<Json<dto::UploadResponse>, (StatusCode, String)> {
    let client = create_client()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    create_bucket_if_not_exists(MEDIA_BUCKET, &client)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?
    {
        let original_name = field.file_name().unwrap_or("upload").to_string();
        let ext = std::path::Path::new(&original_name)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("bin");

        let object_name = format!("{}.{}", Uuid::new_v4(), ext);

        let data = field
            .bytes()
            .await
            .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

        client
            .put_object(
                BucketName::try_from(MEDIA_BUCKET)
                    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
                object_name.clone(),
                minio::s3::segmented_bytes::SegmentedBytes::from(data),
            )
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
            .build()
            .send()
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        return Ok(Json(dto::UploadResponse {
            url: format!("/files/{}", object_name),
            filename: object_name,
        }));
    }

    Err((StatusCode::BAD_REQUEST, "No file provided".to_string()))
}

pub async fn serve_file(
    Path(filename): Path<String>,
) -> Result<Response, StatusCode> {
    let client = create_client().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let resp = client
        .get_object(MEDIA_BUCKET, filename.as_str())
        .map_err(|_| StatusCode::NOT_FOUND)?
        .build()
        .send()
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    let segmented = resp
        .content()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .to_segmented_bytes()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let bytes = segmented.to_bytes();

    let content_type = match std::path::Path::new(&filename)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase()
        .as_str()
    {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        _ => "application/octet-stream",
    };

    Ok((
        [(axum::http::header::CONTENT_TYPE, content_type)],
        bytes,
    ).into_response())
}

#[allow(dead_code)]
pub fn create_client() -> Result<MinioClient, Box<dyn std::error::Error + Send + Sync>> {
    let minio_host = env::var("MINIO_URL").unwrap_or_else(|_| "http://whisper-minio:9000".to_string());
    let base_url = minio_host.parse::<BaseUrl>()?;
    let username = env::var("MINIO_USER").unwrap_or_else(|_| "minioadmin".to_string());
    let password = env::var("MINIO_PASSWORD").unwrap_or_else(|_| "minioadmin".to_string());

    let static_provider = StaticProvider::new(&username, &password, None);

    let client = MinioClientBuilder::new(base_url.clone())
        .provider(Some(static_provider))
        .build()?;
    Ok(client)
}

pub async fn create_bucket_if_not_exists(
    bucket: &str,
    client: &MinioClient,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let bucket = BucketName::try_from(bucket)?;
    let resp: BucketExistsResponse = client.bucket_exists(bucket.clone())?.build().send().await?;

    if !resp.exists() {
        client.create_bucket(bucket)?.build().send().await?;
    };
    Ok(())
}

pub async fn search_users(
    State(state): State<AppState>,
    Query(query): Query<dto::SearchQuery>,
) -> Result<Json<Vec<dto::UserRow>>, StatusCode> {
    let search_term = format!("%{}%", query.q);
    
    let users = sqlx::query_as::<_, dto::UserRow>(
        "SELECT id, username, created_at, profile_photo_url FROM users WHERE username ILIKE $1 LIMIT 20"
    )
    .bind(search_term)
    .fetch_all(&state.db)
    .await
    .map_err(|e| {
        eprintln!("DB Error: {:?}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(users))
}

pub async fn update_profile_photo(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
    Json(body): Json<dto::UpdateProfileRequest>,
) -> Result<StatusCode, StatusCode> {
    let result = sqlx::query("UPDATE users SET profile_photo_url=$1 WHERE id=$2")
        .bind(&body.profile_photo_url)
        .bind(user_id)
        .execute(&state.db)
        .await
        .map_err(|e| {
            eprintln!("DB Error: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::NO_CONTENT)
}
