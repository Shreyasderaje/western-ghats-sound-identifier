import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import UploadZone from "../components/UploadZone";

// The upload zone needs the API layer; mock the whole service module.
const uploadMock = vi.fn();
vi.mock("../services/api", () => ({
  uploadAudio: (...args: unknown[]) => uploadMock(...args),
  API_BASE_URL: "http://localhost:5000",
}));

function renderUpload(onUploaded = () => {}) {
  return render(
    <MemoryRouter>
      <UploadZone onUploaded={onUploaded} />
    </MemoryRouter>
  );
}

describe("UploadZone", () => {
  beforeEach(() => {
    uploadMock.mockReset();
    // jsdom lacks MediaRecorder -> the recorder panel stays hidden.
    (window as unknown as { MediaRecorder?: unknown }).MediaRecorder = undefined;
  });

  it("shows the drop zone and file constraints", () => {
    renderUpload();
    expect(screen.getByText(/drag & drop an audio recording/i)).toBeInTheDocument();
    expect(screen.getByText(/wav, mp3, m4a up to 500 mb/i)).toBeInTheDocument();
    expect(screen.queryByTestId("selected-file-name")).not.toBeInTheDocument();
  });

  it("rejects a .txt file with a validation message", async () => {
    const user = userEvent.setup();
    renderUpload();

    const input = screen
      .getByLabelText(/upload audio recording/i)
      .querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(["hello"], "notes.txt", { type: "text/plain" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/unsupported format/i);
    expect(screen.queryByTestId("selected-file-name")).not.toBeInTheDocument();
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("accepts a wav file, shows its name, and uploads on click", async () => {
    const user = userEvent.setup();
    const onUploaded = vi.fn();
    uploadMock.mockResolvedValue({ file_id: "abc123", filename: "dawn.wav" });
    renderUpload(onUploaded);

    const input = screen
      .getByLabelText(/upload audio recording/i)
      .querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File([new ArrayBuffer(64)], "dawn.wav", { type: "audio/wav" }));

    expect(screen.getByTestId("selected-file-name")).toHaveTextContent("dawn.wav");
    await user.click(screen.getByRole("button", { name: /upload & analyze/i }));

    await waitFor(() => expect(onUploaded).toHaveBeenCalledWith("abc123"));
  });

  it("does not upload until a file is selected", () => {
    renderUpload();
    // No upload button visible without a file.
    expect(screen.queryByRole("button", { name: /upload & analyze/i })).not.toBeInTheDocument();
  });
});
