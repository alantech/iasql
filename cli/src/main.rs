use std::env;

use clap::{crate_name, crate_version, App, AppSettings, SubCommand};

use iasql::api::{add_db, apply_db, list_dbs, remove_db};
use iasql::auth::{login, logout};

extern crate iasql;

#[tokio::main]
pub async fn main() {
  // TODO add non-interactive mode support via parameters
  let app = App::new(crate_name!())
    .version(crate_version!())
    .setting(AppSettings::SubcommandRequiredElseHelp)
    .subcommands(vec![
      SubCommand::with_name("login"),
      SubCommand::with_name("db")
        .setting(AppSettings::SubcommandRequiredElseHelp)
        .alias("database")
        .subcommand(SubCommand::with_name("list"))
        .subcommand(SubCommand::with_name("add"))
        .subcommand(SubCommand::with_name("remove"))
        .subcommand(SubCommand::with_name("apply")),
      SubCommand::with_name("logout"),
    ]);

  let matches = app.get_matches();
  match matches.subcommand() {
    ("db", Some(sub_matches)) => {
      login(false, false).await;
      match sub_matches.subcommand() {
        ("list", _) => list_dbs().await,
        ("add", _) => add_db().await,
        ("remove", _) => remove_db().await,
        ("apply", _) => apply_db().await,
        // rely on AppSettings::SubcommandRequiredElseHelp
        _ => {}
      };
    }
    ("login", _) => {
      login(false, true).await;
    }
    ("logout", _) => {
      logout();
    }
    // rely on AppSettings::SubcommandRequiredElseHelp
    _ => {}
  }
}
