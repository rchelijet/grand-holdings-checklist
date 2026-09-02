<?php
$user = require_checklist_editor();
$id = (int)($_GET['id'] ?? 0);
$stmt = db()->prepare('SELECT * FROM checklists WHERE id = ?');
$stmt->execute([$id]);
$checklist = $stmt->fetch();
if (!$checklist) redirect_to('checklists');
$facilities = facilities_for_user($user);
$assigned = db()->prepare('SELECT facility_id FROM checklist_facilities WHERE checklist_id = ?');
$assigned->execute([$id]);
$assignedIds = array_map('intval', $assigned->fetchAll(PDO::FETCH_COLUMN));
if ($user['role'] !== 'admin' && (!$assignedIds || array_diff($assignedIds, accessible_facility_ids($user)))) {
    http_response_code(403);
    exit('You do not have permission to manage this checklist.');
}
$items = db()->prepare('SELECT * FROM checklist_items WHERE checklist_id = ? ORDER BY sort_order');
$items->execute([$id]);
page_header('Manage Checklist', 'checklists');
page_heading('Grand Holdings', 'Manage checklist', 'Edit the cadence, properties, and standards for this checklist.', '<a class="button secondary" href="' . e(url('checklists')) . '">Back to checklists</a>');
?>
<?php card_start('form-card'); ?>
    <form method="post" action="index.php" class="form-grid">
        <?= csrf_field() ?><input type="hidden" name="action" value="checklist_update"><input type="hidden" name="id" value="<?= e($id) ?>">
        <label>Checklist name<input name="name" required value="<?= e($checklist['name']) ?>"></label>
        <label>Frequency<select name="frequency">
            <?php foreach (['daily'=>'Daily','weekly'=>'Weekly · first Monday','monthly'=>'Monthly · 1st of month','quarterly'=>'Quarterly · Jan, Apr, Jul, Oct','yearly'=>'Yearly · 1st of January'] as $value => $label): ?>
                <option value="<?= e($value) ?>" <?= $checklist['frequency'] === $value ? 'selected' : '' ?>><?= e($label) ?></option>
            <?php endforeach; ?>
        </select></label>
        <fieldset><legend>Assigned properties</legend><div class="check-list">
            <?php foreach ($facilities as $facility): ?><label class="check-pill"><input type="checkbox" name="facility_ids[]" value="<?= e($facility['id']) ?>" <?= in_array((int)$facility['id'], $assignedIds, true) ? 'checked' : '' ?>> <?= e($facility['name']) ?></label><?php endforeach; ?>
        </div></fieldset>
        <div class="form-actions"><button class="button primary" type="submit">Save changes</button><span class="badge"><?= e(frequency_label($checklist['frequency'])) ?></span></div>
    </form>
<?php card_end(); ?>

<?php card_start(); ?>
    <h2>Checklist items</h2><p class="muted">Add the exact service standard the team should verify.</p>
    <form method="post" action="index.php" class="inline-add"><?= csrf_field() ?><input type="hidden" name="action" value="item_add"><input type="hidden" name="checklist_id" value="<?= e($id) ?>"><input name="description" required placeholder="e.g. Check Wi-Fi is operational"><button class="button primary" type="submit">Add item</button></form>
    <ol class="numbered-list">
    <?php foreach ($items->fetchAll() as $index => $item): ?><li><span><?= e($index + 1) ?>. <?= e($item['description']) ?></span><form method="post" action="index.php" class="inline-form" onsubmit="return confirm('Remove this item?')"><?= csrf_field() ?><input type="hidden" name="action" value="item_delete"><input type="hidden" name="checklist_id" value="<?= e($id) ?>"><input type="hidden" name="item_id" value="<?= e($item['id']) ?>"><button class="button danger" type="submit">Remove</button></form></li><?php endforeach; ?>
    </ol>
<?php card_end(); page_footer(); ?>
