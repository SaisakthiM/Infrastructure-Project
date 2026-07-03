use chrono::{DateTime, Utc};
use uuid::{self, Uuid};

struct User {
    id: Uuid,
    username: String
}

struct RoomMember {
    room_id: Uuid,
    user_id: Uuid,
}

struct ChatRoom {
    id: Uuid,
    name: String,
}

struct Message {
    id: Uuid,
    room_id: Uuid,
    sender_id: Uuid,
    content: String,
    timestamp: DateTime<Utc>,
}

