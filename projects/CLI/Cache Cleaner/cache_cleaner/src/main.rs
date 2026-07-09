
use std::{fs::{self}, path::PathBuf};

use clap::Parser;
use owo_colors::{OwoColorize};
use tabled::{Table, settings::{Color, Style as TableStyle, object::{Columns, Rows}},};
pub mod directory;



use crossterm::event;

fn main() -> std::io::Result<()> {
    ratatui::run(|mut terminal| {
        loop {
            terminal.draw(|frame| frame.render_widget("Hello World!", frame.area()))?;
            if event::read()?.is_key_press() {
                break Ok(());
            }
        }
    })
}


