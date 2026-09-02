<?php
declare(strict_types=1);

ini_set('session.cookie_httponly', '1');
ini_set('session.cookie_samesite', 'Lax');
session_start();

$config = require __DIR__ . '/../config.php';

function app_config(?string $key = null) {
    global $config;
    return $key === null ? $config : ($config[$key] ?? null);
}

function db(): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = 'mysql:host=' . app_config('db_host') . ';dbname=' . app_config('db_name') . ';charset=' . app_config('db_charset');
    $pdo = new PDO($dsn, app_config('db_user'), app_config('db_pass'), [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    return $pdo;
}

function e($value): string {
    return htmlspecialchars((string)($value ?? ''), ENT_QUOTES, 'UTF-8');
}

function url(string $page = 'dashboard', array $params = []): string {
    $params = array_merge(['page' => $page], $params);
    return 'index.php?' . http_build_query($params);
}

function redirect_to(string $page = 'dashboard', array $params = []): never {
    header('Location: ' . url($page, $params));
    exit;
}

function flash(string $message, string $type = 'success'): void {
    $_SESSION['flash'] = ['message' => $message, 'type' => $type];
}

function pull_flash(): ?array {
    $flash = $_SESSION['flash'] ?? null;
    unset($_SESSION['flash']);
    return $flash;
}

function csrf_token(): string {
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(24));
    }
    return $_SESSION['csrf'];
}

function csrf_field(): string {
    return '<input type="hidden" name="csrf" value="' . e(csrf_token()) . '">';
}

function check_csrf(): void {
    if (!hash_equals($_SESSION['csrf'] ?? '', (string)($_POST['csrf'] ?? ''))) {
        http_response_code(419);
        exit('Invalid security token. Please go back and try again.');
    }
}

function current_user(): ?array {
    return $_SESSION['user'] ?? null;
}

function require_login(): array {
    $user = current_user();
    if (!$user) {
        redirect_to('login');
    }
    return $user;
}

function require_admin(): array {
    $user = require_login();
    if ($user['role'] !== 'admin') {
        http_response_code(403);
        exit('You do not have permission to access this page.');
    }
    return $user;
}

function require_manager(): array {
    $user = require_login();
    if (!in_array($user['role'], ['admin', 'manager'], true)) {
        http_response_code(403);
        exit('Manager or administrator access is required.');
    }
    return $user;
}

function require_checklist_editor(): array {
    return require_manager();
}

function placeholders(array $values): string {
    return implode(',', array_fill(0, count($values), '?'));
}

function accessible_facility_ids(array $user): array {
    if ($user['role'] === 'admin') {
        return array_map('intval', db()->query('SELECT id FROM facilities')->fetchAll(PDO::FETCH_COLUMN));
    }
    if (!empty($user['access_all'])) {
        return array_map('intval', db()->query('SELECT id FROM facilities')->fetchAll(PDO::FETCH_COLUMN));
    }

    $stmt = db()->prepare(
        'SELECT DISTINCT facility_id FROM user_facilities WHERE user_id = ?
         UNION
         SELECT facility_id FROM users WHERE id = ? AND facility_id IS NOT NULL'
    );
    $stmt->execute([(int)$user['id'], (int)$user['id']]);
    return array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
}

function due_date(string $frequency, ?DateTimeImmutable $today = null): string {
    $today = $today ?: new DateTimeImmutable(
        'today',
        new DateTimeZone((string)(app_config('app_timezone') ?: 'Africa/Johannesburg'))
    );
    return match ($frequency) {
        'daily' => $today->format('Y-m-d'),
        'weekly' => $today->modify('monday this week')->format('Y-m-d'),
        'monthly' => $today->modify('first day of this month')->format('Y-m-d'),
        'quarterly' => sprintf('%04d-%02d-01', (int)$today->format('Y'), intdiv((int)$today->format('n') - 1, 3) * 3 + 1),
        'yearly' => $today->format('Y') . '-01-01',
        default => $today->format('Y-m-d'),
    };
}

function is_valid_period_due_date(string $frequency, string $dueDate): bool {
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dueDate)) {
        return false;
    }
    try {
        $date = new DateTimeImmutable($dueDate, new DateTimeZone((string)(app_config('app_timezone') ?: 'Africa/Johannesburg')));
    } catch (Throwable) {
        return false;
    }
    return due_date($frequency, $date) === $dueDate;
}

