<?php
$user = require_checklist_editor();
$facilities = facilities_for_user($user);
$facilityIds = accessible_facility_ids($user);
$checklists = [];
if ($facilityIds) {
    $facilityPlaceholders = placeholders($facilityIds);
    $stmt = db()->prepare('SELECT c.*, COUNT(DISTINCT ci.id) item_count,
        GROUP_CONCAT(DISTINCT f.name ORDER BY f.name SEPARATOR ", ") facility_names
        FROM checklists c
        JOIN checklist_facilities visible_cf ON visible_cf.checklist_id = c.id
        LEFT JOIN checklist_items ci ON ci.checklist_id = c.id
        LEFT JOIN checklist_facilities cf ON cf.checklist_id = c.id
        LEFT JOIN facilities f ON f.id = cf.facility_id
        WHERE visible_cf.facility_id IN (' . $facilityPlaceholders . ')
          AND NOT EXISTS (
              SELECT 1 FROM checklist_facilities hidden_cf
              WHERE hidden_cf.checklist_id = c.id
                AND hidden_cf.facility_id NOT IN (' . $facilityPlaceholders . ')
          )
        GROUP BY c.id ORDER BY c.name');
    $stmt->execute(array_merge($facilityIds, $facilityIds));
    $checklists = $stmt->fetchAll();
}
page_header('Checklists', 'checklists');
page_heading('Grand Holdings', 'Checklists', 'Build the daily, weekly, monthly, quarterly, and yearly standards for each house.', '<a class="button primary" href="#new-checklist">Create checklist</a>');
?>
<?php card_start('form-card'); ?>
    <h2 id="new-checklist">Create checklist</h2>
    <p class="muted">Set the rhythm, then add as many operating items as needed.</p>
    <form method="post" action="index.php" class="form-grid">
        <?= csrf_field() ?><input type="hidden" name="action" value="checklist_create">
        <label>Checklist name<input name="name" required placeholder="Daily Checks"></label>
        <label>Frequency
            <select name="frequency">
                <option value="daily">Daily</option><option value="weekly">Weekly · first Monday</option>
                <option value="monthly">Monthly · 1st of month</option><option value="quarterly">Quarterly · Jan, Apr, Jul, Oct</option><option value="yearly">Yearly · 1st of January</option>
            </select>
        </label>
        <fieldset><legend>Assign to properties</legend>
            <div class="check-list"><?php foreach ($facilities as $facility): ?><label class="check-pill"><input type="checkbox" name="facility_ids[]" value="<?= e($facility['id']) ?>"> <?= e($facility['name']) ?></label><?php endforeach; ?></div>
        </fieldset>
        <div class="form-actions"><button class="button primary" type="submit">Create checklist</button></div>
    </form>
<?php card_end(); ?>

<div class="stack-list">
<?php foreach ($checklists as $checklist): ?>
    <article class="card list-card">
        <div><div class="title-row"><h2><?= e($checklist['name']) ?></h2><span class="badge"><?= e(frequency_label($checklist['frequency'])) ?></span></div>
        <p class="muted"><?= e($checklist['item_count']) ?> items · <?= e($checklist['facility_names'] ?: 'No property assigned') ?></p></div>
        <div class="form-actions"><a class="button secondary" href="<?= e(url('checklist', ['id' => $checklist['id']])) ?>">Manage items</a>
        <form method="post" action="index.php" class="inline-form" onsubmit="return confirm('Delete this checklist?')"><?= csrf_field() ?><input type="hidden" name="action" value="checklist_delete"><input type="hidden" name="id" value="<?= e($checklist['id']) ?>"><button class="button danger" type="submit">Delete</button></form></div>
    </article>
<?php endforeach; ?>
</div>
<?php page_footer(); ?>
