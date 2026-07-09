
use std::{fs::{self}, path::{Path, PathBuf}};

use chrono::{DateTime, Utc};
use clap::Parser;
use strum_macros::Display;
use tabled::Tabled;

#[derive(Debug,Parser)]
#[command(version, about, long_about="This clean any cache in your directory")]
pub struct CLI {
    pub(crate) path: Option<PathBuf>
}

#[derive(Debug, Display)]
pub enum EntryType {
    File, 
    Dir
}
#[derive(Debug, Tabled)]
pub struct FileEntry {
    #[tabled{rename="Name"}]
    name: String,
    #[tabled{rename="Type"}]
    e_type: EntryType,
    #[tabled{rename="length"}]
    len_bytes: u64,
    #[tabled{rename="Modified"}]
    modified: String,
    #[tabled{rename="Created At"}]
    created_at: String
}


pub fn get_files(path: &Path) -> Vec<FileEntry> {
    let mut data = Vec::default();
    if let Ok(read_dir) = fs::read_dir(path) {
        for entry in read_dir {
            if let Ok(file) = entry {
                map_data(file, &mut data);
            }
        }
    }
    return data;
}

fn map_data(file: fs::DirEntry, data: &mut Vec<FileEntry>) {
    if let Ok(metadata) = fs::metadata(&file.path()) {
            data.push(FileEntry { 
                name: file.file_name().into_string().unwrap_or("unknown name".into()),
                e_type: if metadata.is_dir() { EntryType::Dir } else { EntryType::File }, 
                len_bytes: metadata.len(), 
                modified: if let Ok(modify) = metadata.modified() {
                    let date: DateTime<Utc> = modify.into();
                    format!("{}", date.format("%a %b %e %Y"))
                }
                else {
                    String::from("")
                }
                , 
                created_at: if let Ok(create) = metadata.created() {
                    let date: DateTime<Utc> = create.into();
                    format!("{}", date.format("%a %b %e %Y"))
                }
                else {
                    String::from("")
                }
            });
        }
}


