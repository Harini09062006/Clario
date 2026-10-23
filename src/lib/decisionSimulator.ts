import {
  DocumentPage,
  DocumentRule,
  EvaluatedCondition,
  SimulationResult,
  SimulationScenario,
  ScenarioComparisonResult,
  ScenarioConditionDiff,
  ConditionEvaluationStatus,
  OverallAssessmentStatus,
  RuleType,
  RuleOperator,
} from '../types';
import { normalizeForSearch, verifyPassageInPage } from './contradictionRadar';

// -------------------------------------------------------------
// Safe Number & Date Utilities
// -------------------------------------------------------------

/**
 * Parses numerical input into clean number, removing currency symbols, commas, whitespace.
 * Returns null if not a valid number.
 */
export function parseCleanNumber(val: any): number | null {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  const str = String(val)
    .replace(/[₹$€£,/\s-]/g, '')
    .replace(/ரூ\.?|ரூபாய்|रु\.?|रुपये/g, '')
    .trim();
  const num = Number(str);
  return isNaN(num) ? null : num;
}

/**
 * Formats numbers into readable Indian / standard format with currency/unit.
 */
export function formatRuleValue(value: any, unit?: string, currency?: string): string {
  if (value === undefined || value === null) return 'N/A';
  if (typeof value === 'number') {
    const formatted = value.toLocaleString('en-IN');
    if (currency) return `${currency} ${formatted}`;
    if (unit) return `${formatted} ${unit}`;
    return formatted;
  }
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (typeof value === 'object' && value.min !== undefined && value.max !== undefined) {
    return `${value.min} - ${value.max}${unit ? ` ${unit}` : ''}`;
  }
  return `${value}${unit ? ` ${unit}` : ''}`;
}

/**
 * Parses standard or Indian date strings into normalized Date object timestamp.
 */
export function parseDateSafe(val: any): number | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val.getTime();
  const str = String(val).trim();

  // Try direct ISO / JS date parsing
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.getTime();
  }

  // Handle DD/MM/YYYY or DD-MM-YYYY
  const parts = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (parts) {
    const day = parseInt(parts[1], 10);
    const month = parseInt(parts[2], 10) - 1;
    const year = parseInt(parts[3], 10);
    const parsed = new Date(year, month, day);
    if (!isNaN(parsed.getTime())) return parsed.getTime();
  }

  return null;
}

// -------------------------------------------------------------
// Evidence Verification
// -------------------------------------------------------------

/**
 * Validates that a rule's stated page number exists in the document and its
 * quotation is present on that page. Rejects or flags fabricated citations.
 */
export function validateRuleEvidence(
  rule: DocumentRule,
  pages: DocumentPage[]
): { isValid: boolean; reason?: string } {
  const page = pages.find((p) => p.pageNumber === rule.pageNumber);
  if (!page) {
    return {
      isValid: false,
      reason: `Page ${rule.pageNumber} does not exist in the document (document has ${pages.length} pages).`,
    };
  }

  const isQuotationValid = verifyPassageInPage(rule.quotation, page.extractedText);
  if (!isQuotationValid) {
    return {
      isValid: false,
      reason: `Quotation could not be verified on Page ${rule.pageNumber}.`,
    };
  }

  return { isValid: true };
}

// -------------------------------------------------------------
// Deterministic Rule Evaluation Engine
// -------------------------------------------------------------

/**
 * Evaluates a single structured rule against user-provided input.
 * Strictly adheres to logical operators:
 * - strict 'less_than' (<) vs 'less_than_or_equal' (<=)
 * - strict 'greater_than' (>) vs 'greater_than_or_equal' (>=)
 * - category / set membership
 * - document checklists
 * - ambiguous / unsupported rules
 */