function is_current_period_due_date(string $frequency, string $dueDate, ?DateTimeImmutable $today = null): bool {
    return is_valid_period_due_date($frequency, $dueDate)
        && $dueDate === due_date($frequency, $today);
}

function is_past_period_due_date(string $frequency, string $dueDate, ?DateTimeImmutable $today = null): bool {
    return is_valid_period_due_date($frequency, $dueDate)
        && $dueDate < due_date($frequency, $today);
}

function assert_completable_current_period(string $frequency, string $dueDate, ?DateTimeImmutable $today = null): void {
    if (!is_current_period_due_date($frequency, $dueDate, $today)) {
        throw new RuntimeException('This checklist period is no longer available to complete.');
    }
}

function due_dates_in_range(string $frequency, DateTimeImmutable $start, DateTimeImmutable $end): array {
    $dates = [];
    $cursor = new DateTimeImmutable(due_date($frequency, $start), $start->getTimezone());
    $endDate = new DateTimeImmutable($end->format('Y-m-d'), $end->getTimezone());
    if ($cursor < $start) {
        $cursor = match ($frequency) {
            'daily' => $cursor->modify('+1 day'),
            'weekly' => $cursor->modify('+1 week'),
            'monthly' => $cursor->modify('first day of next month'),
            'quarterly' => $cursor->modify('+3 months')->modify('first day of this month'),
            'yearly' => $cursor->modify('first day of January next year'),
            default => $cursor->modify('+1 day'),
        };
    }
    while ($cursor <= $endDate) {
        $key = $cursor->format('Y-m-d');
        if (!in_array($key, $dates, true)) {
            $dates[] = $key;
        }
        $cursor = match ($frequency) {
            'daily' => $cursor->modify('+1 day'),
            'weekly' => $cursor->modify('+1 week'),
            'monthly' => $cursor->modify('first day of next month'),
            'quarterly' => $cursor->modify('+3 months')->modify('first day of this month'),
            'yearly' => $cursor->modify('first day of January next year'),
            default => $cursor->modify('+1 day'),
        };
    }
    return $dates;
}

function frequency_label(string $frequency): string {
    return [
        'daily' => 'Daily',
        'weekly' => 'Weekly · first Monday',
        'monthly' => 'Monthly · 1st of month',
        'quarterly' => 'Quarterly · Jan, Apr, Jul, Oct',
        'yearly' => 'Yearly · 1st of January',
    ][$frequency] ?? ucfirst($frequency);
}

function property_kind(string $name, string $address = ''): string {
    $value = strtolower($name . ' ' . $address);
    if (str_contains($value, 'lodge') || str_contains($value, 'game') || str_contains($value, 'safari')) return 'Game Lodge';
    if (str_contains($value, 'robertson')) return 'Robertson Valley';
    if (str_contains($value, 'wineland') || str_contains($value, 'fransch') || str_contains($value, 'paris')) return 'Cape Winelands';
    return 'Grand Holdings Property';
}

function property_image(string $name, string $address = '', int $id = 1): string {
    $value = strtolower($name . ' ' . $address);
    if (str_contains($value, 'melozhori') || str_contains($value, 'lodge') || str_contains($value, 'game') || str_contains($value, 'safari')) return 'assets/property-game-lodge.jpg';
    if (str_contains($value, 'robertson')) return 'assets/property-robertson.jpg';
    if (str_contains($value, 'wineland') || str_contains($value, 'fransch') || str_contains($value, 'paris')) return 'assets/property-winelands.jpg';
    return 'assets/' . ['property-game-lodge.jpg', 'property-winelands.jpg', 'property-robertson.jpg'][max(0, ($id - 1) % 3)];
}

function facilities_for_user(array $user): array {
    $ids = accessible_facility_ids($user);
    if (!$ids) return [];
    $stmt = db()->prepare('SELECT * FROM facilities WHERE id IN (' . placeholders($ids) . ') ORDER BY name');
    $stmt->execute($ids);
    return $stmt->fetchAll();
}

function user_requires_property_selection(array $user): bool {
    return count(facilities_for_user($user)) > 1;
}

function sole_facility_for_user(array $user): ?array {
    $facilities = facilities_for_user($user);
    return count($facilities) === 1 ? $facilities[0] : null;
}

