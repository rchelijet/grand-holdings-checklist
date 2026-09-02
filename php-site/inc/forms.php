<?php

function available_forms(): array {
    return [
        [
            'slug' => 'guest-registration',
            'name' => 'Guest Registration',
            'description' => 'Prepare guest details before arrival and complete registrations at check-in with signatures and PDF.',
        ],
    ];
}

function get_form_by_slug(string $slug): ?array {
    foreach (available_forms() as $form) {
        if ($form['slug'] === $slug) return $form;
    }
    return null;
}

function form_url(string $slug): string {
    return match ($slug) {
        'guest-registration' => url('form-guest-registration'),
        default => url('forms'),
    };
}

function guest_registration_clauses(): array {
    return [
        'Check-in & Check-out: Check-in time is 14:00 and check-out time is 10:00. Early arrivals or late departures may incur additional charges.',
        'Personal Property: The hotel is not liable for loss of or damage to personal belongings, valuables, vehicles, or any other property brought onto the premises unless caused by the hotel\'s negligence.',
        'Use of Facilities: I/we use all hotel facilities (including pool, gym, parking, stairs, bathrooms, etc.) entirely at my/our own risk.',
        'Conduct: I/we agree to respect other guests and the property, and accept liability for any loss, damage, or breakages caused by me/us during my/our stay.',
        'Health & Safety: I/we confirm that I/we am/are in good health and able to safely use the hotel\'s facilities.',
        'Indemnity: I/we hereby indemnify, hold harmless, and waive any claims against the hotel, its owners, staff, and agents for any injury, loss, damage, or death suffered by me/us, whether arising from my/our own actions, other guests, natural causes, or events beyond the hotel\'s reasonable control.',
        'Legal Compliance: I/we agree to abide by the hotel\'s rules and any applicable laws or regulations.',
    ];
}

function split_guest_name(string $fullName): array {
    $trimmed = trim($fullName);
    if ($trimmed === '') return ['guest_name' => '', 'guest_surname' => ''];
    $parts = preg_split('/\s+/', $trimmed) ?: [];
    if (count($parts) === 1) return ['guest_name' => $parts[0], 'guest_surname' => ''];
    $surname = array_pop($parts);
    return ['guest_name' => implode(' ', $parts), 'guest_surname' => $surname];
}
