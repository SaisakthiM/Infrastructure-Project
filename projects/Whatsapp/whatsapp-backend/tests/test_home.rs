
use whatsapp_backend::database::AppState;
use reqwest;
use sqlx::{Connection, Error::Database, PgPool, Row};
use tokio::sync::Mutex;
use std::{collections::HashMap, sync::Arc};
use tokio::net::TcpListener;

#[path = "common/mod.rs"]
mod common;
use common::spawn_app;

#[tokio::test]
async fn home_page_works() {
    // Arrange
    let address = spawn_app().await;
    let client = reqwest::Client::new();
    // Act
    let response = client
    // Use the returned application address
    .get(&format!("{}/", &address))
    .send()
    .await
    .expect("Failed to execute request.");
    // Assert
    assert!(response.status().is_success());
    assert_eq!(Some(610), response.content_length());
}