function render_property_field(array $user, string $placeholder = 'Select property'): void {
    $soleFacility = sole_facility_for_user($user);
    if ($soleFacility) {
        echo '<input type="hidden" name="facility_id" value="' . e($soleFacility['id']) . '">';
        echo '<div class="field-static"><span class="label">Property</span> ';
        echo e($soleFacility['name']) . '</div>';
        return;
    }

    echo '<label>Property<select name="facility_id" required>';
    echo '<option value="">' . e($placeholder) . '</option>';
    foreach (facilities_for_user($user) as $facility) {
        echo '<option value="' . e($facility['id']) . '">' . e($facility['name']) . '</option>';
    }
    echo '</select></label>';
}

function can_manage_checklist(array $user, int $checklistId): bool {
    if ($user['role'] === 'admin') return true;
    $stmt = db()->prepare('SELECT facility_id FROM checklist_facilities WHERE checklist_id = ?');
    $stmt->execute([$checklistId]);
    $assigned = array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
    return $assigned && !array_diff($assigned, accessible_facility_ids($user));
}

function users_for_task_assignment(array $user): array {
    $ids = accessible_facility_ids($user);
    $where = $ids ? "active = 1 AND (role IN ('admin', 'manager') OR facility_id IN (" . placeholders($ids) . ") OR id IN (SELECT user_id FROM user_facilities WHERE facility_id IN (" . placeholders($ids) . ")))" : "active = 1 AND role IN ('admin', 'manager')";
    $stmt = db()->prepare("SELECT id, name, email, role, facility_id FROM users WHERE $where ORDER BY name");
    $stmt->execute($ids ? array_merge($ids, $ids) : []);
    return $stmt->fetchAll();
}

function pending_checklists(array $user): array {
    $ids = accessible_facility_ids($user);
    if (!$ids) return [];

    $stmt = db()->prepare(
        'SELECT c.id checklist_id, c.name checklist_name, c.frequency,
                f.id facility_id, f.name facility_name, f.address facility_address
         FROM checklists c
         JOIN checklist_facilities cf ON cf.checklist_id = c.id
         JOIN facilities f ON f.id = cf.facility_id
         WHERE f.id IN (' . placeholders($ids) . ')
         ORDER BY f.name, c.name'
    );
    $stmt->execute($ids);
    $rows = $stmt->fetchAll();
    $result = [];
    foreach ($rows as $row) {
        $currentDueDate = due_date($row['frequency']);
        $completionStmt = db()->prepare(
            'SELECT id, due_date, status
             FROM checklist_completions
             WHERE checklist_id = ? AND facility_id = ? AND due_date = ?'
        );
        $completionStmt->execute([(int)$row['checklist_id'], (int)$row['facility_id'], $currentDueDate]);
        $completion = $completionStmt->fetch();
        if ($completion && $completion['status'] === 'completed') {
            continue;
        }

        $count = db()->prepare('SELECT COUNT(*) FROM checklist_items WHERE checklist_id = ?');
        $count->execute([$row['checklist_id']]);
        $itemCount = (int)$count->fetchColumn();

        $result[] = array_merge($row, [
            'due_date' => $currentDueDate,
            'completion_id' => $completion ? (int)$completion['id'] : null,
            'item_count' => $itemCount,
        ]);
    }
    usort($result, static fn(array $a, array $b): int =>
        [$a['due_date'], $a['facility_name'], $a['checklist_name']]
        <=> [$b['due_date'], $b['facility_name'], $b['checklist_name']]
    );
    return $result;
}

