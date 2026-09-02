<?php
require_once __DIR__ . '/bootstrap.php';

function page_header(string $title, string $active = ''): void {
    $user = current_user();
    $flash = pull_flash();
    ?>
    <!doctype html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title><?= e($title) ?> · Grand Holdings</title>
        <link rel="icon" href="assets/logo.png">
        <link rel="stylesheet" href="assets/style.css">
    </head>
    <body>
    <?php if ($user): ?>
        <header class="site-header">
            <div class="shell header-top">
                <a href="<?= e(url('dashboard')) ?>" class="brand">
                    <img src="assets/logo.png" alt="Grand Holdings">
                    <span>
                        <strong>Grand Holdings</strong>
                        <small>EST. HOSPITALITY</small>
                    </span>
                </a>
                <div class="header-user">
                    <span class="user-name"><?= e($user['name']) ?></span>
                    <span class="user-role"><?= e(match ($user['role']) { 'admin' => 'Administrator', 'manager' => 'Manager', default => 'Basic user' }) ?></span>
                    <form method="post" action="<?= e(url('dashboard')) ?>" class="inline-form">
                        <?= csrf_field() ?>
                        <input type="hidden" name="action" value="logout">
                        <button class="logout-button" type="submit">Log out</button>
                    </form>
                </div>
            </div>
            <nav class="shell main-nav">
                <a class="<?= $active === 'pending' ? 'active' : '' ?>" href="<?= e(url('dashboard')) ?>">Pending</a>
                <a class="<?= $active === 'tasks' ? 'active' : '' ?>" href="<?= e(url('tasks')) ?>">Tasks</a>
                <a class="<?= $active === 'history' ? 'active' : '' ?>" href="<?= e(url('history')) ?>">History</a>
                <a class="<?= $active === 'forms' ? 'active' : '' ?>" href="<?= e(url('forms')) ?>">Forms</a>
                <?php if (in_array($user['role'], ['admin', 'manager'], true)): ?>
                    <a class="<?= $active === 'checklists' ? 'active' : '' ?>" href="<?= e(url('checklists')) ?>">Checklists</a>
                <?php endif; ?>
                <?php if ($user['role'] === 'admin'): ?>
                    <a class="<?= $active === 'properties' ? 'active' : '' ?>" href="<?= e(url('facilities')) ?>">Properties</a>
                <?php endif; ?>
                <?php if (in_array($user['role'], ['admin', 'manager'], true)): ?>
                    <a class="<?= $active === 'team' ? 'active' : '' ?>" href="<?= e(url('users')) ?>">Team</a>
                <?php endif; ?>
            </nav>
        </header>
    <?php endif; ?>
    <?php if ($user): ?>
        <div class="hero-strip">
            <div class="hero-overlay"></div>
            <div class="shell hero-copy">
                <span>GAME LODGES · CAPE WINELANDS · ROBERTSON</span>
                <strong>Five-star operations, every property.</strong>
            </div>
        </div>
    <?php endif; ?>
    <main class="<?= $user ? 'shell main-content' : '' ?>">
        <?php if ($flash): ?>
            <div class="flash <?= e($flash['type']) ?>"><?= e($flash['message']) ?></div>
        <?php endif; ?>
    <?php
}

function page_footer(): void {
    ?>
    </main>
    </body>
    </html>
    <?php
}

function page_heading(string $eyebrow, string $title, string $description = '', ?string $actionHtml = null): void {
    ?>
    <div class="page-heading">
        <div>
            <span class="eyebrow"><?= e($eyebrow) ?></span>
            <h1><?= e($title) ?></h1>
            <?php if ($description): ?><p><?= e($description) ?></p><?php endif; ?>
        </div>
        <?php if ($actionHtml): ?><div><?= $actionHtml ?></div><?php endif; ?>
    </div>
    <?php
}

function card_start(string $class = ''): void {
    echo '<section class="card ' . e($class) . '">';
}

function card_end(): void {
    echo '</section>';
}

