use hyper::{
  client::{Client, HttpConnector},
  Body, Request,
};
use hyper_tls::HttpsConnector;
use once_cell::sync::Lazy;
use serde_json::Value;

use crate::auth::get_token;

pub struct HttpError {
  pub status: usize,
  pub message: String,
}

impl HttpError {
  fn new(message: String, status: usize) -> HttpError {
    HttpError { message, status }
  }
  fn new_client(message: String) -> HttpError {
    HttpError {
      message,
      status: 400,
    }
  }
}

pub static CLIENT: Lazy<Client<HttpsConnector<HttpConnector>>> =
  Lazy::new(|| Client::builder().build::<_, Body>(HttpsConnector::new()));

fn get_url() -> &'static str {
  let default = if cfg!(debug_assertions) {
    "local"
  } else {
    "production"
  };
  let env = std::env::var("IASQL_ENV").unwrap_or(default.to_string());
  match env.as_str() {
    "local" => "http://localhost:8088",
    "staging" => "https://api-staging.iasql.com",
    _ => "https://api.iasql.com",
  }
}

pub async fn request(req: Request<Body>) -> Result<String, HttpError> {
  let resp = CLIENT.request(req).await;
  let mut resp = match resp {
    Ok(resp) => resp,
    Err(e) => return Err(HttpError::new_client(e.to_string())),
  };
  let data = hyper::body::to_bytes(resp.body_mut()).await;
  let data = match data {
    Ok(data) => data,
    Err(e) => return Err(HttpError::new_client(e.to_string())),
  };
  let data_str = String::from_utf8(data.to_vec());
  let data_str = match data_str {
    Ok(data_str) => data_str,
    Err(e) => return Err(HttpError::new_client(e.to_string())),
  };
  return match resp.status() {
    st if st.is_success() => Ok(data_str),
    st => Err(HttpError::new(data_str.to_string(), st.as_u16() as usize)),
  };
}

pub async fn get_v1(endpoint: &str) -> Result<String, HttpError> {
  let req = Request::get(format!("{}/v1/{}", get_url(), endpoint))
    .header("Authorization", format!("Bearer {}", get_token()))
    .body(Body::empty());
  let req = match req {
    Ok(r) => r,
    Err(e) => return Err(HttpError::new_client(e.to_string())),
  };
  return request(req).await;
}

pub async fn post_v1(endpoint: &str, body: Value) -> Result<String, HttpError> {
  let req = Request::post(format!("{}/v1/{}", get_url(), endpoint))
    .header("Content-Type", "application/json")
    .header("Authorization", format!("Bearer {}", get_token()))
    .body(body.to_string().into());
  let req = match req {
    Ok(req) => req,
    Err(e) => return Err(HttpError::new_client(e.to_string())),
  };
  return request(req).await;
}
