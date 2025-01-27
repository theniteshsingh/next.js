import { useMemo, Fragment, useState } from 'react'
import type { ComponentStackFrame } from '../../helpers/parse-component-stack'
import { CollapseIcon } from '../../icons/CollapseIcon'

/**
 *
 * Format component stack into pseudo HTML
 * component stack is an array of strings, e.g.: ['p', 'p', 'Page', ...]
 *
 * For html tags mismatch, it will render it for the code block
 *
 * ```
 * <pre>
 *  <code>{`
 *    <Page>
 *       <p>
 *       ^^^
 *         <p>
 *         ^^^
 *  `}</code>
 * </pre>
 * ```
 *
 * For text mismatch, it will render it for the code block
 *
 * ```diff
 * <pre>
 * <code>{`
 *   <Page>
 *     <p>
 * -     "Server Text"
 * +     "Client Text"
 *     </p>
 *   </Page>
 * `}</code>
 * ```
 */
export function PseudoHtmlDiff({
  componentStackFrames,
  firstContent,
  secondContent,
  hydrationMismatchType,
  ...props
}: {
  componentStackFrames: ComponentStackFrame[]
  firstContent: string
  secondContent: string
  hydrationMismatchType: 'tag' | 'text' | 'text-in-tag'
} & React.HTMLAttributes<HTMLPreElement>) {
  const isHtmlTagsWarning = hydrationMismatchType === 'tag'
  // For text mismatch, mismatched text will take 2 rows, so we display 4 rows of component stack
  const MAX_NON_COLLAPSED_FRAMES = isHtmlTagsWarning ? 6 : 4
  const shouldCollapse = componentStackFrames.length > MAX_NON_COLLAPSED_FRAMES
  const [isHtmlCollapsed, toggleCollapseHtml] = useState(shouldCollapse)

  const htmlComponents = useMemo(() => {
    const tagNames = isHtmlTagsWarning ? [firstContent, secondContent] : []
    const nestedHtmlStack: React.ReactNode[] = []
    let lastText = ''

    componentStackFrames
      .map((frame) => frame.component)
      .reverse()
      .forEach((component, index, componentList) => {
        const spaces = ' '.repeat(nestedHtmlStack.length * 2)
        const prevComponent = componentList[index - 1]
        const nextComponent = componentList[index + 1]
        // When component is the server or client tag name, highlight it

        const isHighlightedTag = tagNames.includes(component)
        const isRelatedTag =
          isHighlightedTag ||
          tagNames.includes(prevComponent) ||
          tagNames.includes(nextComponent)

        const isLastFewFrames =
          !isHtmlTagsWarning && index >= componentList.length - 6

        if ((isHtmlTagsWarning && isRelatedTag) || isLastFewFrames) {
          const codeLine = (
            <span>
              {spaces}
              <span
                {...(isHighlightedTag
                  ? {
                      'data-nextjs-container-errors-pseudo-html--tag-error':
                        true,
                    }
                  : undefined)}
              >
                {`<${component}>\n`}
              </span>
            </span>
          )
          lastText = component

          const wrappedCodeLine = (
            <Fragment key={nestedHtmlStack.length}>
              {codeLine}
              {/* Add ^^^^ to the target tags */}
              {isHighlightedTag && (
                <span>{spaces + '^'.repeat(component.length + 2) + '\n'}</span>
              )}
            </Fragment>
          )
          nestedHtmlStack.push(wrappedCodeLine)
        } else {
          if (
            nestedHtmlStack.length >= MAX_NON_COLLAPSED_FRAMES &&
            isHtmlCollapsed
          ) {
            return
          }

          if (!isHtmlCollapsed || isLastFewFrames) {
            nestedHtmlStack.push(
              <span key={nestedHtmlStack.length}>
                {spaces}
                {'<' + component + '>\n'}
              </span>
            )
          } else if (isHtmlCollapsed && lastText !== '...') {
            lastText = '...'
            nestedHtmlStack.push(
              <span key={nestedHtmlStack.length}>
                {spaces}
                {'...\n'}
              </span>
            )
          }
        }
      })

    // Hydration mismatch: text or text-tag
    if (!isHtmlTagsWarning) {
      const spaces = ' '.repeat(nestedHtmlStack.length * 2)
      let wrappedCodeLine
      if (hydrationMismatchType === 'text') {
        // hydration type is "text", represent [server content, client content]
        wrappedCodeLine = (
          <Fragment key={nestedHtmlStack.length}>
            <span data-nextjs-container-errors-pseudo-html--diff-remove>
              {spaces + `"${firstContent}"\n`}
            </span>
            <span data-nextjs-container-errors-pseudo-html--diff-add>
              {spaces + `"${secondContent}"\n`}
            </span>
          </Fragment>
        )
      } else {
        // hydration type is "text-in-tag", represent [parent tag, mismatch content]
        wrappedCodeLine = (
          <Fragment key={nestedHtmlStack.length}>
            <span>{spaces + `<${secondContent}>\n`}</span>
            <span data-nextjs-container-errors-pseudo-html--diff-remove>
              {spaces + `  "${firstContent}"\n`}
            </span>
          </Fragment>
        )
      }
      nestedHtmlStack.push(wrappedCodeLine)
    }

    return nestedHtmlStack
  }, [
    componentStackFrames,
    isHtmlCollapsed,
    firstContent,
    secondContent,
    isHtmlTagsWarning,
    hydrationMismatchType,
    MAX_NON_COLLAPSED_FRAMES,
  ])

  return (
    <div data-nextjs-container-errors-pseudo-html>
      <button
        tabIndex={10} // match CallStackFrame
        data-nextjs-container-errors-pseudo-html-collapse
        onClick={() => toggleCollapseHtml(!isHtmlCollapsed)}
      >
        <CollapseIcon collapsed={isHtmlCollapsed} />
      </button>
      <pre {...props}>
        <code>{htmlComponents}</code>
      </pre>
    </div>
  )
}
