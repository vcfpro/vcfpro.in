import { Film, Image as ImageIcon, Trash2, UploadCloud } from "lucide-react";
import { useEffect, useState } from "react";
import { deleteMedia, listMedia, uploadMediaFile } from "../../api/endpoints";
import type { MediaItem } from "../../api/types";

/*
 * Reconstructed field-for-field from the bundle's Media Library component
 * (minified `XE`). Confirmed quirks reproduced as-is:
 * - Upload is click-to-browse only - the "invisible file input over a
 *   styled button" pattern, no real drag-and-drop despite how it might
 *   look. Files upload sequentially (a for-loop with await, not
 *   Promise.all), and the grid only refreshes once after the whole batch
 *   finishes - no per-file progress or incremental insert.
 * - Delete has NO confirmation dialog (the whole original bundle has zero
 *   window.confirm() calls anywhere) and failures are silent
 *   (console.error only, no user-visible feedback at all).
 */
export function MediaLibrary() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [uploading, setUploading] = useState(false);

  function fetchMedia() {
    listMedia().then(setItems).catch(console.error);
  }

  useEffect(() => {
    fetchMedia();
  }, []);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        await uploadMediaFile(files[i]);
      }
      fetchMedia();
    } catch (err) {
      console.error(err);
      alert("Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteMedia(id);
      fetchMedia();
    } catch (err) {
      console.error(err);
      console.error("Failed to delete media: " + (err instanceof Error ? err.message : err));
    }
  }

  async function handleCopyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-end mb-10">
        <div>
          <h1 className="text-3xl font-serif mb-2">Media Library</h1>
          <p className="text-ink/40 text-sm tracking-wide">Manage your uploaded assets.</p>
        </div>
        <div className="relative">
          <button disabled={uploading} className="flex items-center gap-2 bg-ink text-black px-6 py-3 rounded-lg text-sm tracking-widest uppercase font-semibold hover:bg-ink/90 transition-colors cursor-pointer">
            <UploadCloud size={18} />
            {uploading ? "Uploading..." : "Upload Files"}
          </button>
          <input type="file" multiple onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" disabled={uploading} />
        </div>
      </div>

      <div className="cinematic-grid">
        {items.map((item) => (
          <div key={item.id} className="col-span-12 sm:col-span-6 md:col-span-4 lg:col-span-3 glass-panel rounded-xl overflow-hidden group">
            <div className="aspect-square relative bg-ink/[0.02] border-b border-ink/10">
              {item.type === "image" ? (
                <img alt={item.filename} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" src={item.url} />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Film size={48} className="text-ink/20" />
                </div>
              )}
            </div>
            <div className="p-4">
              <p className="text-sm font-medium truncate mb-2">{item.filename}</p>
              <div className="flex items-center justify-between text-xs text-ink/40 mb-3">
                <span className="uppercase tracking-widest flex items-center gap-1">
                  {item.type === "image" ? <ImageIcon size={12} /> : <Film size={12} />}
                  {item.type}
                </span>
                <button onClick={() => handleCopyUrl(item.url)} className="hover:text-ink transition-colors cursor-pointer">
                  COPY URL
                </button>
              </div>
              <div className="pt-2 border-t border-ink/5 flex justify-end">
                <button
                  title="Delete asset permanently"
                  onClick={() => handleDelete(item.id)}
                  className="text-ink/40 hover:text-red-400 flex items-center gap-1 text-[10px] uppercase font-mono tracking-widest transition-colors cursor-pointer"
                >
                  <Trash2 size={12} />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="col-span-12 text-center text-ink/30 font-serif italic py-20">No media uploaded yet.</div>}
      </div>
    </div>
  );
}
