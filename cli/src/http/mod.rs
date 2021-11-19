use hyper::{
  client::{Client, HttpConnector},
  Body, Request, StatusCode,
};
use hyper_tls::HttpsConnector;
use once_cell::sync::Lazy;
use serde_json::Value;

use crate::auth::get_token;

#[derive(Debug)]
pub enum HttpError {
  Timeout,
  Forbidden,
  Conflict,
  Unauthorized,
  Other(String),
}

pub static CLIENT: Lazy<Client<HttpsConnector<HttpConnector>>> =
  Lazy::new(|| Client::builder().build::<_, Body>(HttpsConnector::new()));

fn get_url() -> &'static str {
  let env = std::env::var("IASQL_ENV").unwrap_or("production".to_string());
  match env.as_str() {
    "local" => "http://localhost:8088",
    _ => "http://localhost:8088",
  }
}

pub async fn request(req: Request<Body>) -> Result<String, HttpError> {
  let resp = CLIENT.request(req).await;
  let mut resp = match resp {
    Ok(resp) => resp,
    Err(e) => return Err(HttpError::Other(e.to_string())),
  };
  let data = hyper::body::to_bytes(resp.body_mut()).await;
  let data = match data {
    Ok(data) => data,
    Err(e) => return Err(HttpError::Other(e.to_string())),
  };
  let data_str = String::from_utf8(data.to_vec());
  let data_str = match data_str {
    Ok(data_str) => data_str,
    Err(e) => return Err(HttpError::Other(e.to_string())),
  };
  return match resp.status() {
    st if st.is_success() => Ok(data_str),
    StatusCode::REQUEST_TIMEOUT => Err(HttpError::Timeout),
    StatusCode::FORBIDDEN => Err(HttpError::Forbidden),
    StatusCode::CONFLICT => Err(HttpError::Conflict),
    _ => Err(HttpError::Other(data_str.to_string())),
  };
}

pub async fn get_v1(endpoint: &str) -> Result<String, HttpError> {
  let req = Request::get(format!("{}/v1/{}", get_url(), endpoint))
    .header("Authorization", format!("Bearer {}", get_token()))
    .body(Body::empty());
  let req = match req {
    Ok(r) => r,
    Err(e) => return Err(HttpError::Other(e.to_string())),
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
    Err(e) => return Err(HttpError::Other(e.to_string())),
  };
  return request(req).await;
}
