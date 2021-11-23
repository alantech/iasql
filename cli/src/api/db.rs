use indicatif::ProgressBar;
use serde::{Deserialize, Serialize};
use serde_ini;
use serde_json::json;

use std::fs::OpenOptions;
use std::io::BufReader;

use crate::dialoguer as dlg;
use crate::http::{get_v1, post_v1};

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

pub async fn get_dbs() -> Vec<String> {
  let resp = get_v1("db/list").await;
  let res = match &resp {
    Ok(r) => r,
    Err(e) => {
      println!("Err: {:?}", e);
      std::process::exit(1);
    }
  };
  let dbs: Vec<String> = serde_json::from_str(res).unwrap();
  if dbs.len() == 0 {
    println!("{}", NO_DBS);
    std::process::exit(1);
  }
  return dbs;
}

pub async fn list() {
  // TODO after IaSQL-on-IaSQL expose connection string and display
  // everything in a table
  let dbs = get_dbs().await;
  println!("{}", dlg::bold("IaSQL dbs:"));
  println!(" - {}", dbs.join("\n - "));
}

pub async fn remove() {
  let dbs = get_dbs().await;
  let selection = dlg::select_with_default("Pick IaSQL db:", &dbs, 0);
  let db = &dbs[selection];
  let prompt = format!(
    "{} to remove the {} IaSQL db",
    dlg::bold("Press Enter"),
    dlg::bold(db)
  );
  let removal = dlg::confirm_with_default(&prompt, true);
  if !removal {
    return println!("Not removing {} IaSQL db", dlg::bold(db));
  }
  let resp = get_v1(&format!("db/remove/{}", db)).await;
  match &resp {
    Ok(_) => println!("Successfully removed {} IaSQL db", dlg::bold(db),),
    Err(e) => {
      println!("Err: {:?}", e);
      std::process::exit(1);
    }
  };
}

pub async fn apply() {
  let dbs = get_dbs().await;
  if dbs.len() == 0 {
    return println!("{}", NO_DBS);
  }
  let selection = dlg::select_with_default("Pick IaSQL db:", &dbs, 0);
  let db = &dbs[selection];
  let resp = get_v1(&format!("db/apply/{}", db)).await;
  match &resp {
    Ok(_) => println!("Successfully applied {} db", dlg::bold(db),),
    Err(e) => {
      println!("Err: {:?}", e);
      std::process::exit(1);
    }
  };
}

pub async fn add() {
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
  let db: String = dlg::input("IaSQL db name");

  let sp = ProgressBar::new_spinner();
  sp.enable_steady_tick(10);
  sp.set_message("Creating an IaSQL instance to manage your AWS account");
  let body = json!({
    "dbAlias": db,
    "awsRegion": region,
    "awsAccessKeyId": access_key,
    "awsSecretAccessKey": secret,
  });
  let resp = post_v1("db/add", body).await;
  match &resp {
    Ok(_) => {
      sp.finish_with_message(&format!("Successfully added {} db", dlg::bold(&db),));
    }
    Err(e) => {
      sp.finish_with_message(&format!("Err: {:?}", e));
      std::process::exit(1);
    }
  };
}
