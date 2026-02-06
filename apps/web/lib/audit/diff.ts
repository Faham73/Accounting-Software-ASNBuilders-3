/**
 * Audit diff utility for creating structured diffs between before and after states
 */

export interface FieldDiff {
  field: string;
  from: any;
  to: any;
}

export interface StructuredDiff {
  fields: FieldDiff[];
  linesAdded?: any[];
  linesRemoved?: any[];
  linesChanged?: Array<{ id: string; changes: FieldDiff[] }>;
}

/**
 * Create a structured diff between two objects
 */
export function createDiff(before: any, after: any): StructuredDiff {
  const diff: StructuredDiff = {
    fields: [],
  };

  if (!before && !after) {
    return diff;
  }

  if (!before) {
    // All fields are new
    Object.keys(after || {}).forEach((key) => {
      if (key !== 'lines' && key !== 'updatedAt') {
        diff.fields.push({
          field: key,
          from: undefined,
          to: after[key],
        });
      }
    });
    return diff;
  }

  if (!after) {
    // All fields are removed
    Object.keys(before || {}).forEach((key) => {
      if (key !== 'lines' && key !== 'updatedAt') {
        diff.fields.push({
          field: key,
          from: before[key],
          to: undefined,
        });
      }
    });
    return diff;
  }

  // Compare fields (excluding lines and updatedAt)
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  allKeys.forEach((key) => {
    if (key === 'lines' || key === 'updatedAt') {
      return; // Handle lines separately
    }

    const beforeVal = before[key];
    const afterVal = after[key];

    // Deep comparison for objects/arrays
    if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
      diff.fields.push({
        field: key,
        from: beforeVal,
        to: afterVal,
      });
    }
  });

  // Handle lines separately if they exist
  if (before.lines || after.lines) {
    const beforeLines = (before.lines || []).map((l: any) => ({
      id: l.id || `temp-${Math.random()}`,
      ...l,
    }));
    const afterLines = (after.lines || []).map((l: any) => ({
      id: l.id || `temp-${Math.random()}`,
      ...l,
    }));

    const beforeMap = new Map(beforeLines.map((l: any) => [l.id, l]));
    const afterMap = new Map(afterLines.map((l: any) => [l.id, l]));

    // Find added lines
    diff.linesAdded = afterLines.filter((l: any) => !beforeMap.has(l.id));

    // Find removed lines
    diff.linesRemoved = beforeLines.filter((l: any) => !afterMap.has(l.id));

    // Find changed lines
    diff.linesChanged = [];
    afterLines.forEach((afterLine: any) => {
      const beforeLine = beforeMap.get(afterLine.id);
      if (beforeLine) {
        const lineChanges: FieldDiff[] = [];
        const beforeRec = beforeLine as Record<string, unknown>;
        const afterRec = afterLine as Record<string, unknown>;
        Object.keys(afterRec).forEach((key) => {
          if (key !== 'id' && key !== 'createdAt' && key !== 'updatedAt') {
            if (JSON.stringify(beforeRec[key]) !== JSON.stringify(afterRec[key])) {
              lineChanges.push({
                field: key,
                from: beforeRec[key],
                to: afterRec[key],
              });
            }
          }
        });
        if (lineChanges.length > 0) {
          diff.linesChanged!.push({
            id: afterLine.id,
            changes: lineChanges,
          });
        }
      }
    });
  }

  return diff;
}

/**
 * Create a simple before/after snapshot for audit logging
 */
export function createAuditSnapshot(data: any): any {
  if (!data) return null;

  // Remove circular references and format for JSON
  const snapshot = JSON.parse(JSON.stringify(data, (key, value) => {
    // Exclude certain fields that change frequently or are not meaningful
    if (key === 'updatedAt') {
      return undefined;
    }
    return value;
  }));

  return snapshot;
}