function get_or_create_completion(int $checklistId, int $facilityId, string $dueDate, int $userId): int {
    $pdo = db();
    $checklist = db()->prepare('SELECT frequency FROM checklists WHERE id = ?');
    $checklist->execute([$checklistId]);
    $frequency = (string)($checklist->fetchColumn() ?: '');
    if (!$frequency) {
        throw new RuntimeException('Checklist not found.');
    }
    assert_completable_current_period($frequency, $dueDate);
    $stmt = $pdo->prepare('SELECT id, status FROM checklist_completions WHERE checklist_id = ? AND facility_id = ? AND due_date = ?');
    $stmt->execute([$checklistId, $facilityId, $dueDate]);
    $existing = $stmt->fetch();

    if ($existing) {
        if ($existing['status'] === 'completed') {
            $pdo->prepare("UPDATE checklist_completions SET status = 'pending', submitted_at = NULL, user_id = ? WHERE id = ?")
                ->execute([$userId, $existing['id']]);
            $pdo->prepare('UPDATE checklist_completion_items SET completed = 0, note = NULL WHERE completion_id = ?')
                ->execute([$existing['id']]);
        }
        $completionId = (int)$existing['id'];
    } else {
        $pdo->prepare("INSERT INTO checklist_completions (checklist_id, facility_id, user_id, due_date, status) VALUES (?, ?, ?, ?, 'pending')")
            ->execute([$checklistId, $facilityId, $userId, $dueDate]);
        $completionId = (int)$pdo->lastInsertId();
    }

    $items = $pdo->prepare('SELECT id FROM checklist_items WHERE checklist_id = ? ORDER BY sort_order');
    $items->execute([$checklistId]);
    $existingItems = $pdo->prepare('SELECT item_id FROM checklist_completion_items WHERE completion_id = ?');
    $existingItems->execute([$completionId]);
    $existingIds = array_map('intval', $existingItems->fetchAll(PDO::FETCH_COLUMN));
    $insert = $pdo->prepare('INSERT IGNORE INTO checklist_completion_items (completion_id, item_id, completed) VALUES (?, ?, 0)');
    foreach ($items->fetchAll() as $item) {
        if (!in_array((int)$item['id'], $existingIds, true)) {
            $insert->execute([$completionId, $item['id']]);
        }
    }
    return $completionId;
}

function completion_detail(int $completionId): ?array {
    $stmt = db()->prepare(
        'SELECT cc.*, c.name checklist_name, c.frequency, f.name facility_name, f.address facility_address, u.name user_name
         FROM checklist_completions cc
         JOIN checklists c ON c.id = cc.checklist_id
         JOIN facilities f ON f.id = cc.facility_id
         LEFT JOIN users u ON u.id = cc.user_id
         WHERE cc.id = ?'
    );
    $stmt->execute([$completionId]);
    $completion = $stmt->fetch();
    if (!$completion) return null;

    $items = db()->prepare(
        'SELECT cci.id, cci.completed, cci.note, ci.description, ci.sort_order
         FROM checklist_completion_items cci
         JOIN checklist_items ci ON ci.id = cci.item_id
         WHERE cci.completion_id = ? ORDER BY ci.sort_order'
    );
    $items->execute([$completionId]);
    return ['completion' => $completion, 'items' => $items->fetchAll()];
}

function search_checklist_history(array $user, string $dateFrom = '', string $dateTo = '', int $facilityId = 0): array {
    $ids = accessible_facility_ids($user);
    if (!$ids) return [];

    $scopedIds = $facilityId ? array_values(array_intersect($ids, [$facilityId])) : $ids;
    if (!$scopedIds) return [];

    $timezone = new DateTimeZone((string)(app_config('app_timezone') ?: 'Africa/Johannesburg'));
    $today = new DateTimeImmutable('today', $timezone);
    $effectiveTo = $dateTo !== '' ? $dateTo : $today->format('Y-m-d');
    $effectiveFrom = $dateFrom !== ''
        ? $dateFrom
        : $today->modify('-89 days')->format('Y-m-d');

    $assignStmt = db()->prepare(
        'SELECT c.id checklist_id, c.name checklist_name, c.frequency,
                f.id facility_id, f.name facility_name
         FROM checklists c
         JOIN checklist_facilities cf ON cf.checklist_id = c.id
         JOIN facilities f ON f.id = cf.facility_id
         WHERE f.id IN (' . placeholders($scopedIds) . ')
         ORDER BY c.name, f.name'
    );
    $assignStmt->execute($scopedIds);
    $assignments = $assignStmt->fetchAll();

    $recordStmt = db()->prepare(
        'SELECT cc.id, cc.checklist_id, cc.facility_id, cc.due_date, cc.submitted_at, cc.status,
                c.name checklist_name, c.frequency, f.name facility_name, u.name user_name
         FROM checklist_completions cc
         JOIN checklists c ON c.id = cc.checklist_id
         JOIN facilities f ON f.id = cc.facility_id
         LEFT JOIN users u ON u.id = cc.user_id
         WHERE cc.facility_id IN (' . placeholders($scopedIds) . ')
           AND cc.due_date >= ?
           AND cc.due_date <= ?
         ORDER BY cc.due_date DESC, f.name, c.name'
    );
    $recordStmt->execute(array_merge($scopedIds, [$effectiveFrom, $effectiveTo]));
    $records = $recordStmt->fetchAll();

    $results = [];
    foreach ($records as $record) {
        $displayStatus = $record['status'] === 'completed'
            ? 'completed'
            : (is_past_period_due_date($record['frequency'], (string)$record['due_date']) ? 'missed' : null);
        if (!$displayStatus) continue;
        $key = $record['checklist_id'] . ':' . $record['facility_id'] . ':' . $record['due_date'];
        $results[$key] = [
            'id' => (int)$record['id'],
            'checklist_name' => $record['checklist_name'],
            'frequency' => $record['frequency'],
            'facility_name' => $record['facility_name'],
            'due_date' => $record['due_date'],
            'submitted_at' => $record['submitted_at'],
            'status' => $displayStatus,
            'user_name' => $record['user_name'],
        ];
    }

    $rangeStart = new DateTimeImmutable($effectiveFrom, $timezone);
    $rangeEnd = new DateTimeImmutable($effectiveTo, $timezone);
    foreach ($assignments as $assignment) {
        foreach (due_dates_in_range($assignment['frequency'], $rangeStart, $rangeEnd) as $dueDateKey) {
            if (!is_past_period_due_date($assignment['frequency'], $dueDateKey)) {
                continue;
            }
            $key = $assignment['checklist_id'] . ':' . $assignment['facility_id'] . ':' . $dueDateKey;
            if (isset($results[$key])) continue;
            $results[$key] = [
                'id' => null,
                'checklist_name' => $assignment['checklist_name'],
                'frequency' => $assignment['frequency'],
                'facility_name' => $assignment['facility_name'],
                'due_date' => $dueDateKey,
                'submitted_at' => null,
                'status' => 'missed',
                'user_name' => null,
            ];
        }
    }

    $results = array_values($results);
    usort($results, static fn(array $a, array $b): int =>
        [$b['due_date'], $a['facility_name'], $a['checklist_name']]
        <=> [$a['due_date'], $b['facility_name'], $b['checklist_name']]
    );
    return $results;
}

