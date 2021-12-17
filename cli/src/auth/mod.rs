use std::fs::{create_dir, read_to_string, remove_file, File};
use std::io::prelude::*;
use std::path::Path;

use hyper::Request;
use once_cell::sync::OnceCell;
use serde_json::{json, Value};
use tokio::time::{sleep, Duration};
use webbrowser;

use crate::dialoguer as dlg;
use crate::http::CLIENT;

const CODE_URL: &'static str = "https://auth.iasql.com/oauth/device/code";
const CLIENT_ID: &'static str = "FWIYK0GhLdMCLid0hxjmEEwxaifdAkpQ";
const GRANT_TYPE: &'static str = "urn:ietf:params:oauth:grant-type:device_code";
const CODE_BODY: &'static str = "{\
  \"client_id\": \"FWIYK0GhLdMCLid0hxjmEEwxaifdAkpQ\",\
  \"scope\": \"openid+profile+offline_access\",\
  \"audience\": \"https://api.iasql.com\"\
}";
const POLL_URL: &'static str = "https://auth.iasql.com/oauth/token";
const ERR: &'static str = "Failed to perform authentication";
const IASQL_DIR: &str = ".iasql";
const TOKEN_FILE: &str = ".iasql/.token";
static TOKEN: OnceCell<String> = OnceCell::new();

// Get saved token
pub fn get_token() -> &'static str {
  let token = TOKEN.get();
  if let Some(token) = token {
    return token;
  } else {
    // This will happen when we are not able to authenticate the user.
    // Empty token will be caught by IaSQL engine service.
    return "";
  }
}

// Get previously generated access token or generate a new one
pub async fn login(prompt_reauth: bool) {
  let token = TOKEN.get();
  if token.is_none() {
    let home = std::env::var("HOME").unwrap();
    let file_name = &format!("{}/{}", home, TOKEN_FILE);
    match read_to_string(file_name) {
      Ok(token) => {
        let prompt = "You are already logged in. Do you wish to re-authenticate?";
        if prompt_reauth && dlg::confirm_with_default(&prompt, true) {
          generate_token().await;
        } else {
          TOKEN.set(token).unwrap();
        }
      }
      Err(_) => match std::env::var("AUTH_TOKEN") {
        Ok(token) => TOKEN.set(token).unwrap(),
        Err(_) => {
          // TODO add non_interactive mode using secret token
          // if non_interactive {
          //   println!(
          //     "Non interactive mode. Token needs to be defined in AUTH_TOKEN environment variable."
          //   );
          //   std::process::exit(1)
          // }
          generate_token().await
        }
      },
    };
  };
}

pub fn logout() {
  let token = TOKEN.get();
  if token.is_none() {
    let home = std::env::var("HOME").unwrap();
    let file_name = &format!("{}/{}", home, TOKEN_FILE);
    match read_to_string(file_name) {
      Ok(_) => {
        let prompt = format!(
          "Do wish to remove the credentials stored in {}?",
          TOKEN_FILE
        );
        if !dlg::confirm_with_default(&prompt, true) {
          return;
        }
        remove_file(file_name).unwrap();
        println!(
          "{} {}",
          dlg::success_prefix(),
          dlg::bold("Removed stored credentials for IaSQL client")
        )
      }
      Err(_) => println!(
        "{} {} {} {}",
        dlg::warn_prefix(),
        dlg::bold("No stored credentials found. To generate them call"),
        dlg::divider(),
        dlg::yellow("iasql login")
      ),
    };
  };
}

// Prompts the user to authenticate using the Device Flow.
// Generates the access token, stores it in a file for later use and returns it.
// https://auth0.com/docs/authorization/flows/device-authorization-flow
// https://auth0.com/docs/authorization/flows/call-your-api-using-the-device-authorization-flow
async fn generate_token() {
  let req = Request::post(CODE_URL)
    .header("Content-Type", "application/json")
    .header("Accept", "application/json")
    .body(CODE_BODY.into())
    .unwrap();
  let resp = CLIENT.request(req).await.expect(ERR);
  let data = hyper::body::to_bytes(resp.into_body()).await.expect(ERR);
  let data_str = String::from_utf8(data.to_vec()).expect(ERR);
  let json: Value = serde_json::from_str(&data_str).expect(ERR);
  let device_code = json["device_code"].as_str().unwrap();
  let verification_uri = json["verification_uri_complete"].as_str().unwrap();
  let user_code = json["user_code"].as_str().unwrap();
  if !dlg::confirm_with_default(
    "Press Enter to authenticate the IaSQL CLI in your web browser",
    true,
  ) {
    return;
  }
  println!(
    "{} {} {} {}",
    dlg::warn_prefix(),
    dlg::bold("Your one-time code is"),
    dlg::divider(),
    dlg::cyan(user_code)
  );
  let prompt = format!(
    "{} {} {}",
    dlg::bold("Press Enter to open"),
    dlg::cyan(verification_uri),
    dlg::bold("in your browser"),
  );
  let open_browser = dlg::confirm_with_default(&prompt, true);
  if !open_browser || (open_browser && webbrowser::open(verification_uri).is_err()) {
    println!(
      "{} {} {}",
      dlg::bold("Open the following url in your browser"),
      dlg::divider(),
      dlg::cyan(verification_uri)
    );
  }
  let interval = json["interval"].as_u64().unwrap();
  let period = Duration::from_secs(interval + 1);
  let body = json!({
    "client_id": CLIENT_ID,
    "grant_type": GRANT_TYPE,
    "device_code": device_code,
  });
  loop {
    let req = Request::post(POLL_URL)
      .header("Content-Type", "application/json")
      .header("Accept", "application/json")
      .body(body.to_string().into())
      .unwrap();
    let resp = CLIENT.request(req).await.expect(ERR);
    let data = hyper::body::to_bytes(resp.into_body()).await.expect(ERR);
    let data_str = String::from_utf8(data.to_vec()).expect(ERR);
    let json: Value = serde_json::from_str(&data_str).expect(ERR);
    if let Some(token) = json["access_token"].as_str() {
      let home = std::env::var("HOME").unwrap();
      let dir_name = &format!("{}/{}", home, IASQL_DIR);
      let path = Path::new(dir_name);
      if !path.exists() {
        create_dir(path).expect(ERR);
      }
      let file_name = &format!("{}/{}", home, TOKEN_FILE);
      let path = Path::new(file_name);
      // remove old token, if it exists
      if path.exists() {
        remove_file(path).expect(ERR);
      }
      let mut file = File::create(file_name).expect(ERR);
      file.write_all(token.as_bytes()).expect(ERR);
      TOKEN.set(token.to_string()).unwrap();
      println!(
        "{} {}",
        dlg::success_prefix(),
        dlg::bold("Authentication complete. Welcome to IaSQL!")
      );
      return;
    } else if let Some(error) = json["error"].as_str() {
      if error != "authorization_pending" {
        println!(
          "{} {} {} {}",
          dlg::err_prefix(),
          dlg::bold("Authentication failed. Please try again"),
          dlg::divider(),
          error
        );
        std::process::exit(1);
      }
    }
    sleep(period).await;
  }
}
