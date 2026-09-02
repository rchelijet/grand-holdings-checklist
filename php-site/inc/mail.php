<?php
declare(strict_types=1);

/**
 * Small authenticated SMTP client for PHP 8.2 hosting without Composer.
 *
 * This deliberately does not use PHP mail(), which cannot reliably provide
 * authenticated SMTP or transport encryption. TLS certificate verification is
 * enabled for both STARTTLS and implicit TLS connections.
 */

function task_notification_recipients(int $facilityId): array {
    $stmt = db()->prepare(
        "SELECT DISTINCT u.id, u.name, u.email
         FROM users u
         LEFT JOIN user_facilities uf
           ON uf.user_id = u.id AND uf.facility_id = ?
         WHERE u.role = 'manager'
           AND u.active = 1
           AND (u.access_all = 1 OR u.facility_id = ? OR uf.facility_id IS NOT NULL)
           AND TRIM(u.email) <> ''
         ORDER BY u.id"
    );
    $stmt->execute([$facilityId, $facilityId]);
    return array_values(array_filter($stmt->fetchAll(), static fn(array $recipient): bool =>
        filter_var($recipient['email'] ?? '', FILTER_VALIDATE_EMAIL) !== false
    ));
}

function task_notification_html(array $task): string {
    $escape = static fn($value): string => e($value);
    $description = trim((string)($task['description'] ?? '')) ?: 'No description provided.';
    $expectedDate = trim((string)($task['expected_date'] ?? '')) ?: 'Not specified';
    return '<!doctype html><html lang="en"><body style="margin:0;background:#f7f3ec;color:#193228;font-family:Arial,sans-serif">'
        . '<div style="max-width:620px;margin:24px auto;padding:28px;background:#fff;border:1px solid #e4dac8">'
        . '<p style="margin:0 0 8px;color:#a17a35;font-size:12px;font-weight:bold;letter-spacing:.14em;text-transform:uppercase">Grand Holdings</p>'
        . '<h1 style="margin:0 0 24px;font-size:26px">New task created</h1>'
        . '<table role="presentation" style="width:100%;border-collapse:collapse">'
        . '<tr><td style="padding:8px 0;font-weight:bold;width:180px">Property</td><td style="padding:8px 0">' . $escape($task['facility_name']) . '</td></tr>'
        . '<tr><td style="padding:8px 0;font-weight:bold">Task</td><td style="padding:8px 0">' . $escape($task['title']) . '</td></tr>'
        . '<tr><td style="padding:8px 0;font-weight:bold">Created by</td><td style="padding:8px 0">' . $escape($task['creator_name']) . ' &lt;' . $escape($task['creator_email']) . '&gt;</td></tr>'
        . '<tr><td style="padding:8px 0;font-weight:bold">Expected completion</td><td style="padding:8px 0">' . $escape($expectedDate) . '</td></tr>'
        . '</table>'
        . '<h2 style="margin:24px 0 8px;font-size:16px">Description</h2>'
        . '<p style="margin:0;white-space:pre-wrap;line-height:1.6">' . $escape($description) . '</p>'
        . '</div></body></html>';
}

function task_notification_text(array $task): string {
    $description = trim((string)($task['description'] ?? '')) ?: 'No description provided.';
    $expectedDate = trim((string)($task['expected_date'] ?? '')) ?: 'Not specified';
    return implode("\n", [
        'New task for ' . $task['facility_name'],
        '',
        'Task: ' . $task['title'],
        'Property: ' . $task['facility_name'],
        'Created by: ' . $task['creator_name'] . ' <' . $task['creator_email'] . '>',
        'Expected completion: ' . $expectedDate,
        'Description: ' . $description,
    ]);
}

function smtp_notification_config(): array {
    $password = trim((string)app_config('smtp_password'));
    if ($password === '' || str_starts_with($password, 'YOUR_')) {
        throw new RuntimeException('SMTP notifications are not configured: set smtp_password.');
    }

    $port = (int)app_config('smtp_port');
    $encryption = strtolower(trim((string)app_config('smtp_encryption')));
    if ($port < 1 || $port > 65535 || !in_array($encryption, ['tls', 'ssl'], true)) {
        throw new RuntimeException('SMTP notifications are not configured: invalid SMTP settings.');
    }

    $username = trim((string)app_config('smtp_username'));
    $host = trim((string)app_config('smtp_host'));
    $from = trim((string)app_config('smtp_from_email'));
    if ($host === '' || !filter_var($username, FILTER_VALIDATE_EMAIL) || !filter_var($from, FILTER_VALIDATE_EMAIL)) {
        throw new RuntimeException('SMTP notifications are not configured: invalid SMTP settings.');
    }

    return [
        'host' => $host,
        'port' => $port,
        'encryption' => $encryption,
        'username' => $username,
        'password' => $password,
        'from' => $from,
        'from_name' => trim((string)app_config('smtp_from_name')) ?: 'Grand Holdings Checklist Manager',
        'timeout' => max(5, (int)app_config('smtp_timeout')),
    ];
}

