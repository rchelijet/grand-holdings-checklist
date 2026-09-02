<?php
$user = require_login();
$pending = pending_checklists($user);
page_header('Pending Checklists', 'pending');
page_heading('Grand Holdings', 'Pending checklists', 'Service standards due across your game lodges and five-star properties.');
?>
<?php if (!$pending): ?>
    <div class="empty-state"><strong>All quiet on the estate</strong><span>No assigned checklists are waiting right now.</span></div>
<?php else: ?>
    <div class="property-grid">
        <?php foreach ($pending as $item): ?>
            <article class="property-card">
                <div class="property-image" style="background-image:url('<?= e(property_image($item['facility_name'], $item['facility_address'], (int)$item['facility_id'])) ?>')">
                    <div class="image-shade"></div>
                    <div class="property-label"><?= e(property_kind($item['facility_name'], $item['facility_address'])) ?></div>
                    <h2><?= e($item['facility_name']) ?></h2>
                </div>
                <div class="property-card-body">
                    <div>
                        <div class="title-row"><h3><?= e($item['checklist_name']) ?></h3><span class="badge warning"><?= e(frequency_label($item['frequency'])) ?></span></div>
                        <p class="muted">Due <?= e($item['due_date']) ?> · <?= e($item['item_count']) ?> items</p>
                    </div>
                    <a class="button primary" href="<?= e(url('complete', ['checklist_id' => $item['checklist_id'], 'facility_id' => $item['facility_id'], 'due_date' => $item['due_date'])) ?>">Complete</a>
                </div>
            </article>
        <?php endforeach; ?>
    </div>
<?php endif; ?>
<?php page_footer(); ?>