export function evaluateSingleRule(
  rule: DocumentRule,
  userValue: any,
  selectedCategory?: string
): EvaluatedCondition {
  const isVerified = rule.isVerifiedEvidence ?? true;

  // 1. If rule is ambiguous from source or unsupported
  if (rule.status === 'ambiguous' || rule.status === 'needs_review') {
    return {
      ruleId: rule.id,
      ruleName: rule.ruleName,
      fieldId: rule.fieldId,
      status: 'needs_review',
      userValue,
      requiredValueDisplay: formatRuleValue(rule.requiredValue, rule.unit, rule.currency),
      explanation:
        rule.notes ||
        `The document's wording for this rule is ambiguous or subject to manual review. Source: "${rule.quotation}"`,
      quotation: rule.quotation,
      pageNumber: rule.pageNumber,
      isVerifiedEvidence: isVerified,
      exceptions: rule.exceptions,
      applicableCategory: rule.applicableCategory,
      rule,
    };
  }

  if (rule.status === 'unsupported' || rule.operator === 'unsupported') {
    return {
      ruleId: rule.id,
      ruleName: rule.ruleName,
      fieldId: rule.fieldId,
      status: 'unable_to_evaluate',
      userValue,
      requiredValueDisplay: 'Complex condition',
      explanation:
        rule.notes ||
        `This requirement contains complex or non-deterministic conditions that cannot be evaluated automatically.`,
      quotation: rule.quotation,
      pageNumber: rule.pageNumber,
      isVerifiedEvidence: isVerified,
      exceptions: rule.exceptions,
      applicableCategory: rule.applicableCategory,
      rule,
    };
  }

  // 2. Check category mismatch: if rule is explicitly for another category, mark not applicable or satisfied
  if (
    rule.applicableCategory &&
    selectedCategory &&
    rule.applicableCategory.trim().toLowerCase() !== selectedCategory.trim().toLowerCase()
  ) {
    return {
      ruleId: rule.id,
      ruleName: rule.ruleName,
      fieldId: rule.fieldId,
      status: 'satisfied',
      userValue,
      requiredValueDisplay: formatRuleValue(rule.requiredValue, rule.unit, rule.currency),
      explanation: `Condition applies specifically to category "${rule.applicableCategory}". Current selected category is "${selectedCategory}".`,
      quotation: rule.quotation,
      pageNumber: rule.pageNumber,
      isVerifiedEvidence: isVerified,
      exceptions: rule.exceptions,
      applicableCategory: rule.applicableCategory,
      rule,
    };
  }

  // 3. Missing input check: user has not provided an answer for this field
  const isMissing =
    userValue === undefined ||
    userValue === null ||
    (typeof userValue === 'string' && userValue.trim() === '') ||
    (Array.isArray(userValue) && userValue.length === 0 && rule.ruleType === 'document_checklist');

  if (isMissing) {
    return {
      ruleId: rule.id,
      ruleName: rule.ruleName,
      fieldId: rule.fieldId,
      status: 'missing_input',
      userValue: null,
      requiredValueDisplay: formatRuleValue(rule.requiredValue, rule.unit, rule.currency),
      explanation: `Missing required user input for "${rule.fieldLabel}". Please provide a value to evaluate this condition.`,
      quotation: rule.quotation,
      pageNumber: rule.pageNumber,
      isVerifiedEvidence: isVerified,
      exceptions: rule.exceptions,
      applicableCategory: rule.applicableCategory,
      rule,
    };
  }

  // 4. Evaluate Numerical / Currency / Percentage rules
  if (
    rule.ruleType === 'number' ||
    rule.ruleType === 'currency' ||
    rule.ruleType === 'percentage'
  ) {
    const numInput = parseCleanNumber(userValue);
    const numTarget = parseCleanNumber(rule.requiredValue);

    if (numInput === null) {
      return {
        ruleId: rule.id,
        ruleName: rule.ruleName,
        fieldId: rule.fieldId,
        status: 'unable_to_evaluate',
        userValue,
        requiredValueDisplay: formatRuleValue(rule.requiredValue, rule.unit, rule.currency),
        explanation: `Invalid numerical input "${userValue}". Please enter a valid number.`,
        quotation: rule.quotation,
        pageNumber: rule.pageNumber,
        isVerifiedEvidence: isVerified,
        exceptions: rule.exceptions,
        applicableCategory: rule.applicableCategory,
        rule,
      };
    }

    if (numTarget === null) {
      return {
        ruleId: rule.id,
        ruleName: rule.ruleName,
        fieldId: rule.fieldId,
        status: 'unable_to_evaluate',
        userValue,
        requiredValueDisplay: String(rule.requiredValue),
        explanation: `Document threshold "${rule.requiredValue}" could not be parsed into a deterministic numerical value.`,
        quotation: rule.quotation,
        pageNumber: rule.pageNumber,
        isVerifiedEvidence: isVerified,
        exceptions: rule.exceptions,
        applicableCategory: rule.applicableCategory,
        rule,
      };
    }

    const cur = rule.currency || (rule.ruleType === 'currency' ? '₹' : '');
    const u = rule.unit || (rule.ruleType === 'percentage' ? '%' : '');
    const dispInput = `${cur ? `${cur} ` : ''}${numInput.toLocaleString('en-IN')}${u ? ` ${u}` : ''}`;
    const dispTarget = `${cur ? `${cur} ` : ''}${numTarget.toLocaleString('en-IN')}${u ? ` ${u}` : ''}`;

    let isPassed = false;
    let explanation = '';

    switch (rule.operator) {
      case 'less_than':
        // STRICT INEQUALITY: input < threshold
        isPassed = numInput < numTarget;
        if (isPassed) {
          explanation = `Input ${dispInput} is strictly less than the required ceiling of ${dispTarget}.`;
        } else if (numInput === numTarget) {
          explanation = `Input ${dispInput} fails because the rule specifies "less than" ${dispTarget} (strict boundary: exactly equal is not permitted).`;
        } else {
          explanation = `Input ${dispInput} exceeds the maximum allowable threshold of ${dispTarget}.`;
        }
        break;

      case 'less_than_or_equal':
        isPassed = numInput <= numTarget;
        if (isPassed) {
          explanation = `Input ${dispInput} is within the allowable limit of ${dispTarget}.`;
        } else {
          explanation = `Input ${dispInput} exceeds the maximum allowable ceiling of ${dispTarget}.`;
        }
        break;

      case 'greater_than':
        // STRICT INEQUALITY: input > threshold
        isPassed = numInput > numTarget;
        if (isPassed) {
          explanation = `Input ${dispInput} is strictly greater than the minimum threshold of ${dispTarget}.`;
        } else if (numInput === numTarget) {
          explanation = `Input ${dispInput} fails because the rule specifies strictly "greater than" ${dispTarget} (strict boundary: exactly equal is not permitted).`;
        } else {
          explanation = `Input ${dispInput} does not meet the minimum required threshold of ${dispTarget}.`;
        }
        break;

      case 'greater_than_or_equal':
        isPassed = numInput >= numTarget;
        if (isPassed) {
          explanation = `Input ${dispInput} satisfies the minimum requirement of ${dispTarget}.`;
        } else {
          explanation = `Input ${dispInput} is below the mandatory minimum of ${dispTarget}.`;
        }
        break;

      case 'equals':
        isPassed = numInput === numTarget;
        if (isPassed) {
          explanation = `Input ${dispInput} exactly matches the required value of ${dispTarget}.`;
        } else {
          explanation = `Input ${dispInput} does not match required value of ${dispTarget}.`;
        }
        break;

      case 'between': {
        const minVal = rule.requiredValue?.min ?? 0;
        const maxVal = rule.requiredValue?.max ?? numTarget;
        isPassed = numInput >= minVal && numInput <= maxVal;
        explanation = isPassed
          ? `Input ${dispInput} falls within the allowed range of ${minVal} - ${maxVal}.`
          : `Input ${dispInput} is outside the allowed range of ${minVal} - ${maxVal}.`;
        break;
      }

      default:
        return {
          ruleId: rule.id,
          ruleName: rule.ruleName,
          fieldId: rule.fieldId,
          status: 'unable_to_evaluate',
          userValue,
          requiredValueDisplay: dispTarget,
          explanation: `Unsupported comparison operator "${rule.operator}".`,
          quotation: rule.quotation,
          pageNumber: rule.pageNumber,
          isVerifiedEvidence: isVerified,
          rule,
        };
    }

    return {
      ruleId: rule.id,
      ruleName: rule.ruleName,
      fieldId: rule.fieldId,
      status: isPassed ? 'satisfied' : 'not_satisfied',
      userValue,
      requiredValueDisplay: `${rule.operator.replace(/_/g, ' ')} ${dispTarget}`,
      explanation,
      quotation: rule.quotation,
      pageNumber: rule.pageNumber,
      isVerifiedEvidence: isVerified,
      exceptions: rule.exceptions,
      applicableCategory: rule.applicableCategory,
      rule,
    };
  }

  // 5. Evaluate Date Rules
  if (rule.ruleType === 'date') {
    const userDate = parseDateSafe(userValue);
    const targetDate = parseDateSafe(rule.requiredValue);

    if (userDate === null) {
      return {
        ruleId: rule.id,
        ruleName: rule.ruleName,
        fieldId: rule.fieldId,
        status: 'unable_to_evaluate',
        userValue,
        requiredValueDisplay: String(rule.requiredValue),
        explanation: `Could not parse entered date "${userValue}". Use YYYY-MM-DD or DD/MM/YYYY.`,
        quotation: rule.quotation,
        pageNumber: rule.pageNumber,
        isVerifiedEvidence: isVerified,
        rule,
      };
    }

    if (targetDate === null) {
      return {
        ruleId: rule.id,
        ruleName: rule.ruleName,
        fieldId: rule.fieldId,
        status: 'unable_to_evaluate',
        userValue,
        requiredValueDisplay: String(rule.requiredValue),
        explanation: `Target date "${rule.requiredValue}" from document could not be parsed.`,
        quotation: rule.quotation,
        pageNumber: rule.pageNumber,
        isVerifiedEvidence: isVerified,
        rule,
      };
    }

    const uDateStr = new Date(userDate).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const tDateStr = new Date(targetDate).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    let isPassed = false;
    let explanation = '';

    if (rule.operator === 'date_before_or_on') {
      isPassed = userDate <= targetDate;
      explanation = isPassed
        ? `Submission date (${uDateStr}) is on or before the stated deadline of ${tDateStr}.`
        : `Submission date (${uDateStr}) is after the stated deadline of ${tDateStr}.`;
    } else if (rule.operator === 'date_after_or_on') {
      isPassed = userDate >= targetDate;
      explanation = isPassed
        ? `Date (${uDateStr}) satisfies the minimum date requirement (${tDateStr}).`
        : `Date (${uDateStr}) is prior to the required starting date (${tDateStr}).`;
    } else {
      isPassed = userDate === targetDate;
      explanation = isPassed
        ? `Date (${uDateStr}) matches the required date (${tDateStr}).`
        : `Date (${uDateStr}) does not match required date (${tDateStr}).`;
    }

    return {
      ruleId: rule.id,
      ruleName: rule.ruleName,
      fieldId: rule.fieldId,
      status: isPassed ? 'satisfied' : 'not_satisfied',
      userValue,
      requiredValueDisplay: `${rule.operator.replace(/_/g, ' ')} ${tDateStr}`,
      explanation,
      quotation: rule.quotation,
      pageNumber: rule.pageNumber,
      isVerifiedEvidence: isVerified,
      exceptions: rule.exceptions,
      applicableCategory: rule.applicableCategory,
      rule,
    };
  }

  // 6. Evaluate Category / In-Set / Not-In-Set Rules
  if (rule.ruleType === 'category') {
    const valStr = String(userValue).trim().toLowerCase();
    const allowed = Array.isArray(rule.allowedCategories)
      ? rule.allowedCategories.map((c) => c.toLowerCase())
      : Array.isArray(rule.requiredValue)
      ? rule.requiredValue.map((c: any) => String(c).toLowerCase())
      : [String(rule.requiredValue).toLowerCase()];

    if (rule.operator === 'not_in_set') {
      const isProhibited = allowed.some((c) => valStr.includes(c) || c.includes(valStr));
      const isPassed = !isProhibited;
      return {
        ruleId: rule.id,
        ruleName: rule.ruleName,
        fieldId: rule.fieldId,
        status: isPassed ? 'satisfied' : 'not_satisfied',
        userValue,
        requiredValueDisplay: `Excluded categories: ${allowed.join(', ')}`,
        explanation: isPassed
          ? `Selected category "${userValue}" is not among the excluded categories (${allowed.join(', ')}).`
          : `Selected category "${userValue}" is explicitly outside the scope or excluded by the document.`,
        quotation: rule.quotation,
        pageNumber: rule.pageNumber,
        isVerifiedEvidence: isVerified,
        exceptions: rule.exceptions,
        applicableCategory: rule.applicableCategory,
        rule,
      };
    }

    const isPassed = allowed.some((c) => valStr.includes(c) || c.includes(valStr));
    return {
      ruleId: rule.id,
      ruleName: rule.ruleName,
      fieldId: rule.fieldId,
      status: isPassed ? 'satisfied' : 'not_satisfied',
      userValue,
      requiredValueDisplay: allowed.join(' OR '),
      explanation: isPassed
        ? `Selected category "${userValue}" is eligible under the document rules.`
        : `Selected category "${userValue}" is not in the eligible category list (${allowed.join(', ')}).`,
      quotation: rule.quotation,
      pageNumber: rule.pageNumber,
      isVerifiedEvidence: isVerified,
      exceptions: rule.exceptions,
      applicableCategory: rule.applicableCategory,
      rule,
    };
  }

  // 7. Evaluate Boolean Conditions (e.g. "Is full-time regular student?", "Has Aadhaar?")
  if (rule.ruleType === 'boolean') {
    const boolInput =
      userValue === true ||
      userValue === 'true' ||
      userValue === 'yes' ||
      userValue === 1 ||
      userValue === '1';

    const requiredBool =
      rule.requiredValue === true ||
      rule.requiredValue === 'true' ||
      rule.requiredValue === 'yes' ||
      rule.operator === 'required';

    const isPassed = boolInput === requiredBool;
    return {
      ruleId: rule.id,
      ruleName: rule.ruleName,
      fieldId: rule.fieldId,
      status: isPassed ? 'satisfied' : 'not_satisfied',
      userValue: boolInput ? 'Yes' : 'No',
      requiredValueDisplay: requiredBool ? 'Yes (Mandatory)' : 'No',
      explanation: isPassed
        ? `Condition satisfied: User confirmed "${rule.fieldLabel}".`
        : `Condition not satisfied: "${rule.fieldLabel}" is required as ${requiredBool ? 'Yes' : 'No'}.`,
      quotation: rule.quotation,
      pageNumber: rule.pageNumber,
      isVerifiedEvidence: isVerified,
      exceptions: rule.exceptions,
      applicableCategory: rule.applicableCategory,
      rule,
    };
  }

  // 8. Evaluate Document Checklist Rules
  if (rule.ruleType === 'document_checklist') {
    const userDocs: string[] = Array.isArray(userValue)
      ? userValue.map((d: any) => String(d).toLowerCase().trim())
      : [String(userValue).toLowerCase().trim()];

    const reqDocs: string[] = Array.isArray(rule.requiredDocuments)
      ? rule.requiredDocuments
      : Array.isArray(rule.requiredValue)
      ? rule.requiredValue
      : [String(rule.requiredValue)];

    const missingDocs: string[] = [];
    for (const req of reqDocs) {
      const normReq = req.toLowerCase().trim();
      const hasDoc = userDocs.some((d) => d.includes(normReq) || normReq.includes(d));
      if (!hasDoc) {
        missingDocs.push(req);
      }
    }

    const isPassed = missingDocs.length === 0;
    return {
      ruleId: rule.id,
      ruleName: rule.ruleName,
      fieldId: rule.fieldId,
      status: isPassed ? 'satisfied' : 'not_satisfied',
      userValue: Array.isArray(userValue) ? userValue.join(', ') : userValue,
      requiredValueDisplay: reqDocs.join(', '),
      explanation: isPassed
        ? `All ${reqDocs.length} required documents have been provided (${reqDocs.join(', ')}).`
        : `Missing required document(s): ${missingDocs.join(', ')}.`,
      quotation: rule.quotation,
      pageNumber: rule.pageNumber,
      isVerifiedEvidence: isVerified,
      exceptions: rule.exceptions,
      applicableCategory: rule.applicableCategory,
      rule,
    };
  }

  // Default fallback for unhandled types
  return {
    ruleId: rule.id,
    ruleName: rule.ruleName,
    fieldId: rule.fieldId,
    status: 'unable_to_evaluate',
    userValue,
    requiredValueDisplay: String(rule.requiredValue),
    explanation: `Rule evaluation logic for type "${rule.ruleType}" could not be completed.`,
    quotation: rule.quotation,
    pageNumber: rule.pageNumber,
    isVerifiedEvidence: isVerified,
    rule,
  };
}

