<?php
declare(strict_types=1);

require_once __DIR__ . '/inc/bootstrap.php';
require_once __DIR__ . '/inc/layout.php';

$action = (string)($_POST['action'] ?? '');
if ($action !== '') {
    check_csrf();
    try {
        switch ($action) {
            case 'login':
                $stmt = db()->prepare('SELECT id, email, password_hash, name, role, facility_id, access_all, active FROM users WHERE email = ?');
                $stmt->execute([strtolower(trim((string)($_POST['email'] ?? '')))]);
                $user = $stmt->fetch();
                if (!$user || !password_verify((string)($_POST['password'] ?? ''), (string)$user['password_hash'])) {
                    flash('The email or password was not recognised.', 'error');
                    redirect_to('login');
                }
                if (empty($user['active'])) {
                    flash('This account has been deactivated. Contact an administrator.', 'error');
                    redirect_to('login');
                }
                unset($user['password_hash'], $user['active']);
                $_SESSION['user'] = $user;
                session_regenerate_id(true);
                redirect_to('dashboard');

            case 'logout':
                $_SESSION = [];
                session_destroy();
                redirect_to('login');

            case 'facility_save':
                $user = require_admin();
                $id = (int)($_POST['id'] ?? 0);
                $values = [
                    trim((string)($_POST['name'] ?? '')),
                    trim((string)($_POST['address'] ?? '')),
                    trim((string)($_POST['contact_name'] ?? '')),
                    trim((string)($_POST['contact_phone'] ?? '')),
                    trim((string)($_POST['contact_email'] ?? '')),
                ];
                if (!$values[0]) throw new RuntimeException('Property name is required.');
                if ($id) {
                    db()->prepare('UPDATE facilities SET name = ?, address = ?, contact_name = ?, contact_phone = ?, contact_email = ? WHERE id = ?')
                        ->execute(array_merge($values, [$id]));
                } else {
                    db()->prepare('INSERT INTO facilities (name, address, contact_name, contact_phone, contact_email) VALUES (?, ?, ?, ?, ?)')
                        ->execute($values);
                }
                flash($id ? 'Property updated.' : 'Property added.');
                redirect_to('facilities');

            case 'facility_delete':
                require_admin();
                db()->prepare('DELETE FROM facilities WHERE id = ?')->execute([(int)$_POST['id']]);
                flash('Property deleted.');
                redirect_to('facilities');

            case 'checklist_create':
                $user = require_checklist_editor();
                $name = trim((string)($_POST['name'] ?? ''));
                $frequency = (string)($_POST['frequency'] ?? 'daily');
                $allowedFrequencies = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];
                $facilityIds = array_map('intval', (array)($_POST['facility_ids'] ?? []));
                if (!$name || !in_array($frequency, $allowedFrequencies, true) || !$facilityIds) {
                    throw new RuntimeException('Name, frequency, and at least one property are required.');
                }
                if (array_diff($facilityIds, accessible_facility_ids($user))) {
                    throw new RuntimeException('You can only assign checklists to properties you can access.');
                }
                db()->prepare('INSERT INTO checklists (name, frequency) VALUES (?, ?)')->execute([$name, $frequency]);
                $checklistId = (int)db()->lastInsertId();
                $assign = db()->prepare('INSERT INTO checklist_facilities (checklist_id, facility_id) VALUES (?, ?)');
                foreach ($facilityIds as $facilityId) $assign->execute([$checklistId, $facilityId]);
                flash('Checklist created. Add its items below.');
                redirect_to('checklist', ['id' => $checklistId]);

            case 'checklist_update':
                $user = require_checklist_editor();
                $id = (int)$_POST['id'];
                $name = trim((string)($_POST['name'] ?? ''));
                $frequency = (string)($_POST['frequency'] ?? 'daily');
                $facilityIds = array_map('intval', (array)($_POST['facility_ids'] ?? []));
                if (!can_manage_checklist($user, $id)) {
                    throw new RuntimeException('You do not have permission to modify this checklist.');
                }
                if (!$name || !in_array($frequency, ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'], true) || !$facilityIds) {
                    throw new RuntimeException('Name, frequency, and at least one property are required.');
                }
                if (array_diff($facilityIds, accessible_facility_ids($user))) {
                    throw new RuntimeException('You can only assign checklists to properties you can access.');
                }
                db()->prepare('UPDATE checklists SET name = ?, frequency = ? WHERE id = ?')->execute([$name, $frequency, $id]);
                db()->prepare('DELETE FROM checklist_facilities WHERE checklist_id = ?')->execute([$id]);
                $assign = db()->prepare('INSERT INTO checklist_facilities (checklist_id, facility_id) VALUES (?, ?)');
                foreach ($facilityIds as $facilityId) $assign->execute([$id, $facilityId]);
                flash('Checklist settings saved.');
                redirect_to('checklist', ['id' => $id]);

            case 'checklist_delete':
                $user = require_checklist_editor();
                $id = (int)$_POST['id'];
                if (!can_manage_checklist($user, $id)) {
                    throw new RuntimeException('You do not have permission to delete this checklist.');
                }
                db()->prepare('DELETE FROM checklists WHERE id = ?')->execute([$id]);
                flash('Checklist deleted.');
                redirect_to('checklists');

            case 'item_add':
                $user = require_checklist_editor();
                $checklistId = (int)$_POST['checklist_id'];
                if (!can_manage_checklist($user, $checklistId)) {
                    throw new RuntimeException('You do not have permission to modify this checklist.');
                }
                $description = trim((string)($_POST['description'] ?? ''));
                if (!$description) throw new RuntimeException('Item description is required.');
                $order = db()->prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 FROM checklist_items WHERE checklist_id = ?');
                $order->execute([$checklistId]);
                db()->prepare('INSERT INTO checklist_items (checklist_id, description, sort_order) VALUES (?, ?, ?)')
                    ->execute([$checklistId, $description, (int)$order->fetchColumn()]);
                flash('Checklist item added.');
                redirect_to('checklist', ['id' => $checklistId]);

            case 'item_delete':
                $user = require_checklist_editor();
                $checklistId = (int)$_POST['checklist_id'];
                if (!can_manage_checklist($user, $checklistId)) {
                    throw new RuntimeException('You do not have permission to modify this checklist.');
                }
                db()->prepare('DELETE FROM checklist_items WHERE id = ? AND checklist_id = ?')->execute([(int)$_POST['item_id'], $checklistId]);
                flash('Checklist item removed.');
                redirect_to('checklist', ['id' => $checklistId]);

            case 'user_create':
                $actor = require_manager();
                $email = strtolower(trim((string)($_POST['email'] ?? '')));
                $name = trim((string)($_POST['name'] ?? ''));
                $password = (string)($_POST['password'] ?? '');
                $role = (string)($_POST['role'] ?? 'basic');
                $accessAll = !empty($_POST['access_all']) ? 1 : 0;
                $facilityIds = array_values(array_unique(array_filter(array_map('intval', (array)($_POST['facility_ids'] ?? [])))));
                if ($role === 'admin' && $actor['role'] !== 'admin') {
                    throw new RuntimeException('Only administrators can create administrator accounts.');
                }
                if (!$email || !$name || strlen($password) < 6 || !in_array($role, ['admin', 'manager', 'basic'], true) || ($role !== 'admin' && !$accessAll && !$facilityIds)) {
                    throw new RuntimeException('Enter a name, email, password of at least 6 characters, and choose one or more properties or All properties.');
                }
                $legacyFacilityId = $facilityIds[0] ?? null;
                db()->prepare('INSERT INTO users (email, password_hash, name, role, facility_id, access_all) VALUES (?, ?, ?, ?, ?, ?)')
                    ->execute([$email, password_hash($password, PASSWORD_DEFAULT), $name, $role, $legacyFacilityId, $accessAll || $role === 'admin' ? 1 : 0]);
                $newUserId = (int)db()->lastInsertId();
                if ($facilityIds) {
                    $assign = db()->prepare('INSERT INTO user_facilities (user_id, facility_id) VALUES (?, ?)');
                    foreach ($facilityIds as $facilityId) $assign->execute([$newUserId, $facilityId]);
                }
                flash($role === 'admin' ? 'Administrator added.' : ($role === 'manager' ? 'Manager added.' : 'Basic user added.'));
                redirect_to('users');

            case 'user_update':
                $actor = require_manager();
                $userId = (int)($_POST['user_id'] ?? 0);
                $email = strtolower(trim((string)($_POST['email'] ?? '')));
                $name = trim((string)($_POST['name'] ?? ''));
                $password = (string)($_POST['password'] ?? '');
                $role = (string)($_POST['role'] ?? 'basic');
                $accessAll = !empty($_POST['access_all']) ? 1 : 0;
                $facilityIds = array_values(array_unique(array_filter(array_map('intval', (array)($_POST['facility_ids'] ?? [])))));
                if ($role === 'admin' && $actor['role'] !== 'admin') {
                    throw new RuntimeException('Only administrators can assign administrator access.');
                }
                if (!$userId || !$email || !$name || !in_array($role, ['admin', 'manager', 'basic'], true)) {
                    throw new RuntimeException('Name, email, and access level are required.');
                }
                if ($password !== '' && strlen($password) < 6) {
                    throw new RuntimeException('Password must be at least 6 characters.');
                }
                if ($role !== 'admin' && !$accessAll && !$facilityIds) {
                    throw new RuntimeException('Choose one or more properties or All properties.');
                }
                $stmt = db()->prepare('SELECT id, role, active FROM users WHERE id = ?');
                $stmt->execute([$userId]);
                $target = $stmt->fetch();
                if (!$target || empty($target['active'])) {
                    throw new RuntimeException('User not found.');
                }
                if ($target['role'] === 'admin' && $actor['role'] !== 'admin') {
                    throw new RuntimeException('Only administrators can modify administrator accounts.');
                }
                if ($target['role'] === 'admin' && $role !== 'admin') {
                    $adminCount = (int)db()->query("SELECT COUNT(*) FROM users WHERE role = 'admin' AND active = 1")->fetchColumn();
                    if ($adminCount <= 1) {
                        throw new RuntimeException('Cannot remove administrator access from the last active administrator.');
                    }
                }
                if ($userId === (int)$actor['id'] && $target['role'] === 'admin' && $role !== 'admin') {
                    throw new RuntimeException('You cannot remove your own administrator access.');
                }
                $existing = db()->prepare('SELECT id FROM users WHERE email = ? AND id != ?');
                $existing->execute([$email, $userId]);
                if ($existing->fetch()) {
                    throw new RuntimeException('Email already exists.');
                }
                if ($facilityIds) {
                    $placeholders = implode(',', array_fill(0, count($facilityIds), '?'));
                    $valid = db()->prepare("SELECT id FROM facilities WHERE id IN ($placeholders)");
                    $valid->execute($facilityIds);
                    $validIds = array_map('intval', $valid->fetchAll(PDO::FETCH_COLUMN));
                    if (array_diff($facilityIds, $validIds)) {
                        throw new RuntimeException('One or more selected properties do not exist.');
                    }
                }
                $legacyFacilityId = $facilityIds[0] ?? null;
                $accessAllValue = $accessAll || $role === 'admin' ? 1 : 0;
                if ($password !== '') {
                    db()->prepare('UPDATE users SET email = ?, name = ?, role = ?, facility_id = ?, access_all = ?, password_hash = ? WHERE id = ?')
                        ->execute([$email, $name, $role, $legacyFacilityId, $accessAllValue, password_hash($password, PASSWORD_DEFAULT), $userId]);
                } else {
                    db()->prepare('UPDATE users SET email = ?, name = ?, role = ?, facility_id = ?, access_all = ? WHERE id = ?')
                        ->execute([$email, $name, $role, $legacyFacilityId, $accessAllValue, $userId]);
                }
                db()->prepare('DELETE FROM user_facilities WHERE user_id = ?')->execute([$userId]);
                if ($facilityIds) {
                    $assign = db()->prepare('INSERT INTO user_facilities (user_id, facility_id) VALUES (?, ?)');
                    foreach ($facilityIds as $facilityId) $assign->execute([$userId, $facilityId]);
                }
                flash('User updated.');
                redirect_to('users');

            case 'user_deactivate':
                $admin = require_admin();
                $userId = (int)($_POST['user_id'] ?? 0);
                if (!$userId) {
                    throw new RuntimeException('Invalid user.');
                }
                if ($userId === (int)$admin['id']) {
                    throw new RuntimeException('You cannot deactivate your own account.');
                }
                $stmt = db()->prepare('SELECT id, role, active FROM users WHERE id = ?');
                $stmt->execute([$userId]);
                $target = $stmt->fetch();
                if (!$target) {
                    throw new RuntimeException('User not found.');
                }
                if (empty($target['active'])) {
                    throw new RuntimeException('User is already inactive.');
                }
                if ($target['role'] === 'admin') {
                    $adminCount = (int)db()->query("SELECT COUNT(*) FROM users WHERE role = 'admin' AND active = 1")->fetchColumn();
                    if ($adminCount <= 1) {
                        throw new RuntimeException('Cannot deactivate the last active administrator.');
                    }
                }
                db()->prepare('UPDATE users SET active = 0 WHERE id = ?')->execute([$userId]);
                flash('User deactivated.');
                redirect_to('users');

            case 'completion_save':
                $user = require_login();
                $checklistId = (int)$_POST['checklist_id'];
                $facilityId = (int)$_POST['facility_id'];
                $dueDate = (string)$_POST['due_date'];
                if (!in_array($facilityId, accessible_facility_ids($user), true)) {
                    throw new RuntimeException('You cannot complete this property checklist.');
                }
                $assignment = db()->prepare('SELECT 1 FROM checklist_facilities WHERE checklist_id = ? AND facility_id = ?');
                $assignment->execute([$checklistId, $facilityId]);
                if (!$assignment->fetchColumn()) {
                    throw new RuntimeException('This checklist is not assigned to that property.');
                }
                $completionId = get_or_create_completion($checklistId, $facilityId, $dueDate, (int)$user['id']);
                $update = db()->prepare('UPDATE checklist_completion_items SET completed = ?, note = ? WHERE id = ? AND completion_id = ?');
                foreach ((array)($_POST['items'] ?? []) as $itemId => $item) {
                    $update->execute([
                        !empty($item['completed']) ? 1 : 0,
                        trim((string)($item['note'] ?? '')) ?: null,
                        (int)$itemId,
                        $completionId,
                    ]);
                }
                if (isset($_POST['submit'])) {
                    db()->prepare("UPDATE checklist_completions SET status = 'completed', submitted_at = NOW(), user_id = ? WHERE id = ?")
                        ->execute([(int)$user['id'], $completionId]);
                    flash('Checklist submitted.');
                } else {
                    flash('Checklist progress saved.');
                }
                redirect_to('dashboard');

            case 'task_create':
                $user = require_manager();
                $facilityId = (int)($_POST['facility_id'] ?? 0);
                $title = trim((string)($_POST['title'] ?? ''));
                $description = trim((string)($_POST['description'] ?? ''));
                $expectedDate = (string)($_POST['expected_date'] ?? '');
                $assignedUserId = !empty($_POST['assigned_user_id']) ? (int)$_POST['assigned_user_id'] : null;
                if (!$title || !$expectedDate || !$facilityId || !in_array($facilityId, accessible_facility_ids($user), true)) {
                    throw new RuntimeException('Property, task name, and expected completion date are required.');
                }
                validate_task_assignee($user, $assignedUserId, $facilityId);
                db()->prepare('INSERT INTO tasks (facility_id, title, description, expected_date, created_by, assigned_user_id) VALUES (?, ?, ?, ?, ?, ?)')
                    ->execute([$facilityId, $title, $description, $expectedDate, (int)$user['id'], $assignedUserId]);
                $taskId = (int)db()->lastInsertId();
                upload_create_task_files($taskId, (int)$user['id']);
                try {
                    $sentTo = send_task_created_notifications($taskId);
                    flash($sentTo > 0
                        ? "Task created. Email notification sent to {$sentTo} manager(s)."
                        : 'Task created. No manager recipients were found for this property.');
                } catch (Throwable $notificationError) {
                    error_log(sprintf(
                        'Task email notification failed for task %d: %s',
                        $taskId,
                        $notificationError->getMessage()
                    ));
                    flash('Task created, but manager email notifications could not be sent.', 'warning');
                }
                redirect_to('task', ['id' => $taskId]);

            case 'task_update':
                $user = require_login();
                $taskId = (int)$_POST['task_id'];
                $detail = get_task($user, $taskId);
                if (!$detail) throw new RuntimeException('Task not found.');
                $canManageTask = in_array($user['role'], ['admin', 'manager'], true);
                $progress = $canManageTask ? max(0, min(100, (int)($_POST['progress'] ?? $detail['task']['progress']))) : (int)$detail['task']['progress'];
                $assignedUserId = $canManageTask && isset($_POST['assigned_user_id']) && $_POST['assigned_user_id'] !== '' ? (int)$_POST['assigned_user_id'] : ($canManageTask ? null : ($detail['task']['assigned_user_id'] ?? null));
                if ($canManageTask) validate_task_assignee($user, $assignedUserId, (int)$detail['task']['facility_id']);
                $status = $progress >= 100 ? 'closed' : 'pending';
                $closedAt = $progress >= 100 ? 'NOW()' : 'NULL';
                if ($canManageTask) {
                    db()->prepare("UPDATE tasks SET progress = ?, status = ?, closed_at = $closedAt, assigned_user_id = ? WHERE id = ?")
                        ->execute([$progress, $status, $assignedUserId, $taskId]);
                }
                $note = trim((string)($_POST['note'] ?? ''));
                $updateId = null;
                $hasFiles = !empty($_FILES['files']['name']) && (
                    is_array($_FILES['files']['name'])
                        ? count(array_filter($_FILES['files']['name'])) > 0
                        : $_FILES['files']['name'] !== ''
                );
                if ($note !== '' || ($canManageTask && $progress !== (int)$detail['task']['progress']) || $hasFiles) {
                    db()->prepare('INSERT INTO task_updates (task_id, user_id, note, progress) VALUES (?, ?, ?, ?)')
                        ->execute([$taskId, (int)$user['id'], $note, $progress]);
                    $updateId = (int)db()->lastInsertId();
                }
                upload_files('files', $taskId, (int)$user['id'], $updateId);
                flash('Task updated.');
                redirect_to('task', ['id' => $taskId]);

            case 'task_delete':
                require_admin();
                $taskId = (int)$_POST['task_id'];
                db()->prepare('DELETE FROM tasks WHERE id = ?')->execute([$taskId]);
                flash('Task deleted.');
                redirect_to('tasks');

            case 'save_guest_registration':
                require_once __DIR__ . '/inc/forms.php';
                require_once __DIR__ . '/inc/phone.php';
                $user = require_login();
                $facilityId = (int)($_POST['facility_id'] ?? 0);
                if (!$facilityId || !in_array($facilityId, accessible_facility_ids($user), true)) {
                    throw new RuntimeException('Select a property you can access.');
                }
                $saveStatus = ($_POST['save_status'] ?? 'prepared') === 'draft' ? 'draft' : 'prepared';
                $fullName = trim((string)($_POST['full_name'] ?? ''));
                $idPassport = trim((string)($_POST['id_passport_no'] ?? ''));
                $telephone = normalize_phone_from_fields(
                    (string)($_POST['telephone_dial_code'] ?? DEFAULT_DIAL_CODE),
                    (string)($_POST['telephone_national'] ?? '')
                );
                $emergencyTelephone = normalize_phone_from_fields(
                    (string)($_POST['emergency_contact_dial_code'] ?? DEFAULT_DIAL_CODE),
                    (string)($_POST['emergency_contact_national'] ?? '')
                );
                $phoneError = validate_phone($telephone);
                if ($phoneError) {
                    throw new RuntimeException('Guest phone: ' . $phoneError);
                }
                $emergencyError = validate_phone($emergencyTelephone);
                if ($emergencyError) {
                    throw new RuntimeException('Emergency contact phone: ' . $emergencyError);
                }
                $data = [
                    'fullName' => $fullName,
                    'idPassportNo' => $idPassport,
                    'address' => trim((string)($_POST['address'] ?? '')),
                    'telephone' => $telephone,
                    'email' => trim((string)($_POST['email'] ?? '')),
                    'vehicleRegistration' => trim((string)($_POST['vehicle_registration'] ?? '')),
                    'arrivalDate' => (string)($_POST['arrival_date'] ?? ''),
                    'departureDate' => (string)($_POST['departure_date'] ?? ''),
                    'numberOfGuests' => (string)($_POST['number_of_guests'] ?? ''),
                    'roomNumber' => trim((string)($_POST['room_number'] ?? '')),
                    'emergencyContactName' => trim((string)($_POST['emergency_contact_name'] ?? '')),
                    'emergencyContactTelephone' => $emergencyTelephone,
                    'specialOccasions' => trim((string)($_POST['special_occasions'] ?? '')),
                    'guestSignatureName' => '',
                    'guestSignature' => '',
                    'guestSignatureDate' => '',
                    'hotelRepName' => '',
                    'hotelRepSignature' => '',
                    'hotelRepSignatureDate' => '',
                ];
                $names = split_guest_name($fullName);
                $searchText = strtolower(implode(' ', array_values($data)));
                $contentHash = hash('sha256', json_encode($data, JSON_UNESCAPED_UNICODE));
                $json = json_encode($data, JSON_UNESCAPED_UNICODE);
                $now = date('Y-m-d H:i:s');
                db()->prepare(
                    'INSERT INTO form_submissions (form_slug, facility_id, submitted_by, submitted_at, status, prepared_by, prepared_at, guest_name, guest_surname, id_number, form_data, content_hash, search_text)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
                )->execute([
                    'guest-registration',
                    $facilityId,
                    (int)$user['id'],
                    $now,
                    $saveStatus,
                    (int)$user['id'],
                    $now,
                    $names['guest_name'],
                    $names['guest_surname'],
                    $idPassport,
                    $json,
                    $contentHash,
                    $searchText,
                ]);
                flash($saveStatus === 'draft'
                    ? 'Draft preparation saved. Complete check-in in the Next.js app.'
                    : 'Guest preparation saved. Complete check-in in the Next.js app for signatures and PDF.');
                redirect_to('forms');

            default:
                throw new RuntimeException('Unknown action.');
        }
    } catch (Throwable $error) {
        flash($error->getMessage(), 'error');
        redirect_to((string)($_POST['return_page'] ?? 'dashboard'), !empty($_POST['return_id']) ? ['id' => (int)$_POST['return_id']] : []);
    }
}

