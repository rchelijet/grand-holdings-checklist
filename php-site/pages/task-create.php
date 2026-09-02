<?php
$user = require_manager();
$assignees = users_for_task_assignment($user);
page_header('Create Task', 'tasks');
page_heading('Grand Holdings', 'Create Task', 'Give the team a clear brief, an owner, and a date to work towards.');
task_navigation('create');
?>
<?php card_start('form-card task-form'); ?>
    <form method="post" action="index.php" enctype="multipart/form-data" class="stack-form">
        <?= csrf_field() ?><input type="hidden" name="action" value="task_create">
        <?php render_property_field($user, 'Select a property'); ?>
        <label>Task name<input name="title" required placeholder="Replace dining room light fittings"></label>
        <label>Task description<textarea name="description" required rows="5" placeholder="Add context, standard, or outcome expected..."></textarea></label>
        <div class="form-grid"><label>Expected completion<input type="date" name="expected_date" required></label>
        <label>Assign to user (optional)<select name="assigned_user_id"><option value="">Leave unassigned</option><?php foreach ($assignees as $assignee): ?><option value="<?= e($assignee['id']) ?>"><?= e($assignee['name']) ?> · <?= e(match ($assignee['role']) { 'admin' => 'Administrator', 'manager' => 'Manager', default => 'Basic user' }) ?></option><?php endforeach; ?></select></label></div>
        <div class="form-grid">
            <label>Reference images (optional)<input type="file" name="images[]" multiple accept="image/*"><small>Up to 4 images. Maximum 8 MB each.</small></label>
            <label>Reference documents (optional)<input type="file" name="documents[]" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"><small>Up to 2 documents (PDF, Word, Excel, or text). Maximum 8 MB each.</small></label>
        </div>
        <button class="button primary" type="submit">Create task</button>
    </form>
<?php card_end(); page_footer(); ?>