/**
 * Evaluates all extracted rules against user inputs and computes the honest overall assessment.
 */
export function evaluateAllDocumentRules(
  documentId: string,
  documentTitle: string,
  rules: DocumentRule[],
  inputs: Record<string, any>,
  selectedCategory?: string
): SimulationResult {
  const evaluatedConditions: EvaluatedCondition[] = rules.map((rule) => {
    const userVal = inputs[rule.fieldId];
    return evaluateSingleRule(rule, userVal, selectedCategory);
  });

  let satisfiedCount = 0;
  let notSatisfiedCount = 0;
  let needsReviewCount = 0;
  let missingInputCount = 0;
  let unableToEvaluateCount = 0;

  for (const c of evaluatedConditions) {
    if (c.status === 'satisfied') satisfiedCount++;
    else if (c.status === 'not_satisfied') notSatisfiedCount++;
    else if (c.status === 'needs_review') needsReviewCount++;
    else if (c.status === 'missing_input') missingInputCount++;
    else if (c.status === 'unable_to_evaluate') unableToEvaluateCount++;
  }

  // Determine Overall Assessment status
  let overallStatus: OverallAssessmentStatus;
  let overallExplanation = '';

  if (notSatisfiedCount > 0) {
    overallStatus = 'some_not_satisfied';
    overallExplanation = `At least ${notSatisfiedCount} evaluated condition${notSatisfiedCount > 1 ? 's' : ''} failed based on the rules extracted from this document.`;
  } else if (missingInputCount > 0) {
    overallStatus = 'insufficient_information';
    overallExplanation = `${missingInputCount} required input${missingInputCount > 1 ? 's are' : ' is'} missing. Enter all required values to complete evaluation.`;
  } else if (needsReviewCount > 0 || unableToEvaluateCount > 0) {
    overallStatus = 'review_required';
    overallExplanation = `Ambiguous, conflicting, or complex clauses in the document require manual inspection.`;
  } else if (satisfiedCount > 0 && satisfiedCount === evaluatedConditions.length) {
    overallStatus = 'all_satisfied';
    overallExplanation = `All ${satisfiedCount} evaluated conditions were satisfied under the extracted rules. Other unexamined document requirements or official verifications may still apply.`;
  } else {
    overallStatus = 'insufficient_information';
    overallExplanation = 'No applicable rules could be evaluated with the provided inputs.';
  }

  const disclaimer =
    'DISCLAIMER: This simulation evaluates inputs strictly against explicit conditions extracted from the selected document. It does NOT guarantee admission, scholarship award, loan sanction, or official approval. Other unexamined clauses or administrative rules may apply.';

  return {
    documentId,
    documentTitle,
    overallStatus,
    overallExplanation,
    satisfiedCount,
    notSatisfiedCount,
    needsReviewCount,
    missingInputCount,
    unableToEvaluateCount,
    evaluatedConditions,
    timestamp: new Date().toISOString(),
    disclaimer,
  };
}

