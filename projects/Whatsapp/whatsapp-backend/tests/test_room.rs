use reqwest::Client;
use serde_json;

#[path = "common/mod.rs"]
mod common;
use common::{spawn_app, unique_name};

#[tokio::test]
async fn test_if_room_post_return_200() {
    let app_address = spawn_app().await;
    let client = Client::new();

    let response = client
        .post(format!("{}/room", app_address))
        .json(&serde_json::json!({ "name": unique_name("room") }))
        .send()
        .await
        .expect("failed to post");

    assert_eq!(200, response.status().as_u16());
    let body: serde_json::Value = response.json().await.unwrap();
    assert!(body["id"].as_str().is_some());
}

#[tokio::test]
async fn test_if_room_join_return_201() {
    let app_address = spawn_app().await;
    let client = Client::new();

    let room_body: serde_json::Value = client
        .post(format!("{}/room", app_address))
        .json(&serde_json::json!({ "name": unique_name("room") }))
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    let room_id = room_body["id"].clone();

    let user_body: serde_json::Value = client
        .post(format!("{}/users", app_address))
        .json(&serde_json::json!({
            "username": unique_name("user"),
            "password": "saisakthi2008"
        }))
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    let user_id = user_body["id"].clone();

    let join_response = client
        .post(format!("{}/room/join", app_address))
        .json(&serde_json::json!({
            "room_id": room_id,
            "user_id": user_id
        }))
        .send()
        .await
        .expect("Failed to join");

    assert_eq!(201, join_response.status().as_u16());
}

#[tokio::test]
async fn test_if_room_members_get_return_200() {
    let app_address = spawn_app().await;
    let client = Client::new();

    let room_body: serde_json::Value = client
        .post(format!("{}/room", app_address))
        .json(&serde_json::json!({ "name": unique_name("room") }))
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    let room_id = room_body["id"].as_str().unwrap().to_string();

    let user_body: serde_json::Value = client
        .post(format!("{}/users", app_address))
        .json(&serde_json::json!({
            "username": unique_name("user"),
            "password": "saisakthi2008"
        }))
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    let user_id = user_body["id"].clone();

    let join_response = client
        .post(format!("{}/room/join", app_address))
        .json(&serde_json::json!({
            "room_id": room_id,
            "user_id": user_id
        }))
        .send()
        .await
        .expect("Failed to join");
    assert_eq!(201, join_response.status().as_u16());

    let get_response = client
        .get(format!("{}/room/{}/members", app_address, room_id))
        .send()
        .await
        .expect("Failed to get members");

    assert_eq!(200, get_response.status().as_u16());
    let members: serde_json::Value = get_response.json().await.unwrap();
    let members = members.as_array().unwrap();
    assert_eq!(members.len(), 1);
    assert!(members[0]["user_id"].as_str().is_some());
    assert!(members[0]["username"].as_str().is_some());
    assert!(members[0]["last_seen_at"].as_str().is_some());
}