use std::env;

use clap::{crate_name, crate_version, App, AppSettings, SubCommand};

use iasql::api::{add_db, check_db, list_dbs, stop_db};
use iasql::auth::{login, logout};

extern crate iasql;

#[tokio::main]
pub async fn main() {
  let app = App::new(crate_name!())
    .version(crate_version!())
    .setting(AppSettings::SubcommandRequiredElseHelp)
    .subcommand(SubCommand::with_name("list"))
    .subcommand(SubCommand::with_name("add"))
    .subcommand(SubCommand::with_name("stop"))
    .subcommand(SubCommand::with_name("check")
      .arg_from_usage("[NON_INTERACTIVE] -n, --non-interactive 'Enables non-interactive CLI mode useful for CI/CD.'")
    )
    .subcommand(SubCommand::with_name("login")
      .arg_from_usage("[NON_INTERACTIVE] -n, --non-interactive 'Enables non-interactive CLI mode useful for CI/CD.'")
    )
    .subcommand(SubCommand::with_name("logout")
  );

  let matches = app.get_matches();
  match matches.subcommand() {
    ("list", _) => {
      login(false, false).await;
      list_dbs().await;
    }
    ("add", _) => {
      login(false, false).await;
      add_db().await;
    }
    ("stop", _) => {
      login(false, false).await;
      stop_db().await;
    }
    ("check", Some(matches)) => {
      let non_interactive: bool = matches.values_of("NON_INTERACTIVE").is_some();
      login(non_interactive, false).await;
      check_db().await;
    }
    ("login", Some(matches)) => {
      let non_interactive: bool = matches.values_of("NON_INTERACTIVE").is_some();
      login(non_interactive, true).await;
    }
    ("logout", _) => {
      logout();
    }
    // rely on AppSettings::SubcommandRequiredElseHelp
    _ => {}
  }
}
