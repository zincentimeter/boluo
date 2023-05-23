use crate::error::CacheError;
pub use redis::aio::MultiplexedConnection;
pub use redis::AsyncCommands;
use uuid::fmt::Hyphenated;
use uuid::Uuid;

#[derive(Clone)]
pub struct Connection {
    pub inner: MultiplexedConnection,
}

impl Connection {
    fn new(inner: MultiplexedConnection) -> Connection {
        Connection { inner }
    }

    pub async fn get(&mut self, key: &[u8]) -> Result<Option<Vec<u8>>, CacheError> {
        self.inner.get(key).await
    }

    pub async fn set(&mut self, key: &[u8], value: &[u8]) -> Result<(), CacheError> {
        self.inner.set(key, value).await
    }

    pub async fn set_with_expiration(&mut self, key: &[u8], value: &[u8], seconds: usize) -> Result<(), CacheError> {
        self.inner.set_ex(key, value, seconds).await
    }

    pub async fn remove(&mut self, key: &[u8]) -> Result<(), CacheError> {
        self.inner.del(key).await
    }
}

#[derive(Clone)]
pub struct RedisFactory {
    client: redis::Client,
}

impl RedisFactory {
    pub fn new() -> RedisFactory {
        use std::env::var;
        if cfg!(test) {
            dotenv::dotenv().ok();
        }
        let url = var("REDIS_URL").expect("Failed to load Redis URL");
        let client = redis::Client::open(&*url).unwrap();
        RedisFactory { client }
    }
}

/// Get cache database connection.
pub async fn conn() -> Connection {
    use std::env::var;
    let url = if let Ok(url) = var("REDIS_URL") {
        url
    } else {
        log::warn!("Failed to load Redis URL, use default");
        "redis://127.0.0.1/".to_string()
    };
    let connection_manager = redis::Client::open(&*url)
        .expect("Unable to open redis")
        .get_multiplexed_tokio_connection()
        .await
        .expect("Unable to get tokio connection manager");
    Connection::new(connection_manager)
}

pub fn make_key(type_name: &[u8], id: &Uuid, field_name: &[u8]) -> Vec<u8> {
    let type_name_len = type_name.len();
    let mut buffer = vec![0; type_name_len + 1 + Hyphenated::LENGTH + 1 + field_name.len()];
    buffer[0..type_name_len].copy_from_slice(type_name);
    buffer[type_name_len] = b':';
    let id_start = type_name_len + 1;
    let id_end = id_start + Hyphenated::LENGTH;
    id.as_hyphenated().encode_lower(&mut buffer[id_start..id_end]);
    let field_start = id_end + 1;
    buffer[id_end] = b':';
    buffer[field_start..].copy_from_slice(field_name);
    buffer
}

#[tokio::test]
async fn cache_test() -> anyhow::Result<()> {
    let mut cache = crate::cache::conn().await;

    let _result: Option<String> = cache.inner.get("hello").await.unwrap();
    Ok(())
}