function task_scope(array $user, string $alias = 't'): array {
    $ids = accessible_facility_ids($user);
    return [
        'sql' => $ids ? "$alias.facility_id IN (" . placeholders($ids) . ")" : '1 = 0',
        'params' => $ids,
    ];
}

function list_tasks(array $user, array $filters = []): array {
    $scope = task_scope($user);
    $sql = "SELECT t.*, f.name facility_name, creator.name created_by_name, assignee.name assigned_user_name
            FROM tasks t
            JOIN facilities f ON f.id = t.facility_id
            JOIN users creator ON creator.id = t.created_by
            LEFT JOIN users assignee ON assignee.id = t.assigned_user_id
            WHERE {$scope['sql']}";
    $params = $scope['params'];
    if (!empty($filters['facility_id'])) {
        $sql .= ' AND t.facility_id = ?';
        $params[] = (int)$filters['facility_id'];
    }
    if (!empty($filters['status']) && $filters['status'] !== 'all') {
        $sql .= ' AND t.status = ?';
        $params[] = $filters['status'];
    }
    if (!empty($filters['search'])) {
        $sql .= ' AND (LOWER(t.title) LIKE LOWER(?) OR LOWER(t.description) LIKE LOWER(?))';
        $search = '%' . trim($filters['search']) . '%';
        $params[] = $search;
        $params[] = $search;
    }
    if (!empty($filters['month'])) {
        $sql .= " AND MONTH(t.expected_date) = ?";
        $params[] = (int)$filters['month'];
    }
    if (!empty($filters['year'])) {
        $sql .= " AND YEAR(t.expected_date) = ?";
        $params[] = (int)$filters['year'];
    }
    $sql .= " ORDER BY CASE WHEN t.status = 'pending' THEN 0 ELSE 1 END, t.expected_date ASC, t.created_at DESC";
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchAll();
}

