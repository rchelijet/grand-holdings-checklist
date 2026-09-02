<?php
$user = require_login();
$detail = completion_detail((int)($_GET['id'] ?? 0));
if (!$detail || !in_array((int)$detail['completion']['facility_id'], accessible_facility_ids($user), true)) redirect_to('history');
page_header('Checklist Record', 'history');
page_heading('Grand Holdings', $detail['completion']['checklist_name'], $detail['completion']['facility_name'] . ' · Due ' . $detail['completion']['due_date'], '<a class="button secondary" href="' . e(url('history')) . '">Back to search</a>');
?>
<?php card_start('form-card'); ?><div class="title-row"><div><span class="eyebrow"><?= e(frequency_label($detail['completion']['frequency'])) ?></span><h2>Checklist record</h2></div><span class="badge success"><?= e($detail['completion']['status']) ?></span></div><div class="detail-meta"><span>Submitted <?= e($detail['completion']['submitted_at'] ?: 'Not submitted') ?></span><span>By <?= e($detail['completion']['user_name'] ?: '—') ?></span></div><?php card_end(); ?>
<?php card_start(); ?><ol class="completion-list readonly"><?php foreach ($detail['items'] as $index => $item): ?><li><div class="item-check"><span class="status-dot <?= $item['completed'] ? 'done' : 'missed' ?>"><?= $item['completed'] ? '✓' : '!' ?></span><span><?= e($index + 1) ?>. <?= e($item['description']) ?></span></div><?php if ($item['note']): ?><p class="item-note">Note: <?= e($item['note']) ?></p><?php endif; ?></li><?php endforeach; ?></ol><?php card_end(); page_footer(); ?>
