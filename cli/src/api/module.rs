use serde_json::json;

use crate::api::db::get_dbs;
use crate::dialoguer as dlg;
use crate::http::post_v1;

async fn list_mods(db: Option<&str>) -> Vec<String> {
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
  serde_json::from_str(res).unwrap()
}

pub async fn list(db: Option<&str>) {
  let mods: Vec<String> = list_mods(db).await;
  println!(" - {}", mods.join("\n - "));
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

// Gets and validates mods to remove or prompts selection
pub async fn mods_to_rm(db: &str, mods_opt: Option<Vec<String>>) -> Vec<String> {
  let installed = list_mods(Some(db)).await;
  if installed.len() == 0 {
    println!("No modules have been installed in {}", dlg::bold(db));
    std::process::exit(0);
  }
  let all = list_mods(None).await;
  if mods_opt.is_none() {
    let idxs = dlg::multiselect(
      "Press the Spacebar to (de)select modules to remove and press Enter to submit",
      &installed,
    );
    if idxs.len() == 0 {
      println!("No modules selected");
      std::process::exit(0);
    }
    installed
      .into_iter()
      .enumerate()
      .filter(|(i, _)| idxs.contains(&i))
      .map(|(_, e)| e)
      .collect()
  } else {
    let mods = mods_opt.unwrap();
    let inexistent = mods.iter().find(|e| !all.contains(e));
    if inexistent.is_some() {
      println!(
        "Err: module {} does not exist",
        dlg::bold(inexistent.unwrap())
      );
      std::process::exit(1);
    }
    let is_installed = mods.iter().find(|e| !installed.contains(e));
    if is_installed.is_some() {
      println!(
        "Err: module {} is not installed in {}",
        dlg::bold(db),
        dlg::bold(is_installed.unwrap())
      );
      std::process::exit(1);
    }
    mods
  }
}

// Gets and validates mods to install or prompts selection
pub async fn mods_to_install(db: &str, mods_opt: Option<Vec<String>>) -> Vec<String> {
  let all = list_mods(None).await;
  let installed = list_mods(Some(db)).await;
  if all.len() == installed.len() {
    println!(
      "All available modules have been installed in {}",
      dlg::bold(db)
    );
    std::process::exit(0);
  }
  if mods_opt.is_none() {
    let available = all.into_iter().filter(|x| !installed.contains(x)).collect();
    let idxs = dlg::multiselect(
      "Press the Spacebar to (de)select modules to install and press Enter to submit",
      &available,
    );
    if idxs.len() == 0 {
      println!("No modules selected");
      std::process::exit(0);
    }
    available
      .into_iter()
      .enumerate()
      .filter(|(i, _)| idxs.contains(&i))
      .map(|(_, e)| e)
      .collect()
  } else {
    let mods = mods_opt.unwrap();
    let inexistent = mods.iter().find(|e| !all.contains(e));
    if inexistent.is_some() {
      println!(
        "Err: module {} does not exist",
        dlg::bold(inexistent.unwrap())
      );
      std::process::exit(1);
    }
    let is_installed = mods.iter().find(|e| !installed.contains(e));
    if is_installed.is_some() {
      println!(
        "Err: module {} is already installed in {}",
        dlg::bold(db),
        dlg::bold(is_installed.unwrap())
      );
      std::process::exit(1);
    }
    mods
  }
}

pub async fn remove(db: &str, mods: Vec<String>) {
  let prompt = format!(
    "{} to remove the following modules from IaSQL db {}: {}",
    dlg::bold("Press Enter"),
    dlg::bold(db),
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
      dlg::bold(db),
      mods.join(", ")
    ),
    Err(e) => {
      println!("Err: {:?}", e);
      std::process::exit(1);
    }
  };
}

pub async fn install(db: &str, mods: Vec<String>) {
  let prompt = format!(
    "{} to install the following modules into IaSQL db {}: {}",
    dlg::bold("Press Enter"),
    dlg::bold(db),
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
      dlg::bold(db),
      mods.join(", ")
    ),
    Err(e) => {
      println!("Err: {:?}", e);
      std::process::exit(1);
    }
  };
}
