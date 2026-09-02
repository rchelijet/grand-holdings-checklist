<?php
require_once __DIR__ . '/../inc/forms.php';
require_once __DIR__ . '/../inc/phone.php';

$user = require_login();
$forms = available_forms();
$facilityIds = accessible_facility_ids($user);
$pending = [];
if ($facilityIds) {
    $placeholders = implode(',', array_fill(0, count($facilityIds), '?'));
    $stmt = db()->prepare(
        "SELECT fs.id, fs.status, fs.guest_name, fs.guest_surname, fs.id_number, fs.prepared_at, fs.form_data,
                f.name AS facility_name
         FROM form_submissions fs
         JOIN facilities f ON f.id = fs.facility_id
         WHERE fs.form_slug = 'guest-registration'
           AND fs.status IN ('draft', 'prepared')
           AND fs.facility_id IN ($placeholders)
         ORDER BY COALESCE(fs.prepared_at, fs.submitted_at) DESC
         LIMIT 50"
    );
    $stmt->execute($facilityIds);
    $pending = $stmt->fetchAll();
}
$showProperty = count($facilityIds) > 1;
page_header('Forms', 'forms');
page_heading('Grand Holdings', 'Forms', 'Electronic forms for guest services and property operations.');
?>
<div class="stack-list">
<?php if (!$forms): ?>
    <div class="empty-state"><strong>No forms available</strong><span>Forms will appear here once they are configured.</span></div>
<?php else: foreach ($forms as $form): ?>
    <article class="card list-card">
        <div>
            <div class="title-row">
                <h2><?= e($form['name']) ?></h2>
                <span class="badge warning">Electronic</span>
            </div>
            <p class="muted"><?= e($form['description']) ?></p>
        </div>
        <div class="form-actions">
            <a class="button primary" href="<?= e(form_url($form['slug'])) ?>">New preparation</a>
        </div>
    </article>
<?php endforeach; endif; ?>
</div>

<?php if ($pending): ?>
<h2 class="section-title" style="margin-top:2rem;">Pending arrivals</h2>
<div class="stack-list">
<?php foreach ($pending as $row):
    $formData = json_decode((string)($row['form_data'] ?? '{}'), true) ?: [];
    $guestName = trim($row['guest_name'] . ' ' . $row['guest_surname']) ?: 'Unnamed guest';
    $telephone = (string)($formData['telephone'] ?? '');
    $whatsAppMessage = guest_whatsapp_message($guestName, (string)$row['facility_name']);
?>
    <article class="card list-card">
        <div>
            <div class="title-row">
                <h3><?= e(trim($row['guest_name'] . ' ' . $row['guest_surname']) ?: 'Unnamed guest') ?></h3>
                <span class="badge <?= $row['status'] === 'draft' ? 'warning' : 'success' ?>"><?= e(ucfirst($row['status'])) ?></span>
                <?php if ($telephone !== '' && !validate_phone($telephone)): ?>
                <span class="badge"><?= e(normalize_phone($telephone)) ?></span>
                <?php endif; ?>
            </div>
            <p class="muted">
                <?php if ($showProperty): ?><?= e($row['facility_name']) ?> · <?php endif; ?>
                <?= $row['id_number'] ? e($row['id_number']) : 'No ID yet' ?>
            </p>
        </div>
        <div class="form-actions">
            <?= render_whatsapp_button($telephone, $whatsAppMessage) ?>
            <p class="muted">Complete check-in with signatures in the Next.js app.</p>
        </div>
    </article>
<?php endforeach; ?>
</div>
<?php endif; ?>
<?php page_footer(); ?>