function smtp_write($socket, string $data): void {
    $remaining = $data;
    while ($remaining !== '') {
        $written = fwrite($socket, $remaining);
        if ($written === false || $written === 0) {
            throw new RuntimeException('Could not write to the SMTP server.');
        }
        $remaining = (string)substr($remaining, $written);
    }
}

function smtp_expect($socket, array $expectedCodes): void {
    $code = null;
    do {
        $line = fgets($socket);
        if ($line === false) {
            throw new RuntimeException('SMTP server closed the connection.');
        }
        if (preg_match('/^(\d{3})([ -])/', $line, $matches)) {
            $code = (int)$matches[1];
            $lastLine = $matches[2] === ' ';
        } else {
            $lastLine = true;
        }
    } while (!$lastLine);

    if ($code === null || !in_array($code, $expectedCodes, true)) {
        throw new RuntimeException('SMTP server rejected the notification.');
    }
}

function smtp_command($socket, string $command, array $expectedCodes): void {
    smtp_write($socket, $command . "\r\n");
    smtp_expect($socket, $expectedCodes);
}

function smtp_header(string $value): string {
    return '=?UTF-8?B?' . base64_encode($value) . '?=';
}

function smtp_send_task_email(array $recipients, array $task): void {
    $config = smtp_notification_config();
    $host = $config['host'];
    $transport = $config['encryption'] === 'ssl' ? 'ssl://' : 'tcp://';
    $context = stream_context_create([
        'ssl' => [
            'verify_peer' => true,
            'verify_peer_name' => true,
            'allow_self_signed' => false,
            'peer_name' => $host,
        ],
    ]);
    $errno = 0;
    $error = '';
    $socket = stream_socket_client(
        $transport . $host . ':' . $config['port'],
        $errno,
        $error,
        $config['timeout'],
        STREAM_CLIENT_CONNECT,
        $context
    );
    if (!is_resource($socket)) {
        throw new RuntimeException('Could not connect to the SMTP server.');
    }

    stream_set_timeout($socket, $config['timeout']);
    try {
        smtp_expect($socket, [220]);
        smtp_command($socket, 'EHLO localhost', [250]);

        if ($config['encryption'] === 'tls') {
            smtp_command($socket, 'STARTTLS', [220]);
            $crypto = stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
            if ($crypto !== true) {
                throw new RuntimeException('Could not establish encrypted SMTP transport.');
            }
            smtp_command($socket, 'EHLO localhost', [250]);
        }

        smtp_command($socket, 'AUTH LOGIN', [334]);
        smtp_command($socket, base64_encode($config['username']), [334]);
        smtp_command($socket, base64_encode($config['password']), [235]);
        smtp_command($socket, 'MAIL FROM:<' . $config['from'] . '>', [250]);
        foreach ($recipients as $recipient) {
            smtp_command($socket, 'RCPT TO:<' . $recipient['email'] . '>', [250, 251]);
        }
        smtp_command($socket, 'DATA', [354]);

        $subject = preg_replace('/[\r\n]+/', ' ', (string)$task['title']) ?: 'New task';
        $headers = [
            'Date: ' . date(DATE_RFC2822),
            'From: ' . smtp_header($config['from_name']) . ' <' . $config['from'] . '>',
            'To: undisclosed-recipients:;',
            'Subject: ' . smtp_header('New task for ' . $task['facility_name'] . ': ' . $subject),
            'Message-ID: <task-' . (int)$task['id'] . '-' . bin2hex(random_bytes(8)) . '@' . $host . '>',
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=UTF-8',
            'Content-Transfer-Encoding: base64',
        ];
        $body = chunk_split(base64_encode(task_notification_html($task)));
        $message = implode("\r\n", $headers) . "\r\n\r\n" . $body;
        $message = preg_replace('/^\./m', '..', $message) ?? $message;
        smtp_write($socket, $message . "\r\n.\r\n");
        smtp_expect($socket, [250]);
        smtp_command($socket, 'QUIT', [221, 250]);
    } finally {
        fclose($socket);
    }
}

function send_task_created_notifications(int $taskId): int {
    $stmt = db()->prepare(
        'SELECT t.id, t.facility_id, t.title, t.description, t.expected_date,
                f.name AS facility_name,
                creator.name AS creator_name, creator.email AS creator_email
         FROM tasks t
         JOIN facilities f ON f.id = t.facility_id
         JOIN users creator ON creator.id = t.created_by
         WHERE t.id = ?'
    );
    $stmt->execute([$taskId]);
    $task = $stmt->fetch();
    if (!$task) {
        throw new RuntimeException('Task notification data could not be loaded.');
    }

    $recipients = task_notification_recipients((int)$task['facility_id']);
    if (!$recipients) return 0;
    smtp_send_task_email($recipients, $task);
    return count($recipients);
}
