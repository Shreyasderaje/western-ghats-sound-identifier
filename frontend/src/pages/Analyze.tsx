import UploadZone from "../components/UploadZone";
import { useNavigate } from "react-router-dom";

export default function Analyze() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analyze a recording</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Upload a field recording or capture one live — analysis starts as soon as
          the upload finishes.
        </p>
      </div>
      <UploadZone onUploaded={(fileId) => navigate(`/results/${fileId}`)} />
    </div>
  );
}
