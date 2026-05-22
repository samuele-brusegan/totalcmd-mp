import { useState, useEffect, useMemo } from 'react';
import { X, FileText, Binary, Image } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { readFileText } from '../../services/localFs';
import { convertFileSrc } from '@tauri-apps/api/core';

type ViewMode = 'text' | 'hex' | 'image';

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg', 'ico', 'tiff', 'tif']);

function getExtension(path: string): string {
  const dot = path.lastIndexOf('.');
  return dot > 0 ? path.substring(dot + 1).toLowerCase() : '';
}

export function FileViewerDialog() {
  const closeDialog = useUIStore((s) => s.closeDialog);
  const dialogData = useUIStore((s) => s.dialogData);
  const filePath = dialogData.path as string;

  const ext = getExtension(filePath || '');
  const isImage = IMAGE_EXTS.has(ext);

  const needsLoad = Boolean(filePath) && !isImage;
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(needsLoad);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(isImage ? 'image' : 'text');
  const [wrapLines, setWrapLines] = useState(false);

  useEffect(() => {
    if (!needsLoad) return;
    let cancelled = false;
    readFileText(filePath)
      .then((text) => {
        if (!cancelled) {
          setContent(text);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(String(e));
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [filePath, needsLoad]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'F3' || e.key === 'q') {
        e.preventDefault();
        closeDialog();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [closeDialog]);

  const fileName = filePath?.split('/').pop() || '';

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-xl w-[80vw] h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-[var(--color-accent)]" />
            <span className="text-xs font-semibold text-[var(--color-text-primary)]">
              {fileName}
            </span>
            <span className="text-[10px] text-[var(--color-text-muted)] truncate max-w-[300px]">
              {filePath}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('text')}
              className={`p-1 rounded text-xs ${viewMode === 'text' ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)]'}`}
              title="Text view"
            >
              <FileText size={12} />
            </button>
            <button
              onClick={() => setViewMode('hex')}
              className={`p-1 rounded text-xs ${viewMode === 'hex' ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)]'}`}
              title="Hex view"
            >
              <Binary size={12} />
            </button>
            {isImage && (
              <button
                onClick={() => setViewMode('image')}
                className={`p-1 rounded text-xs ${viewMode === 'image' ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)]'}`}
                title="Image preview"
              >
                <Image size={12} />
              </button>
            )}
            {viewMode === 'text' && (
              <label className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
                <input
                  type="checkbox"
                  checked={wrapLines}
                  onChange={(e) => setWrapLines(e.target.checked)}
                  className="w-3 h-3"
                />
                Wrap
              </label>
            )}
            <button onClick={closeDialog} className="p-1 hover:bg-[var(--color-bg-hover)] rounded ml-2">
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-0">
          {loading && (
            <div className="flex items-center justify-center h-full text-xs text-[var(--color-text-muted)]">
              Loading...
            </div>
          )}
          {error && (
            <div className="flex items-center justify-center h-full text-xs text-red-400 p-4">
              {error}
            </div>
          )}
          {!loading && !error && viewMode === 'text' && (
            <SyntaxView content={content} ext={ext} wrapLines={wrapLines} />
          )}
          {!loading && !error && viewMode === 'hex' && (
            <HexView content={content} />
          )}
          {viewMode === 'image' && isImage && (
            <div className="flex items-center justify-center h-full p-4">
              <img
                src={convertFileSrc(filePath)}
                alt={fileName}
                className="max-w-full max-h-full object-contain"
                onError={() => setError('Failed to load image')}
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-3 py-1 border-t border-[var(--color-border)] text-[10px] text-[var(--color-text-muted)]">
          <span>{viewMode === 'image' ? 'Image preview' : `${content.length.toLocaleString()} characters`}</span>
          <span>Press Esc or Q to close</span>
        </div>
      </div>
    </div>
  );
}

const LANG_MAP: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  rs: 'rust', py: 'python', rb: 'ruby', go: 'go',
  java: 'java', c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp',
  css: 'css', scss: 'css', html: 'html', xml: 'html', svg: 'html',
  json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'toml',
  md: 'markdown', sh: 'shell', bash: 'shell', zsh: 'shell',
  sql: 'sql', dockerfile: 'docker',
};

const KEYWORD_SETS: Record<string, Set<string>> = {
  typescript: new Set(['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'import', 'export', 'from', 'class', 'interface', 'type', 'enum', 'extends', 'implements', 'new', 'this', 'async', 'await', 'try', 'catch', 'throw', 'switch', 'case', 'break', 'default', 'true', 'false', 'null', 'undefined', 'typeof', 'instanceof', 'in', 'of', 'as', 'readonly', 'public', 'private', 'protected', 'static', 'abstract', 'void']),
  rust: new Set(['fn', 'let', 'mut', 'const', 'pub', 'use', 'mod', 'struct', 'enum', 'impl', 'trait', 'for', 'while', 'loop', 'if', 'else', 'match', 'return', 'self', 'Self', 'where', 'type', 'as', 'in', 'ref', 'true', 'false', 'async', 'await', 'move', 'dyn', 'unsafe', 'extern', 'crate', 'super']),
  python: new Set(['def', 'class', 'import', 'from', 'return', 'if', 'elif', 'else', 'for', 'while', 'try', 'except', 'finally', 'with', 'as', 'yield', 'lambda', 'pass', 'break', 'continue', 'and', 'or', 'not', 'in', 'is', 'True', 'False', 'None', 'async', 'await', 'raise', 'del', 'global', 'nonlocal', 'assert']),
  go: new Set(['func', 'package', 'import', 'var', 'const', 'type', 'struct', 'interface', 'map', 'chan', 'go', 'select', 'case', 'default', 'if', 'else', 'for', 'range', 'return', 'break', 'continue', 'switch', 'defer', 'true', 'false', 'nil']),
  java: new Set(['public', 'private', 'protected', 'static', 'final', 'abstract', 'class', 'interface', 'extends', 'implements', 'new', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'default', 'try', 'catch', 'finally', 'throw', 'throws', 'import', 'package', 'void', 'int', 'long', 'double', 'float', 'boolean', 'char', 'byte', 'short', 'true', 'false', 'null', 'this', 'super', 'instanceof', 'enum', 'synchronized']),
  c: new Set(['int', 'char', 'float', 'double', 'void', 'long', 'short', 'unsigned', 'signed', 'static', 'extern', 'const', 'volatile', 'struct', 'union', 'enum', 'typedef', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'default', 'return', 'continue', 'goto', 'sizeof', 'NULL', 'true', 'false', '#include', '#define', '#ifdef', '#endif', '#ifndef', '#if', '#else']),
  css: new Set([]),
  html: new Set([]),
  json: new Set(['true', 'false', 'null']),
  shell: new Set(['if', 'then', 'else', 'elif', 'fi', 'for', 'do', 'done', 'while', 'until', 'case', 'esac', 'function', 'return', 'exit', 'echo', 'export', 'source', 'local', 'readonly', 'true', 'false']),
  sql: new Set(['SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE', 'DROP', 'ALTER', 'INDEX', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON', 'AND', 'OR', 'NOT', 'NULL', 'IS', 'IN', 'LIKE', 'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'AS', 'DISTINCT', 'UNION', 'ALL', 'EXISTS', 'BETWEEN', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'CASCADE', 'BEGIN', 'COMMIT', 'ROLLBACK', 'TRANSACTION', 'TRUE', 'FALSE']),
};

// Alias keyword sets for related languages
KEYWORD_SETS.javascript = KEYWORD_SETS.typescript;
KEYWORD_SETS.cpp = new Set([...KEYWORD_SETS.c, 'class', 'public', 'private', 'protected', 'virtual', 'override', 'template', 'typename', 'namespace', 'using', 'new', 'delete', 'try', 'catch', 'throw', 'bool', 'true', 'false', 'nullptr', 'auto', 'constexpr', 'noexcept']);
KEYWORD_SETS.ruby = new Set(['def', 'class', 'module', 'end', 'if', 'elsif', 'else', 'unless', 'while', 'until', 'for', 'do', 'begin', 'rescue', 'ensure', 'raise', 'return', 'yield', 'block_given?', 'self', 'true', 'false', 'nil', 'and', 'or', 'not', 'in', 'then', 'when', 'case', 'require', 'include', 'extend', 'attr_reader', 'attr_writer', 'attr_accessor', 'puts', 'print', 'p']);

interface Token {
  text: string;
  type: 'keyword' | 'string' | 'comment' | 'number' | 'plain';
}

function tokenizeLine(line: string, lang: string): Token[] {
  const keywords = KEYWORD_SETS[lang] || new Set<string>();
  const tokens: Token[] = [];
  let i = 0;

  while (i < line.length) {
    // Comments
    if (line[i] === '/' && line[i + 1] === '/') {
      tokens.push({ text: line.substring(i), type: 'comment' });
      break;
    }
    if (line[i] === '#' && (lang === 'python' || lang === 'shell' || lang === 'ruby' || lang === 'yaml' || lang === 'toml')) {
      tokens.push({ text: line.substring(i), type: 'comment' });
      break;
    }
    if (line[i] === '-' && line[i + 1] === '-' && lang === 'sql') {
      tokens.push({ text: line.substring(i), type: 'comment' });
      break;
    }

    // Strings
    if (line[i] === '"' || line[i] === "'" || line[i] === '`') {
      const quote = line[i];
      let j = i + 1;
      while (j < line.length && line[j] !== quote) {
        if (line[j] === '\\') j++;
        j++;
      }
      j = Math.min(j + 1, line.length);
      tokens.push({ text: line.substring(i, j), type: 'string' });
      i = j;
      continue;
    }

    // Numbers
    if (/\d/.test(line[i]) && (i === 0 || /[\s,({[=<>!+\-*/%&|^~:]/.test(line[i - 1]))) {
      let j = i;
      if (line[j] === '0' && (line[j + 1] === 'x' || line[j + 1] === 'o' || line[j + 1] === 'b')) j += 2;
      while (j < line.length && /[\d.a-fA-F_]/.test(line[j])) j++;
      tokens.push({ text: line.substring(i, j), type: 'number' });
      i = j;
      continue;
    }

    // Words (potential keywords)
    if (/[a-zA-Z_#]/.test(line[i])) {
      let j = i;
      while (j < line.length && /[a-zA-Z0-9_?!#]/.test(line[j])) j++;
      const word = line.substring(i, j);
      const isKw = keywords.has(word) || (lang === 'sql' && keywords.has(word.toUpperCase()));
      tokens.push({ text: word, type: isKw ? 'keyword' : 'plain' });
      i = j;
      continue;
    }

    // Other characters
    let j = i;
    while (j < line.length && !/[a-zA-Z0-9_"'`#]/.test(line[j]) && !(line[j] === '/' && line[j + 1] === '/') && !(line[j] === '-' && line[j + 1] === '-' && lang === 'sql')) {
      j++;
    }
    if (j === i) j++;
    tokens.push({ text: line.substring(i, j), type: 'plain' });
    i = j;
  }

  return tokens;
}

const TOKEN_COLORS: Record<Token['type'], string> = {
  keyword: 'text-purple-400',
  string: 'text-green-400',
  comment: 'text-gray-500 italic',
  number: 'text-orange-400',
  plain: 'text-[var(--color-text-primary)]',
};

function SyntaxView({ content, ext, wrapLines }: { content: string; ext: string; wrapLines: boolean }) {
  const lang = LANG_MAP[ext] || '';
  const lines = content.split('\n');

  const highlighted = useMemo(() => {
    if (!lang) return null;
    return lines.map((line, i) => ({
      lineNum: i + 1,
      tokens: tokenizeLine(line, lang),
    }));
  }, [lines, lang]);

  if (!lang || !highlighted) {
    return (
      <pre
        className={`text-xs text-[var(--color-text-primary)] p-3 font-mono leading-5 ${
          wrapLines ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'
        }`}
      >
        {content || '(empty file)'}
      </pre>
    );
  }

  return (
    <div className="text-xs font-mono leading-5">
      {highlighted.map((line) => (
        <div key={line.lineNum} className="flex hover:bg-[var(--color-bg-hover)]/30">
          <span className="w-12 flex-shrink-0 text-right pr-3 text-[var(--color-text-muted)] select-none opacity-50 border-r border-[var(--color-border)]/30">
            {line.lineNum}
          </span>
          <span className={`pl-3 ${wrapLines ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'}`}>
            {line.tokens.map((tok, ti) => (
              <span key={ti} className={TOKEN_COLORS[tok.type]}>{tok.text}</span>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

function HexView({ content }: { content: string }) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(content);
  const lines: string[] = [];
  const BYTES_PER_LINE = 16;

  for (let i = 0; i < bytes.length && i < 65536; i += BYTES_PER_LINE) {
    const offset = i.toString(16).padStart(8, '0');
    const chunk = bytes.slice(i, i + BYTES_PER_LINE);
    const hex = Array.from(chunk)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(' ');
    const ascii = Array.from(chunk)
      .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
      .join('');
    lines.push(`${offset}  ${hex.padEnd(47)}  ${ascii}`);
  }

  return (
    <pre className="text-xs text-[var(--color-text-primary)] p-3 font-mono leading-5 whitespace-pre">
      {lines.join('\n')}
      {bytes.length > 65536 && '\n\n... (truncated at 64KB)'}
    </pre>
  );
}
