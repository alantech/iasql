use std::env;

use clap::{crate_name, crate_version, App, AppSettings, SubCommand};

use iasql::api::db;
use iasql::auth;

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
        .subcommands(vec![
          SubCommand::with_name("list"),
          SubCommand::with_name("add"),
          SubCommand::with_name("remove"),
          SubCommand::with_name("apply"),
        ]),
      SubCommand::with_name("logout"),
    ]);

  let matches = app.get_matches();
  match matches.subcommand() {
    ("db", Some(sub_matches)) => {
      auth::login(false).await;
      match sub_matches.subcommand() {
        ("list", _) => db::list().await,
        ("add", _) => db::add().await,
        ("remove", _) => db::remove().await,
        ("apply", _) => db::apply().await,
        // rely on AppSettings::SubcommandRequiredElseHelp
        _ => {}
      };
    }
    ("login", _) => {
      auth::login(true).await;
    }
    ("logout", _) => {
      auth::logout();
    }
    // rely on AppSettings::SubcommandRequiredElseHelp
    _ => {}
  }
}
