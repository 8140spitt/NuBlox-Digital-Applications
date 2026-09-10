from pathlib import Path

p = Path('app/src/lib/server/strategy/enterprise-performance-service.ts')
s = p.read_text()

start = s.index('function decimal(value: number | string, label: string): string {')
end = s.index('export class EnterprisePerformanceService {')
helpers = '''function decimal(value: number | string, label: string): string {
\tconst normalized = String(value).trim();
\tif (!/^-?\\d{1,16}(?:\\.\\d{1,8})?$/.test(normalized))
\t\tthrow new EnterprisePerformanceValidationError(
\t\t\t`${label} must be a decimal with up to 16 integer and 8 fractional digits.`
\t\t);
\treturn normalized;
}

function optionalDecimal(value: number | string | null | undefined, label: string): string | null {
\tif (value === null || value === undefined || value === '') return null;
\treturn decimal(value, label);
}

const DECIMAL_SCALE = 100_000_000n;

function decimalUnits(value: string): bigint {
\tconst negative = value.startsWith('-');
\tconst unsigned = negative ? value.slice(1) : value;
\tconst [whole, fraction = ''] = unsigned.split('.');
\tconst units = BigInt(whole) * DECIMAL_SCALE + BigInt(fraction.padEnd(8, '0'));
\treturn negative ? -units : units;
}

function decimalFromUnits(units: bigint): string {
\tconst negative = units < 0n;
\tconst absolute = negative ? -units : units;
\tconst whole = absolute / DECIMAL_SCALE;
\tconst fraction = (absolute % DECIMAL_SCALE).toString().padStart(8, '0').replace(/0+$/, '');
\treturn `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}

function compareDecimal(left: string, right: string): number {
\tconst leftUnits = decimalUnits(left);
\tconst rightUnits = decimalUnits(right);
\treturn leftUnits < rightUnits ? -1 : leftUnits > rightUnits ? 1 : 0;
}

function positiveInteger(value: number | string | undefined, fallback = 1): number {
\tif (value === undefined || value === '') return fallback;
\tconst result = Number(value);
\tif (!Number.isInteger(result) || result < 1)
\t\tthrow new EnterprisePerformanceValidationError('Display order must be a positive integer.');
\treturn result;
}

function variance(target: string, actual: string): { value: string; percent: string | null } {
\tconst targetUnits = decimalUnits(target);
\tconst actualUnits = decimalUnits(actual);
\tconst difference = actualUnits - targetUnits;
\tconst absoluteTarget = targetUnits < 0n ? -targetUnits : targetUnits;
\treturn {
\t\tvalue: decimalFromUnits(difference),
\t\tpercent:
\t\t\ttargetUnits === 0n
\t\t\t\t? null
\t\t\t\t: decimalFromUnits((difference * 100n * DECIMAL_SCALE) / absoluteTarget)
\t};
}

function assess(
\tkpi: PerformanceKpiRecord,
\tactualValue: string,
\tmaterialityThresholdPercent: string | null
): 'on_track' | 'watch' | 'off_track' {
\tconst actual = decimalUnits(actualValue);
\tconst target = decimalUnits(kpi.target_value);
\tconst warning = kpi.warning_threshold === null ? null : decimalUnits(kpi.warning_threshold);
\tconst critical = kpi.critical_threshold === null ? null : decimalUnits(kpi.critical_threshold);
\tif (kpi.direction === 'higher_is_better') {
\t\tif (actual >= target) return 'on_track';
\t\tif (warning !== null && actual >= warning) return 'watch';
\t\tif (critical !== null && actual >= critical) return 'watch';
\t\treturn 'off_track';
\t}
\tif (kpi.direction === 'lower_is_better') {
\t\tif (actual <= target) return 'on_track';
\t\tif (warning !== null && actual <= warning) return 'watch';
\t\tif (critical !== null && actual <= critical) return 'watch';
\t\treturn 'off_track';
\t}
\tconst threshold = decimalUnits(materialityThresholdPercent ?? '5');
\tconst difference = actual >= target ? actual - target : target - actual;
\tconst absoluteTarget = target < 0n ? -target : target;
\tconst deviation =
\t\ttarget === 0n ? difference : (difference * 100n * DECIMAL_SCALE) / absoluteTarget;
\tif (deviation <= threshold) return 'on_track';
\tif (deviation <= threshold * 2n) return 'watch';
\treturn 'off_track';
}

'''
s = s[:start] + helpers + s[end:]

old = """\t\t\t\t\t.where('id', '=', link.strategy_kpi_id)\n\t\t\t\t\t.where('lifecycle_status', '=', 'approved')\n\t\t\t\t\t.executeTakeFirst();\n\t\t\t\tif (!kpi)\n\t\t\t\t\tthrow new EnterprisePerformanceValidationError(\n\t\t\t\t\t\t'Framework references a KPI that is no longer approved.'\n\t\t\t\t\t);"""
new = """\t\t\t\t\t.where('id', '=', link.strategy_kpi_id)\n\t\t\t\t\t.executeTakeFirst();\n\t\t\t\tif (!kpi || !['approved', 'superseded'].includes(kpi.lifecycle_status))\n\t\t\t\t\tthrow new EnterprisePerformanceValidationError(\n\t\t\t\t\t\t'Framework references a KPI version that is not available for governed reporting.'\n\t\t\t\t\t);"""
if old not in s:
    raise SystemExit('Pinned KPI block not found')