function validate_task_assignee(array $user, ?int $assigneeId, int $facilityId): void {
    if (!$assigneeId) return;
    $stmt = db()->prepare('SELECT id, role, facility_id, access_all, active FROM users WHERE id = ?');
    $stmt->execute([$assigneeId]);
    $assignee = $stmt->fetch();
    if (!$assignee || empty($assignee['active'])) {
        throw new RuntimeException('That user cannot be assigned to this property task.');
    }
    if ($user['role'] === 'admin' || $assignee['role'] === 'admin' || !empty($assignee['access_all'])) {
        return;
    }
    $access = db()->prepare('SELECT 1 FROM user_facilities WHERE user_id = ? AND facility_id = ?');
    $access->execute([$assigneeId, $facilityId]);
    if (!$access->fetchColumn() && (int)$assignee['facility_id'] !== $facilityId) {
        throw new RuntimeException('That user cannot be assigned to this property task.');
    }
}

if ((string)($_GET['page'] ?? '') === 'login' && current_user()) redirect_to('dashboard');

$page = (string)($_GET['page'] ?? (current_user() ? 'dashboard' : 'login'));
$pages = [
    'login' => 'login.php',
    'dashboard' => 'dashboard.php',
    'tasks' => 'tasks.php',
    'task-create' => 'task-create.php',
    'task-dashboard' => 'task-dashboard.php',
    'task' => 'task.php',
    'complete' => 'complete.php',
    'history' => 'history.php',
    'history-detail' => 'history-detail.php',
    'forms' => 'forms.php',
    'form-guest-registration' => 'form-guest-registration.php',
    'facilities' => 'facilities.php',
    'checklists' => 'checklists.php',
    'checklist' => 'checklist.php',
    'users' => 'users.php',
];

if (!isset($pages[$page])) $page = current_user() ? 'dashboard' : 'login';
if ($page !== 'login') require_login();
require __DIR__ . '/pages/' . $pages[$page];