function get_task(array $user, int $taskId): ?array {
    $scope = task_scope($user);
    $stmt = db()->prepare(
        "SELECT t.*, f.name facility_name, f.address facility_address,
                creator.name created_by_name, creator.email created_by_email,
                assignee.name assigned_user_name, assignee.email assigned_user_email
         FROM tasks t
         JOIN facilities f ON f.id = t.facility_id
         JOIN users creator ON creator.id = t.created_by
         LEFT JOIN users assignee ON assignee.id = t.assigned_user_id
         WHERE t.id = ? AND {$scope['sql']}"
    );
    $stmt->execute(array_merge([$taskId], $scope['params']));
    $task = $stmt->fetch();
    if (!$task) return null;

    $updatesStmt = db()->prepare(
        'SELECT tu.*, u.name user_name FROM task_updates tu
         JOIN users u ON u.id = tu.user_id
         WHERE tu.task_id = ? ORDER BY tu.created_at DESC, tu.id DESC'
    );
    $updatesStmt->execute([$taskId]);
    $rawUpdates = $updatesStmt->fetchAll();

    $attachmentsStmt = db()->prepare(
        'SELECT ta.*, u.name uploaded_by_name FROM task_attachments ta
         JOIN users u ON u.id = ta.uploaded_by
         WHERE ta.task_id = ? ORDER BY ta.created_at ASC, ta.id ASC'
    );
    $attachmentsStmt->execute([$taskId]);
    $rawAttachments = $attachmentsStmt->fetchAll();

    $attachmentsByUpdate = [];
    $creationAttachments = [];
    foreach ($rawAttachments as $attachment) {
        if ($attachment['update_id'] === null) {
            $creationAttachments[] = $attachment;
            continue;
        }
        $attachmentsByUpdate[(int)$attachment['update_id']][] = $attachment;
    }

    $updates = [];
    foreach ($rawUpdates as $update) {
        $update['attachments'] = $attachmentsByUpdate[(int)$update['id']] ?? [];
        $updates[] = $update;
    }

    if ($creationAttachments) {
        $updates[] = [
            'id' => 0,
            'note' => '',
            'progress' => 0,
            'created_at' => $task['created_at'],
            'user_name' => $task['created_by_name'],
            'is_creation' => true,
            'attachments' => $creationAttachments,
        ];
    }

    usort($updates, static function (array $a, array $b): int {
        $timeDiff = strcmp((string)$b['created_at'], (string)$a['created_at']);
        if ($timeDiff !== 0) {
            return $timeDiff;
        }
        return ((int)$b['id']) <=> ((int)$a['id']);
    });

    return [
        'task' => $task,
        'updates' => $updates,
    ];
}

function task_dashboard(array $user): array {
    $scope = task_scope($user);
    $today = (new DateTimeImmutable('today'))->format('Y-m-d');
    $stmt = db()->prepare(
        "SELECT COUNT(*) total,
                COALESCE(SUM(status = 'pending'), 0) pending,
                COALESCE(SUM(status = 'closed'), 0) closed,
                COALESCE(SUM(status = 'pending' AND expected_date < ?), 0) overdue,
                ROUND(COALESCE(AVG(progress), 0)) average_progress
         FROM tasks t WHERE {$scope['sql']}"
    );
    $stmt->execute(array_merge([$today], $scope['params']));
    $summary = $stmt->fetch();

    $ids = accessible_facility_ids($user);
    if (!$ids) return ['summary' => $summary, 'properties' => []];
    $properties = db()->prepare(
        "SELECT f.id, f.name,
                COUNT(t.id) total,
                COALESCE(SUM(t.status = 'pending'), 0) pending,
                COALESCE(SUM(t.status = 'closed'), 0) closed,
                ROUND(COALESCE(AVG(t.progress), 0)) average_progress,
                COALESCE(SUM(t.status = 'closed' AND DATE(t.closed_at) <= DATE(t.expected_date)), 0) on_time,
                COALESCE(SUM(t.status = 'closed'), 0) closed_with_date
         FROM facilities f
         LEFT JOIN tasks t ON t.facility_id = f.id
         WHERE f.id IN (" . placeholders($ids) . ")
         GROUP BY f.id, f.name ORDER BY f.name"
    );
    $properties->execute($ids);
    return ['summary' => $summary, 'properties' => $properties->fetchAll()];
}

function task_image_extensions(): array {
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'];
}

function task_document_extensions(): array {
    return ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt'];
}

function task_allowed_extensions(): array {
    return array_merge(task_image_extensions(), task_document_extensions());
}

function classify_task_file(string $filename, string $mime = ''): ?string {
    $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    if ($mime !== '' && str_starts_with($mime, 'image/')) {
        return 'image';
    }
    if (in_array($extension, task_image_extensions(), true)) {
        return 'image';
    }
    if (in_array($extension, task_document_extensions(), true)) {
        return 'document';
    }
    return null;
}

