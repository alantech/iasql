use std::env;
use std::process::Command;

use clap::{crate_name, crate_version, App, AppSettings, SubCommand};

use iasql::auth::{login, logout};

#[macro_use]
extern crate iasql;

#[tokio::main]
pub async fn main() {
  let app = App::new(crate_name!())
    .version(crate_version!())
    .setting(AppSettings::SubcommandRequiredElseHelp)
    .subcommand(SubCommand::with_name("login"))
      .arg_from_usage("[NON_INTERACTIVE] -n, --non-interactive 'Enables non-interactive CLI mode useful for CI/CD.'")
    .subcommand(SubCommand::with_name("logout")
  );

  let matches = app.get_matches();
  match matches.subcommand() {
    ("login", Some(matches)) => {
      let non_interactive: bool = matches.values_of("NON_INTERACTIVE").is_some();
      login(non_interactive).await;
    }
    ("logout", _) => {
      logout();
    }
    // rely on AppSettings::SubcommandRequiredElseHelp
    _ => {}
  }
}
