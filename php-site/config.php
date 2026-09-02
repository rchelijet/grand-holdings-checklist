<?php
/**
 * Grand Holdings PHP/MySQL configuration.
 *
 * Edit these values with the database details from your xneelo control panel.
 */
return [
    'db_host' => 'localhost',
    'db_name' => 'YOUR_DATABASE_NAME',
    'db_user' => 'YOUR_DATABASE_USER',
    'db_pass' => 'YOUR_DATABASE_PASSWORD',
    'db_charset' => 'utf8mb4',
    'app_timezone' => 'Africa/Johannesburg',
    'app_name' => 'Grand Holdings Checklist Manager',
    'base_url' => '',
    'upload_dir' => __DIR__ . '/uploads/tasks',
    'upload_url' => 'uploads/tasks',
    'max_upload_bytes' => 8 * 1024 * 1024,

    // Authenticated SMTP task notifications. Replace only the placeholder
    // password with the rotated credential; do not commit production secrets.
    'smtp_host' => 'smtp.melohospitality.co.za',
    'smtp_port' => 587,
    'smtp_encryption' => 'tls',
    'smtp_username' => 'noreply@meloshospitality.co.za',
    'smtp_password' => 'YOUR_SMTP_PASSWORD',
    'smtp_from_email' => 'noreply@meloshospitality.co.za',
    'smtp_from_name' => 'Grand Holdings Checklist Manager',
    'smtp_timeout' => 15,
];
