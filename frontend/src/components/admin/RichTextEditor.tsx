import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import { all, createLowlight } from "lowlight";
import bash from "highlight.js/lib/languages/bash";
import json from "highlight.js/lib/languages/json";
import powershell from "highlight.js/lib/languages/powershell";
import python from "highlight.js/lib/languages/python";
import sql from "highlight.js/lib/languages/sql";
import yaml from "highlight.js/lib/languages/yaml";
import { Code2, Highlighter, Image as ImageIcon, Link2, Redo2, RemoveFormatting, Smile, Undo2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder: string;
  minHeight?: string;
  onImageUpload: (file: File) => Promise<string>;
}

const POPULAR_EMOJIS = ["😀", "😂", "😍", "🎉", "👍", "🔥", "💡", "✅", "⚠️", "🚀"];
const FONT_FAMILIES = [
  { label: "Inter", value: "Inter, sans-serif" },
  { label: "Playfair", value: '"Playfair Display", serif' },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Monospace", value: 'ui-monospace, SFMono-Regular, monospace' },
  { label: "System", value: "system-ui, sans-serif" },
];
const FONT_SIZES = ["12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px", "36px", "40px"];
const CODE_LANGUAGES = [
  { label: "Plain Text", value: "plaintext" },
  { label: "Bash/Shell", value: "bash" },
  { label: "PowerShell", value: "powershell" },
  { label: "Python", value: "python" },
  { label: "YAML", value: "yaml" },
  { label: "JSON", value: "json" },
  { label: "SQL", value: "sql" },
];

const lowlight = createLowlight(all);
lowlight.register("bash", bash);
lowlight.register("powershell", powershell);
lowlight.register("python", python);
lowlight.register("yaml", yaml);
lowlight.register("json", json);
lowlight.register("sql", sql);

const FontSize = Extension.create({
  name: "fontSize",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => (element as HTMLElement).style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
          fontFamily: {
            default: null,
            parseHTML: (element) => (element as HTMLElement).style.fontFamily || null,
            renderHTML: (attributes) => {
              if (!attributes.fontFamily) return {};
              return { style: `font-family: ${attributes.fontFamily}` };
            },
          },
        },
      },
    ];
  },
});

