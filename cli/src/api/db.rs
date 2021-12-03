use ascii_table::{AsciiTable, Column};
use indicatif::ProgressBar;
use serde::{Deserialize, Serialize};
use serde_ini;
use serde_json::json;

use std::collections::HashMap;
use std::fmt::Display;
use std::fs::OpenOptions;
use std::io::BufReader;
use std::process::exit;

use crate::dialoguer as dlg;
use crate::http::{get_v1, post_v1};

#[derive(Deserialize, Debug, Clone, Serialize)]
pub struct AWSCLICredentials {
  aws_access_key_id: String,
  aws_secret_access_key: String,
}

#[derive(Deserialize, Debug, Clone, Serialize)]
#[allow(non_snake_case)]
pub struct AddDbResponse {
  dbId: String,
  dbAlias: String,
  user: String,
  pass: String,
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

fn get_aws_cli_creds() -> Result<HashMap<String, AWSCLICredentials>, String> {
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
      eprintln!(
        "{} {} {} {}",
        dlg::err_prefix(),
        dlg::bold("Failed to get all dbs"),
        dlg::divider(),
        e.message
      );
      exit(1);
    }
  };
  let dbs: Vec<String> = serde_json::from_str(res).unwrap();
  if dbs.len() == 0 {
    println!("{} {}", dlg::warn_prefix(), dlg::bold(NO_DBS));
    exit(0);
  }
  return dbs;
}

pub async fn list() {
  // TODO after IaSQL-on-IaSQL expose connection string
  let dbs = get_dbs().await;
  let mut table = AsciiTable::default();
  table.max_width = 140;
  let column = Column {
    header: "Database Name".into(),
    ..Column::default()
  };
  table.columns.insert(0, column);
  let mut db_data: Vec<Vec<&dyn Display>> = vec![];
  for db in dbs.iter() {
    let mut row: Vec<&dyn Display> = Vec::new();
    row.push(db);
    db_data.push(row);
  }
  table.print(db_data);
}

pub async fn remove() {
  let dbs = get_dbs().await;
  let selection = dlg::select_with_default("Pick IaSQL db:", &dbs, 0);
  let db = &dbs[selection];
  let removal = dlg::confirm_with_default("Press enter to confirm removal", true);
  if !removal {
    println!(
      "{} {} {} {}",
      dlg::warn_prefix(),
      dlg::bold("Did not remove db"),
      dlg::divider(),
      dlg::yellow(db)
    );
    exit(0);
  }
  let resp = get_v1(&format!("db/remove/{}", db)).await;
  match &resp {
    Ok(_) => println!("{} {}", dlg::success_prefix(), dlg::bold("Done")),
    Err(e) => {
      eprintln!(
        "{} {} {} {} {} {}",
        dlg::err_prefix(),
        dlg::bold("Failed to remove db"),
        dlg::divider(),
        dlg::red(db),
        dlg::divider(),
        e.message
      );
      exit(1);
    }
  };
}

pub async fn apply() {
  let dbs = get_dbs().await;
  if dbs.len() == 0 {
    return println!("{} {}", dlg::warn_prefix(), NO_DBS);
  }
  let selection = dlg::select_with_default("Pick IaSQL db:", &dbs, 0);
  let db = &dbs[selection];
  let resp = get_v1(&format!("db/apply/{}", db)).await;
  match &resp {
    Ok(_) => println!("{} {}", dlg::success_prefix(), dlg::bold("Done")),
    Err(e) => {
      eprintln!(
        "{} {} {} {} {} {}",
        dlg::err_prefix(),
        dlg::bold("Failed to run apply on db"),
        dlg::divider(),
        dlg::red(db),
        dlg::divider(),
        e.message
      );
      exit(1);
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
    let all_creds = aws_cli_creds.unwrap();
    let profiles: Vec<String> = all_creds.keys().cloned().collect();
    let selection = if profiles.len() > 1 {
      dlg::select_with_default("Pick AWS Profile", &profiles, 0)
    } else {
      0
    };
    let creds = all_creds.get(&profiles[selection]).unwrap();
    (
      creds.aws_access_key_id.clone(),
      creds.aws_secret_access_key.clone(),
    )
  } else {
    let access_key: String = dlg::input("AWS Access Key ID");
    let secret: String = dlg::input("AWS Secret Access Key");
    (access_key, secret)
  };
  let db: String = dlg::input("IaSQL db name");

  let sp = ProgressBar::new_spinner();
  sp.enable_steady_tick(10);
  sp.set_message("Creating an IaSQL db to manage your AWS account");
  let body = json!({
    "dbAlias": db,
    "awsRegion": region,
    "awsAccessKeyId": access_key,
    "awsSecretAccessKey": secret,
  });
  let resp = post_v1("db/add", body).await;
  sp.finish_and_clear();
  match &resp {
    Ok(res) => {
      let db_metadata: AddDbResponse = serde_json::from_str(res).unwrap();
      println!("{} {}", dlg::success_prefix(), dlg::bold("Done"));
      let mut table = AsciiTable::default();
      table.max_width = 140;
      table.columns.insert(
        0,
        Column {
          header: "IaSQL Server".to_string(),
          ..Column::default()
        },
      );
      table.columns.insert(
        1,
        Column {
          header: "Database".to_string(),
          ..Column::default()
        },
      );
      table.columns.insert(
        2,
        Column {
          header: "Username".to_string(),
          ..Column::default()
        },
      );
      table.columns.insert(
        3,
        Column {
          header: "Password".to_string(),
          ..Column::default()
        },
      );
      let server = format!("{}", dlg::bold("db.iasql.com"));
      let db = format!("{}", dlg::bold(&db_metadata.dbId));
      let user = format!("{}", dlg::bold(&db_metadata.user));
      let pass = format!("{}", dlg::bold(&db_metadata.pass));
      let db_data = vec![vec![&server, &db, &user, &pass]];
      table.print(db_data);
      println!(
        "{} {}",
        dlg::warn_prefix(),
        dlg::bold(
          "This is the only time we will show you these credentials, be sure to save them.",
        ),
      );
    }
    Err(e) => {
      eprintln!(
        "{} {} {} {} {} {}",
        dlg::err_prefix(),
        dlg::bold("Failed to add db"),
        dlg::divider(),
        dlg::red(&db),
        dlg::divider(),
        e.message
      );
      exit(1);
    }
  };
}
