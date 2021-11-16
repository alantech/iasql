use hyper::{Body, Request, StatusCode};
use indicatif::ProgressBar;
use serde::{Deserialize, Serialize};
use serde_ini;
use serde_json::{json, Value};

use std::fs::OpenOptions;
use std::io::BufReader;

use crate::auth::get_token;
use crate::dialoguer as dlg;
use crate::http::CLIENT;

#[derive(Debug)]
pub enum PostV1Error {
  Timeout,
  Forbidden,
  Conflict,
  Unauthorized,
  Other(String),
}

#[derive(Deserialize, Debug, Clone, Serialize)]
pub struct AWSCLICredentialsFile {
  default: AWSCLICredentials,
}

#[derive(Deserialize, Debug, Clone, Serialize)]
pub struct AWSCLICredentials {
  aws_access_key_id: String,
  aws_secret_access_key: String,
}

const NO_DBS: &str = "No IaSQL dbs to manage an AWS account have been created";

// TODO load regions at startup based on aws services and schema since not all regions support all services.
// Currently manually listing ec2 regions that do not require opt-in status in alphabetical order
// https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html
fn get_aws_regions() -> Vec<String> {
  return vec![
    "ap-northeast-1".to_string(),
    "ap-northeast-2".to_string(),
    "ap-northeast-3".to_string(),
    "ap-south-1".to_string(),
    "ap-southeast-1".to_string(),
    "ap-southeast-2".to_string(),
    "ca-central-1".to_string(),
    "eu-central-1".to_string(),
    "eu-north-1".to_string(),
    "eu-west-1".to_string(),
    "eu-west-2".to_string(),
    "eu-west-3".to_string(),
    "sa-east-1".to_string(),
    "us-east-1".to_string(),
    "us-east-2".to_string(),
    "us-west-1".to_string(),
    "us-west-2".to_string(),
  ];
}

fn get_url() -> &'static str {
  let env = std::env::var("IASQL_ENV").unwrap_or("production".to_string());
  match env.as_str() {
    "local" => "http://localhost:8088",
    _ => "http://localhost:8088",
  }
}

fn get_aws_cli_creds() -> Result<AWSCLICredentialsFile, String> {
  let home = std::env::var("HOME").unwrap();
  let file_name = &format!("{}/.aws/credentials", home);
  let file = OpenOptions::new().read(true).open(file_name);
  if let Err(err) = file {
    return Err(err.to_string());
  }
  let reader = BufReader::new(file.unwrap());
  match serde_ini::from_bufread(reader) {
    Ok(creds) => Ok(creds),
    Err(err) => Err(err.to_string()),
  }
}

async fn get_dbs() -> Vec<String> {
  let resp = get_v1_db("list").await;
  let res = match &resp {
    Ok(r) => r,
    Err(e) => {
      println!("Err: {:?}", e);
      std::process::exit(1);
    }
  };
  serde_json::from_str(res).unwrap()
}

pub async fn list_dbs() {
  // TODO after IaSQL-on-IaSQL expose connection string and display
  // everything in a table
  let dbs = get_dbs().await;
  if dbs.len() == 0 {
    println!("{}", NO_DBS);
  } else {
    println!("{}", dbs.join("\n"));
  }
}

pub async fn remove_db() {
  // TODO figure out better ux/naming
  let dbs = get_dbs().await;
  if dbs.len() == 0 {
    return println!("{}", NO_DBS);
  }
  let selection = dlg::select_with_default("Pick IaSQL db:", &dbs, 0);
  let db = &dbs[selection];
  let resp = get_v1_db(&format!("remove/{}", db)).await;
  let res = match &resp {
    Ok(r) => r,
    Err(e) => {
      println!("Err: {:?}", e);
      std::process::exit(1);
    }
  };
  let body: String = serde_json::from_str(res).unwrap();
  println!("{}", body);
}