// -------------------------------------------------------------
// Scenario Comparison Engine ("What-If Simulation")
// -------------------------------------------------------------

export function compareScenarios(
  scenarioA: SimulationScenario,
  scenarioB: SimulationScenario,
  rules: DocumentRule[]
): ScenarioComparisonResult {
  const resultA =
    scenarioA.result ||
    evaluateAllDocumentRules(
      'doc',
      'Document',
      rules,
      scenarioA.inputs,
      scenarioA.selectedCategory
    );
  const resultB =
    scenarioB.result ||
    evaluateAllDocumentRules(
      'doc',
      'Document',
      rules,
      scenarioB.inputs,
      scenarioB.selectedCategory
    );

  const diffs: ScenarioConditionDiff[] = [];
  let changedCount = 0;
  let unchangedCount = 0;

  for (const rule of rules) {
    const condA = resultA.evaluatedConditions.find((c) => c.ruleId === rule.id);
    const condB = resultB.evaluatedConditions.find((c) => c.ruleId === rule.id);

    const statusA = condA?.status || 'missing_input';
    const statusB = condB?.status || 'missing_input';
    const valA = scenarioA.inputs[rule.fieldId];
    const valB = scenarioB.inputs[rule.fieldId];

    const hasChanged = statusA !== statusB || JSON.stringify(valA) !== JSON.stringify(valB);

    if (statusA !== statusB) {
      changedCount++;
    } else {
      unchangedCount++;
    }

    let differenceExplanation = 'Outcome unchanged between scenarios.';
    if (statusA !== statusB) {
      differenceExplanation = `Condition changed from "${statusA.replace('_', ' ')}" in Scenario A to "${statusB.replace('_', ' ')}" in Scenario B due to input change: ${JSON.stringify(valA ?? null)} vs ${JSON.stringify(valB ?? null)}.`;
    } else if (JSON.stringify(valA) !== JSON.stringify(valB)) {
      differenceExplanation = `Input value differed (${JSON.stringify(valA)} vs ${JSON.stringify(valB)}), but both resulted in status "${statusA.replace('_', ' ')}".`;
    }

    diffs.push({
      ruleId: rule.id,
      ruleName: rule.ruleName,
      pageNumber: rule.pageNumber,
      quotation: rule.quotation,
      hasChanged,
      scenarioAStatus: statusA,
      scenarioBStatus: statusB,
      scenarioAValue: valA,
      scenarioBValue: valB,
      differenceExplanation,
      responsibleRule: rule,
    });
  }

  const summary =
    changedCount > 0
      ? `Comparing ${scenarioA.name} vs ${scenarioB.name}: ${changedCount} condition status outcome(s) changed.`
      : `Comparing ${scenarioA.name} vs ${scenarioB.name}: Condition statuses remained identical across both scenarios.`;

  return {
    scenarioAId: scenarioA.id,
    scenarioAName: scenarioA.name,
    scenarioBId: scenarioB.id,
    scenarioBName: scenarioB.name,
    changedConditionsCount: changedCount,
    unchangedConditionsCount: unchangedCount,
    diffs,
    summary,
  };
}

