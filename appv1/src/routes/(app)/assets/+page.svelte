<script lang="ts">
	let { data, form } = $props();
	const anyView = $derived(
		data.canViewAssets ||
			data.canViewFacilities ||
			data.canViewMaintenance ||
			data.canViewCompliance
	);
	function facilityName(id: string) {
		const row = data.facilities.find((candidate) => candidate.id === id);
		return row ? `${row.facilityCode} · ${row.name}` : 'Facility';
	}
	function workOrderAssignments(id: string) {
		return data.contractorAssignments.filter((row) => row.workOrderId === id);
	}
	function shortDate(value: Date | string | null) {
		if (!value) return '—';
		return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value));
	}
	function shortDateTime(value: Date | string | null) {
		if (!value) return '—';
		return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(
			new Date(value)
		);
	}
</script>

<svelte:head><title>Assets & facilities · NuBlox</title></svelte:head>

<section class="page-header">
	<div>
		<p class="eyebrow">Operations</p>
		<h1>Assets & facilities</h1>
		<p>
			Operate long-lived facilities and assets through reactive and planned maintenance, service
			history and compliance evidence.
		</p>
	</div>
	{#if data.canManageRequests && data.facilities.length > 0}<a
			class="header-action"
			href="#create-maintenance-request">New maintenance request</a
		>{/if}
</section>
{#if form?.error}<p class="error" role="alert">{form.error}</p>{/if}

{#if !anyView}
	<section class="notice">
		<h2>Assets and facilities are restricted</h2>
		<p>Your current role does not grant operational asset visibility.</p>
	</section>
{:else}
	<section class="metrics" aria-label="Assets and maintenance summary">
		<article><span>Facilities</span><strong>{data.facilities.length}</strong></article>
		<article><span>Assets</span><strong>{data.assets.length}</strong></article>
		<article>
			<span>Open requests</span><strong
				>{data.requests.filter(
					(row) => !['resolved', 'cancelled', 'rejected', 'duplicate'].includes(row.requestStatus)
				).length}</strong
			>
		</article>
		<article>
			<span>Open work orders</span><strong
				>{data.workOrders.filter(
					(row) => !['completed', 'cancelled', 'void'].includes(row.workOrderStatus)
				).length}</strong
			>
		</article>
	</section>

	{#if data.canViewFacilities}
		<section class="workspace-section" id="facility-register">
			<div class="section-heading">
				<div>
					<p class="eyebrow">Estate</p>
					<h2>Facilities & hierarchy</h2>
				</div>
				<span class="count">{data.facilities.length}</span>
			</div>
			<div class="cards">
				{#each data.facilities as facility}
					<article class="record-card">
						<div class="card-title">
							<strong>{facility.facilityCode} · {facility.name}</strong><span
								>{facility.operationalStatus}</span
							>
						</div>
						<p>{facility.description ?? 'No description.'}</p>
						<small
							>{facility.timezone ?? 'Timezone not set'} · Opened {shortDate(
								facility.openedOn
							)}</small
						>
						<ul>
							{#each data.buildings.filter((row) => row.facilityId === facility.id) as building}<li>
									<strong>{building.buildingCode}</strong>
									{building.name} · {data.levels.filter((row) => row.buildingId === building.id)
										.length} levels · {data.spaces.filter((row) => row.buildingId === building.id)
										.length} spaces
								</li>{/each}
						</ul>
					</article>
				{/each}
			</div>
		</section>
	{/if}

	{#if data.canManageFacilities}
		<section class="form-grid">
			<form class="panel" id="create-facility" method="POST" action="?/createFacility">
				<h3>Create facility</h3>
				<label>Facility code<input name="facilityCode" required /></label><label
					>Facility name<input name="name" required /></label
				><label>Description<textarea name="description" rows="2"></textarea></label><label
					>Timezone<input name="timezone" placeholder="Europe/London" /></label
				>
				<div class="two">
					<label>Commissioned<input type="date" name="commissionedOn" /></label><label
						>Opened<input type="date" name="openedOn" /></label
					>
				</div>
				<button>Create facility</button>
			</form>
			<form class="panel" id="create-building" method="POST" action="?/createBuilding">
				<h3>Add building</h3>
				<label
					>Facility<select name="facilityPublicId" required
						><option value="">Select…</option>{#each data.facilities as row}<option
								value={row.publicId}>{row.facilityCode} · {row.name}</option
							>{/each}</select
					></label
				><label>Building code<input name="buildingCode" required /></label><label
					>Building name<input name="name" required /></label
				><button>Add building</button>
			</form>
			<form class="panel" id="create-level" method="POST" action="?/createLevel">
				<h3>Add level</h3>
				<label
					>Building<select name="buildingPublicId" required
						><option value="">Select…</option>{#each data.buildings as row}<option
								value={row.publicId}>{row.buildingCode} · {row.name}</option
							>{/each}</select
					></label
				><label>Level code<input name="levelCode" required /></label><label
					>Level name<input name="name" required /></label
				><label>Sort order<input type="number" min="1" name="sortOrder" value="1" required /></label
				><button>Add level</button>
			</form>
			<form class="panel" id="create-space" method="POST" action="?/createSpace">
				<h3>Add space</h3>
				<label
					>Building<select name="buildingPublicId" required
						><option value="">Select…</option>{#each data.buildings as row}<option
								value={row.publicId}>{row.buildingCode} · {row.name}</option
							>{/each}</select
					></label
				><label
					>Level <span>optional</span><select name="levelPublicId"
						><option value="">None</option>{#each data.levels as row}<option value={row.publicId}
								>{row.levelCode} · {row.name}</option
							>{/each}</select
					></label
				><label>Space code<input name="spaceCode" required /></label><label
					>Space name<input name="name" required /></label
				><label>Space type<input name="spaceType" /></label><button>Add space</button>
			</form>
		</section>
	{/if}

	{#if data.canViewAssets}
		<section class="workspace-section" id="asset-register">
			<div class="section-heading">
				<div>
					<p class="eyebrow">Register</p>
					<h2>Assets</h2>
				</div>
				<span class="count">{data.assets.length}</span>
			</div>
			<div class="cards">
				{#each data.assets as asset}<article class="record-card asset-card">
						<div class="card-title">
							<strong>{asset.assetTag} · {asset.name}</strong><span>{asset.lifecycleStatus}</span>
						</div>
						<p>{asset.assetTypeName} · {asset.criticality} criticality</p>
						<small
							>{facilityName(asset.facilityId)}{asset.buildingName
								? ` · ${asset.buildingName}`
								: ''}{asset.spaceName ? ` · ${asset.spaceName}` : ''}</small
						>
						{#if data.canManageAssetLifecycle && !['disposed', 'archived'].includes(asset.lifecycleStatus)}<form
								class="inline"
								method="POST"
								action="?/transitionAsset"
							>
								<input type="hidden" name="assetPublicId" value={asset.publicId} /><select
									name="toStatus"
									aria-label="Lifecycle status"
									>{#if asset.lifecycleStatus === 'active'}<option value="isolated">Isolate</option
										><option value="inactive">Make inactive</option><option value="decommissioned"
											>Decommission</option
										>{:else if asset.lifecycleStatus === 'isolated'}<option value="active"
											>Return to service</option
										><option value="decommissioned">Decommission</option
										>{:else if asset.lifecycleStatus === 'decommissioned'}<option value="disposed"
											>Dispose</option
										>{:else}<option value="active">Activate</option><option value="decommissioned"
											>Decommission</option
										>{/if}</select
								><input
									name="notes"
									aria-label="Lifecycle note"
									placeholder="Lifecycle note"
								/><button>Update lifecycle</button>
							</form>{/if}
					</article>{/each}
			</div>
		</section>
	{/if}

	{#if data.canManageAssets}
		<section class="form-grid">
			<form class="panel" id="create-asset-type" method="POST" action="?/createAssetType">
				<h3>Create asset type</h3>
				<label
					>Category<select name="categoryCode" required
						>{#each data.assetCategories as row}<option value={row.code}>{row.name}</option
							>{/each}</select
					></label
				><label>Type code<input name="code" required /></label><label
					>Type name<input name="name" required /></label
				><label>Description<textarea name="description" rows="2"></textarea></label><button
					>Create asset type</button
				>
			</form>
			<form class="panel" id="create-asset" method="POST" action="?/createAsset">
				<h3>Register asset</h3>
				<label
					>Facility<select name="facilityPublicId" required
						><option value="">Select…</option>{#each data.facilities as row}<option
								value={row.publicId}>{row.facilityCode} · {row.name}</option
							>{/each}</select
					></label
				><label
					>Asset type<select name="assetTypePublicId" required
						><option value="">Select…</option>{#each data.assetTypes as row}<option
								value={row.publicId}>{row.code} · {row.name}</option
							>{/each}</select
					></label
				><label
					>Building <span>optional</span><select name="buildingPublicId"
						><option value="">None</option>{#each data.buildings as row}<option value={row.publicId}
								>{row.buildingCode} · {row.name}</option
							>{/each}</select
					></label
				><label
					>Level <span>optional</span><select name="levelPublicId"
						><option value="">None</option>{#each data.levels as row}<option value={row.publicId}
								>{row.levelCode} · {row.name}</option
							>{/each}</select
					></label
				><label
					>Space <span>optional</span><select name="spacePublicId"
						><option value="">None</option>{#each data.spaces as row}<option value={row.publicId}
								>{row.spaceCode} · {row.name}</option
							>{/each}</select
					></label
				><label
					>Parent asset <span>optional</span><select name="parentAssetPublicId"
						><option value="">None</option>{#each data.assets as row}<option value={row.publicId}
								>{row.assetTag} · {row.name}</option
							>{/each}</select
					></label
				><label>Asset tag<input name="assetTag" required /></label><label
					>Asset name<input name="name" required /></label
				><label>Serial number<input name="serialNumber" /></label><label
					>Criticality<select name="criticality"
						><option>low</option><option selected>medium</option><option>high</option><option
							>critical</option
						></select
					></label
				><label>Description<textarea name="description" rows="2"></textarea></label><button
					>Register asset</button
				>
			</form>
		</section>
	{/if}

	{#if data.canViewMaintenance}
		<section class="workspace-section" id="maintenance-request-register">
			<div class="section-heading">
				<div>
					<p class="eyebrow">Reactive</p>
					<h2>Maintenance requests</h2>
				</div>
				<span class="count">{data.requests.length}</span>
			</div>
			<div class="cards">
				{#each data.requests as request}<article class="record-card request-card">
						<div class="card-title">
							<strong>{request.requestNumber} · {request.title}</strong><span
								>{request.requestStatus}</span
							>
						</div>
						<p>{request.description}</p>
						<small
							>{facilityName(request.facilityId)} · {request.priorityName} · {shortDateTime(
								request.reportedAt
							)}</small
						>
						{#if data.canManageWorkOrders && !['resolved', 'cancelled', 'rejected', 'duplicate'].includes(request.requestStatus)}<form
								class="inline"
								method="POST"
								action="?/createReactiveWorkOrder"
							>
								<input type="hidden" name="requestPublicId" value={request.publicId} /><select
									name="assetPublicId"
									aria-label="Asset"
									required
									><option value="">Asset…</option
									>{#each data.assets.filter((row) => row.facilityId === request.facilityId) as row}<option
											value={row.publicId}>{row.assetTag} · {row.name}</option
										>{/each}</select
								><button>Create reactive work order</button>
							</form>{/if}
						{#if data.canManageRequests && !['resolved', 'cancelled', 'rejected', 'duplicate'].includes(request.requestStatus)}<form
								class="inline"
								method="POST"
								action="?/resolveMaintenanceRequest"
							>
								<input type="hidden" name="requestPublicId" value={request.publicId} /><input
									name="resolutionNote"
									aria-label="Resolution note"
									placeholder="Resolution note"
									required
								/><button>Resolve request</button>
							</form>{/if}
					</article>{/each}
			</div>
		</section>
	{/if}

	{#if data.canManageRequests}<form
			class="panel wide"
			id="create-maintenance-request"
			method="POST"
			action="?/createMaintenanceRequest"
		>
			<h3>Report maintenance request</h3>
			<div class="two">
				<label
					>Facility<select name="facilityPublicId" required
						><option value="">Select…</option>{#each data.facilities as row}<option
								value={row.publicId}>{row.facilityCode} · {row.name}</option
							>{/each}</select
					></label
				><label
					>Affected asset <span>optional</span><select name="assetPublicId"
						><option value="">None</option>{#each data.assets as row}<option value={row.publicId}
								>{row.assetTag} · {row.name}</option
							>{/each}</select
					></label
				>
			</div>
			<div class="two">
				<label
					>Type<select name="requestType"
						><option value="fault">Fault</option><option value="breakdown">Breakdown</option><option
							value="damage">Damage</option
						><option value="alarm">Alarm</option><option value="user_request">User request</option
						><option value="defect">Defect</option></select
					></label
				><label
					>Priority<select name="priorityCode"
						>{#each data.priorities as row}<option value={row.code} selected={row.code === 'normal'}
								>{row.name}</option
							>{/each}</select
					></label
				>
			</div>
			<label>Title<input name="title" required /></label><label
				>Description<textarea name="description" rows="3" required></textarea></label
			><button>Report request</button>
		</form>{/if}

	{#if data.canViewMaintenance}<section class="workspace-section" id="maintenance-plan-register">
			<div class="section-heading">
				<div>
					<p class="eyebrow">Planned</p>
					<h2>Maintenance plans</h2>
				</div>
				<span class="count">{data.plans.length}</span>
			</div>
			<div class="cards">
				{#each data.plans as plan}<article class="record-card">
						<div class="card-title">
							<strong>{plan.planNumber} · {plan.name}</strong><span>{plan.lifecycleStatus}</span>
						</div>
						<p>{plan.planTypeName} · {facilityName(plan.facilityId)}</p>
						{#each data.planTasks.filter((row) => row.maintenancePlanId === plan.id) as task}<div
								class="task"
							>
								<strong>{task.taskNumber}. {task.title}</strong><small
									>{task.scheduleBasis ?? 'manual'}{task.intervalValue
										? ` every ${task.intervalValue} ${task.intervalUnit}`
										: ''}</small
								>{#if data.canManageWorkOrders}<form
										class="inline"
										method="POST"
										action="?/generatePlannedWorkOrder"
									>
										<input type="hidden" name="planTaskId" value={task.id} /><select
											name="assetPublicId"
											aria-label="Asset"
											required
											><option value="">Asset…</option
											>{#each data.assets.filter((row) => row.facilityId === plan.facilityId) as row}<option
													value={row.publicId}>{row.assetTag} · {row.name}</option
												>{/each}</select
										><button>Generate work order</button>
									</form>{/if}
							</div>{/each}
					</article>{/each}
			</div>
		</section>{/if}
	{#if data.canManagePlans}<form
			class="panel wide"
			id="create-maintenance-plan"
			method="POST"
			action="?/createMaintenancePlan"
		>
			<h3>Create planned maintenance</h3>
			<div class="two">
				<label
					>Facility<select name="facilityPublicId" required
						><option value="">Select…</option>{#each data.facilities as row}<option
								value={row.publicId}>{row.facilityCode} · {row.name}</option
							>{/each}</select
					></label
				><label
					>Asset<select name="assetPublicId" required
						><option value="">Select…</option>{#each data.assets as row}<option value={row.publicId}
								>{row.assetTag} · {row.name}</option
							>{/each}</select
					></label
				>
			</div>
			<div class="two">
				<label
					>Plan type<select name="planTypeCode"
						>{#each data.planTypes as row}<option value={row.code}>{row.name}</option
							>{/each}</select
					></label
				><label>Plan name<input name="name" required /></label>
			</div>
			<label>Description<textarea name="description" rows="2"></textarea></label><label
				>Task title<input name="taskTitle" required /></label
			><label>Instructions<textarea name="instructions" rows="2"></textarea></label>
			<div class="three">
				<label>Every<input type="number" min="1" name="intervalValue" value="12" required /></label
				><label
					>Unit<select name="intervalUnit"
						><option>day</option><option>week</option><option selected>month</option><option
							>year</option
						></select
					></label
				><label>Starts<input type="date" name="startsOn" /></label>
			</div>
			<button>Create active maintenance plan</button>
		</form>{/if}

	{#if data.canViewMaintenance}<section class="workspace-section" id="work-order-register">
			<div class="section-heading">
				<div>
					<p class="eyebrow">Execution</p>
					<h2>Work orders</h2>
				</div>
				<span class="count">{data.workOrders.length}</span>
			</div>
			<div class="cards">
				{#each data.workOrders as order}<article class="record-card work-order-card">
						<div class="card-title">
							<strong>{order.workOrderNumber} · {order.title}</strong><span
								>{order.workOrderStatus}</span
							>
						</div>
						<p>
							{order.workOrderTypeName} · {order.priorityName} · {facilityName(order.facilityId)}
						</p>
						<small
							>Scheduled {shortDateTime(order.scheduledStartAt)} · Completed {shortDateTime(
								order.completedAt
							)}</small
						>{#each workOrderAssignments(order.id) as assignment}<p class="assignment">
								Contractor: {assignment.displayName}
							</p>{/each}
						{#if data.canManageAssignments && !['completed', 'cancelled', 'void'].includes(order.workOrderStatus)}<form
								class="inline"
								method="POST"
								action="?/assignContractor"
							>
								<input type="hidden" name="workOrderPublicId" value={order.publicId} /><select
									name="contractorPartyPublicId"
									aria-label="Contractor"
									required
									><option value="">Contractor…</option>{#each data.contractors as row}<option
											value={row.publicId}>{row.displayName}</option
										>{/each}</select
								><button>Assign contractor</button>
							</form>{/if}
						{#if data.canCompleteWorkOrders && !['completed', 'cancelled', 'void'].includes(order.workOrderStatus)}<form
								class="inline"
								method="POST"
								action="?/completeWorkOrder"
							>
								<input type="hidden" name="workOrderPublicId" value={order.publicId} /><input
									name="completionSummary"
									aria-label="Completion summary"
									placeholder="Completion summary"
									required
								/><button>Complete work order</button>
							</form>{/if}
					</article>{/each}
			</div>
		</section>{/if}

	{#if data.canViewAssets || data.canViewMaintenance}<section
			class="workspace-section"
			id="service-history"
		>
			<div class="section-heading">
				<div>
					<p class="eyebrow">Evidence</p>
					<h2>Service history</h2>
				</div>
				<span class="count">{data.serviceEvents.length}</span>
			</div>
			<div class="cards">
				{#each data.serviceEvents as event}<article class="record-card service-card">
						<div class="card-title">
							<strong>{event.assetTag} · {event.serviceTypeName}</strong><span
								>{event.resultCode}</span
							>
						</div>
						<p>{event.notes ?? 'No service note.'}</p>
						<small
							>{shortDateTime(event.performedAt)} · condition {event.conditionRating ??
								'not rated'}</small
						>
					</article>{/each}
			</div>
		</section>{/if}
	{#if data.canManageService}<form
			class="panel wide"
			id="create-service-event"
			method="POST"
			action="?/recordServiceEvent"
		>
			<h3>Record asset service / inspection</h3>
			<div class="two">
				<label
					>Asset<select name="assetPublicId" required
						><option value="">Select…</option>{#each data.assets as row}<option value={row.publicId}
								>{row.assetTag} · {row.name}</option
							>{/each}</select
					></label
				><label
					>Completed work order <span>optional</span><select name="workOrderPublicId"
						><option value="">None</option
						>{#each data.workOrders.filter((row) => row.workOrderStatus === 'completed') as row}<option
								value={row.publicId}>{row.workOrderNumber} · {row.title}</option
							>{/each}</select
					></label
				>
			</div>
			<div class="three">
				<label
					>Service type<select name="serviceTypeCode"
						>{#each data.serviceEventTypes as row}<option value={row.code}>{row.name}</option
							>{/each}</select
					></label
				><label>Performed at<input type="datetime-local" name="performedAt" required /></label
				><label
					>Result<select name="resultCode"
						><option>completed</option><option>partial</option><option>failed</option><option
							value="no_fault_found">No fault found</option
						></select
					></label
				>
			</div>
			<label
				>Condition<select name="conditionRating"
					><option value="">Not rated</option><option>good</option><option>fair</option><option
						>poor</option
					><option>critical</option><option>unknown</option></select
				></label
			><label>Notes<textarea name="notes" rows="2"></textarea></label><label
				>Recommended next service<input type="date" name="recommendedNextServiceOn" /></label
			><button>Record service event</button>
		</form>{/if}

	{#if data.canViewCompliance}<section class="workspace-section" id="compliance-register">
			<div class="section-heading">
				<div>
					<p class="eyebrow">Assurance</p>
					<h2>Operational compliance</h2>
				</div>
				<span class="count">{data.complianceEvents.length}</span>
			</div>
			<div class="cards">
				{#each data.complianceRequirements as requirement}<article class="record-card">
						<div class="card-title">
							<strong>{requirement.requirementCode} · {requirement.name}</strong><span
								>v{requirement.publishedVersionNumber ?? '—'}</span
							>
						</div>
						<p>
							{requirement.categoryName}{requirement.intervalValue
								? ` · every ${requirement.intervalValue} ${requirement.intervalUnit}`
								: ''}
						</p>
					</article>{/each}{#each data.complianceEvents as event}<article
						class="record-card compliance-event"
					>
						<div class="card-title">
							<strong>{event.complianceEventNumber} · {event.requirementName}</strong><span
								>{event.outcome}</span
							>
						</div>
						<p>{event.assetTag ?? 'Facility'} · {event.findingsSummary ?? 'No findings.'}</p>
						<small>{shortDateTime(event.performedAt)}</small>
					</article>{/each}
			</div>
		</section>{/if}
	{#if data.canManageCompliance}<section class="form-grid">
			<form
				class="panel"
				id="create-compliance-requirement"
				method="POST"
				action="?/createComplianceRequirement"
			>
				<h3>Publish compliance requirement</h3>
				<label
					>Category<select name="categoryCode"
						>{#each data.complianceCategories as row}<option value={row.code}>{row.name}</option
							>{/each}</select
					></label
				><label>Requirement code<input name="requirementCode" required /></label><label
					>Name<input name="name" required /></label
				><label
					>Requirement text<textarea name="requirementText" rows="3" required></textarea></label
				>
				<div class="two">
					<label>Interval<input type="number" min="1" name="intervalValue" /></label><label
						>Unit<select name="intervalUnit"
							><option value="">None</option><option>day</option><option>week</option><option
								>month</option
							><option>year</option></select
						></label
					>
				</div>
				<button>Publish version 1</button>
			</form>
			<form class="panel" id="assign-compliance" method="POST" action="?/assignComplianceToAsset">
				<h3>Assign requirement to asset</h3>
				<label
					>Asset<select name="assetPublicId" required
						><option value="">Select…</option>{#each data.assets as row}<option value={row.publicId}
								>{row.assetTag} · {row.name}</option
							>{/each}</select
					></label
				><label
					>Requirement<select name="requirementPublicId" required
						><option value="">Select…</option>{#each data.complianceRequirements as row}<option
								value={row.publicId}>{row.requirementCode} · {row.name}</option
							>{/each}</select
					></label
				><label>Assigned from<input type="date" name="assignedFrom" /></label><button
					>Assign requirement</button
				>
			</form>
			<form
				class="panel"
				id="record-compliance-event"
				method="POST"
				action="?/recordComplianceEvent"
			>
				<h3>Record compliance event</h3>
				<label
					>Assignment<select name="assignmentId" required
						><option value="">Select…</option
						>{#each data.assetComplianceAssignments.filter((row) => row.isActive) as row}<option
								value={row.id}>{row.assetTag} · {row.requirementName}</option
							>{/each}</select
					></label
				><label>Performed at<input type="datetime-local" name="performedAt" required /></label
				><label
					>Outcome<select name="outcome"
						><option>pass</option><option value="pass_with_observations"
							>Pass with observations</option
						><option>fail</option><option value="not_applicable">Not applicable</option></select
					></label
				><label>Findings<textarea name="findingsSummary" rows="2"></textarea></label><label
					>Recommended next due<input type="date" name="recommendedNextDueOn" /></label
				><button>Record compliance event</button>
			</form>
		</section>{/if}

	{#if data.canLinkEvidence}<form
			class="panel wide"
			id="link-evidence"
			method="POST"
			action="?/linkEvidence"
		>
			<h3>Link controlled information evidence</h3>
			<div class="two">
				<label
					>Subject type<select name="subjectType"
						><option value="asset">Asset</option><option value="workOrder">Work order</option
						><option value="service">Service event</option><option value="compliance"
							>Compliance event</option
						></select
					></label
				><label
					>Subject public ID<input
						name="subjectPublicId"
						required
						placeholder="Paste record public ID"
					/></label
				>
			</div>
			<label
				>Issued information revision<select name="informationVersionPublicId" required
					>{#each data.evidenceVersions as row}<option value={row.publicId}
							>{row.containerNumber} · {row.title} · {row.revisionCode}</option
						>{/each}</select
				></label
			><label
				>Link role<select name="linkRole"
					><option>certificate</option><option>photo</option><option>evidence</option><option
						>report</option
					><option>drawing</option><option>other</option></select
				></label
			><button>Link exact revision</button>
		</form>{/if}
{/if}

<style>
	:global(body) {
		background: #f7f8fa;
	}
	.page-header,
	.section-heading,
	.card-title,
	.inline,
	.two,
	.three {
		display: flex;
		gap: 1rem;
		align-items: center;
	}
	.page-header,
	.workspace-section,
	.panel,
	.notice,
	.metrics article {
		background: white;
		border: 1px solid #dfe3e8;
		border-radius: 14px;
	}
	.page-header {
		justify-content: space-between;
		padding: 1.5rem;
		margin-bottom: 1rem;
	}
	.page-header h1,
	.section-heading h2,
	.panel h3 {
		margin: 0.15rem 0;
	}
	.page-header p {
		max-width: 760px;
		margin: 0.4rem 0;
		color: #59636e;
	}
	.eyebrow {
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 0.72rem;
		font-weight: 700;
		color: #59636e;
		margin: 0;
	}
	.header-action,
	button {
		background: #17212b;
		color: white;
		border: 0;
		border-radius: 9px;
		padding: 0.7rem 1rem;
		text-decoration: none;
		font-weight: 650;
		cursor: pointer;
	}
	.error {
		background: #fff0f0;
		border: 1px solid #e2a1a1;
		padding: 0.8rem;
		border-radius: 10px;
	}
	.metrics {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.75rem;
		margin: 1rem 0;
	}
	.metrics article {
		padding: 1rem;
	}
	.metrics span {
		display: block;
		color: #68727c;
		font-size: 0.82rem;
	}
	.metrics strong {
		font-size: 1.5rem;
	}
	.workspace-section {
		padding: 1rem;
		margin: 1rem 0;
	}
	.section-heading {
		justify-content: space-between;
		border-bottom: 1px solid #edf0f2;
		padding-bottom: 0.75rem;
	}
	.count {
		background: #eef1f4;
		border-radius: 999px;
		padding: 0.25rem 0.6rem;
	}
	.cards {
		display: grid;
		gap: 0.75rem;
		margin-top: 0.8rem;
	}
	.record-card {
		border: 1px solid #e5e8eb;
		border-radius: 10px;
		padding: 0.9rem;
	}
	.card-title {
		justify-content: space-between;
	}
	.card-title span {
		font-size: 0.76rem;
		background: #f0f2f4;
		border-radius: 999px;
		padding: 0.2rem 0.5rem;
	}
	.record-card p {
		margin: 0.45rem 0;
	}
	.record-card small,
	.task small {
		color: #66717b;
	}
	.form-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
		margin: 1rem 0;
	}
	.panel {
		padding: 1rem;
		display: grid;
		gap: 0.7rem;
	}
	.panel.wide {
		margin: 1rem 0;
	}
	.panel label {
		display: grid;
		gap: 0.3rem;
		font-size: 0.85rem;
		font-weight: 600;
	}
	.panel label span {
		font-weight: 400;
		color: #7b858e;
	}
	.panel input,
	.panel select,
	.panel textarea,
	.inline input,
	.inline select {
		width: 100%;
		box-sizing: border-box;
		border: 1px solid #cbd1d7;
		border-radius: 8px;
		padding: 0.62rem;
		background: white;
		color: inherit;
	}
	.inline {
		margin-top: 0.65rem;
		align-items: stretch;
	}
	.inline input,
	.inline select {
		min-width: 0;
	}
	.inline button {
		white-space: nowrap;
	}
	.two > * {
		flex: 1;
	}
	.three > * {
		flex: 1;
	}
	.task {
		border-top: 1px solid #edf0f2;
		margin-top: 0.65rem;
		padding-top: 0.65rem;
		display: grid;
		gap: 0.4rem;
	}
	.assignment {
		font-size: 0.84rem;
		font-weight: 650;
	}
	.notice {
		padding: 1.2rem;
	}
	@media (max-width: 800px) {
		.metrics,
		.form-grid {
			grid-template-columns: 1fr 1fr;
		}
		.page-header,
		.inline {
			align-items: stretch;
			flex-direction: column;
		}
		.two,
		.three {
			align-items: stretch;
			flex-direction: column;
		}
	}
	@media (max-width: 520px) {
		.metrics,
		.form-grid {
			grid-template-columns: 1fr;
		}
		.page-header,
		.workspace-section,
		.panel {
			border-radius: 10px;
		}
		.page-header {
			padding: 1rem;
		}
		button,
		.header-action {
			min-height: 44px;
		}
	}
</style>