function normalize_uploaded_files(string $field): array {
    if (empty($_FILES[$field]) || !isset($_FILES[$field]['name'])) {
        return [];
    }
    $files = $_FILES[$field];
    if (!is_array($files['name'])) {
        return [[
            'name' => $files['name'],
            'tmp_name' => $files['tmp_name'],
            'error' => $files['error'],
            'size' => $files['size'],
        ]];
    }
    $normalized = [];
    foreach ($files['name'] as $index => $name) {
        $normalized[] = [
            'name' => $name,
            'tmp_name' => $files['tmp_name'][$index] ?? '',
            'error' => $files['error'][$index] ?? UPLOAD_ERR_NO_FILE,
            'size' => $files['size'][$index] ?? 0,
        ];
    }
    return $normalized;
}

function validate_create_task_uploads(array $images, array $documents): void {
    $imageCount = 0;
    $documentCount = 0;

    foreach ($images as $file) {
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
            continue;
        }
        if (($file['error'] ?? 1) !== UPLOAD_ERR_OK) {
            throw new RuntimeException('One of the files could not be uploaded.');
        }
        if ((int)($file['size'] ?? 0) > (int)app_config('max_upload_bytes')) {
            throw new RuntimeException('Each file must be smaller than 8 MB.');
        }
        $kind = classify_task_file((string)$file['name']);
        if ($kind !== 'image') {
            throw new RuntimeException('Use the images field for image files only.');
        }
        $imageCount++;
        if ($imageCount > 4) {
            throw new RuntimeException('You can upload up to 4 images.');
        }
    }

    foreach ($documents as $file) {
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
            continue;
        }
        if (($file['error'] ?? 1) !== UPLOAD_ERR_OK) {
            throw new RuntimeException('One of the files could not be uploaded.');
        }
        if ((int)($file['size'] ?? 0) > (int)app_config('max_upload_bytes')) {
            throw new RuntimeException('Each file must be smaller than 8 MB.');
        }
        $kind = classify_task_file((string)$file['name']);
        if ($kind !== 'document') {
            throw new RuntimeException('Use the documents field for document files only.');
        }
        $documentCount++;
        if ($documentCount > 2) {
            throw new RuntimeException('You can upload up to 2 documents.');
        }
    }
}

function save_task_attachment(array $file, int $taskId, int $userId, ?int $updateId = null): void {
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        return;
    }
    if (($file['error'] ?? 1) !== UPLOAD_ERR_OK) {
        throw new RuntimeException('One of the files could not be uploaded.');
    }
    if ((int)($file['size'] ?? 0) > (int)app_config('max_upload_bytes')) {
        throw new RuntimeException('Each file must be smaller than 8 MB.');
    }

    $originalName = (string)$file['name'];
    $extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
    if (!in_array($extension, task_allowed_extensions(), true)) {
        throw new RuntimeException('That file type is not supported.');
    }

    $dir = rtrim((string)app_config('upload_dir'), '/') . '/task_' . $taskId;
    if (!is_dir($dir)) {
        mkdir($dir, 0750, true);
    }

    $safeName = preg_replace('/[^a-zA-Z0-9._-]/', '_', basename($originalName));
    $storedName = bin2hex(random_bytes(8)) . '_' . $safeName;
    $target = $dir . '/' . $storedName;
    if (!move_uploaded_file((string)$file['tmp_name'], $target)) {
        throw new RuntimeException('The uploaded file could not be saved.');
    }

    $relativePath = 'uploads/tasks/task_' . $taskId . '/' . $storedName;
    $mime = function_exists('mime_content_type')
        ? (mime_content_type($target) ?: 'application/octet-stream')
        : 'application/octet-stream';
    db()->prepare(
        'INSERT INTO task_attachments (task_id, update_id, uploaded_by, file_name, mime_type, file_path)
         VALUES (?, ?, ?, ?, ?, ?)'
    )->execute([$taskId, $updateId, $userId, $originalName, $mime, $relativePath]);
}

function upload_create_task_files(int $taskId, int $userId): void {
    $images = normalize_uploaded_files('images');
    $documents = normalize_uploaded_files('documents');
    validate_create_task_uploads($images, $documents);

    foreach ([...$images, ...$documents] as $file) {
        save_task_attachment($file, $taskId, $userId);
    }
}

function upload_files(string $field, int $taskId, int $userId, ?int $updateId = null): void {
    foreach (normalize_uploaded_files($field) as $file) {
        save_task_attachment($file, $taskId, $userId, $updateId);
    }
}

require_once __DIR__ . '/mail.php';
