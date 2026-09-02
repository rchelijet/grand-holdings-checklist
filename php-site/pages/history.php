<?php
$user = require_login();
$filters = [
    'from' => (string)($_GET['from'] ?? ''),
    'to' => (string)($_GET['to'] ?? ''),
    'facility_id' => (int)($_GET['facility_id'] ?? 0),
];
$searched = isset($_GET['from']) || isset($_GET['to']) || isset($_GET['facility_id']);
$results = $searched
    ? search_checklist_history($user, $filters['from'], $filters['to'], $filters['facility_id'])
    : [];
$facilities = facilities_for_user($user);
page_header('Checklist History', 'history');
page_heading('Grand Holdings', 'House records', 'Search completed and missed checklists by date and property.');
?>
<?php card_start('filter-card'); ?><form method="get" class="filter-grid"><input type="hidden" name="page" value="history"><label>From date<input type="date" name="from" value="<?= e($filters['from']) ?>"></label><label>To date<input type="date" name="to" value="<?= e($filters['to']) ?>"></label><label>Property<select name="facility_id"><option value="">All properties</option><?php foreach ($facilities as $facility): ?><option value="<?= e($facility['id']) ?>" <?= $filters['facility_id'] === (int)$facility['id'] ? 'selected' : '' ?>><?= e($facility['name']) ?></option><?php endforeach; ?></select></label><div class="form-actions"><button class="button primary" type="submit">Search</button><a class="button secondary" href="<?= e(url('history')) ?>">Clear</a></div></form><?php card_end(); ?>
<?php if (!$searched): ?><div class="empty-state"><strong>Use the filters above</strong><span>Search checklist history by date and property.</span></div><?php elseif (!$results): ?><div class="empty-state"><strong>No house records found</strong><span>No completed or missed checklists matched the selected filters.</span></div><?php else: card_start(); ?><div class="table-wrap"><table><thead><tr><th>Checklist</th><th>Property</th><th>Due date</th><th>Status</th><th>Completed by</th><th></th></tr></thead><tbody><?php foreach ($results as $result): ?><tr><td><strong><?= e($result['checklist_name']) ?></strong><small><?= e(frequency_label($result['frequency'])) ?></small></td><td><?= e($result['facility_name']) ?></td><td><?= e($result['due_date']) ?></td><td><span class="badge <?= $result['status'] === 'completed' ? 'success' : ($result['status'] === 'missed' ? 'danger' : 'warning') ?>"><?= e($result['status']) ?></span></td><td><?= e($result['user_name'] ?: '—') ?></td><td><?php if ($result['id']): ?><a class="text-link" href="<?= e(url('history-detail', ['id' => $result['id']])) ?>">View</a><?php else: ?><span class="muted">—</span><?php endif; ?></td></tr><?php endforeach; ?></tbody></table></div><?php card_end(); endif; ?>
<?php page_footer(); ?>
