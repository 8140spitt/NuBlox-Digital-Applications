<script lang="ts">
	import type { Snippet } from 'svelte';

	export type TableColumn = {
		key: string;
		label: string;
		align?: 'start' | 'center' | 'end';
		width?: string;
	};

	type Row = Record<string, unknown>;

	type Props = {
		columns: TableColumn[];
		rows: Row[];
		caption: string;
		emptyMessage?: string;
		cell?: Snippet<[Row, TableColumn]>;
	};

	let { columns, rows, caption, emptyMessage = 'No records to show.', cell }: Props = $props();

	function displayValue(value: unknown): string {
		if (value === null || value === undefined || value === '') return '—';
		return String(value);
	}
</script>

<div class="table-frame">
	<table>
		<caption class="nb-sr-only">{caption}</caption>
		<thead>
			<tr>
				{#each columns as column (column.key)}
					<th scope="col" style:width={column.width} class:align-center={column.align === 'center'} class:align-end={column.align === 'end'}>
						{column.label}
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#if rows.length === 0}
				<tr>
					<td class="empty" colspan={columns.length}>{emptyMessage}</td>
				</tr>
			{:else}
				{#each rows as row, index (index)}
					<tr>
						{#each columns as column (column.key)}
							<td class:align-center={column.align === 'center'} class:align-end={column.align === 'end'}>
								{#if cell}
									{@render cell(row, column)}
								{:else}
									{displayValue(row[column.key])}
								{/if}
							</td>
						{/each}
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
</div>

<style>
	.table-frame {
		overflow-x: auto;
		border: 1px solid var(--nb-color-border-default);
		border-radius: var(--nb-radius-lg);
		background: var(--nb-color-bg-surface);
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--nb-font-size-sm);
	}
	th,
	td {
		height: var(--nb-density-row-height);
		border-bottom: 1px solid var(--nb-color-border-subtle);
		padding: var(--nb-space-2) var(--nb-space-4);
		text-align: left;
		vertical-align: middle;
	}
	th {
		background: var(--nb-color-bg-subtle);
		color: var(--nb-color-text-muted);
		font-size: var(--nb-font-size-xs);
		font-weight: var(--nb-weight-semibold);
		letter-spacing: 0.03em;
		white-space: nowrap;
	}
	tbody tr:last-child td {
		border-bottom: 0;
	}
	tbody tr:hover td:not(.empty) {
		background: var(--nb-color-bg-subtle);
	}
	.align-center {
		text-align: center;
	}
	.align-end {
		text-align: right;
	}
	.empty {
		height: auto;
		padding: var(--nb-space-10) var(--nb-space-4);
		color: var(--nb-color-text-muted);
		text-align: center;
	}
</style>
