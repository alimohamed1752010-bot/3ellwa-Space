import { useCallback, useState } from "react";
import { ApiError } from "../../shared/api";
import { autoOptimize } from "../../shared/imageTools";
import { checkLibraryFile, checkLibraryType, uploadToLibrary } from "../../shared/media";
import type { MediaItem } from "../../shared/media";
import { useToast } from "../../shared/ui";

/** Uploads several files one after another: optimize quietly, upload, and report one summary. */
export function useUploader(onUploaded: (items: MediaItem[]) => void) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const uploadMany = useCallback(async (files: File[], folderId: string | null) => {
    if (files.length === 0) return;
    setBusy(true);
    const done: MediaItem[] = [];
    const problems: string[] = [];
    for (const original of files) {
      const early = checkLibraryType(original); // check the type before spending time on compression
      if (early) { problems.push(early); continue; }
      const file = await autoOptimize(original);
      const bad = checkLibraryFile(file);
      if (bad) { problems.push(bad); continue; }
      try {
        done.push(await uploadToLibrary(file, folderId));
      } catch (e) {
        problems.push(`${original.name}: ${e instanceof ApiError ? e.message : "upload failed."}`);
      }
    }
    setBusy(false);
    if (done.length) onUploaded(done);
    if (done.length && !problems.length) toast.show(done.length === 1 ? "Image uploaded." : `${done.length} images uploaded.`, "success");
    else if (problems.length) toast.show(`${done.length ? `${done.length} uploaded. ` : ""}${problems.slice(0, 2).join(" ")}${problems.length > 2 ? ` (+${problems.length - 2} more)` : ""}`, "error");
  }, [onUploaded, toast]);

  return { busy, uploadMany };
}
