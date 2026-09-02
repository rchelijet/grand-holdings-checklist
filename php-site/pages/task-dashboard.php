<?php
$user = require_manager();
$data = task_dashboard($user);
$summary = $data['summary'];
$pending = (int)$summary['pending'];
$closed = (int)$summary['closed'];
$overdue = (int)$summary['overdue'];
page_header('Task Dashboard', 'tasks');
page_heading('Grand Holdings', 'Task dashboard', 'A clear view of delivery, attention, and property performance.');
task_navigation('dashboard');
?>
<div class="stats-grid stats-grid-enhanced">
    <div class="stat-card accent-forest"><span>Total tasks</span><strong><?= e($summary['total']) ?></strong><small>Across all properties</small></div>
    <div class="stat-card accent-gold"><span>Pending</span><strong><?= e($summary['pending']) ?></strong><small>Still in progress</small></div>
    <div class="stat-card accent-success"><span>Closed</span><strong><?= e($summary['closed']) ?></strong><small>Successfully completed</small></div>
    <div class="stat-card accent-danger"><span>Overdue</span><strong><?= e($summary['overdue']) ?></strong><small>Need attention today</small></div>
    <div class="stat-card stat-card-gauge accent-gold-soft"><div><span>Avg. progress</span><small>Across every task</small></div><?= completion_gauge((int)$summary['average_progress']) ?></div>
</div>

<div class="dashboard-charts">
<?php card_start('chart-card'); ?>
    <h2>Task status mix</h2>
    <p class="muted">Closed, on-track pending, and overdue work at a glance.</p>
    <?= task_status_donut($pending, $closed, $overdue) ?>
<?php card_end(); ?>

<?php card_start('chart-card'); ?>
    <h2>Volume by status</h2>
    <p class="muted">Relative counts help spot where attention is needed.</p>
    <?= task_status_bars($pending, $closed, $overdue) ?>
<?php card_end(); ?>
</div>

<?php card_start('comparison-card'); ?>
    <h2>Property comparison</h2>
    <p class="muted">Progress and on-time closure rates side by side for each estate.</p>
    <div class="comparison-legend">
        <span><i class="swatch forest"></i> Avg. progress</span>
        <span><i class="swatch gold"></i> On-time rate</span>
    </div>
    <div class="comparison-list">
    <?php foreach ($data['properties'] as $property):
        $closedCount = (int)$property['closed_with_date'];
        $onTime = (int)$property['on_time'];
        $onTimeRate = $closedCount ? round($onTime / $closedCount * 100) : 0;
        $progress = (int)$property['average_progress'];
    ?>
        <div class="comparison-row">
            <div class="comparison-heading">
                <h3><?= e($property['name']) ?></h3>
                <p class="muted"><?= e($property['total']) ?> tasks · <?= e($property['closed']) ?> closed · <?= e($property['pending']) ?> pending</p>
            </div>
            <div class="comparison-bars">
                <div class="progress-line"><span class="forest" style="width:<?= e((string)$progress) ?>%"></span></div>
                <div class="progress-line gold"><span style="width:<?= e((string)$onTimeRate) ?>%"></span></div>
            </div>
        </div>
    <?php endforeach; ?>
    </div>
<?php card_end(); ?>

<?php card_start('performance-card'); ?>
    <h2>Property performance</h2><p class="muted">On-time rate is measured against the expected completion date.</p>
    <div class="performance-list">
    <?php foreach ($data['properties'] as $property): $closedCount = (int)$property['closed_with_date']; $onTime = (int)$property['on_time']; $onTimeRate = $closedCount ? round($onTime / $closedCount * 100) : 0; ?>
        <div class="performance-row performance-row-enhanced"><div class="performance-heading"><div><h3><?= e($property['name']) ?></h3><p class="muted"><?= e($property['total']) ?> tasks · <?= e($property['closed']) ?> closed · <?= e($property['pending']) ?> pending</p></div><strong><?= e($onTimeRate) ?>% on time</strong></div>
            <div class="metric-bars"><div><div class="metric-label"><span>Progress</span><span><?= e($property['average_progress']) ?>%</span></div><?= progress_bar((int)$property['average_progress']) ?></div><div><div class="metric-label"><span>On-time closures</span><span><?= e($onTime) ?>/<?= e($closedCount) ?></span></div><div class="progress-line gold"><span style="width:<?= e($onTimeRate) ?>%"></span></div></div></div>
        </div>
    <?php endforeach; ?>
    </div>
<?php card_end(); page_footer(); ?>
