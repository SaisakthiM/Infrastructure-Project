use reqwest::Client;
use sqlx::PgPool;
use serde_json;

#[path = "common/mod.rs"]
mod common;
use common::{spawn_app, unique_name};

#[tokio::test]
async fn test_user_is_persisted_in_db() {
    let app_address = spawn_app().await;
    let client = reqwest::Client::new();
    let username = unique_name("saisakthi");

    client
        .post(format!("{}/users", app_address))
        .json(&serde_json::json!({
            "username": username,
            "password": "saisakthi2008"
        }))
        .send()
        .await
        .expect("Failed to send request");

    let connection_string = std::env::var("DATABASE_TEST_URL")
        .expect("DATABASE_TEST_URL not set");
    let pool = PgPool::connect(&connection_string).await.expect("Failed to connect");

    let row = sqlx::query!("SELECT username FROM users WHERE username = $1", username)
        .fetch_one(&pool)
        .await
        .expect("User not found in DB");

    assert_eq!(row.username, username);
}

#[tokio::test]
async fn test_register_returns_200() {
    let app_address = spawn_app().await;
    let client = reqwest::Client::new();

    let response = client
        .post(format!("{}/users", app_address))
        .json(&serde_json::json!({
            "username": unique_name("saisakthi"),
            "password": "saisakthi2008"
        }))
        .send()
        .await
        .expect("Failed to execute request");

    assert_eq!(200, response.status().as_u16());
    let body: serde_json::Value = response.json().await.unwrap();
    assert!(body["token"].as_str().is_some());
    assert!(body["id"].as_str().is_some());
}

#[tokio::test]
async fn test_get_user_returns_200() {
    let app_address = spawn_app().await;
    let client = reqwest::Client::new();

    let post_response = client
        .post(format!("{}/users", app_address))
        .json(&serde_json::json!({
            "username": unique_name("saisakthi"),
            "password": "saisakthi2008"
        }))
        .send()
        .await
        .expect("Failed to register user");

    assert_eq!(200, post_response.status().as_u16());
    let body: serde_json::Value = post_response.json().await.unwrap();
    let user_id = body["id"].as_str().expect("No ID in response");

    let get_response = client
        .get(format!("{}/users/{}", app_address, user_id))
        .send()
        .await
        .expect("Failed to get user");

    assert_eq!(200, get_response.status().as_u16());
    let user: serde_json::Value = get_response.json().await.unwrap();
    assert!(user["username"].as_str().is_some());
    assert!(user["id"].as_str().is_some());
    assert!(user["created_at"].as_str().is_some());
}

#[tokio::test]
async fn test_if_user_put_return_200() {
    let app_address = spawn_app().await;
    let client = Client::new();

    let post_response = client
        .post(format!("{}/users", app_address))
        .json(&serde_json::json!({
            "username": unique_name("saisakthi"),
            "password": "saisakthi2008"
        }))
        .send()
        .await
        .expect("Failed to register user");

    assert_eq!(200, post_response.status().as_u16());
    let body: serde_json::Value = post_response.json().await.unwrap();
    let user_id = body["id"].as_str().expect("No ID in response");
    let new_name = unique_name("renamed");

    let put_response = client
        .put(format!("{}/users/{}", app_address, user_id))
        .json(&serde_json::json!({ "new_name": new_name }))
        .send()
        .await
        .expect("Failed to put user");

    assert_eq!(204, put_response.status().as_u16());

    let verify: serde_json::Value = client
        .get(format!("{}/users/{}", app_address, user_id))
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();

    assert_eq!(verify["username"].as_str().unwrap(), new_name);
}

#[tokio::test]
async fn test_if_user_delete_return_200() {
    let app_address = spawn_app().await;
    let client = Client::new();

    let post_response = client
        .post(format!("{}/users", app_address))
        .json(&serde_json::json!({
            "username": unique_name("saisakthi"),
            "password": "saisakthi2008"
        }))
        .send()
        .await
        .expect("Failed to register user");

    assert_eq!(200, post_response.status().as_u16());
    let body: serde_json::Value = post_response.json().await.unwrap();
    let user_id = body["id"].as_str().expect("No ID in response");

    let delete_response = client
        .delete(format!("{}/users/{}", app_address, user_id))
        .send()
        .await
        .expect("Failed to delete user");

    assert_eq!(204, delete_response.status().as_u16());
}