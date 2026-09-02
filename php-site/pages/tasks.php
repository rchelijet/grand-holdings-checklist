<?php
$user = require_login();
$propertyId = (string)($_GET['property_id'] ?? '');
$status = (string)($_GET['status'] ?? 'pending');
$filters = [
    'facility_id' => $propertyId ? (int)$propertyId : null,
    'status' => in_array($status, ['pending', 'closed', 'all'], true) ? $status : 'pending',
    'search' => trim((string)($_GET['search'] ?? '')),
    'month' => !empty($_GET['month']) ? (int)$_GET['month'] : null,
    'year' => !empty($_GET['year']) ? (int)$_GET['year'] : null,
];
$tasks = list_tasks($user, $filters);
$years = range((int)date('Y'), (int)date('Y') - 4);
page_header('Tasks', 'tasks');
page_heading('Grand Holdings', 'Tasks', 'Keep every property moving, from guest experience to behind-the-scenes operations.');
task_navigation('tasks', $propertyId);
?>
<?php card_start('filter-card'); ?>
    <form method="get" class="filter-grid">
        <input type="hidden" name="page" value="tasks"><input type="hidden" name="property_id" value="<?= e($propertyId) ?>">
        <label class="wide">Search tasks<input name="search" value="<?= e($filters['search']) ?>" placeholder="Search by task name or description"></label>
        <label>Status<select name="status"><option value="pending" <?= $filters['status'] === 'pending' ? 'selected' : '' ?>>Pending tasks</option><option value="closed" <?= $filters['status'] === 'closed' ? 'selected' : '' ?>>Closed tasks</option><option value="all" <?= $filters['status'] === 'all' ? 'selected' : '' ?>>Pending & closed</option></select></label>
        <label>Month<select name="month"><option value="">All months</option><?php for ($month = 1; $month <= 12; $month++): ?><option value="<?= $month ?>" <?= $filters['month'] === $month ? 'selected' : '' ?>><?= e(date('F', mktime(0, 0, 0, $month, 1))) ?></option><?php endfor; ?></select></label>
        <label>Year<select name="year"><option value="">All years</option><?php foreach ($years as $year): ?><option value="<?= $year ?>" <?= $filters['year'] === $year ? 'selected' : '' ?>><?= $year ?></option><?php endforeach; ?></select></label>
        <div class="form-actions"><button class="button primary" type="submit">Search</button><a class="button secondary" href="<?= e(url('tasks')) ?>">Clear</a></div>
    </form>
<?php card_end(); ?>

<?php if (!$tasks): ?>
    <div class="empty-state"><strong>No tasks found</strong><span>Try another property, status, month, or search term.</span></div>
<?php else: ?>
    <div class="stack-list">
    <?php foreach ($tasks as $task): ?>
        <a class="card task-row" href="<?= e(url('task', ['id' => $task['id']])) ?>">
            <div class="task-row-main"><div class="title-row"><h2><?= e($task['title']) ?></h2><span class="badge <?= $task['status'] === 'closed' ? 'success' : 'warning' ?>"><?= e($task['status']) ?></span></div>
            <p class="muted"><?= e($task['facility_name']) ?> · Added <?= e(substr($task['created_at'], 0, 10)) ?> by <?= e($task['created_by_name']) ?> · Expected <?= e($task['expected_date']) ?></p>
            <p class="task-description"><?= e($task['description'] ?: 'No description added.') ?></p></div>
            <div class="task-progress"><div><span>Completion</span><strong><?= e($task['progress']) ?>%</strong></div><?= progress_bar((int)$task['progress']) ?><small>Open task →</small></div>
        </a>
    <?php endforeach; ?>
    </div>
<?php endif; ?>
<?php page_footer(); ?>