s = s.replace(old, new, 1)

old = """\t\t\t\t\t.where('strategy_kpi_id', '=', kpi.id)\n\t\t\t\t\t.where('observed_on', '<=', period.period_end)"""
new = """\t\t\t\t\t.where('strategy_kpi_id', '=', kpi.id)\n\t\t\t\t\t.where('observed_on', '>=', period.period_start)\n\t\t\t\t\t.where('observed_on', '<=', period.period_end)"""
if old not in s:
    raise SystemExit('Observation period block not found')
s = s.replace(old, new, 1)

old = """\t\t\tif (!benchmark || !observation || benchmark.strategy_kpi_id !== observation.strategy_kpi_id)\n\t\t\t\tthrow new RecordNotFoundError('Comparable benchmark and KPI observation not found.');\n\t\t\tconst delta = variance(benchmark.benchmark_value, observation.actual_value);"""
new = """\t\t\tif (!benchmark || !observation || benchmark.strategy_kpi_id !== observation.strategy_kpi_id)\n\t\t\t\tthrow new RecordNotFoundError('Comparable benchmark and KPI observation not found.');\n\t\t\tif (observation.observed_on < benchmark.period_start || observation.observed_on > benchmark.period_end)\n\t\t\t\tthrow new EnterprisePerformanceValidationError(\n\t\t\t\t\t'Benchmark comparison requires an observation inside the benchmark period.'\n\t\t\t\t);\n\t\t\tconst delta = variance(benchmark.benchmark_value, observation.actual_value);"""
if old not in s:
    raise SystemExit('Benchmark comparison block not found')
s = s.replace(old, new, 1)

old = """\t\t\tconst confidence = Number(decimal(input.confidencePercent, 'Confidence percent'));\n\t\t\tif (confidence < 0 || confidence > 100)"""
new = """\t\t\tconst confidence = decimal(input.confidencePercent, 'Confidence percent');\n\t\t\tif (compareDecimal(confidence, '0') < 0 || compareDecimal(confidence, '100') > 0)"""
if old not in s:
    raise SystemExit('Confidence block not found')
s = s.replace(old, new, 1)
s = s.replace('\t\t\t\tconfidence_percent: confidence.toString(),', '\t\t\t\tconfidence_percent: confidence,', 1)

old = """\t\t\tif (Number(row.realised_value) >= Number(benefit.target_value))\n\t\t\t\tawait repository.updateBenefit(actor.organisationId, benefit.id, {\n\t\t\t\t\tlifecycle_status: 'achieved'\n\t\t\t\t});"""
new = """\t\t\tconst targetDirection = compareDecimal(benefit.target_value, benefit.baseline_value);\n\t\t\tconst targetReached =\n\t\t\t\ttargetDirection > 0\n\t\t\t\t\t? compareDecimal(row.realised_value, benefit.target_value) >= 0\n\t\t\t\t\t: targetDirection < 0\n\t\t\t\t\t\t? compareDecimal(row.realised_value, benefit.target_value) <= 0\n\t\t\t\t\t\t: compareDecimal(row.realised_value, benefit.target_value) === 0;\n\t\t\tif (targetReached)\n\t\t\t\tawait repository.updateBenefit(actor.organisationId, benefit.id, {\n\t\t\t\t\tlifecycle_status: 'achieved'\n\t\t\t\t});"""
if old not in s:
    raise SystemExit('Benefit achievement block not found')
s = s.replace(old, new, 1)
p.write_text(s)

server = Path('app/src/routes/(app)/performance/+page.server.ts')
t = server.read_text()
t = t.replace("operation: (\n\t\tservice: EnterprisePerformanceService,\n\t\tactor: TenantActorContext\n\t) => Promise<{ public_id?: string } | void>,", "operation: (\n\t\tservice: EnterprisePerformanceService,\n\t\tactor: TenantActorContext\n\t) => Promise<unknown>,")
t = t.replace("\t\tconst result = await operation(new EnterprisePerformanceService(getDatabase()), actor);\n\t\tconst selected = frameworkPublicId ?? result?.public_id ?? null;", "\t\tconst result = await operation(new EnterprisePerformanceService(getDatabase()), actor);\n\t\tconst selected =\n\t\t\tframeworkPublicId ??\n\t\t\t(typeof result === 'object' && result !== null && 'public_id' in result\n\t\t\t\t? String(result.public_id)\n\t\t\t\t: null);")
server.write_text(t)

page = Path('app/src/routes/(app)/performance/+page.svelte')
u = page.read_text()
u = u.replace("\n\tconst packById = $derived(new Map(data.packs.map((row) => [row.id, row])));", '')
u = u.replace("\n\tconst varianceById = $derived(new Map(data.variances.map((row) => [row.id, row])));", '')
page.write_text(u)
