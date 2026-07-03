import axios from "axios";

export default async function getAll() {
  const val = await axios.get("/video/api/getFiles")
  return val
}