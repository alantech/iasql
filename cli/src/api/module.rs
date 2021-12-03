use ascii_table::{AsciiTable, Column};
use futures::future::join_all;
use serde::{Deserialize, Serialize};
use serde_json::json;

use std::fmt::Display;
use std::process::exit;

use crate::dialoguer as dlg;
use crate::http::post_v1;

#[derive(Deserialize, Debug, Clone, Serialize)]
struct Module {
  name: String,
  dependencies: Vec<String>,
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
        "{} {} {} {}",
        dlg::err_prefix(),
        dlg::bold("Failed to list modules"),
        dlg::divider(),
        e.message
      );
      exit(1);
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

// Gets and validates mods to remove or prompts selection
pub async fn mods_to_remove(db: &str, mods_opt: Option<Vec<String>>) -> Vec<String> {
  let futs = vec![list_mods(None), list_mods(Some(db))];
  let res = join_all(futs).await;
  let all_infos = &res[0];
  let installed_infos = &res[1];
  let all: Vec<String> = all_infos.iter().map(|m| m.name.clone()).collect();
  let installed: Vec<String> = installed_infos.iter().map(|m| m.name.clone()).collect();
  if installed.len() == 0 {
    print!(
      "{} {} {} {}",
      dlg::warn_prefix(),
      dlg::bold("No modules have been installed in db"),
      dlg::divider(),
      dlg::red(db),
    );
    exit(0);
  }
  let mods = if mods_opt.is_none() {
    let idxs = dlg::multiselect(
      "Use arrows to move, space to (de)select modules and enter to submit",
      &installed,
    );
    if idxs.len() == 0 {
      println!(
        "{} {} {} {}",
        dlg::warn_prefix(),
        dlg::bold("No modules selected for removal from db"),
        dlg::divider(),
        dlg::yellow(db),
      );
      exit(0);
    }
    installed
      .into_iter()
      .enumerate()
      .filter(|(i, _)| idxs.contains(&i))
      .map(|(_, e)| e)
      .collect()
  } else {
    let mods = mods_opt.unwrap();
    // check provided mods exist
    let inexistent = mods.iter().find(|e| !all.contains(e));
    if inexistent.is_some() {
      eprint!(
        "{} {} {} {}",
        dlg::err_prefix(),
        dlg::bold("Nonexistent module"),
        dlg::divider(),
        dlg::red(inexistent.unwrap()),
      );
      exit(1);
    }
    // check provided modules are installed
    let missing = mods.iter().find(|e| !installed.contains(e));
    if missing.is_some() {
      eprintln!(
        "{} {} {} {}",
        dlg::err_prefix(),
        dlg::bold("Module already removed"),
        dlg::divider(),
        dlg::red(missing.unwrap()),
      );
      exit(1);
    }
    mods
  };
  // check no module is depended on by remaining modules
  for md in installed_infos.into_iter() {
    if !mods.contains(&md.name) {
      for dmd in &md.dependencies {
        if mods.contains(&dmd) {
          eprintln!(
            "{} {} {} {} {} {}",
            dlg::err_prefix(),
            dlg::bold("Installed module"),
            dlg::gray(&md.name),
            dlg::bold("depends on module selected for removal"),
            dlg::divider(),
            dlg::red(&dmd),
          );
          exit(1);
        }
      }
    }
  }
  mods
}

// Gets and validates mods to install or prompts selection
pub async fn mods_to_install(db: &str, mods_opt: Option<Vec<String>>) -> Vec<String> {
  let futs = vec![list_mods(None), list_mods(Some(db))];
  let res = join_all(futs).await;
  let all_infos = &res[0];
  let all: Vec<String> = all_infos.iter().map(|m| m.name.clone()).collect();
  let installed: Vec<String> = res[1].iter().map(|m| m.name.clone()).collect();
  if all.len() == installed.len() {
    println!(
      "{} {}",
      dlg::warn_prefix(),
      dlg::bold("All available modules are installed")
    );
    exit(0);
  };
  let mut mods = if mods_opt.is_none() {
    let available = all.into_iter().filter(|x| !installed.contains(x)).collect();
    let idxs = dlg::multiselect(
      "Use arrows to move, space to (de)select modules and enter to submit",
      &available,
    );
    if idxs.len() == 0 {
      println!(
        "{} {} {} {}",
        dlg::warn_prefix(),
        dlg::bold("No modules selected for installation in db"),
        dlg::divider(),
        dlg::yellow(db),
      );
      exit(0);
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
        "{} {} {} {}",
        dlg::err_prefix(),
        dlg::bold("Module name does not exist"),
        dlg::divider(),
        dlg::red(inexistent.unwrap()),
      );
      exit(1);
    }
    let is_installed = mods.iter().find(|e| installed.contains(e));
    if is_installed.is_some() {
      eprintln!(
        "{} {} {} {}",
        dlg::err_prefix(),
        dlg::bold("Module is already installed"),
        dlg::divider(),
        dlg::red(is_installed.unwrap()),
      );
      exit(1);
    }
    mods
  };
  // add dependent modules not explicitly called out
  let mut deps = vec![];
  for md in all_infos.into_iter() {
    if mods.contains(&md.name) {
      for dmd in &md.dependencies {
        if !installed.contains(&dmd) && !mods.contains(&dmd) {
          deps.push(dmd.clone())
        }
      }
    }
  }
  if deps.len() > 0 {
    mods.append(&mut deps);
    println!(
      "{} {} {} {}",
      dlg::success_prefix(),
      dlg::bold("Dependent modules also needed for installation"),
      dlg::divider(),
      dlg::green(&deps.join(&format!("{} ", dlg::white(","))))
    );
  }
  mods
}

pub async fn remove(db: &str, mods: Vec<String>) {
  let removal = dlg::confirm_with_default("Confirm removal", true);
  if !removal {
    println!(
      "{} {} {} {}",
      dlg::warn_prefix(),
      dlg::bold("No modules were removed from db"),
      dlg::divider(),
      dlg::yellow(db),
    );
    exit(0);
  }
  let body = json!({
    "list": mods,
    "dbAlias": db,
  });
  let resp = post_v1("module/remove", body).await;
  match &resp {
    Ok(_) => println!("{} {}", dlg::success_prefix(), dlg::bold("Done")),
    Err(e) => {
      eprintln!(
        "{} {} {} {} {} {}",
        dlg::err_prefix(),
        dlg::bold("Failed to remove modules from db"),
        dlg::divider(),
        dlg::red(db),
        dlg::divider(),
        &e.message
      );
      exit(1);
    }
  };
}

pub async fn install(db: &str, mods: Vec<String>) {
  let installation = dlg::confirm_with_default("Confirm installation", true);
  if !installation {
    println!(
      "{} {} {} {}",
      dlg::warn_prefix(),
      dlg::bold("No modules were installed in db"),
      dlg::divider(),
      dlg::yellow(db),
    );
    exit(0);
  }
  let body = json!({
    "list": mods,
    "dbAlias": db,
  });
  let resp = post_v1("module/install", body).await;
  match &resp {
    Ok(_) => println!("{} {}", dlg::success_prefix(), dlg::bold("Done")),
    Err(e) => {
      eprintln!(
        "{} {} {} {} {} {}",
        dlg::err_prefix(),
        dlg::bold("Failed to install modules in db"),
        dlg::divider(),
        dlg::red(db),
        dlg::divider(),
        &e.message
      );
      exit(1);
    }
  };
}
