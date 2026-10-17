export type Project = {
  number: string;
  name: string;
  district: string;
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
    name: "Bank Manager",
    district: "Financial Systems",
    description:
      "A secure banking API with stateless JWT authentication, account ledgers, transaction history, lending flows, and auditable operations.",
    stack: ["Spring Boot", "PostgreSQL", "JWT", "Docker", "React"],
    link: "/bank/",
    color: "#d8b44b",
    position: [-32, -6],
    facing: [1, 0],
  },
  {
    number: "02",
    name: "Video & File Storage",
    district: "Media District",
    description:
      "A secure multipart media platform for per-user video and file management, backed by PostgreSQL and protected with JWT authentication.",
    stack: ["Spring Boot", "PostgreSQL", "React", "JWT", "MinIO"],
    link: "/video/",
    color: "#e2668a",
    position: [24, -6],
    facing: [-1, 0],
  },
  {
    number: "03",
    name: "Hospital Management",
    district: "Health Services",
    description:
      "A healthcare records system for maintaining doctors, patients, appointments, and operational data through a focused Django workflow.",
    stack: ["Django", "Python", "SQLite", "MinIO", "Tailwind"],
    link: "/hospital/",
    color: "#9fdded",
    position: [-28, -30],
    facing: [1, 0],
  },
  {
    number: "04",
    name: "API Service",
    district: "Storage & API",
    description:
      "A live weather and geocoding service that connects a React interface to an Express API gateway for real-time location data.",
    stack: ["React", "Express", "REST API", "Geocoding"],
    link: "/api-service/",
    color: "#5e9fd1",
    position: [24, -30],
    facing: [-1, 0],
  },
  {
    number: "05",
    name: "Grocery Store",
    district: "Retail Systems",
    description:
      "A dynamic retail simulation with inventory tracking, a shift-work economy, purchasing flows, and persistent citizen credit balances.",
    stack: ["JavaScript", "Canvas API", "LocalStorage", "Simulation"],
    link: "/grocery/",
    color: "#72b66f",
    position: [-22, -50],
    facing: [1, 0],
  },
  {
    number: "06",
    name: "Whisper",
    district: "Realtime Communications",
    description:
      "A low-latency messaging platform with WebSocket delivery, secure authentication, persistent conversations, and object storage for shared media.",
    stack: ["Rust", "Axum", "WebSockets", "React", "MinIO"],
    link: "/whisper/",
    color: "#9a7cdb",
    position: [22, -50],
    facing: [-1, 0],
  },
  {
    number: "07",
    name: "Grafana Monitoring",
    district: "Observability & Security",
    description:
      "A unified operations center for service metrics, dashboards, logs, health checks, and the infrastructure signals behind the city.",
    stack: ["Grafana", "Prometheus", "Loki", "Monitoring"],
    link: "/grafana/",
    color: "#7690c4",
    position: [-28, -70],
    facing: [1, 0],
  },
  {
    number: "08",
    name: "Housing & Ledger",
    district: "Persistent State",
    description:
      "The city housing and shared-ledger service, managing persistent state, ownership records, and connected district balances.",
    stack: ["Django", "PostgreSQL", "REST API", "Docker"],
    link: "/housing/",
    color: "#c7956f",
    position: [0, -78],
    facing: [0, 1],
  },
  {
    number: "09",
    name: "Notes (Reading Room)",
    district: "Knowledge Base",
    description:
      "A distraction-free personal note-taking sanctuary with Markdown rendering, tagging, and JWT-authenticated cloud synchronization.",
    stack: ["React", "TypeScript", "Tailwind", "REST API"],
    link: "/notes/",
    color: "#c8922a",
    position: [26, -70],
    facing: [-1, 0],
  },
  {
    number: "10",
    name: "Interactive Quiz Engine",
    district: "Education & Learning",
    description:
      "A gamified quiz platform with timed rounds, category filtering, immediate score calculations, and leaderboard persistence.",
    stack: ["React", "TypeScript", "Vite", "Tailwind"],
    link: "/quiz/",
    color: "#ec4899",
    position: [-28, -90],
    facing: [1, 0],
  },
  {
    number: "11",
    name: "Online Cloud Compiler",
    district: "Developer Tooling",
    description:
      "A multi-language browser IDE executing untrusted code securely inside isolated sandboxed runner containers with live output streaming.",
    stack: ["React", "Node.js", "Docker Sandbox", "Monaco"],
    link: "/compiler/",
    color: "#06b6d4",
    position: [26, -90],
    facing: [-1, 0],
  },
  {
    number: "12",
    name: "Document Intelligence",
    district: "AI & RAG Platform",
    description:
      "An AI companion platform processing unstructured documents and journals with semantic retrieval and sentiment analytics.",
    stack: ["React", "Python", "LLM RAG", "Tailwind"],
    link: "/document/",
    color: "#8b5cf6",
    position: [-28, -110],
    facing: [1, 0],
  },
  {
    number: "13",
    name: "Social Media Platform",
    district: "Social Network",
    description:
      "A microservices social platform featuring user timelines, follow graphs, media uploads, and Consul service discovery.",
    stack: ["React", "Go / Java", "Consul", "PostgreSQL"],
    link: "/social/",
    color: "#3b82f6",
    position: [26, -110],
    facing: [-1, 0],
  },
  {
    number: "14",
    name: "Developer Blog",
    district: "Publishing Engine",
    description:
      "A high-performance technical publishing platform with rich media storage backed by MinIO S3 and database persistence.",
    stack: ["Django", "MySQL", "MinIO S3", "Python"],
    link: "/blog/",
    color: "#10b981",
    position: [0, -120],
    facing: [0, 1],
  },
];
