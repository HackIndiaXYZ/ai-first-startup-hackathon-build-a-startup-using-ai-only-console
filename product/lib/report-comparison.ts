import type { DrillReport } from "./domain";

export function comparePreviousReport(
  current: DrillReport,
  reports: DrillReport[],
) {
  const previous = reports
    .filter(
      (report) =>
        report.lotCode === current.lotCode &&
        report.revision < current.revision,
    )
    .sort((a, b) => b.revision - a.revision)[0];
  if (!previous) return null;
  return {
    previous,
    confirmedChange: current.confirmedPacks - previous.confirmedPacks,
    unresolvedChange: current.unresolvedPacks - previous.unresolvedPacks,
    addedCustomers: current.customers.filter(
      (name) => !previous.customers.includes(name),
    ),
    removedCustomers: previous.customers.filter(
      (name) => !current.customers.includes(name),
    ),
  };
}
