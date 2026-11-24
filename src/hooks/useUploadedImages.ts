import { useCallback, useEffect, useRef, useState } from "react";
import { listUploadedImages, type UploadedImage } from "../services/images";
import { deleteImage } from "../services/community";
import { communityError } from "../services/supabase";
export function useUploadedImages(prefix: string | null, enabled = true) {
  const [files, setFiles] = useState<UploadedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const version = useRef(0);
  const reload = useCallback(async () => {
    const request = ++version.current;
    if (!prefix || !enabled) {
      setFiles([]);
      setLoaded(false);
      setError("");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await listUploadedImages(prefix);
      if (request === version.current) {
        setFiles(result);
        setLoaded(true);
      }
    } catch (e) {
      if (request === version.current) {
        setError(communityError(e));
        setLoaded(false);
      }
    } finally {
      if (request === version.current) setLoading(false);
    }
  }, [prefix, enabled]);
  useEffect(() => {
    setFiles([]);
    setLoaded(false);
    void reload();
    return () => {
      version.current++;
    };
  }, [reload]);
  const remove = useCallback(async (image: UploadedImage) => {
    const request = version.current;
    setDeleting(image.id);
    setError("");
    try {
      await deleteImage(image.path);
      if (request === version.current)
        setFiles((fs) => fs.filter((f) => f.id !== image.id));
    } catch (e) {
      if (request === version.current) setError(communityError(e));
    } finally {
      setDeleting(null);
    }
  }, []);
  return { files, loading, loaded, error, deleting, reload, remove };
}
export type ImageCollection = ReturnType<typeof useUploadedImages>;
