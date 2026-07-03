use sqlx::Database;
use config::{self, ConfigError};

#[derive(serde::Deserialize)]
pub struct Settings {
    pub database: DatabaseSettings,
    pub application_port: u16
}

#[derive(serde::Deserialize)]
pub struct DatabaseSettings {
    pub username: String,
    pub password: String,
    pub port: u16,
    pub host: String,
    pub database_name: String

}

pub fn get_configuration() -> Result<Settings, config::ConfigError> {
    let settings = config::Config::builder()
        .add_source(config::File::with_name("configuration"))
        .build()?;
    
    settings.try_deserialize()
}

pub fn get_configuration_test() -> Result<Settings, config::ConfigError> {
    let settings = config::Config::builder()
        .add_source(config::File::with_name("configuration-test"))
        .build()?;
    
    settings.try_deserialize()
}


impl DatabaseSettings {
    pub fn connection_setting(&self) -> String {
        format!("postgresql://{}:{}@{}:{}/{}",self.username, self.password, self.host, self.port, self.database_name)
    }
}