use dialoguer::console::{style, StyledObject};
use dialoguer::{theme::ColorfulTheme, Confirm, Input, MultiSelect, Select, Validator};

pub fn bold(el: &str) -> StyledObject<String> {
  style(format!("{}", el)).bold()
}

pub fn green(el: &str) -> StyledObject<String> {
  style(format!("{}", el)).green()
}

pub fn multiselect(prompt: &str, items: &Vec<String>) -> Vec<usize> {
  // Override ColorfulTheme multiselect default styling for better UX
  // checked_item_prefix: style("✔".to_string()).for_stderr().green(),
  // unchecked_item_prefix: style("✔".to_string()).for_stderr().black(),
  let theme = ColorfulTheme {
    checked_item_prefix: style(format!(" [{}]", green("✔"))).for_stderr(),
    unchecked_item_prefix: style(" [ ]".to_string()).for_stderr(),
    ..ColorfulTheme::default()
  };
  MultiSelect::with_theme(&theme)
    .with_prompt(prompt)
    .items(items)
    .interact()
    .unwrap()
}

pub fn select_with_default(prompt: &str, items: &Vec<String>, default: usize) -> usize {
  Select::with_theme(&ColorfulTheme::default())
    .with_prompt(prompt)
    .items(items)
    .default(default)
    .interact()
    .unwrap()
}

pub fn input_with_default_and_validation(
  prompt: &str,
  default: String,
  validator: impl Validator<String>,
) -> String {
  Input::with_theme(&ColorfulTheme::default())
    .with_prompt(prompt)
    .validate_with(validator)
    .default(default)
    .interact_text()
    .unwrap()
}

pub fn input_with_validation(prompt: &str, validator: impl Validator<String>) -> String {
  Input::with_theme(&ColorfulTheme::default())
    .with_prompt(prompt)
    .validate_with(validator)
    .interact_text()
    .unwrap()
}

pub fn confirm_with_default(prompt: &str, default: bool) -> bool {
  Confirm::with_theme(&ColorfulTheme::default())
    .with_prompt(prompt)
    .default(default)
    .interact()
    .unwrap()
}

pub fn input(prompt: &str) -> String {
  Input::with_theme(&ColorfulTheme::default())
    .with_prompt(prompt)
    .interact_text()
    .unwrap()
}

pub fn input_with_initial_text(prompt: &str, initial_text: String) -> String {
  Input::with_theme(&ColorfulTheme::default())
    .with_prompt(prompt)
    .with_initial_text(initial_text)
    .interact_text()
    .unwrap()
}

pub fn input_with_default(prompt: &str, default: String) -> String {
  Input::with_theme(&ColorfulTheme::default())
    .with_prompt(prompt)
    .default(default)
    .interact_text()
    .unwrap()
}

pub fn input_with_allow_empty_as_result(
  prompt: &str,
  allow_empty: bool,
) -> std::io::Result<String> {
  Input::with_theme(&ColorfulTheme::default())
    .with_prompt(prompt)
    .allow_empty(allow_empty)
    .interact_text()
}
