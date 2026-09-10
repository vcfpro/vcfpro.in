import { Bold, Image as ImageIcon, Italic, List, ListOrdered, Quote, Smile, Terminal, Underline } from "lucide-react";
import { useEffect, useRef } from "react";

/*
 * Reconstructed from capture of the LIVE-RENDERED comment form (the live
 * database had zero comments, so this markup could not be captured until
 * local test data was seeded - see PART 1 of this session). Toolbar:
 * Font/Size dropdowns, Bold/Italic/Underline, Heading1/Heading2/Quote,
 * Bulleted/Numbered list, Terminal block, Emoji, Photo attach.
 *
 * Bold/Italic/Underline/Heading/Quote/Lists are wired to real
 * document.execCommand calls (deprecated but still universally supported,
 * and the simplest way to get a working rich-text surface without pulling
 * in an editor library the original doesn't need either). Font/Size
 * dropdowns, Emoji, and Photo attach are visually reproduced but not
 * functionally wired - see TODO-after-parity.md.
 */

interface CommentEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder: string;
}

function exec(command: string, arg?: string) {
  document.execCommand(command, false, arg);
}

export function CommentEditor({ value, onChange, placeholder }: CommentEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  // Tracks the last HTML string WE emitted via handleInput, so this effect
  // can tell "value changed because the parent handed us new external
  // content (e.g. opening the edit form for an existing comment)" apart
  // from "value changed because we just typed" - syncing innerHTML
  // unconditionally on every render fights the browser's own cursor/
  // selection state and silently eats keystrokes.
  const lastEmitted = useRef<string | null>(null);

  useEffect(() => {
    if (!editorRef.current) return;
    if (value === lastEmitted.current) return;
    editorRef.current.innerHTML = value;
    lastEmitted.current = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handleInput() {
    const html = editorRef.current?.innerHTML || "";
    lastEmitted.current = html;
    onChange(html);
  }

  function runCommand(command: string, arg?: string) {
    editorRef.current?.focus();
    exec(command, arg);
    handleInput();
  }

  const isEmpty = !value || value === "<br>";

  return (
    <div
      className="flex flex-col border border-card-border rounded-xl overflow-hidden focus-within:border-[var(--color-accent)]/80 transition-all "
      style={{ backgroundColor: "var(--editor-bg)", color: "var(--editor-ink)" }}
    >
      <div className="flex flex-wrap items-center gap-1 p-2 bg-[#000000]/10 dark:bg-white/[0.02] border-b border-card-border select-none">
        <div className="flex items-center gap-1 mr-1 border-r border-card-border pr-2 relative z-50">
          <button type="button" className="text-xs text-ink/80 hover:text-ink transition-colors px-1 cursor-pointer w-16 text-left truncate" title="Font Family">
            Font
          </button>
          <button type="button" className="text-xs text-ink/80 hover:text-ink transition-colors px-1 cursor-pointer w-12 text-left truncate" title="Font Size">
            Size
          </button>
        </div>
        <button type="button" title="Bold" onClick={() => runCommand("bold")} className="p-1 px-1.5 hover:bg-[#000000]/10 dark:hover:bg-ink/10 rounded text-ink/75 hover:text-ink transition-colors cursor-pointer">
          <Bold size={13} />
        </button>
        <button type="button" title="Italic" onClick={() => runCommand("italic")} className="p-1 px-1.5 hover:bg-[#000000]/10 dark:hover:bg-neutral-800 rounded text-ink/75 hover:text-ink transition-colors cursor-pointer">
          <Italic size={13} />
        </button>
        <button type="button" title="Underline" onClick={() => runCommand("underline")} className="p-1 px-1.5 hover:bg-[#000000]/10 dark:hover:bg-neutral-800 rounded text-ink/75 hover:text-ink transition-colors cursor-pointer">
          <Underline size={13} />
        </button>
        <div className="w-[1px] h-4 bg-card-border mx-1" />
        <button type="button" title="Heading 1" onClick={() => runCommand("formatBlock", "H1")} className="p-1 px-1.5 hover:bg-[#000000]/10 dark:hover:bg-neutral-800 rounded text-ink/75 hover:text-ink transition-colors cursor-pointer font-bold text-xs">
          H1
        </button>
        <button type="button" title="Heading 2" onClick={() => runCommand("formatBlock", "H2")} className="p-1 px-1.5 hover:bg-[#000000]/10 dark:hover:bg-neutral-800 rounded text-ink/75 hover:text-ink transition-colors cursor-pointer font-bold text-xs">
          H2
        </button>
        <button type="button" title="Quote" onClick={() => runCommand("formatBlock", "BLOCKQUOTE")} className="p-1 px-1.5 hover:bg-[#000000]/10 dark:hover:bg-neutral-800 rounded text-ink/75 hover:text-ink transition-colors cursor-pointer">
          <Quote size={13} />
        </button>
        <div className="w-[1px] h-4 bg-card-border mx-1" />
        <button type="button" title="Bulleted List" onClick={() => runCommand("insertUnorderedList")} className="p-1 px-1.5 hover:bg-[#000000]/10 dark:hover:bg-neutral-800 rounded text-ink/75 hover:text-ink transition-colors cursor-pointer">
          <List size={13} />
        </button>
        <button type="button" title="Numbered List" onClick={() => runCommand("insertOrderedList")} className="p-1 px-1.5 hover:bg-[#000000]/10 dark:hover:bg-neutral-800 rounded text-ink/75 hover:text-ink transition-colors cursor-pointer">
          <ListOrdered size={13} />
        </button>
        <button type="button" title="Insert Terminal Block" onClick={() => runCommand("formatBlock", "PRE")} className="p-1 px-1.5 hover:bg-[#000000]/10 dark:hover:bg-neutral-800 rounded text-ink/75 hover:text-ink transition-colors cursor-pointer">
          <Terminal size={13} />
        </button>
        <div className="w-[1px] h-4 bg-card-border mx-1" />
        <div className="relative">
          <button type="button" title="Insert Emoji" className="p-1 px-1.5 rounded transition-colors cursor-pointer text-ink/75 hover:bg-[#000000]/10 dark:hover:bg-neutral-800 hover:text-ink">
            <Smile size={13} />
          </button>
        </div>
        <div className="relative">
          <button
            type="button"
            title="Attach Photo"
            className="p-1 px-1.5 hover:bg-[#000000]/10 dark:hover:bg-neutral-800 rounded text-ink/75 hover:text-ink transition-colors cursor-pointer flex items-center gap-1 text-[10px] uppercase font-semibold tracking-wider opacity-85 disabled:opacity-50"
          >
            <ImageIcon size={13} />
            <span>Photo</span>
          </button>
          <input accept="image/*" className="hidden" type="file" />
        </div>
      </div>
      <div className="relative flex-1">
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          className="w-full bg-transparent p-4 text-xs md:text-[13px] text-ink focus:outline-none overflow-y-auto font-sans font-light leading-relaxed prose max-w-none"
          style={{ minHeight: "120px" }}
        />
        {isEmpty && (
          <div className="absolute top-4 left-4 text-ink/35 pointer-events-none text-xs md:text-[13px] font-sans font-light select-none">
            {placeholder}
          </div>
        )}
      </div>
    </div>
  );
}
