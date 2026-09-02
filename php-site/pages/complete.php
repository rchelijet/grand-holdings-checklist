<?php
$user = require_login();
$checklistId = (int)($_GET['checklist_id'] ?? 0);
$facilityId = (int)($_GET['facility_id'] ?? 0);
$checklistFrequencyStmt = db()->prepare('SELECT frequency FROM checklists WHERE id = ?');
$checklistFrequencyStmt->execute([$checklistId]);
$checklistFrequency = (string)($checklistFrequencyStmt->fetchColumn() ?: 'daily');
$dueDate = (string)($_GET['due_date'] ?? due_date($checklistFrequency));
if (!in_array($facilityId, accessible_facility_ids($user), true)) redirect_to('dashboard');
$assignment = db()->prepare('SELECT 1 FROM checklist_facilities WHERE checklist_id = ? AND facility_id = ?');
$assignment->execute([$checklistId, $facilityId]);
if (!$assignment->fetchColumn()) {
    http_response_code(403);
    exit('This checklist is not assigned to the selected property.');
}
try {
    assert_completable_current_period($checklistFrequency, $dueDate);
    $completionId = get_or_create_completion($checklistId, $facilityId, $dueDate, (int)$user['id']);
} catch (Throwable $error) {
    flash($error->getMessage(), 'error');
    redirect_to('dashboard');
}
$detail = completion_detail($completionId);
if (!$detail) redirect_to('dashboard');
page_header('Complete Checklist', 'pending');
page_heading('Grand Holdings', $detail['completion']['checklist_name'], $detail['completion']['facility_name'] . ' · Due ' . $detail['completion']['due_date'], '<a class="button secondary" href="' . e(url('dashboard')) . '">Back to pending</a>');
?>
<?php card_start('completion-card'); ?>
    <div class="title-row"><div><span class="eyebrow"><?= e(frequency_label($detail['completion']['frequency'])) ?></span><h2>House checks</h2></div><span class="badge warning">In progress</span></div>
    <form method="post" action="index.php" class="stack-form">
        <?= csrf_field() ?><input type="hidden" name="action" value="completion_save"><input type="hidden" name="checklist_id" value="<?= e($checklistId) ?>"><input type="hidden" name="facility_id" value="<?= e($facilityId) ?>"><input type="hidden" name="due_date" value="<?= e($dueDate) ?>">
        <ol class="completion-list">
        <?php foreach ($detail['items'] as $index => $item): ?><li><label class="item-check"><input type="checkbox" name="items[<?= e($item['id']) ?>][completed]" value="1" <?= $item['completed'] ? 'checked' : '' ?>><span><?= e($index + 1) ?>. <?= e($item['description']) ?></span></label><textarea name="items[<?= e($item['id']) ?>][note]" rows="2" placeholder="Add a note if not done or if there is an issue..."><?= e($item['note']) ?></textarea></li><?php endforeach; ?>
        </ol>
        <div class="form-actions"><button class="button secondary" name="save" value="1" type="submit">Save progress</button><button class="button primary" name="submit" value="1" type="submit">Submit checklist</button></div>
    </form>
<?php card_end(); page_footer(); ?>