function sanitizeHtml(html: string): string {
  if (typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild as HTMLElement | null;
  if (!root) return html;

  const allowed = new Set(["p", "br", "strong", "em", "u", "s", "span", "a", "ul", "ol", "li", "blockquote", "pre", "code", "h1", "h2", "h3", "hr", "img", "div"]);
  const allowedAttrs = new Set(["href", "target", "rel", "src", "alt", "style", "data-language"]);

  const walk = (parent: Element) => {
    [...parent.children].forEach((child) => {
      const tag = child.tagName.toLowerCase();
      if (!allowed.has(tag)) {
        child.replaceWith(...Array.from(child.childNodes));
        return;
      }
      [...child.attributes].forEach((attr) => {
        if (attr.name === "class" && tag === "a") child.removeAttribute(attr.name);
        else if (!allowedAttrs.has(attr.name) && !attr.name.startsWith("data-")) child.removeAttribute(attr.name);
      });
      if (tag === "a") {
        child.setAttribute("rel", "noopener noreferrer");
      }
      walk(child);
    });
  };

  walk(root);
  return root.innerHTML.replace(/<p>(?:<br\s*\/?>|&nbsp;|\s)*<\/p>/g, "<p><br></p>");
}

export function RichTextEditor({ value, onChange, placeholder, minHeight = "500px", onImageUpload }: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [textColor, setTextColor] = useState("#f97316");
  const [highlightColor, setHighlightColor] = useState("#fde047");

  const extensions = useMemo(
    () => [
      StarterKit.configure({ codeBlock: false }),
      Underline,
      TextStyle,
      FontSize,
      Color,
      Highlight.configure({ multicolor: true }),
      Link.configure({ autolink: true, openOnClick: false, defaultProtocol: "https", HTMLAttributes: { rel: "noopener noreferrer" } }),
      Image.configure({ inline: false, allowBase64: false }),
      CodeBlockLowlight.configure({ lowlight }),
    ],
    [],
  );

  const editor = useEditor({
    extensions,
    content: value,
    editorProps: {
      attributes: {
        class: "tiptap-editor w-full bg-transparent p-4 text-xs md:text-[13px] text-ink focus:outline-none overflow-y-auto font-sans font-light leading-relaxed prose max-w-none",
        style: `min-height: ${minHeight};`,
      },
      transformPastedHTML: sanitizeHtml,
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useEffect(() => {
    if (!editor) return;
    if ((editor.getHTML() || "") === (value || "")) return;
    editor.commands.setContent(value || "", { emitUpdate: false });
  }, [editor, value]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await onImageUpload(file);
      editor?.chain().focus().setImage({ src: url, alt: "attached image" }).run();
    } catch (err) {
      alert("Image upload failed: " + (err instanceof Error ? err.message : err));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function applyLink() {
    if (!editor) return;
    const href = linkValue.trim();
    if (!href) {
      editor.chain().focus().unsetLink().run();
      setShowLink(false);
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    setShowLink(false);
    setLinkValue("");
  }

  const currentFontFamily = editor?.getAttributes("textStyle").fontFamily || "";
  const currentFontSize = editor?.getAttributes("textStyle").fontSize || "";
  const currentCodeLanguage = editor?.getAttributes("codeBlock").language || "plaintext";

  if (!editor) return null;

  return (
    <div className="flex flex-col border border-card-border rounded-xl overflow-hidden focus-within:border-[var(--color-accent)]/80 transition-all" style={{ backgroundColor: "var(--editor-bg)", color: "var(--editor-ink)" }}>
      <div className="flex flex-wrap items-center gap-1 p-2 bg-[#000000]/10 dark:bg-white/[0.02] border-b border-card-border select-none">
        <div className="flex items-center gap-1 mr-1 border-r border-card-border pr-2 relative z-50">
          <select className="text-xs bg-transparent text-ink/80 border border-card-border rounded px-2 py-1" value={currentFontFamily} onChange={(e) => editor.chain().focus().setMark("textStyle", { fontFamily: e.target.value || null }).run()}>
            <option value="">Font</option>
            {FONT_FAMILIES.map((item) => <option key={item.label} value={item.value}>{item.label}</option>)}
          </select>
          <select className="text-xs bg-transparent text-ink/80 border border-card-border rounded px-2 py-1" value={currentFontSize} onChange={(e) => editor.chain().focus().setMark("textStyle", { fontSize: e.target.value || null }).run()}>
            <option value="">Size</option>
            {FONT_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </div>
        <button type="button" title="Bold" onClick={() => editor.chain().focus().toggleBold().run()} className="p-1 px-1.5 hover:bg-[#000000]/10 dark:hover:bg-ink/10 rounded text-ink/75 hover:text-ink transition-colors cursor-pointer"><strong>B</strong></button>
        <button type="button" title="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} className="p-1 px-1.5 hover:bg-[#000000]/10 dark:hover:bg-neutral-800 rounded text-ink/75 hover:text-ink transition-colors cursor-pointer"><em>I</em></button>
        <button type="button" title="Underline" onClick={() => editor.chain().focus().toggleUnderline().run()} className="p-1 px-1.5 hover:bg-[#000000]/10 dark:hover:bg-neutral-800 rounded text-ink/75 hover:text-ink transition-colors cursor-pointer">U</button>
        <button type="button" title="Link" onClick={() => setShowLink((v) => !v)} className="p-1 px-1.5 hover:bg-[#000000]/10 dark:hover:bg-neutral-800 rounded text-ink/75 hover:text-ink transition-colors cursor-pointer"><Link2 size={13} /></button>
        <label title="Text Color" className="relative flex items-center justify-center w-7 h-7 rounded hover:bg-[#000000]/10 dark:hover:bg-neutral-800 cursor-pointer">
          <span className="font-bold text-xs" style={{ color: textColor }}>A</span>
          <span className="absolute bottom-0.5 inset-x-1 h-0.5 rounded" style={{ backgroundColor: textColor }} />
          <input
            type="color"
            aria-label="Text Color"
            value={textColor}
            onChange={(e) => {
              setTextColor(e.target.value);
              editor.chain().focus().setColor(e.target.value).run();
            }}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </label>
        <button type="button" title="Use Automatic Theme Color" onClick={() => editor.chain().focus().unsetColor().run()} className="p-1 text-[9px] text-ink/55 hover:text-ink cursor-pointer">Auto</button>
        <label title="Highlight Color" className="relative flex items-center justify-center w-7 h-7 rounded hover:bg-[#000000]/10 dark:hover:bg-neutral-800 cursor-pointer">
          <Highlighter size={13} />
          <span className="absolute bottom-0.5 inset-x-1 h-0.5 rounded" style={{ backgroundColor: highlightColor }} />
          <input
            type="color"
            aria-label="Highlight Color"
            value={highlightColor}
            onChange={(e) => {
              setHighlightColor(e.target.value);
              editor.chain().focus().setHighlight({ color: e.target.value }).run();
            }}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </label>
        <button type="button" title="Remove Highlight" onClick={() => editor.chain().focus().unsetHighlight().run()} className="p-1 text-[9px] text-ink/55 hover:text-ink cursor-pointer">Clear</button>
        <button type="button" title="Undo" onClick={() => editor.chain().focus().undo().run()} className="p-1 px-1.5 hover:bg-[#000000]/10 dark:hover:bg-neutral-800 rounded text-ink/75 hover:text-ink transition-colors cursor-pointer"><Undo2 size={13} /></button>
        <button type="button" title="Redo" onClick={() => editor.chain().focus().redo().run()} className="p-1 px-1.5 hover:bg-[#000000]/10 dark:hover:bg-neutral-800 rounded text-ink/75 hover:text-ink transition-colors cursor-pointer"><Redo2 size={13} /></button>
        <button type="button" title="Clear Formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} className="p-1 px-1.5 hover:bg-[#000000]/10 dark:hover:bg-neutral-800 rounded text-ink/75 hover:text-ink transition-colors cursor-pointer"><RemoveFormatting size={13} /></button>
        <div className="w-[1px] h-4 bg-card-border mx-1" />
        <button type="button" title="Heading 1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className="p-1 px-1.5 hover:bg-[#000000]/10 dark:hover:bg-neutral-800 rounded text-ink/75 hover:text-ink transition-colors cursor-pointer font-bold text-xs">H1</button>
        <button type="button" title="Heading 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className="p-1 px-1.5 hover:bg-[#000000]/10 dark:hover:bg-neutral-800 rounded text-ink/75 hover:text-ink transition-colors cursor-pointer font-bold text-xs">H2</button>
        <button type="button" title="Quote" onClick={() => editor.chain().focus().toggleBlockquote().run()} className="p-1 px-1.5 hover:bg-[#000000]/10 dark:hover:bg-neutral-800 rounded text-ink/75 hover:text-ink transition-colors cursor-pointer">&ldquo;</button>
        <button type="button" title="Bulleted List" onClick={() => editor.chain().focus().toggleBulletList().run()} className="p-1 px-1.5 hover:bg-[#000000]/10 dark:hover:bg-neutral-800 rounded text-ink/75 hover:text-ink transition-colors cursor-pointer">•</button>
        <button type="button" title="Numbered List" onClick={() => editor.chain().focus().toggleOrderedList().run()} className="p-1 px-1.5 hover:bg-[#000000]/10 dark:hover:bg-neutral-800 rounded text-ink/75 hover:text-ink transition-colors cursor-pointer">1.</button>
        <button type="button" title="Code Block" onClick={() => editor.chain().focus().toggleCodeBlock({ language: currentCodeLanguage }).run()} className="p-1 px-1.5 hover:bg-[#000000]/10 dark:hover:bg-neutral-800 rounded text-ink/75 hover:text-ink transition-colors cursor-pointer"><Code2 size={13} /></button>
        <select className="text-xs bg-transparent text-ink/80 border border-card-border rounded px-2 py-1" value={currentCodeLanguage} onChange={(e) => editor.chain().focus().updateAttributes("codeBlock", { language: e.target.value }).run()}>
          {CODE_LANGUAGES.map((lang) => <option key={lang.value} value={lang.value}>{lang.label}</option>)}
        </select>
        <button type="button" title="Horizontal Rule" onClick={() => editor.chain().focus().setHorizontalRule().run()} className="p-1 px-1.5 hover:bg-[#000000]/10 dark:hover:bg-neutral-800 rounded text-ink/75 hover:text-ink transition-colors cursor-pointer">HR</button>
        <div className="w-[1px] h-4 bg-card-border mx-1" />
        <button type="button" title="Insert Emoji" onClick={() => editor.chain().focus().insertContent(POPULAR_EMOJIS[0]).run()} className="p-1 px-1.5 rounded transition-colors cursor-pointer text-ink/75 hover:bg-[#000000]/10 dark:hover:bg-neutral-800 hover:text-ink"><Smile size={13} /></button>
        <button type="button" title="Attach Photo" disabled={uploading} onClick={() => fileInputRef.current?.click()} className="p-1 px-1.5 hover:bg-[#000000]/10 dark:hover:bg-neutral-800 rounded text-ink/75 hover:text-ink transition-colors cursor-pointer flex items-center gap-1 text-[10px] uppercase font-semibold tracking-wider opacity-85 disabled:opacity-50"><ImageIcon size={13} /><span>{uploading ? "Uploading..." : "Photo"}</span></button>
        <input ref={fileInputRef} accept="image/*" className="hidden" type="file" onChange={handleFileChange} />
        {showLink && (
          <div className="flex items-center gap-1 ml-2">
            <input className="bg-transparent border border-card-border rounded px-2 py-1 text-xs min-w-48" placeholder="https://..." value={linkValue} onChange={(e) => setLinkValue(e.target.value)} />
            <button type="button" className="text-xs px-2 py-1 rounded border border-card-border" onClick={applyLink}>Apply</button>
          </div>
        )}
      </div>
      <div className="relative flex-1">
        {editor.isEmpty && <div className="absolute top-4 left-4 text-ink/35 pointer-events-none text-xs md:text-[13px] font-sans font-light select-none">{placeholder}</div>}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}


