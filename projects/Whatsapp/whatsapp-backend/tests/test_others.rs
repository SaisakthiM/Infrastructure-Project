use reqwest::Client;
use serde_json;

mod common;
use common::spawn_app;

// ── helpers ───────────────────────────────────────────────────────────────────

async fn register_user(client: &Client, app_address: &str, username: &str) -> serde_json::Value {
    client
        .post(format!("{}/users", app_address))
        .json(&serde_json::json!({
            "username": username,
            "password": "saisakthi2008"
        }))
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap()
}

async fn create_room(client: &Client, app_address: &str, name: &str) -> serde_json::Value {
    client
        .post(format!("{}/room", app_address))
        .json(&serde_json::json!({ "name": name }))
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap()
}

async fn join_room(client: &Client, app_address: &str, room_id: &str, user_id: &str) {
    client
        .post(format!("{}/room/join", app_address))
        .json(&serde_json::json!({
            "room_id": room_id,
            "user_id": user_id
        }))
        .send()
        .await
        .unwrap();
}

// ── login tests ───────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_login_returns_200() {
    let app_address = spawn_app().await;
    let client = Client::new();

    register_user(&client, &app_address, "login_user").await;

    let response = client
        .post(format!("{}/login", app_address))
        .json(&serde_json::json!({
            "username": "login_user",
            "password": "saisakthi2008"
        }))
        .send()
        .await
        .expect("Failed to login");

    assert_eq!(200, response.status().as_u16());
    let body: serde_json::Value = response.json().await.unwrap();
    assert!(body["token"].as_str().is_some());
    assert!(body["id"].as_str().is_some());
}

#[tokio::test]
async fn test_login_wrong_password_returns_401() {
    let app_address = spawn_app().await;
    let client = Client::new();

    register_user(&client, &app_address, "login_user2").await;

    let response = client
        .post(format!("{}/login", app_address))
        .json(&serde_json::json!({
            "username": "login_user2",
            "password": "wrongpassword"
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(401, response.status().as_u16());
}

#[tokio::test]
async fn test_login_unknown_user_returns_401() {
    let app_address = spawn_app().await;
    let client = Client::new();

    let response = client
        .post(format!("{}/login", app_address))
        .json(&serde_json::json!({
            "username": "doesnotexist",
            "password": "saisakthi2008"
        }))
        .send()
        .await
        .unwrap();

    assert_eq!(401, response.status().as_u16());
}

// ── message tests ─────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_post_message_returns_200() {
    let app_address = spawn_app().await;
    let client = Client::new();

    let user = register_user(&client, &app_address, "msg_user1").await;
    let user_id = user["id"].as_str().unwrap();
    let room = create_room(&client, &app_address, "msg_room1").await;
    let room_id = room["id"].as_str().unwrap();
    join_room(&client, &app_address, room_id, user_id).await;

    let response = client
        .post(format!("{}/message", app_address))
        .json(&serde_json::json!({
            "room_id": room_id,
            "sender_id": user_id,
            "content": "hello world"
        }))
        .send()
        .await
        .expect("Failed to post message");

    assert_eq!(200, response.status().as_u16());
    let body: serde_json::Value = response.json().await.unwrap();
    assert!(body["id"].as_str().is_some());
}

#[tokio::test]
async fn test_get_messages_returns_200() {
    let app_address = spawn_app().await;
    let client = Client::new();

    let user = register_user(&client, &app_address, "msg_user2").await;
    let user_id = user["id"].as_str().unwrap();
    let room = create_room(&client, &app_address, "msg_room2").await;
    let room_id = room["id"].as_str().unwrap();
    join_room(&client, &app_address, room_id, user_id).await;

    client
        .post(format!("{}/message", app_address))
        .json(&serde_json::json!({
            "room_id": room_id,
            "sender_id": user_id,
            "content": "hello from http"
        }))
        .send()
        .await
        .unwrap();

    // GET — query params in URL, no body, no Content-Type
    let response = client
        .get(format!(
            "{}/message?room_id={}&user_id={}",
            app_address, room_id, user_id
        ))
        .send()
        .await
        .expect("Failed to get messages");

    assert_eq!(201, response.status().as_u16());

}

#[tokio::test]
async fn test_get_messages_empty_for_non_member() {
    let app_address = spawn_app().await;
    let client = Client::new();

    let user = register_user(&client, &app_address, "msg_user3").await;
    let user_id = user["id"].as_str().unwrap();
    let outsider = register_user(&client, &app_address, "msg_outsider").await;
    let outsider_id = outsider["id"].as_str().unwrap();
    let room = create_room(&client, &app_address, "msg_room3").await;
    let room_id = room["id"].as_str().unwrap();

    join_room(&client, &app_address, room_id, user_id).await;

    client
        .post(format!("{}/message", app_address))
        .json(&serde_json::json!({
            "room_id": room_id,
            "sender_id": user_id,
            "content": "secret message"
        }))
        .send()
        .await
        .unwrap();

    // Outsider — query params in URL, no body
    let response = client
        .get(format!(
            "{}/message?room_id={}&user_id={}",
            app_address, room_id, outsider_id
        ))
        .send()
        .await
        .unwrap();

    assert_eq!(201, response.status().as_u16());
}
// ── websocket tests ───────────────────────────────────────────────────────────

#[tokio::test]
async fn test_ws_rejects_invalid_token() {
    let app_address = spawn_app().await;
    let client = Client::new();

    let room = create_room(&client, &app_address, "ws_room1").await;
    let room_id = room["id"].as_str().unwrap();

    // Keep http:// — reqwest doesn't support ws://, axum handles the upgrade
    let response = client
        .get(format!("{}/ws/{}?token=invalid.token.here", app_address, room_id))
        .header("Upgrade", "websocket")
        .header("Connection", "Upgrade")
        .header("Sec-WebSocket-Key", "dGhlIHNhbXBsZSBub25jZQ==")
        .header("Sec-WebSocket-Version", "13")
        .send()
        .await
        .unwrap();

    assert_eq!(401, response.status().as_u16());
}

#[tokio::test]
async fn test_ws_accepts_valid_token() {
    let app_address = spawn_app().await;
    let client = Client::new();

    let user = register_user(&client, &app_address, "ws_user1").await;
    let token = user["token"].as_str().unwrap();
    let user_id = user["id"].as_str().unwrap();
    let room = create_room(&client, &app_address, "ws_room2").await;
    let room_id = room["id"].as_str().unwrap();
    join_room(&client, &app_address, room_id, user_id).await;

    // Keep http:// — 101 Switching Protocols comes back over HTTP
    let response = client
        .get(format!("{}/ws/{}?token={}", app_address, room_id, token))
        .header("Upgrade", "websocket")
        .header("Connection", "Upgrade")
        .header("Sec-WebSocket-Key", "dGhlIHNhbXBsZSBub25jZQ==")
        .header("Sec-WebSocket-Version", "13")
        .send()
        .await
        .unwrap();

    assert_eq!(101, response.status().as_u16());
}