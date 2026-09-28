const MIME_TO_EXT: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

/** 업로드/녹화된 영상 파일의 확장자를 추정한다(Storage 파일명용). */
export function extensionFromFile(file: File | Blob): string {
  if (file instanceof File && file.name.includes(".")) {
    return file.name.split(".").pop()!.toLowerCase();
  }
  const base = file.type.split(";")[0];
  return MIME_TO_EXT[base] ?? "mp4";
}
