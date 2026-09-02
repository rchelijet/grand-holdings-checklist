<?php
$user = require_login();
$id = (int)($_GET['id'] ?? 0);
$detail = get_task($user, $id);
if (!$detail) {
    flash('That task was not found or is not available to your property.', 'error');
    redirect_to('tasks');
}
$task = $detail['task'];
$assignees = users_for_task_assignment($user);
$canManageTask = in_array($user['role'], ['admin', 'manager'], true);
page_header('Task Detail', 'tasks');
$taskActions = '<a class="button secondary" href="' . e(url('tasks')) . '">Back to tasks</a>';
if ($user['role'] === 'admin') {
    $taskActions .= ' <form method="post" action="index.php" class="inline-form" onsubmit="return confirm(\'Delete this task permanently?\')">' . csrf_field() . '<input type="hidden" name="action" value="task_delete"><input type="hidden" name="task_id" value="' . e($task['id']) . '"><button class="button danger" type="submit">Delete task</button></form>';
}
page_heading('Grand Holdings', $task['title'], $task['facility_name'] . ' · Expected ' . $task['expected_date'], $taskActions);
?>
<div class="detail-grid">
    <div class="detail-main">
        <?php card_start(); ?>
            <div class="title-row"><div><span class="eyebrow">Original brief</span><h2><?= e($task['title']) ?></h2></div><span class="badge <?= $task['status'] === 'closed' ? 'success' : 'warning' ?>"><?= e($task['status']) ?></span></div>
            <p class="long-copy"><?= nl2br(e($task['description'] ?: 'No description was added.')) ?></p>
            <div class="gold-rule"></div>
            <div class="detail-meta"><span>Added <?= e(substr($task['created_at'], 0, 10)) ?> by <?= e($task['created_by_name']) ?></span><span>Assigned to <?= e($task['assigned_user_name'] ?: 'Unassigned') ?></span><span><?= e($task['facility_address']) ?></span><?php if ($task['closed_at']): ?><span>Closed <?= e(substr($task['closed_at'], 0, 10)) ?></span><?php endif; ?></div>
        <?php card_end(); ?>

        <?php card_start(); ?>
            <h2>Progress history</h2>
            <?php if (!$detail['updates']): ?>
                <p class="muted">No progress updates yet.</p>
            <?php else: ?>
                <div class="timeline">
                    <?php foreach ($detail['updates'] as $update): ?>
                        <div class="timeline-item">
                            <div class="timeline-top">
                                <strong><?= e($update['user_name']) ?></strong>
                                <small><?= e(substr($update['created_at'], 0, 16)) ?></small>
                            </div>
                            <?php if (!empty($update['is_creation'])): ?>
                                <b>Task created</b>
                            <?php else: ?>
                                <b><?= e($update['progress']) ?>% complete</b>
                            <?php endif; ?>
                            <?php if ($update['note']): ?><p><?= nl2br(e($update['note'])) ?></p><?php endif; ?>
                            <?php if (!empty($update['attachments'])): ?>
                                <div class="timeline-attachments">
                                    <?php foreach ($update['attachments'] as $attachment): ?>
                                        <?php if (str_starts_with((string)$attachment['mime_type'], 'image/')): ?>
                                            <button type="button" class="timeline-attachment timeline-attachment-image" data-lightbox-src="<?= e($attachment['file_path']) ?>" data-lightbox-alt="<?= e($attachment['file_name']) ?>">
                                                <img src="<?= e($attachment['file_path']) ?>" alt="<?= e($attachment['file_name']) ?>">
                                                <span><?= e($attachment['file_name']) ?></span>
                                            </button>
                                        <?php else: ?>
                                            <a class="timeline-attachment timeline-attachment-doc" href="<?= e($attachment['file_path']) ?>" target="_blank" download="<?= e($attachment['file_name']) ?>">
                                                <span class="document-icon">DOC</span>
                                                <span><?= e($attachment['file_name']) ?></span>
                                            </a>
                                        <?php endif; ?>
                                    <?php endforeach; ?>
                                </div>
                            <?php endif; ?>
                        </div>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>
        <?php card_end(); ?>
    </div>

    <?php card_start('update-card'); ?>
        <span class="eyebrow">Task update</span><h2>How is the task going?</h2>
        <form method="post" action="index.php" enctype="multipart/form-data" class="stack-form">
            <?= csrf_field() ?><input type="hidden" name="action" value="task_update"><input type="hidden" name="task_id" value="<?= e($task['id']) ?>">
            <?php if ($canManageTask): ?>
                <label>Assigned user<select name="assigned_user_id"><option value="">Unassigned</option><?php foreach ($assignees as $assignee): ?><option value="<?= e($assignee['id']) ?>" <?= (int)$task['assigned_user_id'] === (int)$assignee['id'] ? 'selected' : '' ?>><?= e($assignee['name']) ?> · <?= e($assignee['role'] === 'admin' ? 'Administrator' : ($assignee['role'] === 'manager' ? 'Manager' : 'Basic user')) ?></option><?php endforeach; ?></select><small>Save the update to reassign this task.</small></label>
                <label><span class="range-label">Percentage complete <strong id="progress-value"><?= e($task['progress']) ?>%</strong></span><input type="range" name="progress" min="0" max="100" step="5" value="<?= e($task['progress']) ?>" oninput="document.getElementById('progress-value').textContent=this.value+'%'"><span class="range-hint"><small>Started</small><small>Closed at 100%</small></span></label>
            <?php else: ?>
                <div class="basic-note"><span class="eyebrow">Basic user access</span><p>You can add notes and progress files for this property task. Managers and administrators update the completion percentage and assignee.</p></div>
            <?php endif; ?>
            <label>Notes<textarea name="note" rows="6" placeholder="Share progress, blockers, or handover details..."></textarea></label>
            <label>Add images or documents<input type="file" name="files[]" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"><small>Maximum 8 MB per file.</small></label>
            <button class="button primary" type="submit">Save progress update</button>
        </form>
    <?php card_end(); ?>
</div>
<div id="task-lightbox" class="task-lightbox" hidden>
    <button type="button" class="task-lightbox-close" aria-label="Close image preview">Close</button>
    <img src="" alt="">
</div>
<script>
(() => {
    const lightbox = document.getElementById('task-lightbox');
    if (!lightbox) return;
    const image = lightbox.querySelector('img');
    const closeButton = lightbox.querySelector('.task-lightbox-close');
    function openLightbox(src, alt) {
        if (!image) return;
        image.src = src;
        image.alt = alt;
        lightbox.hidden = false;
    }
    function closeLightbox() {
        lightbox.hidden = true;
        if (image) {
            image.src = '';
            image.alt = '';
        }
    }
    document.querySelectorAll('[data-lightbox-src]').forEach((button) => {
        button.addEventListener('click', () => {
            openLightbox(button.getAttribute('data-lightbox-src') || '', button.getAttribute('data-lightbox-alt') || '');
        });
    });
    closeButton?.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (event) => {
        if (event.target === lightbox) closeLightbox();
    });
    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !lightbox.hidden) closeLightbox();
    });
})();
</script>
<?php page_footer(); ?>
