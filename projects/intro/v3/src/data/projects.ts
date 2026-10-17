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
    link: "https://saisakthi.qzz.io/bank/",
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
    link: "https://saisakthi.qzz.io/video/",
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
    link: "https://saisakthi.qzz.io/hospital/",
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
    link: "https://saisakthi.qzz.io/api-service/",
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
    link: "https://saisakthi.qzz.io/grocery/",
    color: "#72b66f",
    position: [-15, -50],
    facing: [1, 0],
  },
  {
    number: "06",
    name: "Whisper",
    district: "Realtime Communications",
    description:
      "A low-latency messaging platform with WebSocket delivery, secure authentication, persistent conversations, and object storage for shared media.",
    stack: ["Rust", "Axum", "WebSockets", "React", "MinIO"],
    link: "https://saisakthi.qzz.io/whisper/",
    color: "#9a7cdb",
    position: [15, -50],
    facing: [-1, 0],
  },
  {
    number: "07",
    name: "Grafana Monitoring",
    district: "Observability & Security",
    description:
      "A unified operations center for service metrics, dashboards, logs, health checks, and the infrastructure signals behind the city.",
    stack: ["Grafana", "Prometheus", "Loki", "Monitoring"],
    link: "https://saisakthi.qzz.io/grafana/",
    color: "#7690c4",
    position: [-22, -68],
    facing: [1, 0],
  },
  {
    number: "08",
    name: "Housing & Ledger",
    district: "Persistent State",
    description:
      "The city housing and shared-ledger service, managing persistent state, ownership records, and connected district balances.",
    stack: ["Django", "PostgreSQL", "REST API", "Docker"],
    link: "https://saisakthi.qzz.io/housing/",
    color: "#c7956f",
    position: [0, -78],
    facing: [0, 1],
  },
];
