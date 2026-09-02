<?php
$user = require_manager();
$isAdmin = $user['role'] === 'admin';
$facilities = db()->query('SELECT id, name FROM facilities ORDER BY name')->fetchAll();
$users = db()->query("SELECT u.id, u.name, u.email, u.role, u.access_all, u.created_at,
    GROUP_CONCAT(DISTINCT f.name ORDER BY f.name SEPARATOR ', ') facility_names,
    GROUP_CONCAT(DISTINCT uf.facility_id) facility_ids
    FROM users u
    LEFT JOIN user_facilities uf ON uf.user_id = u.id
    LEFT JOIN facilities f ON f.id = uf.facility_id OR (uf.user_id IS NULL AND f.id = u.facility_id)
    WHERE u.active = 1
    GROUP BY u.id, u.name, u.email, u.role, u.access_all, u.created_at
    ORDER BY u.name")->fetchAll();
page_header('Team', 'team');
page_heading('Grand Holdings', 'Team access', 'Add Basic users, Managers, or Administrators with the right property access.', '<a class="button primary" href="#add-user">Add team member</a>');
?>
<?php card_start('form-card'); ?>
    <h2 id="add-user">Add team member</h2>
    <p class="muted">Give each team member a role and access to one, several, or all properties.</p>
    <form method="post" action="index.php" class="form-grid" id="user-form">
        <?= csrf_field() ?><input type="hidden" name="action" value="user_create">
        <label>Full name<input name="name" required></label>
        <label>Email<input type="email" name="email" required></label>
        <label>Password<input type="password" name="password" minlength="6" required></label>
        <label>Access level<select name="role" id="role-select">
            <option value="basic">Basic user · complete checklists and add task notes</option>
            <option value="manager">Manager · manage checklists and tasks</option>
            <?php if ($isAdmin): ?><option value="admin">Administrator · full access</option><?php endif; ?>
        </select></label>
        <label class="access-scope">Property access<select name="access_all" id="access-scope"><option value="0">Selected properties</option><option value="1">All properties</option></select></label>
        <fieldset class="facility-field"><legend>Properties this user can access</legend><div class="check-list"><?php foreach ($facilities as $facility): ?><label class="check-pill"><input type="checkbox" name="facility_ids[]" value="<?= e($facility['id']) ?>"> <?= e($facility['name']) ?></label><?php endforeach; ?></div><small>Select one or multiple properties, or choose All properties above.</small></fieldset>
        <div class="form-actions"><button class="button primary" type="submit">Add user</button></div>
    </form>
<?php card_end(); ?>
<?php card_start(); ?>
    <div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Access</th><th>Properties</th><th>Actions</th></tr></thead><tbody>
    <?php foreach ($users as $member):
        $memberFacilityIds = [];
        if (!empty($member['facility_ids'])) {
            $memberFacilityIds = array_map('intval', explode(',', (string)$member['facility_ids']));
        }
        $editId = 'edit-user-' . (int)$member['id'];
    ?>
    <tr>
        <td><strong><?= e($member['name']) ?></strong></td>
        <td><?= e($member['email']) ?></td>
        <td><span class="badge <?= $member['role'] === 'admin' ? 'success' : '' ?>"><?= e(match ($member['role']) { 'admin' => 'Administrator', 'manager' => 'Manager', default => 'Basic user' }) ?></span></td>
        <td><?= e($member['role'] === 'admin' || $member['access_all'] ? 'All properties' : ($member['facility_names'] ?: 'No properties assigned')) ?></td>
        <td>
            <div class="inline-actions">
                <?php if ($isAdmin || $member['role'] !== 'admin'): ?>
                <button class="button secondary" type="button" data-edit-toggle="<?= e($editId) ?>">Edit</button>
                <?php endif; ?>
                <?php if ($isAdmin && (int)$member['id'] !== (int)$user['id']): ?>
                <form method="post" action="index.php" class="inline-form" onsubmit="return confirm('Deactivate <?= e($member['name']) ?>? They will no longer be able to sign in.')">
                    <?= csrf_field() ?><input type="hidden" name="action" value="user_deactivate"><input type="hidden" name="user_id" value="<?= e($member['id']) ?>"><button class="button danger" type="submit">Deactivate</button>
                </form>
                <?php endif; ?>
            </div>
        </td>
    </tr>
    <tr id="<?= e($editId) ?>" class="edit-row" hidden>
        <td colspan="5">
            <form method="post" action="index.php" class="form-grid edit-user-form">
                <?= csrf_field() ?><input type="hidden" name="action" value="user_update"><input type="hidden" name="user_id" value="<?= e($member['id']) ?>">
                <label>Full name<input name="name" required value="<?= e($member['name']) ?>"></label>
                <label>Email<input type="email" name="email" required value="<?= e($member['email']) ?>"></label>
                <label>New password<small class="muted">Leave blank to keep current password</small><input type="password" name="password" minlength="6" autocomplete="new-password"></label>
                <label>Access level<select name="role" class="edit-role-select" data-edit-id="<?= e($editId) ?>">
                    <option value="basic" <?= $member['role'] === 'basic' ? 'selected' : '' ?>>Basic user · complete checklists and add task notes</option>
                    <option value="manager" <?= $member['role'] === 'manager' ? 'selected' : '' ?>>Manager · manage checklists and tasks</option>
                    <?php if ($isAdmin): ?><option value="admin" <?= $member['role'] === 'admin' ? 'selected' : '' ?>>Administrator · full access</option><?php endif; ?>
                </select></label>
                <label class="edit-access-scope" data-edit-id="<?= e($editId) ?>">Property access<select name="access_all" class="edit-access-scope-select"><option value="0" <?= empty($member['access_all']) ? 'selected' : '' ?>>Selected properties</option><option value="1" <?= !empty($member['access_all']) ? 'selected' : '' ?>>All properties</option></select></label>
                <fieldset class="edit-facility-field" data-edit-id="<?= e($editId) ?>"><legend>Properties this user can access</legend><div class="check-list"><?php foreach ($facilities as $facility): ?><label class="check-pill"><input type="checkbox" name="facility_ids[]" value="<?= e($facility['id']) ?>" <?= in_array((int)$facility['id'], $memberFacilityIds, true) ? 'checked' : '' ?>> <?= e($facility['name']) ?></label><?php endforeach; ?></div></fieldset>
                <div class="form-actions"><button class="button primary" type="submit">Save changes</button><button class="button secondary" type="button" data-edit-cancel="<?= e($editId) ?>">Cancel</button></div>
            </form>
        </td>
    </tr>
    <?php endforeach; ?>
    </tbody></table></div>
<?php card_end(); ?>
<script>
    (function () {
        const role = document.getElementById('role-select');
        const scope = document.querySelector('.access-scope');
        const facilities = document.querySelector('.facility-field');
        function updateAccessFields() {
            const isAdmin = role.value === 'admin';
            scope.style.display = isAdmin ? 'none' : 'block';
            facilities.style.display = isAdmin ? 'none' : 'block';
            document.getElementById('access-scope').disabled = isAdmin;
        }
        role.addEventListener('change', updateAccessFields);
        updateAccessFields();

        function updateEditAccessFields(editId) {
            const row = document.getElementById(editId);
            if (!row) return;
            const roleSelect = row.querySelector('.edit-role-select');
            const accessScope = row.querySelector('.edit-access-scope');
            const facilityField = row.querySelector('.edit-facility-field');
            const accessSelect = row.querySelector('.edit-access-scope-select');
            const isAdmin = roleSelect.value === 'admin';
            accessScope.style.display = isAdmin ? 'none' : 'block';
            facilityField.style.display = isAdmin ? 'none' : 'block';
            if (accessSelect) accessSelect.disabled = isAdmin;
        }

        document.querySelectorAll('[data-edit-toggle]').forEach((button) => {
            button.addEventListener('click', () => {
                const editId = button.getAttribute('data-edit-toggle');
                const row = document.getElementById(editId);
                if (!row) return;
                const isHidden = row.hasAttribute('hidden');
                document.querySelectorAll('.edit-row').forEach((editRow) => editRow.setAttribute('hidden', 'hidden'));
                document.querySelectorAll('[data-edit-toggle]').forEach((toggle) => {
                    toggle.textContent = 'Edit';
                });
                if (isHidden) {
                    row.removeAttribute('hidden');
                    button.textContent = 'Cancel';
                    updateEditAccessFields(editId);
                }
            });
        });

        document.querySelectorAll('[data-edit-cancel]').forEach((button) => {
            button.addEventListener('click', () => {
                const editId = button.getAttribute('data-edit-cancel');
                const row = document.getElementById(editId);
                if (row) row.setAttribute('hidden', 'hidden');
                document.querySelectorAll('[data-edit-toggle]').forEach((toggle) => {
                    if (toggle.getAttribute('data-edit-toggle') === editId) toggle.textContent = 'Edit';
                });
            });
        });

        document.querySelectorAll('.edit-role-select').forEach((select) => {
            select.addEventListener('change', () => {
                updateEditAccessFields(select.getAttribute('data-edit-id'));
            });
            updateEditAccessFields(select.getAttribute('data-edit-id'));
        });
    }());
</script>
<?php page_footer(); ?>
