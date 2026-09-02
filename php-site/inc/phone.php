<?php

require_once __DIR__ . '/country-codes.php';

function strip_national_leading_zero(string $national): string
{
    $digits = preg_replace('/\D/', '', $national) ?? '';
    return str_starts_with($digits, '0') ? substr($digits, 1) : $digits;
}

function format_e164(string $dialCode, string $national): string
{
    $codeDigits = preg_replace('/\D/', '', $dialCode) ?? '';
    $nationalDigits = strip_national_leading_zero($national);
    if ($codeDigits === '' || $nationalDigits === '') {
        return '';
    }
    return '+' . $codeDigits . $nationalDigits;
}

function match_dial_code_from_e164(string $e164): ?array
{
    $digits = preg_replace('/\D/', '', $e164) ?? '';
    if ($digits === '') {
        return null;
    }

    $countries = country_codes_by_dial_length();
    foreach ($countries as $country) {
        $code = preg_replace('/\D/', '', $country['dialCode']) ?? '';
        if ($code !== '' && str_starts_with($digits, $code)) {
            return [
                'country' => $country,
                'national' => substr($digits, strlen($code)),
            ];
        }
    }
    return null;
}

function parse_phone(string $value, string $defaultDialCode = DEFAULT_DIAL_CODE): array
{
    $trimmed = trim($value);
    if ($trimmed === '') {
        return ['dialCode' => $defaultDialCode, 'national' => ''];
    }

    if (str_starts_with($trimmed, '+')) {
        $matched = match_dial_code_from_e164($trimmed);
        if ($matched) {
            return [
                'dialCode' => $matched['country']['dialCode'],
                'national' => $matched['national'],
            ];
        }
        return [
            'dialCode' => $defaultDialCode,
            'national' => preg_replace('/\D/', '', $trimmed) ?? '',
        ];
    }

    return [
        'dialCode' => $defaultDialCode,
        'national' => strip_national_leading_zero($trimmed),
    ];
}

function normalize_phone(string $value): string
{
    $trimmed = trim($value);
    if ($trimmed === '') {
        return '';
    }

    if (str_starts_with($trimmed, '+')) {
        $matched = match_dial_code_from_e164($trimmed);
        if ($matched) {
            return format_e164($matched['country']['dialCode'], $matched['national']);
        }
        $digits = preg_replace('/\D/', '', $trimmed) ?? '';
        return $digits !== '' ? '+' . $digits : '';
    }

    $parsed = parse_phone($trimmed);
    return format_e164($parsed['dialCode'], $parsed['national']);
}

function validate_phone(string $value): ?string
{
    $trimmed = trim($value);
    if ($trimmed === '') {
        return null;
    }

    $normalized = normalize_phone($trimmed);
    if ($normalized === '') {
        return 'Enter a valid phone number.';
    }

    $digits = preg_replace('/\D/', '', $normalized) ?? '';
    if (strlen($digits) < 8) {
        return 'Phone number is too short.';
    }
    if (strlen($digits) > 15) {
        return 'Phone number is too long.';
    }

    $parsed = parse_phone($normalized);
    if (!find_country_by_dial_code($parsed['dialCode'])) {
        return 'Select a valid country dialing code.';
    }

    return null;
}

function whatsapp_url(string $phone, ?string $message = null): ?string
{
    $normalized = normalize_phone($phone);
    if ($normalized === '') {
        return null;
    }
    $digits = preg_replace('/\D/', '', $normalized) ?? '';
    if (strlen($digits) < 8) {
        return null;
    }
    $url = 'https://wa.me/' . $digits;
    $text = trim((string)$message);
    if ($text === '') {
        return $url;
    }
    return $url . '?text=' . rawurlencode($text);
}

function guest_whatsapp_message(string $guestFullName, string $facilityName): string
{
    $name = trim($guestFullName);
    $facility = trim($facilityName);
    return "Dear {$name}. The team look forward to welcoming you at {$facility}. Please feel free to message us on here if there is anything else we can do for you before your arrival";
}

function normalize_phone_from_fields(string $dialCode, string $national): string
{
    return format_e164($dialCode, $national);
}

function render_phone_link(string $phone, ?string $message = null): string
{
    $display = normalize_phone($phone);
    if ($display === '') {
        return '';
    }
    $wa = whatsapp_url($phone, $message);
    $html = '<a href="tel:' . e($display) . '">' . e($display) . '</a>';
    if ($wa) {
        $html .= ' <a class="whatsapp-link" href="' . e($wa) . '" target="_blank" rel="noopener noreferrer">WhatsApp</a>';
    }
    return $html;
}

function render_whatsapp_button(string $phone, ?string $message = null): string
{
    if (validate_phone($phone)) {
        return '';
    }
    $wa = whatsapp_url($phone, $message);
    if (!$wa) {
        return '';
    }
    return '<a class="button whatsapp" href="' . e($wa) . '" target="_blank" rel="noopener noreferrer">WhatsApp</a>';
}

function render_phone_input(string $label, string $fieldPrefix, string $value = ''): void
{
    $parsed = parse_phone($value);
    $selected = find_country_by_dial_code($parsed['dialCode']) ?? country_codes()[0];
    $countriesJson = json_encode(country_codes(), JSON_UNESCAPED_UNICODE);
    ?>
    <div class="phone-input" data-phone-input data-countries='<?= e($countriesJson) ?>'>
        <span class="phone-input-label"><?= e($label) ?></span>
        <div class="phone-input-row">
            <div class="phone-country-wrap">
                <input
                    type="text"
                    class="phone-country-search"
                    role="combobox"
                    aria-expanded="false"
                    placeholder="Search country…"
                    value="<?= e('(' . $selected['dialCode'] . ') ' . $selected['name']) ?>"
                    autocomplete="off"
                >
                <input type="hidden" name="<?= e($fieldPrefix) ?>_dial_code" value="<?= e($parsed['dialCode']) ?>">
                <ul class="phone-country-list" role="listbox" hidden></ul>
            </div>
            <input
                type="tel"
                inputmode="numeric"
                name="<?= e($fieldPrefix) ?>_national"
                class="phone-national"
                placeholder="767771900"
                value="<?= e($parsed['national']) ?>"
            >
        </div>
    </div>
    <?php
}
