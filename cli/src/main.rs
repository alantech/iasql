use std::env;
use std::process::Command;

use clap::{crate_name, crate_version, App, AppSettings, SubCommand};

use iasql::auth::authenticate;

#[macro_use]
extern crate iasql;

#[tokio::main]
pub async fn main() {
  let app = App::new(crate_name!())
    .version(crate_version!())
    .setting(AppSettings::SubcommandRequiredElseHelp)
    .subcommand(SubCommand::with_name("login"))
      .arg_from_usage("[NON_INTERACTIVE] -n, --non-interactive 'Enables non-interactive CLI mode useful for CI/CD.'");

  let matches = app.get_matches();
  match matches.subcommand() {
    ("login", Some(matches)) => {
      let non_interactive: bool = matches.values_of("NON_INTERACTIVE").is_some();
      authenticate(non_interactive).await;
    }
    // rely on AppSettings::SubcommandRequiredElseHelp
    _ => {}
  }
}