pub async fn apply_db() {
  // TODO figure out better ux/naming
  let dbs = get_dbs().await;
  if dbs.len() == 0 {
    return println!("{}", NO_DBS);
  }
  let selection = dlg::select_with_default("Pick IaSQL db:", &dbs, 0);
  let db = &dbs[selection];
  let resp = get_v1_db(&format!("apply/{}", db)).await;
  let res = match &resp {
    Ok(r) => r,
    Err(e) => {
      println!("Err: {:?}", e);
      std::process::exit(1);
    }
  };
  let body: String = serde_json::from_str(res).unwrap();
  println!("{}", body);
}

pub async fn add_db() {
  let regions = &get_aws_regions();
  let default = regions.iter().position(|s| s == "us-east-2").unwrap_or(0);
  let selection = dlg::select_with_default("Pick AWS region", regions, default);
  let region = &regions[selection];
  let aws_cli_creds = get_aws_cli_creds();
  let (access_key, secret) = if aws_cli_creds.is_ok()
    && dlg::confirm_with_default(
      "Default AWS CLI credentials found. Do you wish to use those?",
      true,
    ) {
    let creds = aws_cli_creds.unwrap().default;
    (creds.aws_access_key_id, creds.aws_secret_access_key)
  } else {
    let access_key: String = dlg::input("AWS Access Key ID");
    let secret: String = dlg::input("AWS Secret Access Key");
    (access_key, secret)
  };
  let db_alias: String = dlg::input("IaSQL DB Alias");

  let sp = ProgressBar::new_spinner();
  sp.enable_steady_tick(10);
  sp.set_message("Creating an IaSQL instance to manage your AWS account");
  let body = json!({
    "dbAlias": db_alias,
    "awsRegion": region,
    "awsAccessKeyId": access_key,
    "awsSecretAccessKey": secret,
  });
  let resp = post_v1_db("add", body).await;
  match &resp {
    Ok(r) => {
      println!("{}", r);
    }
    Err(e) => {
      println!("Err: {:?}", e);
      std::process::exit(1);
    }
  };
}

async fn get_v1_db(endpoint: &str) -> Result<String, PostV1Error> {
  let url = get_url();
  let req = Request::get(format!("{}/v1/db/{}", url, endpoint))
    .header("Authorization", format!("Bearer {}", get_token()))
    .body(Body::empty());
  let req = match req {
    Ok(r) => r,
    Err(e) => return Err(PostV1Error::Other(e.to_string())),
  };
  return req_v1_db(req).await;
}

async fn post_v1_db(endpoint: &str, body: Value) -> Result<String, PostV1Error> {
  let url = get_url();
  let req = Request::post(format!("{}/v1/db/{}", url, endpoint))
    .header("Content-Type", "application/json")
    .header("Authorization", format!("Bearer {}", get_token()))
    .body(body.to_string().into());
  let req = match req {
    Ok(req) => req,
    Err(e) => return Err(PostV1Error::Other(e.to_string())),
  };
  return req_v1_db(req).await;
}

async fn req_v1_db(req: Request<Body>) -> Result<String, PostV1Error> {
  let resp = CLIENT.request(req).await;
  let mut resp = match resp {
    Ok(resp) => resp,
    Err(e) => return Err(PostV1Error::Other(e.to_string())),
  };
  let data = hyper::body::to_bytes(resp.body_mut()).await;
  let data = match data {
    Ok(data) => data,
    Err(e) => return Err(PostV1Error::Other(e.to_string())),
  };
  let data_str = String::from_utf8(data.to_vec());
  let data_str = match data_str {
    Ok(data_str) => data_str,
    Err(e) => return Err(PostV1Error::Other(e.to_string())),
  };
  return match resp.status() {
    st if st.is_success() => Ok(data_str),
    StatusCode::REQUEST_TIMEOUT => Err(PostV1Error::Timeout),
    StatusCode::FORBIDDEN => Err(PostV1Error::Forbidden),
    StatusCode::CONFLICT => Err(PostV1Error::Conflict),
    _ => Err(PostV1Error::Other(data_str.to_string())),
  };
}
