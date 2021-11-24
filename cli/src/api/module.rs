use ascii_table::{AsciiTable, Column};
use serde::{Deserialize, Serialize};
use serde_json::json;

use std::fmt::Display;

use crate::api::db::get_dbs;
use crate::dialoguer as dlg;
use crate::http::post_v1;

#[derive(Deserialize, Debug, Clone, Serialize)]
struct Module {
  name: String,
  dependencies: Vec<String>,
}

async fn list_mod_names(db: Option<&str>) -> Vec<String> {
  list_mods(db).await.into_iter().map(|m| m.name).collect()
}

async fn list_mods(db: Option<&str>) -> Vec<Module> {
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
      eprintln!(
        "{} Failed to list modules: {}",
        dlg::err_prefix(),
        e.message
      );
      std::process::exit(1);
    }
  };
  serde_json::from_str(res).unwrap()
}

pub async fn list(db: Option<&str>) {
  let mut table = AsciiTable::default();
  table.max_width = 140;
  let column = Column {
    header: "Module Name".into(),
    ..Column::default()
  };
  table.columns.insert(0, column);
  let column = Column {
    header: "Dependent Modules".into(),
    ..Column::default()
  };
  table.columns.insert(1, column);
  struct DisplayMod {
    name: String,
    dependencies: String,
  }
  let mods: Vec<DisplayMod> = list_mods(db)
    .await
    .iter()
    .map(|m| DisplayMod {
      name: m.name.clone(),
      dependencies: m.dependencies.join(", "),
    })
    .collect();
  let mut mod_data: Vec<Vec<&dyn Display>> = vec![];
  for m in mods.iter() {
    let mut row: Vec<&dyn Display> = Vec::new();
    row.push(&m.name);
    row.push(&m.dependencies);
    mod_data.push(row);
  }
  table.print(mod_data);
}

pub async fn get_or_select_db(db_opt: Option<&str>) -> String {
  let dbs = get_dbs().await;
  if db_opt.is_none() {
    let selection = dlg::select_with_default("Pick IaSQL db", &dbs, 0);
    let db = &dbs[selection];
    db.clone()
  } else {
    let db = db_opt.unwrap();
    if !dbs.contains(&db.to_owned()) {
      eprintln!(
        "{} No db with the name {} exists",
        dlg::err_prefix(),
        dlg::bold(db)
      );
      std::process::exit(1);
    }
    db.to_string()
  }
}

// Gets and validates mods to remove or prompts selection
pub async fn mods_to_rm(db: &str, mods_opt: Option<Vec<String>>) -> Vec<String> {
  let installed = list_mod_names(Some(db)).await;
  if installed.len() == 0 {
    print!(
      "{} No modules have been installed in db {}",
      dlg::warn_prefix(),
      dlg::bold(db)
    );
    std::process::exit(0);
  }
  let all = list_mod_names(None).await;
  if mods_opt.is_none() {
    let idxs = dlg::multiselect(
      "Use arrows to move, space to (de)select modules and enter to submit",
      &installed,
    );
    if idxs.len() == 0 {
      println!("{} No modules selected", dlg::warn_prefix());
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
      eprint!(
        "{} No module with the name {} exists",
        dlg::err_prefix(),
        dlg::bold(inexistent.unwrap())
      );
      std::process::exit(1);
    }
    let missing = mods.iter().find(|e| !installed.contains(e));
    if missing.is_some() {
      eprintln!(
        "{} Module {} is not installed in db {}",
        dlg::err_prefix(),
        dlg::bold(missing.unwrap()),
        dlg::bold(db)
      );
      std::process::exit(1);
    }
    mods
  }
}

// Gets and validates mods to install or prompts selection
pub async fn mods_to_install(db: &str, mods_opt: Option<Vec<String>>) -> Vec<String> {
  let all = list_mod_names(None).await;
  let installed = list_mod_names(Some(db)).await;
  if all.len() == installed.len() {
    println!(
      "{} db {} has all available modules installed",
      dlg::warn_prefix(),
      dlg::bold(db)
    );
    std::process::exit(0);
  }
  if mods_opt.is_none() {
    let available = all.into_iter().filter(|x| !installed.contains(x)).collect();
    let idxs = dlg::multiselect(
      "Use arrows to move, space to (de)select modules and enter to submit",
      &available,
    );
    if idxs.len() == 0 {
      println!("{} No modules selected", dlg::warn_prefix());
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
      eprintln!(
        "{} No module with the name {} exists",
        dlg::err_prefix(),
        dlg::bold(inexistent.unwrap())
      );
      std::process::exit(1);
    }
    let is_installed = mods.iter().find(|e| installed.contains(e));
    if is_installed.is_some() {
      eprintln!(
        "{} Module {} is already installed in db {}",
        dlg::err_prefix(),
        dlg::bold(is_installed.unwrap()),
        dlg::bold(db)
      );
      std::process::exit(1);
    }
    mods
  }
}

pub async fn remove(db: &str, mods: Vec<String>) {
  let prompt = format!(
    "{} to remove the following modules from db {}: {}",
    dlg::bold("Press Enter"),
    dlg::bold(db),
    mods.join(", ")
  );
  let removal = dlg::confirm_with_default(&prompt, true);
  if !removal {
    return println!("{} Not removing any modules", dlg::warn_prefix());
  }
  let body = json!({
    "list": mods,
    "dbAlias": db,
  });
  let resp = post_v1("module/remove", body).await;
  match &resp {
    Ok(_) => println!(
      "{} Removed the following modules from db {}: {}",
      dlg::success_prefix(),
      dlg::bold(db),
      mods.join(", ")
    ),
    Err(e) => {
      eprintln!(
        "{} Failed to remove modules: {}",
        dlg::err_prefix(),
        e.message
      );
      std::process::exit(1);
    }
  };
}

pub async fn install(db: &str, mods: Vec<String>) {
  let prompt = format!(
    "{} to install the following modules into db {}: {}",
    dlg::bold("Press Enter"),
    dlg::bold(db),
    mods.join(", ")
  );
  let installation = dlg::confirm_with_default(&prompt, true);
  if !installation {
    return println!("{} Not installing any modules", dlg::warn_prefix());
  }
  let body = json!({
    "list": mods,
    "dbAlias": db,
  });
  let resp = post_v1("module/install", body).await;
  match &resp {
    Ok(_) => println!(
      "{} Installed the following modules in db {}: {}",
      dlg::success_prefix(),
      dlg::bold(db),
      mods.join(", ")
    ),
    Err(e) => {
      eprintln!(
        "{} Failed to install modules: {}",
        dlg::err_prefix(),
        e.message
      );
      std::process::exit(1);
    }
  };
}
