
use std::{fs, path::PathBuf};

use clap::Parser;
use owo_colors::{OwoColorize};

#[derive(Debug,Parser)]
#[command(version, about, long_about="This clean any cache in your directory")]
struct CLI {
    path: Option<PathBuf>
}

fn main() {
    let cli = CLI::parse();
    let path = cli.path.unwrap_or(PathBuf::from("."));
    println!("{:?}", &path);
    
    if let Ok(does_exists) = fs::exists(&path) {
        if does_exists {
            print!(
                "{:?}, this path exists", &path
            )
        } 
        else {
            print!("{:?}", "Path does not exists".red());
        }
    }
    else {
        print!("{:?}, Error reading directory", &path);
    }
}
