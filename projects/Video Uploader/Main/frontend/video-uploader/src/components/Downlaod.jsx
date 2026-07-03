import { use, Suspense } from "react";
import getAll from "./Getter";

function FileList({ data }) {
  const result = use(data);
  const files = result?.data || [];

  if (files.length === 0) {
    return <p className="empty">No files found on the server.</p>;
  }

  return (
    <ol className="file-list">
      {files.map((item, index) => (
        <li key={index}>
          <a href={`/video/api/download/${item}`} download={item}>{item}</a>
        </li>
      ))}
    </ol>
  );
}

async function getVal() {
  return await getAll();
}

export default function Download() {
  return (
    <div className="wrapper">
      <div className="container">
        <h1>Download</h1>
        <h2>Files available on the server</h2>
        <hr />
        <Suspense fallback={<p className="empty">Loading files...</p>}>
          <FileList data={getVal()} />
        </Suspense>
      </div>
    </div>
  );
}