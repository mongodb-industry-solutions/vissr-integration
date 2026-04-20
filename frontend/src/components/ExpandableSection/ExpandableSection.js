"use client";

import { H3 } from "@leafygreen-ui/typography";
import Icon from "@leafygreen-ui/icon";

/**
 * ExpandableSection
 *
 * A reusable collapsible section component with a header and expandable content.
 *
 * @param {string} title - The title to display in the header
 * @param {boolean} isExpanded - Whether the section is expanded
 * @param {function} onToggleExpand - Callback when the header is clicked
 * @param {React.ReactNode} children - The content to display when expanded
 */
export default function ExpandableSection({
  title,
  isExpanded = true,
  onToggleExpand,
  children,
  headerSlot,
}) {
  const collapsible = typeof onToggleExpand === "function";

  return (
    <div
      className={`flex flex-col ${
        isExpanded ? "flex-1 h-full min-h-0" : ""
      }`}
    >
      <div
        className={`flex items-center justify-between flex-shrink-0 ${
          collapsible ? "cursor-pointer hover:opacity-80 transition-opacity" : ""
        }`}
        onClick={collapsible ? onToggleExpand : undefined}
      >
        <H3 className="mb-0">{title}</H3>
        <div className="flex items-center gap-2">
          {headerSlot}
          {collapsible ? (
            <Icon glyph={isExpanded ? "ChevronDown" : "ChevronRight"} />
          ) : null}
        </div>
      </div>

      {!isExpanded && <div className="flex-1" />}

      {isExpanded && children}
    </div>
  );
}
