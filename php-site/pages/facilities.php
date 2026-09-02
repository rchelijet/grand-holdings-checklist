<?php
$user = require_admin();
$editing = null;
if (!empty($_GET['edit'])) {
    $stmt = db()->prepare('SELECT * FROM facilities WHERE id = ?');
    $stmt->execute([(int)$_GET['edit']]);
    $editing = $stmt->fetch();
}
$facilities = db()->query('SELECT * FROM facilities ORDER BY name')->fetchAll();
page_header('Properties', 'properties');
page_heading('Grand Holdings', 'Properties', 'Manage game lodges, Cape Winelands hotels, and the Robertson valley estate.');
?>
<?php card_start('form-card'); ?>
    <h2><?= $editing ? 'Edit property' : 'Add a property' ?></h2>
    <p class="muted">Keep each house's address and general manager details current.</p>
    <form method="post" action="index.php" class="form-grid">
        <?= csrf_field() ?>
        <input type="hidden" name="action" value="facility_save">
        <input type="hidden" name="id" value="<?= e($editing['id'] ?? '') ?>">
        <label>Property name<input name="name" required value="<?= e($editing['name'] ?? '') ?>"></label>
        <label>Address<input name="address" value="<?= e($editing['address'] ?? '') ?>"></label>
        <label>General manager<input name="contact_name" value="<?= e($editing['contact_name'] ?? '') ?>"></label>
        <label>Contact phone<input name="contact_phone" value="<?= e($editing['contact_phone'] ?? '') ?>"></label>
        <label>Contact email<input type="email" name="contact_email" value="<?= e($editing['contact_email'] ?? '') ?>"></label>
        <div class="form-actions">
            <button class="button primary" type="submit"><?= $editing ? 'Update property' : 'Add property' ?></button>
            <?php if ($editing): ?><a class="button secondary" href="<?= e(url('facilities')) ?>">Cancel</a><?php endif; ?>
        </div>
    </form>
<?php card_end(); ?>

<div class="property-grid three">
<?php foreach ($facilities as $facility): ?>
    <article class="property-card">
        <div class="property-image" style="background-image:url('<?= e(property_image($facility['name'], $facility['address'], (int)$facility['id'])) ?>')">
            <div class="image-shade"></div><div class="property-label"><?= e(property_kind($facility['name'], $facility['address'])) ?></div>
        </div>
        <div class="property-card-body vertical">
            <h2><?= e($facility['name']) ?></h2>
            <p class="muted"><?= e($facility['address']) ?></p>
            <div class="gold-rule"></div>
            <p><?= e($facility['contact_name'] ?: 'General manager') ?></p>
            <p class="muted"><?= e($facility['contact_phone']) ?><?= $facility['contact_email'] ? ' · ' . e($facility['contact_email']) : '' ?></p>
            <div class="form-actions">
                <a class="button secondary" href="<?= e(url('facilities', ['edit' => $facility['id']])) ?>">Edit</a>
                <form method="post" action="index.php" class="inline-form" onsubmit="return confirm('Delete this property?')">
                    <?= csrf_field() ?><input type="hidden" name="action" value="facility_delete"><input type="hidden" name="id" value="<?= e($facility['id']) ?>">
                    <button class="button danger" type="submit">Delete</button>
                </form>
            </div>
        </div>
    </article>
<?php endforeach; ?>
</div>
<?php page_footer(); ?>
