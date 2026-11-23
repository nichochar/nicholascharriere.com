// Format a content date as a calendar day ("Nov 22, 2026").
// Formatted in UTC because YAML date-only frontmatter (`published: 2026-11-22`)
// is parsed as UTC midnight; local-time formatting would show the previous day
// in US timezones.
export const formatDate = (date: Date) =>
  date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