function task_navigation(string $active, string $propertyId = ''): void {
    $user = require_login();
    $facilities = facilities_for_user($user);
    ?>
    <div class="task-navigation">
        <form method="get" class="property-picker">
            <input type="hidden" name="page" value="tasks">
            <label for="task-property">Property</label>
            <select id="task-property" name="property_id" onchange="this.form.submit()">
                <option value="">All properties</option>
                <?php foreach ($facilities as $facility): ?>
                    <option value="<?= e($facility['id']) ?>" <?= (string)$facility['id'] === (string)$propertyId ? 'selected' : '' ?>>
                        <?= e($facility['name']) ?>
                    </option>
                <?php endforeach; ?>
            </select>
        </form>
        <?php if (in_array($user['role'], ['admin', 'manager'], true)): ?>
            <a class="<?= $active === 'create' ? 'active' : '' ?>" href="<?= e(url('task-create')) ?>">Create Task</a>
            <a class="<?= $active === 'dashboard' ? 'active' : '' ?>" href="<?= e(url('task-dashboard')) ?>">Dashboard</a>
        <?php endif; ?>
    </div>
    <?php
}

function progress_bar(int $progress): string {
    $progress = max(0, min(100, $progress));
    return '<div class="progress-line"><span style="width:' . $progress . '%"></span></div>';
}

function task_status_donut(int $pending, int $closed, int $overdue): string {
    $onTrack = max($pending - $overdue, 0);
    $total = $closed + $onTrack + $overdue;
    if ($total === 0) {
        $gradient = 'var(--cream)';
        $closedPct = $onTrackPct = $overduePct = 0;
    } else {
        $closedPct = round($closed / $total * 100);
        $onTrackPct = round($onTrack / $total * 100);
        $overduePct = max(0, 100 - $closedPct - $onTrackPct);
        $gradient = 'conic-gradient(var(--forest) 0 ' . $closedPct . '%, var(--gold) ' . $closedPct . '% ' . ($closedPct + $onTrackPct) . '%, var(--overdue) ' . ($closedPct + $onTrackPct) . '% 100%)';
    }
    $segments = [
        ['Closed', $closed, 'forest', $closedPct],
        ['On track', $onTrack, 'gold', $onTrackPct],
        ['Overdue', $overdue, 'overdue', $overduePct],
    ];
    $legend = '';
    foreach ($segments as [$label, $value, $tone, $pct]) {
        $legend .= '<li><span class="legend-swatch ' . e($tone) . '"></span><span class="legend-label">' . e($label) . '</span><strong>' . e((string)$value) . '</strong><span class="legend-pct">' . e((string)$pct) . '%</span></li>';
    }
    return '<div class="donut-chart"><div class="donut-ring" style="background:' . $gradient . '"><div class="donut-hole"><strong>' . e((string)$total) . '</strong><small>Tasks</small></div></div><ul class="donut-legend">' . $legend . '</ul></div>';
}

function task_status_bars(int $pending, int $closed, int $overdue): string {
    $onTrack = max($pending - $overdue, 0);
    $max = max($closed, $onTrack, $overdue, 1);
    $bars = [
        ['Closed', $closed, 'forest'],
        ['On track', $onTrack, 'gold'],
        ['Overdue', $overdue, 'overdue'],
    ];
    $html = '<div class="status-bars">';
    foreach ($bars as [$label, $value, $tone]) {
        $width = round($value / $max * 100);
        $html .= '<div class="status-bar-row"><div class="metric-label"><span>' . e($label) . '</span><span>' . e((string)$value) . '</span></div><div class="progress-line"><span class="' . e($tone) . '" style="width:' . max($width, $value > 0 ? 4 : 0) . '%"></span></div></div>';
    }
    return $html . '</div>';
}

function completion_gauge(int $value): string {
    $value = max(0, min(100, $value));
    $radius = 36;
    $circumference = 2 * M_PI * $radius;
    $offset = $circumference - ($value / 100) * $circumference;
    return '<div class="completion-gauge"><svg viewBox="0 0 88 88" aria-hidden="true"><circle cx="44" cy="44" r="' . $radius . '" fill="none" stroke="var(--cream)" stroke-width="8"></circle><circle cx="44" cy="44" r="' . $radius . '" fill="none" stroke="var(--gold)" stroke-width="8" stroke-linecap="round" stroke-dasharray="' . $circumference . '" stroke-dashoffset="' . $offset . '" transform="rotate(-90 44 44)"></circle></svg><strong>' . e((string)$value) . '%</strong></div>';
}
