use std::env;

use clap::{crate_description, crate_name, crate_version, App, AppSettings, Arg, SubCommand};

use iasql::api::{db, module};
use iasql::auth;

extern crate iasql;

#[tokio::main]
pub async fn main() {
  // TODO add non-interactive mode support via parameters
  let app = App::new(crate_name!())
    .version(crate_version!())
    .about(crate_description!())
    .setting(AppSettings::SubcommandRequiredElseHelp)
    .subcommands(vec![
      SubCommand::with_name("login").about("Obtain and save credentials for the IaSQL service"),
      SubCommand::with_name("start")
        .about("Start managing cloud resources from an account via a new PG db")
        .arg(Arg::from_usage("[db]")),
      SubCommand::with_name("import")
        .about("Create a db from a previously exported dump")
        .arg(Arg::from_usage("[db]"))
        .arg(Arg::from_usage("[dump_file]")),
      SubCommand::with_name("export")
        .about("Export a db dump to backup your infrastructure or import it into another db")
        .arg(Arg::from_usage("[conn_str]"))
        .arg(Arg::from_usage("[dump_file]")),
      SubCommand::with_name("stop")
        .about("Stop managing cloud resources in an account and drop the PG db")
        .arg(Arg::from_usage("[db]")),
      SubCommand::with_name("apply")
        .about("Create, delete or update the resources in a db")
        .arg(Arg::from_usage("[db]")),
      SubCommand::with_name("plan")
        .about("Display a preview of the resources in a db to be modified on the next `apply`")
        .arg(Arg::from_usage("[db]")),
      SubCommand::with_name("add")
        .about("Add tables corresponding to a cloud service, or module, in a PG db")
        .arg(Arg::from_usage("--db=[DB]"))
        .arg(Arg::with_name("modules").min_values(1)),
      SubCommand::with_name("remove")
        .about("Remove tables corresponding to a cloud service, or module, in a PG db")
        .arg(Arg::from_usage("--db=[DB]"))
        .arg(Arg::with_name("modules").min_values(1)),
      SubCommand::with_name("logout")
        .about("Remove locally-stored credentials for the IaSQL service"),
      SubCommand::with_name("dbs")
        .alias("databases")
        .about("List all dbs"),
      SubCommand::with_name("mods")
        .alias("modules")
        .about("List all modules or list the modules installed in a given database")
        .arg(Arg::from_usage("[db]")),
    ]);

  let matches = app.get_matches();
  if let Some("logout") = matches.subcommand_name() {
    return auth::logout();
  } else if let Some("login") = matches.subcommand_name() {
    return auth::login(true).await;
  } else {
    auth::login(false).await;
  };
  match matches.subcommand() {
    ("new", Some(s_matches)) => {
      let db = db::get_or_input_db(s_matches.value_of("db")).await;
      db::new(&db).await
    }
    ("import", Some(s_matches)) => {
      let db = db::get_or_input_db(s_matches.value_of("db")).await;
      let dump_file = db::get_or_input_arg(s_matches.value_of("dump_file"), "Dump file");
      db::import(&db, &dump_file).await
    }
    ("export", Some(s_matches)) => {
      let conn_str = db::get_or_input_arg(s_matches.value_of("conn_str"), "PG connection string");
      let dump_file = db::get_or_input_arg(s_matches.value_of("dump_file"), "Dump file");
      db::export(conn_str, dump_file);
    }
    ("remove", Some(s_matches)) => {
      let db = db::get_or_select_db(s_matches.value_of("db")).await;
      db::remove(&db).await
    }
    ("apply", Some(s_matches)) => {
      let db = db::get_or_select_db(s_matches.value_of("db")).await;
      db::apply(&db).await
    }
    ("plan", Some(s_matches)) => {
      let db = db::get_or_select_db(s_matches.value_of("db")).await;
      db::plan(&db).await
    }
    ("dbs", _) => {
      db::list().await;
    }
    ("mods", Some(s_matches)) => {
      module::list(s_matches.value_of("db")).await;
    }
    ("install", Some(s_matches)) => {
      let db = db::get_or_select_db(s_matches.value_of("db")).await;
      let modules = module::mods_to_install(&db, s_matches.values_of_lossy("modules")).await;
      module::install(&db, modules).await;
    }
    ("uninstall", Some(s_matches)) => {
      let db = db::get_or_select_db(s_matches.value_of("db")).await;
      let modules = module::mods_to_remove(&db, s_matches.values_of_lossy("modules")).await;
      module::uninstall(&db, modules).await;
    }
    // rely on AppSettings::SubcommandRequiredElseHelp
    _ => {}
  }
}