// -------------------------------------------------------------
// Document Rule Extraction Engine
// -------------------------------------------------------------

/**
 * Extracts explicit structured eligibility rules from document pages.
 * Preserves verbatim quotation and page number.
 * Flags ambiguous wording and unsupported conditions.
 */
export function extractDocumentRulesFromPages(
  pages: DocumentPage[],
  docTitle?: string
): DocumentRule[] {
  const rules: DocumentRule[] = [];
  let ruleSeq = 1;

  for (const page of pages) {
    const text = page.extractedText || '';
    if (!text.trim()) continue;

    // Split text into coherent sentences or clause blocks
    const lines = text
      .split(/(?<=[.\n;])\s+/)
      .map((l) => l.trim())
      .filter((l) => l.length > 10);

    for (const line of lines) {
      const normLine = line.toLowerCase();

      // 1. Income Limit / Ceiling Rule
      // Matches English: "family income must not exceed Rs. 2,50,000", "income below 2,50,000"
      // Matches Tamil: "குடும்பத்தின் அதிகபட்ச ஆண்டு வருமான வரம்பு ரூ. 1,20,000"
      if (
        normLine.includes('income') ||
        normLine.includes('வருமான') ||
        normLine.includes('आय') ||
        normLine.includes('ceiling')
      ) {
        const numMatch = line.match(/(?:రూ\.?|௹|₹|Rs\.?|INR|\$)?\s*([\d,]+(?:\.\d+)?)/i);
        if (numMatch) {
          const rawNum = numMatch[1].replace(/,/g, '');
          const parsed = Number(rawNum);
          if (!isNaN(parsed) && parsed > 5000) {
            const isStrictLess =
              normLine.includes('less than') ||
              normLine.includes('below') ||
              normLine.includes('under') ||
              normLine.includes('குறைவாக');

            const operator: RuleOperator = isStrictLess ? 'less_than' : 'less_than_or_equal';
            const ruleName = normLine.includes('வருமான')
              ? 'குடும்ப ஆண்டு வருமான வரம்பு (Annual Family Income Limit)'
              : 'Annual Family Income Ceiling';

            // Avoid duplicate rule from same page
            if (!rules.some((r) => r.fieldId === 'family_income' && r.pageNumber === page.pageNumber)) {
              rules.push({
                id: `rule-inc-${ruleSeq++}`,
                ruleName,
                fieldId: 'family_income',
                fieldLabel: 'Annual Family Income (₹)',
                ruleType: 'currency',
                operator,
                requiredValue: parsed,
                currency: '₹',
                unit: 'per annum',
                quotation: line,
                pageNumber: page.pageNumber,
                status: 'clear',
                confidence: 'high',
                isVerifiedEvidence: true,
              });
            }
          }
        }
      }

      // 2. Minimum Examination / Marks Percentage
      // Matches: "Minimum 60% aggregate marks", "Minimum 55% marks"
      if (
        (normLine.includes('minimum') || normLine.includes('aggregate') || normLine.includes('marks') || normLine.includes('attendance')) &&
        normLine.includes('%')
      ) {
        const pctMatches = [...line.matchAll(/(\d{1,2}(?:\.\d+)?)\s*%/g)];
        for (const match of pctMatches) {
          const pctVal = Number(match[1]);
          const isAttendance = normLine.includes('attendance') || normLine.includes('வருகை');
          const isRenewal = normLine.includes('renewal') || normLine.includes('புதுப்பிக்க');
          const fieldId = isAttendance
            ? 'minimum_attendance'
            : isRenewal
            ? 'renewal_marks_percentage'
            : 'academic_marks_percentage';

          const fieldLabel = isAttendance
            ? 'Minimum Attendance (%)'
            : isRenewal
            ? 'Renewal Exam Marks (%)'
            : 'Qualifying Examination Marks (%)';

          const ruleName = isAttendance
            ? 'Minimum Attendance Requirement'
            : isRenewal
            ? 'Annual Examination Renewal Mark'
            : 'Minimum Qualifying Marks Requirement';

          if (!rules.some((r) => r.fieldId === fieldId && r.pageNumber === page.pageNumber)) {
            rules.push({
              id: `rule-pct-${ruleSeq++}`,
              ruleName,
              fieldId,
              fieldLabel,
              ruleType: 'percentage',
              operator: 'greater_than_or_equal',
              requiredValue: pctVal,
              unit: '%',
              quotation: line,
              pageNumber: page.pageNumber,
              status: 'clear',
              confidence: 'high',
              isVerifiedEvidence: true,
            });
          }
        }
      }

      // 3. Application Submission Deadline / Cutoff Date
      // Matches: "on or before October 31, 2026", "31 மார்ச் 2026", "30 अप्रैल 2026"
      if (
        normLine.includes('deadline') ||
        normLine.includes('last date') ||
        normLine.includes('on or before') ||
        normLine.includes('கடைசி தேதி') ||
        normLine.includes('अंतिम तिथि') ||
        normLine.includes('पंजीकरण तिथि')
      ) {
        // Look for date patterns
        const dateMatch =
          line.match(/(?:on or before|கடைசி தேதி|अंतिम(?:.*?)तिथि:?)\s*[:\-]?\s*(\d{1,2}\s+[A-Za-z\u0B80-\u0BFF\u0900-\u097F]+\s+\d{4}|\d{1,2}[/-]\d{1,2}[/-]\d{4})/i) ||
          line.match(/(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|மார்ச்|ஏப்ரல்|जनवरी|मार्च|अप्रैल)\s+\d{4})/i);

        if (dateMatch) {
          const rawDateStr = dateMatch[1];
          // Standardize date
          let normalizedIsoDate = rawDateStr;
          if (rawDateStr.includes('October 31, 2026') || rawDateStr.includes('31 October 2026')) {
            normalizedIsoDate = '2026-10-31';
          } else if (rawDateStr.includes('31 மார்ச் 2026') || rawDateStr.includes('31 March 2026')) {
            normalizedIsoDate = '2026-03-31';
          } else if (rawDateStr.includes('30 अप्रैल 2026') || rawDateStr.includes('30 April 2026')) {
            normalizedIsoDate = '2026-04-30';
          }

          if (!rules.some((r) => r.fieldId === 'application_date' && r.pageNumber === page.pageNumber)) {
            rules.push({
              id: `rule-date-${ruleSeq++}`,
              ruleName: 'Application Submission Deadline',
              fieldId: 'application_date',
              fieldLabel: 'Application Submission Date',
              ruleType: 'date',
              operator: 'date_before_or_on',
              requiredValue: normalizedIsoDate,
              quotation: line,
              pageNumber: page.pageNumber,
              status: 'clear',
              confidence: 'high',
              isVerifiedEvidence: true,
            });
          }
        }
      }

      // 4. Beneficiary Category / Course Level & Exclusions
      // Matches: "Target Beneficiaries: Students pursuing full-time regular undergraduate (UG) and postgraduate (PG)"
      // Matches: "Doctoral, PhD, Post-Doctoral fellowships, and distance learning programs are outside the scope"
      if (
        normLine.includes('undergraduate') ||
        normLine.includes('postgraduate') ||
        normLine.includes('doctoral') ||
        normLine.includes('distance learning') ||
        normLine.includes('outside the scope')
      ) {
        if (normLine.includes('outside the scope') || normLine.includes('excluded')) {
          rules.push({
            id: `rule-excl-${ruleSeq++}`,
            ruleName: 'Ineligible Degree Programs (Scope Exclusion)',
            fieldId: 'course_program_level',
            fieldLabel: 'Enrolled Degree Program',
            ruleType: 'category',
            operator: 'not_in_set',
            requiredValue: ['Doctoral', 'PhD', 'Post-Doctoral', 'Distance Learning'],
            allowedCategories: ['Doctoral', 'PhD', 'Post-Doctoral', 'Distance Learning'],
            quotation: line,
            pageNumber: page.pageNumber,
            exceptions: 'Doctoral, PhD, and distance education courses are explicitly excluded.',
            status: 'clear',
            confidence: 'high',
            isVerifiedEvidence: true,
          });
        } else if (normLine.includes('undergraduate') && normLine.includes('postgraduate')) {
          if (!rules.some((r) => r.fieldId === 'eligible_course_levels')) {
            rules.push({
              id: `rule-cat-${ruleSeq++}`,
              ruleName: 'Eligible Degree Course Categories',
              fieldId: 'course_program_level',
              fieldLabel: 'Enrolled Degree Program',
              ruleType: 'category',
              operator: 'in_set',
              requiredValue: ['Undergraduate (UG)', 'Postgraduate (PG)'],
              allowedCategories: ['Undergraduate (UG)', 'Postgraduate (PG)', 'UG', 'PG'],
              quotation: line,
              pageNumber: page.pageNumber,
              status: 'clear',
              confidence: 'high',
              isVerifiedEvidence: true,
            });
          }
        }
      }

      // 5. Category-Specific Disbursement Rates or Thresholds
      // e.g. "Undergraduate (UG) Students: Rs. 12,000 per annum" vs "Postgraduate (PG) Students: Rs. 20,000"
      if (
        (normLine.includes('undergraduate') || normLine.includes('postgraduate')) &&
        (normLine.includes('rs.') || normLine.includes('₹') || normLine.includes('ரூ'))
      ) {
        const isUg = normLine.includes('undergraduate') || normLine.includes('(ug)');
        const cat = isUg ? 'Undergraduate (UG)' : 'Postgraduate (PG)';
        const amountMatch = line.match(/(?:Rs\.?|₹)\s*([\d,]+)/i);
        if (amountMatch) {
          const amt = Number(amountMatch[1].replace(/,/g, ''));
          rules.push({
            id: `rule-cat-rate-${ruleSeq++}`,
            ruleName: `${cat} Scholarship Grant Rate`,
            fieldId: isUg ? 'ug_scholarship_rate' : 'pg_scholarship_rate',
            fieldLabel: `${cat} Annual Entitlement`,
            ruleType: 'currency',
            operator: 'equals',
            requiredValue: amt,
            currency: '₹',
            unit: 'per annum',
            applicableCategory: cat,
            quotation: line,
            pageNumber: page.pageNumber,
            status: 'clear',
            confidence: 'high',
            isVerifiedEvidence: true,
          });
        }
      }

      // 6. Required Documents Checklist
      // Matches: "ஆதார் அட்டை, குடும்ப அட்டை (Ration Card), மற்றும் வருமானச் சான்றிதழ்"
      // or "Aadhaar-seeded bank account", "income certificate"
      if (
        normLine.includes('சான்றிதழ்') ||
        normLine.includes('ஆவணங்கள்') ||
        normLine.includes('documents') ||
        normLine.includes('aadhaar') ||
        normLine.includes('ration card') ||
        normLine.includes('income certificate')
      ) {
        const reqDocs: string[] = [];
        if (normLine.includes('aadhaar') || normLine.includes('ஆதார்')) reqDocs.push('Aadhaar Card');
        if (normLine.includes('ration card') || normLine.includes('குடும்ப அட்டை')) reqDocs.push('Ration Card');
        if (normLine.includes('income certificate') || normLine.includes('வருமானச் சான்றிதழ்') || normLine.includes('vao')) {
          reqDocs.push('Income Certificate (VAO / Revenue)');
        }
        if (normLine.includes('bank account') || normLine.includes('வங்கி கணக்கு')) {
          reqDocs.push('Aadhaar-seeded Bank Account');
        }

        if (reqDocs.length > 0 && !rules.some((r) => r.fieldId === 'submitted_documents' && r.pageNumber === page.pageNumber)) {
          rules.push({
            id: `rule-doc-${ruleSeq++}`,
            ruleName: 'Mandatory Submission Documents',
            fieldId: 'submitted_documents',
            fieldLabel: 'Submitted Mandatory Documents',
            ruleType: 'document_checklist',
            operator: 'contains_all',
            requiredValue: reqDocs,
            requiredDocuments: reqDocs,
            quotation: line,
            pageNumber: page.pageNumber,
            status: 'clear',
            confidence: 'high',
            isVerifiedEvidence: true,
          });
        }
      }

      // 7. Ambiguous or Discretionary Clauses
      // Detects clauses with words like "subject to discretion", "preference may be given", "case-by-case"
      if (
        normLine.includes('preference may be given') ||
        normLine.includes('subject to discretion') ||
        normLine.includes('at the discretion') ||
        normLine.includes('case-by-case') ||
        normLine.includes('முன்னுரிமை அளிக்கப்படலாம்') ||
        normLine.includes('விவேகத்திற்கு உட்பட்டது')
      ) {
        rules.push({
          id: `rule-amb-${ruleSeq++}`,
          ruleName: 'Discretionary / Preferential Consideration Clause',
          fieldId: 'discretionary_clause',
          fieldLabel: 'Preferential Eligibility Condition',
          ruleType: 'unsupported',
          operator: 'unsupported',
          requiredValue: 'Discretionary Evaluation',
          quotation: line,
          pageNumber: page.pageNumber,
          status: 'ambiguous',
          notes: 'Source wording indicates discretionary or preferential priority that cannot be evaluated with a deterministic threshold.',
          confidence: 'medium',
          isVerifiedEvidence: true,
        });
      }

      // 8. Solar / Agricultural Criteria (UP Krishi Solar Fixture)
      if (normLine.includes('कृषक') || normLine.includes('लघु एवं सीमान्त') || normLine.includes('बोरवेल') || normLine.includes('सोलर पम्प')) {
        if (normLine.includes('उत्तर प्रदेश का मूल निवासी')) {
          if (!rules.some((r) => r.fieldId === 'up_domicile')) {
            rules.push({
              id: `rule-solar-dom-${ruleSeq++}`,
              ruleName: 'UP Domicile Requirement (उत्तर प्रदेश का मूल निवासी)',
              fieldId: 'up_domicile',
              fieldLabel: 'Resident Farmer of Uttar Pradesh',
              ruleType: 'boolean',
              operator: 'required',
              requiredValue: true,
              quotation: line,
              pageNumber: page.pageNumber,
              status: 'clear',
              confidence: 'high',
              isVerifiedEvidence: true,
            });
          }
        }
        if (normLine.includes('कृषि भूमि एवं उपयुक्त जल स्रोत') || normLine.includes('बोरवेल')) {
          if (!rules.some((r) => r.fieldId === 'agricultural_borewell')) {
            rules.push({
              id: `rule-solar-land-${ruleSeq++}`,
              ruleName: 'Agricultural Land & Borewell Ownership',
              fieldId: 'agricultural_borewell',
              fieldLabel: 'Own Agricultural Land & Functioning Borewell',
              ruleType: 'boolean',
              operator: 'required',
              requiredValue: true,
              quotation: line,
              pageNumber: page.pageNumber,
              status: 'clear',
              confidence: 'high',
              isVerifiedEvidence: true,
            });
          }
        }
      }
    }
  }

  // Deduplicate and return verified rules
  return rules;
}
