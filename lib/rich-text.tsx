import { Fragment, type ReactNode } from "react"
import { isSafeLinkTarget } from "@/lib/url-safety"

/**
 * Lightweight, XSS-safe inline formatting for admin-edited copy.
 *
 * The dashboard's text editors store plain strings; this lets editors add a
 * SMALL, deliberately constrained set of formatting using familiar Markdown:
 *
 *   **bold**      → <strong>
 *   *italic*      → <em>     (also _italic_)
 *   [text](url)   → <a>      (href gated through isSafeLinkTarget; external
 *                             links get target=_blank rel=noopener)
 *
 * That set is the agreed default — confirm/extend with Victor before adding
 * block-level controls (headings, lists). Headings in particular are withheld
 * on purpose: admin-injected heading levels would break the document heading
 * hierarchy the accessibility pass established.
 *
 * Safety: this never interpolates HTML. It only ever constructs <strong>,
 * <em>, <a>, <br/>, and text nodes, so a Table-Editor-authored value (which
 * bypasses the dashboard) cannot inject markup, and an unsafe link target
 * degrades to its visible text. Pure — safe in Server and Client Components.
 */

// One token = bold | italic(*) | italic(_) | [text](url). Each emphasis body
// is single-line and cannot contain its own delimiter, which keeps the matcher
// greedy-safe without a real parser. The link URL allows one level of nested
// parens so real targets like .../Foo_(bar) survive intact; deeper nesting is
// an accepted limitation of this small subset.
const LINK_URL = String.raw`\((?:[^()\n]|\([^()\n]*\))*\)`
const INLINE_TOKEN = new RegExp(
  `(\\*\\*[^*\\n]+\\*\\*|\\*[^*\\n]+\\*|_[^_\\n]+_|\\[[^\\]\\n]+\\]${LINK_URL})`,
  "g",
)

function renderSegment(part: string, key: string): ReactNode {
  if (part.startsWith("**") && part.endsWith("**")) {
    return <strong key={key}>{part.slice(2, -2)}</strong>
  }
  if (part.startsWith("*") && part.endsWith("*")) {
    return <em key={key}>{part.slice(1, -1)}</em>
  }
  if (part.startsWith("_") && part.endsWith("_")) {
    return <em key={key}>{part.slice(1, -1)}</em>
  }
  const link = /^\[([^\]]+)\]\(((?:[^()]|\([^()]*\))*)\)$/.exec(part)
  if (link) {
    const [, text, rawHref] = link
    const href = rawHref.trim()
    if (!isSafeLinkTarget(href)) {
      // Drop an unsafe/typo'd target, keep the visible words.
      return <Fragment key={key}>{text}</Fragment>
    }
    const external = /^https?:\/\//i.test(href)
    return (
      <a
        key={key}
        href={href}
        className="underline underline-offset-2 hover:no-underline"
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {text}
      </a>
    )
  }
  return <Fragment key={key}>{part}</Fragment>
}

/**
 * Renders a single line of inline Markdown to React nodes. The caller owns
 * block layout (its own <p>/spacing) — use this where paragraphs are already
 * split (e.g. the About body array).
 */
export function renderInlineMarkdown(text: string): ReactNode {
  if (!text) return text
  // split() with a capturing group keeps the delimiters as their own entries.
  return text
    .split(INLINE_TOKEN)
    .map((part, i) => (part ? renderSegment(part, `md-${i}`) : null))
}

/**
 * Block wrapper for a multi-line string: blank lines separate paragraphs and a
 * single newline becomes a <br/>. Each line is run through the inline renderer.
 * Use for free-form long-form copy stored as one value (footer tagline, notices).
 */
export function RichText({
  value,
  className,
  paragraphClassName,
}: {
  value: string
  className?: string
  paragraphClassName?: string
}): ReactNode {
  if (!value) return null
  const paragraphs = value.split(/\n{2,}/)
  return (
    <div className={className}>
      {paragraphs.map((para, pi) => (
        <p key={`p-${pi}`} className={paragraphClassName}>
          {para.split("\n").map((line, li) => (
            <Fragment key={`l-${li}`}>
              {li > 0 ? <br /> : null}
              {renderInlineMarkdown(line)}
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  )
}
