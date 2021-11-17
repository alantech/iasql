use dialoguer::console::style;
use serde_json::json;

use crate::api::db::get_dbs;
use crate::dialoguer as dlg;
use crate::http::post_v1;

pub async fn list(db: Option<&str>) {
  let body = if db.is_none() {
    json!({
      "all": true,
    })
  } else {
    json!({
      "installed": true,
      "dbAlias": db.unwrap(),
    })
  };
  let resp = post_v1("module/list", body).await;
  let res = match &resp {
    Ok(r) => r,
    Err(e) => {
      println!("Err: {:?}", e);
      std::process::exit(1);
    }
  };
  let mods: Vec<String> = serde_json::from_str(res).unwrap();
  println!("{}", mods.join("\n"));
}

pub async fn get_or_select_db(db_opt: Option<&str>) -> String {
  let dbs = get_dbs().await;
  if db_opt.is_none() {
    let selection = dlg::select_with_default("Pick IaSQL db:", &dbs, 0);
    let db = &dbs[selection];
    db.clone()
  } else {
    let db = db_opt.unwrap();
    if !dbs.contains(&db.to_owned()) {
      println!("Err: db with name {} does not exist", db);
      std::process::exit(1);
    }
    db.to_string()
  }
}

pub async fn remove(db_opt: Option<&str>, mods: Vec<&str>) {
  let db = get_or_select_db(db_opt).await;
  let prompt = format!(
    "{} to remove the following modules from IaSQL db {}: {}",
    style("Press Enter").bold(),
    style(format!("{}", db)).bold(),
    mods.join(", ")
  );
  let removal = dlg::confirm_with_default(&prompt, true);
  if !removal {
    return println!("Not removing any modules");
  }
  let body = json!({
    "list": mods,
    "dbAlias": db,
  });
  let resp = post_v1("module/remove", body).await;
  match &resp {
    Ok(_) => println!(
      "Successfully removed the following modules from {}: {}",
      style(format!("{}", db)).bold(),
      mods.join(", ")
    ),
    Err(e) => {
      println!("Err: {:?}", e);
      std::process::exit(1);
    }
  };
}

pub async fn install(db_opt: Option<&str>, mods: Vec<&str>) {
  let db = get_or_select_db(db_opt).await;
  let prompt = format!(
    "{} to install the following modules into IaSQL db {}: {}",
    style("Press Enter").bold(),
    style(format!("{}", db)).bold(),
    mods.join(", ")
  );
  let installation = dlg::confirm_with_default(&prompt, true);
  if !installation {
    return println!("Not installing any modules");
  }
  let body = json!({
    "list": mods,
    "dbAlias": db,
  });
  let resp = post_v1("module/install", body).await;
  match &resp {
    Ok(_) => println!(
      "Successfully installed the following modules from {}: {}",
      style(format!("{}", db)).bold(),
      mods.join(", ")
    ),
    Err(e) => {
      println!("Err: {:?}", e);
      std::process::exit(1);
    }
  };
}
