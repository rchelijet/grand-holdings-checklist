<?php
require_once __DIR__ . '/../inc/forms.php';
require_once __DIR__ . '/../inc/phone.php';

$user = require_login();
$form = get_form_by_slug('guest-registration');
if (!$form) {
    flash('That form is not available.', 'error');
    redirect_to('forms');
}
$clauses = guest_registration_clauses();
page_header('Guest Registration — Preparation', 'forms');
page_heading(
    'Grand Holdings',
    'New preparation',
    'Enter guest details before arrival. Signatures and PDF generation are completed in the Next.js app at check-in.',
    '<a class="button secondary" href="' . e(url('forms')) . '">Back to forms</a>'
);
?>
<?php card_start('form-card'); ?>
    <p class="muted" style="margin-bottom:1rem;">PHP mirror: this page saves pre-arrival preparation only (draft or prepared). Use the Next.js app to complete guest check-in — capture identity documentation, collect signatures, and generate the PDF.</p>
    <form method="post" action="index.php" class="stack-form">
        <?= csrf_field() ?>
        <input type="hidden" name="action" value="save_guest_registration">
        <?php render_property_field($user); ?>

        <h3 class="section-title">Guest Information</h3>
        <label>Full Name<input name="full_name"></label>
        <label>ID / Passport No<input name="id_passport_no"></label>
        <label>Address<input name="address"></label>
        <div class="form-grid">
            <?php render_phone_input('Telephone / Mobile', 'telephone'); ?>
            <label>Email Address<input type="email" name="email"></label>
        </div>
        <label>Vehicle Registration<input name="vehicle_registration"></label>

        <h3 class="section-title">Booking Details</h3>
        <div class="form-grid">
            <label>Arrival Date<input type="date" name="arrival_date"></label>
            <label>Departure Date<input type="date" name="departure_date"></label>
            <label>Number of Guests<input type="number" name="number_of_guests" min="1"></label>
            <label>Room Number<input name="room_number"></label>
        </div>

        <h3 class="section-title">Emergency Contact</h3>
        <div class="form-grid">
            <label>Name<input name="emergency_contact_name"></label>
            <?php render_phone_input('Telephone', 'emergency_contact'); ?>
        </div>
        <label>Special occasions during your stay<textarea name="special_occasions" rows="3"></textarea></label>

        <div class="form-actions">
            <button class="button secondary" type="submit" name="save_status" value="draft">Save draft</button>
            <button class="button primary" type="submit" name="save_status" value="prepared">Mark as prepared</button>
        </div>
    </form>
<?php card_end(); ?>
<script src="assets/phone-input.js"></script>
<?php page_footer(); ?>
