/*
  The city registry — the same twelve wards, codes, accents and routes as
  projects/city-core/city-core.js (DISTRICTS) and projects/city-core/THEME.md.
  If a district changes here, change it there; the home page and every district HUD
  are meant to agree about what D-07 looks like.
*/

export type Project = {
  number: string; // ordinal in the registry, printed large
  code: string; // ward code, D-01 … D-12 — the plate
  service: string; // bank ledger / DISTRICTS key (never rename a money identifier)
  name: string;
  district: string; // what the ward is for
  description: string;
  stack: string[];
  link: string;
  color: string;
  position: [number, number];
  facing: [number, number];
};

export const projects: Project[] = [
  {
    number: "01",
    code: "D-01",
    service: "bank",
    name: "Bank Manager",
    district: "Treasury & Accounts",
    description:
      "The treasury every other ward depends on: JWT-issued sessions, account ledgers, transactions, lending and the balance the whole city spends and earns against.",
    stack: ["Spring Boot", "PostgreSQL", "JWT", "Docker", "React"],
    link: "/bank/",
    color: "#0f6e9c",
    position: [-32, -6],
    facing: [1, 0],
  },
  {
    number: "02",
    code: "D-02",
    service: "hospital",
    name: "Hospital",
    district: "Health Services",
    description:
      "Doctors, patients and appointments with the city's money rules layered on: what a consultation costs, what a shift pays, and the records that feed the analytics vault.",
    stack: ["Django", "Python", "SQLite", "MinIO", "Tailwind"],
    link: "/hospital/",
    color: "#2b7e72",
    position: [24, -6],
    facing: [-1, 0],
  },
  {
    number: "03",
    code: "D-03",
    service: "grocery",
    name: "Grocery",
    district: "Retail & Work",
    description:
      "A stock-keeping shop with a shift economy: citizens buy produce with city credit and earn it back by working the shelves, with prices and cooldowns enforced server-side.",
    stack: ["JavaScript", "Canvas API", "Django", "PostgreSQL"],
    link: "/grocery/",
    color: "#4c7c3f",
    position: [-28, -30],
    facing: [1, 0],
  },
  {
    number: "04",
    code: "D-04",
    service: "housing",
    name: "Housing",
    district: "Checkpoints & Rent",
    description:
      "The city's homes — a plain address, a lease and a rent cycle. Nothing grand: it is the checkpoint you return to between shifts.",
    stack: ["Django", "PostgreSQL", "REST API", "Docker"],
    link: "/housing/",
    color: "#966e35",
    position: [24, -30],
    facing: [-1, 0],
  },
  {
    number: "05",
    code: "D-05",
    service: "blog",
    name: "Inkwell",
    district: "Long-form Publishing",
    description:
      "The technical journal of the project: essays on the infrastructure itself, media served from MinIO, and creator earnings scaled by how much of it gets read.",
    stack: ["Django", "MySQL", "MinIO S3", "Python"],
    link: "/blog/",
    color: "#6e4a79",
    position: [-22, -50],
    facing: [1, 0],
  },
  {
    number: "06",
    code: "D-06",
    service: "social",
    name: "Social",
    district: "Timelines & Follow Graph",
    description:
      "A microservices network — Go and Java services, Cassandra and Kafka behind a Consul-discovered API — where influence is money: reach and followers set the payout.",
    stack: ["React", "Go / Java", "Consul", "Kafka", "Cassandra"],
    link: "/social/",
    color: "#4a5aa6",
    position: [22, -50],
    facing: [-1, 0],
  },
  {
    number: "07",
    code: "D-07",
    service: "media",
    name: "Video & File Storage",
    district: "Media Vault",
    description:
      "Multipart upload and per-user file storage on MinIO behind JWT, rebuilt for the city as the influencer's studio: engagement on what you publish is what you earn.",
    stack: ["Spring Boot", "PostgreSQL", "MinIO", "React"],
    link: "/video/",
    color: "#8d4850",
    position: [-28, -70],
    facing: [1, 0],
  },
  {
    number: "08",
    code: "D-08",
    service: "api",
    name: "API & Markets",
    district: "Utilities & Data",
    description:
      "The city's utility counter: weather, geocoding and market endpoints behind one Express gateway, metered per call and paid for out of your balance.",
    stack: ["React", "Express", "REST API", "Geocoding"],
    link: "/api-service/",
    color: "#3d4e66",
    position: [26, -70],
    facing: [-1, 0],
  },
  {
    number: "09",
    code: "D-09",
    service: "document",
    name: "Documents",
    district: "AI & Retrieval",
    description:
      "Upload, retrieve and ask: semantic search over your own documents with sentiment analytics, plus a therapist chatbot that reads what you write.",
    stack: ["React", "Python", "LLM RAG", "MinIO"],
    link: "/document/",
    color: "#6e7042",
    position: [-28, -90],
    facing: [1, 0],
  },
  {
    number: "10",
    code: "D-10",
    service: "compiler",
    name: "Cloud Compiler",
    district: "Developer Tooling",
    description:
      "A browser IDE that runs untrusted code in isolated sandbox containers with live output — the workshop ward, metered per build.",
    stack: ["React", "Node.js", "Monaco", "Docker Sandbox"],
    link: "/compiler/",
    color: "#4a4f55",
    position: [26, -90],
    facing: [-1, 0],
  },
  {
    number: "11",
    code: "D-11",
    service: "whisper",
    name: "Whisper",
    district: "Realtime Messaging",
    description:
      "The city's chat: low-latency WebSocket delivery, persistent conversations and shared media in object storage.",
    stack: ["Rust", "Axum", "WebSockets", "React", "MinIO"],
    link: "/whisper/",
    color: "#0f7a8c",
    position: [-28, -110],
    facing: [1, 0],
  },
  {
    number: "12",
    code: "D-12",
    service: "police",
    name: "Monitoring",
    district: "The City Police",
    description:
      "Metrics, logs and dashboards for every ward, segregated per service so a spike names its building — and a pipeline that can shut it down before the city does.",
    stack: ["Grafana", "Prometheus", "Loki", "OpenTelemetry"],
    link: "/grafana/",
    color: "#9a4a32",
    position: [26, -110],
    facing: [-1, 0],
  },
];
