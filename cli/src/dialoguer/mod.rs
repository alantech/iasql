use dialoguer::{
  console::{style, StyledObject},
  Confirm, Input, MultiSelect, Select, Validator,
};
use theme::ColorfulTheme;

pub mod theme;

pub fn bold(el: &str) -> StyledObject<String> {
  style(format!("{}", el)).bold()
}

pub fn red(el: &str) -> StyledObject<String> {
  style(format!("{}", el)).red()
}

pub fn green(el: &str) -> StyledObject<String> {
  style(format!("{}", el)).green()
}

pub fn gray(el: &str) -> StyledObject<String> {
  style(format!("{}", el)).black().bright()
}

pub fn yellow(el: &str) -> StyledObject<String> {
  style(format!("{}", el)).yellow()
}

pub fn white(el: &str) -> StyledObject<String> {
  style(format!("{}", el)).white()
}

pub fn warn_prefix() -> StyledObject<String> {
  let t = &ColorfulTheme::default();
  t.warn_prefix.clone()
}

pub fn err_prefix() -> StyledObject<String> {
  let t = &ColorfulTheme::default();
  t.error_prefix.clone()
}

pub fn success_prefix() -> StyledObject<String> {
  let t = &ColorfulTheme::default();
  t.success_prefix.clone()
}

pub fn divider() -> StyledObject<String> {
  let t = &ColorfulTheme::default();
  t.success_suffix.clone()
}

pub fn multiselect(prompt: &str, items: &Vec<String>) -> Vec<usize> {
  MultiSelect::with_theme(&ColorfulTheme::default())
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
